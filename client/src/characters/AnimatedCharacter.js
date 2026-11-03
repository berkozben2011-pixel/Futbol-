import * as THREE from 'three';

/**
 * Procedural Animated Character
 *
 * Basit geometrik parçalardan (head, torso, upperLeg, lowerLeg, foot, arm)
 * oluşan bir karakter oluşturur ve kod tabanlı animasyonları (koşma, dribbling, şut)
 * AnimationMixer + KeyframeTrack ile oynatır.
 *
 * Mevcut CharacterManager.loadCharacterModel() ile uyumlu olacak şekilde
 * { scene: Group, animations: AnimationClip[] } döndürür.
 */

// Animasyon süreleri (saniye)
const ANIM_DURATIONS = {
  idle: 2.0,
  run: 0.8,
  dribble: 0.6,
  shoot: 1.0,
  shootFollowThrough: 0.5,
};

// Yardımcı: Bir parça için rotation keyframe oluştur
function createRotationTrack(nodeName, times, values) {
  return new THREE.KeyframeTrack(
    `${nodeName}.rotation[z]`, // Z ekseni etrafında döndürme (sagittal plane)
    times,
    values
  );
}

function createRotationTrackX(nodeName, times, values) {
  return new THREE.KeyframeTrack(
    `${nodeName}.rotation[x]`,
    times,
    values
  );
}

function createPositionTrack(nodeName, times, values) {
  return new THREE.KeyframeTrack(
    `${nodeName}.position[y]`, // Yükseklik (bobbing)
    times,
    values
  );
}

/**
 * Basit humanoid karakter hiyerarşisi oluşturur:
 * root
 *   hips
 *     spine
 *       chest
 *         head
 *         leftArm / rightArm
 *       leftUpperLeg -> leftLowerLeg -> leftFoot
 *       rightUpperLeg -> rightLowerLeg -> rightFoot
 */
