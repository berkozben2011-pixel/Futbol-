import { PITCH } from '../core/GameEngine.js';

export class Ball {
  constructor(scene, THREE) {
    this.THREE = THREE;
    const geo = new THREE.SphereGeometry(0.35, 16, 16);
    const mat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.4 });
    this.mesh = new THREE.Mesh(geo, mat);
    this.mesh.castShadow = true;
    this.mesh.position.set(0, 0.35, 0);
    scene.add(this.mesh);

    this.velocity = new THREE.Vector3();
    this.friction = 0.985;
    this.owner = null; // Topu kontrol eden PlayerEntity (varsa)
    this.lastKicker = null; // Topu en son vuran PlayerEntity (gol sevinci için kullanılır)
  }

  reset(position = { x: 0, z: 0 }) {
    this.owner = null;
    this.lastKicker = null;
    this.velocity.set(0, 0, 0);
    this.mesh.position.set(position.x, 0.35, position.z);
  }

  kick(direction, power, kicker = null) {
    this.owner = null;
    if (kicker) this.lastKicker = kicker;
    const dir = direction.clone();
    dir.y = 0;
    if (dir.lengthSq() < 0.0001) dir.set(0, 0, 1);
    dir.normalize();
    this.velocity.copy(dir.multiplyScalar(power));
  }

  update(delta) {
    if (this.owner) {
      const dir = this.owner.getFacingDirection();
      const targetPos = this.owner.mesh.position.clone().addScaledVector(dir, 0.9);
      targetPos.y = 0.35;
      this.mesh.position.lerp(targetPos, 0.35);
      this.velocity.set(0, 0, 0);
      return;
    }

    this.mesh.position.addScaledVector(this.velocity, delta);
    this.velocity.multiplyScalar(this.friction);
    if (this.velocity.length() < 0.02) this.velocity.set(0, 0, 0);

    // Yan çizgi sekmesi (kale çizgisi hariç - gol kontrolü MatchManager'da yapılıyor)
    if (this.mesh.position.x < PITCH.minX || this.mesh.position.x > PITCH.maxX) {
      this.velocity.x *= -0.6;
      this.mesh.position.x = Math.max(PITCH.minX, Math.min(PITCH.maxX, this.mesh.position.x));
    }

    this.mesh.position.y = 0.35;
  }
}
