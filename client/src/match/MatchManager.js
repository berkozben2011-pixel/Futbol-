import { PITCH } from '../core/GameEngine.js';
import { PlayerEntity } from './PlayerEntity.js';
import { Ball } from './Ball.js';
import { AIController } from './AIController.js';
import { getAllCharacterIds } from '../characters/CharacterData.js';

const MATCH_SECONDS = 5 * 60;
const SYNC_INTERVAL = 0.05;     // Host -> Guest state yayını (~20Hz)
const CELEBRATION_SECONDS = 6;  // Gol sevinci süresi

// Basit 5v5 diziliş (GK + DF + DF + MF + FW). Home takım -z tarafını savunur
// ve +z yönündeki kaleye atar; Away takım tam tersi.
function buildFormation(team) {
  const dir = team === 'home' ? 1 : -1;
  const ownGoalZ = team === 'home' ? PITCH.minZ : PITCH.maxZ;
  return [
    { role: 'GK', x: 0, z: ownGoalZ + dir * 3 },
    { role: 'DF', x: -12, z: ownGoalZ + dir * 20 },
    { role: 'DF', x: 12, z: ownGoalZ + dir * 20 },
    { role: 'MF', x: 0, z: ownGoalZ + dir * 40 },
    { role: 'FW', x: 0, z: ownGoalZ + dir * 55 }
  ];
}

export class MatchManager {
  constructor({ engine, THREE, characterManager, userCharacterId = 'berk', mode = 'quick', onEvent, network = null }) {
    this.engine = engine;
    this.THREE = THREE;
    this.characterManager = characterManager;
    this.mode = mode; // 'quick' | 'training' | 'online'
    this.onEvent = onEvent || (() => {});

    // network = { role: 'host' | 'guest', client: NetworkClient }
    this.network = network;
    this.isHost = network && network.role === 'host';
    this.isGuest = network && network.role === 'guest';

    this.players = [];
    this.userPlayer = null;       // Bu istemcideki insanın karakteri (host / offline)
    this.remoteUserPlayer = null; // Host için: karşı tarafın kontrol ettiği away MF
    this.ball = new Ball(engine.scene, THREE);
    this.ai = new AIController(THREE);

    this.score = { home: 0, away: 0 };
    this.timeLeft = MATCH_SECONDS;
    this.matchOver = false;
    this.goalCelebrationTimer = 0;
    this.celebration = null; // { scorer, mesh, mixer }

    this.moveInput = { x: 0, z: 0 };
    this.sprinting = false;
    this.pendingAction = null;

    this.remoteMoveInput = { x: 0, z: 0 };
    this.remoteSprinting = false;
    this.localTeam = this.isGuest ? 'away' : 'home';
    this.activePlayerIndex = this.isGuest ? 8 : 3;
    this.remoteActivePlayerIndex = 8;
    this.cameraLookTarget = new THREE.Vector3();

    this.userCharacterId = userCharacterId;
    this._syncTimer = 0;
    this._lastSnapshot = null;

    if (this.network && this.network.client) {
      this.network.client.on('remote_player_input', (data) => this.onRemoteInput(data));
      this.network.client.on('remote_match_state', (data) => this.onRemoteState(data));
      this.network.client.on('opponent_left', () => this.onEvent('opponentLeft', {}));
    }
  }