export function createProceduralCharacter(THREE, options = {}) {
  const {
    height = 1.8,
    bodyColor = 0x2196f3,
    accentColor = 0xffffff,
    team = 'home'
  } = options;

  const group = new THREE.Group();
  group.name = 'ProceduralCharacter';

  // Malzemeler
  const bodyMat = new THREE.MeshStandardMaterial({
    color: bodyColor,
    roughness: 0.7,
    metalness: 0.1
  });
  const accentMat = new THREE.MeshStandardMaterial({
    color: accentColor,
    roughness: 0.5,
    metalness: 0.2
  });
  const skinMat = new THREE.MeshStandardMaterial({
    color: 0xffdbac,
    roughness: 0.8,
    metalness: 0.0
  });

  // Ölçekler (boy 1.8 metre baz alındı)
  const s = height / 1.8;
  const dimensions = {
    head: { r: 0.12 * s, h: 0.14 * s },
    neck: { r: 0.06 * s, h: 0.08 * s },
    torso: { w: 0.35 * s, h: 0.5 * s, d: 0.2 * s },
    pelvis: { w: 0.3 * s, h: 0.18 * s, d: 0.18 * s },
    upperArm: { r: 0.05 * s, h: 0.25 * s },
    lowerArm: { r: 0.045 * s, h: 0.22 * s },
    hand: { r: 0.05 * s },
    upperLeg: { r: 0.07 * s, h: 0.35 * s },
    lowerLeg: { r: 0.06 * s, h: 0.35 * s },
    foot: { w: 0.1 * s, h: 0.05 * s, d: 0.2 * s },
  };

  // --- Hiyerarşi oluştur ---
  const parts = {};

  // Root (hips level)
  parts.root = new THREE.Group();
  parts.root.name = 'root';
  group.add(parts.root);

  // Pelvis
  parts.pelvis = new THREE.Mesh(
    new THREE.BoxGeometry(dimensions.pelvis.w, dimensions.pelvis.h, dimensions.pelvis.d),
    bodyMat
  );
  parts.pelvis.name = 'pelvis';
  parts.pelvis.position.y = height * 0.5; // hips height ~0.9
  parts.pelvis.castShadow = true;
  parts.root.add(parts.pelvis);

  // Spine (torso)
  parts.spine = new THREE.Group();
  parts.spine.name = 'spine';
  parts.spine.position.y = dimensions.pelvis.h / 2 + dimensions.torso.h / 2;
  parts.pelvis.add(parts.spine);

  parts.torso = new THREE.Mesh(
    new THREE.BoxGeometry(dimensions.torso.w, dimensions.torso.h, dimensions.torso.d),
    bodyMat
  );
  parts.torso.name = 'torso';
  parts.torso.position.y = 0;
  parts.torso.castShadow = true;
  parts.spine.add(parts.torso);

  // Chest (omuz seviyesi)
  parts.chest = new THREE.Group();
  parts.chest.name = 'chest';
  parts.chest.position.y = dimensions.torso.h / 2;
  parts.spine.add(parts.chest);

  // Head
  parts.neck = new THREE.Mesh(
    new THREE.CylinderGeometry(dimensions.neck.r, dimensions.neck.r, dimensions.neck.h, 8),
    skinMat
  );
  parts.neck.name = 'neck';
  parts.neck.position.y = dimensions.neck.h / 2;
  parts.chest.add(parts.neck);

  parts.head = new THREE.Mesh(
    new THREE.SphereGeometry(dimensions.head.r, 12, 10),
    skinMat
  );
  parts.head.name = 'head';
  parts.head.position.y = dimensions.neck.h + dimensions.head.r;
  parts.head.castShadow = true;
  parts.chest.add(parts.head);

  // Arms
  const createArm = (side) => {
    const sign = side === 'left' ? 1 : -1;
    const shoulder = new THREE.Group();
    shoulder.name = `${side}Shoulder`;
    shoulder.position.set(sign * (dimensions.torso.w / 2 + dimensions.upperArm.r), 0, 0);
    parts.chest.add(shoulder);

    const upperArm = new THREE.Mesh(
      new THREE.CylinderGeometry(dimensions.upperArm.r, dimensions.upperArm.r * 0.8, dimensions.upperArm.h, 8),
      bodyMat
    );
    upperArm.name = `${side}UpperArm`;
    upperArm.position.y = -dimensions.upperArm.h / 2;
    upperArm.castShadow = true;
    shoulder.add(upperArm);

    const elbow = new THREE.Group();
    elbow.name = `${side}Elbow`;
    elbow.position.y = -dimensions.upperArm.h;
    upperArm.add(elbow);

    const lowerArm = new THREE.Mesh(
      new THREE.CylinderGeometry(dimensions.lowerArm.r, dimensions.lowerArm.r * 0.7, dimensions.lowerArm.h, 8),
      skinMat
    );
    lowerArm.name = `${side}LowerArm`;
    lowerArm.position.y = -dimensions.lowerArm.h / 2;
    lowerArm.castShadow = true;
    elbow.add(lowerArm);

    const wrist = new THREE.Group();
    wrist.name = `${side}Wrist`;
    wrist.position.y = -dimensions.lowerArm.h;
    lowerArm.add(wrist);

    const hand = new THREE.Mesh(
      new THREE.SphereGeometry(dimensions.hand.r, 8, 6),
      skinMat
    );
    hand.name = `${side}Hand`;
    hand.castShadow = true;
    wrist.add(hand);

    return { shoulder, upperArm, elbow, lowerArm, wrist, hand };
  };

  parts.leftArm = createArm('left');
  parts.rightArm = createArm('right');

  // Legs
  const createLeg = (side) => {
    const sign = side === 'left' ? 1 : -1;
    const hip = new THREE.Group();
    hip.name = `${side}Hip`;
    hip.position.set(sign * dimensions.pelvis.w * 0.35, -dimensions.pelvis.h / 2, 0);
    parts.pelvis.add(hip);

    const upperLeg = new THREE.Mesh(
      new THREE.CylinderGeometry(dimensions.upperLeg.r, dimensions.upperLeg.r * 0.85, dimensions.upperLeg.h, 8),
      bodyMat
    );
    upperLeg.name = `${side}UpperLeg`;
    upperLeg.position.y = -dimensions.upperLeg.h / 2;
    upperLeg.castShadow = true;
    hip.add(upperLeg);

    const knee = new THREE.Group();
    knee.name = `${side}Knee`;
    knee.position.y = -dimensions.upperLeg.h;
    upperLeg.add(knee);

    const lowerLeg = new THREE.Mesh(
      new THREE.CylinderGeometry(dimensions.lowerLeg.r, dimensions.lowerLeg.r * 0.7, dimensions.lowerLeg.h, 8),
      skinMat
    );
    lowerLeg.name = `${side}LowerLeg`;
    lowerLeg.position.y = -dimensions.lowerLeg.h / 2;
    lowerLeg.castShadow = true;
    knee.add(lowerLeg);

    const ankle = new THREE.Group();
    ankle.name = `${side}Ankle`;
    ankle.position.y = -dimensions.lowerLeg.h;
    lowerLeg.add(ankle);

    const foot = new THREE.Mesh(
      new THREE.BoxGeometry(dimensions.foot.w, dimensions.foot.h, dimensions.foot.d),
      accentMat
    );
    foot.name = `${side}Foot`;
    foot.position.set(0, -dimensions.foot.h / 2, dimensions.foot.d / 2 - 0.02);
    foot.castShadow = true;
    ankle.add(foot);

    return { hip, upperLeg, knee, lowerLeg, ankle, foot };
  };

  parts.leftLeg = createLeg('left');
  parts.rightLeg = createLeg('right');

  // --- ANİMASYON KLİPLERİ OLUŞTUR ---

  const clips = {};

  // 1. IDLE - Nöbet bekleme hafif hareket
  clips.idle = createIdleClip(THREE, parts, ANIM_DURATIONS.idle);

  // 2. RUN - Koşma
  clips.run = createRunClip(THREE, parts, ANIM_DURATIONS.run);

  // 3. DRIBBLE - Top sürme (koşmaya benzer ama ayaklar topa yakın)
  clips.dribble = createDribbleClip(THREE, parts, ANIM_DURATIONS.dribble);

  // 4. SHOOT - Şut atma
  clips.shoot = createShootClip(THREE, parts, ANIM_DURATIONS.shoot);

  // 5. SHOOT FOLLOW THROUGH - Şut sonrası devam
  clips.shootFollowThrough = createShootFollowThroughClip(THREE, parts, ANIM_DURATIONS.shootFollowThrough);

  // Animasyonları group'a ekle (CharacterManager mixer için)
  group.animations = Object.values(clips);

  // Animasyon isimlerini sakla
  group.userData.animationNames = Object.keys(clips);

  return group;
}

