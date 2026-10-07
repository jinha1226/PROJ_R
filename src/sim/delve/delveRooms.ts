import { createRng } from '../../core/rng';
import { damage, entOf, alive, unitOf, type Unit } from '../party/partyCore';
import { living } from '../roam/roam';
import { linesOf, soulsOf } from '../party/body';
import { dist, idx, same, type Cell, type GEvent } from '../grid/types';
import { PACK_SIZE, nextItemId } from './gear';
import { itemName, rollItem, rollConsumable, type Item } from './items';
import { HERO_SOULS, type HeroSoulId } from './heroSouls';
import type { DelveFloor } from './delveGen';
import type { DelveParty } from './delveSim';

export function setupRooms(p: DelveParty, f: DelveFloor): void {
  const rng = createRng((p.seed ^ 0x73ae) + p.floor * 977);
  p.rooms = f.rooms; p.chests = f.chests.map((c) => ({ ...c, opened: false }));
  p.oreNodes = f.ore.map((pos) => ({ pos, left: rng.int(2, 2), progress: 0 }));
  // the view draws these pillars as ore rock
  p.s.map.ore = f.ore.map((c) => ({ ...c }));
  p.shrine = f.shrine ? { pos: f.shrine, used: false } : undefined;
  p.floorItems = []; p.boss = f.boss; p.roomTime = p.time; p.lootReaped = new Set(); p.handledMoves = new WeakSet();
  for (const u of living(p)) for (const s of soulsOf(u)) if (s.hero && !p.foundHeroes.includes(s.hero)) p.foundHeroes.push(s.hero);
  for (const s of p.carried) if (typeof s !== 'string' && s.hero && !p.foundHeroes.includes(s.hero)) p.foundHeroes.push(s.hero);
  const choices = (Object.keys(HERO_SOULS) as HeroSoulId[]).filter((id) => !p.foundHeroes.includes(id));
  if (f.crypt && choices.length) {
    const hero = rng.pick(choices);
    p.souls.push({ id: p.souls.length, pos: { ...f.crypt }, cls: HERO_SOULS[hero].cls, hero, taken: false });
  }
  p.avoidTraps = true;
  p.beforeStep = (u, t, ev) => spotTraps(p, u, t, ev);
  p.onMovement = (moves, ev) => movement(p, moves, ev);
}

