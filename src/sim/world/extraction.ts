import { xitem } from '../../data/extract';
import { downUnit } from '../battle/damage';
import type { WorldState } from './types';
import { emitW, heroUnit } from './worldState';
import { finishEquip, finishSearch } from './interact';

const EXTRACT_TICKS = 8 * 20;
const POISON_EVERY = 20;
const POISON_FRAC = 0.03;

const openExtractAt = (w: WorldState) => {
  const h = heroUnit(w).pos;
  return w.region.extracts.find((e) => !w.closed.includes(e.id) && Math.hypot(e.pos.x - h.x, e.pos.y - h.y) <= e.radius);
};

/** Damage this tick cancels searching, equipping and recall, and restarts the extraction count. */
export function onHeroDamage(w: WorldState): void {
  const h = heroUnit(w);
  const hurt = h.hp < w.hero.lastHp - 1e-9;
  w.hero.lastHp = h.hp;
  const ch = w.hero.channel;
  if (!hurt || !ch) return;
  if (ch.kind === 'extract') ch.ticks = 0;
  else if (ch.kind !== 'drink') {
    w.hero.channel = undefined;
    emitW(w, 'interrupted', { kind: ch.kind });
  }
}

/** Progresses the hero's channel (search, equip, drink, recall, extract) and starts extraction in a zone. */
export function updateChannel(w: WorldState): void {
  const zone = openExtractAt(w);
  const ch = w.hero.channel;
  if (zone && !ch) w.hero.channel = { kind: 'extract', ticks: 0, total: EXTRACT_TICKS, target: zone.id };
  if (!zone && ch?.kind === 'extract') w.hero.channel = undefined;
  const c = w.hero.channel;
  if (!c) return;
  c.ticks++;
  if (c.ticks < c.total) return;
  w.hero.channel = undefined;
  if (c.kind === 'search') finishSearch(w, c.target!);
  else if (c.kind === 'equip') finishEquip(w, c.index!);
  else if (c.kind === 'drink') {
    const h = heroUnit(w);
    const use = xitem(c.target!).use;
    if (use?.kind === 'heal') h.hp = Math.min(h.maxHp, h.hp + h.maxHp * use.frac);
    w.hero.lastHp = h.hp;
  } else if (c.kind === 'recall' || c.kind === 'extract') {
    w.outcome = 'extracted';
    emitW(w, 'extracted', { via: c.kind });
  }
}

/** Poison mist hurts the hero unless an antidote is active. */
export function updateHazards(w: WorldState): void {
  if (w.b.tick % POISON_EVERY !== 0) return;
  const h = heroUnit(w);
  if (!h.alive || h.downed || w.hero.poisonImmuneUntil > w.b.tick) return;
  if (!w.region.hazards.some((z) => Math.hypot(z.center.x - h.pos.x, z.center.y - h.pos.y) <= z.radius)) return;
  h.hp -= h.maxHp * POISON_FRAC;
  emitW(w, 'poison');
  if (h.hp <= 0) downUnit(w.b, h, null);
}
