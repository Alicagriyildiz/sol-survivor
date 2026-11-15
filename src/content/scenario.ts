// The 15-sol scenario as data. Text lives in lang/tr.ts, keyed by the ids used here.
import { applyTuning, TUNING } from './tuning';
import { SOLAR_EVENT_ROLL, SOLAR_EVENTS, STORM_NIGHT_POWER_LOSS } from './data';
import type { Amount, ChainNote, Cond, ContentPack, Effect, OptionDef, ResourceId, SolDef } from '../sim/types';

// ---------------------------------------------------------------- effect helpers
const res = (r: ResourceId, amount: Amount): Effect => ({ kind: 'res', res: r, amount });
const P = (n: Amount) => res('power', n);
const L = (n: Amount) => res('life', n);
const S = (n: Amount) => res('shield', n);
const hp = (n: number, cause: ResourceId): Effect => ({ kind: 'health', amount: n, cause });
const rad = (n: Amount): Effect => ({ kind: 'radiation', amount: n });
const flag = (f: string, value = true): Effect => ({ kind: 'flag', flag: f, value });
const iff = (cond: Cond, then: Effect[], otherwise: Effect[] = []): Effect => ({ kind: 'if', cond, then, else: otherwise });
const later = (inSols: number, at: 'morning' | 'night', label: string, effects: Effect[]): Effect => ({
  kind: 'later',
  inSols,
  at,
  label,
  effects,
});
const mod = (id: string, nightly: Partial<Record<ResourceId, number>>, opts: { sols?: number; until?: string } = {}): Effect => ({
  kind: 'modifier',
  id,
  nightly,
  label: id,
  ...(opts.sols !== undefined ? { sols: opts.sols } : {}),
  ...(opts.until !== undefined ? { untilResolved: opts.until } : {}),
});
const unmod = (id: string): Effect => ({ kind: 'removeModifier', id });
const reopen = (faultId: string): Effect => ({ kind: 'reopen', faultId });
/** Chain note: text id `id` (lang file `chain`) shown when `when` holds. */
const note = (when: Cond, id: string): ChainNote => ({ when, id });
const noFlags = (...flags: string[]): Cond => ({ all: flags.map((f) => ({ notFlag: f })) });
const defer = (effects: Effect[], tags: OptionDef['tags'] = ['laterCost']): OptionDef => ({
  id: 'defer',
  kind: 'defer',
  hours: 0,
  effects,
  tags,
});

// ---------------------------------------------------------------- chain notes (shared)
const soilNotes = [note({ flag: 'soilClean' }, 'soilClean'), note({ notFlag: 'soilClean' }, 'soilDirty')];
const shelterNotes = [
  note({ flag: 'shelterReinforced' }, 'shelterReinforced'),
  note({ all: [{ notFlag: 'shelterReinforced' }, { flag: 'shelterWater' }] }, 'shelterWater'),
  note(noFlags('shelterReinforced', 'shelterWater'), 'shelterThin'),
];
const recyclerNotes = [note({ flag: 'recyclerServiced' }, 'recyclerServiced'), note({ notFlag: 'recyclerServiced' }, 'recyclerNotServiced')];
const tapeNotes = [note({ not: { item: 'tape', gte: 1 } }, 'tapeGone')];

// ---------------------------------------------------------------- sols

const sol1: SolDef = {
  sol: 1,
  faults: [
    {
      id: 's1_wakeup',
      station: 'hub',
      options: [
        { id: 'stepByStep', kind: 'robust', hours: 3, effects: [P(-2), L(4)] },
        { id: 'allAtOnce', kind: 'quick', hours: 1, effects: [P(-6), L(2)] },
        defer([L(-3)]),
      ],
    },
    {
      id: 's1_seal',
      station: 'airlock',
      options: [
        { id: 'newSeal', kind: 'robust', hours: 2, effects: [P(-1), L(2)] },
        { id: 'wipe', kind: 'quick', hours: 0.5, effects: [later(2, 'night', 'sealWear', [L(-3)])], tags: ['laterCost'] },
        defer([mod('sealLeak', { life: -1 }, { until: 's1_seal' }), reopen('s1_seal')]),
      ],
    },
  ],
};

