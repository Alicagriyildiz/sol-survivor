# NASA data in Sol Survivor

Sol Survivor is a game, not a simulator. This page lists every piece of real NASA data in it: where it comes from, how it was obtained, what it changes in the game, and what is game design instead.

**Live or static?** Static. `npm run fetch-data` (`scripts/fetch-data.mjs`) downloads the data once and saves snapshot files in `src/data/`. The game reads only those files and makes no network calls while it runs. Each snapshot records its source, full request URL(s), query, download date and attribution. No API key is stored; the script uses keyless endpoints.

**Framing used in the game:** the *strength* of an event comes from real data, and its *effect on the base* is worked out with a simplified game scale. The in-game "Veriler" (Data) screen, reachable from the start and end screens, says this, and also says that repair costs and gauge points are game design.

| # | Data | Source and how it was obtained | What it changes in the game | Status |
|---|---|---|---|---|
| 1 | 5 real solar flares that DONKI links to solar energetic particle (SEP) events | NASA DONKI via the CCMC web service (keyless): `https://ccmc.gsfc.nasa.gov/DONKI/WS/get/FLR` and `/SEP`, 2010-04-01 to 2025-12-31 in 60-day windows (192 requests). Downloaded 2026-11-15. → `src/data/donki-solar-events.json` | Sol 12's solar particle event. Each mission gets one of the 5 events (picked by the mission seed). The event's strength sets how much Shield it costs and how much radiation it brings. Space-weather lines in earlier briefings forecast it. The Sol 12 panel shows its date, class and DONKI record. | ✅ works |
| 2 | ISS absorbed dose rate | NASA OSDR **RadLab** API: ISS, DOSIS-3D DosTel1 (Columbus module), March 2022, 37,209 readings. Unit µGy/hour per the RadLab API docs. Downloaded 2026-11-15. → `src/data/radlab-iss-dose.json` | End-of-mission dose comparison ("ISS, same number of days") and the dose meter's info button. | ✅ works |
| 3 | Mars surface absorbed dose rate, about 210 µGy/day (Curiosity RAD) | **Published value, typed in by hand** from <https://science.nasa.gov/resource/radiation-measurements-on-mars/> (URL and quote in `src/data/published-values.json`). Not a dataset. | The dose meter's unit: one night's background radiation (before Shield) = one RAD Mars day. The meter shows mGy. | ✅ published value |
| 4 | 2018 global dust storm: Opportunity's tau 10.8 (usual 0.5, below 2.0 needed to recharge), lowest energy 21 Wh | **Published values, typed in by hand** from JPL/NASA pages (URLs and quotes in `published-values.json`). Not a dataset. Labeled in game as "set using values published by NASA". | Storm nights (Sols 9-12): panel output = 0 (see scale below). The storm briefings (Sols 8-10) show the values. | ✅ published values |
| 5 | 4 space-biology studies | NASA **OSDR** search API `https://osdr.nasa.gov/osdr/data/search` (keyless). Downloaded 2026-11-15. → `src/data/osdr-studies.json` | "NASA research" line in the end-of-sol report (study title, OSD id, link): Sol 2 OSD-252 (ISS microbial observatory), Sol 3 OSD-772 (chile peppers on the ISS), Sol 9 OSD-342 (muscle and bone loss in mice on the ISS), Sol 12 OSD-210 (cosmic-ray damage to seeds, balloon flight). Text only, no numbers. | ✅ works |
| 6 | "What really happened" notes (15) | Checked by hand against official NASA/JPL pages. 14 of 15 verified (URLs in `src/content/sources.ts`). Sol 13's tea-leaf detail appears only in media reports citing Roscosmos, so that note keeps its "to verify" badge. | Text at the end of each sol. | 14/15 verified |

## Real events picked for Sol 12

The rule is in `scripts/fetch-data.mjs`. Out of 3,058 flares in DONKI, 134 are linked to at least one SEP event. The script picks one flare per strength band (C, M1–M5, M5–X1, X1–X5, ≥X5). Within a band it takes the flare with the most linked SEP records (ties go to the later flare). No two picks may share an SEP record. For the ≥X5 band the 10 Sep 2017 X8.2 flare is preferred, because NASA reported its particles at the surface of Mars.

