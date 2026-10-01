import type { ScarDef, ScarId } from './types';

export const SCARS: Record<ScarId, ScarDef> = {
  limp: { id: 'limp', statMult: { moveSpeed: 0.9 }, startEmotion: 'resolve' },
  oneEye: { id: 'oneEye', statMult: { crit: 1.6, dodge: 0.6 } },
  hardened: { id: 'hardened', statMult: { maxHp: 0.9, def: 1.2 } },
};
