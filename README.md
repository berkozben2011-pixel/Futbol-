# ⚽ Mobil 5v5 Futbol Oyunu

Node.js + Socket.IO sunucu, Three.js istemci ile modüler, veri tabanlı bir mobil futbol oyunu prototipi.

## Kurulum

### 1. Sunucu
```
cd server
npm install
node server.js
```
Sunucu `http://localhost:3000` adresinde çalışır. Yalnızca **Online Oda** modu için gereklidir; "Hızlı Maç" ve "Antrenman" tamamen yerel (offline) çalışır.

### 2. İstemci
```
cd client
npx http-server -c-1 -p 8080
```
Tarayıcıdan `http://localhost:8080` adresine git. Mobil cihazda test etmek için bilgisayarınla aynı ağdaki telefondan `http://<bilgisayar-ip>:8080` adresine gidebilirsin.

> Online modu farklı bir cihazdan test ediyorsan `client/src/main.js` içindeki `SERVER_URL` sabitini sunucunun gerçek adresiyle güncelle (`http://localhost:3000` yerine).

## Tamamlanan Eksik Parçalar

Orijinal dokümanda iskelet olarak bırakılmış ya da eksik olan şu kısımlar tamamlandı:

- **Sanal joystick + hareket kontrolü** (`ui/Joystick.js`, `ui/UIManager.js`) — dokunmatik ve fare desteğiyle.
- **Top fiziği** (`match/Ball.js`) — sürtünme, sekme, dripling (topun oyuncuyu takip etmesi), şut/pas vektörleri.
- **PAS / ARA PAS / ŞUT / MÜDAHALE aksiyonları** (`match/MatchManager.js`) — karakter istatistiklerine (pas, şut gücü, şut isabeti) bağlı güç/isabet hesabı.
- **Yapay zeka** (`match/AIController.js`) — takım arkadaşları ve rakipler topu kovalar, formasyonunu korur, kaleciler kale çizgisinde kalır, topa sahipken rakip kaleye sürer ve şut çeker.
- **Gol tespiti, skor tablosu ve 5 dakikalık maç süresi** (`match/MatchManager.js`, `ui/UIManager.js`) — gol sonrası kickoff'a sıfırlama, maç sonu ekranı (kazandın / kaybettin / berabere).
- **Online Oda akışı uçtan uca**: oda kurma/katılma, "Hazırım" onayı, host-otoriter senkronizasyon (host simülasyonu çalıştırır, karşı tarafın joystick/aksiyon girdisini uygular ve durumu ~20Hz yayınlar; misafir tarafı bu durumu yumuşatarak render eder). Bu, gerçek zamanlı iki taraflı fizik senkronizasyonundaki tutarsızlık (desync) riskini ortadan kaldıran basit ama sağlam bir mimari.
- **Kritik bir uyumluluk hatası düzeltildi**: orijinal kod `THREE.CapsuleGeometry` kullanıyordu ama projede CDN üzerinden yüklenen Three.js r128 sürümünde bu geometri yok (r142 ile eklendi). Yerine silindir+küre birleşiminden oluşan bir kapsül placeholder (`core/MeshUtils.js`) yazıldı.
- **GLB model yükleme + fallback + Draco desteği**: `CharacterManager.js` artık gerçekten `GLTFLoader` (+ `DRACOLoader`) ile `assets/models/characters/*.glb` dosyalarını yüklemeyi dener; dosya yoksa/yüklenemezse otomatik olarak renkli kapsül placeholder'a düşer ve konsola (F12) sebebini yazar.
- **Karakter seçim ekranı**: Maç başlamadan önce, her karakterin istatistiklerini gösteren kartlı bir seçim ekranı çıkar. Kontrol edilecek karakter buradan seçilir.
- **Gol sevinci sistemi**: Bir oyuncu (kullanıcı ya da yapay zeka fark etmez) gol attığında:
  - Kamera 6 saniyeliğine o oyuncuyu **önden** gösterecek şekilde kesilir (karakterin baktığı yönde konumlanıp geri döner).
  - Karakterin normal modeli gizlenir, yerine o karaktere özel **gol sevinç modeli** (`<id>goal.glb`, örn. `berkgoal.glb`) sahneye eklenir. Model GLB içinde bir animasyon klibi içeriyorsa otomatik oynatılır; model yoksa altın renkli bir placeholder ile devam eder.
  - Ekranda "GOOOL! (EV/DEPLASMAN)" ve golü atan karakterin ismi 6 saniye boyunca gösterilir.
  - Online modda da çalışır: host bu bilgiyi (`celebratingIndex`) periyodik state yayınına ekler, misafir tarafı da aynı kamerayı/modeli kendi ekranında oynatır.
  - Golün, topu en son vuran (ve doğru takımdan olan) oyuncuya atfedilmesiyle çalışır; garip senaryolarda (örn. kendi kalesine gol) kişiselleştirilmiş sevinç atlanır, genel "GOOOL" yazısı yine gösterilir.
