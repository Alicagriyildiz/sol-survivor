// Core types for the pure simulation. The core interprets a ContentPack; it never
// hard-codes scenario details (stations, faults, flags) itself.

export const RESOURCES = ['power', 'life', 'shield'] as const;
export type ResourceId = (typeof RESOURCES)[number];
/** Every point of health damage is attributed to one of the three base resources. */
export type Cause = ResourceId;

export type ResourceMap = Record<ResourceId, number>;

/** A number, or a value taken from a seeded roll made at init: roll * mul + add. */
export type Amount = number | { roll: string; mul?: number; add?: number };

export type Cond =
  | { flag: string }
  | { notFlag: string }
  | { roll: string; eq: number }
  | { res: ResourceId; lt?: number; gte?: number }
  | { item: string; gte: number }
  | { solLt: number }
  | { solGte: number }
  | { all: Cond[] }
  | { any: Cond[] };

export type Effect =
  | { kind: 'res'; res: ResourceId; amount: Amount }
  | { kind: 'health'; amount: Amount; cause: Cause }
  | { kind: 'dose'; amount: Amount }
  /** Radiation hit: received = amount * (1 - shieldFactor * shield/100). Adds dose and
   *  costs health (received * radHealthPerDose), cause = shield. */
  | { kind: 'radiation'; amount: Amount }
  | { kind: 'item'; item: string; amount: number }
  | { kind: 'hours'; amount: number }
  | { kind: 'flag'; flag: string; value?: boolean }
  | { kind: 'if'; cond: Cond; then: Effect[]; else?: Effect[] }
  /** Delayed effect: fires at the morning or night of (current sol + inSols). */
  | { kind: 'later'; inSols: number; at: 'morning' | 'night'; effects: Effect[]; label: string }
  /** Nightly change that lasts `sols` nights, or until fault `untilResolved` is resolved. */
  | {
      kind: 'modifier';
      id: string;
      nightly: Partial<ResourceMap>;
      sols?: number;
      untilResolved?: string;
      label: string;
    }
  | { kind: 'removeModifier'; id: string }
  /** The given fault opens again next morning (used by defer options). */
  | { kind: 'reopen'; faultId: string };

export type OptionKind = 'quick' | 'robust' | 'creative' | 'defer';

export interface OptionDef {
  id: string;
  kind: OptionKind;
  /** Work hours (walking is added by the core). */
  hours: number;
  /** Items consumed. */
  items?: Record<string, number>;
  /** Extra availability condition (besides hours/items/station lock). */
  requires?: Cond;
  /** Where the work happens; defaults to the fault's station. Defer options never walk. */
  station?: string;
  effects: Effect[];
  /** Machine-readable hint tags mirroring the player-facing "why" text. */
  tags?: OptionTag[];
}

/** invest: pays off later. laterCost: cheap now, costs later. */
export type OptionTag = 'invest' | 'laterCost';

export interface FaultDef {
  id: string;
  station: string;
  /** Fault only spawns when this holds at the morning of its sol (used for variants). */
  when?: Cond;
  options: OptionDef[];
}

export interface SolDef {
  sol: number;
  morning?: Effect[];
  night?: Effect[];
  faults: FaultDef[];
}

export interface StationDef {
  id: string;
  /** Walk time (hours) from the main corridor. Walking A->B costs walk(A)+walk(B). */
  walk: number;
  eva: boolean;
  lockedWhen?: Cond;
}

export interface RoutineDef {
  id: string;
  station: string;
  hours: number;
  effects: Effect[];
}

export interface RollDef {
  id: string;
  /** Uniform integer in [min, max]. */
  min: number;
  max: number;
}

export interface ContentPack {
  stations: StationDef[];
  homeStation: string;
  sols: SolDef[];
  routines: RoutineDef[];
  rolls: RollDef[];
}

