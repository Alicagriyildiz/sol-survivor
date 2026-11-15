import type { Engine } from '../sim/engine';
import type { Cause, MissionConfig } from '../sim/types';
import { playGame, type GameRun, type Policy } from './bots';

export interface BatchStats {
  games: number;
  wins: number;
  winRate: number;
  lossCauses: Record<Cause, number>;
  lossSols: Record<number, number>;
  avgHealthOnWin: number;
  runs: GameRun[];
}

export function runBatch(engine: Engine, policy: Policy, seeds: number[], config: MissionConfig): BatchStats {
  const runs = seeds.map((seed) => playGame(engine, policy, seed, config));
  const lossCauses: Record<Cause, number> = { power: 0, life: 0, shield: 0 };
  const lossSols: Record<number, number> = {};
  let wins = 0;
  let hp = 0;
  for (const r of runs) {
    const o = r.final.outcome!;
    if (o.won) {
      wins++;
      hp += r.final.health;
    } else {
      lossCauses[o.cause!]++;
      lossSols[o.sol] = (lossSols[o.sol] ?? 0) + 1;
    }
  }
  return { games: runs.length, wins, winRate: wins / runs.length, lossCauses, lossSols, avgHealthOnWin: wins ? hp / wins : 0, runs };
}

export const seedRange = (n: number, start = 1): number[] => Array.from({ length: n }, (_, i) => start + i);
