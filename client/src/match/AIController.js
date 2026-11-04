import { PITCH } from '../core/GameEngine.js';

// Basit ama işlevsel bir yapay zeka: her takımdan topa en yakın oyuncu topu
// kovalar, diğerleri formasyon pozisyonlarına yakın kalıp topa doğru hafifçe
// kayar. Topa sahip olan AI, rakip kaleye doğru ilerler ve yeterince
// yaklaşınca şut çeker.
export class AIController {
  constructor(THREE) {
    this.THREE = THREE;
  }

  update(delta, { players, ball }) {
    const homeChaser = this.findChaser(players, ball, 'home');
    const awayChaser = this.findChaser(players, ball, 'away');

    for (const player of players) {
      // İnsan oyuncuların yerel karakteri ve ağ üzerinden kontrol edilen rakipleri AI yönetmemeli.
      if (player.isUser || player.isRemote) continue;

      const isChaser = player === homeChaser || player === awayChaser;
      const attackGoalZ = player.team === 'home' ? PITCH.maxZ : PITCH.minZ;

      if (player.role === 'GK') {
        this.updateGoalkeeper(player, ball, delta);
        continue;
      }

      if (ball.owner === player) {
        this.driveWithBall(player, ball, attackGoalZ, delta);
      } else if (isChaser && !ball.owner) {
        this.moveToward(player, ball.mesh.position, delta, 1.0);
        this.tryPickUpBall(player, ball);
      } else {
        // Formasyona dön, hafifçe topa doğru kay
        const target = {
          x: player.formationPos.x + (ball.mesh.position.x - player.formationPos.x) * 0.15,
          z: player.formationPos.z + (ball.mesh.position.z - player.formationPos.z) * 0.1
        };
        this.moveToward(player, target, delta, 0.6);
      }

      // Rakip topa sahipse ve yakınsa müdahale şansı dene
      if (ball.owner && ball.owner.team !== player.team) {
        const dist = player.mesh.position.distanceTo(ball.owner.mesh.position);
        if (dist < 1.3 && Math.random() < 0.02) {
          ball.owner = player;
        }
      }
    }
  }

  findChaser(players, ball, team) {
    let best = null;
    let bestDist = Infinity;
    for (const p of players) {
      if (p.team !== team || p.role === 'GK') continue;
      const d = p.mesh.position.distanceTo(ball.mesh.position);
      if (d < bestDist) {
        bestDist = d;
        best = p;
      }
    }
    return best;
  }

  moveToward(player, targetPos, delta, speedMul = 1) {
    const THREE = this.THREE;
    const dir = new THREE.Vector3(targetPos.x - player.mesh.position.x, 0, targetPos.z - player.mesh.position.z);
    const dist = dir.length();
    if (dist < 0.2) return;
    dir.normalize();
    const speed = player.baseSpeed * speedMul;
    player.mesh.position.addScaledVector(dir, speed * delta);
    player.setFacing(dir);
  }

  tryPickUpBall(player, ball) {
    const dist = player.mesh.position.distanceTo(ball.mesh.position);
    if (dist < 0.9 && !ball.owner) {
      ball.owner = player;
    }
  }

  driveWithBall(player, ball, attackGoalZ, delta) {
    const THREE = this.THREE;
    const goalTarget = new THREE.Vector3(0, 0, attackGoalZ);
    const distToGoal = player.mesh.position.distanceTo(goalTarget);

    if (distToGoal < 18) {
      // Şut menzilinde: kaleye doğru vur
      const power = 14 + (player.charData.stats.shootPower / 100) * 12;
      const inaccuracy = (100 - player.charData.stats.shootAccuracy) / 100;
      const aim = goalTarget.clone();
      aim.x += (Math.random() - 0.5) * inaccuracy * 8;
      const dir = aim.clone().sub(player.mesh.position);
      ball.kick(dir, power, player);
      return;
    }

    this.moveToward(player, { x: goalTarget.x * 0.3, z: attackGoalZ }, delta, 0.9);
  }

  updateGoalkeeper(player, ball, delta) {
    const THREE = this.THREE;
    const ownGoalZ = player.formationPos.z;
    const targetX = Math.max(PITCH.minX * 0.35, Math.min(PITCH.maxX * 0.35, ball.mesh.position.x * 0.5));
    const target = { x: targetX, z: ownGoalZ };
    this.moveToward(player, target, delta, 0.8);

    // Top çok yakınsa ve sahipsizse topu al
    if (!ball.owner) {
      const dist = player.mesh.position.distanceTo(ball.mesh.position);
      if (dist < 1.0) {
        ball.owner = player;
      }
    } else if (ball.owner === player) {
      // Kaleci topu hemen bir savunmacıya ya da ileri atar
      const dir = new THREE.Vector3(0, 0, player.team === 'home' ? 1 : -1);
      ball.kick(dir, 10, player);
    }
  }
}
