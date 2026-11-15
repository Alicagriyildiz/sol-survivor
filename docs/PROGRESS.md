# İlerleme

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
