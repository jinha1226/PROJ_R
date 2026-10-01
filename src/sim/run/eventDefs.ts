import { ITEMS } from '../../data/items';
import { TACTICS } from '../../data/tactics';
import type { EventDef, EventCtx } from './eventTypes';

const lead = (c: EventCtx) => c.party.find((m) => m.protagonist) ?? c.party[0]!;
const pair = (c: EventCtx): [string, string] => {
  const shuffled = c.rng.shuffle([...c.party]);
  return [shuffled[0]!.id, (shuffled[1] ?? shuffled[0]!).id];
};
const randomItem = (c: EventCtx, maxTier: number) => c.rng.pick(Object.values(ITEMS).filter((i) => i.tier >= 1 && i.tier <= maxTier)).id;
const tierCap = (c: EventCtx) => Math.min(3, 1 + Math.floor(c.run.roster.battles / 4));

export const EVENT_DEFS: EventDef[] = [
  {
    id: 'merchant',
    requires: (c) => !!c.withTrait('hotheaded'),
    setup: (c) => { const h = c.withTrait('hotheaded')!; return { hotheadId: h.id, hothead: h.name, leadId: lead(c).id }; },
    choices: [
      { id: 'stop', textKey: 'merchant.stop', resolve: (c) => ({ effects: [{ kind: 'affinity', a: c.vars.hotheadId!, b: c.vars.leadId!, amount: -5 }], resultKey: 'merchant.stop.r' }) },
      { id: 'side', textKey: 'merchant.side', gold: 20, resolve: (c) => ({ effects: [{ kind: 'gold', amount: -20 }, { kind: 'affinity', a: c.vars.hotheadId!, b: c.vars.leadId!, amount: 10 }], resultKey: 'merchant.side.r' }) },
      { id: 'mediate', textKey: 'merchant.mediate', trait: 'calm', resolve: (c) => {
        const calm = c.withTrait('calm', [c.vars.hotheadId!])!;
        return { effects: [{ kind: 'gold', amount: 15 }, { kind: 'affinity', a: calm.id, b: c.vars.hotheadId!, amount: 10 }], resultKey: 'merchant.mediate.r', vars: { actor: calm.name } };
      } },
    ],
  },
  {
    id: 'traveler',
    choices: [
      { id: 'help', textKey: 'traveler.help', gold: 10, resolve: (c) => ({ effects: [{ kind: 'gold', amount: -10 }, { kind: 'xp', mercs: c.party.map((m) => m.id), amount: 15 }], resultKey: 'traveler.help.r' }) },
      { id: 'ignore', textKey: 'traveler.ignore', resolve: () => ({ effects: [], resultKey: 'traveler.ignore.r' }) },
      { id: 'tend', textKey: 'traveler.tend', trait: 'altruist', resolve: (c) => ({ effects: [{ kind: 'item', itemId: randomItem(c, tierCap(c)) }], resultKey: 'traveler.tend.r', vars: { actor: c.withTrait('altruist')!.name } }) },
    ],
  },
  {
    id: 'camp',
    choices: [
      { id: 'search', textKey: 'camp.search', resolve: (c) => (c.rng.chance(0.6)
        ? { effects: [{ kind: 'item', itemId: randomItem(c, tierCap(c)) }], resultKey: 'camp.search.good' }
        : { effects: [{ kind: 'injure', merc: c.rng.pick(c.party).id, battles: 2 }], resultKey: 'camp.search.bad' }) },
      { id: 'leave', textKey: 'camp.leave', resolve: () => ({ effects: [], resultKey: 'camp.leave.r' }) },
      { id: 'careful', textKey: 'camp.careful', trait: 'cautious', resolve: (c) => ({ effects: [{ kind: 'item', itemId: randomItem(c, tierCap(c)) }], resultKey: 'camp.careful.r', vars: { actor: c.withTrait('cautious')!.name } }) },
    ],
  },
  {
    id: 'campfire',
    requires: (c) => c.party.length >= 2,
    setup: (c) => { const [a, b] = pair(c); return { aId: a, bId: b, a: c.party.find((m) => m.id === a)!.name, b: c.party.find((m) => m.id === b)!.name }; },
    choices: [
      { id: 'talk', textKey: 'campfire.talk', resolve: (c) => ({ effects: [{ kind: 'affinity', a: c.vars.aId!, b: c.vars.bId!, amount: 12 }], resultKey: 'campfire.talk.r' }) },
      { id: 'sleep', textKey: 'campfire.sleep', resolve: () => ({ effects: [{ kind: 'healAll' }], resultKey: 'campfire.sleep.r' }) },
      { id: 'stories', textKey: 'campfire.stories', trait: 'chatty', resolve: (c) => {
        const effects = [];
        for (let i = 0; i < c.party.length; i++) for (let j = i + 1; j < c.party.length; j++) effects.push({ kind: 'affinity' as const, a: c.party[i]!.id, b: c.party[j]!.id, amount: 4 });
        return { effects, resultKey: 'campfire.stories.r', vars: { actor: c.withTrait('chatty')!.name } };
      } },
    ],
  },
  {
    id: 'gambler',
    choices: [
      { id: 'bet', textKey: 'gambler.bet', gold: 30, resolve: (c) => (c.rng.chance(0.5)
        ? { effects: [{ kind: 'gold', amount: 30 }], resultKey: 'gambler.bet.win' } : { effects: [{ kind: 'gold', amount: -30 }], resultKey: 'gambler.bet.lose' }) },
      { id: 'duel', textKey: 'gambler.duel', trait: 'glory', resolve: (c) => {
        const g = c.withTrait('glory')!;
        return c.rng.chance(0.6)
          ? { effects: [{ kind: 'gold', amount: 40 }, { kind: 'xp', mercs: [g.id], amount: 20 }], resultKey: 'gambler.duel.win', vars: { actor: g.name } }
          : { effects: [{ kind: 'injure', merc: g.id, battles: 2 }], resultKey: 'gambler.duel.lose', vars: { actor: g.name } };
      } },
      { id: 'refuse', textKey: 'gambler.refuse', resolve: () => ({ effects: [], resultKey: 'gambler.refuse.r' }) },
    ],
  },
  {
    id: 'training',
    choices: [
      { id: 'train', textKey: 'training.train', resolve: (c) => ({ effects: [{ kind: 'xp', mercs: [...c.party].sort((a, b) => a.level - b.level).slice(0, 2).map((m) => m.id), amount: 30 }], resultKey: 'training.train.r' }) },
      { id: 'spar', textKey: 'training.spar', trait: 'competitive', trait2: 'competitive', resolve: (c) => {
        const a = c.withTrait('competitive')!;
        const b = c.withTrait('competitive', [a.id])!;
        return { effects: [{ kind: 'rival', a: a.id, b: b.id }, { kind: 'xp', mercs: [a.id, b.id], amount: 50 }], resultKey: 'training.spar.r', vars: { actor: a.name, other: b.name } };
      } },
      { id: 'skip', textKey: 'training.skip', resolve: () => ({ effects: [], resultKey: 'training.skip.r' }) },
    ],
  },
  {
    id: 'relic',
    choices: [
      { id: 'take', textKey: 'relic.take', resolve: (c) => {
        const free = TACTICS.filter((t) => !c.run.roster.tacticsOwned.includes(t));
        return free.length ? { effects: [{ kind: 'tactic', tacticId: c.rng.pick(free) }], resultKey: 'relic.take.r' } : { effects: [{ kind: 'gold', amount: 40 }], resultKey: 'relic.sell.r' };
      } },
      { id: 'sell', textKey: 'relic.sell', resolve: () => ({ effects: [{ kind: 'gold', amount: 40 }], resultKey: 'relic.sell.r' }) },
    ],
  },
  {
    id: 'village',
    choices: [
      { id: 'guard', textKey: 'village.guard', resolve: (c) => ({ effects: [{ kind: 'gold', amount: 30 }, { kind: 'injure', merc: c.rng.pick(c.party).id, battles: 2 }], resultKey: 'village.guard.r' }) },
      { id: 'brave', textKey: 'village.brave', trait: 'coward', trait2: 'protective', resolve: (c) => {
        const a = c.withTrait('coward')!;
        const b = c.withTrait('protective', [a.id])!;
        return { effects: [{ kind: 'affinity', a: a.id, b: b.id, amount: 15 }, { kind: 'gold', amount: 20 }], resultKey: 'village.brave.r', vars: { actor: a.name, other: b.name } };
      } },
      { id: 'pass', textKey: 'village.pass', resolve: () => ({ effects: [], resultKey: 'village.pass.r' }) },
    ],
  },
];
