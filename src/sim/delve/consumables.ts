import { alive, damage, entOf, posOf, unitOf, type Party, type Unit } from '../party/partyCore';
import { action } from '../party/triggers';
import { applyStatus } from '../party/status';
import { dist, same, tileAt, walkable, type Cell, type GEvent } from '../grid/types';
import type { RoamParty } from '../roam/roam';
import { G, drink } from './gear';
export function useItem(p: RoamParty, heroId: string, itemId: string, cell?: Cell): GEvent[] {
    return action(p, () => consume(p, heroId, itemId, cell));
}
function consume(p: RoamParty, heroId: string, itemId: string, cell?: Cell): GEvent[] {
    const u = unitOf(p, heroId), i = p.pack.findIndex(it => it.id === itemId), it = p.pack[i];
    if (!u || u.side !== 'hero' || !alive(p, u) || !it || !('consumable' in it))
        return [];
    const t = p.time, id = it.consumable, ev: GEvent[] = [], at = cell ?? posOf(p, u);
    const aimed = ['fireBomb', 'iceBomb', 'poisonJar', 'smoke', 'boltWand'].includes(id);
    if (aimed && (!walkable(tileAt(p.s.map, at)) || dist(posOf(p, u), at) > 8))
        return [];
    if (id === 'boltWand' && (same(posOf(p, u), at) || (it.charges ?? 3) <= 0))
        return [];
    const inArea = p.units.filter(x => alive(p, x) && dist(posOf(p, x), at) <= 1);
    if (id === 'potion') {
        const e = entOf(p, u.id)!, amount = Math.min(e.maxHp - e.hp, Math.round(e.maxHp * .4 * G.healTaken(u)));
        e.hp += amount;
        u.lowHp = e.hp < e.maxHp / 2;
        ev.push({ t, type: 'drink', src: u.id }, { t, type: 'heal', src: u.id, dst: u.id, amount });
    }
    else if (id === 'rage') {
        u.damageBuff = 1.4;
        u.damageBuffUntil = t + 5;
    }
    else if (id === 'cleanse') {
        for (const a of p.units)
            if (a.side === 'hero' && alive(p, a)) {
                a.status = {};
                a.blindUntil = 0;
                a.frozenUntil = 0;
            }
    }
    else if (id === 'boltWand') {
        const from = posOf(p, u), dx = at.x - from.x, dy = at.y - from.y, divisor = Math.max(Math.abs(dx), Math.abs(dy));
        for (let k = 1; k < Math.max(p.s.map.w, p.s.map.h); k++) {
            const c = { x: from.x + Math.round(dx * k / divisor), y: from.y + Math.round(dy * k / divisor) };
            if (!walkable(tileAt(p.s.map, c)))
                break;
            for (const f of p.units)
                if (f.side === 'foe' && alive(p, f) && same(posOf(p, f), c)) {
                    damage(p, t, u.id, f, 10, ev, true);
                    applyStatus(p, u, f, 'shock', t, ev);
                }
        }
    }
    else
        for (const x of inArea) {
            if(!alive(p,u))break;
            if (id === 'smoke') {
                if (x.side === 'hero')
                    x.hiddenUntil = t + 2;
                else
                    x.blindUntil = t + 2;
            }
            else {
                if (id === 'fireBomb') {
                    damage(p, t, u.id, x, 8, ev, true);
                    applyStatus(p, u, x, 'burn', t, ev);
                }
                if (id === 'iceBomb')
                    applyStatus(p, u, x, 'freeze', t, ev);
                if (id === 'poisonJar')
                    applyStatus(p, u, x, 'poison', t, ev, 3);
            }
        }
    if (id === 'boltWand')
        it.charges = (it.charges ?? 3) - 1;
    if (id !== 'boltWand' || it.charges === 0)
        p.pack.splice(i, 1);
    u.nextAt = Math.max(t, u.nextAt) + .6;
    if (p.manual === u.id)
        p.waiting = false;
    if(alive(p,u))ev.push({ t, type: 'buff', src: u.id, text: '소모품' });
    return ev;
}
export function aiItem(p: Party, u: Unit): GEvent[] {
    if (!('pack' in p) || !alive(p, u))
        return [];
    const roam = p as RoamParty, e = entOf(p, u.id)!;
    if (e.hp < e.maxHp * .3) {
        const potion = roam.pack.find(it => 'consumable' in it && it.consumable === 'potion');
        const ev = potion ? useItem(roam, u.id, potion.id) : drink(roam, u.id);
        if (ev.length)
            return ev;
    }
    const bomb = roam.pack.find(it => 'consumable' in it && ['fireBomb', 'iceBomb', 'poisonJar'].includes(it.consumable));
    if (!bomb)
        return [];
    const foes = p.units.filter(f => f.side === 'foe' && !f.asleep && alive(p, f) && dist(posOf(p, u), posOf(p, f)) <= 8);
    const at = foes.find(f => foes.filter(x => dist(posOf(p, x), posOf(p, f)) <= 1).length >= 3 && !p.units.some(a=>a.side==='hero'&&alive(p,a)&&dist(posOf(p,a),posOf(p,f))<=1));
    return at ? useItem(roam, u.id, bomb.id, posOf(p, at)) : [];
}
