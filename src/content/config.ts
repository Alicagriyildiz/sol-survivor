import type { MissionConfig } from '../sim/types';

/** Default mission. A future "cargo selection" screen can build other configs. */
export const DEFAULT_CONFIG: MissionConfig = {
  solCount: 15,
  hoursPerSol: 10,
  start: { power: 70, life: 70, shield: 60, health: 100 },
  inventory: { patchKit: 1, spareFilter: 1, tape: 2 },
  rules: {
    critical: 25,
    maxDamagePerHour: 0.9,
    nightHours: 14,
    nightly: { power: -4.75, life: -6.75, shield: -4.5 },
    lowPowerThreshold: 25,
    lowPowerLifePenalty: 3,
    nightHeal: 4,
    comfortable: 20,
    nightlyRadiation: 2,
    shieldFactor: 0.7,
    radHealthPerDose: 0.6,
    reserve: { threshold: 10, amount: 35 },
    eva: { hours: 1, life: 3, radiation: 3 },
  },
};

export const ITEMS = ['patchKit', 'spareFilter', 'tape'] as const;
