# Sol Survivor

A small browser game for the NASA Space Apps Challenge 2026 task *"Build a Junior Astronaut Mission Trainer"* (ages 7-12). The in-game text is in Turkish.

**Play:** <https://alicagriyildiz.github.io/sol-survivor/>

You are the only astronaut on a Mars base. A resupply lander arrives on sol 15, and until then you must keep **Power**, **Life Support** and **Shield** up. Every fix costs something: work hours, another resource, a spare part, or trouble later. After the mission, the **Black Box** lets you change one decision, predict what would happen, and then see both missions side by side, with a plain-language explanation of why they differ.

## How to play

1. Pick a mission number (it sets the dice, so the same number always gives the same mission) and a level: *Junior Astronaut* (lights and hints) or *Commander* (numbers).
2. Each sol starts with a briefing: the day's problems, weather, space weather and a message from Earth.
3. You have 10 work hours. Click a station, read the options (cost in hours, what goes up or down, hints) and choose one. Walking and spacesuit trips (EVA) also cost hours.
4. End the sol. The night report shows what changed and why, a "what really happened" note from a real mission, and sometimes a NASA study.
5. If a gauge falls into the red, Health drops every hour. Each gauge has a one-time emergency reserve that kicks in at the same red line, but it is not free: that system then wears out a little faster every night.
6. Survive until the lander arrives, then open the Black Box.

## Real NASA data

The severity of the sol 12 solar event comes from **real solar flares in NASA's DONKI database**. They range from a C7.6 flare (Jan 2025) to the X8.2 flare of 10 Sep 2017, whose particles reached Mars. The briefings forecast the event, and the sol 12 panel shows its date, class and source.

The dose meter is anchored to **Curiosity RAD's** measured Mars surface dose. The end screen compares your dose with **ISS measurements from NASA OSDR RadLab**. Storm sols use values NASA published for **Opportunity in the 2018 global dust storm**. Sol reports link four **NASA OSDR** space-biology studies.

The data was downloaded once (`npm run fetch-data`) and is bundled with the game, which makes no network calls. Event strength comes from data; the effect on the base is computed with a simplified game scale, and the in-game **Data** screen says so. Details, sources, scale functions and limits are in [`docs/DATA.md`](docs/DATA.md). 14 of the 15 "what really happened" notes were checked against official NASA/JPL pages ([`docs/SOURCES.md`](docs/SOURCES.md)).

## Run

```bash
npm install
npm run dev          # play at http://localhost:5173
npm test             # core, determinism, replay, counterfactual, content, data and balance tests
npm run balance      # balance bots only
npm run build        # type-check + production build (served under /sol-survivor/)
npm run fetch-data   # re-download the NASA data snapshots into src/data/
```

Every push to `main` deploys to GitHub Pages (`.github/workflows/deploy.yml`).

## Structure

- `src/sim/` – pure, deterministic simulation core (seeded RNG, immutable state)
- `src/content/` – the 15-sol scenario as data, balance knobs, data-to-game scale functions (`data.ts`), all player-facing text (Turkish)
- `src/data/` – NASA data snapshots (DONKI, RadLab, OSDR) and hand-entered published values
- `src/blackbox/` – replay, counterfactual, explanation, rescue search
- `src/bots/` – balance bots
- `src/ui/` – 2D interface
- `scripts/fetch-data.mjs` – one-time data download
- `docs/` – design, data, sources, progress, playtest notes

No accounts, no network calls at runtime, and no external images, fonts or sounds. This is not an official NASA product.

## License

MIT (code). NASA data is used under NASA's media and data guidelines; see `docs/DATA.md` for attribution.
