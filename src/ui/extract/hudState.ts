import { bagSlots, carriedValue, carryLimit, totalWeight } from '../../sim/extract/loadout';
import type { PoiKind } from '../../sim/extract/regionTypes';
import { phaseOf, SEC, type Phase } from '../../sim/world/clock';
import type { Nearby } from '../../sim/world/interact';
import { partyUnits } from '../../sim/world/party';
import type { WorldState } from '../../sim/world/types';
import { heroUnit } from '../../sim/world/worldState';
import { CHANNEL_NAME, PROMPT } from './names';

export interface PartyRow { id: string; name: string; color: string; hp: number; down: boolean; dead: boolean; lead: boolean }
export interface Pt { x: number; y: number }
export interface HudState {
  party: PartyRow[];
  value: number;
  slots: [number, number];
  weight: [number, number];
  clock: string;
  phase: Phase;
  combat: boolean;
  channel?: { label: string; frac: number };
  prompt?: string;
  orders: { focus: boolean; retreat: boolean; regroup: boolean };
  /** what the minimap draws (the explored-fog memory stays with the drawing widget) */
  minimap: { pois: (Pt & { kind: PoiKind; risk: number })[]; extracts: (Pt & { closed: boolean })[]; party: (Pt & { down: boolean })[]; hero: Pt };
}

const WAITING = '모두 탈출 지점 안으로 들어와야 한다';

/** Everything the sortie HUD shows, read from the world in one pass; both the portrait and landscape layouts draw from it. */
export function hudState(w: WorldState, nearby: Nearby): HudState {
  const l = w.hero.loadout;
  const sec = Math.floor(w.b.tick / SEC);
  const dr = w.hero.drink;
  const ch = w.hero.channel ?? (dr ? { kind: 'drink', ticks: dr.ticks, total: dr.total, waiting: false } : undefined);
  const combat = w.party.mode === 'combat';
  const h = heroUnit(w).pos;
  return {
    party: w.party.order.map((id) => {
      const u = w.b.units.find((x) => x.id === id);
      const m = w.party.mercs[id]!;
      const dead = !u?.alive;
      return { id, name: m.name, color: m.color, dead, down: !dead && !!u?.downed, hp: dead || !u || u.downed ? 0 : u.hp / u.maxHp, lead: id === w.heroId };
    }),
    value: carriedValue(l),
    slots: [l.bag.length, bagSlots(l)],
    weight: [totalWeight(l), carryLimit(l)],
    clock: `${String(Math.floor(sec / 60)).padStart(2, '0')}:${String(sec % 60).padStart(2, '0')}`,
    phase: phaseOf(w.b.tick),
    combat,
    channel: ch ? { label: ch.waiting ? WAITING : CHANNEL_NAME[ch.kind] ?? '', frac: ch.ticks / ch.total } : undefined,
    prompt: nearby && !w.hero.channel ? PROMPT[nearby.kind] : undefined,
    // focus also opens an ambush; retreat only makes sense in a fight
    orders: { focus: true, retreat: combat, regroup: true },
    minimap: {
      pois: w.region.pois.map((p) => ({ x: p.center.x, y: p.center.y, kind: p.kind, risk: p.risk })),
      extracts: w.region.extracts.map((e) => ({ x: e.pos.x, y: e.pos.y, closed: w.closed.includes(e.id) })),
      party: partyUnits(w).map((u) => ({ x: u.pos.x, y: u.pos.y, down: u.downed })),
      hero: { x: h.x, y: h.y },
    },
  };
}
