import { createEngine } from '../sim/engine';
import { DEFAULT_CONFIG } from './config';
import { SCENARIO } from './scenario';

export { DEFAULT_CONFIG, ITEMS } from './config';
export { RAW_SCENARIO, SCENARIO } from './scenario';
export { TUNING, applyTuning } from './tuning';
export { SOURCES } from './sources';
export { tr, fmt } from './lang/tr';

/** Engine bound to the 15-sol scenario. */
export const engine = createEngine(SCENARIO);
export const defaultConfig = DEFAULT_CONFIG;