const recyclerDefer = (faultId: string) =>
  defer([mod('waterLoss', { life: -3 }, { until: faultId }), reopen(faultId)]);

const sol2: SolDef = {
  sol: 2,
  faults: [
    {
      id: 's2_pump',
      station: 'hub',
      when: { roll: 'sol2v', eq: 0 },
      options: [
        { id: 'overhaul', kind: 'robust', hours: 4, effects: [P(-4), flag('recyclerServiced')], tags: ['invest'] },
        { id: 'oil', kind: 'quick', hours: 1, effects: [later(4, 'night', 'recyclerWorn', [L(-6)])], tags: ['laterCost'] },
        recyclerDefer('s2_pump'),
      ],
    },
    {
      id: 's2_filter',
      station: 'hub',
      when: { roll: 'sol2v', eq: 1 },
      options: [
        { id: 'replace', kind: 'robust', hours: 3, effects: [P(-3), L(-2), flag('recyclerServiced')], tags: ['invest'] },
        { id: 'backflush', kind: 'creative', hours: 2, effects: [L(-6), flag('recyclerServiced')], tags: ['invest'] },
        { id: 'tap', kind: 'quick', hours: 1, effects: [later(3, 'night', 'recyclerWorn', [L(-6)])], tags: ['laterCost'] },
        recyclerDefer('s2_filter'),
      ],
    },
  ],
};

const garden = (perNight: number) => mod('garden', { life: perNight }, { sols: 12 });

const sol3: SolDef = {
  sol: 3,
  faults: [
    {
      id: 's3_soil',
      station: 'greenhouse',
      options: [
        { id: 'wash', kind: 'robust', hours: 3, effects: [L(-6), P(-3), flag('soilClean'), garden(1.5)], tags: ['invest'] },
        {
          id: 'hydro',
          kind: 'creative',
          hours: 4,
          effects: [P(-5), flag('soilClean'), garden(1.5), mod('hydroPump', { power: -0.5 }, { sols: 12 })],
          tags: ['invest'],
        },
        { id: 'hardy', kind: 'quick', hours: 1, effects: [garden(0.5)] },
        defer([later(2, 'morning', 'foodShort', [L(-6)])]),
      ],
    },
  ],
};

const sol4: SolDef = {
  sol: 4,
  morning: [
    ...[0, 1, 2].map((lvl) => iff({ roll: 'dustLevel', eq: lvl }, [mod('dust', { power: -1 - 2 * lvl }, { until: 's4_dust' })])),
  ],
  faults: [
    {
      id: 's4_dust',
      station: 'solar',
      options: [
        { id: 'brush', kind: 'robust', hours: 3, effects: [P(4)] },
        {
          id: 'sandTrick',
          kind: 'creative',
          hours: 2,
          effects: [P(2), mod('dustLight', { power: -1 }, { sols: 5 }), flag('panelsTilted')],
          tags: ['invest'],
        },
        { id: 'dim', kind: 'quick', hours: 0.5, station: 'hub', effects: [L(-1), mod('dustStays', { power: -3 }, { sols: 5 })], tags: ['laterCost'] },
        defer([]),
      ],
    },
  ],
};

const sol5: SolDef = {
  sol: 5,
  notes: soilNotes,
  morning: [L({ roll: 'o2Deficit', mul: -4 })],
  faults: [
    {
      id: 's5_oxygen',
      station: 'hub',
      options: [
        { id: 'fullPower', kind: 'robust', hours: 2, effects: [P(-10), L(12)] },
        { id: 'halfNight', kind: 'quick', hours: 1, effects: [P(-6), L(5)] },
        {
          id: 'plants',
          kind: 'creative',
          hours: 1,
          station: 'greenhouse',
          effects: [P(-1), iff({ flag: 'soilClean' }, [L(7)], [L(2)])],
          notes: soilNotes,
        },
        defer([L(-6), later(1, 'night', 'o2Short', [L(-10)])]),
      ],
    },
  ],
};

