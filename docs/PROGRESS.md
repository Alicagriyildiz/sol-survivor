# İlerleme

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
