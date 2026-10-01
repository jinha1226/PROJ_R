import { createRng } from '../../core/rng';
import { CLASSES } from '../../data/classes';
import { starterWeapon } from '../../data/items';
import { PASSIVES } from '../../data/passives';
import type { ClassId, TacticId } from '../../data/types';
import { canEquip } from './equipment';
import { rankOf, type Mercenary, type Roster } from './types';

export type LevelOffer =
  | { kind: 'newActive'; skillId: string }
  | { kind: 'upgrade'; skillId: string }
  | { kind: 'passive'; passiveId: string }
  | { kind: 'promote'; classId: ClassId }
  | { kind: 'tactic'; tacticId: TacticId };

const COMBAT: ClassId[] = ['warrior', 'berserker', 'rogue', 'crossbow', 'mage', 'priest'];
const MAX_SKILL_LEVEL = 3;
const PROMOTE_LEVEL = 3;

const hashSeed = (seed: number, m: Mercenary): number =>
  [...m.id].reduce((h, c) => (h * 31 + c.charCodeAt(0)) >>> 0, seed ^ (m.level * 7919) ^ (m.pendingLevelUps * 104729));

/** Up to three choices, one per kind where possible (new skill / upgrade / passive / tactic). */
export function levelOffers(m: Mercenary, roster: Roster, seed: number): LevelOffer[] {
  const rng = createRng(hashSeed(seed, m));
  if (m.classId === 'novice') {
    if (m.level < PROMOTE_LEVEL) return [];
    return rng.shuffle([...COMBAT]).slice(0, 3).map((classId) => ({ kind: 'promote', classId }));
  }
  const rank = rankOf(m.level);
  const lvl = (id: string) => m.skillLevels[id] ?? 1;
  const groups: LevelOffer[][] = [
    CLASSES[m.classId].pool.filter((s) => !m.actives.includes(s)).map((skillId) => ({ kind: 'newActive', skillId })),
    [
      ...(rank !== 'rookie' ? m.actives.filter((s) => lvl(s) < MAX_SKILL_LEVEL) : []),
      ...(rank === 'hero' && lvl(m.ultimate) < MAX_SKILL_LEVEL ? [m.ultimate] : []),
    ].map((skillId) => ({ kind: 'upgrade', skillId })),
    m.passives.length < 2 ? Object.keys(PASSIVES).filter((p) => !m.passives.includes(p)).map((passiveId) => ({ kind: 'passive', passiveId })) : [],
    (rank === 'veteran' || rank === 'hero') && m.tactics.length < 2
      ? roster.tacticsOwned.filter((t) => !m.tactics.includes(t)).map((tacticId) => ({ kind: 'tactic', tacticId }))
      : [],
  ].filter((g) => g.length > 0) as LevelOffer[][];
  const picked: LevelOffer[] = [];
  for (const g of rng.shuffle([...groups])) if (picked.length < 3) picked.push(rng.pick(g));
  const rest = rng.shuffle(groups.flat().filter((o) => !picked.includes(o)));
  while (picked.length < 3 && rest.length) picked.push(rest.pop()!);
  return picked;
}

/** Applies a choice to one mercenary. A third active needs `replaceSlot`. */
export function applyOffer(m: Mercenary, offer: LevelOffer, replaceSlot?: 0 | 1): Mercenary {
  switch (offer.kind) {
    case 'newActive': {
      if (m.actives.length < 2) return { ...m, actives: [...m.actives, offer.skillId] };
      if (replaceSlot === undefined) throw new Error('active slots are full: choose a slot to replace');
      const actives = [...m.actives];
      const skillLevels = { ...m.skillLevels };
      delete skillLevels[actives[replaceSlot]!];
      actives[replaceSlot] = offer.skillId;
      return { ...m, actives, skillLevels };
    }
    case 'upgrade':
      return { ...m, skillLevels: { ...m.skillLevels, [offer.skillId]: Math.min(MAX_SKILL_LEVEL, (m.skillLevels[offer.skillId] ?? 1) + 1) } };
    case 'passive':
      return { ...m, passives: [...m.passives, offer.passiveId].slice(0, 2) };
    case 'tactic':
      return { ...m, tactics: [...m.tactics, offer.tacticId].slice(0, 2) };
    case 'promote': {
      const c = CLASSES[offer.classId];
      return {
        ...m, classId: offer.classId, actives: [...c.actives], ultimate: c.ultimate, skillLevels: {},
        chronicle: [...m.chronicle, { battle: 0, key: 'promoted', vars: { class: offer.classId } }],
      };
    }
  }
}

/** Applies a choice inside the roster: consumes one pending level-up; promotion swaps an unusable weapon. */
export function applyOfferToRoster(r: Roster, mercId: string, offer: LevelOffer, replaceSlot?: 0 | 1): Roster {
  const m = r.mercs.find((x) => x.id === mercId);
  if (!m) return r;
  let next = applyOffer(m, offer, replaceSlot);
  let inventory = r.inventory;
  if (offer.kind === 'promote') {
    next = { ...next, chronicle: next.chronicle.map((c, i, all) => (i === all.length - 1 ? { ...c, battle: r.battles } : c)) };
    if (next.gear.weapon && !canEquip(next, next.gear.weapon)) {
      inventory = [...inventory, next.gear.weapon];
      next = { ...next, gear: { ...next.gear, weapon: starterWeapon(next.classId) } };
    }
  }
  next = { ...next, pendingLevelUps: Math.max(0, next.pendingLevelUps - 1) };
  return { ...r, inventory, mercs: r.mercs.map((x) => (x.id === mercId ? next : x)) };
}
