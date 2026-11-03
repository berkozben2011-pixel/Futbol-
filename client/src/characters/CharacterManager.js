import { getCharacterData } from './CharacterData.js';
import { createCapsuleMesh } from '../core/MeshUtils.js';

const TARGET_HEIGHT = 1.8; // Placeholder kapsülle aynı yaklaşık boy (oyun dünyası birimi)
const CELEBRATION_PLACEHOLDER_COLOR = 0xffd700; // Model yoksa altın renk kapsül ile ayırt edilsin

export class CharacterManager {
  constructor(scene, THREE) {
    this.scene = scene;
    this.THREE = THREE;
    this.gltfLoader = (THREE.GLTFLoader) ? new THREE.GLTFLoader() : null;

    if (!this.gltfLoader) {
      console.warn(
        '[CharacterManager] THREE.GLTFLoader bulunamadı. index.html içindeki GLTFLoader ' +
        '<script> etiketinin doğru yüklendiğinden emin olun. Tüm karakterler placeholder olarak gösterilecek.'
      );
    }

    // Draco ile sıkıştırılmış GLB'leri açabilmek için DRACOLoader'ı GLTFLoader'a bağla.
    if (this.gltfLoader && THREE.DRACOLoader) {
      const dracoLoader = new THREE.DRACOLoader();
      dracoLoader.setDecoderPath('https://cdn.jsdelivr.net/npm/three@0.128.0/examples/js/libs/draco/');
      this.gltfLoader.setDRACOLoader(dracoLoader);
    } else if (this.gltfLoader) {
      console.warn(
        '[CharacterManager] THREE.DRACOLoader bulunamadı. Modelleriniz Draco ile ' +
        'sıkıştırılmışsa index.html içine DRACOLoader <script> etiketini eklemeniz gerekir.'
      );
    }
  }

  /**
   * Normal saha karakterini yükler (koşma/dribbling sırasında görünen model).
   * onLoad(mesh, charData, mixer) şeklinde çağrılır. mixer, modelin içine gömülü
   * bir animasyon varsa THREE.AnimationMixer örneğidir (yoksa null).
   */
  loadCharacterModel(characterId, onLoad) {
    const charData = getCharacterData(characterId);
    this._loadModel(charData.modelPath, charData.color, `"${charData.name}" (normal)`, (mesh, mixer) => {
      onLoad(mesh, charData, mixer);
    });
  }

  /**
   * Gol sevinç modelini yükler (örn. berkgoal.glb). Dosya yoksa/yüklenemezse
   * altın renkli bir kapsül placeholder ile devam eder, böylece özellik model
   * eksik olsa bile çalışır durumda kalır.
   */
  loadCelebrationModel(characterId, onLoad) {
    const charData = getCharacterData(characterId);
    this._loadModel(charData.celebrationModelPath, CELEBRATION_PLACEHOLDER_COLOR, `"${charData.name}" (gol sevinci)`, (mesh, mixer) => {
      onLoad(mesh, charData, mixer);
    });
  }

  _loadModel(modelPath, placeholderColor, debugLabel, onLoad) {
    const usePlaceholder = (reason) => {
      if (reason) {
        console.warn(`[CharacterManager] ${debugLabel} -> "${modelPath}" yüklenemedi, placeholder kullanılıyor. Sebep:`, reason);
      }
      const placeholder = createCapsuleMesh(this.THREE, 0.4, 1.0, placeholderColor);
      onLoad(placeholder, null);
    };

    if (!this.gltfLoader) {
      usePlaceholder();
      return;
    }

    this.gltfLoader.load(
      modelPath,
      (gltf) => {
        try {
          const model = gltf.scene || (gltf.scenes && gltf.scenes[0]);
          if (!model) {
            usePlaceholder('GLTF içinde sahne (scene) bulunamadı.');
            return;
          }

          model.traverse((node) => {
            if (node.isMesh) {
              node.castShadow = true;
              node.receiveShadow = true;
            }
          });

          // Modeli bir Group içine sarıyoruz: normalize sırasında yapılan ölçek/offset
          // düzeltmeleri bu iç child üzerinde kalır; dışarıdaki kod group'un
          // pozisyonunu (formasyon konumu) serbestçe set edebilir.
          const wrapper = new this.THREE.Group();
          wrapper.add(model);
          this.normalizeModel(model);

          let mixer = null;
          if (gltf.animations && gltf.animations.length > 0) {
            mixer = new this.THREE.AnimationMixer(model);
            const action = mixer.clipAction(gltf.animations[0]);
            action.play();
          }

          console.log(`[CharacterManager] ${debugLabel} modeli başarıyla yüklendi: ${modelPath}${mixer ? ' (animasyonlu)' : ''}`);
          onLoad(wrapper, mixer);
        } catch (err) {
          usePlaceholder(err);
        }
      },
      undefined,
      (err) => {
        // En sık nedenler: (1) index.html'in file:// ile açılması (CORS engeli) ->
        // mutlaka bir HTTP sunucusu üzerinden açın. (2) Dosya adı/klasör yolu
        // birebir eşleşmiyor (büyük/küçük harf duyarlı). (3) Draco sıkıştırmalıysa
        // DRACOLoader script'inin eklenmemiş olması.
        usePlaceholder(err);
      }
    );
  }

  /**
   * Farklı kaynaklardan gelen GLB modelleri, orijinal ölçek/orijin ne olursa olsun
   * oyun dünyasında tutarlı boyda ve ayakları yerde görünecek şekilde normalize eder.
   */
  normalizeModel(model) {
    const THREE = this.THREE;
    model.updateMatrixWorld(true);
    const box = new THREE.Box3().setFromObject(model);
    const size = new THREE.Vector3();
    box.getSize(size);

    if (size.y > 0.0001) {
      const scaleFactor = TARGET_HEIGHT / size.y;
      model.scale.multiplyScalar(scaleFactor);
    }

    model.updateMatrixWorld(true);
    const box2 = new THREE.Box3().setFromObject(model);
    model.position.y -= box2.min.y;

    const center = new THREE.Vector3();
    box2.getCenter(center);
    model.position.x -= center.x;
    model.position.z -= center.z;
  }
}
