import { xitem } from '../../data/extract';
import { downUnit } from '../battle/damage';
import type { WorldState } from './types';
import { emitW, heroUnit } from './worldState';
import { finishEquip, finishSearch } from './interact';
import { partyUnits } from './party';

const EXTRACT_TICKS = 8 * 20;
/** getting out alive is worth experience */
const EXTRACT_XP = 30;
const POISON_EVERY = 20;
const POISON_FRAC = 0.03;

const PARTY_ZONE = 4;
const HIT_SETBACK = 2 * 20;
const DOWNED_PACE = 0.6;

const inZone = (e: { pos: { x: number; y: number }; radius: number }, p: { x: number; y: number }) => Math.hypot(e.pos.x - p.x, e.pos.y - p.y) <= Math.max(e.radius, PARTY_ZONE);
const openExtractAt = (w: WorldState) => w.region.extracts.find((e) => !w.closed.includes(e.id) && inZone(e, heroUnit(w).pos));
export const extractZone = (w: WorldState) => w.region.extracts.find((e) => e.id === w.party.exitVia);
export { inZone };

/** A hit on the leader cancels searching, equipping and recall; a hit on anyone sets the extraction gauge back 2 s. */
export function onHeroDamage(w: WorldState): void {
  const h = heroUnit(w);
  const hurtLeader = h.hp < w.hero.lastHp - 1e-9;
  w.hero.lastHp = h.hp;
  let hurtParty = false;
  for (const u of partyUnits(w)) {
    const was = w.hero.memberHp[u.id];
    if (was !== undefined && u.hp < was - 1e-9) hurtParty = true;
    w.hero.memberHp[u.id] = u.hp;
  }
  if (hurtLeader || hurtParty) w.hero.lastCombat = w.b.tick;
  const ch = w.hero.channel;
  if (!ch) return;
  if (ch.kind === 'extract') {
    if (hurtParty || hurtLeader) ch.ticks = Math.max(0, ch.ticks - HIT_SETBACK);
  } else if (hurtLeader) {
    w.hero.channel = undefined;
    emitW(w, 'interrupted', { kind: ch.kind });
  }
}

/** Progresses the hero's channel (search, equip, recall, extract) and starts extraction in a zone. */
export function updateChannel(w: WorldState): void {
  const dr = w.hero.drink;
  if (dr && ++dr.ticks >= dr.total) {
    w.hero.drink = undefined;
    const h = heroUnit(w);
    const use = xitem(dr.item).use;
    if (use?.kind === 'heal') h.hp = Math.min(h.maxHp, h.hp + h.maxHp * use.frac);
    w.hero.lastHp = h.hp;
    w.hero.memberHp[h.id] = h.hp;
  }
  const zone = openExtractAt(w);
  const ch = w.hero.channel;
  if (zone && !ch) w.hero.channel = { kind: 'extract', ticks: 0, total: EXTRACT_TICKS, target: zone.id };
  if (!zone && ch?.kind === 'extract') w.hero.channel = undefined;
  const c = w.hero.channel;
  if (!c) return;
  // carrying someone who is down slows the hold
  c.ticks += c.kind === 'extract' && partyUnits(w).some((u) => u.downed) ? DOWNED_PACE : 1;
  if (c.ticks < c.total) return;
  w.hero.channel = undefined;
  if (c.kind === 'search') finishSearch(w, c.target!);
  else if (c.kind === 'equip') finishEquip(w, c.target!, c.member);
  else if (c.kind === 'recall' || c.kind === 'extract') {
    w.outcome = 'extracted';
    w.party.exitVia = c.kind === 'recall' ? 'recall' : c.target;
    w.xp += EXTRACT_XP;
    emitW(w, 'extracted', { via: c.kind });
  }
}

const CALM_TICKS = 6 * 20;
const BREATH_PER_SEC = 0.005;

/** Out of combat for a while, the hero slowly catches their breath (potions are for fights). */
export function updateRegen(w: WorldState): void {
  const party = partyUnits(w);
  if (w.b.events.some((e) => e.type === 'damage' && party.some((u) => u.id === e.src))) w.hero.lastCombat = w.b.tick;
  if (w.b.tick - w.hero.lastCombat < CALM_TICKS) return;
  for (const h of party) {
    if (h.downed || h.hp >= h.maxHp) continue;
    h.hp = Math.min(h.maxHp, h.hp + (h.maxHp * BREATH_PER_SEC) / 20);
    w.hero.memberHp[h.id] = h.hp;
  }
  w.hero.lastHp = heroUnit(w).hp;
}

/** Poison mist hurts the hero unless an antidote is active. */
export function updateHazards(w: WorldState): void {
  if (w.b.tick % POISON_EVERY !== 0) return;
  if (w.hero.poisonImmuneUntil > w.b.tick) return;
  for (const h of partyUnits(w)) {
    if (h.downed || !w.region.hazards.some((z) => Math.hypot(z.center.x - h.pos.x, z.center.y - h.pos.y) <= z.radius)) continue;
    h.hp -= h.maxHp * POISON_FRAC;
    emitW(w, 'poison', { id: h.id });
    if (h.hp <= 0) downUnit(w.b, h, null);
  }
}
