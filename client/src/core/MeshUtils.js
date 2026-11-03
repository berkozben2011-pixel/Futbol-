// Not: Projede kullanılan Three.js r128 sürümünde THREE.CapsuleGeometry bulunmuyor
// (bu geometri r142 ile eklendi). Bu yüzden karakter placeholder'ları için
// silindir gövde + iki küre kapak birleştirilerek "kapsül" görünümü elde ediyoruz.
export function createCapsuleMesh(THREE, radius = 0.4, cylinderHeight = 1.0, color = 0x3333ff) {
  const group = new THREE.Group();
  const material = new THREE.MeshStandardMaterial({ color });

  const bodyGeo = new THREE.CylinderGeometry(radius, radius, cylinderHeight, 12);
  const body = new THREE.Mesh(bodyGeo, material);
  body.castShadow = true;
  group.add(body);

  const topCapGeo = new THREE.SphereGeometry(radius, 12, 8, 0, Math.PI * 2, 0, Math.PI / 2);
  const topCap = new THREE.Mesh(topCapGeo, material);
  topCap.position.y = cylinderHeight / 2;
  topCap.castShadow = true;
  group.add(topCap);

  const bottomCapGeo = new THREE.SphereGeometry(radius, 12, 8, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2);
  const bottomCap = new THREE.Mesh(bottomCapGeo, material);
  bottomCap.position.y = -cylinderHeight / 2;
  bottomCap.castShadow = true;
  group.add(bottomCap);

  // Toplam yükseklik = cylinderHeight + 2*radius. Ayakları zeminde tutmak için
  // mesh'in pivot noktasını kapsülün alt ucuna göre kaydırıyoruz.
  group.userData.totalHeight = cylinderHeight + radius * 2;
  const offset = cylinderHeight / 2 + radius;
  group.children.forEach(child => child.position.y += offset);

  return group;
}