  async init() {
    const homeFormation = buildFormation('home');
    const awayFormation = buildFormation('away');

    // Karakter listesi CharacterData.js'ten dinamik olarak alınır: yeni bir
    // karakter eklendiğinde bu dosyaya dokunmaya gerek kalmadan otomatik
    // olarak takımlara dahil edilir.
    const allIds = getAllCharacterIds();
    const pickChar = (offset, i) => allIds[(offset + i) % allIds.length];

    // İki istemcide de oyuncu dizilimi birebir aynı olmalı: önce HOME (5), sonra AWAY (5).
    // Oda kaydındaki karakter seçimleri her iki ekranda da aynı modellerin yüklenmesini sağlar.
    const roomPlayers = this.network?.room?.players || [];
    const hostCharacterId = roomPlayers[0]?.character || 'berk';
    const guestCharacterId = roomPlayers[1]?.character || 'yigit';
    const online = this.mode === 'online' && !!this.network;

    for (let i = 0; i < homeFormation.length; i++) {
      const isHumanSlot = i === 3;
      const isUser = isHumanSlot && (!online || this.isHost);
      const isRemote = isHumanSlot && online && this.isGuest;
      const charId = isHumanSlot && online
        ? hostCharacterId
        : (isUser ? this.userCharacterId : pickChar(0, i));
      const player = await this.spawnPlayer('home', homeFormation[i], charId, isUser, { isRemote });
      if (isRemote) this.remoteUserPlayer = player;
    }

    if (this.mode !== 'training') {
      for (let i = 0; i < awayFormation.length; i++) {
        const isHumanSlot = i === 3;
        const isUser = isHumanSlot && online && this.isGuest;
        const isRemote = isHumanSlot && online && this.isHost;
        const charId = isHumanSlot && online
          ? guestCharacterId
          : (isUser ? this.userCharacterId : pickChar(2, i));
        const player = await this.spawnPlayer('away', awayFormation[i], charId, isUser, { isRemote });
        if (isRemote) this.remoteUserPlayer = player;
      }
    }

    this.resetKickoff();
    this.setActivePlayer(this.isGuest ? this.players.findIndex(p => p.team === 'away' && p.role === 'MF') : this.players.findIndex(p => p.team === 'home' && p.role === 'MF'));
  }

  // Takımın kontrol edilen futbolcusunu değiştirir. Tab / LB ile sıradaki oyuncuya geçilir.
  switchPlayer() {
    const teamPlayers = this.players
      .map((p, index) => ({ p, index, distance: p.mesh.position.distanceTo(this.ball.mesh.position) }))
      .filter(item => item.p.team === this.localTeam)
      .sort((a, b) => a.distance - b.distance);
    if (!teamPlayers.length) return;
    // Önce topa en yakın futbolcuya, zaten o seçiliyse sıradaki en yakına geç.
    const current = teamPlayers.findIndex(item => item.index === this.activePlayerIndex);
    const next = teamPlayers[(current + 1) % teamPlayers.length];
    this.setActivePlayer(next.index);
  }

  setActivePlayer(index) {
    const player = this.players[index];
    if (!player || player.team !== this.localTeam) return;
    this.activePlayerIndex = index;
    if (this.isGuest) {
      // Guest'in kontrol seçimi host'a input ile gönderilir; host tarafında remote olarak atanır.
      this.remoteUserPlayer = player;
      for (const p of this.players) p.isRemote = p === player;
      if (this.network?.client) this.network.client.sendInput({ x: this.moveInput.x, z: this.moveInput.z, sprint: this.sprinting, playerIndex: index });
    } else {
      this.userPlayer = player;
      for (const p of this.players) p.isUser = p === player;
    }
  }

  spawnPlayer(team, formationSlot, charId, isUser, extra = {}) {
    return new Promise((resolve) => {
      this.characterManager.loadCharacterModel(charId, (mesh, charData, mixer) => {
        mesh.position.set(formationSlot.x, 0, formationSlot.z);
        this.engine.scene.add(mesh);

        const player = new PlayerEntity({
          THREE: this.THREE,
          mesh,
          charData,
          team,
          isUser,
          role: formationSlot.role,
          formationPos: { x: formationSlot.x, z: formationSlot.z }
        });
        player.isRemote = !!extra.isRemote;
        player.mixer = mixer;

        this.players.push(player);
        if (isUser) this.userPlayer = player;
        resolve(player);
      });
    });
  }

  resetKickoff() {
    this.ball.reset({ x: 0, z: 0 });
    for (const player of this.players) {
      player.mesh.position.set(player.formationPos.x, 0, player.formationPos.z);
    }
  }

  setMoveInput(x, z) {
    this.moveInput.x = x;
    this.moveInput.z = z;
  }

  setSprinting(isSprinting) {
    this.sprinting = isSprinting;
  }

  // --- Aksiyonlar ---
  // Guest ise, aksiyonu doğrudan uygulamaz; host'a iletilmek üzere kuyruğa alır
  // (host otoriter simülasyonu çalıştırır). Host/offline modda aksiyon anında uygulanır.

  handleAction(type) {
    if (this.isGuest) {
      this.pendingAction = type;
      return;
    }
    this.applyAction(type, this.userPlayer);
  }

