// Real events behind each sol ("what really happened" notes). Session 3 (2026-11-15):
// each note was checked against official institutional pages. `verified: true` only when
// every claim in the note was read on the page(s) in `urls`. Details: docs/SOURCES.md.
// Note text (player-facing) lives in lang/tr.ts under `notes`.

export interface SourceNote {
  sol: number;
  /** Institution / mission / page name shown in game. */
  source: string;
  /** Claims made in the note. */
  claims: string[];
  verified: boolean;
  /** Official pages the claims were read on. */
  urls: string[];
}

export const SOURCES: SourceNote[] = [
  { sol: 1, source: 'NASA GISS – Mars24 Sunclock', claims: ['A sol is about 40 minutes longer than an Earth day (mean solar day 24 h 39 min 35 s)'], verified: true, urls: ['https://www.giss.nasa.gov/tools/mars24/help/notes.html'] },
  { sol: 2, source: 'NASA – ISS Environmental Control and Life Support System', claims: ['ISS recycles used water and humidity into drinking water', 'Water recovery components have failed and been replaced by crew'], verified: true, urls: ['https://www.nasa.gov/missions/station/iss-research/nasa-achieves-water-recovery-milestone-on-international-space-station/', 'https://www.nasa.gov/humans-in-space/space-station-teaches-nasa-valuable-lessons-about-life-support-systems/'] },
  { sol: 3, source: 'NASA/JPL – Phoenix Mars Lander', claims: ['Phoenix found perchlorate in Martian soil in 2008', 'Perchlorate could threaten astronaut health if large amounts were inhaled or ingested'], verified: true, urls: ['https://science.nasa.gov/mission/mars-phoenix/', 'https://www.jpl.nasa.gov/news/nasas-perseverance-rover-gets-the-dirt-on-mars/'] },
  { sol: 4, source: 'NASA/JPL – InSight Mission', claims: ['Dust on the panels reduced InSight\'s power', 'The team trickled sand next to a panel with the arm scoop; wind-blown sand carried off some dust'], verified: true, urls: ['https://www.jpl.nasa.gov/news/nasas-insight-mars-lander-gets-a-power-boost/'] },
  { sol: 5, source: 'NASA – MOXIE (Perseverance)', claims: ['MOXIE made oxygen from Martian CO2', 'MOXIE used about 300 watts'], verified: true, urls: ['https://www.nasa.gov/missions/mars-2020-perseverance/perseverance-rover/nasas-oxygen-generating-experiment-moxie-completes-mars-mission/', 'https://science.nasa.gov/mission/mars-2020-perseverance/science-instruments/'] },
  { sol: 6, source: 'NASA Technical Reports Server – Mars habitat shielding studies', claims: ['Regolith cover is studied as habitat radiation shielding', 'A 20 cm water shell gives about 15% effective dose reduction (NASA study)'], verified: true, urls: ['https://ntrs.nasa.gov/citations/19910008686', 'https://ntrs.nasa.gov/api/citations/20170000379/downloads/20170000379.pdf'] },
  { sol: 7, source: 'NASA – Space communications', claims: ['One-way Earth-Mars signal delay is about 4 minutes at closest approach and about 24 minutes at greatest distance'], verified: true, urls: ['https://www.nasa.gov/centers-and-facilities/goddard/space-communications-7-things-you-need-to-know/'] },
  { sol: 8, source: 'NASA/JPL – 2018 Mars global dust storm', claims: ['The 2018 dust storm became planet-encircling'], verified: true, urls: ['https://www.jpl.nasa.gov/news/news.php?feature=7164'] },
  { sol: 9, source: 'NASA/JPL – Opportunity Rover', claims: ['Opportunity stopped communicating on 10 June 2018 during the storm', 'More than a thousand commands over an eight-month recovery effort; it never woke up'], verified: true, urls: ['https://www.jpl.nasa.gov/news/nasas-opportunity-rover-mission-on-mars-comes-to-end/'] },
  { sol: 10, source: 'NASA – Apollo 13', claims: ['Square CM CO2 canisters did not fit the round LM openings', 'An adapter was built from plastic bags, cardboard and tape (1970)'], verified: true, urls: ['https://www.nasa.gov/missions/apollo/apollo-13-mission-details/'] },
  { sol: 11, source: 'NASA/JPL – Mars Exploration Rovers (Spirit)', claims: ['Wind blew dust off rover panels and raised power', 'Spirit, 2009: about 210 -> 240 watt-hours'], verified: true, urls: ['https://www.jpl.nasa.gov/news/spirit-gets-energy-boost-from-cleaner-solar-panels/'] },
  { sol: 12, source: 'NASA/JPL – Curiosity RAD, September 2017 solar event', claims: ['Particles from a September 2017 solar event reached Mars', 'RAD measured surface radiation more than double any level it had measured before'], verified: true, urls: ['https://www.jpl.nasa.gov/news/large-solar-storm-sparks-global-aurora-and-doubles-radiation-levels-on-the-martian-surface/'] },
  { sol: 13, source: 'NASA – ISS 2020 leak, Soyuz MS-09 2018', claims: ['2020 ISS leak isolated to the Zvezda transfer chamber (verified)', 'Crew found the crack by watching floating tea leaves (NOT on an official page; media reports citing Roscosmos)', 'Soyuz MS-09 2 mm hole plugged with epoxy on a gauze wipe (verified)'], verified: false, urls: ['https://www.nasa.gov/blogs/spacestation/2020/09/30/u-s-cargo-mission-nears-launch-more-leak-checks-and-research/', 'https://www.nasa.gov/blogs/spacestation/2018/08/30/international-space-station-status-3/'] },
  { sol: 14, source: 'NASA – ISS External Active Thermal Control System', claims: ['ISS ammonia cooling pump failed', 'Spacewalks replaced the faulty pump module (2013)'], verified: true, urls: ['https://www.nasa.gov/missions/station/space-station-crew-removes-ammonia-pump-next-spacewalk-set-for-tuesday/'] },
  { sol: 15, source: 'NASA – Curiosity "7 minutes of terror"', claims: ['Mars landing takes about 7 minutes', 'Signal took about 14 minutes to reach Earth, so the spacecraft landed on its own'], verified: true, urls: ['https://science.nasa.gov/resource/challenges-of-getting-to-mars-curiositys-seven-minutes-of-terror/'] },
];