const sol6: SolDef = {
  sol: 6,
  faults: [
    {
      id: 's6_shelter',
      station: 'shelter',
      options: [
        // A thick wall also wears less every night (regolith cover, see the sol 6 note).
        {
          id: 'regolith',
          kind: 'robust',
          hours: 4,
          effects: [P(-2), S(8), flag('shelterReinforced'), mod('thickWall', { shield: 1.5 }, { sols: 9 })],
          tags: ['invest'],
        },
        { id: 'waterWall', kind: 'quick', hours: 2, effects: [L(-4), S(5), flag('shelterWater')], tags: ['invest'] },
        defer([S(-6)]),
      ],
    },
  ],
};

const sol7: SolDef = {
  sol: 7,
  faults: [
    {
      id: 's7_message',
      station: 'hub',
      options: [
        { id: 'follow', kind: 'robust', hours: 2, effects: [P(8), L(-6), flag('beaconReserve')], tags: ['invest'] },
        { id: 'ownCall', kind: 'quick', hours: 1, effects: [L(3), P(-2)] },
        { id: 'report', kind: 'creative', hours: 3, effects: [L(-2), flag('sentReport')], tags: ['invest'] },
        defer([later(1, 'morning', 'repeatMessage', [{ kind: 'hours', amount: -2 }])]),
      ],
    },
  ],
};

const sol8: SolDef = {
  sol: 8,
  night: [flag('storm')],
  faults: [
    {
      id: 's8_charge',
      station: 'battery',
      options: [
        { id: 'full', kind: 'robust', hours: 4, effects: [L(-4), P(10), flag('stormPrepped')], tags: ['invest'] },
        { id: 'half', kind: 'quick', hours: 2, effects: [L(-1), P(5)] },
        defer([]),
      ],
    },
    {
      id: 's8_secure',
      station: 'solar',
      options: [
        { id: 'anchor', kind: 'robust', hours: 2, effects: [flag('panelsSecured')], tags: ['invest'] },
        { id: 'cables', kind: 'quick', hours: 1, station: 'airlock', effects: [flag('panelsHalf')] },
        defer([]),
      ],
    },
  ],
};

const sol9: SolDef = {
  sol: 9,
  notes: [note({ flag: 'stormPrepped' }, 'stormPrepped'), note({ notFlag: 'stormPrepped' }, 'stormNotPrepped')],
  morning: [
    unmod('dust'),
    unmod('dustStays'),
    unmod('dustLight'),
    S(-5),
    iff({ flag: 'stormPrepped' }, [P({ roll: 'stormHit', mul: -2, add: -4 })], [P({ roll: 'stormHit', mul: -3, add: -10 })]),
    // Storm nights: the panels give nothing (2018 storm opacity, see content/data.ts).
    ...[1, 2, 3, 4].map((n) => iff({ roll: 'stormNights', eq: n }, [mod('storm', { power: -STORM_NIGHT_POWER_LOSS }, { sols: n })])),
  ],
  faults: [
    {
      id: 's9_shed',
      station: 'battery',
      options: [
        { id: 'greenhouseOff', kind: 'robust', hours: 1, effects: [P(10), unmod('garden'), L(-3)] },
        { id: 'heaterDown', kind: 'quick', hours: 1, effects: [P(12), hp(-6, 'power')] },
        { id: 'shelterHeat', kind: 'creative', hours: 1, station: 'shelter', effects: [P(10), S(-8)] },
        defer([later(0, 'night', 'fullLoad', [P(-5)])]),
      ],
    },
  ],
};

