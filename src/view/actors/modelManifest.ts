import type { GearVisual, ModelId } from '../../data/types';
import type { AnimSet } from './animMap';

/** Weapon/offhand values are mesh node names, or `prop:<file>` for a separate GLB attached to a hand slot. */
export interface ModelInfo {
  file: string;
  animSet: AnimSet;
  weapons: Record<string, string>;
  offhands: Record<string, string>;
  helmet: string[];
  cape: string[];
  always: string[];
}

const body = (prefix: string, head = `${prefix}_Head`, extra: string[] = []): string[] => [
  `${prefix}_ArmLeft`, `${prefix}_ArmRight`, `${prefix}_Body`, head, `${prefix}_LegLeft`, `${prefix}_LegRight`, ...extra,
];

const ROGUE_WEAPONS = { Knife: 'Knife', '1H_Crossbow': '1H_Crossbow', '2H_Crossbow': '2H_Crossbow' };

export const MODELS: Record<ModelId, ModelInfo> = {
  Knight: {
    file: 'Knight', animSet: 'adventurer', weapons: { '1H_Sword': '1H_Sword', '2H_Sword': '2H_Sword' },
    offhands: {
      Round_Shield: 'Round_Shield', Badge_Shield: 'Badge_Shield', Rectangle_Shield: 'Rectangle_Shield',
      Spike_Shield: 'Spike_Shield', Sword_Offhand: '1H_Sword_Offhand',
    },
    helmet: ['Knight_Helmet'], cape: ['Knight_Cape'], always: body('Knight'),
  },
  Barbarian: {
    file: 'Barbarian', animSet: 'adventurer', weapons: { '2H_Axe': '2H_Axe', '1H_Axe': '1H_Axe' },
    offhands: { Axe_Offhand: '1H_Axe_Offhand', Round_Shield: 'Barbarian_Round_Shield' },
    helmet: ['Barbarian_Hat'], cape: ['Barbarian_Cape'], always: body('Barbarian'),
  },
  Mage: {
    file: 'Mage', animSet: 'adventurer', weapons: { Staff: '2H_Staff', Wand: '1H_Wand' },
    offhands: { Spellbook: 'Spellbook' }, helmet: ['Mage_Hat'], cape: ['Mage_Cape'], always: body('Mage'),
  },
  Rogue: {
    file: 'Rogue', animSet: 'adventurer', weapons: ROGUE_WEAPONS, offhands: { Knife_Offhand: 'Knife_Offhand' },
    helmet: [], cape: ['Rogue_Cape'], always: body('Rogue'),
  },
  Rogue_Hooded: {
    file: 'Rogue_Hooded', animSet: 'adventurer', weapons: ROGUE_WEAPONS, offhands: { Knife_Offhand: 'Knife_Offhand' },
    helmet: [], cape: ['Rogue_Cape'], always: body('Rogue', 'Rogue_Head_Hooded'),
  },
  Skeleton_Warrior: {
    file: 'Skeleton_Warrior', animSet: 'skeleton', weapons: { Axe: 'prop:Skeleton_Axe', Blade: 'prop:Skeleton_Blade' },
    offhands: { Shield_Small: 'prop:Skeleton_Shield_Small_A', Shield_Large: 'prop:Skeleton_Shield_Large_A' },
    helmet: ['Skeleton_Warrior_Helmet'], cape: ['Skeleton_Warrior_Cloak'],
    always: body('Skeleton_Warrior', 'Skeleton_Warrior_Head', ['Skeleton_Warrior_Eyes', 'Skeleton_Warrior_Jaw']),
  },
  Skeleton_Mage: {
    file: 'Skeleton_Mage', animSet: 'skeleton', weapons: { Staff: 'prop:Skeleton_Staff' }, offhands: {},
    helmet: ['Skeleton_Mage_Hat'], cape: [],
    always: body('Skeleton_Mage', 'Skeleton_Mage_Skull', ['Skeleton_Mage_Eyes', 'Skeleton_Mage_Jaw']),
  },
  Skeleton_Rogue: {
    file: 'Skeleton_Rogue', animSet: 'skeleton', weapons: { Crossbow: 'prop:Skeleton_Crossbow', Blade: 'prop:Skeleton_Blade' },
    offhands: {}, helmet: ['Skeleton_Rogue_Hood'], cape: ['Skeleton_Rogue_Cape'],
    always: body('Skeleton_Rogue', 'Skeleton_Rogue_Head', ['Skeleton_Rogue_Eyes', 'Skeleton_Rogue_Jaw']),
  },
  Skeleton_Minion: {
    file: 'Skeleton_Minion', animSet: 'skeleton', weapons: { Blade: 'prop:Skeleton_Blade', Axe: 'prop:Skeleton_Axe' },
    offhands: {}, helmet: [], cape: ['Skeleton_Minion_Cloak'],
    always: body('Skeleton_Minion', 'Skeleton_Minion_Head', ['Skeleton_Minion_Eyes', 'Skeleton_Minion_Jaw']),
  },
};

const isProp = (n: string | undefined): n is string => !!n && n.startsWith('prop:');

/** Mesh node names to show; every other mesh node in the model is hidden. */
export function visibleMeshes(model: ModelId, gear: GearVisual): Set<string> {
  const m = MODELS[model];
  const out = new Set(m.always);
  if (gear.helmet) m.helmet.forEach((n) => out.add(n));
  if (gear.cape) m.cape.forEach((n) => out.add(n));
  for (const n of [m.weapons[gear.weapon], gear.offhand ? m.offhands[gear.offhand] : undefined])
    if (n && !isProp(n)) out.add(n);
  return out;
}

/** Separate prop GLBs to attach: main hand → handslot.r, offhand → handslot.l. */
export function propsFor(model: ModelId, gear: GearVisual): { file: string; slot: 'handslot.r' | 'handslot.l' }[] {
  const m = MODELS[model];
  const out: { file: string; slot: 'handslot.r' | 'handslot.l' }[] = [];
  const main = m.weapons[gear.weapon];
  const off = gear.offhand ? m.offhands[gear.offhand] : undefined;
  if (isProp(main)) out.push({ file: main.slice(5), slot: 'handslot.r' });
  if (isProp(off)) out.push({ file: off.slice(5), slot: 'handslot.l' });
  return out;
}
