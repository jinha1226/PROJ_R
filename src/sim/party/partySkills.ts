import { DIRS, dist, same, tileAt, walkable, type Cell, type GEvent } from '../grid/types';
import { alive, canHit, damage, entOf, occupied, passiveMult, posOf, roll, stats, strike, targetOf, unitOf, type Party, type Unit } from './partyCore';
import { CLASSES, SKILLS } from './partyDefs';
import { T } from './partyTraits';

/** Queue a hero's skill (as in FTL: orders are given at any time, even paused; they happen as time runs). Again cancels it. */
export function queueSkill(p: Party, id: string, slot: 0 | 1): void {
  const u = unitOf(p, id);
  if (!u || u.side !== 'hero' || !alive(p, u) || p.time < u.ready[slot] || !CLASSES[u.cls!].skills[slot]) return;
  u.queued = u.queued === slot ? undefined : slot;
}

/** A hero's skill, now, if it is ready and has what it needs (a target in reach for aimed ones); it costs a short moment. */
export function useSkill(p: Party, id: string, slot: 0 | 1): GEvent[] {
  const u = unitOf(p, id);
  if (!u || u.side !== 'hero' || !alive(p, u) || p.time < u.ready[slot]) return [];
  const skill = CLASSES[u.cls!].skills[slot], t = p.time, ev: GEvent[] = [], me = entOf(p, id)!;
  if (!skill) return [];
  const foes = p.units.filter((x) => x.side === 'foe' && alive(p, x));
  const near = (c: Cell, r: number) => foes.filter((f) => dist(posOf(p, f), c) <= r);
  const target = targetOf(p, u, t);
  const aimed = (range = stats(u).range) => (target && canHit(p, u, target, range) ? target : undefined);
  switch (skill) {
    case 'taunt':
      for (const f of near(me.pos, 4)) { f.tauntBy = id; f.tauntUntil = t + 5; }
      ev.push({ t, type: 'buff', src: id, dst: id, text: 'taunt' });
      break;
    case 'whirl': {
      ev.push({ t, type: 'bump', src: id, text: 'whirl', from: { ...me.pos }, to: { ...me.pos } });
      for (const f of near(me.pos, u.weapon === 'greataxe' ? 2 : 1)) damage(p, t, id, f, roll(p, [6, 9]), ev);
      break;
    }
    case 'frenzy': u.hasteUntil = t + 5; ev.push({ t, type: 'buff', src: id, dst: id, text: 'frenzy' }); break;
    case 'stealth': u.hiddenUntil = t + 4 + T.stealth(u); u.empower = 2.5; ev.push({ t, type: 'buff', src: id, dst: id, text: 'stealth' }); break;
    case 'heal': {
      const ally = p.units.filter((x) => x.side === 'hero' && alive(p, x)).sort((a, b) => ratio(p, a) - ratio(p, b))[0]!;
      const ae = entOf(p, ally.id)!, n = Math.min(Math.round(22 * T.heal(u)), ae.maxHp - ae.hp);
      ae.hp += n;
      ev.push({ t, type: 'heal', src: id, dst: ally.id, amount: n });
      break;
    }
    case 'ward':
      for (const a of p.units) if (a.side === 'hero' && alive(p, a) && dist(posOf(p, a), me.pos) <= 4) { a.shield = Math.min(30 + T.ward(u), a.shield + 15 + T.ward(u)); ev.push({ t, type: 'buff', src: id, dst: a.id, text: 'ward' }); }
      break;
    case 'fireball': {
      const tg = aimed(); if (!tg) return [];
      const tp = posOf(p, tg);
      ev.push({ t, type: 'shoot', src: id, dst: tg.id, from: { ...me.pos }, to: { ...tp }, text: 'spell' }, { t, type: 'react', src: id, to: { ...tp }, text: 'ignite' });
      for (const f of near(tp, 1)) damage(p, t, id, f, Math.round(roll(p, [10, 14]) * passiveMult(p, u, f, t, ev) * T.amplify(u)), ev);
      break;
    }
    case 'frost': {
      const tg = aimed(); if (!tg) return [];
      const tp = posOf(p, tg);
      ev.push({ t, type: 'shoot', src: id, dst: tg.id, from: { ...me.pos }, to: { ...tp }, text: 'spell' }, { t, type: 'react', src: id, to: { ...tp }, text: 'freeze' });
      damage(p, t, id, tg, Math.round(roll(p, [6, 9]) * T.amplify(u)), ev);
      tg.frozenUntil = t + 2.5;
      tg.nextAt = Math.max(tg.nextAt, tg.frozenUntil);
      break;
    }
    case 'volley': { const tg = aimed(); if (!tg) return []; for (let k = 0; k < 3; k++) if (alive(p, tg)) strike(p, u, tg, t + k * 0.15, ev); break; }
    case 'aimed': {
      const tg = aimed(); if (!tg) return [];
      ev.push({ t, type: 'shoot', src: id, dst: tg.id, from: { ...me.pos }, to: { ...posOf(p, tg) }, text: 'bow' });
      damage(p, t, id, tg, Math.round(roll(p, [18, 24]) * passiveMult(p, u, tg, t, ev)), ev);
      break;
    }
    case 'pierce': {
      const tg = aimed(); if (!tg) return [];
      const tp = posOf(p, tg), dir = { x: Math.sign(tp.x - me.pos.x), y: Math.sign(tp.y - me.pos.y) };
      ev.push({ t, type: 'shoot', src: id, dst: tg.id, from: { ...me.pos }, to: { ...tp }, text: 'bow' });
      for (let k = 1; k <= 9; k++) {
        const c = { x: me.pos.x + dir.x * k, y: me.pos.y + dir.y * k };
        const f = foes.find((x) => same(posOf(p, x), c) && alive(p, x));
        if (f) damage(p, t, id, f, roll(p, [9, 12]), ev);
      }
      break;
    }
    case 'backstab': {
      const tg = target && dist(posOf(p, target), me.pos) <= 5 ? target : undefined;
      if (!tg) return [];
      const tp = posOf(p, tg);
      const spot = dist(me.pos, tp) === 1 ? me.pos : DIRS.map((d) => ({ x: tp.x + d.x, y: tp.y + d.y })).filter((c) => walkable(tileAt(p.s.map, c)) && !occupied(p, c, id)).sort((a, b) => dist(b, me.pos) - dist(a, me.pos))[0];
      if (!spot) return [];
      if (!same(spot, me.pos)) { ev.push({ t, type: 'teleport', src: id, from: { ...me.pos }, to: { ...spot } }); me.pos = { ...spot }; }
      strike(p, u, tg, t + 0.05, ev, 2);
      break;
    }
  }
  u.ready[slot] = t + SKILLS[skill].cd * T.cd(u);
  u.nextAt = Math.max(u.nextAt, t + 0.6);
  return ev;
}

const ratio = (p: Party, u: Unit) => entOf(p, u.id)!.hp / entOf(p, u.id)!.maxHp;
