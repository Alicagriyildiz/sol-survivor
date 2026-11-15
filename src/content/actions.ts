// Presentation only: how each choice is acted out in the first-person 3D view.
// The core never reads this file and nothing here changes a number. Every option of
// every fault (and every maintenance job) maps to one of eight action kinds; the 3D
// scene plays the kind with a station-specific tool and object (tests/actions.test.ts).

export type ActionKind =
  /** Wipe / clean: brush a panel, wash soil, clean a seal or sensor. */
  | 'wipe'
  /** Tape / patch: close a leak, tape a filter to fit, patch a crack. */
  | 'patch'
  /** Swap a part: new filter, pump, seal. */
  | 'replace'
  /** Turn a valve or flip a switch: shed load, heater off, start oxygen. */
  | 'switch'
  /** Plug a cable / charge: fill batteries, power the beacon. */
  | 'plug'
  /** Pile regolith / clear ground: shelter wall, landing pad. */
  | 'dig'
  /** Use the console: message Earth, start a system, change a setting. */
  | 'console'
  /** Wait / watch: defer, wait for the wind, sit in the shelter. Hours pass, nothing is done. */
  | 'wait';

export const ACTION_KINDS: ActionKind[] = ['wipe', 'patch', 'replace', 'switch', 'plug', 'dig', 'console', 'wait'];

/** faultId -> optionId -> kind. Every `defer` is 'wait'. */
export const OPTION_ACTIONS: Record<string, Record<string, ActionKind>> = {
  s1_wakeup: { stepByStep: 'switch', allAtOnce: 'switch', defer: 'wait' },
  s1_seal: { newSeal: 'replace', wipe: 'wipe', defer: 'wait' },
  s2_pump: { overhaul: 'replace', oil: 'wipe', defer: 'wait' },
  s2_filter: { replace: 'replace', backflush: 'switch', tap: 'wipe', defer: 'wait' },
  s3_soil: { wash: 'wipe', hydro: 'replace', hardy: 'dig', defer: 'wait' },
  s4_dust: { brush: 'wipe', sandTrick: 'dig', dim: 'switch', defer: 'wait' },
  s5_oxygen: { fullPower: 'switch', halfNight: 'console', plants: 'console', defer: 'wait' },
  s6_shelter: { regolith: 'dig', waterWall: 'replace', defer: 'wait' },
  s7_message: { follow: 'console', ownCall: 'console', report: 'console', defer: 'wait' },
  s8_charge: { full: 'plug', half: 'plug', defer: 'wait' },
  s8_secure: { anchor: 'patch', cables: 'plug', defer: 'wait' },
  s9_shed: { greenhouseOff: 'switch', heaterDown: 'switch', shelterHeat: 'switch', defer: 'wait' },
  s10_co2: { adapter: 'replace', apollo: 'patch', shake: 'wipe', defer: 'wait' },
  s11_panels: { brush: 'wipe', halfClean: 'wipe', defer: 'wait' },
  s12_spe: { hideAll: 'wait', hideShort: 'wait', waterCorner: 'replace', defer: 'wait' },
  s13_leakA: { patchKit: 'patch', teaLeaves: 'patch', sealOff: 'switch', defer: 'wait' },
  s13_leakB: { patchKit: 'patch', teaLeaves: 'patch', sealOff: 'switch', defer: 'wait' },
  s13_pad: { clearPad: 'dig', markPad: 'dig', defer: 'wait' },
  s14_pump: { replacePump: 'replace', borrowPump: 'replace', halfBattery: 'switch', defer: 'wait' },
  s14_radiator: { cleanRadiator: 'wipe', borrowPump: 'replace', halfBattery: 'switch', defer: 'wait' },
  s15_beacon: { fullBeacon: 'plug', dimBeacon: 'plug', reflectors: 'dig', defer: 'wait' },
};

/** Maintenance jobs. */
export const ROUTINE_ACTIONS: Record<string, ActionKind> = {
  tend: 'wipe',
  tune: 'console',
  bags: 'dig',
};

export function optionAction(faultId: string, optionId: string): ActionKind {
  return OPTION_ACTIONS[faultId]?.[optionId] ?? (optionId === 'defer' ? 'wait' : 'console');
}

export function routineAction(routineId: string): ActionKind {
  return ROUTINE_ACTIONS[routineId] ?? 'console';
}
