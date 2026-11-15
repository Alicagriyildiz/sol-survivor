// Dev tools (each is a no-op without its env var; numbers only, no pass/fail targets).
//
// 1. Players who follow the UI task line (selectors.mission):
//      MISSION=1 [LEVEL=commander] [N=200 START=1] npx vitest run tests/tools/mission-line.test.ts -t "mission line"
//    random valid option for the named fault (a), always the first listed card (b), other
//    card orders (per-mission shuffle, fewest hours first), each with and without spending
//    spare hours on maintenance like the careful bot.
// 2. Commander sweep: one JSON override object per grid entry, merged into the Junior config
//    ({start, inventory, hoursPerSol, rules:{...}}):
//      CMD_GRID='[{"start":{"power":60,"life":60}}]' [BOTS=careful,random] [START=201] npx vitest run tests/tools/mission-line.test.ts -t sweep
// 3. Demo seeds: Junior seeds whose sol 12 event is the X8.2 flare (10 Sep 2017), preferring
//    sol 2 = clogged filter (sol2v=1) and heavy sol 4 dust (dustLevel=2); losing logs of
//    plausible players and the single decisions that rescue them:
//      DEMO=1 [N=150 SALTS=3 ALL=1] npx vitest run tests/tools/mission-line.test.ts -t "demo seeds"
// 4. Per-sol dump of one demo log, and of the log with one decision changed:
//      DUMP_SEED=104 DUMP_PLAYER='task line random + maint, defers sol 6' DUMP_SALT=2 DUMP_FIX='s6_shelter:regolith' npx vitest run tests/tools/mission-line.test.ts -t "demo dump"
import { it } from 'vitest';
import { counterfactual, findRescues } from '../../src/blackbox';
import { BOTS, playGame, type Policy } from '../../src/bots/bots';
import { missionPolicy } from '../../src/bots/mission';
import { runBatch, seedRange } from '../../src/bots/stats';
import { engine } from '../../src/content';
import { DEFAULT_CONFIG, configFor, type Level } from '../../src/content/config';
import { SOLAR_EVENTS, SOLAR_EVENT_ROLL } from '../../src/content/data';
import type { Action, GameState, MissionConfig } from '../../src/sim/types';

const pct = (x: number) => (Math.round(x * 1000) / 10).toFixed(1);
const level = () => (process.env.LEVEL ?? 'junior') as Level;
const seeds = () => seedRange(Number(process.env.N ?? 200), Number(process.env.START ?? 1));

/** When the task line says "done", spend spare hours like the careful bot (maintenance). */
const withMaint = (p: Policy): Policy => (s, e, r) => {
  const a = p(s, e, r);
  return a.type === 'endSol' && s.faults.length === 0 ? BOTS.careful(s, e, r) : a;
};
/** The careful bot, but with these (fault, option) picks forced whenever available. */
const forcing = (forced: [string, string][]): Policy => (s, e, r) => {
  for (const [faultId, optionId] of forced)
    if (s.faults.some((f) => f.faultId === faultId) && !e.check(s, { type: 'resolve', faultId, optionId })) return { type: 'resolve', faultId, optionId };
  return BOTS.careful(s, e, r);
};
/** Always defer the sol 6 shelter. */
const deferS6 = (p: Policy): Policy => (s, e, r) =>
  s.faults.some((f) => f.faultId === 's6_shelter') ? { type: 'resolve', faultId: 's6_shelter', optionId: 'defer' } : p(s, e, r);

