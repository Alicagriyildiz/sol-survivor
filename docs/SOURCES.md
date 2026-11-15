# Kaynak notları ve doğrulama

Oyundaki "Gerçekte ne oldu?" notları: metinler `src/content/lang/tr.ts` → `notes`, kaynak adları, iddialar ve adresler `src/content/sources.ts`.
Oyun, `verified: false` olan notlarda "doğrulanacak" rozetini gösterir.

## Oturum 3 (2026-11-15): resmi sayfalardan doğrulama

Kural: Bir not yalnızca içindeki **her** iddia resmi bir kurum sayfasında okunduysa `verified: true` yapıldı. Sayfaları bir yardımcı ajan açtı ve her biri için kısa bir alıntı getirdi. Metni değişen notların (6, 9, 13) ve sayısal değerlerin sayfalarını ayrıca kendim açtım (✔︎ işaretli).

| Sol | Sonuç | Sayfa | Notta yapılan değişiklik |
|---|---|---|---|
| 1 | ✅ | NASA GISS Mars24: ortalama güneş günü 24 sa 39 dk 35 sn (giss.nasa.gov/tools/mars24/help/notes.html) | Kaynak adı "NASA – Mars Facts" → "NASA GISS – Mars24" (Mars Facts sayfası "40 dakika" demiyor). |
| 2 | ✅ | nasa.gov: su geri kazanım kilometre taşı + yaşam desteği dersleri | — |
| 3 | ✅ | science.nasa.gov/mission/mars-phoenix (5 Ağustos 2008 duyurusu); jpl.nasa.gov Perseverance yazısı ("çok miktarda solunur ya da yutulursa") | "insan için zararlıdır" → "çok miktarda solunur ya da yutulursa zararlıdır". |
| 4 | ✅ | jpl.nasa.gov "InSight gets a power boost" (2021) | — |
| 5 | ✅ | nasa.gov MOXIE görev sonu; science.nasa.gov araç listesi ("Power: 300 watts") | "çok elektrik gerektirir" → "yaklaşık 300 vat harcıyordu". |
| 6 | ✅ ✔︎ | NTRS 19910008686 (regolit kalkanı); NTRS 20170000379: "20 cm thick water shell … about 15% effective dose reduction" | Su için abartı önlendi: "20 cm su dozu yalnızca yaklaşık %15 azaltır". Kaynak adı NASA Teknik Raporlar Sunucusu oldu. |
| 7 | ✅ | nasa.gov "Space communications: 7 things": yaklaşık 4 dk / yaklaşık 24 dk | "birkaç dakikadan yirmi dakikadan fazlasına" → "yaklaşık 4 dakikadan 24 dakikaya". |
| 8 | ✅ | jpl.nasa.gov feature 7164 (Haziran 2018, "planet-encircling") | — |
| 9 | ✅ ✔︎ | jpl.nasa.gov "Opportunity mission comes to end": 10 Haziran 2018, "more than a thousand commands", "eight-month recovery" | "Aylarca denendi" → "Sekiz ay boyunca binden fazla komut gönderildi". |
| 10 | ✅ | nasa.gov Apollo 13 görev ayrıntıları | — |
| 11 | ✅ | jpl.nasa.gov "Spirit gets energy boost…" (2009): yaklaşık 210 → 240 Wh | "Ne zaman olacağı önceden bilinemezdi" iddiası resmi sayfada bulunamadı, çıkarıldı. Yerine Spirit'in Wh değerleri kondu. |
| 12 | ✅ | jpl.nasa.gov "Large solar storm … doubles radiation levels on the Martian surface" (29 Eylül 2017) | "Yüzeyde radyasyon RAD'ın o güne kadar ölçtüğünün iki katından fazlası" eklendi. |
| 13 | ⚠️ kısmen, `verified: false` | nasa.gov ISS blog 30 Eylül 2020 (sızıntı Zvezda geçiş bölmesinde) ✔︎; ISS durum 30 Ağustos 2018 (Soyuz MS-09, yaklaşık 2 mm delik, reçine + gazlı bez) ✔︎ | **Çay yaprakları** hiçbir resmi NASA/Roscosmos sayfasında bulunamadı; yalnızca Roscosmos'a dayanan haberlerde geçiyor. Not "haberlere yansıdı" diye yeniden yazıldı, rozet kalıyor. |
| 14 | ✅ | nasa.gov Aralık 2013 amonyak pompası uzay yürüyüşleri | Yıl eklendi (2013). |
| 15 | ✅ | science.nasa.gov "Curiosity's seven minutes of terror": yaklaşık 7 dk, sinyal yaklaşık 14 dk | "birkaç dakika" → "yaklaşık 7 dakika", sinyal süresi eklendi. |

Tam adresler `src/content/sources.ts` → `urls` içinde. Oyun bunları kaynak adına bağlantı olarak gösteriyor.

## Oyunda kullanılan sayılar (oyun tasarımı mı, veri mi?)
- Güç, Yaşam Desteği, Kalkan puanları, onarım süreleri ve bedeller **oyun tasarımıdır**. Veriler ekranı bunu söyler.
- Güneş olayı, doz birimi, ISS karşılaştırması, fırtına değerleri ve OSDR çalışmaları gerçek veridir. Kaynakları `docs/DATA.md`'de.
- Oyunda "NASA onaylı", "canlı veri", "gerçek zamanlı", "ilk" gibi ifadeler yoktur; eklenmemeli.

## Oturum 2 denetimi (geçmiş)
Oturum 2'de notların sol olayıyla ilgisi denetlendi (hepsi ilgili). İşaretlenen şüpheli ayrıntılar (Sol 4 kum numarası, Sol 7 gecikme aralığı, Sol 9 "aylarca", Sol 12 tarih ve ölçüm, Sol 13 çay yaprağı ve modül, Sol 15 süre) yukarıdaki tabloda sonuçlandı.
