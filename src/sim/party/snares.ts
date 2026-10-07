import { dist, same, tileAt, walkable, type Cell, type GEvent } from '../grid/types';
import { alive, damage, levelDmg, occupied, posOf, stats, type Party, type Unit } from './partyCore';
import { applyStatus } from './status';
import { tagsOf } from './classKit';
import { resonant } from './resonance';
import { ampBase, rank } from './traitTypes';
import { action } from './triggers';
import { duoFor } from './cardsCombo';
import { nextElement } from './cardsMage';
import { corpsesNear } from './corpses';

/** a rogue's snare: lightning (three go-offs, shocks) or fire (bursts once, burns); fires at most once a turn */
export interface Snare { at: Cell; by: string; kind: 'bolt' | 'fire'; charges: number; ready: number }
export const SNARE_NAME = { bolt: '번개 함정', fire: '화염 함정' } as const;

const owner = (p: Party, s: Snare) => p.units.find((u) => u.id === s.by);
/** how many snares of a kind a rogue may keep (#함정 ×3 adds one) */
export const snareCap = (p: Party, u: Unit, kind: Snare['kind']): number =>
  (kind === 'bolt' && rank(u, 'lightningTrap') >= 2 ? 5 : 3) + (resonant(p, u, '함정', 1) ? 1 : 0);
export const snaresOf = (p: Party, u: Unit, kind?: Snare['kind']) => (p.snares ?? []).filter((s) => s.by === u.id && (!kind || s.kind === kind));

/** Lays a snare on the cell (a full set of lightning snares takes no more; a full set of fire snares drops its oldest). */
export function laySnare(p: Party, u: Unit, at: Cell, kind: Snare['kind'], t: number, ev: GEvent[]): boolean {
  if (!walkable(tileAt(p.s.map, at)) || (p.snares ?? []).some((s) => same(s.at, at))) return false;
  const mine = snaresOf(p, u, kind);
  if (mine.length >= snareCap(p, u, kind)) {
    if (kind === 'bolt') return false;
    p.snares = p.snares!.filter((s) => s !== mine[0]);
  }
  (p.snares ??= []).push({ at: { ...at }, by: u.id, kind, charges: kind === 'bolt' ? 3 : 1, ready: t });
  ev.push({ t, type: 'buff', src: u.id, to: { ...at }, text: '함정 설치' });
  return true;
}

/** The nearest free floor cell within two of the spot that holds no snare (none: undefined). */
export function snareSpot(p: Party, from: Cell): Cell | undefined {
  const cells: Cell[] = [];
  for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++) {
    const c = { x: from.x + dx, y: from.y + dy };
    if ((dx || dy) && walkable(tileAt(p.s.map, c)) && !occupied(p, c, '') && !(p.snares ?? []).some((s) => same(s.at, c))) cells.push(c);
  }
  return cells.sort((a, b) => dist(a, from) - dist(b, from) || Math.hypot(a.x - from.x, a.y - from.y) - Math.hypot(b.x - from.x, b.y - from.y))[0];
}

/** A snare goes off: lightning strikes the foe on it and shocks it; fire bursts (a wider burst upgraded) and burns. Chain detonation sets off the rogue's snares within two, each once. */
function fire(p: Party, s: Snare, t: number, ev: GEvent[], done: Set<Snare>, chained = false): void {
  const u = owner(p, s);
  done.add(s); s.charges--; s.ready = t + 1;
  if (!u) return;
  const [lo, hi] = stats(u, t, p).dmg, amp = (rank(u, 'trapAmp') ? ampBase(u, 'trapAmp', 1.15) ** (tagsOf(u).함정 ?? 0) : 1) * (chained && rank(u, 'chainDetonate') >= 2 ? 1.5 : 1);
  const amount = Math.max(1, Math.round(((lo + hi) / 2) * levelDmg(u) * (s.kind === 'bolt' ? 0.8 : 1) * amp));
  const reach = (s.kind === 'fire' && rank(u, 'fireTrap') >= 2) || (s.kind === 'bolt' && rank(u, 'lightningTrap') >= 3) ? 1 : 0;
  // fire trap 3: burning ground where it went off
  if (s.kind === 'fire' && rank(u, 'fireTrap') >= 3) (p.grounds ??= []).push({ at: { ...s.at }, by: u.id, until: t + 2, next: t + 1, kind: 'burn', r: 1 });
  ev.push({ t, type: 'buff', src: u.id, to: { ...s.at }, text: SNARE_NAME[s.kind] });
  for (let k = 0; k < (resonant(p, u, '함정', 2) ? 2 : 1); k++) {
    for (const f of p.units.filter((x) => x.side === 'foe' && alive(p, x) && dist(posOf(p, x), s.at) <= reach)) {
      damage(p, t, u.id, f, amount, ev, true, false, s.kind === 'bolt' ? 'lightning' : 'fire');
      if (alive(p, f)) applyStatus(p, u, f, s.kind === 'bolt' ? 'shock' : 'burn', t, ev);
      // the mage-rogue combo: the element cycle's next element too
      if (alive(p, f) && duoFor(p, u, 'elemTrap')) applyStatus(p, u, f, nextElement(u), t, ev);
    }
  }
  // the rogue-necromancer combo: a snare going off by a body leaves a poison cloud
  if (duoFor(p, u, 'poisonTrap') && corpsesNear(p, s.at, 1).length) (p.grounds ??= []).push({ at: { ...s.at }, by: u.id, until: t + 2, next: t + 1, kind: 'poison', r: 2 });
  if (rank(u, 'chainDetonate')) for (const o of p.snares ?? []) if (!done.has(o) && o.by === s.by && o.charges > 0 && dist(o.at, s.at) <= 2) fire(p, o, t, ev, done, true);
}

/** Every step: a snare with a foe on it goes off (once a turn); spent snares are cleared. */
export function tickSnares(p: Party, t: number, ev: GEvent[]): void {
  if (!p.snares?.length) return;
  for (const s of [...p.snares]) {
    if (s.charges <= 0 || t < s.ready) continue;
    if (!p.units.some((x) => x.side === 'foe' && alive(p, x) && same(posOf(p, x), s.at))) continue;
    action(p, () => fire(p, s, t, ev, new Set()));
  }
  p.snares = p.snares.filter((s) => s.charges > 0 && owner(p, s));
}