it('mission line', () => {
  if (!process.env.MISSION) return;
  const cfg = configFor(level());
  const players: Record<string, Policy> = {
    'a: random option': missionPolicy('random'),
    'b: first option': missionPolicy('first'),
    'a + maintenance': withMaint(missionPolicy('random')),
    'b + maintenance': withMaint(missionPolicy('first')),
    'shuffled first': missionPolicy('shuffled'),
    'shuffled + maint': withMaint(missionPolicy('shuffled')),
    'shuffledAll first': missionPolicy('shuffledAll'),
    'shuffledAll + maint': withMaint(missionPolicy('shuffledAll')),
    'fewest-hours first': missionPolicy('fewestHours'),
    'fewest-h + maint': withMaint(missionPolicy('fewestHours')),
  };
  const out: string[] = [`level ${level()}, ${seeds().length} seeds`];
  for (const [name, p] of Object.entries(players)) {
    const st = runBatch(engine, p, seeds(), cfg);
    const l = st.games - st.wins || 1;
    const picks: Record<string, number> = {};
    for (const r of st.runs)
      for (const d of r.final.decisions) {
        const k = engine.option(d.faultId, d.optionId).kind + (d.auto ? '(auto)' : '');
        picks[k] = (picks[k] ?? 0) + 1;
      }
    out.push(
      `${name.padEnd(20)} win ${pct(st.winRate).padStart(5)}% | losses P ${pct(st.lossCauses.power / l)}% L ${pct(st.lossCauses.life / l)}% S ${pct(st.lossCauses.shield / l)}% | loss sols ${JSON.stringify(st.lossSols)} | hp on win ${st.avgHealthOnWin.toFixed(1)} | kinds ${JSON.stringify(picks)}`,
    );
  }
  process.stdout.write(out.join('\n') + '\n');
});

it('commander sweep', () => {
  if (!process.env.CMD_GRID) return;
  const grid: any[] = JSON.parse(process.env.CMD_GRID);
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
    // "regolith": the careful bot that also always reinforces the sol 6 shelter.
    const all: Record<string, Policy> = { ...BOTS, regolith: forcing([['s6_shelter', 'regolith']]) };
    for (const name of (process.env.BOTS ?? 'careful,random,idle,robust,cheapest').split(',')) {
      const st = runBatch(engine, all[name]!, seeds(), cfg);
      const l = st.games - st.wins || 1;
      row.push(`${name} ${pct(st.winRate)}% (P${pct(st.lossCauses.power / l)} L${pct(st.lossCauses.life / l)} S${pct(st.lossCauses.shield / l)}${st.lossSols[1] ? ' SOL1!' : ''})`);
    }
    out.push(`${JSON.stringify(o)}\n   ${row.join(' | ')}`);
  }
  process.stdout.write(out.join('\n') + '\n');
});

const demoPlayers: Record<string, Policy> = {
  'careful, defers sol 6': deferS6(BOTS.careful),
  'task line random + maint, defers sol 6': deferS6(withMaint(missionPolicy('random'))),
  'random bot, defers sol 6': deferS6(BOTS.random),
  'task line random + maint': withMaint(missionPolicy('random')),
};

it('demo seeds', () => {
  if (!process.env.DEMO) return;
  const cfg = configFor(level());
  const x82 = SOLAR_EVENTS.findIndex((e) => e.classType === 'X8.2');
  const out: string[] = [];
  for (let seed = 1; seed <= Number(process.env.N ?? 150); seed++) {
    const s0 = engine.init(seed, cfg);
    if (s0.rolls[SOLAR_EVENT_ROLL] !== x82) continue;
    const pref = s0.rolls.sol2v === 1 && s0.rolls.dustLevel === 2;
    const careful = playGame(engine, BOTS.careful, seed, cfg).final;
    out.push(`seed ${seed}${pref ? ' *PREFERRED*' : ''} rolls ${JSON.stringify(s0.rolls)} | careful ${careful.outcome!.won ? 'WIN' : 'LOSS'} sol ${careful.outcome!.sol} hp ${careful.health} dose ${careful.dose}`);
    if (!pref && !process.env.ALL) continue;
    for (const [name, p] of Object.entries(demoPlayers)) {
      for (let salt = 1; salt <= Number(process.env.SALTS ?? 3); salt++) {
        const run = playGame(engine, p, seed, cfg, salt);
        const o = run.final.outcome!;
        if (o.won) {
          out.push(`   ${name} salt ${salt}: WIN hp ${run.final.health}`);
          continue;
        }
        const log = { seed, config: cfg, actions: run.actions };
        const rescues = findRescues(engine, log);
        const strict = findRescues(engine, log, BOTS.idle);
        const fmtR = (rs: typeof rescues) => rs.map((r) => `${r.decision.key}:${r.decision.optionId}${r.decision.auto ? '(auto)' : ''}->${r.optionId}`).join(', ');
        out.push(`   ${name} salt ${salt}: LOSS sol ${o.sol} cause ${o.cause} | rescues(autopilot) ${rescues.length}: ${fmtR(rescues)} | strict ${strict.length}: ${fmtR(strict)}`);
      }
    }
  }
  process.stdout.write(out.join('\n') + '\n');
});

