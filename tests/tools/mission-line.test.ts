// Dev tool (no-op without MISSION=1): players who follow the UI task line.
//   MISSION=1 npx vitest run tests/tools/mission-line.test.ts
//   MISSION=1 LEVEL=commander npx vitest run tests/tools/mission-line.test.ts
// Prints win rate, loss causes and loss sols for: random valid option for the named fault
// (a), always the first listed option (b), and the same two with spare hours spent like the
// careful bot. Prints numbers only; no pass/fail target.
import { it } from 'vitest';
import { BOTS, type Policy } from '../../src/bots/bots';
import { missionPolicy } from '../../src/bots/mission';
import { runBatch, seedRange } from '../../src/bots/stats';
import { engine } from '../../src/content';
import { configFor } from '../../src/content/config';

const pct = (x: number) => (Math.round(x * 1000) / 10).toFixed(1);

it('mission line', () => {
  if (!process.env.MISSION) return;
  const level = (process.env.LEVEL ?? 'junior') as 'junior' | 'commander';
  const cfg = configFor(level);
  const seeds = seedRange(Number(process.env.N ?? 200), Number(process.env.START ?? 1));
  // Same players, but when the mission says "done" they use spare hours like the careful bot.
  const withRoutines = (p: Policy): Policy => (s, e, r) => {
    const a = p(s, e, r);
    return a.type === 'endSol' && s.faults.length === 0 ? BOTS.careful(s, e, r) : a;
  };
  const players: Record<string, Policy> = {
    'a: random option': missionPolicy('random'),
    'b: first option': missionPolicy('first'),
    'a + maintenance': withRoutines(missionPolicy('random')),
    'b + maintenance': withRoutines(missionPolicy('first')),
    'shuffled first': missionPolicy('shuffled'),
    'shuffled + maint': withRoutines(missionPolicy('shuffled')),
    'shuffledAll first': missionPolicy('shuffledAll'),
    'shuffledAll + maint': withRoutines(missionPolicy('shuffledAll')),
    'fewest-hours first': missionPolicy('fewestHours'),
    'fewest-h + maint': withRoutines(missionPolicy('fewestHours')),
  };
  const out: string[] = [`level ${level}, ${seeds.length} seeds`];
  for (const [name, p] of Object.entries(players)) {
    const st = runBatch(engine, p, seeds, cfg);
    const l = st.games - st.wins || 1;
    const picks: Record<string, number> = {};
    for (const r of st.runs) for (const d of r.final.decisions) {
      const k = engine.option(d.faultId, d.optionId).kind + (d.auto ? '(auto)' : '');
      picks[k] = (picks[k] ?? 0) + 1;
    }
    out.push(
      `${name.padEnd(20)} win ${pct(st.winRate).padStart(5)}% | losses P ${pct(st.lossCauses.power / l)}% L ${pct(st.lossCauses.life / l)}% S ${pct(st.lossCauses.shield / l)}% | loss sols ${JSON.stringify(st.lossSols)} | hp on win ${st.avgHealthOnWin.toFixed(1)} | kinds ${JSON.stringify(picks)}`,
    );
  }
  process.stdout.write(out.join('\n') + '\n');
});

// Commander sweep (no-op without CMD_GRID): one JSON override object per grid entry,
// merged into the Junior config ({start, inventory, hoursPerSol, rules:{...}}).
//   CMD_GRID='[{"rules":{"nightHeal":6}}]' npx vitest run tests/tools/mission-line.test.ts -t sweep
//   (START=201 N=200 for out-of-sample seeds; BOTS=careful,random to pick bots)
import { DEFAULT_CONFIG } from '../../src/content/config';
import type { MissionConfig } from '../../src/sim/types';
it('commander sweep', () => {
  if (!process.env.CMD_GRID) return;
  const grid: any[] = JSON.parse(process.env.CMD_GRID);
  const seeds = seedRange(Number(process.env.N ?? 200), Number(process.env.START ?? 1));
  const out: string[] = [];
  for (const o of grid) {
    const cfg: MissionConfig = {
      ...DEFAULT_CONFIG,
      ...(o.hoursPerSol ? { hoursPerSol: o.hoursPerSol } : {}),
      start: { ...DEFAULT_CONFIG.start, ...(o.start ?? {}) },
      inventory: { ...DEFAULT_CONFIG.inventory, ...(o.inventory ?? {}) },
      rules: {
        ...DEFAULT_CONFIG.rules,
        ...(o.rules ?? {}),
        nightly: { ...DEFAULT_CONFIG.rules.nightly, ...(o.rules?.nightly ?? {}) },
        reserve: { ...DEFAULT_CONFIG.rules.reserve, ...(o.rules?.reserve ?? {}) },
      },
    };
    const row: string[] = [];
    for (const name of (process.env.BOTS ?? 'careful,random,idle,robust,cheapest').split(',') as (keyof typeof BOTS)[]) {
      const st = runBatch(engine, BOTS[name], seeds, cfg);
      const l = st.games - st.wins || 1;
      row.push(`${name} ${pct(st.winRate)}% (P${pct(st.lossCauses.power / l)} L${pct(st.lossCauses.life / l)} S${pct(st.lossCauses.shield / l)}${st.lossSols[1] ? ' SOL1!' : ''})`);
    }
    out.push(`${JSON.stringify(o)}\n   ${row.join(' | ')}`);
  }
  process.stdout.write(out.join('\n') + '\n');
});

