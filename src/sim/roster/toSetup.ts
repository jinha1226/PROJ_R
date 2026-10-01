import { CLASSES } from '../../data/classes';
import { getItem } from '../../data/items';
import { PASSIVES } from '../../data/passives';
import { SCARS } from '../../data/scars';
import type { GearVisual, Stats, TraitId, UniqueId } from '../../data/types';
import type { UnitSetup } from '../battle/types';
import { rankOf, type Mercenary } from './types';

const INJURY_MULT = 0.85;
const INJURED_STATS: (keyof Stats)[] = ['maxHp', 'atk', 'def', 'atkSpeed', 'moveSpeed'];

const items = (m: Mercenary) => Object.values(m.gear).filter((id): id is string => !!id).map(getItem);

/** Final combat stats: class base + level growth (× personal variance) + gear, then passives, scars, injury. */
export function mercStats(m: Mercenary): Stats {
  const c = CLASSES[m.classId];
  const s: Stats = { ...c.base };
  for (const k of ['maxHp', 'atk', 'def'] as const) s[k] += (c.growth[k] ?? 0) * (m.level - 1) * m.growth[k];
  for (const it of items(m)) for (const [k, v] of Object.entries(it.stats) as [keyof Stats, number][]) s[k] += v;
  const mults = [...m.passives.map((p) => PASSIVES[p]?.statMult ?? {}), ...m.scars.map((sc) => SCARS[sc].statMult)];
  for (const mult of mults) for (const [k, v] of Object.entries(mult) as [keyof Stats, number][]) s[k] *= v;
  if (m.injury > 0) for (const k of INJURED_STATS) s[k] *= INJURY_MULT;
  s.maxHp = Math.round(s.maxHp);
  return s;
}

function gearLook(m: Mercenary): GearVisual {
  const c = CLASSES[m.classId];
  const weapon = m.gear.weapon ? getItem(m.gear.weapon) : undefined;
  const armor = m.gear.armor ? getItem(m.gear.armor) : undefined;
  const veteran = rankOf(m.level) === 'veteran' || rankOf(m.level) === 'hero';
  return {
    weapon: weapon?.visual?.weapon ?? c.gear.weapon,
    offhand: weapon?.visual?.offhand ?? c.gear.offhand,
    helmet: !!armor?.visual?.helmet,
    cape: !!armor?.visual?.cape || veteran,
  };
}

export function mercToUnitSetup(m: Mercenary, _index: number, slot: { col: 0 | 1 | 2; row: 0 | 1 | 2 | 3 }): UnitSetup {
  const c = CLASSES[m.classId];
  const traits = [...new Set<TraitId>([...m.traits, ...m.tempTraits.map((t) => t.trait)])];
  const uniques = [...new Set(items(m).map((i) => i.unique).filter((u): u is UniqueId => !!u))];
  return {
    id: m.id, name: m.name, team: 'ally', role: c.role, defId: m.classId, stats: mercStats(m),
    basic: c.basic, actives: [...m.actives], ultimate: m.ultimate, tactics: [...m.tactics], traits, level: m.level,
    slot, color: m.color, model: c.model, gear: gearLook(m), isLeader: !!m.protagonist,
    skillLevels: { ...m.skillLevels }, passives: [...m.passives], uniques, scars: [...m.scars], title: m.title,
    rank: rankOf(m.level), injured: m.injury > 0,
    gearTiers: { weapon: m.gear.weapon ? getItem(m.gear.weapon).tier : undefined, armor: m.gear.armor ? getItem(m.gear.armor).tier : undefined },
  };
}
