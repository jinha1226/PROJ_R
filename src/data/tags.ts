import type { TagId } from './types';

export interface TagDef {
  negative: boolean;
  blocksAction: boolean;
  moveMult: number;
}

export const TAGS: Record<TagId, TagDef> = {
  marked: { negative: true, blocksAction: false, moveMult: 1 },
  knockdown: { negative: true, blocksAction: true, moveMult: 1 },
  wet: { negative: true, blocksAction: false, moveMult: 0.9 },
  stun: { negative: true, blocksAction: true, moveMult: 1 },
  burn: { negative: true, blocksAction: false, moveMult: 1 },
  bleed: { negative: true, blocksAction: false, moveMult: 1 },
  slow: { negative: true, blocksAction: false, moveMult: 0.6 },
  shield: { negative: false, blocksAction: false, moveMult: 1 },
  taunted: { negative: true, blocksAction: false, moveMult: 1 },
};
