import type { EmotionDef, EmotionId } from './types';

export const EMOTIONS: Record<EmotionId, EmotionDef> = {
  rage: { id: 'rage', durationSec: 5, statMult: { atk: 1.2, def: 0.8 }, momentumMult: 1 },
  fear: { id: 'fear', durationSec: 4, statMult: { moveSpeed: 1.1 }, momentumMult: 1 },
  elation: { id: 'elation', durationSec: 6, statMult: {}, momentumMult: 1.5 },
  revenge: { id: 'revenge', durationSec: 8, statMult: { atk: 1.25 }, momentumMult: 1 },
  resolve: { id: 'resolve', durationSec: 999, statMult: {}, momentumMult: 1 },
  courage: { id: 'courage', durationSec: 6, statMult: {}, momentumMult: 1 },
};