| Flare | Peak (UTC) | Region | Strength s | Shield lost | Radiation before shelter/Shield (game units) |
|---|---|---|---|---|---|
| C7.6 | 2025-01-04 19:15 | AR 13939 | 0.88 | 2.5 | 37 |
| M1.2 | 2023-09-01 03:52 | AR 13413 | 1.08 | 3 | 42 |
| M9.7 | 2024-06-08 01:49 | AR 13697 | 1.99 | 6 | 64 |
| X1.8 | 2024-10-26 07:19 | AR 13873 | 2.26 | 7 | 70 |
| X8.2 | 2017-09-10 16:06 | AR 12673 | 2.91 | 8.5 | 86 |

## Scale functions (pure, in `src/content/data.ts`, tested in `tests/data.test.ts`)

- **Flare strength** `s = log10(peak X-ray flux / 1e-6 W/m²)`, so C1 = 0, M1 = 1 and X1 = 2. Flux comes from the GOES class: C = 1e-6, M = 1e-5, X = 1e-4 W/m², and the number after the letter is a multiplier (NASA GSFC, URL in `published-values.json`).
- **Radiation** `= 16 + 24·s` game units. **Shield lost** `= 3·s`. Both are rounded to 0.5. A stronger event always costs more (tested). The shelter and the Shield gauge then reduce the radiation the astronaut receives (game rules, `docs/DESIGN.md`). DONKI events were observed at the Sun and near Earth. Their effect on a Mars base is our simplification, and the game says so on the Sol 12 panel.
- **Dose meter** 1 game dose unit = 0.21 mGy ÷ 2 (the nightly background radiation in game units). Only the unit is anchored to RAD. Shield, EVA and solar-event amounts stay at game scale. The end screen says the player's dose is computed with simplified rules, while the RAD and RadLab numbers are measurements.
- **ISS dose** is a time-weighted mean, because DosTel reports more often when dose rates are high (South Atlantic Anomaly). The plain average of the readings is 30.7 µGy/h; the time-weighted mean is 12.2 µGy/h = 0.29 mGy/day. Both are stored in the snapshot.
- **Storm panels** `efficiency(tau) = clamp((2.0 − tau) / (2.0 − 0.5), 0, 1)`. It is 1 at Opportunity's usual tau and 0 at the tau where it could no longer recharge. At tau 10.8 it is 0, so each storm night costs the full panel output, `PANEL_OUTPUT_PER_SOL = 5` (a game-design number).

## Game design, not data

The following are all game design, tuned with balance bots (`npm run balance`):
- gauge sizes (0-100), starting values, nightly drains, repair hours and costs, the emergency reserve, the radiation-to-Health factor and the score;
- panel output on a normal sol;
- the Shield/shelter reduction factors;
- the solar-event scale constants (16, 24, 3).

The dates, flare classes, measured dose rates, tau and watt-hour values are real.

## What did not work / limits

- `api.nasa.gov/DONKI/FLR` with DEMO_KEY returned HTTP 404 on 2026-11-15, and DEMO_KEY allowed only 10 requests per hour. The keyless CCMC endpoint returned the same records and was used instead. Its `kauai.ccmc.gsfc.nasa.gov` host timed out; `ccmc.gsfc.nasa.gov` worked.
- The RadLab knowledge-base pages returned HTTP 500 to scripts. The unit (µGy/hour) was read from the RadLab API documentation page.
- No official page gave Opportunity's watt-hours *before* the storm, so the game does not use a "before/after" power ratio.
- No official page gave a number for the Sept 2017 dose at the Mars surface (only "more than double"), so the game does not use one.

## Re-running

```bash
npm run fetch-data          # all sources (cached in scripts/.cache/, delete it for fresh data)
npm run fetch-data -- donki # one source: donki | radlab | osdr
npm test                    # data tests + balance
```

Attribution: NASA Community Coordinated Modeling Center (DONKI); NASA Open Science Data Repository (RadLab, OSDR); NASA/JPL-Caltech (Curiosity RAD, Opportunity). NASA data is generally not copyrighted; using it does not imply NASA endorsement.
