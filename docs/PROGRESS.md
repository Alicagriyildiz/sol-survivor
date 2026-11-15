# İlerleme

## Oturum 7 — 2026-11-15 (sunumdan önce, 13:40-14:40) — görsel fark, görev sonu sahneleri, zor Komutan

**Görsel fark.** Prototip (e2c8c4e), canlı sürüm (8656dc2) ve yeni sürüm aynı açılardan çekildi. Prototip ile
canlı sürüm arasında fark gerçekten küçüktü: aynı soluk pembe gökyüzü ve tek tepe halkası, düz ışık, beyaz iç
mekân; Kenney modelleri tek soluk tona boyanmıştı ve uzakta duruyordu. Değişenler:
- Gökyüzü üç duraklı (gül rengi ufuk, lila orta, koyu mavi-mor tepe), net güneş diski + mavi hale; güneş alçak.
- Üç katmanlı tepeler (uzak mavi-mor, orta gül, yakın koyu), sis uzağa alındı.
- Güçlü sıcak güneş (3.4) + soğuk mavi gök/dolgu ışığı; daha keskin gölgeler.
- Kenney malzemeleri parça parça: açık gövde, lacivert çerçeve, koyu pencere, hafif parlayan turkuaz şerit;
  kayalar bazalt tonlarında. Yeni modeller göz hizasında: EVA yolunun üstünde iki kule (kapı gibi), yollar arasında
  gezici, üssün yanında büyük hangar (sarı şeritli), yuvarlak hangar, küçük hangar, iniş yolunda büyük çanak.
- Yol işaretleri: EVA izleri boyunca parlayan turkuaz/sarı başlıklı direkler, iniş alanında ışık halkası.
- Zeminde büyük bazalt lekeleri ve açık toz alanları.
- Üs içi: koyu lacivert duvarlar, parlayan turkuaz ışık şeritleri, koyu tavan; dışı açık panel.
- Sera: canlı mor yetiştirme ışığı ve yeşil bitkiler. Sığınak: kalın beton sütunlar, alçak kiriş halkası, sarı şerit.
- Önce/sonra: `docs/screenshots/once-*.png` ↔ `sonra-*.png` (1 ana üs, 2 paneller, 3 üs dışı, 4 sera, 5 sığınak).

**Görev sonu sahneleri** (`src/scene/Ending.tsx`, `src/ui/Ending.tsx`; yan ajan). Kazanma: ikmal aracı iner, kamera
yürür, araçla yükselir, üs aşağıda küçülür. Kaybetme nedene göre (güç: üs kararır; yaşam desteği: alarm ışığı;
Kalkan/radyasyon: kask uyarısı), sonra acil durum kapsülü kalkar; ölüm yok. Atlanabilir (Esc/Enter), 14 sn zaman
aşımı, sade görünümde SVG kart, azaltılmış harekette durağan kart. Görev sonu ekranında Kara Kutu daveti.
Geliştirme: `?jump=99&seed=2` (kazanma), `seed=1` (güç), `seed=7` (Kalkan), `&ending=life` zorlar.

**Komutan** (yan ajan). Komutan'da öneri yok: görev satırı yalnız açık sorunları ve yerlerini listeler, 3D ok yok,
bakım düğmesi yok. Genç'te yalnız "En zayıf gösterge: X (n)" notu. Yeni bot `src/bots/follower.ts` (ekranı harfiyen
izleyen): Komutan %0, Genç %77.5 (1-200 ve 201-400). Dikkatli Komutan %44 / %46.5, rastgele %2.5 / %0, boş %0;
Sol 1 kaybı yok. COMMANDER_CONFIG değişmedi (57/61).

**Doğrulanmadı:** gerçek GPU / telefon akıcılığı (ışık şiddeti ve modeller arttı, gölge haritası aynı; yeni 6 model,
~70 instanced direk). Bitiş sahnesinde kalkışta ön planda bulanık varil görünebiliyor.

## Oturum 6 — 2026-11-15 (sunum günü) — birinci şahıs 3D, işin canlı yapılması, İngilizce, Komutan