  applyAction(type, actor) {
    switch (type) {
      case 'pass': this.actionPass(actor); break;
      case 'through': this.actionThroughPass(actor); break;
      case 'shoot': this.actionShoot(actor); break;
      case 'tackle': this.actionTackle(actor); break;
    }
  }

  actionPass(actor) {
    if (!actor || this.ball.owner !== actor) return;
    const target = this.findNearestTeammate(actor);
    if (!target) return;
    const dir = target.mesh.position.clone().sub(actor.mesh.position);
    const power = 10 + (actor.charData.stats.pass / 100) * 6;
    actor.playKick?.();
    this.ball.kick(dir, power, actor);
  }

  actionThroughPass(actor) {
    if (!actor || this.ball.owner !== actor) return;
    const forwardZ = actor.team === 'home' ? 1 : -1;
    const dir = actor.getFacingDirection();
    dir.z += forwardZ * 1.5;
    const power = 15 + (actor.charData.stats.pass / 100) * 6;
    actor.playKick?.();
    this.ball.kick(dir, power, actor);
  }

  actionShoot(actor) {
    if (!actor || this.ball.owner !== actor) return;
    // ŞUT tuşu artık kaleye otomatik nişan almaz: ara pasıyla aynı yöne,
    // yalnızca yaklaşık %12 daha hızlı ve daha uzun mesafeli pas gönderir.
    const forwardZ = actor.team === 'home' ? 1 : -1;
    const dir = actor.getFacingDirection();
    dir.z += forwardZ * 1.5;
    const throughPower = 15 + (actor.charData.stats.pass / 100) * 6;
    const power = throughPower * 1.12;
    actor.playKick?.();
    this.ball.kick(dir, power, actor);
  }

  actionTackle(actor) {
    if (!actor || !this.ball.owner || this.ball.owner.team === actor.team) return;
    const dist = actor.mesh.position.distanceTo(this.ball.owner.mesh.position);
    if (dist < 1.4) {
      this.ball.owner = actor;
    }
  }

  findNearestTeammate(player) {
    let best = null;
    let bestDist = Infinity;
    for (const p of this.players) {
      if (p === player || p.team !== player.team) continue;
      const d = p.mesh.position.distanceTo(player.mesh.position);
      if (d < bestDist) {
        bestDist = d;
        best = p;
      }
    }
    return best;
  }

  // --- Online: gelen ağ verisi ---

  onRemoteInput(data) {
    // Sadece host bunu dinler: karşı tarafın joystick/aksiyon verisi
    if (Number.isInteger(data.playerIndex)) {
      const requested = this.players[data.playerIndex];
      if (requested && requested.team === 'away') {
        this.remoteActivePlayerIndex = data.playerIndex;
        this.remoteUserPlayer = requested;
        for (const p of this.players) p.isRemote = p === requested;
      }
    }
    this.remoteMoveInput.x = data.x || 0;
    this.remoteMoveInput.z = data.z || 0;
    this.remoteSprinting = !!data.sprint;
    if (data.action) {
      this.applyAction(data.action, this.remoteUserPlayer);
    }
  }

  onRemoteState(data) {
    // Sadece guest bunu dinler: host'tan gelen otoriter anlık görüntü
    this._lastSnapshot = data;
  }

  sendLocalInputIfGuest() {
    if (!this.isGuest || !this.network.client) return;
    this.network.client.sendInput({
      x: this.moveInput.x,
      z: this.moveInput.z,
      sprint: this.sprinting,
      action: this.pendingAction,
      playerIndex: this.activePlayerIndex
    });
    this.pendingAction = null;
  }

  broadcastStateIfHost(delta) {
    if (!this.isHost || !this.network.client) return;
    this._syncTimer += delta;
    if (this._syncTimer < SYNC_INTERVAL) return;
    this._syncTimer = 0;
    const celebratingIndex = this.celebration ? this.players.indexOf(this.celebration.scorer) : -1;
    this.network.client.socket.emit('match_state', {
      roomCode: this.network.client.roomCode,
      ball: { x: this.ball.mesh.position.x, z: this.ball.mesh.position.z },
      players: this.players.map(p => ({ x: p.mesh.position.x, z: p.mesh.position.z, ry: p.mesh.rotation.y })),
      score: this.score,
      timeLeft: this.timeLeft,
      celebratingIndex,
      hostActivePlayerIndex: this.activePlayerIndex
    });
  }

  // --- Gol sevinci ---