const sol10: SolDef = {
  sol: 10,
  morning: [mod('co2', { life: -4 }, { until: 's10_co2' })],
  faults: [
    {
      id: 's10_co2',
      station: 'hub',
      options: [
        { id: 'adapter', kind: 'robust', hours: 5, items: { spareFilter: 1 }, effects: [P(-3), L(10)] },
        { id: 'apollo', kind: 'creative', hours: 3, items: { tape: 2 }, effects: [L(8)] },
        { id: 'shake', kind: 'quick', hours: 1, effects: [L(2), later(1, 'night', 'filterClogged', [L(-6)])], tags: ['laterCost'] },
        defer([reopen('s10_co2')]),
      ],
    },
  ],
};

const sol11: SolDef = {
  sol: 11,
  notes: [
    note({ flag: 'panelsSecured' }, 'panelsSecured'),
    note({ all: [{ notFlag: 'panelsSecured' }, { flag: 'panelsHalf' }] }, 'panelsHalf'),
    note(noFlags('panelsSecured', 'panelsHalf'), 'panelsLoose'),
    note({ flag: 'panelsTilted' }, 'panelsTilted'),
  ],
  morning: [
    flag('storm', false),
    iff({ flag: 'panelsSecured' }, [mod('stormDust', { power: -1 }, { until: 's11_panels' })], [
      iff({ flag: 'panelsHalf' }, [mod('stormDust', { power: -5 }, { until: 's11_panels' })], [
        mod('stormDust', { power: -6 }, { until: 's11_panels' }),
      ]),
    ]),
  ],
  faults: [
    {
      id: 's11_panels',
      station: 'solar',
      options: [
        { id: 'brush', kind: 'robust', hours: 4, effects: [P(5)] },
        { id: 'halfClean', kind: 'quick', hours: 2, effects: [P(2), mod('stormDustHalf', { power: -2 }, { sols: 3 })] },
        {
          id: 'defer',
          kind: 'defer',
          hours: 0,
          tags: ['laterCost'],
          notes: [note({ flag: 'panelsTilted' }, 'panelsTilted')],
          effects: [
            iff({ any: [{ flag: 'panelsTilted' }, { roll: 'windCleans', eq: 1 }] }, [
              later(1, 'morning', 'windCleaned', [unmod('stormDust'), P(3)]),
            ]),
          ],
        },
      ],
    },
  ],
};

/** Solar particle event: one real DONKI event per mission, picked by the `speEvent` roll.
 *  Its strength comes from the data (content/data.ts); `factor` is how much of it reaches
 *  the astronaut for each choice. */
const onEvent = (build: (radiation: number, shieldHit: number) => Effect[]): Effect[] =>
  SOLAR_EVENTS.map((e) => iff({ roll: SOLAR_EVENT_ROLL, eq: e.index }, build(e.radiation, e.shieldHit)));
const speRad = (factor: number): Effect[] => onEvent((r) => [rad(r * factor)]);
const speHit = (inShelter: [number, number, number]): Effect =>
  iff({ flag: 'shelterReinforced' }, speRad(inShelter[0]), [
    iff({ flag: 'shelterWater' }, speRad(inShelter[1]), speRad(inShelter[2])),
  ]);

const sol12: SolDef = {
  sol: 12,
  notes: shelterNotes,
  // The particles arrive in the morning; the stronger the event, the more Shield it costs.
  morning: onEvent((_, shieldHit) => [S(-shieldHit)]),
  faults: [
    {
      id: 's12_spe',
      station: 'shelter',
      options: [
        { id: 'hideAll', kind: 'robust', hours: 6, effects: [speHit([0.1, 0.2, 0.3])], notes: shelterNotes },
        { id: 'hideShort', kind: 'quick', hours: 3, effects: [speHit([0.25, 0.35, 0.5])], notes: shelterNotes },
        { id: 'waterCorner', kind: 'creative', hours: 2, station: 'airlock', effects: [L(-4), ...speRad(0.45)] },
        defer(speRad(0.8), []),
      ],
    },
  ],
};

