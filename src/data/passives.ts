import type { PassiveDef } from './types';

export const PASSIVES: Record<string, PassiveDef> = {
  toughness: { id: 'toughness', statMult: { maxHp: 1.15 } },
  sharpEdge: { id: 'sharpEdge', statMult: { atk: 1.1 } },
  ironSkin: { id: 'ironSkin', statMult: { def: 1.15 } },
  quickHands: { id: 'quickHands', statMult: { atkSpeed: 1.1 } },
  fleetFoot: { id: 'fleetFoot', statMult: { moveSpeed: 1.1, dodge: 1.15 } },
  momentumSurge: { id: 'momentumSurge', momentumMult: 1.25 },
};