  startCelebration(scorer) {
    const variant = Math.floor(Math.random() * 3);
    this.celebration = { scorer, variant };
    scorer.startCelebration?.(variant);
    scorer.mesh.visible = true;
  }

  endCelebration() {
    if (!this.celebration) return;
    const { scorer } = this.celebration;
    scorer.stopCelebration?.();
    scorer.mesh.visible = true;
    this.celebration = null;
  }

  updateCelebrationCamera() {
    if (!this.celebration) return;
    const cam = this.engine.camera;
    const p = this.celebration.scorer.mesh.position;
    const facing = this.celebration.scorer.facing;
    // Karakterin baktığı yönde, önünde bir konum: kamera oradan karaktere
    // bakınca sevinci "önden" (yüzden) görürüz.
    const camTarget = p.clone().addScaledVector(facing, 6.5);
    camTarget.y = 3.2;
    cam.position.lerp(camTarget, 0.12);
    cam.lookAt(p.x, 1.3, p.z);
  }

  // --- Ana güncelleme döngüsü ---

  update(delta) {
    if (this.matchOver) return;

    if (this.isGuest) {
      this.updateAsGuest(delta);
      return;
    }

    if (this.goalCelebrationTimer > 0) {
      this.goalCelebrationTimer -= delta;
      if (this.celebration) {
        this.celebration.scorer.updateCelebrationAnimation?.(delta);
        this.updateCelebrationCamera();
      }
      if (this.goalCelebrationTimer <= 0) {
        this.endCelebration();
        this.resetKickoff();
      }
      this.broadcastStateIfHost(delta);
      return;
    }

    this.updatePlayerByInput(this.userPlayer, this.moveInput, this.sprinting, delta);
    if (this.remoteUserPlayer) {
      this.updatePlayerByInput(this.remoteUserPlayer, this.remoteMoveInput, this.remoteSprinting, delta);
    }

    this.ai.update(delta, { players: this.players, ball: this.ball });
    for (const p of this.players) {
      const hasBall = this.ball.owner === p;
      const isSprinting = p === this.userPlayer ? this.sprinting : (p === this.remoteUserPlayer ? this.remoteSprinting : false);
      p.updateProceduralAnimation?.(delta, hasBall, isSprinting);
    }
    this.ball.update(delta);
    this.checkPossessionPickup();
    this.checkGoal();
    this.updateCamera();

    for (const p of this.players) {
      if (p.mixer) p.mixer.update(delta);
    }

    this.timeLeft -= delta;
    if (this.timeLeft <= 0) {
      this.timeLeft = 0;
      this.endMatch();
    }
    this.onEvent('timeUpdate', { timeLeft: this.timeLeft, score: { ...this.score } });

    this.broadcastStateIfHost(delta);
  }

  updateAsGuest(delta) {
    this.sendLocalInputIfGuest();
    if (this._lastSnapshot) {
      const snap = this._lastSnapshot;
      this.ball.mesh.position.lerp(new this.THREE.Vector3(snap.ball.x, 0.35, snap.ball.z), 0.5);
      snap.players.forEach((ps, i) => {
        const p = this.players[i];
        if (!p) return;
        p.mesh.position.lerp(new this.THREE.Vector3(ps.x, 0, ps.z), 0.5);
        p.mesh.rotation.y = ps.ry;
        if (p.mixer) p.mixer.update(delta);
        p.updateProceduralAnimation?.(delta, false, false);
      });
      this.score = snap.score;
      this.timeLeft = snap.timeLeft;
      this.onEvent('timeUpdate', { timeLeft: this.timeLeft, score: { ...this.score } });

      // Host tarafında birinin gol sevinci varsa aynı görseli burada da oynat
      const idx = typeof snap.celebratingIndex === 'number' ? snap.celebratingIndex : -1;
      if (idx >= 0) {
        const scorer = this.players[idx];
        if (scorer && (!this.celebration || this.celebration.scorer !== scorer)) {
          if (this.celebration) this.endCelebration();
          this.startCelebration(scorer);
        }
        this.updateCelebrationCamera();
      } else if (this.celebration) {
        this.endCelebration();
      }

      // Kutlama yokken kamera guest'in seçtiği aktif futbolcuyu takip eder.
      if (idx < 0) {
        const myPlayer = this.players[this.activePlayerIndex];
        if (myPlayer) this.updateCameraFor(myPlayer);
      }
    }
  }