const leakOptions = (faultId: string): OptionDef[] => [
  { id: 'patchKit', kind: 'robust', hours: 3, items: { patchKit: 1 }, effects: [L(-1)] },
  { id: 'teaLeaves', kind: 'creative', hours: 2, items: { tape: 1 }, effects: [], notes: tapeNotes },
  { id: 'sealOff', kind: 'quick', hours: 1, effects: [L(-2), mod('leakSmall', { life: -1.5 }, { sols: 3 })] },
  defer([reopen(faultId)]),
];

const sol13: SolDef = {
  sol: 13,
  notes: tapeNotes,
  morning: [
    ...[0, 1, 2].flatMap((size) => [
      iff({ all: [{ roll: 'sol13v', eq: 0 }, { roll: 'leakSize', eq: size }] }, [mod('leak', { life: -3 - 1.5 * size }, { until: 's13_leakA' })]),
      iff({ all: [{ roll: 'sol13v', eq: 1 }, { roll: 'leakSize', eq: size }] }, [mod('leak', { life: -3 - 1.5 * size }, { until: 's13_leakB' })]),
    ]),
  ],
  faults: [
    { id: 's13_leakA', station: 'airlock', when: { roll: 'sol13v', eq: 0 }, options: leakOptions('s13_leakA') },
    { id: 's13_leakB', station: 'greenhouse', when: { roll: 'sol13v', eq: 1 }, options: leakOptions('s13_leakB') },
    {
      id: 's13_pad',
      station: 'landing',
      options: [
        { id: 'clearPad', kind: 'robust', hours: 2.5, effects: [flag('padClear')], tags: ['invest'] },
        { id: 'markPad', kind: 'quick', hours: 1, effects: [flag('padMarked')] },
        defer([]),
      ],
    },
  ],
};

const coolingCommon = (faultId: string, robust: OptionDef): OptionDef[] => [
  robust,
  // Both happen indoors at the batteries, also when the broken part is the outside radiator.
  { id: 'borrowPump', kind: 'creative', hours: 2, station: 'battery', requires: { flag: 'recyclerServiced' }, effects: [L(-3)], notes: recyclerNotes },
  { id: 'halfBattery', kind: 'quick', hours: 1, station: 'battery', effects: [P(-10)] },
  defer([reopen(faultId)]),
];

const sol14: SolDef = {
  sol: 14,
  notes: recyclerNotes,
  morning: [
    iff({ roll: 'sol14v', eq: 0 }, [mod('overheat', { power: -6 }, { until: 's14_pump' })], [
      mod('overheat', { power: -6 }, { until: 's14_radiator' }),
    ]),
    iff({ notFlag: 'recyclerServiced' }, [L(-6)]),
  ],
  faults: [
    {
      id: 's14_pump',
      station: 'battery',
      when: { roll: 'sol14v', eq: 0 },
      options: coolingCommon('s14_pump', { id: 'replacePump', kind: 'robust', hours: 5, effects: [P(-3)] }),
    },
    {
      id: 's14_radiator',
      station: 'solar',
      when: { roll: 'sol14v', eq: 1 },
      options: coolingCommon('s14_radiator', { id: 'cleanRadiator', kind: 'robust', hours: 3, effects: [P(-2)] }),
    },
  ],
};

