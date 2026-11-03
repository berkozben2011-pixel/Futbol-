export class PlayerEntity {
  constructor({ THREE, mesh, charData, team, isUser = false, formationPos, role = 'MF' }) {
    this.THREE = THREE;
    this.mesh = mesh;
    this.charData = charData;
    this.team = team; // 'home' | 'away'
    this.isUser = isUser;
    this.role = role; // 'GK' | 'DF' | 'MF' | 'FW'
    this.formationPos = { ...formationPos }; // Sahadaki referans (dinlenme) pozisyonu
    this.facing = new THREE.Vector3(0, 0, team === 'home' ? 1 : -1);
    this.baseSpeed = 4 + (charData.stats.speed / 100) * 4; // ~4 - 8 birim/sn
    this.mixer = null; // Modelin içine gömülü animasyon varsa THREE.AnimationMixer
    this.bones = {};
    this._animClock = 0;
    this._kickTimer = 0;
    this._celebration = null;
    this._lastAnimPosition = this.mesh.position.clone();
    this._isMoving = false;
    this.boneBaseRotations = {};
    this.mesh.traverse?.((node) => {
      if (node.isBone && node.name) {
        this.bones[node.name] = node;
        this.boneBaseRotations[node.name] = node.rotation.clone();
      }
    });
  }

  setFacing(dirVec3) {
    if (dirVec3.lengthSq() > 0.0001) {
      this.facing.copy(dirVec3).setY(0).normalize();
      const angle = Math.atan2(this.facing.x, this.facing.z);
      this.mesh.rotation.y = angle;
    }
  }

  getFacingDirection() {
    return this.facing.clone();
  }

  playKick() {
    this._kickTimer = 0.48;
  }

  startCelebration(variant = 0) {
    this._celebration = { variant, elapsed: 0, duration: 5.5 };
    this._kickTimer = 0;
  }

  stopCelebration() {
    this._celebration = null;
    for (const [name, rotation] of Object.entries(this.boneBaseRotations)) {
      const bone = this.bones[name];
      if (bone) bone.rotation.copy(rotation);
    }
  }

  updateCelebrationAnimation(delta) {
    if (!this._celebration) return false;
    const c = this._celebration;
    c.elapsed += delta;
    const t = c.elapsed;
    const wave = Math.sin(t * 5.5);
    const pulse = Math.max(0, Math.sin(Math.min(1, t / 0.55) * Math.PI));
    const set = (name, axis, value) => {
      const bone = this.bones[name];
      if (bone) bone.rotation[axis] = value;
    };
    // Üç farklı gol sevinci: iki kol havada, kolları yana açma, tek yumruk.
    if (c.variant === 0) {
      set('LeftArm', 'z', 0.72 + wave * 0.10); set('RightArm', 'z', -0.72 - wave * 0.10);
      set('LeftArm', 'x', -0.25); set('RightArm', 'x', -0.25);
      set('Spine', 'x', -0.10 - pulse * 0.12);
      set('LeftUpLeg', 'x', Math.sin(t * 7) * 0.16); set('RightUpLeg', 'x', -Math.sin(t * 7) * 0.16);
    } else if (c.variant === 1) {
      set('LeftArm', 'z', 1.05 + wave * 0.08); set('RightArm', 'z', -1.05 - wave * 0.08);
      set('LeftArm', 'x', -0.10); set('RightArm', 'x', -0.10);
      set('Spine', 'x', Math.sin(t * 3) * 0.08);
      set('Hips', 'z', Math.sin(t * 4) * 0.06);
    } else {
      set('LeftArm', 'z', 0.18); set('RightArm', 'z', -0.95 - Math.max(0, wave) * 0.18);
      set('RightForeArm', 'x', -0.85); set('LeftForeArm', 'x', 0.12);
      set('Spine', 'x', -0.16);
      set('RightUpLeg', 'x', -0.18 + Math.max(0, wave) * 0.16);
    }
    return true;
  }

  updateProceduralAnimation(delta, hasBall = false, sprinting = false) {
    if (this.updateCelebrationAnimation(delta)) return;
    this._animClock += delta;
    const dx = this.mesh.position.x - this._lastAnimPosition.x;
    const dz = this.mesh.position.z - this._lastAnimPosition.z;
    const speed = Math.sqrt(dx * dx + dz * dz) / Math.max(delta, 0.0001);
    this._isMoving = speed > 0.12;
    this._lastAnimPosition.copy(this.mesh.position);

    const moving = this._isMoving;
    const frequency = sprinting ? 12 : 8;
    const stride = moving ? (sprinting ? 0.72 : 0.48) : 0.035;
    const phase = this._animClock * frequency;
    const left = Math.sin(phase) * stride;
    const right = Math.sin(phase + Math.PI) * stride;

    const setX = (name, value) => {
      const bone = this.bones[name];
      if (bone) bone.rotation.x = value;
    };
    const setZ = (name, value) => {
      const bone = this.bones[name];
      if (bone) bone.rotation.z = value;
    };

    // Berk.glb is the reference skeleton; the same bone names are shared by
    // the other rigged player GLBs.
    setX('LeftUpLeg', left);
    setX('RightUpLeg', right);
    setX('LeftLeg', Math.max(0, -left) * 0.75);
    setX('RightLeg', Math.max(0, -right) * 0.75);
    setX('LeftFoot', -Math.max(0, left) * 0.25);
    setX('RightFoot', -Math.max(0, right) * 0.25);
    setX('LeftArm', -right * 0.65);
    setX('RightArm', -left * 0.65);
    setX('LeftForeArm', moving ? 0.18 : 0.08);
    setX('RightForeArm', moving ? 0.18 : 0.08);
    setX('Spine', moving ? -0.06 : Math.sin(this._animClock * 2) * 0.012);
    setX('Spine1', moving ? -0.035 : 0);
    setZ('Hips', moving ? Math.sin(phase) * 0.025 : 0);

    if (this._kickTimer > 0) {
      this._kickTimer = Math.max(0, this._kickTimer - delta);
      const t = 1 - this._kickTimer / 0.48;
      const swing = Math.sin(Math.min(1, t) * Math.PI);
      setX('RightUpLeg', -0.25 + swing * 1.25);
      setX('RightLeg', swing * 0.55);
      setX('LeftUpLeg', 0.18);
      setX('LeftArm', -0.45);
      setX('RightArm', 0.55);
      setX('Spine', -0.12);
    }
  }

  get position() {
    return this.mesh.position;
  }
}