/** One line per sol: end-of-sol gauges and what was done that sol. */
function perSol(seed: number, cfg: MissionConfig, actions: Action[]): string[] {
  const lines: string[] = [];
  let s: GameState = engine.init(seed, cfg);
  let acts: string[] = [];
  let sol = 1;
  for (const a of actions) {
    if (s.outcome) break;
    if (engine.check(s, a)) continue; // skipped in a lenient replay
    if (a.type === 'resolve') acts.push(`${a.faultId}:${a.optionId}`);
    if (a.type === 'routine') acts.push(`[${a.routineId}]`);
    s = engine.step(s, a);
    if (a.type === 'endSol' || s.outcome) {
      const auto = s.decisions.filter((d) => d.sol === sol && d.auto).map((d) => `${d.faultId}:${d.optionId}(auto)`);
      const h = s.history.at(-1)!;
      lines.push(
        `sol ${String(sol).padStart(2)} P${h.res.power.toFixed(0).padStart(4)} L${h.res.life.toFixed(0).padStart(4)} S${h.res.shield.toFixed(0).padStart(4)} H${h.health.toFixed(0).padStart(4)} D${h.dose.toFixed(1).padStart(6)} | ${[...acts, ...auto].join(' ')}`,
      );
      acts = [];
      sol = s.sol;
    }
  }
  return lines;
}

it('demo dump', () => {
  if (!process.env.DUMP_SEED) return;
  const cfg = configFor(level());
  const seed = Number(process.env.DUMP_SEED);
  const run = playGame(engine, demoPlayers[process.env.DUMP_PLAYER!]!, seed, cfg, Number(process.env.DUMP_SALT ?? 1));
  const f0 = run.final;
  const out = [
    `ORIGINAL outcome ${JSON.stringify(f0.outcome)} hp ${f0.health} dose ${f0.dose} dmg ${JSON.stringify(f0.damage)} reserves ${f0.reservesUsed} actions ${run.actions.length}`,
    ...perSol(seed, cfg, run.actions),
  ];
  if (process.env.DUMP_FIX) {
    const [faultId, optionId] = process.env.DUMP_FIX.split(':');
    const idx = f0.decisions.findIndex((d) => d.faultId === faultId);
    const cf = counterfactual(engine, { seed, config: cfg, actions: run.actions }, idx, optionId!);
    const f = cf.alt.final;
    out.push(
      `CHANGED ${cf.decision.key} ${cf.from} -> ${cf.to}: outcome ${JSON.stringify(f.outcome)} hp ${f.health} dose ${f.dose} dmg ${JSON.stringify(f.damage)} reserves ${f.reservesUsed} skipped ${JSON.stringify(cf.alt.skipped.map((x) => [x.sol, x.action, x.reason]))} autopilotFrom ${cf.alt.autopilotFromSol}`,
    );
    for (const h of f.history) out.push(`   alt sol ${String(h.sol).padStart(2)} P${h.res.power.toFixed(0).padStart(4)} L${h.res.life.toFixed(0).padStart(4)} S${h.res.shield.toFixed(0).padStart(4)} H${h.health.toFixed(0).padStart(4)} D${h.dose.toFixed(1).padStart(6)}`);
    out.push(`explanation ${JSON.stringify(cf.explanation.steps)}`);
  }
  process.stdout.write(out.join('\n') + '\n');
});

// Careful bot with several options forced at once (no-op without FORCE):
//   FORCE='[["s6_shelter","regolith"],["s9_shed","heaterDown"]]' [LEVEL=commander] npx vitest run tests/tools/mission-line.test.ts -t forced
it('forced', () => {
  if (!process.env.FORCE) return;
  const st = runBatch(engine, forcing(JSON.parse(process.env.FORCE)), seeds(), configFor(level()));
  const l = st.games - st.wins || 1;
  process.stdout.write(`${level()} ${process.env.FORCE}: careful+forced win ${pct(st.winRate)}% (P${pct(st.lossCauses.power / l)} L${pct(st.lossCauses.life / l)} S${pct(st.lossCauses.shield / l)}) hp on win ${st.avgHealthOnWin.toFixed(1)}\n`);
});