function spotTraps(p: DelveParty, u: Unit, t: number, ev: GEvent[]): void {
  if (!alive(p, u) || u.side !== 'hero' || !linesOf(u).includes('rogue')) return;
  for (const trap of p.s.traps) if (!trap.found && dist(entOf(p, u.id)!.pos, trap.pos) <= 3) {
    trap.found = true; ev.push({ t, type: 'trapFound', src: u.id, to: { ...trap.pos } });
  }
}
function movement(p: DelveParty, moves: GEvent[], ev: GEvent[]): void {
  for (const move of moves) {
    if (!['move', 'teleport'].includes(move.type) || !move.src || !move.to || !move.from || same(move.from, move.to) || p.handledMoves.has(move)) continue;
    p.handledMoves.add(move);
    const u = unitOf(p, move.src);
    if (!u || !alive(p, u)) continue;
    const trap = p.s.traps.find((t) => same(t.pos, move.to!));
    if (trap) {
      trap.found = true;
      ev.push({ t: move.t, type: 'trap', src: u.id, to: { ...trap.pos }, text: trap.kind });
      if (trap.kind === 'spike') damage(p, move.t, 'trap', u, 6 + p.floor, ev);
      if (trap.kind === 'alarm') {
        const groups = new Set(p.units.filter((f) => f.side === 'foe' && alive(p, f) && dist(entOf(p, f.id)!.pos, trap.pos) <= 10).map((f) => f.group));
        const newlyWoken = p.units.some((f) => f.side === 'foe' && alive(p, f) && f.asleep && groups.has(f.group));
        for (const f of p.units) if (f.side === 'foe' && alive(p, f) && groups.has(f.group)) { f.asleep = false; f.alertUntil = move.t + 1; f.nextAt = Math.max(f.nextAt, move.t); }
        if (groups.size) {
          // Direct alarm wakes happen before roamStep can observe the transition.
          for (const hero of living(p)) if (hero.order?.kind === 'move' && (!p.combat || (newlyWoken && hero.id === p.manual))) hero.order = null;
          p.combat = true;
        }
      }
    }
    deaths(p, ev);
    pickup(p, u, move.to, ev);
  }
}
function pickup(p: DelveParty, u: Unit, at: Cell, ev: GEvent[]): void {
  if (u.side !== 'hero' || !alive(p, u)) return;
  for (let i = 0; i < p.floorItems.length && p.pack.length < PACK_SIZE;) {
    const drop = p.floorItems[i]!;
    if (!same(drop.pos, at)) { i++; continue; }
    p.pack.push(drop.item); p.floorItems.splice(i, 1);
    ev.push({ t: p.time, type: 'pickup', src: u.id, to: { ...at }, text: itemName(drop.item) });
  }
}
function item(p:DelveParty,tier:number,gearOnly=false):Item {return {...rollItem(p.s.rng,p.floor,(tier>1||gearOnly)?p.s.rng.pick(['weapon','armor','accessory']):undefined,tier),id:nextItemId(p)};}
function material(p: DelveParty, text: 'ore' | 'bio' | 'crystal', amount: number, ev: GEvent[]): void {
  p[text] += amount; ev.push({ t: p.time, type: 'loot', text, amount });
}
function deaths(p: DelveParty, ev: GEvent[]): void {
  for (const u of p.units) {
    const e = entOf(p, u.id);
    if (!e || e.alive || p.lootReaped.has(u.id)) continue;
    p.lootReaped.add(u.id);
    const drops: Item[] = [];
    if (u.side === 'hero' && u.gear) {
      if (u.gear.weapon) drops.push(u.gear.weapon);
      if (u.gear.armor) drops.push(u.gear.armor);
      if(u.gear.accessory)drops.push(u.gear.accessory);
      u.gear = undefined; u.weapon = 'fists';
      if (drops.length) ev.push({ t: p.time, type: 'drop', src: u.id, text: 'gear', to: { ...e.pos } });
    } else if (u.foe === 'warlord') {
      drops.push(item(p, 3), item(p, 3)); material(p, 'crystal', 3, ev);
      ev.push({ t: p.time, type: 'victory', to: { ...e.pos } });
    } else if (u.side === 'foe' && e.elite && p.s.rng.chance(0.15)) drops.push(item(p, 2));
    else if(u.side==='foe'&&p.s.rng.chance(.1))drops.push({...rollConsumable(p.s.rng),id:nextItemId(p)});
    for (const it of drops) p.floorItems.push({ pos: { ...e.pos }, item: it });
  }
}
/** Floor rules run after roaming; movement hooks resolve entries during commands and multi-action ticks. */
export function roomStep(p: DelveParty, before: Map<string, Cell>, ev: GEvent[]): void {
  const elapsed = Math.max(0, p.time - p.roomTime); p.roomTime = p.time;
  movement(p, [...ev], ev);
  for (const u of p.units) {
    const at = entOf(p, u.id)?.pos, from = before.get(u.id);
    if (at && from && !same(from, at) && !ev.some((e) => e.src === u.id && (e.type === 'move' || e.type === 'teleport'))) movement(p, [{ t: p.time, type: 'move', src: u.id, from, to: at }], ev);
    spotTraps(p, u, p.time, ev);
  }
  deaths(p, ev);
  for (const u of living(p)) pickup(p, u, entOf(p, u.id)!.pos, ev);
  if (p.combat) return;
  for (const c of p.chests) {
    const by = living(p).find((u) => dist(entOf(p, u.id)!.pos, c.pos) <= 1);
    if (c.opened || !by || PACK_SIZE - p.pack.length < (c.tier === 3 ? 2 : 1)) continue;
    c.opened = true;
    const state = p.s.chests.find((s) => same(s.pos, c.pos)); if (state) state.opened = true;
    ev.push({ t: p.time, type: 'open', src: by.id, to: { ...c.pos } });
    const give = (tier:number,gearOnly=false) => { const it = item(p, tier,gearOnly); p.pack.push(it); ev.push({ t: p.time, type: 'loot', src: by.id, text: itemName(it) }); };
    if (c.tier === 1) {
      if(p.s.rng.chance(.5)){const it={...rollConsumable(p.s.rng),id:nextItemId(p)};p.pack.push(it);ev.push({t:p.time,type:'loot',src:by.id,text:itemName(it)});}
      else give(1,true);
    } else if (c.tier === 2) { give(2); material(p, 'ore', p.s.rng.int(1, 2), ev); }
    else { give(3); give(1); material(p, 'crystal', p.s.rng.int(1, 2), ev); }
  }
  for (const node of p.oreNodes) {
    // a clone with nothing to do, or one told to stand here, works the vein beside it
    const miners = living(p).filter((u) => (!u.order || u.order.kind === 'hold') && dist(entOf(p, u.id)!.pos, node.pos) <= 1);
    if (!node.left) continue;
    node.progress += elapsed * miners.length;
    while (node.progress + 1e-9 >= 2 && node.left > 0) { node.progress -= 2; node.left--; material(p, 'ore', 1, ev); }
    if (!node.left) { node.progress = 0; p.s.map.tiles[idx(p.s.map, node.pos)] = 'floor'; }
  }
  if (p.shrine && !p.shrine.used && living(p).some((u) => dist(entOf(p, u.id)!.pos, p.shrine!.pos) <= 1)) {
    p.shrine.used = true;
    for (const u of living(p)) { const e = entOf(p, u.id)!, amount = e.maxHp - e.hp; e.hp = e.maxHp; ev.push({ t: p.time, type: 'heal', dst: u.id, amount }); }
    ev.push({ t: p.time, type: 'buff', text: 'shrine', to: { ...p.shrine.pos } });
  }
}