// --- Animasyon Clip Oluşturma Fonksiyonları ---

function createIdleClip(THREE, parts, duration) {
  const tracks = [];
  const times = [0, duration / 2, duration];

  // Spine hafif yukarı-aşağı (solunum)
  tracks.push(createPositionTrack('spine', times, [0, 0.01, 0]));

  // Kollar hafif sallanma
  tracks.push(createRotationTrack('leftShoulder', times, [0, 0.05, 0]));
  tracks.push(createRotationTrack('rightShoulder', times, [0, -0.05, 0]));

  // Kafa hafif oynama
  tracks.push(createRotationTrack('neck', times, [0, 0.03, 0]));

  return new THREE.AnimationClip('idle', duration, tracks);
}

function createRunClip(THREE, parts, duration) {
  const tracks = [];
  // 0, 0.25, 0.5, 0.75, 1.0 (bir tam tur)
  const times = [0, duration * 0.25, duration * 0.5, duration * 0.75, duration];

  // --- Bacaklar (Z ekseninde rotation) ---
  // Sol bacak: 0 -> ileri (+) -> 0 -> geri (-) -> 0
  // Sağ bacak: 0 -> geri (-) -> 0 -> ileri (+) -> 0 (ters faz)
  const legAmplitude = 0.8; // ~45 derece
  const legTimes = times;

  tracks.push(createRotationTrack('leftHip', legTimes, [0, legAmplitude, 0, -legAmplitude, 0]));
  tracks.push(createRotationTrack('rightHip', legTimes, [0, -legAmplitude, 0, legAmplitude, 0]));

  // Dizler: bacak ileri giderken biraz bükülür, geri giderken açılır
  const kneeAmplitude = 0.6;
  tracks.push(createRotationTrack('leftKnee', legTimes, [0.1, kneeAmplitude, 0.1, 0, 0.1]));
  tracks.push(createRotationTrack('rightKnee', legTimes, [0.1, 0, 0.1, kneeAmplitude, 0.1]));

  // Ayaklar: yere basarken dik, havada biraz yukarı
  tracks.push(createRotationTrack('leftAnkle', legTimes, [-0.1, -0.3, -0.1, 0.1, -0.1]));
  tracks.push(createRotationTrack('rightAnkle', legTimes, [-0.1, 0.1, -0.1, -0.3, -0.1]));

  // --- Kollar (bacakların zıtı) ---
  const armAmplitude = 0.6;
  tracks.push(createRotationTrack('leftShoulder', legTimes, [0, -armAmplitude, 0, armAmplitude, 0]));
  tracks.push(createRotationTrack('rightShoulder', legTimes, [0, armAmplitude, 0, -armAmplitude, 0]));

  // Dirsekler
  tracks.push(createRotationTrack('leftElbow', legTimes, [0.3, 0.8, 0.3, 0.2, 0.3]));
  tracks.push(createRotationTrack('rightElbow', legTimes, [0.3, 0.2, 0.3, 0.8, 0.3]));

  // --- Gövde (bobbing) ---
  tracks.push(createPositionTrack('spine', times, [0, 0.03, 0, 0.03, 0])); // Yukarı-aşağı
  tracks.push(createRotationTrackX('spine', times, [-0.05, -0.02, -0.05, -0.02, -0.05])); // Hafif ileri eğilme

  // Kafa
  tracks.push(createRotationTrack('neck', times, [0, 0.02, 0, -0.02, 0]));

  return new THREE.AnimationClip('run', duration, tracks);
}

