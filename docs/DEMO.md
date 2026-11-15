# Sunum yolu (3 dakika, doğaçlama yok)

Adres: https://alicagriyildiz.github.io/sol-survivor/ (yerelde `npm run dev` → http://localhost:5173/).
Dil: Başlangıç ekranının üstündeki **TR / EN** (jüri için EN). Görünüm: **3D**.

Her şey tek tohumla: **148**. Bu tohumda Sol 2'de su filtresi tıkanır, Sol 4'te paneller çok tozlanır ve
**Sol 12'deki güneş olayı gerçek DONKI kaydı X8.2 (10 Eylül 2017)**. Başlangıç ekranındaki **🎬 Demo** kutusu bu
tohumun kayıtlı bir oyununu (görev satırını izleyen, Sol 6'da sığınağı erteleyen bir oyuncu) motordan geçirip
istenen sole getirir; kural değiştirmez, normal oyunu etkilemez. Elle oynamak isteyen `?seed=148` ile aynı dünyayı açar.

| # | Tıkla | Ekranda ne görünür | Söylenecek |
|---|---|---|---|
| 1 | Başlangıç → 🎬 **Demo** → **1 · Sol 4** → **Güne başla** | Birinci şahıs ana üs; sağ kenarda sarı ok "Paneller" | "Astronotun gözünden üs. Sürükleyerek etrafa bakılır." |
| 2 | Alttaki **⚠ Paneller** düğmesi | Hava kilidinden dışarı yürüyüş (dokununca atlanır), tozlu panel, kırmızı yanıp sönen lamba; yanda seçenekler ve **bedelleri** (⏱ 5 sa = 👟 1 + 🚀 1 + 🔧 3, Güç ▲▲, Yaşam ▼▼, doz ▲) | "Her çözümün bedeli var: EVA saat, hava ve radyasyon ister." |
| 3 | **Dışarı çık, panelleri fırçala → Bunu yap**, sonra panelin üstünde **sürükle** | Fırça panelde gezer, toz kalkar, panel parlar; "✓ Bitti · ⏱ −5 sa"; üst çubuk ancak şimdi değişir (oklarla) | "İşi çocuk kendi eliyle yapar. Sonuç seçilen seçeneğe bağlı, hareketin başarısına değil." |
| 4 | **Ana üs** düğmesi (geri yürüyüş), istenirse **Günü bitir** → rapor → ertesi sabah **Paneller** | Panel temiz kalır (sonuç dünyada kalıcı) | "Yaptığın iş sonraki günlerde de orada." |
| 5 | Başlangıç (sayfayı yenile) → 🎬 **2 · Sol 6** → **Sığınak** | Sığınak kararı: regolit 5 sa / su bidonu / "Şimdi gerek yok" (0 sa) | "Bugün bedava görünen ertelemenin bedeli sonra gelir." Kayıtlı oyuncu burada **erteledi**. |
| 6 | 🎬 **3 · Sol 12** → **Güne başla** | Mor gökyüzü ve hareketli perdeler; kask ekranında **"Gerçek güneş olayı: 10 Eylül 2017 · X8.2 sınıfı"**; Sığınak panelinde DONKI kartı | "Bu, NASA DONKI'de kayıtlı gerçek bir patlama. Gücü oyundaki hasarı belirliyor." |
| 7 | Sığınak → **Bir süre sığınakta kal** → bekle | İçeride beklenir, saatler geçer | "Ama Sol 6'da duvar güçlendirilmediği için sığınak az koruyor." |
| 8 | 🎬 **4 · Görev sonu → Kara Kutu** | "Görev bitti" (Sol 14, Kalkan); en üstte büyük **Kara Kutu'yu aç** düğmesi | |
| 9 | Kara Kutu → **Sol 6 İnce sığınak duvarı** → **Duvara kalın regolit katmanı ekle** → **Kurtulurdum** → **Görevi yeniden hesapla** | Yan yana: **Görev bitti (Sol 14)** ↔ **Hayatta kaldın**; eğri ve "neden" açıklaması (Sol 12 olayında daha az doz) | "Tek bir kararı değiştir, tahmin et, iki sonucu yan yana gör." "🔍 Hangi tek karar kurtarırdı?" de yalnız bu kararı bulur. |

Yedek: 3D açılmazsa üst çubukta **Sade** (kartlı görünüm); aynı yol kartlarla da çalışır.

Notlar
- Demo 1-3 durakları kayıtlı oyunu o solün sabahına kadar oynatır; oradan sonra sen oynarsın (kayıt sürmez).
- 4. durak kaydın tamamını oynatır (58 eylem) ve doğrudan görev sonuna gelir.
- Kayıt `src/ui/demo.ts` içindedir; `tests/tools/mission-line.test.ts` (DUMP_SEED=148, DUMP_SALT=3) ile yeniden üretilebilir.
