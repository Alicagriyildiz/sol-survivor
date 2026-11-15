# Doğrulanacak kaynaklar

Oyundaki "Gerçekte ne oldu?" notlarının hepsi **doğrulanmadı** (`verified: false`).
Not metinleri: `src/content/lang/tr.ts` → `notes`. Kaynak adları ve iddialar: `src/content/sources.ts`.
Bir not doğrulanınca `sources.ts` içinde `verified: true` yapın; oyun "doğrulanacak" rozetini kaldırır.

Kural: emin olunmayan sayı ve tarih yazılmadı. Notlarda geçen tek sayısal ifadeler aşağıda işaretli.

| Sol | Kaynak (oyunda gösterilen) | Doğrulanacak iddialar | Sayı/tarih |
|---|---|---|---|
| 1 | NASA – Mars Facts | Bir sol, Dünya gününden yaklaşık 40 dakika uzundur. | "yaklaşık 40 dakika" |
| 2 | NASA – ISS Environmental Control and Life Support System (ECLSS) | ISS kullanılmış su ve nemi içme suyuna çevirir; bu sistemin parçaları arızalandı ve mürettebat onardı/değiştirdi. | — |
| 3 | NASA/JPL – Phoenix Mars Lander | Phoenix 2008'de Mars toprağında perklorat buldu; perklorat insan için zararlıdır. | 2008 |
| 4 | NASA/JPL – InSight Mission | Panellerin tozlanmasıyla güç azaldı; ekip robot kolun kepçesiyle panelin yanına kum döktü, rüzgarla sürüklenen kum biraz toz kaldırdı. | — |
| 5 | NASA – MOXIE (Perseverance) | MOXIE Mars havasındaki CO2'den oksijen üretti; çok elektrik gerektirir. | — |
| 6 | NASA – Human Research Program / space radiation | Yaşam alanlarını regolitle örtmek ve su gibi malzemelerle korumak radyasyon kalkanı olarak araştırılıyor. | — |
| 7 | NASA – Mars communications / Deep Space Network | Dünya-Mars tek yön sinyal gecikmesi birkaç dakikadan yirmi dakikadan fazlasına kadar sürer. | "birkaç dakika… yirmi dakikadan fazla" |
| 8 | NASA – 2018 Mars global dust storm | 2018'de başlayan bir toz fırtınası tüm gezegeni sardı. | 2018 |
| 9 | NASA/JPL – Opportunity Rover | Opportunity 2018 fırtınasında bağlantıyı kaybetti; aylarca denendi, bir daha uyanmadı. | 2018 |
| 10 | NASA – Apollo 13 | Komuta modülünün köşeli CO2 filtreleri ay modülündeki yuvarlak yuvaya uymadı; torba, karton ve bantla bağlantı parçası yapıldı. | 1970 |
| 11 | NASA/JPL – Mars Exploration Rovers (Spirit, Opportunity) | Rüzgar zaman zaman panelleri temizledi ve güç arttı; zamanı önceden bilinemezdi. | — |
| 12 | NASA – Curiosity RAD / MAVEN, September 2017 solar event | Eylül 2017'de bir güneş olayının parçacıkları Mars'a ulaştı; Curiosity'deki RAD yüzeyde artışı ölçtü. | Eylül 2017 |
| 13 | NASA / Roscosmos – ISS 2020 leak, Soyuz MS-09 2018 | 2020'de ISS'te küçük sızıntının yeri süzülen çay yapraklarıyla bulundu; 2018'de bir Soyuz'daki küçük delik mürettebatça yamandı. | 2020, 2018 |
| 14 | NASA – ISS External Active Thermal Control System | ISS amonyak soğutma pompaları arızalandı; değiştirmek için uzay yürüyüşleri yapıldı. | — |
| 15 | NASA/JPL – Mars Entry, Descent and Landing | Mars'a iniş birkaç dakika sürer; sinyal gecikmesi yüzünden araç inişi kendi yönetir. | — |

## Diğer içerik notları (doğrulama gerekmez ama bilinmeli)
- Oyundaki sayılar (güç, doz birimi, süreler) **oyun sayılarıdır**, gerçek ölçüm değildir. Oyun bunu "canlı veri" gibi sunmaz.
- Oyunda "NASA onaylı", "canlı veri", "ilk" gibi ifadeler yoktur; eklenmemeli.
