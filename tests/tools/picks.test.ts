// Dev tool (no-op without PICKS=1): how often each bot picks each option, per fault.
import { it } from 'vitest';
import { BOTS, playGame, type BotName } from '../../src/bots/bots';
import { DEFAULT_CONFIG, engine } from '../../src/content';

it('picks', () => {
  if (!process.env.PICKS) return;
  const bot = (process.env.BOT ?? 'careful') as BotName;
  const n = Number(process.env.N ?? 200);
  const counts: Record<string, Record<string, number>> = {};
  for (let seed = 1; seed <= n; seed++) {
    const run = playGame(engine, BOTS[bot], seed, DEFAULT_CONFIG);
    for (const d of run.final.decisions) {
      const k = d.faultId;
      counts[k] ??= {};
      const o = d.auto ? `${d.optionId}(auto)` : d.optionId;
      counts[k][o] = (counts[k][o] ?? 0) + 1;
    }
  }
  for (const [f, c] of Object.entries(counts)) process.stdout.write(`${f.padEnd(14)} ${JSON.stringify(c)}\n`);
});