// Demo seed finder (no-op without DEMO=1): Junior seeds whose sol 12 event is the X8.2 flare
// (10 Sep 2017), preferring sol 2 = clogged filter and heavy sol 4 dust. For each, losing logs
// of plausible players who defer the sol 6 shelter, and the single decisions that rescue them.
//   DEMO=1 [N=150] npx vitest run tests/tools/mission-line.test.ts -t demo
import { findRescues } from '../../src/blackbox';
import { playGame } from '../../src/bots/bots';
import { SOLAR_EVENTS, SOLAR_EVENT_ROLL } from '../../src/content/data';
it('demo seeds', () => {
  if (!process.env.DEMO) return;
  const cfg = configFor((process.env.LEVEL ?? 'junior') as 'junior' | 'commander');
  const x82 = SOLAR_EVENTS.findIndex((e) => e.classType === 'X8.2');
  const deferS6 = (p: Policy): Policy => (s, e, r) =>
    s.faults.some((f) => f.faultId === 's6_shelter') ? { type: 'resolve', faultId: 's6_shelter', optionId: 'defer' } : p(s, e, r);
  const withRoutines = (p: Policy): Policy => (s, e, r) => {
    const a = p(s, e, r);
    return a.type === 'endSol' && s.faults.length === 0 ? BOTS.careful(s, e, r) : a;
  };
  const players: Record<string, Policy> = {
    'careful, defers sol 6': deferS6(BOTS.careful),
    'task line random + maint, defers sol 6': deferS6(withRoutines(missionPolicy('random'))),
    'random bot, defers sol 6': deferS6(BOTS.random),
    'task line random + maint': withRoutines(missionPolicy('random')),
  };
  const out: string[] = [];
  for (let seed = 1; seed <= Number(process.env.N ?? 150); seed++) {
    const s0 = engine.init(seed, cfg);
    if (s0.rolls[SOLAR_EVENT_ROLL] !== x82) continue;
    const pref = s0.rolls.sol2v === 1 && s0.rolls.dustLevel === 2;
    const careful = playGame(engine, BOTS.careful, seed, cfg).final;
    out.push(`seed ${seed}${pref ? ' *PREFERRED*' : ''} rolls ${JSON.stringify(s0.rolls)} | careful ${careful.outcome!.won ? 'WIN' : 'LOSS'} sol ${careful.outcome!.sol} hp ${careful.health} dose ${careful.dose}`);
    if (!pref && !process.env.ALL) continue;
    for (const [name, p] of Object.entries(players)) {
      for (let salt = 1; salt <= Number(process.env.SALTS ?? 3); salt++) {
        const run = playGame(engine, p, seed, cfg, salt);
        const o = run.final.outcome!;
        if (o.won) {
          out.push(`   ${name} salt ${salt}: WIN hp ${run.final.health}`);
          continue;
        }
        const rescues = findRescues(engine, { seed, config: cfg, actions: run.actions });
        const strict = findRescues(engine, { seed, config: cfg, actions: run.actions }, BOTS.idle);
        const fmtR = (rs: typeof rescues) => rs.map((r) => `${r.decision.key}:${r.decision.optionId}${r.decision.auto ? '(auto)' : ''}->${r.optionId}`).join(', ');
        out.push(`   ${name} salt ${salt}: LOSS sol ${o.sol} cause ${o.cause} | rescues(autopilot) ${rescues.length}: ${fmtR(rescues)} | strict ${strict.length}: ${fmtR(strict)}`);
      }
    }
  }
  process.stdout.write(out.join('\n') + '\n');
});
