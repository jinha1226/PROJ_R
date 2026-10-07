import { spawnFoe } from '../grid/foes';
import { dist, tileAt, walkable, type Cell, type GEvent } from '../grid/types';
import { alive, damage, entOf, occupied, posOf, type Party, type Unit } from './partyCore';
import { FOES } from './partyDefs';

/** The general's reinforcements share its floor strength and waking band. */
function callBand(p: Party, u: Unit, t: number, ev: GEvent[]): void {
  u.called = true;
  const at = posOf(p, u), cells: Cell[] = [];
  for (let y = at.y - 3; y <= at.y + 3; y++) for (let x = at.x - 3; x <= at.x + 3; x++) {
    const c = { x, y };
    if (dist(at, c) <= 3 && walkable(tileAt(p.s.map, c)) && !occupied(p, c, '')) cells.push(c);
  }
  for (const c of p.s.rng.shuffle(cells).slice(0, 3)) {
    const e = spawnFoe(p.s, 'minion', c, true);
    e.hp = e.maxHp = Math.round(FOES.goblin.hp * (u.foeScale ?? 1));
    e.group = u.group ?? -1;
    p.units.push({ status: {}, trig: {}, nth: 0, still: 0, crisisUsed: false, ultReady: 0, id: e.id, side: 'foe', foe: 'goblin', foeScale: u.foeScale, group: u.group,
      asleep: false, nextAt: t + 0.5, order: null, ready: [0, 0], tauntUntil: 0, shield: 0,
      hiddenUntil: 0, hasteUntil: 0, frozenUntil: 0, empower: 1, guardReady: 0, progress: 0 });
    ev.push({ t, type: 'summon', src: u.id, dst: e.id, to: { ...c } });
  }
}

/** Special foe actions consume a moment; undefined allows its normal move or attack. */
export function foeTurn(p: Party, u: Unit, t: number, ev: GEvent[]): number | undefined {
  if (u.side !== 'foe' || !alive(p, u) || u.asleep) return undefined;
  const e = entOf(p, u.id)!;
  if (u.foe === 'shaman' && t >= (u.mendReady ?? 0)) {
    const hurt = p.units.filter((f) => {
      const fe = entOf(p, f.id)!;
      return f.side === 'foe' && alive(p, f) && !f.asleep && dist(e.pos, fe.pos) <= 5 && fe.hp < fe.maxHp * 0.7;
    }).sort((a, b) => {
      const ae = entOf(p, a.id)!, be = entOf(p, b.id)!;
      return ae.hp / ae.maxHp - be.hp / be.maxHp;
    })[0];
    if (hurt) {
      const he = entOf(p, hurt.id)!, amount = Math.min(12, he.maxHp - he.hp);
      he.hp += amount; u.mendReady = t + 6;
      ev.push({ t, type: 'heal', src: u.id, dst: hurt.id, to: { ...he.pos }, amount });
      return FOES.shaman.atk;
    }
  }
  if (u.foe !== 'warlord') return undefined;
  if (!u.called && e.hp < e.maxHp / 2) callBand(p, u, t, ev);
  const near = p.units.filter((h) => h.side === 'hero' && alive(p, h) && dist(e.pos, posOf(p, h)) <= 2);
  if (u.slamPending) {
    u.slamPending = false;
    for (const h of near) {
      damage(p, t, u.id, h, Math.round(p.s.rng.int(12, 16) * (u.foeScale ?? 1)), ev, false, false, 'physical', true);
      ev.push({ t, type: 'react', src: u.id, dst: h.id, to: { ...posOf(p, h) }, text: 'shatter' });
    }
    return FOES.warlord.atk;
  }
  if (near.length && t >= (u.slamReady ?? 0)) {
    u.slamReady = t + 9; u.slamPending = true;
    ev.push({ t, type: 'telegraph', src: u.id, to: { ...e.pos }, amount: 2, text: 'slam' });
    return 1.5;
  }
  return undefined;
}
