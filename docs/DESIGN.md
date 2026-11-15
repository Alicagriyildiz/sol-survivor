# Sol Survivor — Tasarım

NASA Space Apps Challenge 2026, "Build a Junior Astronaut Mission Trainer". 7-12 yaş.
Tek astronot, Mars üssü, 15 sol. Sol 15'te ikmal aracı iner; o günün sonunda Sağlık > 0 ise görev kazanılır.

## 1. Oyun kuralları

### Göstergeler
| Gösterge | Aralık | Not |
|---|---|---|
| Güç (`power`) | 0-100 | Elektrik. |
| Yaşam Desteği (`life`) | 0-100 | Hava + su + gıda tek gösterge. |
| Kalkan (`shield`) | 0-100 | Radyasyon korunması. |
| Sağlık (`health`) | 0-100 | 0 olursa görev biter. |
| Doz (`dose`) | 0-∞ | Birikimli radyasyon; sadece artar. Puanı düşürür. Sağlığa etkisi radyasyon olayları üzerinden. |
| Mesai (`hoursLeft`) | 10 sa/sol | Her iş ve yürüyüş saat harcar. |

### Sol akışı
1. **Sabah**: mesai 10 saate döner, astronot ana üste döner; sol'ün sabah olayı (`morning`), sabaha planlanmış gecikmeli etkiler, sonra arızalar açılır (önceki günden ertelenip "yeniden açılan" arızalar + bugünün arızaları; varyantlar `when` koşuluyla seçilir).
2. **Gün**: oyuncu istasyon seçer, bir arıza seçeneği (`resolve`) ya da bakım işi (`routine`) yapar. Maliyet = yürüme + (EVA ise giyinme) + iş saati.
3. **Günü bitir** (`endSol`): açık kalan arızalar kendiliğinden ertelenir (ertele seçeneği uygulanır, `auto: true`), kalan gündüz saatleri geçer (kritik hasar), sonra **gece**.
4. **Gece** sırası: sol'ün gece olayı → geceye planlanmış gecikmeli etkiler → süreli değiştiriciler (modifier) → temel tüketim (+ düşük güçte yaşam desteği cezası, arka plan radyasyonu) → 14 gece saati için kritik hasar → tüm kaynaklar ≥ "rahat" eşiğindeyse iyileşme.
5. **Rapor**: o gecenin olayları + "gerçekte ne oldu" notu ve kaynak adı.
6. Sol 15 son gündür: `endSol` gece işlemez, sonucu belirler.

### Kritik hasar (Sağlık saat saat azalır)
Kaynak `critical` (25) altındaysa her saat: `maxDamagePerHour × (25 − değer) / 25`. Kaynak 0'da bile anında kayıp yok; Sağlık hızlı düşer. Oyuncuya sade bir cümleyle söylenir (`tr.critical`).
Her Sağlık kaybı üç nedenden birine yazılır (güç = soğuk/karanlık, yaşam = hava/su/gıda, kalkan = radyasyon). Kayıp nedeni = görev boyunca en çok Sağlık götüren neden.

### Acil yedek (toparlama şansı)
Her kaynak için **bir kez**: kaynak ilk kez 10'un altına düşünce +35 eklenir ve oyuncuya söylenir. Çocuk hatasını görür ve toparlanma şansı bulur. (Denge için kritik: bkz. §6.)

### Radyasyon
`radiation(x)` etkisi: alınan = `x × (1 − 0.7 × Kalkan/100)`; doz += alınan; Sağlık −= alınan × 0.6 (neden: kalkan). Her gece arka plan radyasyonu 2. EVA her dışarı çıkışta 3.

