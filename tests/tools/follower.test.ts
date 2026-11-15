// Dev tool (no-op without FOLLOW): screen-follower bots vs. the balance bots, per level.
//   FOLLOW=1 [N=200 START=1] npx vitest run tests/tools/follower.test.ts
// With FOLLOW_GRID, one JSON override per entry merged into COMMANDER_CONFIG
// ({start, rules:{nightly, reserve, ...}}), commander only:
//   FOLLOW=1 FOLLOW_GRID='[{"start":{"power":55}}]' npx vitest run tests/tools/follower.test.ts
import { it } from 'vitest';
import { BOTS, type Policy } from '../../src/bots/bots';
import { followerFor } from '../../src/bots/follower';
import { runBatch, seedRange } from '../../src/bots/stats';
import { engine } from '../../src/content';
import { COMMANDER_CONFIG, configFor } from '../../src/content/config';
import type { MissionConfig } from '../../src/sim/types';

const pct = (x: number) => (Math.round(x * 1000) / 10).toFixed(1);
const seeds = () => seedRange(Number(process.env.N ?? 200), Number(process.env.START ?? 1));

function row(cfg: MissionConfig, players: Record<string, Policy>): string {
  return Object.entries(players)
    .map(([name, p]) => {
      const st = runBatch(engine, p, seeds(), cfg);
      const l = st.games - st.wins || 1;
      return `${name} ${pct(st.winRate)}% (P${pct(st.lossCauses.power / l)} L${pct(st.lossCauses.life / l)} S${pct(st.lossCauses.shield / l)}${st.lossSols[1] ? ' SOL1!' : ''})`;
    })
    .join(' | ');
}

it('follower', () => {
  if (!process.env.FOLLOW) return;
  const out: string[] = [];
  const grid: any[] | null = process.env.FOLLOW_GRID ? JSON.parse(process.env.FOLLOW_GRID) : null;
  if (!grid) {
    for (const level of ['junior', 'commander'] as const)
      out.push(`${level}: ${row(configFor(level), { follower: followerFor(level), careful: BOTS.careful, random: BOTS.random, idle: BOTS.idle })}`);
  } else {
    for (const o of grid) {
      const b = COMMANDER_CONFIG;
      const cfg: MissionConfig = {
        ...b,
        start: { ...b.start, ...(o.start ?? {}) },
        rules: {
          ...b.rules,
          ...(o.rules ?? {}),
          nightly: { ...b.rules.nightly, ...(o.rules?.nightly ?? {}) },
          reserve: { ...b.rules.reserve, ...(o.rules?.reserve ?? {}) },
        },
      };
      out.push(`${JSON.stringify(o)}\n   ${row(cfg, { follower: followerFor('commander'), careful: BOTS.careful, random: BOTS.random, idle: BOTS.idle })}`);
    }
  }
  process.stdout.write(out.join('\n') + '\n');
});
