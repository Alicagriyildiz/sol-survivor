# 3D: birinci şahıs Mars (Oturum 6)

> Oturum 5'teki sabit izometrik sahne (`Scene3D.tsx`, `layout.ts`) silindi. Yerine birinci şahıs görünüm geldi:
> oyuncu bir seçenek seçince iş astronotun gözünden yapılır (ya da oyuncu basit bir hareketle kendisi yapar)
> ve sonuç dünyada kalır. Ayrıntılı kurallar `docs/DESIGN.md` §6d, sunum yolu `docs/DEMO.md`.

## Kesin kararlar
- Fizik motoru, çarpışma, serbest dolaşım (WASD) **yok**. Hareket tıklamayla, sabit yol noktalarından; atlanabilir.
- Bakış sürüklemeyle (fare / parmak); işaretçi kilidi yok, düğmeler hep tıklanabilir.
- 3D çekirdeğe yalnız `engine.step` + seçicilerle bağlanır. Seçim anında adım bir kez işlenir; animasyon sonra oynar
  ve atlansa da durum doğrudur. Görünüm durumdan türetilir (`sceneLook`, `workLook`), sahne oyun durumu saklamaz.
- Eylem türü (8 tür) yalnız sunum bilgisidir: `src/content/actions.ts`; çekirdek bilmez, sayı değiştirmez; test her
  seçeneğin bir türü olduğunu denetler.
- Renkler `src/ui/tokens.ts`. Turuncu/amber yok; Kenney modellerinin malzemeleri yüklenirken palete çevrilir.
- 3D ayrı ve geç yüklenen parça; yüklenirken, WebGL yoksa ya da hata olursa kartlı ekran. "3D / Sade" seçimi kalır.

## Dosyalar (`src/scene/`)
| Dosya | İçerik |
|---|---|
| `world.ts` | Saf yerleşim: istasyon noktaları (durma, bakış, yakın iş pozu, etiket), yol grafiği, yürüme süresi, arazi yüksekliği, işe özel kamera pozları (`FAULT_WORK`). Testli (`tests/world.test.ts`). |
| `look.ts` | `sceneLook` (ışık, fırtına, gece, Sol 12) ve `workLook` (son seçimler, açık arızalar ve yaşları, bayraklar, değiştiriciler, güç). |
| `core.tsx` | Kare başına ortak durum (`RT`), çalışan iş (`stationAct`, `shownWork`), pahlı kutu, durum lambası, kapı, Kenney model yükleyici (yedek şekilli), parçacık çeşmesi. |
| `env.tsx` | Gökyüzü (gündüz pembe-mor, gece yıldızlı, fırtına bulanık, Sol 12 mor perdeler), güneş + dolgu ışığı + gölge + ACES ton eşleme, engebeli ve renkli zemin, araç izleri, uzak tepe silueti, kayalar, uçuşan toz, fırtına toz duvarı. |
| `hab.tsx` | Yuvarlak üs: duvar parçaları, kapılar, pencereler, tavan ışıkları (güçle kararır), borular, masa, dolaplar, zemin çizgileri; çatıda dönen çanak; dış avlu. |
| `hand.tsx` | Eldiven ve işe göre alet (fırça, bant, anahtar/kartuş, kürek, fiş, tablet; şalterde açık el). |
| `sound.ts` | Tarayıcıda üretilen kısa sesler (dosya yok), varsayılan kısık, kapatılabilir. |
| `stations/*.tsx` | İstasyon başına iş noktası ve işler: `Hub`, `Solar`, `Battery`, `Greenhouse`, `Shelter`, `Airlock`, `Landing`. |
| `FirstPerson.tsx` | Kamera ve yürüyüş, iş sürücüsü (yaklaş → yap → bitir), etiketler, yön oku, iş kutusu, alt çubuk. |

## Kalan işler / fikirler
- Gerçek GPU'lu dizüstü ve gerçek telefonda akıcılık ölçümü (yalnız yazılım WebGL ile denendi).
- Panel tozunun ertelenen günlerle koyulaşması (şimdilik lamba hızlanıyor).
- İç mekânların ses ortamı (fan uğultusu), adım sesleri.
