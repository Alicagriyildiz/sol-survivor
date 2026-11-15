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
 *  Power and Life Support (60 instead of 70). Ten points sounds small, but it removes the
 *  slack a careful player has before the storm (sol 9) and the solar event (sol 12).
 *  Bot targets (tests/commander.test.ts, seeds 1-200): careful 40-60%, random < 8%,
 *  doing nothing 0%, no loss on sol 1. */
export const COMMANDER_CONFIG: MissionConfig = {
  ...DEFAULT_CONFIG,
  start: { ...DEFAULT_CONFIG.start, power: 60, life: 60 },
};

export function configFor(level: Level): MissionConfig {
  return level === 'commander' ? COMMANDER_CONFIG : DEFAULT_CONFIG;
}
