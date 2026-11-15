# Sol Survivor

A small browser game for the NASA Space Apps Challenge 2026 task *"Build a Junior Astronaut Mission Trainer"* (ages 7-12).

You are the only astronaut on a Mars base. Keep **Power**, **Life Support** and **Shield** up for 15 sols until the resupply lander arrives. Every fix costs something: work hours, another resource, a spare part, or trouble later. After the mission, the **Black Box** lets you change one decision, predict the result, and see both missions side by side with a plain-language explanation of why they differ.

Real events behind each sol (Phoenix perchlorate, InSight dust, MOXIE, the 2018 dust storm, Apollo 13's CO2 filter, the ISS tea-leaf leak hunt, ...) are summarized in-game with their source names. These notes are still being fact-checked (`docs/SOURCES.md`).

## Run

```bash
npm install
npm run dev        # play at http://localhost:5173
npm test           # core, determinism, replay, counterfactual, content and balance tests
npm run build      # type-check + production build
```

## Structure

- `src/sim/` – pure, deterministic simulation core (seeded RNG, immutable state)
- `src/content/` – the 15-sol scenario as data, balance knobs, all player-facing text (Turkish)
- `src/blackbox/` – replay, counterfactual, explanation, rescue search
- `src/bots/` – balance bots
- `src/ui/` – temporary 2D interface (a 3D scene is planned, see `docs/3D-PLAN.md`)
- `docs/` – design, progress, sources to verify, 3D plan

No accounts, no network calls, no external assets.

## License

MIT