### Yürüme, EVA, kilitler
- İstasyon yürüme süreleri (ana koridordan): Ana üs 0, Sera 0.5, Sığınak 0.5, Batarya 0.5, Hava kilidi 0, Güneş paneli (EVA) 1, İniş alanı (EVA) 1.
- A'dan B'ye yürüme = `walk(A) + walk(B)` (hep koridor üzerinden). Aynı yerdeysen 0.
- İçeriden bir EVA istasyonuna girerken: +1 sa giyinme, Yaşam −3, radyasyon 3. EVA istasyonları arasında tekrar ödenmez.
- Güneş paneli alanı fırtınada (`storm` bayrağı) kilitli. İniş alanı Sol 13'ten önce ve fırtınada kilitli.
- Ertele seçeneği yürümez, saat harcamaz.

### Bakım işleri (rutinler)
Her kaynak için bir iş, her biri sol başına bir kez: Sera "Bitkilere bak" (Yaşam +2, Güç −1, 2 sa), Batarya "Bataryaları ayarla" (Güç +2, 2 sa), Sığınak "Regolit torbası diz" (Kalkan +2, 3 sa). Boş mesainin karşılığı budur.

### Envanter
Yama kiti 1, yedek filtre 1, bant 2 (`MissionConfig.inventory`). Harcanan parça geri gelmez.

### Tohum ve tekrar oynanabilirlik
Tüm rastgelelik `init` anında, tohumdan (mulberry32) çekilen **zarlarla** yapılır (`rolls`). Sonrası tamamen deterministiktir; aynı tohum + aynı eylemler = bit bit aynı durum. Zarlar: Sol 2 varyantı (pompa/filtre), toz seviyesi (0-2), Sol 5 oksijen açığı (0-2), fırtına darbesi (0-5), fırtına süresi (1-4 gece), rüzgar panelleri temizler mi (0/1), güneş olayı büyüklüğü (0-3), Sol 13 sızıntı yeri (hava kilidi/sera) ve büyüklüğü (0-2), Sol 14 varyantı (pompa/radyatör).

### Seviyeler (sunum katmanı; çekirdek aynı)
- `junior` (varsayılan): 3 kaynak çubuğu + Sağlık, durum ışığı + simge + kelime ("İyi/Azalıyor/Tehlike/Bitti"), seçeneklerde "neden" metni, yatırım/sonra-pahalı ipucu etiketleri, anlık etki okları (▲▼).
- `commander`: sayılar ve doz görünür, anlık etki sayıyla, ipucu etiketleri yok.

## 2. Mimari
- `src/sim/` saf çekirdek: `createEngine(content)` → `init(seed, config)`, `check`, `step(state, action)`, `validActions`, maliyetler. React/DOM/Date/Math.random yok. `step` girdiyi değiştirmez (testle doğrulanır).
- `src/sim/selectors.ts`: sunum katmanlarının okuduğu türetilmiş görünümler (durum ışığı, seçenek görünümü + anlık etki önizlemesi, istasyon listesi, sol raporu, puan). 3D katman da bunları kullanmalı.
- `src/content/`: `scenario.ts` (ham veri), `tuning.ts` (seçenek türüne göre maliyet çarpanları, rutin kazancı), `config.ts` (MissionConfig), `lang/tr.ts` (tüm metinler), `sources.ts`.
- Eylemler: `{type:'resolve', faultId, optionId}`, `{type:'routine', routineId}`, `{type:'endSol'}`.
- Her etki `trace` kaydına düşer: `key` (iki gidişatı eşlemek için), `source`, `deltas`, `causes` (bu etkiyi doğuran karar anahtarları `s{sol}:{faultId}`). Bayraklar, gecikmeli etkiler ve değiştiriciler kendilerini doğuran kararın anahtarını taşır; `if` koşulu okuduğu bayrağın kökenini sebeplere ekler.

## 3. 15 sol özeti ve karar zincirleri