function createDribbleClip(THREE, parts, duration) {
  // Dribbling: koşmaya benzer ama ayak hareketleri daha kısa, top kontrolü için
  const tracks = [];
  const times = [0, duration * 0.25, duration * 0.5, duration * 0.75, duration];

  // Bacaklar - daha küçük açı, daha hızlı
  const legAmplitude = 0.5;
  tracks.push(createRotationTrack('leftHip', times, [0, legAmplitude, 0, -legAmplitude, 0]));
  tracks.push(createRotationTrack('rightHip', times, [0, -legAmplitude, 0, legAmplitude, 0]));

  const kneeAmplitude = 0.4;
  tracks.push(createRotationTrack('leftKnee', times, [0.15, kneeAmplitude, 0.15, 0.05, 0.15]));
  tracks.push(createRotationTrack('rightKnee', times, [0.15, 0.05, 0.15, kneeAmplitude, 0.15]));

  tracks.push(createRotationTrack('leftAnkle', times, [-0.05, -0.2, -0.05, 0.15, -0.05]));
  tracks.push(createRotationTrack('rightAnkle', times, [-0.05, 0.15, -0.05, -0.2, -0.05]));

  // Kollar - dribbling'de kol hareketi daha az
  const armAmplitude = 0.3;
  tracks.push(createRotationTrack('leftShoulder', times, [0, -armAmplitude, 0, armAmplitude, 0]));
  tracks.push(createRotationTrack('rightShoulder', times, [0, armAmplitude, 0, -armAmplitude, 0]));

  // Gövde - daha dik duruş
  tracks.push(createPositionTrack('spine', times, [0, 0.015, 0, 0.015, 0]));
  tracks.push(createRotationTrackX('spine', times, [-0.02, -0.01, -0.02, -0.01, -0.02]));

  return new THREE.AnimationClip('dribble', duration, tracks);
}

