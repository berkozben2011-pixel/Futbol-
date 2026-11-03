export const PITCH = {
  width: 60,   // X ekseni
  length: 90,  // Z ekseni
  get minX() { return -this.width / 2; },
  get maxX() { return this.width / 2; },
  get minZ() { return -this.length / 2; },
  get maxZ() { return this.length / 2; },
  goalWidth: 12,
  goalHeight: 3
};

export class GameEngine {
  constructor() {
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x2e7d32); // Çim yeşili
    this.scene.fog = new THREE.Fog(0x2e7d32, 60, 140);

    this.camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.1, 1000);
    this.renderer = new THREE.WebGLRenderer({ antialias: true });
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.shadowMap.enabled = true;
    document.body.appendChild(this.renderer.domElement);

    window.addEventListener('resize', () => this.onResize());

    this.setupLighting();
    this.setupPitch();
    this.setupGoals();
  }

  onResize() {
    this.camera.aspect = window.innerWidth / window.innerHeight;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(window.innerWidth, window.innerHeight);
  }

  setupLighting() {
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
    this.scene.add(ambientLight);

    const dirLight = new THREE.DirectionalLight(0xffffff, 0.8);
    dirLight.position.set(20, 40, 20);
    dirLight.castShadow = true;
    dirLight.shadow.camera.left = -40;
    dirLight.shadow.camera.right = 40;
    dirLight.shadow.camera.top = 50;
    dirLight.shadow.camera.bottom = -50;
    this.scene.add(dirLight);
  }

  setupPitch() {
    // Saha Zemini
    const pitchGeo = new THREE.PlaneGeometry(PITCH.width, PITCH.length);
    const pitchMat = new THREE.MeshStandardMaterial({ color: 0x388e3c });
    const pitch = new THREE.Mesh(pitchGeo, pitchMat);
    pitch.rotation.x = -Math.PI / 2;
    pitch.receiveShadow = true;
    this.scene.add(pitch);

    // Saha çizgileri (basit dış hat + orta saha çizgisi)
    const lineMat = new THREE.LineBasicMaterial({ color: 0xffffff });
    const outline = new THREE.LineLoop(
      new THREE.BufferGeometry().setFromPoints([
        new THREE.Vector3(PITCH.minX, 0.02, PITCH.minZ),
        new THREE.Vector3(PITCH.maxX, 0.02, PITCH.minZ),
        new THREE.Vector3(PITCH.maxX, 0.02, PITCH.maxZ),
        new THREE.Vector3(PITCH.minX, 0.02, PITCH.maxZ)
      ]),
      lineMat
    );
    this.scene.add(outline);

    const midLine = new THREE.Line(
      new THREE.BufferGeometry().setFromPoints([
        new THREE.Vector3(PITCH.minX, 0.02, 0),
        new THREE.Vector3(PITCH.maxX, 0.02, 0)
      ]),
      lineMat
    );
    this.scene.add(midLine);

    const midCircle = new THREE.LineLoop(new THREE.RingGeometry(9.9, 10, 32), lineMat);
    midCircle.rotation.x = -Math.PI / 2;
    midCircle.position.y = 0.02;
    this.scene.add(midCircle);
  }

  setupGoals() {
    this.goals = { home: this.createGoalMesh(PITCH.minZ), away: this.createGoalMesh(PITCH.maxZ) };
  }

  createGoalMesh(z) {
    const group = new THREE.Group();
    const postMat = new THREE.MeshStandardMaterial({ color: 0xffffff });
    const halfW = PITCH.goalWidth / 2;
    const h = PITCH.goalHeight;

    const postGeo = new THREE.CylinderGeometry(0.15, 0.15, h, 8);
    const leftPost = new THREE.Mesh(postGeo, postMat);
    leftPost.position.set(-halfW, h / 2, 0);
    const rightPost = new THREE.Mesh(postGeo, postMat);
    rightPost.position.set(halfW, h / 2, 0);

    const crossGeo = new THREE.CylinderGeometry(0.15, 0.15, PITCH.goalWidth, 8);
    const crossbar = new THREE.Mesh(crossGeo, postMat);
    crossbar.rotation.z = Math.PI / 2;
    crossbar.position.set(0, h, 0);

    group.add(leftPost, rightPost, crossbar);
    group.position.set(0, 0, z);
    this.scene.add(group);
    return group;
  }

  startRenderLoop(updateCallback) {
    const clock = new THREE.Clock();
    const animate = () => {
      requestAnimationFrame(animate);
      const delta = Math.min(clock.getDelta(), 0.05); // Sekme/lag durumunda dev delta'ları sınırla
      if (updateCallback) updateCallback(delta);
      this.renderer.render(this.scene, this.camera);
    };
    animate();
  }
}
