import { GameEngine } from './core/GameEngine.js';
import { CharacterManager } from './characters/CharacterManager.js';
import { MatchManager } from './match/MatchManager.js';
import { UIManager } from './ui/UIManager.js';
import { NetworkClient } from './network/NetworkClient.js';
import { GamepadInput } from './ui/GamepadInput.js';
import { CharactersDatabase, getAllCharacterIds } from './characters/CharacterData.js';

// Kendi sunucunuzu farklı bir adreste çalıştırıyorsanız burayı güncelleyin.
const SERVER_URL = 'https://futbol-2x2m.onrender.com/';

window.addEventListener('DOMContentLoaded', () => {
  const mainMenu = document.getElementById('main-menu');
  const onlineModal = document.getElementById('online-modal');
  const onlineStatus = document.getElementById('online-status');
  const btnReady = document.getElementById('btn-ready');
  const characterSelect = document.getElementById('character-select');
  const characterCards = document.getElementById('character-cards');

  let engine = null;
  let ui = null;
  let matchManager = null;
  let network = null;
  let selectedCharacterId = 'berk';
  let pendingMode = null; // Karakter seçildikten sonra hangi moda devam edileceği

  // --- KARAKTER SEÇİM EKRANI ---

  function buildCharacterCards() {
    characterCards.innerHTML = '';
    for (const id of getAllCharacterIds()) {
      const c = CharactersDatabase[id];
      const card = document.createElement('div');
      card.className = 'char-card';

      const statRows = Object.entries(c.stats).map(([key, value]) => {
        const labels = {
          speed: 'Hız', acceleration: 'İvme', shootPower: 'Şut Gücü', shootAccuracy: 'İsabet',
          pass: 'Pas', ballControl: 'Top Hakim.', defense: 'Defans', stamina: 'Dayanıklılık'
        };
        return `
          <div class="stat-row">
            <span class="stat-label">${labels[key] || key}</span>
            <div class="stat-bar-bg"><div class="stat-bar-fill" style="width:${value}%;"></div></div>
          </div>`;
      }).join('');

      card.innerHTML = `
        <div class="char-name"><span class="color-dot" style="background:#${c.color.toString(16).padStart(6, '0')};"></span>${c.name}</div>
        <div class="char-role">${c.role}</div>
        ${statRows}
      `;

      card.addEventListener('click', () => {
        selectedCharacterId = id;
        characterSelect.style.display = 'none';
        onCharacterChosen();
      });

      characterCards.appendChild(card);
    }
  }

  function showCharacterSelect(nextMode) {
    pendingMode = nextMode;
    buildCharacterCards();
    mainMenu.style.display = 'none';
    onlineModal.style.display = 'none';
    characterSelect.style.display = 'flex';
  }

  document.getElementById('char-select-cancel').addEventListener('click', () => {
    characterSelect.style.display = 'none';
    mainMenu.style.display = 'flex';
  });

  function onCharacterChosen() {
    if (pendingMode === 'online') {
      onlineModal.style.display = 'flex';
      onlineStatus.textContent = '';
      btnReady.style.display = 'none';
    } else {
      startMatch({ mode: pendingMode });
    }
  }

  // --- ANA MENÜ ---

  document.getElementById('btn-play').addEventListener('click', () => {
    showCharacterSelect('quick');
  });

  document.getElementById('btn-training').addEventListener('click', () => {
    showCharacterSelect('training');
  });

  document.getElementById('btn-online').addEventListener('click', () => {
    showCharacterSelect('online');
  });

  document.getElementById('btn-online-cancel').addEventListener('click', () => {
    onlineModal.style.display = 'none';
    mainMenu.style.display = 'flex';
    if (network) network.disconnect();
  });

  document.getElementById('btn-back-to-menu').addEventListener('click', () => {
    // En temiz ve hatasız sıfırlama için sayfayı yeniden yükle (Three.js sahnesini/soketi elle temizlemek yerine)
    window.location.reload();
  });

  // --- ONLINE ODA AKIŞI ---

  document.getElementById('btn-create-room').addEventListener('click', async () => {
    try {
      onlineStatus.textContent = 'Sunucuya bağlanılıyor...';
      network = new NetworkClient(SERVER_URL);
      await network.connect();
      const res = await network.createRoom(selectedCharacterId);
      if (!res.success) { onlineStatus.textContent = 'Oda oluşturulamadı.'; return; }
      onlineStatus.textContent = `Oda kodu: ${res.roomCode}\nRakip bekleniyor...`;
      listenForOpponentAndStart(network, 'host');
    } catch (err) {
      onlineStatus.textContent = 'Sunucuya bağlanılamadı. Sunucunun çalıştığından emin olun.';
      console.error(err);
    }
  });

  document.getElementById('btn-join-room').addEventListener('click', async () => {
    const code = document.getElementById('join-code-input').value.trim().toUpperCase();
    if (!code) { onlineStatus.textContent = 'Lütfen bir oda kodu girin.'; return; }
    try {
      onlineStatus.textContent = 'Sunucuya bağlanılıyor...';
      network = new NetworkClient(SERVER_URL);
      await network.connect();
      const res = await network.joinRoom(code, selectedCharacterId);
      if (!res.success) { onlineStatus.textContent = res.message || 'Odaya katılınamadı.'; return; }
      onlineStatus.textContent = 'Odaya katıldın. Hazır olduğunda "HAZIRIM" bas.';
      btnReady.style.display = 'inline-block';
      listenForOpponentAndStart(network, 'guest');
    } catch (err) {
      onlineStatus.textContent = 'Sunucuya bağlanılamadı. Sunucunun çalıştığından emin olun.';
      console.error(err);
    }
  });

  function listenForOpponentAndStart(net, role) {
    net.on('update_lobby', (room) => {
      if (room.players.length === 2 && role === 'host') {
        btnReady.style.display = 'inline-block';
        onlineStatus.textContent = 'Rakip katıldı! Hazır olduğunda "HAZIRIM" bas.';
      }
    });
    net.on('start_match', (room) => {
      onlineModal.style.display = 'none';
      startMatch({ mode: 'online', network: { role, client: net, room } });
    });
  }

  btnReady.addEventListener('click', () => {
    if (!network) return;
    network.setReady(true);
    onlineStatus.textContent = 'Hazır! Rakip bekleniyor...';
    btnReady.disabled = true;
  });

  // --- MAÇ BAŞLATMA ---

  async function startMatch({ mode, network: netCfg = null }) {
    mainMenu.style.display = 'none';
    onlineModal.style.display = 'none';
    characterSelect.style.display = 'none';

    engine = new GameEngine();
    ui = new UIManager();
    const characterManager = new CharacterManager(engine.scene, THREE);

    matchManager = new MatchManager({
      engine,
      THREE,
      characterManager,
      userCharacterId: selectedCharacterId,
      mode,
      network: netCfg,
      onEvent: handleMatchEvent
    });

    await matchManager.init();
    ui.showGameHUD();

    ui.bindActionButtons({
      onPass: () => matchManager.handleAction('pass'),
      onThroughPass: () => matchManager.handleAction('through'),
      onShoot: () => matchManager.handleAction('shoot'),
      onTackle: () => matchManager.handleAction('tackle')
    });

    // Xbox kontrolcüsü: dokunmatik butonlarla aynı aksiyonları tetikler
    const gamepad = new GamepadInput({
      onPass: () => matchManager.handleAction('pass'),
      onThroughPass: () => matchManager.handleAction('through'),
      onShoot: () => matchManager.handleAction('shoot'),
      onTackle: () => matchManager.handleAction('tackle'),
      onSwitchPlayer: () => matchManager.switchPlayer()
    });

    // Klavyede Tab: aynı takımın sıradaki futbolcusuna geç.
    const onPlayerSwitchKey = (event) => {
      if (event.code === 'Tab' && !event.repeat) {
        event.preventDefault();
        matchManager.switchPlayer();
      }
    };
    window.addEventListener('keydown', onPlayerSwitchKey);

    engine.startRenderLoop((delta) => {
      gamepad.poll();
      // Kontrolcü çubuğu hareket ediyorsa o, aksi halde ekran joystick'i kullanılır
      const move = gamepad.isActive() ? gamepad.getMoveVector() : ui.getMoveVector();
      matchManager.setMoveInput(move.x, move.z);
      matchManager.setSprinting(ui.isSprinting() || gamepad.isSprinting());
      matchManager.update(delta);
    });
  }

  function handleMatchEvent(type, payload) {
    if (!ui) return;
    switch (type) {
      case 'goal':
        ui.showGoalToast(payload.scoringTeam, payload.scorerName);
        ui.updateScore(payload.score);
        break;
      case 'timeUpdate':
        ui.updateTimer(payload.timeLeft);
        ui.updateScore(payload.score);
        break;
      case 'matchEnd':
        ui.showEndOverlay(payload.result, payload.score);
        break;
      case 'opponentLeft':
        ui.showEndOverlay('draw', matchManager.score);
        document.getElementById('end-match-text').textContent = 'Rakip oyundan ayrıldı.';
        break;
    }
  }
});
