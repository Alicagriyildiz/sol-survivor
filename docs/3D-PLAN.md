# 3D sahne planı

> **Durum (Oturum 5, 2026-11-15): yapıldı.** Ayrıntılar `docs/PROGRESS.md` Oturum 5 ve `docs/DESIGN.md` §6c.
> Plandan sapmalar: (1) çıplak `three` yerine istenen `three` + `@react-three/fiber` + `@react-three/drei` (yalnızca `Instances`);
> (2) yürüme süresi saat tablosundan değil mesafeden, en çok 1,5 sn (mesai bedeli panelde yazar);
> (3) istasyon adları `drei/Html` yerine sahnenin üstünde düz DOM katmanı (React 19'da `Html` her etiket için ayrı kök açıp
> "synchronously unmount" hatası veriyordu; ayrıca kamera sabit olduğundan etiket konumu yalnız ekran boyutu değişince hesaplanır);
> (4) kod `src/scene/` altında: `layout.ts` (yerleşim, yol noktaları, kamera izdüşümü; saf, testli), `look.ts` (durumdan görseller; saf, testli),
> `Scene3D.tsx` (geç yüklenen parça). Toz için parçacık yerine CSS katmanı.

## İlk plan (Oturum 1-4)

Amaç: mevcut 2D geçici arayüzün **istasyon ızgarasının yerine** sabit açılı, düşük poligonlu bir 3D üs
sahnesi koymak. Paneller, üst çubuk, raporlar ve Kara Kutu aynen kalır. 3D yetişmezse 2D arayüz sunumda kullanılır,
o yüzden 2D her an çalışır kalmalı (özellik bayrağıyla geçiş).

## Kesin kararlar (değiştirmeyin)
- Fizik motoru **yok**.
- **Sabit açılı kamera** (hafif eğik kuşbakışı). Kullanıcı kamerayı döndürmez.
- Astronot tıklanan istasyona **önceden tanımlı yol noktaları** (waypoint) üzerinden yürür; çarpışma hesabı yok.
- Yürüme süresi **tablodan** gelir (çekirdeğin `optionCost`/`routineCost` değeri); animasyon **atlanabilir** (tıkla → anında varış).
- İstasyon içleri modellenmez; tıklayınca **mevcut paneller** (`StationPanel`) açılır.
- Sadece düşük poligonlu temel şekiller (kutu, silindir, koni, düzlem). **Dış model/doku/font dosyası yok.**
- 3D katman çekirdeğe yalnızca 2D arayüzün kullandığı **aynı arabirimle** bağlanır: `engine.step(state, action)` + `src/sim/selectors.ts`. Çekirdeğe 3D'ye özel kod eklenmez.
- Renkler `src/ui/tokens.ts` → `colorHex` (turuncu/amber yok).

## Teknik plan
1. `npm i three` (tek yeni bağımlılık; `@types/three` dev). Sürümü sabitleyin.
2. `src/scene/` klasörü:
   - `layout.ts`: istasyon id → 3D konum (x, z), yol noktası grafiği (koridor merkezi = ana üs). EVA istasyonları kubbenin dışında, hava kilidi kapısından geçen yol.
   - `BaseScene.ts`: `three` sahnesi, ortografik ya da dar açılı perspektif kamera, yön + ortam ışığı, Mars zemini (düzlem, `marsBrown`), kubbeler (yarım küre/silindir, `surface2`), paneller (ince kutular), iniş alanı (daire).
   - `Astronaut.ts`: kapsül/silindir + küre; yol noktaları boyunca doğrusal interpolasyon; `skip` ile anında konum.
   - `picking.ts`: Raycaster ile istasyon tıklama → React tarafına `onStationClick(id)`.
3. `src/ui/Scene3D.tsx`: canvas'ı saran React bileşeni. Props: `stations: StationView[]`, `location`, `onStationClick`. Arıza olan istasyonlarda yüzen uyarı işareti (koni + `warn` rengi) **ve** DOM üstü etiket (renk tek başına yetmez: simge + metin).
4. `Play.tsx` içinde `stations` bölümünü bayrakla değiştirin: `?view=3d` ya da Başlangıç ekranında seçim. Varsayılan 2D kalabilir, 3D sağlam olunca varsayılan yapılır.
5. Durum görselleştirme (sadece okuma): Güç düşükse ışıklar kısılır; fırtına bayrağında sis/toz parçacıkları (basit `Points`); Kalkan düşükse sığınak kubbesi `danger` kenar çizgisi. Hepsi `GameState`'ten türetilir; sahne kendi durumunu tutmaz.
6. Eylem akışı: kullanıcı panelden seçeneği seçer → `act(action)` → yeni durum → astronot `location`'a yürür (animasyon süresi = saat × sabit, "Atla" düğmesi). Animasyon bitmeden yeni eylem kabul edilebilir; sahne en son duruma atlar.
7. Performans: tek sahne, < 200 mesh, gölgeler kapalı ya da tek yönlü ışıkla basit; `requestAnimationFrame` sadece animasyon/etkileşim varken.
8. Test: sahne mantığı (layout, yol bulma, waypoint interpolasyonu) saf fonksiyon olarak `tests/scene.test.ts` ile; görsel kontrol elle + ekran görüntüsü.

## Zaman kutusu
- 1 saat: sahne + kubbeler + tıklama → panel açılıyor.
- +1 saat: astronot yürüyüşü + atla.
- +1 saat: durum görselleri (ışık, fırtına, uyarı işaretleri).
- Bir adım takılırsa: 2D'ye geri dön, sunumda 2D'yi kullan.