| Sol | Olay (dayanak) | Seçenekler (hızlı / sağlam / yaratıcı / ertele) |
|---|---|---|
| 1 | İlk kontrol (öğretici) | Üssü uyandır: tek tek / hepsi birden / ertele. Hava kilidi contası: yeni conta / silip geç (2 gün sonra kayıp) / ertele (her gece sızıntı, yeniden açılır). Kayıp imkansız. |
| 2 | Su geri kazanım (ISS) — varyant: pompa veya filtre | Sağlam bakım → `recyclerServiced`; hızlı → 3-4 gün sonra su kaybı; ertele → her gece su kaybı, yeniden açılır. Filtre varyantında yaratıcı "ters yıkama" (Güç yerine su harcar). |
| 3 | Perklorat (Phoenix 2008) | Toprağı yıka (su+güç, bahçe her gece Yaşam verir) / topraksız tepsi (pompa her gece Güç yer, daha iyi bahçe) / dayanıklı bitkiler (az ürün) / ertele (2 gün sonra yiyecek açığı). `soilClean`. |
| 4 | Panelde toz (InSight) | EVA ile fırçala / kum dök numarası (az toz kalır, `panelsTilted`) / ışıkları kıs / ertele (toz fırtınaya kadar kalır). |
| 5 | Oksijen üreteci (MOXIE) | Tam güç (çok Güç, çok Yaşam) / gece yarı güç / bitkilere güven (toprak temizse iyi) / ertele. |
| 6 | Sığınağı güçlendir | Regolit (5 sa, `shelterReinforced`) / su bidonları (`shelterWater`) / ertele (duvar çatlar). |
| 7 | Gecikmeli Dünya talimatı | Talimata uy (`beaconReserve`) / kendi kararın (Yaşam'ı koru) / yarısını uygula + rapor (`sentReport`) / ertele (ertesi sabah 2 sa mesai kaybı). |
| 8 | Fırtına uyarısı (2018) | Bataryaları tam doldur (`stormPrepped`) / yarısı / ertele. Panelleri sabitle EVA (`panelsSecured`) / kabloları içeri al (`panelsHalf`) / ertele. Gece fırtına başlar. |
| 9 | Fırtına, güç çöküşü (Opportunity) | Sabah: darbe (hazırlıklıysa küçük), 1-4 gece fırtına tüketimi, EVA kilitli. Yük atma: sera lambaları (bahçe ölür) / ısıtıcıyı kıs (Sağlık) / sığınak ısıtıcısı (Kalkan) / hiçbirini kapatma (gece Güç gider). |
| 10 | CO2 filtresi uymuyor (Apollo 13) | Yuvayı yeniden yap (yedek filtre) / bant+torba (2 bant) / silkele (ertesi gece yine dolar) / ertele (yeniden açılır). |
| 11 | Fırtına sonrası paneller | EVA fırçala / yarısını temizle / rüzgarı bekle (kumar: `windCleans` zarı ya da `panelsTilted` → ertesi sabah temizlenir). |
| 12 | Güneş parçacık olayı (Curiosity RAD, Eylül 2017) | Sığınakta kal 6 sa / kısa kal 3 sa / su bidonlu köşe / çalışmaya devam. Alınan radyasyon `shelterReinforced` > `shelterWater` > hiçbiri. |
| 13 | Mikro sızıntı (ISS 2020 çay yaprakları; Soyuz 2018) — varyant: hava kilidi/sera, 3 boy | Yama kiti / çay yaprağı + bant / bölmeyi kapat / ertele (yeniden açılır). İniş alanı (yeni açıldı): kayaları temizle EVA (`padClear`) / işaret koy (`padMarked`) / ertele. |
| 14 | Soğutma arızası (ISS amonyak pompaları) — varyant: pompa/radyatör | Değiştir/temizle / su ünitesinin pompasını ödünç al (sadece `recyclerServiced`) / bataryaların yarısını kapat / ertele. Sabah: su ünitesi bakımsızsa ek Yaşam kaybı. "Pompayı ödünç al" ve "yarısını kapat" her iki varyantta da içeride, Batarya istasyonunda yapılır (radyatör varyantında da EVA gerekmez). |
| 15 | İkmal inişi | Fener tam güç (`beaconReserve` varsa ucuz) / kısık fener (`sentReport` ya da `padClear` varsa yakına iner) / EVA ile yansıtıcı / feneri yakma (çok uzağa iner). |

**Zorunlu zincirler** (hepsi kurulu):
- 2 → 14: `recyclerServiced` → Sol 14'te "pompayı ödünç al" açılır; yoksa Sol 14 sabahı ek Yaşam kaybı.
- 4 → 11: `panelsTilted` → Sol 11'de "rüzgarı bekle" kesin işe yarar.
- 6 → 12: `shelterReinforced`/`shelterWater` → güneş olayında çok daha az radyasyon.
- 8 → 9: `stormPrepped` → fırtına darbesi küçük; `panelsSecured`/`panelsHalf` → Sol 11 tozu az.
- 10 → 13: bant envanteri — Apollo çözümü iki bandı da harcar, Sol 13'te çay yaprağı + bant seçeneği kalmaz.
- 7 → 15: `beaconReserve` (fener ucuz) ya da `sentReport` (araç yakına iner).
- Ek: 3 → 5 (`soilClean` → bitki oksijeni), 13 → 15 (`padClear`/`padMarked`).

Her seçenekte çocuk dilinde "neden" metni var (`tr.faults[*].options[*].why`): hangi gösterge neden değişir. Doğru/yanlış denmez.

## 4. Kara Kutu algoritması (`src/blackbox/`)
- **Kayıt**: oyunun tüm eylemleri `MissionLog {seed, config, actions}`. `replay` aynı durumu bit bit üretir (testli).
- **Karar listesi**: `state.decisions` — her (sol, arıza) için bir kayıt; açık bırakılıp otomatik ertelenenler `auto: true`.
- **Alternatifler**: kararın verildiği andaki durumda (orijinal gidişat) her seçenek kontrol edilir; o an yapılamayanlar (saat/parça/koşul/kilit) gerekçesiyle gösterilir ve seçilemez.
- **`counterfactual(log, i, alt)`**: açık karar ise o eylemin seçeneği değiştirilir; otomatik ertelenmiş karar ise o solün `endSol` eyleminin hemen önüne `resolve` eklenir. Sonra eylemler **hoşgörülü yeniden oynatma** ile uygulanır.
- **Geri düşme kuralı** (belgelenmiş):
  1. Eylemler sırayla oynatılır.
  2. Yeni gidişatta geçersiz hale gelen eylem (arıza açık değil, mesai yetmiyor, parça yok, istasyon kilitli...) **atlanır**; o arıza açık kalır ve gün sonunda kendiliğinden ertelenir (oyuncu hiçbir şey yapmamış gibi). Atlananlar listelenir ve arayüzde not düşülür.
  3. Görev daha erken biterse kalan eylemler düşer.
  4. Kayıt görev bitmeden tükenirse (orijinal görev daha erken bitmişti), kalan solleri **otomatik pilot** (dikkatli bot) oynar; arayüz bunu açıkça söyler ("Sol X'ten sonrasını otomatik pilot oynadı").
- **Açıklama (`explain`)**: iki gidişatın izleri karşılaştırılır: (a) değişen karar ve anlık fark, (b) sonraki etkilerden **sebepleri arasında değişen kararın anahtarı bulunanlar** `key` ile eşlenip farkı en büyük 3 tanesi (ör. Sol 12 güneş olayı kararı, `shelterReinforced` bayrağının kökeni Sol 6), (c) kritik seviyede geçen sürenin Sağlık'a farkı (kaynak başına), (d) sonuç. Ayrıca iki eğrinin ilk ayrıldığı sol ve çizim için sol başı eğriler döner. `text.ts` bunları Türkçe cümlelere çevirir.
- **`findRescues(log)`**: her karar × her geçerli alternatif için counterfactual; sonucu çeviren (kayıp→kazanç veya kazanç→kayıp) değişiklikleri döner. Boşsa arayüz dürüstçe "Tek karar yetmezdi." der.

## 5. Botlar (`src/bots/bots.ts`)
- **random**: her arızada geçerli seçeneklerden rastgele birini seçer; boş saatlerde rastgele bakım işi yapar; her adımda %15 olasılıkla günü erken bitirir (tıklayan bir çocuk gibi).
- **cheapest**: her arızada anlık maliyeti (saat + kaynak kaybı + parça) en düşük seçeneği seçer (çoğu zaman ertele); boş saatte en zayıf kaynağın bakımını yapar.
- **robust**: her zaman "sağlam" türü seçer (yoksa yaratıcı, hızlı, ertele sırasıyla); boş saatte en zayıf kaynağın bakımı.
- **careful**: arayüzün junior oyuncuya gösterdiğini okur: seçeneğin **anlık** etkisi + mesai + ipucu etiketleri (yatırım +, sonra-pahalı −). Gizli bilgiyi (zarlar, gecikmeli etkilerin sayısı) görmez. Boş saatte en zayıf kaynağın bakımı. Kara Kutu otomatik pilotu da budur.

## 6. Denge ve ayar
Denge botlarla ölçülür (`tests/balance.test.ts`, 1-200 tohum). Ayar düğmeleri: `content/config.ts` (gece tüketimi, kritik hasar hızı, iyileşme, acil yedek) ve `content/tuning.ts` (seçenek türüne göre maliyet çarpanı: ertele 0.5, hızlı 0.7, sağlam 1.2, yaratıcı 1; rutin kazancı 0.5). Radyasyon fiziksel olay sayılır, çarpanla ölçeklenmez. Arama araçları: `tests/tools/search.test.ts`, `tests/tools/trace.test.ts` (ortam değişkeni yoksa hiçbir şey yapmaz).

Ayar sırasında öğrenilenler (sonraki oturum için):
- Dikkatli botun sonucu tohuma çok az bağlıydı; tek düğme (ör. gece tüketimi −6 → −7) onu %99'dan %6'ya atıyordu. Şans payını büyütmek için zar aralıkları genişletildi.
- 5 rutin varken (dinlen, EVA ile fırçala dahil) rastgele botun bakım işlerinin çoğu boşa gidiyordu; rutinler kaynak başına bire indirildi.
- Rastgele bot ile dikkatli bot arasındaki uçurumu kapatan asıl mekanik **acil yedek** oldu.
- Kurtarma oranını en çok "rahat" eşiği (gece iyileşmesi için) etkiledi: tek bir kaynağı eşiğin üstüne çıkaran tek karar her gece iyileşmeyi açıyor.

## 6b. Arayüz kuralları (Oturum 2, oyun testinden sonra)
- **Görev satırı** (`selectors.mission`): açık sorun varsa, bugün sağlam/hızlı/yaratıcı bir seçeneği mesaiye sığan sorunlardan, oyuncunun bulunduğu istasyondaki önce, yoksa listedeki ilk sorun gösterilir. Hiçbiri sığmıyorsa "mesain yetmiyor, günü bitirirsen ertelenir". Sorun yoksa "işin bitti" ve bakım yapılabilir mi bilgisi.
- **Sol 1 öğretici kuralları sunum katmanındadır**: Sol 1'de erteleme seçenekleri gösterilmez; bakım işleri ve "Günü bitir" iki sorun çözülene kadar kapalıdır. İçerik ve motor değişmedi (her arızanın hâlâ bir ertele seçeneği var; botlar Sol 1'de erteleyebilir, Kara Kutu alternatif olarak gösterebilir). Gerekçe: botlar, testler ve gün sonu otomatik ertelemesi bozulmadan öğretici zorlanır. Kilitlenme olmaz: iki Sol 1 sorununun en uzun çözümü 5 sa.
- Öğretici varsayılan açıktır, başlangıç ekranında kapatılabilir, her adımda "Öğreticiyi kapat" vardır. Bekleyen adımlar oyuncunun eylemiyle ilerler.
- **Zincir notları** içerikte veridir: `SolDef.notes` (brifingde, sabah durumuna göre) ve `OptionDef.notes` (seçenek kartında ve seçimden sonra). Çekirdek notları okumaz; seçiciler `engine.evalCond` ile değerlendirir. Metinler `tr.chain`. Olumsuz durumlar da not olarak yazılır (bayrak hiç kurulmadıysa izde köken yoktur, o yüzden açık not gerekir). Bunun için koşul diline genel bir `{ not: Cond }` eklendi.
- **Önizleme** (`selectors.previewParts`) seçeneğin kendi etkisini gösterir; acil yedek (tetiklenecek kaynak listesi), kritik saatlerin Sağlık kaybı ve "başka bir sorunu bugün tamamen çözülemez yapar" uyarısı ayrı döner. Ham durum farkı yedeği iyi etki gibi gösterdiği için artık kullanılmıyor.
- **Sol raporu** (`selectors.solReportRows`): Gündüz / Gece / Sabah bölümleri, iz anahtarına göre birleştirilir, etkisi olmayan satırlar düşer (karar satırları kalır). Her satırın nedeni: kaynak türüne göre sabit bir cümle, ya da izdeki `causes` alanından "Bunu Sol N'de seçtiğin … etkiledi".
- **Mesai dökümü** (`selectors.hoursLog`) izden yeniden kurulur: her eylemin yürüme + giyinme + iş saati, sabah olaylarının yediği saat.
- İstasyon kartındaki yürüme süresi bulunduğun yerden gerçek süredir (`walk(A) + walk(B)`).
- **Kara Kutu listesi**: aynı arızanın sonraki günlerdeki (yeniden açılıp tekrar ertelenen) kararları gizlenir, ilk karar "N gün üst üste ertelendi" notuyla gösterilir. Gizlenenler değiştirilemez; ilkini değiştirmek zinciri değiştirir.

