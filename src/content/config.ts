import type { MissionConfig } from '../sim/types';

/** Below this a gauge hurts Health every hour, and the one-time emergency reserve kicks in
 *  at the same line (session 3 rule: no silent band where Health drains but the reserve
 *  waits). The reserve is not free: that gauge then wears 2 points faster every night
 *  (session 4; see docs/DESIGN.md §1). */
const CRITICAL = 25;

/** Default mission. A future "cargo selection" screen can build other configs. */
export const DEFAULT_CONFIG: MissionConfig = {
  solCount: 15,
  hoursPerSol: 10,
  start: { power: 70, life: 70, shield: 60, health: 100 },
  inventory: { patchKit: 1, spareFilter: 1, tape: 2 },
  rules: {
    critical: CRITICAL,
    maxDamagePerHour: 0.9,
    nightHours: 14,
    nightly: { power: -4.25, life: -5.5, shield: -5.25 },
    lowPowerThreshold: 25,
    lowPowerLifePenalty: 3,
    nightHeal: 8,
    comfortable: 20,
    nightlyRadiation: 2,
    shieldFactor: 0.7,
    radHealthPerDose: 0.8,
    reserve: { threshold: CRITICAL, amount: 30, wear: 2 },
    eva: { hours: 1, life: 3, radiation: 3 },
  },
};

export const ITEMS = ['patchKit', 'spareFilter', 'tape'] as const;

export type Level = 'junior' | 'commander';

/** Commander ("Komutan") mission: same scenario, same rules, but the base starts with less
 *  Power and Life Support (57 / 61 instead of 70 / 70). That removes the slack a careful
 *  player has before the storm (sol 9) and the solar event (sol 12).
 *  Bot numbers (seeds 1-200, tests/commander.test.ts): careful 44%, random 2.5%, idle 0%,
 *  no loss on sol 1. Chosen over 60 / 60 (careful 46%) because there reinforcing the sol 6
 *  shelter alone lifted the careful bot to 95.5%; here it gives 67%, and the careful bot's
 *  losses are split between Power, Life and Shield instead of ~85% Shield.
 *  Session 7: the Commander screen gives no suggestions (no suggested station or job, no
 *  target arrow, no hint tags); the task line only lists open faults and their stations.
 *  A player who does exactly what the screen shows (src/bots/follower.ts: faults in listed
 *  order, first card, then end the sol) wins 0% here; careful 44% (target <= 35% / 35-55%),
 *  so these numbers were kept. */
export const COMMANDER_CONFIG: MissionConfig = {
  ...DEFAULT_CONFIG,
  start: { ...DEFAULT_CONFIG.start, power: 57, life: 61 },
};

export function configFor(level: Level): MissionConfig {
  return level === 'commander' ? COMMANDER_CONFIG : DEFAULT_CONFIG;
}
