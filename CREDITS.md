# Credits

## 3D models

**Space Kit (2.0) by Kenney** — https://kenney.nl/assets/space-kit
License: Creative Commons Zero (CC0 1.0), https://creativecommons.org/publicdomain/zero/1.0/
(verified from `License.txt` inside the downloaded pack; a copy is kept at `public/models/kenney/License.txt`).
Crediting is not required; we credit Kenney gladly.

Only the models the game uses are in the repo (`public/models/kenney/*.glb`, 26 files, about 380 kB in total).
Their materials are recoloured at load time to the game palette (`src/scene/core.tsx`, `MATERIAL_COLORS`).

| Model | Used for |
|---|---|
| rock_largeA/B, rocks_smallA/B, crater, craterLarge | terrain detail near the paths |
| satelliteDish_detailed | turning dish on the hab roof |
| chimney_detailed, pipe_ring | roof vents |
| desk_chair, barrels, machine_barrel | hab interior |
| machine_generator, machine_generatorLarge, machine_barrelLarge, machine_wireless, machine_wirelessCable, barrel, supports_low, craft_cargoA | battery charger, yard, beacon mast, cargo sled, station details |

Not used: **Quaternius Ultimate Space Kit** (the downloaded parts had no licence file inside, and their colours come
from a texture atlas that could not be recoloured to the palette in time). Its public page states CC0
(https://quaternius.com/packs/ultimatespacekit.html), but no file from it is in the repo.

All other shapes are built from primitives in code. No external images, fonts or sounds.

## Data
NASA DONKI, NASA OSDR / RadLab, Curiosity RAD published values, JPL 2018 dust storm values — see `docs/DATA.md`.