## 7. Varsayımlar
- Sol = 10 saat mesai + kritik hasar için 14 gece saati. Mars gününün tam uzunluğu modellenmedi.
- Yürüme hep ana koridor üzerinden: `walk(A) + walk(B)`.
- EVA ek maliyeti içeriden dış istasyona her girişte bir kez: +1 sa, Yaşam −3, radyasyon 3.
- Bazı ertelenen arızalar ertesi sabah yeniden açılır (conta, su ünitesi, CO2, sızıntı, soğutma); diğerleri ertelenince fırsat kaçmış sayılır.
- Gün sonunda açık kalan arızalar kendiliğinden ertelenir; bu da Kara Kutu'da bir karar olarak görünür.
- Görev Sol 15'in gün sonunda biter; son gece işlenmez.
- Kayıp nedeni = görev boyunca en çok Sağlık götüren kaynak. Soğuk → Güç, radyasyon → Kalkan.
- Doz birimi soyut (gerçek mSv değeri kullanılmadı, uydurmamak için). Dozun ölümcül eşiği yok; puanı düşürür.
- Dünya-Mars gecikmesi sayıyla simüle edilmedi; Sol 7 talimatı hikâyede "durum değişti" olarak işlenir.
- "Dinlen" ve "EVA ile panel fırçala" bakım işleri denge için çıkarıldı (bkz. §6).
- Acil yedek: kaynak başına bir kez, 10'un altına inince +35. Gece iyileşmesi: tüm kaynaklar ≥ 20 ise +4.
- Rastgele bot tanımı §5'teki gibidir (%15 erken bitirme dahil); hedefler bu tanıma göre ölçüldü.
- Kara Kutu'da alternatif, ancak orijinal gidişatta o an yapılabilir idiyse seçilebilir.
- Otomatik pilot, kayıt bittikten sonra dikkatli bottur. Kurtarma oranı ayrıca "kayıt bitince astronot hiçbir şey yapmaz" kuralıyla da ölçülüp raporlanır.
- Arayüzde rastgele görev numarası `Math.random` ile seçilir (yalnız arayüz; çekirdek değil).
- Puan = kazanırsa 1000 + Sağlık×5 + kaynak toplamı − doz×2 + sol×20 (sadece gösterim).
- Tüm metinler şimdilik yalnızca Türkçe (`lang/tr.ts`); İngilizce aynı şekille eklenebilir.