export interface Rules {
  /** Below this a resource hurts health every hour. */
  critical: number;
  /** Health loss per hour when a resource is at 0 (scales linearly up to `critical`). */
  maxDamagePerHour: number;
  /** Hours of night counted for critical damage. */
  nightHours: number;
  /** Passive nightly change of each resource. */
  nightly: ResourceMap;
  /** If power is below this at night, life support loses `lowPowerLifePenalty` extra. */
  lowPowerThreshold: number;
  lowPowerLifePenalty: number;
  /** Health regained at night if every resource is >= `comfortable`. */
  nightHeal: number;
  comfortable: number;
  /** Background radiation each night (before shield). */
  nightlyRadiation: number;
  shieldFactor: number;
  radHealthPerDose: number;
  /** One-time emergency reserve per resource: the first time it drops below `threshold`,
   *  it gains `amount`. Gives a struggling player a second chance. */
  reserve: { threshold: number; amount: number };
  /** Extra costs for any work at an EVA station. */
  eva: { hours: number; life: number; radiation: number };
}

export interface MissionConfig {
  solCount: number;
  hoursPerSol: number;
  start: ResourceMap & { health: number };
  inventory: Record<string, number>;
  rules: Rules;
}

// ---------------------------------------------------------------- state

/** Stable key of a decision: one per (sol, fault). */
export type DecisionKey = string;

export type Source =
  | { kind: 'decision'; key: DecisionKey; optionId: string; auto: boolean }
  | { kind: 'routine'; id: string }
  | { kind: 'event'; id: string }
  | { kind: 'pending'; label: string }
  | { kind: 'modifier'; id: string; label: string }
  | { kind: 'night' }
  | { kind: 'critical'; res: ResourceId }
  | { kind: 'reserve'; res: ResourceId }
  | { kind: 'walk' };

export interface Deltas {
  power?: number;
  life?: number;
  shield?: number;
  health?: number;
  dose?: number;
  hours?: number;
  items?: Record<string, number>;
}

export interface TraceEntry {
  sol: number;
  at: 'morning' | 'day' | 'night';
  /** Pairing key used to compare two runs. */
  key: string;
  source: Source;
  deltas: Deltas;
  /** Decisions whose consequences produced this entry. */
  causes: DecisionKey[];
}

export interface FlagRec {
  value: boolean;
  origin: DecisionKey[];
}

export interface OpenFault {
  faultId: string;
  /** Sol the fault first appeared. */
  firstSol: number;
}

export interface PendingRec {
  dueSol: number;
  at: 'morning' | 'night';
  effects: Effect[];
  label: string;
  causes: DecisionKey[];
}

export interface ModifierRec {
  id: string;
  nightly: Partial<ResourceMap>;
  remaining: number | null;
  untilResolved: string | null;
  label: string;
  causes: DecisionKey[];
}

export interface DecisionRec {
  index: number;
  key: DecisionKey;
  sol: number;
  faultId: string;
  optionId: string;
  /** True when the fault was left open at end of sol and deferred automatically. */
  auto: boolean;
  /** Index into the action list (null for auto decisions). */
  actionIndex: number | null;
}

export interface SolSnapshot {
  sol: number;
  res: ResourceMap;
  health: number;
  dose: number;
}

export interface Outcome {
  won: boolean;
  sol: number;
  /** For losses: the cause with the most health damage over the mission. */
  cause: Cause | null;
}

export interface GameState {
  seed: number;
  config: MissionConfig;
  rolls: Record<string, number>;
  sol: number;
  hoursLeft: number;
  location: string;
  res: ResourceMap;
  health: number;
  dose: number;
  items: Record<string, number>;
  flags: Record<string, FlagRec>;
  faults: OpenFault[];
  routinesDone: string[];
  reopenNext: { faultId: string; firstSol: number }[];
  pending: PendingRec[];
  modifiers: ModifierRec[];
  decisions: DecisionRec[];
  actionCount: number;
  trace: TraceEntry[];
  history: SolSnapshot[];
  damage: Record<Cause, number>;
  /** Resources whose emergency reserve has been used. */
  reservesUsed: ResourceId[];
  outcome: Outcome | null;
}

export type Action =
  | { type: 'resolve'; faultId: string; optionId: string }
  | { type: 'routine'; routineId: string }
  | { type: 'endSol' };

export type Invalid =
  | 'ended'
  | 'noFault'
  | 'noOption'
  | 'noRoutine'
  | 'routineDone'
  | 'hours'
  | 'items'
  | 'locked'
  | 'requires';
