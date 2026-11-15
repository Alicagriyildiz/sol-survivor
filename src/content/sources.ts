// Real events behind each sol. Nothing here has been verified yet: every entry is
// `verified: false` and is listed in docs/SOURCES.md for the team to check.
// Note text (player-facing) lives in lang/tr.ts under `notes`.

export interface SourceNote {
  sol: number;
  /** Institution / mission / page name shown in game. */
  source: string;
  /** Claims in the note that must be checked before the final submission. */
  claims: string[];
  verified: boolean;
}

export const SOURCES: SourceNote[] = [
  { sol: 1, source: 'NASA – Mars Facts', claims: ['A sol is about 40 minutes longer than an Earth day'], verified: false },
  { sol: 2, source: 'NASA – ISS Environmental Control and Life Support System (ECLSS)', claims: ['ISS recycles used water and humidity into drinking water', 'Water recovery components have failed and been repaired/replaced by crew'], verified: false },
  { sol: 3, source: 'NASA/JPL – Phoenix Mars Lander', claims: ['Phoenix found perchlorate in Martian soil in 2008', 'Perchlorate is harmful to humans'], verified: false },
  { sol: 4, source: 'NASA/JPL – InSight Mission', claims: ['InSight lost power as dust covered its panels', 'Team trickled sand near a panel with the robotic arm scoop; wind-blown sand removed some dust'], verified: false },
  { sol: 5, source: 'NASA – MOXIE (Perseverance)', claims: ['MOXIE produced oxygen from Martian atmospheric CO2', 'The process needs a lot of electrical power'], verified: false },
  { sol: 6, source: 'NASA – Human Research Program / space radiation', claims: ['Regolith cover and water are studied as radiation shielding for habitats'], verified: false },
  { sol: 7, source: 'NASA – Mars communications / Deep Space Network', claims: ['One-way Earth-Mars signal delay ranges from a few minutes to over twenty minutes'], verified: false },
  { sol: 8, source: 'NASA – 2018 Mars global dust storm', claims: ['A dust storm that began in 2018 grew to encircle the planet'], verified: false },
  { sol: 9, source: 'NASA/JPL – Opportunity Rover', claims: ['Opportunity lost contact during the 2018 storm', 'Recovery attempts continued for months; it never woke up'], verified: false },
  { sol: 10, source: 'NASA – Apollo 13', claims: ['Square CM CO2 canisters did not fit the round LM sockets', 'An adapter was built from bags, cardboard and tape (1970)'], verified: false },
  { sol: 11, source: 'NASA/JPL – Mars Exploration Rovers (Spirit, Opportunity)', claims: ['Wind "cleaning events" removed dust from rover panels and raised power', 'Their timing could not be predicted'], verified: false },
  { sol: 12, source: 'NASA – Curiosity RAD / MAVEN, September 2017 solar event', claims: ['A September 2017 solar event reached Mars', "Curiosity's RAD measured the increase on the surface"], verified: false },
  { sol: 13, source: 'NASA / Roscosmos – ISS 2020 leak, Soyuz MS-09 2018', claims: ['In 2020 the ISS crew located a small leak by watching floating tea leaves', 'In 2018 a small hole in a Soyuz was patched by the crew'], verified: false },
  { sol: 14, source: 'NASA – ISS External Active Thermal Control System', claims: ['ISS ammonia cooling pumps failed', 'Spacewalks were done to replace failed pump modules'], verified: false },
  { sol: 15, source: 'NASA/JPL – Mars Entry, Descent and Landing', claims: ['Mars landing takes only minutes', 'Because of signal delay the spacecraft lands autonomously'], verified: false },
];
