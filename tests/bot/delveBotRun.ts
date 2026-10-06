import { newDelve, delveTick, canDescend, descend, type DelveParty } from '../../src/sim/delve/delveSim';
import { CATALOG } from '../../src/sim/delve/catalog';
import type { Item } from '../../src/sim/delve/items';
import type { BaseClass } from '../../src/sim/party/partyDefs';
import { BODY_COST, implant, living, print } from '../../src/sim/roam/roam';
import { navigate, supplies } from './delveBotPolicy';

export const compositions: BaseClass[][] = [['warrior', 'archer', 'cleric'], ['warrior', 'mage', 'rogue'], ['archer', 'cleric', 'mage']];
interface FloorStats { floor: number; common: number; fine: number; rare: number; trinkets: number; consumables: number; ore: number; crystal: number; bio: number; seconds: number }
export interface Run { seed: number; comp: string; floor: number; general: boolean; lost: number; end: 'wipe' | 'general' | 'floor5' | 'timeout'; seconds: number; lastPolicy: string; idleSeconds: number; floors: FloorStats[] }
const floorStats = (floor: number): FloorStats => ({ floor, common: 0, fine: 0, rare: 0, trinkets: 0, consumables: 0, ore: 0, crystal: 0, bio: 0, seconds: 0 });
const inventory = (p: DelveParty): Item[] => [...p.pack, ...living(p).flatMap((u) => u.gear ? Object.values(u.gear).filter((it):it is NonNullable<typeof it>=>!!it) : [])];
export function runDelveBot(seed: number, comp: BaseClass[]): Run {
  const p = newDelve(seed);
  p.bio = BODY_COST * 3;
  implant(p, living(p)[0]!, comp[0]!, []); p.bio -= BODY_COST;
  for (const cls of comp.slice(1)) { if (!print(p, cls, [])) throw Error('starting print failed'); p.bio -= BODY_COST; }
  for (const u of living(p)) { u.level = 1; u.xp = 0; }
  const seen = new Set(inventory(p).map((it) => it.id));
  const result: Run = { seed, comp: comp.join('/'), floor: 1, general: false, lost: 0, end: 'timeout', seconds: 0, lastPolicy: '', idleSeconds: 0, floors: [floorStats(1)] };
  let lastActivity = 0;
  while (p.time < 3600) {
    const f = result.floors[result.floors.length - 1]!;
    supplies(p);
    result.lastPolicy = navigate(p);
    const ev = delveTick(p, 0.5);
    f.seconds += 0.5;
    if (ev.some((e) => ['move', 'die', 'loot', 'pickup', 'open', 'hit'].includes(e.type))) lastActivity = p.time;
    for (const e of ev) {
      if (e.type === 'loot' && (e.text === 'bio' || e.text === 'ore' || e.text === 'crystal')) f[e.text] += e.amount ?? 0;
      if (e.type === 'die' && ['hero', 'c1', 'c2'].includes(e.dst ?? '')) result.lost++;
      if (e.type === 'victory') result.general = true;
    }
    // Death drops retain their IDs and must never count as newly generated loot.
    for (const e of ev.filter((e) => e.type === 'drop' && e.text === 'gear')) {
      for (const drop of p.floorItems) if (e.to && drop.pos.x === e.to.x && drop.pos.y === e.to.y) seen.add(drop.item.id);
    }
    for (const it of inventory(p)) if (!seen.has(it.id)) {
      seen.add(it.id);
      if('def'in it){const d=CATALOG[it.def]!;if(d.slot==='accessory')f.trinkets++;else f[d.floors[0]>=4?'rare':d.floors[0]>=2?'fine':'common']++;}else f.consumables++;
    }
    if (!living(p).length) { result.end = 'wipe'; break; }
    if (result.general) { result.end = 'general'; break; }
    if (canDescend(p)) {
      if (p.floor === 5) { result.end = 'floor5'; break; }
      descend(p); result.floor = p.floor; result.floors.push(floorStats(p.floor));
    }
  }
  result.seconds = p.time;
  result.lost = 3 - living(p).length;
  result.idleSeconds = p.time - lastActivity;
  return result;
}
export function summarize(runs: Run[]) {
  const group = (rs: Run[]) => ({ runs: rs.length, avgFloor: rs.reduce((n, r) => n + r.floor, 0) / (rs.length||1),
    reach3: rs.filter((r) => r.floor >= 3).length / (rs.length||1) * 100,
    survive3: rs.filter((r)=>r.floor>=4).length / (rs.length||1) * 100,
    reach5: rs.filter((r) => r.floor >= 5).length / (rs.length||1) * 100,
    general: rs.filter((r) => r.general).length / (rs.length||1) * 100,
    lost: rs.reduce((n, r) => n + r.lost, 0) / (rs.length||1),
    timeouts: rs.filter((r) => r.end === 'timeout').length });
  const floors = [1, 2, 3, 4, 5].map((floor) => {
    const visited = runs.flatMap((r) => r.floors).filter((f) => f.floor === floor);
    const sum = floorStats(floor);
    for (const f of visited) for (const k of ['common', 'fine', 'rare', 'trinkets', 'consumables', 'ore', 'crystal', 'bio', 'seconds'] as const) sum[k] += f[k];
    for (const k of ['common', 'fine', 'rare', 'trinkets', 'consumables', 'ore', 'crystal', 'bio', 'seconds'] as const) sum[k] /= visited.length || 1;
    return { visits: visited.length, ...sum };
  });
  return { total: group(runs), comps: compositions.map((c) => ({ comp: c.join('/'), ...group(runs.filter((r) => r.comp === c.join('/'))) })), floors };
}