function createShootClip(THREE, parts, duration) {
  // Şut: geri zıplama (backswing) -> ileri vuruş -> follow through
  // 0-0.4: backswing, 0.4-0.6: impact, 0.6-1.0: follow through
  const tracks = [];
  const times = [0, duration * 0.2, duration * 0.4, duration * 0.55, duration * 0.7, duration];

  // Vuruş bacağı (sağ bacak varsayalım - sağ ayak)
  // Backswing: bacak geriye
  // Impact: hızla ileri
  // Follow through: yüksek ileri
  const kickAmplitude = 1.5; // ~85 derece

  tracks.push(createRotationTrack('rightHip', times, [0, -0.5, -1.0, kickAmplitude, 1.2, 0.5]));
  tracks.push(createRotationTrack('leftHip', times, [0, 0.2, 0.3, 0.1, 0, 0])); // Denge bacağı

  // Dizler
  tracks.push(createRotationTrack('rightKnee', times, [0.1, 0.8, 1.2, 0.3, 0.1, 0.1]));
  tracks.push(createRotationTrack('leftKnee', times, [0.1, 0.3, 0.5, 0.4, 0.2, 0.1]));

  // Ayaklar - vuruş anında foot plant
  tracks.push(createRotationTrack('rightAnkle', times, [-0.1, -0.2, -0.3, -0.5, -0.2, -0.1]));
  tracks.push(createRotationTrack('leftAnkle', times, [-0.1, 0, 0.1, 0.2, 0.1, -0.1]));

  // Kollar - denge için açılır
  tracks.push(createRotationTrack('leftShoulder', times, [0, 0.5, 0.8, 0.6, 0.3, 0]));
  tracks.push(createRotationTrack('rightShoulder', times, [0, -0.3, -0.5, -0.8, -0.5, -0.2]));
  tracks.push(createRotationTrack('leftElbow', times, [0.3, 0.6, 0.8, 0.5, 0.3, 0.3]));
  tracks.push(createRotationTrack('rightElbow', times, [0.3, 0.4, 0.3, 0.2, 0.3, 0.3]));

  // Gövde - şut anında ileri eğilme
  tracks.push(createRotationTrackX('spine', times, [-0.05, -0.1, -0.15, -0.3, -0.2, -0.1]));
  tracks.push(createPositionTrack('spine', times, [0, -0.01, -0.02, -0.03, -0.02, -0.01]));

  return new THREE.AnimationClip('shoot', duration, tracks);
}

function createShootFollowThroughClip(THREE, parts, duration) {
  // Şut sonrası dengelenme
  const tracks = [];
  const times = [0, duration * 0.5, duration];

  tracks.push(createRotationTrack('rightHip', times, [0.5, 0.2, 0]));
  tracks.push(createRotationTrack('leftHip', times, [0, 0, 0]));
  tracks.push(createRotationTrack('rightKnee', times, [0.1, 0.1, 0.1]));
  tracks.push(createRotationTrack('leftKnee', times, [0.1, 0.1, 0.1]));
  tracks.push(createRotationTrackX('spine', times, [-0.1, -0.05, -0.05]));
  tracks.push(createPositionTrack('spine', times, [-0.01, -0.005, 0]));
  tracks.push(createRotationTrack('leftShoulder', times, [0.3, 0.1, 0]));
  tracks.push(createRotationTrack('rightShoulder', times, [-0.2, -0.1, 0]));

  return new THREE.AnimationClip('shootFollowThrough', duration, tracks);
}

/**
 * Mevcut CharacterManager ile uyumlu loader fonksiyonu
 * CharacterManager._loadModel() bunun sonucunu bekler: (mesh, mixer)
 */
export function createAnimatedCharacterModel(THREE, options = {}) {
  const character = createProceduralCharacter(THREE, options);

  // CharacterManager.normalizeModel() bekler - modeli normalize et
  // (zaten 1.8 boyunda oluşturduk ama yine de)
  character.updateMatrixWorld(true);
  const box = new THREE.Box3().setFromObject(character);
  const size = new THREE.Vector3();
  box.getSize(size);

  if (size.y > 0.0001) {
    const scaleFactor = 1.8 / size.y;
    character.scale.multiplyScalar(scaleFactor);
  }

  character.updateMatrixWorld(true);
  const box2 = new THREE.Box3().setFromObject(character);
  character.position.y -= box2.min.y;

  const center = new THREE.Vector3();
  box2.getCenter(center);
  character.position.x -= center.x;
  character.position.z -= center.z;

  // AnimationMixer oluştur
  const mixer = new THREE.AnimationMixer(character);

  // Varsayılan: idle oynat
  const idleAction = mixer.clipAction(character.animations.find(a => a.name === 'idle'));
  if (idleAction) idleAction.play();

  return { mesh: character, mixer };
}

export default { createProceduralCharacter, createAnimatedCharacterModel };