  updatePlayerByInput(player, moveInput, sprinting, delta) {
    if (!player) return;
    const THREE = this.THREE;

    // ÖNEMLİ: Kamera oyuncuyu arkadan takip ediyor. Home takımın kamerası +Z yönüne
    // bakar, away takımın kamerası -Z yönüne bakar. Bir kamera "ileri" yönü ne olursa
    // olsun, ekrandaki "sağ" dünya eksenlerinde farklı işarete karşılık gelir
    // (right = forward × up). Bu yüzden joystick girdisini doğrudan dünya X/Z olarak
    // değil, takımın kamera yönüne göre sağ/ileri eksenlerine göre uyguluyoruz.
    const forwardZ = player.team === 'home' ? 1 : -1;
    const rightX = -forwardZ; // right = forward × up, forward=(0,0,forwardZ), up=(0,1,0)

    const dir = new THREE.Vector3(
      moveInput.x * rightX,
      0,
      moveInput.z * forwardZ
    );
    if (dir.lengthSq() > 1) dir.normalize();

    const speedMul = sprinting ? 1.6 : 1;
    const speed = player.baseSpeed * speedMul;
    player.mesh.position.addScaledVector(dir, speed * delta);

    player.mesh.position.x = Math.max(PITCH.minX, Math.min(PITCH.maxX, player.mesh.position.x));
    player.mesh.position.z = Math.max(PITCH.minZ, Math.min(PITCH.maxZ, player.mesh.position.z));

    if (dir.lengthSq() > 0.0001) {
      player.setFacing(dir);
    }
  }

  checkPossessionPickup() {
    if (this.ball.owner) return;
    for (const player of this.players) {
      const dist = player.mesh.position.distanceTo(this.ball.mesh.position);
      if (dist < 0.9) {
        this.ball.owner = player;
        break;
      }
    }
  }

  checkGoal() {
    const pos = this.ball.mesh.position;
    const halfGoal = PITCH.goalWidth / 2;
    if (Math.abs(pos.x) > halfGoal) return;

    let scoringTeam = null;
    if (pos.z >= PITCH.maxZ - 0.5) {
      scoringTeam = 'home';
    } else if (pos.z <= PITCH.minZ + 0.5) {
      scoringTeam = 'away';
    }
    if (!scoringTeam) return;

    this.score[scoringTeam] += 1;
    this.goalCelebrationTimer = CELEBRATION_SECONDS;

    // Golü, topu en son vuran (ve doğru takımdan olan) oyuncuya atfet.
    // Kendi kalesine gol gibi tuhaf durumlarda kişiselleştirilmiş sevinç atlanır.
    const kicker = this.ball.lastKicker;
    const scorer = (kicker && kicker.team === scoringTeam) ? kicker : null;

    this.onEvent('goal', {
      scoringTeam,
      score: { ...this.score },
      scorerName: scorer ? scorer.charData.name : null
    });

    if (scorer) {
      this.startCelebration(scorer);
    }
  }

  updateCamera() {
    this.updateCameraFor(this.userPlayer);
  }

  // FC tarzı takip: aktif oyuncu ile top arasındaki noktayı kadrajda tutar.
  updateCameraFor(player) {
    if (!player) return;
    const cam = this.engine.camera;
    const p = player.mesh.position;
    const b = this.ball.mesh.position;
    const teamForward = player.team === 'home' ? 1 : -1;
    const targetX = p.x * 0.68 + b.x * 0.32;
    const targetZ = p.z * 0.68 + b.z * 0.32;
    const desiredX = targetX;
    const desiredY = 15.5;
    const desiredZ = targetZ - teamForward * 20;
    cam.position.x += (desiredX - cam.position.x) * 0.075;
    cam.position.y += (desiredY - cam.position.y) * 0.075;
    cam.position.z += (desiredZ - cam.position.z) * 0.075;
    this.cameraLookTarget.set(targetX, 0.5, targetZ + teamForward * 5);
    cam.lookAt(this.cameraLookTarget);
  }

  endMatch() {
    this.matchOver = true;
    let result = 'draw';
    if (this.score.home > this.score.away) result = 'home';
    else if (this.score.away > this.score.home) result = 'away';
    this.onEvent('matchEnd', { score: { ...this.score }, result });
  }
}
