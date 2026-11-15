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
