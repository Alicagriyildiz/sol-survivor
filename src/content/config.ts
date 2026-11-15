import type { MissionConfig } from '../sim/types';

/** Below this a gauge hurts Health every hour, and the one-time emergency reserve kicks in
 *  at the same line (session 3 rule: no silent band where Health drains but the reserve
 *  waits; see docs/DESIGN.md §1). */
const CRITICAL = 25;

/** Default mission. A future "cargo selection" screen can build other configs. */
export const DEFAULT_CONFIG: MissionConfig = {
  solCount: 15,
  hoursPerSol: 10,
  start: { power: 70, life: 70, shield: 60, health: 100 },
  inventory: { patchKit: 1, spareFilter: 1, tape: 2 },
  rules: {
    critical: CRITICAL,
    maxDamagePerHour: 1.1,
    nightHours: 14,
    nightly: { power: -5.75, life: -8.25, shield: -4 },
    lowPowerThreshold: 25,
    lowPowerLifePenalty: 3,
    nightHeal: 10,
    comfortable: 25,
    nightlyRadiation: 2,
    shieldFactor: 0.7,
    radHealthPerDose: 0.6,
    reserve: { threshold: CRITICAL, amount: 52 },
    eva: { hours: 1, life: 3, radiation: 3 },
  },
};

export const ITEMS = ['patchKit', 'spareFilter', 'tape'] as const;
