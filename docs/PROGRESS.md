# İlerleme

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
