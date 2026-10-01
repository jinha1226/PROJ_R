import { createRng, type Rng } from '../../core/rng';
import { CLASSES } from '../../data/classes';
import { starterWeapon } from '../../data/items';
import { BACKSTORIES, NAMES } from '../../data/names';
import { STARTER_TACTICS } from '../../data/tactics';
import { TRAITS } from '../../data/traits';
import type { ClassId, Role, TacticId, TraitId } from '../../data/types';
import { emptyRecord, type Mercenary, type Roster } from './types';

const COLORS = ['#4aa3e0', '#e05a4a', '#6ac46a', '#b07ae0', '#f0f0f0', '#e0884a', '#e0c04a', '#4ad0c0', '#e07ab0', '#8ab04a', '#7a8ae0', '#c0a080'];
const COMBAT: ClassId[] = ['warrior', 'berserker', 'rogue', 'crossbow', 'mage', 'priest'];
const DEFAULT_TACTIC: Record<Role, TacticId> = {
  vanguard: 'guardBack', striker: 'vanguard', skirmisher: 'weakHunt', ranged: 'keepDistance', caster: 'keepDistance', support: 'weakHunt',
};

const clash = (a: TraitId, b: TraitId): boolean => TRAITS[a].dislikes.includes(b) || TRAITS[b].dislikes.includes(a);

function rollTraits(rng: Rng): TraitId[] {
  const all = Object.keys(TRAITS) as TraitId[];
  const first = rng.pick(all);
  const second = rng.pick(all.filter((t) => t !== first && !clash(first, t)));
  return [first, second];
}

const variance = (rng: Rng): number => Math.round((0.85 + rng.next() * 0.3) * 100) / 100;

function base(id: string, classId: ClassId, rng: Rng, name: string, level: number): Mercenary {
  const c = CLASSES[classId];
  const traits = rollTraits(rng);
  return {
    id, name, classId, level, xp: 0, color: rng.pick(COLORS), backstory: rng.pick(BACKSTORIES),
    traits, revealed: [traits[0]!], growth: { maxHp: variance(rng), atk: variance(rng), def: variance(rng) },
    actives: [...c.actives], ultimate: c.ultimate, passives: [], skillLevels: {},
    tactics: [DEFAULT_TACTIC[c.role]], gear: { weapon: starterWeapon(classId), armor: 'ragged_clothes' },
    injury: 0, scars: [], tempTraits: [], chronicle: [{ battle: 0, key: 'joined', vars: {} }], record: emptyRecord(),
    alive: true, pendingLevelUps: 0,
  };
}

export function createProtagonist(seed: number): Mercenary {
  const rng = createRng(seed ^ 0x2f6b);
  return { ...base('m0', 'novice', rng, '이름 없는 모험가', 1), protagonist: true, tactics: ['vanguard'] };
}

export function generateRecruit(rng: Rng, opts: { level: number; usedNames: Set<string>; classId?: ClassId; id?: string }): Mercenary {
  const classId = opts.classId ?? rng.pick(COMBAT);
  const free = NAMES.filter((n) => !opts.usedNames.has(n));
  const name = free.length ? rng.pick(free) : `${rng.pick(NAMES)} ${opts.usedNames.size}`;
  opts.usedNames.add(name);
  return base(opts.id ?? `r${opts.usedNames.size}`, classId, rng, name, opts.level);
}

export function newRoster(seed: number, recruits: number): Roster {
  const rng = createRng(seed);
  const used = new Set<string>();
  const mercs = [createProtagonist(seed)];
  for (let i = 1; i <= recruits; i++) mercs.push(generateRecruit(rng, { level: 1, usedNames: used, id: `m${i}` }));
  return { seed, battles: 0, nextId: recruits + 1, mercs, memorial: [], relations: [], inventory: [], tacticsOwned: [...STARTER_TACTICS] };
}