const sol15: SolDef = {
  sol: 15,
  notes: [
    note({ flag: 'beaconReserve' }, 'beaconReserve'),
    note({ flag: 'sentReport' }, 'sentReport'),
    note({ flag: 'padClear' }, 'padClear'),
    note({ all: [{ notFlag: 'padClear' }, { flag: 'padMarked' }] }, 'padMarked'),
    note(noFlags('beaconReserve', 'sentReport', 'padClear', 'padMarked'), 'unprepared'),
  ],
  faults: [
    {
      id: 's15_beacon',
      station: 'hub',
      options: [
        {
          id: 'fullBeacon',
          kind: 'robust',
          hours: 1,
          // The lander comes down right at a prepared pad: the first supplies arrive at once.
          effects: [iff({ flag: 'beaconReserve' }, [P(-6)], [P(-22)]), iff({ flag: 'padClear' }, [L(5)], [iff({ flag: 'padMarked' }, [L(3)])])],
          notes: [
            note({ flag: 'beaconReserve' }, 'beaconReserve'),
            note({ notFlag: 'beaconReserve' }, 'noBeaconReserve'),
            note({ flag: 'padClear' }, 'padClear'),
            note({ all: [{ notFlag: 'padClear' }, { flag: 'padMarked' }] }, 'padMarked'),
          ],
        },
        {
          id: 'dimBeacon',
          kind: 'quick',
          hours: 1,
          effects: [P(-8), iff({ flag: 'padClear' }, [L(-2)], [iff({ flag: 'sentReport' }, [L(-4), rad(4)], [L(-10), rad(8), hp(-5, 'life')])])],
          notes: [note({ flag: 'sentReport' }, 'sentReport'), note({ flag: 'padClear' }, 'padClear'), note(noFlags('sentReport', 'padClear'), 'landsFar')],
        },
        {
          id: 'reflectors',
          kind: 'creative',
          hours: 3,
          station: 'landing',
          effects: [P(-2), iff({ any: [{ flag: 'padClear' }, { flag: 'padMarked' }] }, [], [L(-3), hp(-4, 'life')])],
          notes: [note({ flag: 'padClear' }, 'padClear'), note({ all: [{ notFlag: 'padClear' }, { flag: 'padMarked' }] }, 'padMarked'), note(noFlags('padClear', 'padMarked'), 'padNotReady')],
        },
        // Without a beacon the lander still finds a cleared or marked pad by sight.
        {
          ...defer(
            [
              iff({ flag: 'padClear' }, [L(-4), rad(2)], [
                iff({ flag: 'padMarked' }, [L(-10), rad(7), hp(-4, 'life')], [L(-14), rad(10), hp(-8, 'life')]),
              ]),
            ],
            [],
          ),
          notes: [note({ flag: 'padClear' }, 'padClear'), note({ all: [{ notFlag: 'padClear' }, { flag: 'padMarked' }] }, 'padMarked'), note(noFlags('padClear', 'padMarked'), 'noBeaconFar')],
        },
      ],
    },
  ],
};

export const RAW_SCENARIO: ContentPack = {
  homeStation: 'hub',
  stations: [
    { id: 'hub', walk: 0, eva: false },
    { id: 'greenhouse', walk: 0.5, eva: false },
    { id: 'shelter', walk: 0.5, eva: false },
    { id: 'battery', walk: 0.5, eva: false },
    { id: 'airlock', walk: 0, eva: false },
    { id: 'solar', walk: 1, eva: true, lockedWhen: { flag: 'storm' } },
    { id: 'landing', walk: 1, eva: true, lockedWhen: { any: [{ solLt: 13 }, { flag: 'storm' }] } },
  ],
  routines: [
    { id: 'tend', station: 'greenhouse', hours: 2, effects: [L(4), P(-1)] },
    { id: 'tune', station: 'battery', hours: 2, effects: [P(4)] },
    { id: 'bags', station: 'shelter', hours: 3, effects: [S(4)] },
  ],
  rolls: [
    { id: 'sol2v', min: 0, max: 1 },
    { id: 'dustLevel', min: 0, max: 2 },
    { id: 'o2Deficit', min: 0, max: 2 },
    { id: 'stormHit', min: 0, max: 5 },
    { id: 'stormNights', min: 1, max: 4 },
    { id: 'windCleans', min: 0, max: 1 },
    { id: SOLAR_EVENT_ROLL, min: 0, max: SOLAR_EVENTS.length - 1 },
    { id: 'sol13v', min: 0, max: 1 },
    { id: 'leakSize', min: 0, max: 2 },
    { id: 'sol14v', min: 0, max: 1 },
  ],
  sols: [sol1, sol2, sol3, sol4, sol5, sol6, sol7, sol8, sol9, sol10, sol11, sol12, sol13, sol14, sol15],
};

/** The scenario with balance knobs applied. */
export const SCENARIO: ContentPack = applyTuning(RAW_SCENARIO, TUNING);