- Basit saha çizgileri, kaleler, gölge/ışıklandırma ve maç sonu / gol bildirimi arayüzleri eklendi.

## Karakterler ve Modeller

Güncel kadro (`client/src/characters/CharacterData.js` içinde tanımlı): **Berk, Erdoğan, Koray, Yankı, Eren Arda**. Yeni bir karakter eklemek için bu dosyaya yeni bir obje eklemen yeterli — maç kurulumu (`MatchManager.js`), karakter seçim ekranı (`main.js`) ve takım dizilişleri karakter listesini **dinamik olarak** okur, ekstra kod değişikliği gerekmez.

Her karakter için iki ayrı model dosyası beklenir, ikisi de `client/assets/models/characters/` klasörüne konur:
- **Normal saha modeli**: `<id>.glb` (örn. `berk.glb`)
- **Gol sevinç modeli**: `<id>goal.glb` (örn. `berkgoal.glb`)

Herhangi biri eksikse sistem otomatik olarak placeholder kapsülle devam eder (normal model için karaktere özel renk, sevinç modeli için altın renk) — yani modelleri teker teker eklesen de oyun her zaman çalışır durumda kalır.

## Kontroller

- **Sol joystick**: hareket
- **PAS**: en yakın takım arkadaşına düz pas
- **ARA PAS**: ileri bölgeye (rakip kaleye doğru) güçlü pas
- **ŞUT**: rakip kaleye şut (karakterin şut gücü/isabetine göre)
- **MÜDAHALE**: rakip topa sahipse ve yakınsan topu kapma denemesi
- **SPRINT**: basılı tutunca hareket hızı artar

## Bilinen Sınırlamalar / Sonraki Adımlar

- Online modda sadece 1v1 (her taraftan bir insan oyuncu; diğer 4 pozisyon her iki tarafta da yapay zeka tarafından kontrol edilir).
- Stamina (dayanıklılık) istatistiği şu an sprint hızını etkilemiyor; ileride sprint sırasında zamanla tükenen bir enerji barı eklenebilir.
- Karakter seçim ekranı yok; kullanıcı şu an sabit olarak "Berk" ile oynuyor. `CharacterData.js` üzerinden dörtten fazla karakter tanımlamak zaten mümkün; bir seçim menüsü eklemek kolay bir sonraki adım.
- Gerçek `.glb` modelleri eklenmedi (elimde yoktu); sistem bunlar olmadan placeholder kapsüllerle sorunsuz çalışıyor, `assets/models/characters/` klasörüne dosyaları bıraktığında otomatik devreye girecek.

## Xbox Kontrolcüsü

Kontrolcüyü bilgisayara bağla (USB ya da Bluetooth), sayfada herhangi bir tuşa bas ve oyna. Menüler dokunmatik/fare ile, maç içi kontroller kontrolcüyle:

| Kontrolcü | İşlev |
|---|---|
| Sol analog / D-Pad | Hareket |
| A | PAS |
| X | ARA PAS |
| B | ŞUT |
| Y | MÜDAHALE |
| RT / RB / LT (basılı) | SPRINT |

## Güncel Kadro

Berk, Erdoğan, Koray, Yankı, Eren Arda, Kaan, Rüzgar, Çiğdemoğlu, Ahmet, Kandemir, Kemal.
Model dosyaları (`client/assets/models/characters/`): `<id>.glb` ve `<id>goal.glb`
(`kaan`, `ruzgar`, `cigdemoglu`, `ahmet`, `kandemir`, `kemal`).