Çekirdek, içerik sayıları, veri ve Kara Kutu mantığı değişmedi (yalnız `config.ts`'e Komutan görev ayarı eklendi).
Eski izometrik sahne silindi. Ayrıntı: `docs/3D-PLAN.md`, `docs/DESIGN.md` §6d, sunum yolu `docs/DEMO.md`.

### 3D (birinci şahıs)
- Göz hizası kamera, sürükleyerek bakma (fare/parmak, işaretçi kilidi yok), tıklayınca yol noktalarından yürüme (≤ 3,2 sn, dokununca biter), istasyon adları + durum işaretleri, hedef görüş dışındaysa kenarda yön oku, altta istasyon düğmeleri, envanter, Günü bitir, ses düğmesi.
- Dünya: yuvarlak ana üs (iç: ışıklı tavan, borular, masa, dolaplar, zemin çizgileri; güç düşünce kararır), hava kilidi tüneli, sera kubbesi, tünelle gömülü sığınak, belirgin uzakta güneş paneli alanı ve iniş alanı; avlu, dönen çanak, eklemli robot kollu araç, yanıp sönen ışıklar.
- Ortam: gökyüzü geçişi (gündüz pembe-mor, gece yıldızlı, fırtına bulanık + toz duvarı, Sol 12 mor perdeler), güneş + dolgu ışığı, yumuşak gölge, ACES ton eşleme, ufukta sisle birleşen tepe silueti, renkli engebeli zemin, araç izleri, kayalar (instanced + Kenney), uçuşan toz.
- **8 eylem türünün hepsi çalışıyor; her seçenek ve bakım işi bir türe bağlı (test).** Her iş istasyonun kendi nesnesinde oynar (ayrıntı aşağıda). Sorun metinsiz görünür (toz, kırmızı yanıp sönen lamba ve konsol, buhar, kıvılcım, tuz kabuğu, çatlak), ertelendikçe kötüleşir (lamba hızlanır/büyür, toz koyulaşır, buhar/kıvılcım artar). Sonuç sonraki sollerde kalır (durumdan türetilir).
- Elle yapma: panelde sürükleyerek silme (toz gerçekten silinir, %85'te biter); diğer işlerde "Basılı tut" (ya da görünüme basılı tutmak / Boşluk); 5 sn dokunulmazsa astronot yapar; "Kendisi yapsın" (Enter), "Atla" (Esc). Başarısız olunamaz. Üst çubuk iş bitene kadar önceki değerleri gösterir; bitince "✓ Bitti · ⏱ −X sa", turkuaz parıltı ve kısa ses.
- İşe göre alet: fırça, bant, kartuş/anahtar, kürek, fiş, tablet; şalterde açık el.
- Sol 12: kask ekranında "Gerçek güneş olayı: 10 Eylül 2017 · X8.2 sınıfı" (DONKI kaydından), sığınakta oturarak bekleme, duvardan sızan mor parçacıklar (güçlendirilmiş duvarda az).
- Kilitli istasyona yürünmez (panel kilit notuyla açılır). Kalite kademesi: dokunmatik küçük ekranda gölge yok, daha az parçacık.

| İstasyon | Kim | İşler |
|---|---|---|
| Ana üs | ana oturum | filtre değiştir / silkele / vur / bantla (Apollo), ters yıkama (vana + su), pompa bakımı (kapak, yeni gövde) / yağlama (damla, yağ kutusu kalır), fanları aç (tek tek / hepsi), oksijen tam güç, ışık kıs, konsoldan mesaj (zarf, yazı, dalga), gece programı, fener kablosu |
| Güneş paneli | ana oturum | elle silme (yarım temizlik dahil), kum serpme (kum sırtları kalır), panelleri bağla (kayışlar kalır), radyatör temizliği |
| Batarya | Ajan S1 | fiş tak + hücreler dolar (tam/yarım), şalterler (sera lambası, ısıtıcı), pompa değiştir / ödünç pompa, bataryaların yarısını kapat (kepenk), ayar konsolu |
| Sera | Ajan S1 | toprağı yıka, topraksız tepsiye taşı, dayanıklı bitki ek, bitkilerin oksijeni, sızıntıya yama / çay yaprağı + bant, serayı kapat, bitkilere bak |
| Sığınak | Ajan S2 | regolit torbaları (oda küçülür), su bidonları, torba bakımı, duvar ısıtıcısını kapat (buz), Sol 12'de içeride bekleme |
| Hava kilidi | Ajan S2 | yeni conta / silip geç, depo sızıntısı yama / çay yaprağı / bölmeyi kapat, kabloları içeri al, su bidonu köşesi |
| İniş alanı | Ajan S2 | kayaları it, işaret direkleri, yansıtıcılar; fener ışığı (tam/kısık/yok) |

### Modeller
Kenney Space Kit (CC0, lisans dosyası pakette okundu): 20 GLB, ~280 kB, `public/models/kenney/`; malzemeler yüklenirken palete çevrilir; yüklenemezse yedek şekil. Quaternius paketleri kullanılmadı (pakette lisans dosyası yok, renkler atlas dokusunda). `CREDITS.md`.

### Diğer
- **İngilizce** (Ajan D): `lang/en.ts` tam karşılık, TR/EN seçimi (başlangıç + üst çubuk), ilk açılışta tarayıcı dili, `?lang=`; test eksik anahtarı yakalar. Bitiş ekranında Kara Kutu en üstte.
- **Türkçe metinler** (Ajan B): 103 düzeltme (kısa cümleler, terim açıklamaları, "EVA'da radyasyon alırsın" gibi doğru anlatım).
- **Komutan** (Ajan A): başlangıç Güç 57 / Yaşam 61. Dikkatli %44 (201-400: %46,5), rastgele %2,5, sağlam %0, en ucuz %0, hiçbir şey %0, Sol 1 kaybı yok; Kara Kutu Komutan ayarıyla testli (`tests/commander.test.ts`). Genç seviye hedefleri ve testleri aynı.
- **Görev satırı ölçümü** (Genç, tohum 1-200): görev satırını izleyip rastgele seçen %1,5, hep ilk kartı seçen %0; bakım da yaparlarsa %27,5 / %30. Asıl tuzak "sorunlar bitti" durumundaki tek "Günü bitir" düğmesiydi → şimdi en zayıf göstergenin bakım işine götüren düğme + ikinci düğme Günü bitir.
- **Demo:** Başlangıç → 🎬 Demo (tohum 148, kayıtlı oyun: Sol 4 / 6 / 12 / görev sonu), `?seed=` üretimde de çalışır, `docs/DEMO.md`.
- Oyun içinden Veriler düğmesi; ses (tarayıcıda üretilir, kapatılabilir).

### Doğrulama (headless Chrome, SwiftShader WebGL, CDP ile gerçek tıklama)
| Koşu | Sonuç |
|---|---|
| 3D, TR, tohum 148, 1280×800, geliştirme: tüm görev | 36 karar, 45 iş (atla / astronot yapsın karışık), görev sonu ekranı; konsol hatası yok |
| 3D, EN, tohum 30, aynı | Aynı akış İngilizce; konsol hatası yok |
| Üretim (`/sol-survivor/`), EN: DEMO.md yolu | Sol 4 elle silme + panel temiz kalıyor, Sol 12 kask satırı, görev sonu, Kara Kutu: Sol 6 regolit → "Mission over (Sol 14)" ↔ "You survived" |
| Her istasyonun işleri tek tek (ekran görüntüsü) | Ana üs, panel, batarya, sera, sığınak (Sol 6, Sol 12), hava kilidi, iniş alanı |
| 390×844 dokunmatik | HUD okunur, dokunarak bakma ve silme çalışıyor |
| Klavye | İstasyon düğmesi + Enter → panel (odak Kapat), Tab → Bunu yap + Enter → iş; Enter astronota yaptırır; saat düşer |
| WebGL kapalı (üretim) | Kartlı ekran, 7 istasyon kartı |
| Model temizliği sonrası | "model failed" / 404 yok |

Gerçek GPU'lu dizüstü ve gerçek telefonda **denenmedi**. Çizim çağrısı ~420 (üs içi) / ~380 (dışarıda), ~150 bin üçgen.

### Paket
Ana parça 414 kB (gzip 133 kB; İngilizce dosya ve demo kaydı eklendi), CSS 25,7 kB, 3D parçası 1.121 kB (gzip 300 kB, geç yüklenir), modeller 282 kB (20 dosya).

### Testler
101 test: yeni `tests/world.test.ts` (her seçeneğin eylem türü, yollar, uzaklık, görünüm durumdan), `tests/lang.test.ts` (TR/EN anahtar eşitliği, yer tutucular, İngilizce Kara Kutu cümleleri), `tests/commander.test.ts`. Eski `tests/scene.test.ts` izometrik sahneyle birlikte silindi. Tip denetimi ve üretim derlemesi temiz.

### Bilinen sorunlar
- Bazı yakın planlarda eldivenin bileği kameraya yakın ve iri görünüyor.
- Sol 12 mor gökyüzü üs içinden yalnız pencereden görünür (DEMO.md'de yazıyor).
- Sıradan Genç seviyede bazı seçenekler hâlâ "kazandıran düğme" (Sol 6 regolit, Sol 7 talimata uy, Sol 8 tam doldur, Sol 9 ısıtıcı: dikkatli bota zorlanınca %100); Sol 13 sızıntı ve Sol 14 soğutma seçenekleri sonucu neredeyse etkilemiyor. İçerik sayısı değiştirilmedi; öneriler Ajan A raporunda.
- Etiketler bazen üst üste biner (dışarıdan üsse bakınca sorunsuz iç istasyonlar gizlenir, sorunlu olanlar görünür).
- Geliştirme modunda R3F'den "THREE.Clock deprecated" uyarısı.

---

## Oturum 5 — 2026-11-15 (sabah, sunum öncesi) — sade ekran + 3D üs sahnesi

Oyun kuralları, içerik sayıları, veri, çekirdek ve Kara Kutu değişmedi. Denge testleri aynı sonuçla geçiyor.

### 1. Sade ekran (iki görünümde de)
- Renk token'ları açıldı (zemin `#1d2745`, yüzeyler `#28345a` / `#34426d`, kenar `#56679a`); kartlar gölgeli; taban yazı 17 px. Turuncu/amber yok (ekran görüntüsü taramasında en çok %0,4 sarımsı piksel, hepsi emoji; envanter emojileri değiştirildi).
- Üst çubuk: büyük çubuklar, üstünde sayı (her iki seviyede), tehlike eşiği kesikli çizgi, renk + simge + durum sözcüğü. Mesai şeridi 16 px hücreler. Sol başlığı üst çubuktan kaldırıldı (brifingde var).
- Görev satırı tek satır: "{yer} git: {sorun}" + 👟 yürüme bedeli + yeri açan düğme; diğer sorunlar küçük etiketler; "Saatler nereye gitti?" ⏱ simgesinin arkasında. Seçenek önermez.
- Öğretici: hedefin yanında küçük sarı baloncuk, adım başına tek cümle.
- Seçenek kartı: ad, ⏱ toplam (👟/🚀/🔧 dökümü), oklar, kısa etiket, "Bunu yap"; "neden" metni "ⓘ Neden?" ile açılır. Sol 12 gerçek olay kartının açıklaması "Daha fazla" ile açılır.
- "Son yaptığın" tek satır (oklar zaten çubuklarda). Envanter simge + sayı. İstasyon kartlarında ⚠ sorun, 🔧 bakım saati, 🔒, 📍. Telefonda kartlar iki sütun.
- Panel klavyeyle: açılınca odak "Kapat"ta, Esc kapatır, odak geri döner.

### 2. 3D sahne (`src/scene/`)
- `three@0.187.0`, `@react-three/fiber@9.8.2`, `@react-three/drei@10.7.9` (sabit sürüm; drei'den yalnızca `Instances`). Fizik yok, dış dosya yok.
- Sabit izometrik ortografik kamera, döndürme/yakınlaştırma yok. Üs kümesi (Ana üs, Sera, Sığınak, Batarya, Hava kilidi; koridorlarla bağlı), dışarıda ve uzakta Güneş paneli alanı ve İniş alanı (patika ile). Silüetler: kubbeli silindir + anten, saydam kubbe + bitkiler, toprak tümsek + kapı, kutu + batarya + radyatör kanatları, yatay silindir + sandıklar, eğik panel dizisi, işaretli daire.
- Etiketler sahne üstünde DOM (Türkçe ad, zıplayan ⚠ sayısı, 🔧 saat, 🔒, soluk görünüm). Açık sorunda ayrıca 3D sarı sekizyüzlü işaret.
- Astronot: yol noktaları (iç yürüyüş ana üsten, EVA hava kilidi kapısından), ≤ 1,5 sn, tıklayınca atlanır, yürürken tıklama kuyruğa girmez; varışta mevcut panel açılır. Panel eylemsiz kapanırsa gerçek konuma geri yürür.
- Durum: güç düşük → ışıklar kısık/sönük; fırtına → sis + toz katmanı, dış istasyonlar soluk ve kilitli; Günü bitir → 1,1 sn gece; Sol 6 güçlendirme → büyük tümsek + torbalar; panel tozu → mat paneller; Sol 12 → mor-pembe gökyüzü.
- Sağlamlık: geç yüklenen parça (`React.lazy`), yüklenirken kartlar; WebGL yoksa 3D seçeneği kapalı; yükleme hatası / sahne hatası / bağlam kaybı → hata sınırı → kartlar (sayfa boyunca). Başlangıçta ve üst çubukta "3D / Sade" seçimi (`localStorage`, `?view=`).
- Performans: `frameloop="demand"` (boşta 3 sn'de 0 çizim çağrısı, ölçüldü), piksel oranı ≤ 1,5, gölge yok (astronotta sahte gölge), tekrar eden şekiller instanced, Lambert malzeme. Sahne her sol yeniden kurulur; 14 ardışık sahnede WebGL bağlam uyarısı çıkmadı.
- Dar ekran (< 640 px): sıkı yerleşim (dış istasyonlar üssün arkasında), kısa etiket adları, öğretici baloncuğu sahnenin üstünde.
- Erişilebilirlik: istasyonlar ayrıca gizli bir düğme listesi (Tab ile görünür olur), adı + sorun + bakım + kilit + yürüme yazar.
- Çift eylem koruması `App.act` içinde (yalnız güncel duruma uygulanır).

### Doğrulama (headless Chrome, SwiftShader WebGL, CDP ile gerçek tıklama)
| Koşu | Sonuç |
|---|---|
| 3D, 1280×800, geliştirme | 7 istasyonun hepsi gerçek fare tıklamasıyla açıldı; yürüyüş atlama; Sol 1-13 oynandı (görev 8, hep ilk seçenek → Sol 13'te Güç'ten kayıp); fırtına (Sol 9-10), gece geçişi, Sol 12 mor gökyüzü ve sığınak paneli, görev sonu, Kara Kutu. Her seçimde çift tıklama: mesai bir kez düştü. |
| 3D, 390×844 dokunmatik, üretim (`/sol-survivor/`) | Aynı akış; 7 istasyon dokunarak açıldı. Konsol temiz. |
| 3D, 1280×800, üretim | Aynı akış, konsol temiz. |
| Sade, 1280×800 | Aynı akış, konsol temiz. |
| WebGL kapalı, üretim | 3D seçeneği kapalı ("Bu tarayıcıda 3D açılmıyor"), oyun kartlarla açıldı. |
| Klavye | Tab → istasyon düğmesi, Enter → yürüyüş + panel, odak "Kapat"ta, Esc kapatır. |
| 3D parça yüklenemedi (geliştirme sunucusu modülü yeniden yüklerken, kendiliğinden oldu) | Hata sınırı kartlara düştü, oyun sürdü. Bu bulgudan sonra hata sayfa boyunca hatırlanıyor (her solde yeniden denemiyor). |

Gerçek GPU'lu dizüstü ve gerçek telefonda **denenmedi** (yalnız yazılım WebGL).

### Paket
- Ana parça 360 kB (gzip 115 kB), CSS 18,6 kB (gzip 4,5 kB). 3D parçası ayrı ve geç yüklenir: 940 kB (gzip 249 kB; çoğu three.js çekirdeği, R3F tüm `THREE` ad alanını katalogluyor). Vite 500 kB uyarısı bu parça için.

### Testler
81 test (69 eski + 12 yeni `tests/scene.test.ts`: yerleşim, EVA uzaklığı, yol noktaları, ≤ 1,5 sn yürüyüş, enterpolasyon, dar ekran kipi, kamera izdüşümünün three.js ile eşitliği ve etiketlerin ekranda kalması, `sceneLook` durumları). Tip denetimi ve üretim derlemesi temiz.

### Bilinen görsel sorunlar
- Geniş ekranda "Hava kilidi ve depo" etiketi Ana üs'ün hemen üstünde; Ana üs etiketiyle 50 px arayla duruyor, karışabilir.
- Öğretici baloncuğu (geniş ekranda, 3D) Ana üs etiketinin üstünde dururken Hava kilidi etiketini kısmen örter.
- Sığınak tümseğinin büyümesi Sol 6'dan sonra belirgin ama ince (%30).
- Fırtınadaki toz bir CSS çizgi deseni; gerçek parçacık değil.
- Geliştirme modunda R3F içinden "THREE.Clock deprecated" uyarısı (üretimde yok).
- Emojiler sistem yazı tipinden: cihaza göre farklı görünür (🚀, 🧑‍🚀 sarımsı).

### Kalan işler
- Gerçek cihazda (entegre grafik, telefon) akıcılık kontrolü.
- Oturum 4'teki denge işleri (Sol 6 regolit, dikkatli botta Kalkan payı) değişmedi.

---

## Oturum 4 — 2026-11-15 (sabah) — acil yedek bedelli oldu

### Sorun
Oturum 3'teki +52'lik bedava yedek ihmali ödüllendiriyordu. Sol 6'da sığınağı ertelemek %97, güçlendirmek %73 çıkıyordu (X olaylarında bile ertele %94). Kalkan kayıp nedeni olarak neredeyse yoktu (%0,4). Veriyi bağladığımız Sol 12 oyunun en önemsiz yeri olmuştu.

### Kural
Acil yedek kaynak başına bir kez, kritik eşikte (25), **+30**; **o kaynak görevin geri kalanında her gece 2 puan daha fazla erir.** Sağlık bedeli yok. Motor `shared` / `healthCost` / `wear` seçeneklerini destekliyor (DESIGN §1). Oyuncuya: "Acil yedek devreye girdi. Bu sistem artık her gece biraz daha hızlı yıpranacak." (anında, önizlemede, raporda; gece raporunda "Acil yedekten sonra sistem daha hızlı yıpranıyor" satırı).

İlk denemede (45 dk) eski hedeflerin hepsini tutan ayar bulunamadı ve değişiklik geri alındı (~8.500 ayar). Bulgu: katı kurtarma oranı rastgele botun kazanma oranıyla birlikte iner; yedek bedelli olunca rastgele bot daha uzaktan kaybeder. Oyun sahibi hedefleri güncelledi (DESIGN §6), en yakın aday alındı.

### Denge (tohum 1-200)
| | Oturum 3 | Oturum 4 |
|---|---|---|
| Rastgele | %18 | %19,5 |
| En ucuz | %0 | %3 |
| Sağlam | %36 | %30 |
| Dikkatli | %79,5 (kayıplar 51 / 49 / 0) | %83,5 (30 / 0 / 70) |
| Hiçbir şey yapmayan (yeni) | — (%0) | %0 |
| Tüm botlar Güç / Yaşam / Kalkan | 37 / 63 / 0 (idle dahil) | 57,8 / 21 / **21,2** |
| Kurtarma otomatik pilot / katı | %48,2 / %43,9 | %45,3 / **%36,6** |
| Sol 6, X olayları: regolit / ertele | %72 / %94 | **%100 / %78** |
| Sol 6, diğer olaylar: regolit / ertele | %73 / %98 | %100 / %94 |

Tüm Oturum 4 hedefleri ✅ (testli). Ayar değerleri DESIGN §6.

Dürüst notlar:
- Sınırlara yakın: dikkatli botun Kalkan payı %69,7 (sınır < %75), rastgele %19,5 (≤ %25), dikkatli %83,5 (≤ %88).
- Sol 6'da regolit zorlanınca dikkatli bot her olayda %100 kazanıyor: artık en güçlü seçenek. Zayıf olaylarda fark 6 puan (hedef ≤ 10), ama "hiçbir seçenek her durumda en iyi olmasın" kuralına göre regolit fazla güçlü.
- Dikkatli botun kayıplarının %70'i Kalkan: radyasyon yeniden ciddi, ama Oturum 2'deki %88'e yaklaşıyor.

### Gözle doğrulama
Görev 8 (X8.2, 10 Eylül 2017) arayüzden iki kez oynandı, her istasyonda ilk seçenek; ikincisinde Sol 6 ertelendi.
- Sol 12 "Son yaptığın" kartı (sığınakta kal): güçlendiren oyuncuda Sağlık ▼▼, doz ▲▲ ve "🔗 Sol 6'da sığınağı regolitle güçlendirdin: sığınak seni çok iyi korur."; erteleyen oyuncuda ▼▼▼ / ▲▲▲ ve "Sol 6'da sığınak güçlendirilmedi: duvarı ince, az korur."
- Sol 12 raporu: "Bunu Sol 6'da seçtiğin “Duvara kalın regolit katmanı ekle” etkiledi."; erteleyende ayrıca "Kalkan çok zayıf…" satırı.
- Görev sonu doz: 3,6 mGy'ye karşı 5,1 mGy. Konsol hatası yok.

### Testler
69 test geçiyor. Yeni: hiçbir şey yapmayan %0, Sol 6 olay sınıfına göre, toplamda Kalkan %15-40, yedeğin kalıcı aşınması. Güncellenen sınırlar: rastgele %5-25, dikkatli %60-88, dikkatli Kalkan < %75, katı kurtarma ≥ %35.

### Kalan işler
- Sol 6 regolit artık fazla güçlü (her olayda %100); bedelini olay şiddetiyle dengelemek.
- Dikkatli botta Kalkan payını aşağı çekmek (%70).
- Oturum 3'teki diğer zayıf seçenekler bu ayarda yeniden ölçülmedi.

---

## Oturum 3 — 2026-11-15 (sabah, sunum öncesi) — gerçek NASA verisi, Kalkan/yedek kuralı, yayın

3D sahne bu oturumda yapılmadı. Jüri için veri belgesi: `docs/DATA.md`.

### Veri kaynakları
| Kaynak | Durum | Ne indirildi / nereden | Oyunda neyi değiştiriyor |
|---|---|---|---|
| DONKI (güneş olayları) | ✅ | `ccmc.gsfc.nasa.gov/DONKI/WS/get/FLR` + `/SEP` (anahtarsız), 2010-04 → 2025-12, 60 günlük pencereler, 192 istek. 3058 patlama, 459 SEP, SEP'e bağlı 134 patlama. Seçilen 5 olay: C7.6 (4 Oca 2025), M1.2 (1 Eyl 2023), M9.7 (8 Haz 2024), X1.8 (26 Eki 2024), X8.2 (10 Eyl 2017). | Sol 12 olayı (tohuma göre biri): Kalkan kaybı 3·s, ham radyasyon 16 + 24·s. Sol 6-11 brifinginde "Uzay havası" satırı, Sol 12 panelinde gerçek olay kartı, Kara Kutu açıklamasında olay satırı. |
| RadLab (ISS dozu) | ✅ | `visualization.osdr.nasa.gov/radlab/api/` ISS DosTel1, Mart 2022, 37.209 ölçüm. Zaman ağırlıklı ortalama 12,24 µGy/sa = 0,29 mGy/gün (düz ortalama 30,7: yüksek dozda sık örnekleme). | Doz bilgi düğmesi ve görev sonu karşılaştırması. |
| Curiosity RAD (Mars yüzeyi) | ✅ yayımlanmış değer | science.nasa.gov "Radiation Measurements on Mars": yaklaşık 210 µGy/gün (elle, adres + alıntı `src/data/published-values.json`). | Doz sayacının birimi (mGy): 1 gecelik arka plan = 1 RAD günü. |
| 2018 fırtınası | ✅ yayımlanmış değer | JPL: tau 10,8 (10 Haz 2018), normal 0,5, şarj eşiği 2,0; NASA: en düşük 21 Wh. Fırtına öncesi Wh resmi sayfada **bulunamadı**, oran kurulmadı. | Fırtına gecelerinde panel verimi 0 (doğrusal tau kuralı) → gece −5 Güç (sayısal olarak eskisiyle aynı). Sol 8-10 brifinglerinde değerler. |
| OSDR çalışmaları | ✅ | `osdr.nasa.gov/osdr/data/search`: OSD-252 (Sol 2), OSD-772 (Sol 3), OSD-342 (Sol 9), OSD-210 (Sol 12). | Sol raporunda "NASA araştırması" satırı (ad, kimlik, bağlantı). |
| api.nasa.gov DONKI | ❌ | DEMO_KEY ile `/DONKI/FLR` HTTP 404 döndü (SEP çalıştı); saatte 10 istek sınırı. Aynı veriyi veren anahtarsız CCMC ucu kullanıldı. `kauai.ccmc…` zaman aşımı. | — |

`npm run fetch-data` yeniden çalıştırılabilir (önbellek `scripts/.cache/`, git dışı). Veri testleri: `tests/data.test.ts`.

### Kaynak notları
15 notun 14'ü resmi sayfadan doğrulandı (`verified: true`, adresler `sources.ts`). Sol 13'teki çay yaprağı ayrıntısı resmi sayfada yok, rozet kalıyor. Düzeltilen notlar: 1 (kaynak), 3, 5, 6, 7, 9, 11, 12, 13, 14, 15. Ayrıntı `docs/SOURCES.md`.

### Kural: acil yedek
Yedek eşiği = kritik eşik (25), `config.ts` içinde bağlı ve testli. Sessiz 10-25 bandı yok. Ayrıntı ve ödünleşim DESIGN §1, §6.

### Denge (tohum 1-200, `npm run balance`)
| Bot | Oturum 2 (kayıp nedeni Güç / Yaşam / Kalkan) | Oturum 3 |
|---|---|---|
| Rastgele | %13,5 (30,6 / 27,7 / 41,6) | **%18** (55,5 / 43,3 / 1,2) |
| En ucuz | %0 (34 / 66 / 0) | %0 (51 / 49 / 0) |
| Sağlam | %35,5 (12,4 / 24 / 63,6) | %36 (19,5 / 80,5 / 0) |
| Dikkatli | %74 (11,5 / 0 / **88,5**) | **%79,5** (51,2 / 48,8 / **0**) |
| Tüm botlar | 25,8 / 38,1 / 36,1 | 44,8 / 54,8 / 0,4 |
| Kurtarma, otomatik pilotla | %51,4 | %48,2 |
| Kurtarma, katı (hedef ≥ %40) | %47,4 | **%43,9** |

Tüm hedefler ✅: rastgele %5-20, dikkatli %60-85, en ucuz ve sağlam < %50, toplamda hiçbir neden > %60, Sol 1'de kayıp yok, katı kurtarma ≥ %40, dikkatli botta Kalkan payı < %70 (yeni test).

Değişenler:
- `config.ts`: yedek 10/+35 → 25/+52; gece tüketimi P/Y/K −4,75 / −6,75 / −4,5 → −5,75 / −8,25 / −4; kritik hasar 0,9 → 1,1/sa; gece iyileşmesi 4 → 10, rahat eşiği 20 → 25.
- `tuning.ts`: maliyet çarpanı ertele 0,5 → 0,3, hızlı 0,7 → 0,8, sağlam 1,2 → 1,8; rutin kazancı 0,5 → 0,3.
- `scenario.ts`: Sol 5 tam güç Güç −14 → −10; Sol 6 regolit 5 → 4 sa, Güç −4 → −2, kalın duvar 9 gece +1,5 Kalkan; Sol 6 ertele Kalkan −3 → −6; Sol 7 rapor artık +3 Güç vermiyor; Sol 8 panelleri bağla 3 → 2 sa (**sıra tuzağı kalktı**: iki iş her iki sırada da sığar, 9 / 9,5 sa); Sol 13 kayaları temizle 3 → 2,5 sa; Sol 15 tam güç fener, alan temizse +5, işaretliyse +3 Yaşam. Sol 9 fırtına ve Sol 12 olayı veriden.
- `bots.ts` (ölçüm düzeltmesi): dikkatli bot önizlemede acil yedeği kazanç saymıyor, arayüzle tutarlı (DESIGN §5).

Seçenek zorlama (dikkatli bota tek seçenek zorlandı, 200 görev, taban %80):
- Düzelen: Sol 8 bağla %82 (önce %66; kablolar %80, ertele %75); Sol 5 tam güç %89 (önce yarım güç %98'le baskındı); Sol 3 hidroponik %88.
- **Hâlâ sorunlu:**
  - **Sol 6:** ertele %97, regolit %73, su %80. Büyük yedek, kaynağı erken 25'in altına düşürmeyi ödüllendiriyor. Regolitin Güç bedeli bazı tohumlarda Güç yedeğini Sol 6'da harcatıyor. Sol 6'yı dengeleyen ayarlarda (yedek 20-30) katı kurtarma %20-32'ye düşüyor, hedef tutmuyor. Kalın duvarın faydasını artırmak (1,5 → 3,5) sonucu değiştirmedi, çünkü Kalkan bağlayıcı kaynak değil.
  - **Sol 13 alan hazırlığı:** temizle %73, işaret %74, ertele %80 (zayıf kaldı).
  - **Sol 7:** kendi kararın %97, ertele %96, talimata uy %70.
  - **Sol 9:** ısıtıcıyı kıs %94.
- **Kalkan artık neredeyse hiç kayıp nedeni değil** (toplam %0,4). Eski kusur (%88) düzeldi ama ters yöne fazla gitti: Kalkan'ın oyundaki riski yalnızca radyasyon, onu da gece iyileşmesi büyük ölçüde siliyor.

### Arayüz
- Brifing: "☀ Uzay havası" satırı; Sol 8-10'da 2018 fırtına değerleri.
- Sol 12 paneli: gerçek olay kartı (tarih, sınıf, güç, çocuk dilinde açıklama, oyun ölçeği uyarısı, DONKI kaydı).
- Üst çubuk: doz sayacı her seviyede, mGy, ⓘ bilgi düğmesi (RAD + RadLab).
- Sol raporu: kaynak adı bağlantı; "🔬 NASA araştırması" satırı.
- Görev sonu: doz karşılaştırması (sen / korumasız Mars / ISS); "Veriler" düğmesi.
- Başlangıç: "Veriler" düğmesi → Veriler ekranı (veri, kaynak, tarih, etki; tasarım sayılarının oyun tasarımı olduğu notu).
- Kara Kutu: açıklamada Sol 12 geçiyorsa gerçek olay satırı.
- Uçtan uca gerçek tarayıcıda (headless Chrome, CDP) 1280 ve 390 px'te oynandı; dev ve üretim derlemesi (`/sol-survivor/` alt yolu); konsol hatası yok, yatay kaydırma yok.

### Yayın
- `vite.config.ts`: build ve preview için `base: '/sol-survivor/'`.
- `.github/workflows/deploy.yml`: main'e her push → `npm ci`, `npm test`, `npm run build`, Pages'e dağıtım.
- Gerekli tek ayar: GitHub → Settings → Pages → Source: **GitHub Actions**. Depo herkese açık (kontrol edildi).

### Testler
`tests/data.test.ts` (yeni): anlık görüntü meta verisi, API anahtarı yok, 4-6 olay, ölçek tekdüzeliği, oyunda güçlü olay daha çok zorlar, aynı tohum = aynı olay (karşı-olgusal dahil), uzay havası takvimi, yedek eşiği = kritik eşik.

Güncellenen testler:
- Kurtarma testi katı ölçüye geçti (≥ %40). Dikkatli bot için Kalkan payı < %70 testi eklendi.
- "Notlar doğrulanmamış olmalı" → "doğrulanan notun adresi olmalı".
- Kara Kutu Sol 6 → 12 testi yalnızca Sol 12 dozunun iki gidişatta gerçekten farklı olduğu tohumlarda açıklamayı denetliyor. Zayıf olayda ya da Kalkan farkı sığınağı sıfırladığında açıklamanın Sol 12'yi anmaması doğru davranış.
- Bant testi rastgele bot kayıtlarını da tarıyor (dikkatli bot artık çay yaprağı seçmiyor).

### Kalan işler
- Sol 6 sığınak dengesi (yukarıda): yedeğin zamanlamasını daha az belirleyici yapan bir kural gerekiyor (ör. yedek bir sonraki gece verilsin ya da miktarı kalan sol sayısına bağlansın), ardından yeniden ayar.
- Kalkan'ın kayıp nedeni olarak yeniden anlamlı olması (≈ %15-30).
- Sol 13 alan hazırlığı, Sol 7 "talimata uy".
- 3D sahne (`docs/3D-PLAN.md`), İngilizce dil dosyası.

### Bilinen sorunlar / riskler
- DONKI seçimi `fetch-data` yeniden çalışınca değişebilir (yeni olaylar banda girerse). Anlık görüntü depoda sabit; yeniden indirme bilinçli bir karar olmalı.
- Gece iyileşmesi 10 ve yedek 52 büyük: oyun "bir kez çöküp toparlanma" ritmine dayanıyor.

---

## Oturum 2 — 2026-11-15 (sabah) — oyun testi, 15 sol denetimi, düzeltmeler, denge

Ayrıntılar: `docs/PLAYTEST.md` (bulgular, 15 sol tablosu, önce/sonra). 3D sahne bu oturumda yapılmadı.

### Bitti
- Üç tam oyun gerçek arayüzden (headless Chrome, CDP ile tıklatma): dikkatli oyuncu, okumayan 8 yaş (dar ekran, 5 tıklama zarı, eski ve yeni sürüm), kötü oyuncu + Kara Kutu. Komutan seviyesi kısa tur.
- **Görev satırı** (`selectors.mission`), günün sorunları durumlarıyla (`todayFaults`), **mesai şeridi** ve "Saatler nereye gitti?" dökümü (`hoursLog`).
- İstasyon paneli çıkmaz sokak değil: sorunların yerine düğmeler, bakım işi saatiyle, "bakım işi yok" açıklaması.
- **Sol 1 öğretici** (6 adım, varsayılan açık, kapatılabilir). Sol 1'de erteleme gösterilmez; bakım ve Günü bitir iki sorun çözülünce açılır (arayüz kuralı, DESIGN §6b).
- "Son yaptığın" kartı + çubuk başlığında son eylemin okları; seçimden sonra panel kapanır.
- Önizleme düzeltmesi (`previewParts`): acil yedek artık "iyi etki" gibi görünmüyor, ayrı uyarı; kritik saat Sağlık kaybı ve "başka soruna mesai kalmaz" uyarısı.
- Günü bitir onayı: her açık sorunun erteleme sonucu, kritik saat uyarısı, son gün notu.
- **Sol raporu** Gündüz / Gece / Sabah, her satıra neden cümlesi, gecikmeli etkiler kararın adıyla (`solReportRows`).
- **Zincir notları** içerikte veri (`SolDef.notes`, `OptionDef.notes`, metinler `tr.chain`); brifingde, seçenek kartında, seçimden sonra. Koşul diline `{ not: Cond }` eklendi.
- Acil yedek: o an, raporda, görev sonunda ve Kara Kutu sonuç kartlarında.
- Kara Kutu: tekrar eden ertelemeler tek satır (37 → 13 satır örnek görevde), otomatik pilot sonuç kartında ve grafikte işaretli.
- Dar ekran: sabit üst çubuk, görev satırı istasyonların üstünde.
- Kurgu düzeltmeleri: Sol 2 ve 14 havası, Sol 7 metni, fırtına sonrası tüketimin adı, Sol 9 Kalkan kaybının nedeni, Sol 5 sabah olayının adı, Sol 13 depo bölmesi, Sol 14 radyatör varyantında içeride yapılan işler artık EVA istemiyor. Terimler (regolit, doz, karbondioksit, EVA, sol) ilk geçtikleri yerde açıklanıyor.
- Denge: bkz. aşağı.
- Testler: `tests/selectors.test.ts` (görev satırı, sorun durumları, mesai dökümü, önizleme/yedek ayrımı, rapor satırları, `not` koşulu); içerik testi zincir notu ve olay metinlerini de denetliyor.

### Denge (tohum 1-200, `npm run balance`)
| Bot | Önce | Sonra (kayıp nedeni Güç / Yaşam / Kalkan) |
|---|---|---|
| random | %14,5 | %13,5 (30,6 / 27,7 / 41,6) |
| cheapest | %0 | %0 (34 / 66 / 0) |
| robust | %35,5 | %35,5 (12,4 / 24 / 63,6) |
| careful | %73 (Kalkan %88,9) | %74 (11,5 / 0 / 88,5) |
| Tüm botlar | 25,6 / 36,8 / 37,5 | 25,8 / 38,1 / 36,1 |
| Kurtarma | %50,3 (katı %43,3) | %51,4 (katı %47,4) |

- İçerik değişiklikleri (`scenario.ts`): Sol 3 tepsi bahçesi 2 → 1,5; Sol 5 ertelemesine ertesi gece bedeli (`o2Short`); Sol 8 bağlı panellerde fırtına tozu −3 → −1; Sol 12 "çalışmaya devam" radyasyonu ×0,8; Sol 15 fener seçenekleri ve fenersiz iniş iniş alanına bağlı; Sol 14 iki seçenek Batarya istasyonunda (EVA yok). `config.ts` ve `tuning.ts` değişmedi.
- Tüm eski hedefler ✅. **Yeni hedef (dikkatli botta Kalkan payı < %70) tutmadı**: nedeni ve denenenler `docs/PLAYTEST.md` §3. Öneri: acil yedeği "kritik" eşiğine bağlayan bir kural değişikliği + yeniden ayar (sonraki oturum).
- Hâlâ karşılığını vermeyen yatırımlar: Sol 8 "panelleri bağla", Sol 13 "işaret koy".

### Kalan işler
- 3D sahne (`docs/3D-PLAN.md`; 3D katman `mission`, `todayFaults`, `hoursLog`, `previewParts` seçicilerini de kullanmalı).
- `docs/SOURCES.md` notlarının doğrulanması (oturum 2 denetim tablosunda şüpheli ayrıntılar işaretli).
- İngilizce dil dosyası.
- Sol 8 sıra tuzağı için daha iyi bir uyarı (PLAYTEST §4).
- Kalkan/acil yedek kuralı ve yeniden denge (PLAYTEST §3).

### Bilinen sorunlar / riskler
- Sol 1 öğretici kuralları arayüzde; botlar Sol 1'de erteleyebilir (denge ölçümü buna göre).
- "Hangi tek karar kurtarırdı?" hâlâ eşzamanlı.
- Motor içindeki `pendingCommits` notu geçerli (oturum 1).
- Sayfa yenilenince oyun kaybolur (bilinçli).

---

## Oturum 1 — 2026-11-15 (gece) — çekirdek + içerik + denge + Kara Kutu + 2D arayüz

### Bitti
- İskelet: Vite 8 + React 19 + TypeScript 7 (strict, `noUncheckedIndexedAccess`) + Vitest 5. MIT lisans, README, .gitignore. `CLAUDE.md` git dışı (`.git/info/exclude`).
- Saf deterministik çekirdek (`src/sim/`): değişmez durum, tohumlu zarlar, iz (`trace`) + karar sebepleri, acil yedek, kritik hasar, EVA, yürüme, gecikmeli etkiler, değiştiriciler, yeniden açılan arızalar, seçiciler.
- 15 sol içerik (`src/content/`), 20 arıza (varyantlarla), tüm zorunlu zincirler (2→14, 4→11, 6→12, 8→9, 10→13, 7→15), Türkçe metinler tek dosyada, 15 "gerçekte ne oldu" notu + kaynak (`verified: false`).
- 4 bot + denge testi (200 tohum) + tek-kararla-kurtarma ölçümü.
- Kara Kutu: `replay`, `replayLenient` (belgelenmiş geri düşme kuralı), `alternatives`, `counterfactual`, `explain` (nedensel zincir), `findRescues`, Türkçe açıklama metni.
- Geçici 2D arayüz: başlangıç (tohum + seviye), brifing, istasyon kartları, istasyon/arıza paneli (maliyet, neden, ipucu, anlık etki), günü bitir (onaylı), sol sonu raporu + gerçek not, görev sonu, Kara Kutu ekranı (karar listesi, alternatif, tahmin, yan yana sonuç, eğri, açıklama, kurtaran kararlar). Junior/commander seviyeleri. Telefon genişliğinde çalışır. Konsol hatası yok (headless Chrome ile uçtan uca tıklatıldı).

### Son denge sayıları (tohum 1-200, `npm run balance`)
| Bot | Kazanma | Kayıp nedeni Güç / Yaşam / Kalkan |
|---|---|---|
| random | %14,5 | %30,4 / %24,0 / %45,6 |
| cheapest | %0 | %34,0 / %66,0 / %0 |
| robust | %35,5 | %12,4 / %24,0 / %63,6 |
| careful | %73,0 | %11,1 / %0 / %88,9 |
| **Tüm botlar (554 kayıp)** | | **%25,6 / %36,8 / %37,5** |

- Sol 1'de hiçbir bot kaybetmiyor.
- Tek kararla kurtarma (rastgele botun 171 kaybı): **%50,3** (kayıt bitince otomatik pilot = dikkatli bot). Katı ölçü (kayıt bitince astronot hiçbir şey yapmaz): %43,3.

### Hedef durumu
- Rastgele %5-20 ✅ · ucuz ve sağlam çoğunlukla kaybeder ✅ · dikkatli %60-85 ✅ · toplam kayıp nedenlerinde hiçbiri > %60 değil ✅ · Sol 1 kayıpsız ✅ · kurtarma ≥ %50 ✅ (sınırda: %50,3).
- **Bot bazında** neden dağılımı dengeli değil: dikkatli botun kayıplarının %88,9'u, sağlamın %63,6'sı Kalkan; ucuzun %66'sı Yaşam. Test toplam dağılımı ölçüyor; bot bazında %60 sınırı tutmuyor.

### Kalan işler
- 3D sahne (`docs/3D-PLAN.md`).
- `docs/SOURCES.md` içindeki 15 notun doğrulanması (kullanıcı yapacak).
- İngilizce dil dosyası (`lang/en.ts`, `tr.ts` ile aynı şekil) + dil seçimi.
- Sunum için kısa "nasıl oynanır" ekranı / ilk sol ipucu turu (şu an brifing + sözlük var).
- İsteğe bağlı: görev öncesi yük seçimi (`MissionConfig` hazır), oyunu tarayıcıda saklama.

### Bilinen sorunlar / riskler
- Kurtarma oranı %50,3 ile sınırda; içerik sayısı değişirse düşebilir. Ayar araçları: `tests/tools/search.test.ts` (RESCUE=1).
- Dikkatli bot kayıplarının çoğu geç oyunda Kalkan (Sol 14-15). Kalkan bakımı (3 sa, +2) pahalı; ileride Kalkan kazanımlarını artırıp tekrar ayarlamak gerekebilir.
- Motor içinde `pendingCommits` adında, her `step` başında sıfırlanan bir modül-içi değişken var (acil yedek iz sırası için). Dışarıdan saf; yeniden girişli (reentrant) değil.
- Kara Kutu'da "Hangi tek karar kurtarırdı?" eşzamanlı hesaplanır (~20 karar × 2-3 alternatif); yavaş cihazda kısa donma olabilir.
- Ertelenip yeniden açılan arızalar karar listesini uzatabilir (her gün bir kayıt).
- Sol raporunda etkisi sıfır olan ertelemeler de satır olarak görünür.
- Sayfa yenilenince oyun kaybolur (kayıt yok, bilinçli).
