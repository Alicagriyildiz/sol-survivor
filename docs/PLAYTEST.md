# Oyun testi — Oturum 2 (2026-11-15)

Oyun gerçek arayüzden, headless Chrome ile tıklatılarak oynandı (Chrome DevTools protokolü; tıklamalar gerçek DOM düğmelerine gidiyor, simülasyon API'si kullanılmadı). Ekran görüntüleri depoya konmadı.

| Oyun | Kim | Ayar | Sonuç |
|---|---|---|---|
| (a) | Her metni okuyan dikkatli oyuncu: hep "sağlam" ya da yatırım seçenekleri, boş saatte bakım | Genç Astronot, 1280 px, görev no 7 | Kazandı, ama Sağlık 3, Yaşam Desteği 1. Sol 8'den sonra hep bir gösterge kırmızıdaydı. |
| (b) | Metin okumayan 8 yaşında çocuk: görünen her şeye rastgele tıklar (büyük düğmelere biraz daha sık) | Genç Astronot, 390 px (telefon), görev no 7, 5 farklı tıklama zarı | Bkz. §5 (önce/sonra) |
| (c) | Bilerek kötü oynayan: her günü hemen bitirir, sonra Kara Kutu | Genç Astronot, 1280 px, görev no 7 | Sol 12'de kaybetti (Yaşam Desteği). Kara Kutu: "Tek karar yetmezdi." |
| — | Komutan seviyesi kısa tur (Sol 1-2) | 1280 px | Sayılar doğru; seviyeye özgü yeni sorun yok, aşağıdakiler ortak. |

Önem: **D** = oyunu durduruyor, **K** = kafa karıştırıyor, **k** = küçük.

## 1. Bulgular ve yapılanlar

| # | Ekran | Ne oldu | Neden sorun | Önem | Yapılan |
|---|---|---|---|---|---|
| 1 | Oyun ekranı (her sol, en çok Sol 2) | Sorunlar çözülünce ya da hiç bakılmayınca ekran ne yapılacağını söylemiyor. Yan kartta sadece sorun listesi var; sorun yokken o da kayboluyor. "Günü bitir" açık sorun varken de en parlak düğme. | Sahibinin Sol 2'de takıldığı yer. Çocuk ya rastgele tıklar ya da en parlak düğmeye basıp günü kapatır. | D | Her zaman görünen **Görev satırı** (üstte, dar ekranda istasyonların üstünde): "Seraya git: Toprakta perklorat" + istasyonu açan düğme; buradaysan "Buradasın (…): … İstasyona tıkla ve bir çözüm seç"; mesai yetmiyorsa bunu söyler. Sorunlar bitince "Bugünlük işin bitti. Kalan saatinle bakım yapabilir ya da günü bitirebilirsin." ve **Günü bitir** vurgulanır (nabız efekti). Açık sorun varken Günü bitir sönük. |
| 2 | İstasyon paneli | Sorunsuz istasyonda sadece "Burada sorun yok." Ana üs ve Hava kilidinde bakım işi de yok → boş panel. | Çıkmaz sokak; çocuk sorunun nerede olduğunu bilmiyor. | D | Panel artık: "✓ Burada bugün sorun yok" + **sorunların olduğu istasyonlara düğmeler**; bakım işi saatiyle ve etkisiyle; bakım işi yoksa "Burada yapılacak bakım işi yok"; "Bakmak bedava, iş seçersen yazılan saat harcanır." |
| 3 | Sol 1 | "Sonra hallederim"/"Ertele" ile hiçbir şey öğrenmeden geçilebiliyor; hiçbir yönlendirme yok. | Öğretici olması gereken gün hiçbir şey öğretmiyor. | D | **Öğretici** (başlangıçta varsayılan açık, her adımda "Öğreticiyi kapat"): 1) çubuklar ne demek, 2) sol ve 10 saatlik mesai, 3) Ana üs'e tıkla (kart vurgulu), 4) seçenek kartını okuma (⏱ ve oklar), 5) "Son yaptığın" kutusu + Hava kilidine git (yürüme saat harcar), 6) sorunlar bitti: bakım ya da günü bitir. Sol 1'de **erteleme seçenekleri gösterilmez**; bakım işi ve Günü bitir iki sorun çözülene kadar kapalı ("Sol 1'de önce iki sorunu da çöz"). Kilitlenme olmaz: iki sorun her durumda 10 saate sığar. |
| 4 | Seçenek seçince | "Bunu yap" sonrası panel açık kalıyor ve "Burada sorun yok" diyor. Genç seviyede çubuklar "İyi" yazısından değişmediği için ne olduğu görünmüyor. | Tıklanan şeyin ne yaptığı görülmüyor. | K | Panel kapanır; **"Son yaptığın" kartı** (ne yapıldı, kaç saat sürdü, hangi gösterge ne yönde, zincir notu, acil yedek). Çubuk başlıklarının yanında son eylemin okları (Komutan'da sayı) bir sonraki eyleme kadar kalır. |
| 5 | Üst çubuk / istasyon kartları | Saatlerin nereye gittiği görünmüyor. Kartlardaki yürüme süresi hep ana koridordan yazılıyor (Seradayken Batarya "0,5 sa" görünüyor, gerçekte 1 sa). | "7,5 saat nereye gitti?" sorusunun cevabı yok; kart yanlış bilgi veriyor. | K | 10 hücreli **mesai şeridi** + "7,5 / 10 sa"; Görev satırında açılır **"Saatler nereye gitti?"** dökümü (her iş: yürüme + giyinme + iş). Kartlar bulunduğun yerden gerçek yürüme süresini yazar; seçenek kartı toplamı ve dökümü saat harcamadan önce gösterir. |
| 6 | Seçenek önizlemesi (Sol 9) | "Sera lambalarını kapat": Yaşam Desteği **▲▲▲** gösteriyor; seçenek aslında Yaşam'ı düşürüyor, ama düşüş acil yedeği tetikliyor ve +35 önizlemeye karışıyor. | Önizleme yalan söylüyor; dikkatli oyuncu bitkileri öldürmeyi "iyi" sanıyor ve tek seferlik yedeği farkında olmadan harcıyor. | K | Önizleme artık seçeneğin **kendi** etkisini gösterir (yedek ve kritik saat hariç). Ayrı satır: "🔋 Acil yedek devreye girer: Yaşam Desteği. Bu yedek bir kez kullanılır!" (`previewParts` seçicisi, testli). |
| 7 | Bakım işi / seçenekler | Gösterge kırmızıyken her işte açıklamasız "Sağlık ▼" görünüyor. | Çocuk bitkilere bakmanın neden Sağlık götürdüğünü anlamıyor. | K | Ayrı satır: "Kırmızıdaki göstergeler yüzünden bu saatlerde Sağlık da azalır." |
| 8 | Sol sonu raporu | Sadece oklar. Gündüz yapılanlar yok; "Gece tüketimi", "Sabah olayı" açıklamasız; etkisi sıfır erteleme satırları; gece iyileşmesi "Gece tüketimi" satırında Sağlık ▲ olarak; Sol 15'te gece yokken başlık "Gece neler oldu". | Kaynağın neden azaldığı söylenmiyor. | K | Rapor **☀ Gündüz / 🌙 Gece / 🌅 Sabah** bölümlerine ayrıldı; her satırda bir neden cümlesi ("Gece de ısıtıcılar Güç yer…", "Gün bittiğinde açıktı, kendiliğinden ertelendi. …", "Bunu Sol 3'te seçtiğin “Toprağı suyla yıka” etkiledi."). Sıfır satırlar yok (karar satırları hariç), iyileşme ayrı satır, Sol 5 sabah olayının adı var, son gün "Son gün: gece yok". |
| 9 | Zincirler | Sol 11 rüzgar (Sol 4), Sol 12 sığınak (Sol 6), Sol 14 pompa (Sol 2), Sol 9 fırtına darbesi (Sol 8), Sol 15 fener (Sol 7, 13), Sol 5 bitkiler (Sol 3) sessizce işliyor. | Sessiz zincir öğretmez. | K | **Zincir notları** (içerikte veri, `notes`): brifingde "🔗 Geçmiş kararların bugün" ("Sol 6'da sığınağı regolitle güçlendirdin: sığınak seni çok iyi korur."), ilgili seçenek kartında ve seçimden sonra "Son yaptığın" kartında. Olumsuz durumlar da söylenir ("Sol 8'de bataryalar tam dolmadı: fırtına darbesi sert oldu."). Raporda gecikmeli etkiler kararı adıyla anar. |
| 10 | Acil yedek | Sadece o günün uyarı şeridinde; görev sonunda ve Kara Kutu'da hiç yok. | Çocuk ikinci şansı kullandığını bilmiyor. | K | O an: "Son yaptığın" kartında kalın uyarı + uyarı şeridi; raporda vurgulu 🔋 satırı; görev sonunda "Acil yedek kullanıldı: Yaşam Desteği (Sol 9), …"; Kara Kutu'da iki gidişatın sonuç kartında ayrı ayrı. |
| 11 | Dar ekran (390 px) | Üst çubuk sabit değil: aşağı kaydırınca ya da panel açıkken mesai ve çubuklar görünmüyor. Sorun listesi ve Günü bitir 7 istasyon kartının altında. | Telefonda ne yapılacağı ve ne kadar saat kaldığı kayboluyor. | K | Dar ekranda da sabit, sıkı üst çubuk (2×2 çubuk + mesai şeridi). Görev satırı ve sorun listesi istasyonların üstünde. Yatay kaydırma yok (390 px'te ölçüldü). |
| 12 | Günü bitir onayı | "Açık sorunlar ertelenecek. Günü bitireyim mi?" + başlık listesi. Ne olacağı yazmıyor; kırmızı gösterge varken kalan saatlerin de geçeceği söylenmiyor. | Kötü sonuç sürpriz oluyor. | K | Her açık sorun için ertelemenin sonucu (seçeneğin "neden" metni), "Kalan 10 sa da geçecek. Kırmızıdaki göstergeler bu saatlerde Sağlık götürür.", son günde "Günü bitirince ikmal aracı iner ve görev biter." Düğmeler "Evet, günü bitir" / "Hayır, devam et". |
| 13 | Kara Kutu | 37 satırlık karar listesi (ertelenen conta her gün yeni satır). Otomatik pilot sadece küçük gri bir not. Sağ panel boşken yine "1. Bir karar seç" yazıyor. | Çocuk için fazla; değişen görevin bir kısmını kimin oynadığı belli değil. | K | Aynı arıza için tekrar eden ertelemeler tek satır ("11 gün üst üste ertelendi"; ilkini değiştirmek yeterli) → 37 satır 13'e indi. Otomatik pilot: değişen görevin sonuç kartında kalın satır ve grafikte "🤖 otomatik pilot" dikey çizgisi. Daha kısa giriş cümlesi, "← Soldaki listeden bir karar seç." |
| 14 | Brifing | Günün sorunları ve yerleri yok (sadece hava ve mesaj). Fırtınada EVA kilidi metinde yok (sadece Sol 9 havasında "dışarı çıkmak yasak"). | Brifing işe hazırlamıyor. | K | "🎯 Bugünün işleri" (sorun + istasyon + "dünden kaldı"), zincir notları, fırtına varken "Fırtına var: dışarıdaki (EVA) istasyonlar kilitli." (motorun kilit durumundan). |
| 15 | Sol 8 | Önce panellere (EVA) gidilirse "tam doldur" için saat kalmıyor; uyarı yok. | Sırayı bilmeyen oyuncu yatırımı farkında olmadan kaybediyor. | K | Görev satırı önce Batarya'ya yönlendirir. Bir seçenek başka bir sorunu bugün **tamamen** çözülemez yaparsa kartta "Dikkat: bunu yaparsan şu soruna bugün mesai kalmaz". Kısmen düzeltildi, bkz. §4. |
| 16 | Gösterge açıklamaları | Kalkan her gece azalıyor, nedeni hiçbir yerde yok. | "Duvar neden azalıyor?" | k | Kalkan açıklaması "Toz ve soğuk duvarları her gece biraz aşındırır." + gece raporu neden cümlesi. |
| 17 | Terimler | "Regolit" Sol 1'den beri sığınak bakım işinde açıklamasız; "radyasyon dozu" önizlemelerde açıklamasız; "karbondioksit" açıklamasız. | 8 yaş bu kelimeleri bilmiyor. | k | Bakım metni "Regolit, Mars'ın taşlı toprağı…"; EVA notu doz terimini açıklıyor; CO2 arızası "Nefes verdiğimiz karbondioksit…"; öğretici "sol"u ve göstergeleri açıklıyor. |
| 18 | Sol 2 havası | "Gece çok soğuk olacak" ama hiçbir etkisi yok. | Hikaye vaat edip tutmuyor. | k | "Açık ve sakin." |
| 19 | Sol 7 arızası | "Mesaj yazıldığında Yaşam Desteğin iyiydi" — oyuncunun durumu ne olursa olsun. | Yanlış olabilir. | k | "Bu mesaj dakikalar önce yazıldı. Dünya senin bugünkü durumunu bilmiyor…" |
| 20 | Sol 9-12 fırtına | Fırtına zarı 3-4 gece çıkınca, Sol 11 "Fırtına bitti" dedikten sonra da rapor "Toz fırtınası" tüketimi gösteriyor. | Hikaye çelişkisi. | K | Etiket "Havadaki fırtına tozu güneşi kısıyor" (fırtına sonrası havadaki toz gerçekten günlerce güneşi kısar). Sol 9 sabahındaki Kalkan kaybına neden eklendi ("savrulan kum duvarları aşındırdı"). |
| 21 | Sol 14 radyatör varyantı | "Su ünitesinin pompasıyla **içeriden** soğut" ve "Bataryaların yarısını kapat" EVA istiyordu (istasyon dışarıdaki radyatör). | Gerçekçi değil; saat ve EVA bedeli haksız. | K | Bu iki seçenek Batarya istasyonunda yapılır (her iki varyantta). Hava "Açık ve sıcak" → "Öğle güneşi bataryaları ısıtıyor". |
| 22 | Sol 13 hava kilidi sızıntısı | "Bölmeyi kapat" sonrası aynı kilitten EVA'ya çıkılabiliyor. | Küçük çelişki. | k | Sızıntı "hava kilidinin yanındaki depo bölmesinde"; seçenek "Depo bölmesini kapat, kullanma — dışarı çıkış kapısı çalışmaya devam eder". |
| 23 | Denge | Dikkatli oyuncu bile oyun sonunu Kalkan ya da Yaşam kırmızıda geçiriyor (botta kayıpların %89'u Kalkan). | İyi oyuncu için oyun tek göstergeye iniyor. | K | §4 (denge). |
| 24 | Görev sonu | Puan açıklamasız. | Çocuk puanı anlamıyor. | k | Tek cümle: "hayatta kalmak, Sağlık, dolu göstergeler ve az radyasyon dozu puan getirir". |

## 2. 15 sol denetimi

Sütunlar: **Süreklilik** (brifing, hava, Dünya mesajı, arıza birbirini tutuyor mu), **Zincir** (oyuncu görüyor mu; şimdi nasıl gösteriliyor), **Bedel** (her seçeneğin bedeli var mı; bariz en iyi / hiç seçilmeyecek seçenek — dikkatli bota tek bir seçenek zorlanarak ölçüldü, 100 görev), **Gerçekçilik**, **Mesai** (en uzun sağlam yol, yürüme dahil), **Dil**, **Not** ("Gerçekte ne oldu" ilgili mi).

| Sol | Süreklilik | Zincir (önce → şimdi) | Bedel / baskın seçenek | Gerçekçilik | Mesai | Dil | Not | Yapılan |
|---|---|---|---|---|---|---|---|---|
| 1 | Tutarlı: açık hava, mesaj "üssü uyandır" = arıza. | — (öğretici) | "Silip geç" 2 gün sonra bedel ödetir. Erteleme artık gösterilmiyor. | İyi. | 5 sa (iki sağlam çözüm), her durumda sığar | "Sol" ve göstergeler öğreticide | Sol uzunluğu: ilgili (öğretici gün) | Öğretici, Sol 1'de erteleme yok |
| 2 | Hava "Gece çok soğuk olacak" diyordu, etkisi yoktu. | 2→14 sessizdi → Sol 14 brifinginde ve "pompayı ödünç al" kartında (olumsuz hali dahil: "bu sabah su kaybettin"). | Pompa ve filtre varyantında her seçeneğin bedeli var. | İyi. | 4 sa | İyi | ISS su sistemi: ilgili | Hava metni |
| 3 | Tutarlı. | 3→5 sessizdi → Sol 5 brifinginde ve "bitkilere güven" kartında; gece raporunda "Sera bitkileri" satırı Sol 3 kararını anıyor. | **"Topraksız tepsi" baskındı** (zorla seçilince %100 kazanç). | Perklorat yıkama makul. | 4,5 sa | Perklorat açıklanıyor | Phoenix: ilgili | Denge (§3) |
| 4 | Tutarlı: tozlu gök, düşen güç. | 4→11 sessizdi → Sol 11 brifinginde ve "rüzgarı bekle" kartında ("kesin temizler"). | Dengeli. | Kum numarası gerçek olaydan. | 5 sa (EVA) | EVA panelde açıklanıyor | InSight: doğrudan ilgili | — |
| 5 | Sabahki oksijen açığı raporda adsızdı ("Sabah olayı"). | 3→5 görünür. | **Ertelemek en iyi seçenekti** (%87). | Oksijen üreteci çok elektrik yer: doğru. | 2 sa | İyi | MOXIE: ilgili | Olay adı; denge (§3) |
| 6 | "Güneş biraz hareketli" Sol 12'yi önceden haber veriyor: iyi. | 6→12 sessizdi → Sol 12 brifinginde ve sığınak kartlarında (ince duvar dahil). | Regolit iyi yatırım (%87), su bidonu orta, erteleme bedelli. | Regolit/su kalkanı araştırılıyor: doğru. | 5,5 sa | Regolit artık açıklanıyor | Araştırma notu, olay değil (not bunu doğru söylüyor) | — |
| 7 | Arıza metni oyuncunun durumundan bağımsız olarak "Yaşam Desteğin iyiydi" diyordu. | 7→15 sessizdi → Sol 15 brifinginde ve fener kartlarında. | "Kendi kararın" (%86) > "talimata uy" (%68): dersin kendisi bu (eski talimat). "Uy" yine de fener için değerli; bariz değil. | İyi. | 3 sa | İyi | Sinyal gecikmesi: ilgili | Metin |
| 8 | Tutarlı; fırtına gece başlıyor. | 8→9 (darbe) ve 8→11 (toz) sessizdi → Sol 9 ve Sol 11 brifinginde. | **Panelleri bağlamak (EVA) hiç karşılığını vermiyordu** (%62, ertele %73). | İyi. | Tam 10 sa, yalnız önce batarya yapılırsa; tersi sığmaz | İyi | 2018 fırtınası: ilgili | Görev satırı sırası; denge (§3) |
| 9 | Fırtına, EVA kilitli. Sabahki Kalkan kaybının nedeni yoktu. | 8→9 görünür. | Dengeli tercih (%52-83). Önizleme acil yedeği iyi etki gibi gösteriyordu (bulgu 6). | İyi. | 1,5 sa | İyi | Opportunity: ilgili | Önizleme; olay adı; "EVA kilitli" brifingde |
| 10 | "Fırtına sürüyor", EVA kilitli: uyumlu. | 10→13 (bant) sessizdi → Sol 13'te bant yoksa brifing ve çay yaprağı kartı söylüyor. | Ertele kötü ama bedeli açık (%25). Silkele (%78) ≥ adaptör (%74, 5 sa): sağlam çözüm pahalı, kabul edilebilir. | Apollo 13: doğrudan. | 5 sa | CO2 açıklandı | Apollo 13: ilgili | Metin |
| 11 | "Fırtına bitti" dendikten sonra da 3-4 gecelik zar çıkınca "Toz fırtınası" tüketimi sürüyordu. | 4→11 ve 8→11 görünür. | Fırçalamak en iyi (%94) ama 6 sa + EVA; kumar seçeneği bedelli. | Rüzgar temizlemesi gerçek. | 6 sa | İyi | Spirit/Opportunity: ilgili | Etiket "havadaki fırtına tozu" |
| 12 | Hava, mesaj, arıza uyumlu. | 6→12 görünür. | Dengeli (%46-83). | İyi. | 6,5 sa | Doz açıklandı | Eylül 2017 olayı: ilgili (ayrıntı doğrulanmalı) | — |
| 13 | "İniş alanına artık gidebilirsin" = kilit açılıyor: iyi. Hava kilidi sızıntısında "bölmeyi kapat" sonrası aynı kilitten EVA. | 13→15 sessizdi → Sol 15 brifinginde ve kartlarda. | **İniş alanını hazırlamak ertelemekten kötüydü** (%61-65, ertele %75). | Çay yaprağı yöntemi gerçek. | 8-9 sa | İyi | ISS 2020 / Soyuz 2018: ilgili | Depo bölmesi metni; denge (§3) |
| 14 | Hava "Açık ve sıcak" (Mars için yanıltıcı). Radyatör varyantında içeride yapılan iki iş EVA istiyordu. | 2→14 görünür. | Dengeli (%68-77). | Düzeltildi (Batarya istasyonu). | 5,5 sa | İyi | ISS amonyak pompaları: ilgili | İstasyon; hava metni |
| 15 | Uyumlu. | 7→15 ve 13→15 görünür; hiç hazırlık yoksa "iniş zor olacak". | Ertele %62, diğerleri %73-74. | Fener/yansıtıcı kurgu; not bunu gerçek gibi sunmuyor. | 5 sa | İyi | İniş: ilgili | Son gün onayı "görev biter" diyor |

Fırtına sollerinde EVA gerçekten kilitli (Sol 9-10, `storm` bayrağı; Güneş paneli ve İniş alanı). Metin bunu Sol 9 havasında söylüyordu; şimdi brifing her fırtına sabahında ayrıca söylüyor ve kilitli istasyon kartı/paneli "Toz fırtınası var, dışarı çıkılamaz" diyor.

Önceki sollere göndermeler: "Gerçekte ne oldu" notlarında ve metinlerde yanlış sol numarası bulunmadı. Zincir notlarındaki sol numaraları içerikteki karar sollerinden yazıldı ve testle her notun metni olduğu doğrulanıyor.

## 3. Seçenek dengesi ölçümü

Dikkatli bota tek bir seçenek zorlanarak (`OPTS='{}' N=100 npx vitest run tests/tools/trace.test.ts -t options`) kazanma oranı ve ortalama Sağlık farkı. 100 görevde ±5 puan gürültüdür (bir seçeneği zorlamak her iki yönde ~38 görevi çeviriyor).

| Seçenek | Önce | Sonra | Değişiklik (`src/content/scenario.ts`) |
|---|---|---|---|
| Sol 3 yıka / tepsi / dayanıklı / ertele | 90 / **100 (+12,5 Sağlık)** / 74 / 64 | 93 / 87 (+5,7) / 76 / 64 | Topraksız tepsi bahçesi her gece +2 → +1,5 Yaşam. Artık yıkamaya karşı bir takas: su harcamaz ama daha çok Güç ve 1 sa fazla. |
| Sol 5 tam güç / yarı / bitkiler / ertele | 72 / 74 / 76 / **87 (+7,4)** | 72 / 76 / 76 / 72 | Ertelemenin ertesi gece ikinci bedeli var ("Oksijen deposu yine azaldı", −5 Yaşam). |
| Sol 8 bağla / kablolar / ertele | 64 / 74 / 73 | 66 / 76 / 74 | Bağlanmış panellerde fırtına tozu gece −3 → −1 Güç. **Hâlâ karşılığını vermiyor** (§4). |
| Sol 12 sığınakta kal / kısa / su köşesi / çalışmaya devam | 81 / 83 / 75 / 46 | 83 / 85 / 75 / 57 | "Çalışmaya devam" radyasyonu ×1 → ×0,8 (kurtarma oranını geri kazanmak için; hâlâ en kötü seçenek). |
| Sol 13 temizle / işaret / ertele | 65 / 61 / 75 | 71 / 57 / 75 | Sol 15'te iniş alanı artık fenersiz ve kısık fenerli inişte de işe yarıyor (temiz alan en iyisi). Rapor gönderilmemiş durumda temizlemek kazandırıyor (81'e karşı 78, N=200). **İşaret koymak hâlâ kötü** (§4). |
| Sol 15 tam / kısık / yansıtıcı / yakma | 74 / 73 / 74 / 62 | 74 / 75 / 71 / 67 | Hazırlanmamış alanda yansıtıcı sermek ayrıca Sağlık götürür. Metinler buna göre güncellendi. |

Dokunulmayan, güçlü görünen seçenekler: Sol 11 fırçala (%94; 6 sa + EVA), Sol 6 regolit (%87), Sol 7 kendi kararın (%86; bkz. §4), Sol 8 tam doldur (%80). Hepsinin bugün belirgin bir bedeli var; durumdan bağımsız en iyi değiller.

### Bot sayıları (200 görev, `npm run balance`)

| Bot | Önce: kazanma, kayıp nedeni Güç / Yaşam / Kalkan | Sonra |
|---|---|---|
| Rastgele | %14,5 — 30,4 / 24,0 / 45,6 | %13,5 — 30,6 / 27,7 / 41,6 |
| En ucuz | %0 — 34 / 66 / 0 | %0 — 34 / 66 / 0 |
| Sağlam | %35,5 — 12,4 / 24 / 63,6 | %35,5 — 12,4 / 24 / 63,6 |
| Dikkatli | %73 — 11,1 / 0 / **88,9** | %74 — 11,5 / 0 / **88,5** |
| Tüm botlar | 25,6 / 36,8 / 37,5 | 25,8 / 38,1 / 36,1 |
| Tek kararla kurtarma | %50,3 (katı %43,3) | **%51,4** (katı %47,4) |

Tüm eski hedefler tutuyor. **Dikkatli botun kayıplarında Kalkan payını %70'in altına indirme hedefi tutmadı** (%88,5). Neden: Kalkan'ın acil yedeği 10'un altında devreye giriyor, ama Sağlık 25'in altında azalmaya başlıyor. Dikkatli bot her gün sığınağa regolit torbası dizerek (+2) Kalkan'ı 11-25 arasında tutuyor; yedek hiç tetiklenmiyor ve her saat Sağlık gidiyor. Kanıt: torba işini +1'e düşürmek dikkatli botu %83,5'e çıkarıyor. Kalkan payını düzelten her ayar (yedek eşiği 12-14, gece Kalkan tüketimi −4, torba +2,5/+3, iki rastgele arama, 270 ayar) kurtarma oranını %50'nin altına indirdi; hepsini aynı anda tutan tek ayar 6 düğmeyi birden değiştiriyordu ve sınırda kaldı (kurtarma %50,3), bu yüzden alınmadı. Gerçek çözüm bir kural değişikliği gerektiriyor (ör. acil yedek "kritik" eşiğinde devreye girsin); bu her şeyin yeniden ayarlanması demek, sunumdan önce yapılmadı.

## 4. Düzeltilmeyenler ve nedeni

| Konu | Neden düzeltilmedi / ne kadar düzeltildi |
|---|---|
| Sol 8 sıra tuzağı (önce paneller → tam şarj sığmaz) | Kısmen. Görev satırı önce Batarya'yı gösteriyor. "Bu soruna mesai kalmaz" uyarısı yalnızca bir sorun **tamamen** çözülemez olunca çıkıyor; burada "yarısına kadar doldur" hâlâ sığdığı için uyarı çıkmıyor. Her seçeneğin her sıralamasını uyarmak kartları kalabalıklaştırırdı. |
| Sol 1'de erteleme yok kuralı içerikte değil arayüzde | Bilinçli: içerikten kaldırmak motorun gün sonu otomatik ertelemesini, botları ve "her arızanın bir ertele seçeneği var" testini bozardı. Botlar Sol 1'de hâlâ erteleyebilir (Sol 1'de kayıp yok, hedef değişmedi). Kara Kutu Sol 1 kararında erteleyi alternatif olarak gösterebilir. DESIGN.md §6b. |
| "Kendi kararın" (Sol 7) "talimata uy"dan iyi | Bilinçli: Sol 7'nin dersi eski talimatın duruma uymayabileceği. "Uy" Sol 15'te fener zincirini açıyor; her durumda en iyi değil. |
| Sol 10'da silkele ≥ yuvayı yeniden yap | Kabul: 5 saatlik sağlam çözüm bu ölçümde (o saatleri bakım işine harcayan bot) hafif geride; durumuna göre değişiyor (yedek filtre yoksa yapılamaz, Yaşam kırmızıysa daha iyi). |
| Tamamen erteleyen oyuncuya Kara Kutu "Tek karar yetmezdi" diyor | Dürüst sonuç; değiştirilmedi. Kurtarma ölçümü rastgele bota göre yapılıyor (§ denge). |
| "Hangi tek karar kurtarırdı?" eşzamanlı hesap | Değiştirilmedi (PROGRESS bilinen risk). 13-20 karar × 2-3 alternatif; masaüstünde < 1 sn. |
| Genç seviyede çubuklarda sayı yok | Tasarım gereği (DESIGN §1). Değişimi görünür kılmak için çubuk başlığına son eylemin okları ve "Son yaptığın" kartı eklendi. |
| Gizlenen tekrar ertelemeler Kara Kutu'da tek tek değiştirilemiyor | Bilinçli sadeleştirme: ilk ertelemeyi değiştirmek zinciri değiştiriyor. |
| Görev satırı hangi seçeneği seçeceğini söylemiyor | Bilinçli: seçim oyunun kendisi. Satır sadece **nereye** gideceğini ve **neyle** uğraşacağını söyler. |
| Dikkatli botta Kalkan payı < %70 | Tutmadı (%88,5); kurtarma hedefini bozmadan içerik sayılarıyla yapılamadı. Ayrıntı §3. |
| Sol 8 "panelleri bağla" ve Sol 13 "işaret koy" hâlâ karşılığını vermiyor | Daha güçlü ödüller kurtarma oranını %50'nin altına itti. Metin dürüst (bedeli yazıyor); sonraki denge turunda. |
| İngilizce metin, 3D sahne | Bu oturumun kapsamı dışında. |

## 5. Önce / sonra: (b) okumayan 8 yaşında çocuk, dar ekran

Aynı görev (no 7), Genç seviye, 390 px, aynı 5 tıklama zarı (3, 4, 5, 6, 8). "Önce" = oturum başındaki sürüm (`git archive HEAD`, ayrı portta), "sonra" = son sürüm (arayüz + kurgu + denge). Çocuk metin okumaz; görünen tıklanabilir şeylerden birini rastgele seçer, büyük/vurgulu düğmeleri biraz daha sık.

| Ölçü (5 koşu toplamı) | Önce | Sonra |
|---|---|---|
| Açık sorun bırakılarak bitirilen gün | 25 / 64 gün (%39) | **10 / 65 gün (%15)** |
| Gün sonunda kendiliğinden ertelenen sorun | 28 | **11** |
| Sol 1'i hiçbir şey çözmeden geçme | mümkün (ertele) | **mümkün değil** (öğretici, iki sorun çözülmeden gün bitmez) |
| Sol 1 tıklaması (ortalama) | 29 | 18 |
| "Sorunlar şurada" düğmesiyle sorunsuz panelden sorunlu istasyona geçiş | — (düğme yoktu, panel çıkmaz sokaktı) | 58 kez |
| Görev satırı düğmesiyle istasyona gitme | — | 13 kez |
| Ölünen sol (ortalama) | 12,8 | 13,0 |
| Tarayıcı hatası | 0 | 0 * |

\* Bir koşuda 10 "vite failed to reload" mesajı görüldü: bunlar oturum içinde düzelttiğim geçici bir sözdizimi hatasından kalan eski konsol kayıtları (Chrome, sürücü bağlanınca eskileri yeniden gönderiyor). O koşu öncekiyle tıklama tıklama aynı sonucu verdi.

Aynı soruları yeni sürümde tekrar sordum:
- **Şu an ne yapmam gerektiğini ekrandan anlıyor muyum?** Önce: hayır (sorun bitince ekran sessiz). Sonra: evet; görev satırı her an tek bir cümle ve tek bir düğme veriyor, dar ekranda istasyonların üstünde.
- **Tıkladığım şey ne yaptı, gördüm mü?** Önce: hayır (panel açık kalıyor, Genç çubuklar değişmiyor). Sonra: evet; panel kapanıyor, "Son yaptığın" kartı ve çubuk okları.
- **Kaynağım neden azaldı, söylendi mi?** Önce: sadece "Gece tüketimi". Sonra: rapor satırlarında neden cümlesi ve gerekirse "Bunu Sol N'de seçtiğin … etkiledi".
- **Çıkmaz sokak var mı?** Önce: sorunsuz istasyon paneli. Sonra: bulunmadı; her panel ya iş, ya bakım, ya da sorunların yerini gösteriyor.
- **8 yaşındaki biri bu cümleyi anlar mı?** Yeni cümleler kısa tutuldu; terimler ilk geçtikleri yerde açıklanıyor. En uzun cümle hâlâ gece nedeni ("Gece de ısıtıcılar Güç yer, …"); kabul edilebilir.
- Rastgele tıklayan çocuk yine kaybediyor (ortalama Sol 13). Bu beklenen sonuç: rastgele bot hedefi %5-20 kazanma.

Dikkatli oyuncu (a) son sürümde aynı seçimlerle yine kazandı (Sağlık 1; acil yedek Yaşam Sol 9, Güç Sol 11). Sol 9'daki "Sera lambalarını kapat" seçeneğinde artık yedek uyarısı görünüyor; yine seçilirse oyuncu yedeği bilerek harcıyor.

Kara Kutu otomatik pilot gözle doğrulandı (görev no 2, her günü bitiren oyuncu, Sol 9 kararı değişince Sol 13'ten sonrasını otomatik pilot oynuyor): değişen görev kartında kalın 🤖 satırı ve grafikte "🤖 otomatik pilot" dikey çizgisi var.
