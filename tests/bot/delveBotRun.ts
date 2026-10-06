import { newDelve, delveTick, canDescend, descend, type DelveParty } from '../../src/sim/delve/delveSim';
import type { Item } from '../../src/sim/delve/items';
import { entOf } from '../../src/sim/party/partyCore';
import type { BaseClass } from '../../src/sim/party/partyDefs';
import { BODY_COST, implant, living, print } from '../../src/sim/roam/roam';
import { navigate, supplies } from './delveBotPolicy';

export const compositions: BaseClass[][] = [['warrior', 'archer', 'cleric'], ['warrior', 'mage', 'rogue'], ['archer', 'cleric', 'mage']];
interface FloorStats { floor: number; common: number; fine: number; rare: number; trinkets: number; ore: number; crystal: number; bio: number; seconds: number }
export interface Run { seed: number; comp: string; floor: number; general: boolean; lost: number; end: 'wipe' | 'general' | 'floor5' | 'timeout'; seconds: number; lastPolicy: string; idleSeconds: number; floors: FloorStats[] }
const floorStats = (floor: number): FloorStats => ({ floor, common: 0, fine: 0, rare: 0, trinkets: 0, ore: 0, crystal: 0, bio: 0, seconds: 0 });
const inventory = (p: DelveParty): Item[] => [...p.pack, ...living(p).flatMap((u) => u.gear ? [u.gear.weapon, ...(u.gear.armor ? [u.gear.armor] : [])] : [])];
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
    const worn = living(p).map((u) => ({ id: u.id, trinkets: [...(u.gear?.trinkets ?? [])] }));
    const nextBefore = p.nextItem;
    const ev = delveTick(p, 0.5);
    f.seconds += 0.5;
    if (ev.some((e) => ['move', 'die', 'loot', 'pickup', 'open', 'hit'].includes(e.type))) lastActivity = p.time;
    for (const e of ev) {
      if (e.type === 'loot' && (e.text === 'bio' || e.text === 'ore' || e.text === 'crystal')) f[e.text] += e.amount ?? 0;
      if (e.type === 'die' && ['hero', 'c1', 'c2'].includes(e.dst ?? '')) result.lost++;
      if (e.type === 'victory') result.general = true;
    }
    // Mark recreated death-drop IDs before a same-tick pickup can count them.
    for (const e of ev.filter((e) => e.type === 'drop' && e.text === 'gear')) {
      for (const drop of p.floorItems) if (e.to && drop.pos.x === e.to.x && drop.pos.y === e.to.y) seen.add(drop.item.id);
    }
    const matched = new Set<string>();
    for (const u of worn) if (!entOf(p, u.id)?.alive) for (const base of u.trinkets) {
      if (!base) continue;
      const recreated = [...inventory(p), ...p.floorItems.map((d) => d.item)]
        .filter((it) => it.kind === 'trinket' && it.base === base && Number(it.id.slice(5)) >= nextBefore && !matched.has(it.id))
        .sort((a, b) => Number(a.id.slice(5)) - Number(b.id.slice(5)))[0];
      if (recreated) { seen.add(recreated.id); matched.add(recreated.id); }
    }
    for (const it of inventory(p)) if (!seen.has(it.id)) {
      seen.add(it.id);
      if (it.kind === 'trinket') f.trinkets++; else f[it.rarity]++;
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
  const group = (rs: Run[]) => ({ runs: rs.length, avgFloor: rs.reduce((n, r) => n + r.floor, 0) / rs.length,
    reach3: rs.filter((r) => r.floor >= 3).length / rs.length * 100,
    reach5: rs.filter((r) => r.floor >= 5).length / rs.length * 100,
    general: rs.filter((r) => r.general).length / rs.length * 100,
    lost: rs.reduce((n, r) => n + r.lost, 0) / rs.length,
    timeouts: rs.filter((r) => r.end === 'timeout').length });
  const floors = [1, 2, 3, 4, 5].map((floor) => {
    const visited = runs.flatMap((r) => r.floors).filter((f) => f.floor === floor);
    const sum = floorStats(floor);
    for (const f of visited) for (const k of ['common', 'fine', 'rare', 'trinkets', 'ore', 'crystal', 'bio', 'seconds'] as const) sum[k] += f[k];
    for (const k of ['common', 'fine', 'rare', 'trinkets', 'ore', 'crystal', 'bio', 'seconds'] as const) sum[k] /= visited.length || 1;
    return { visits: visited.length, ...sum };
  });
  return { total: group(runs), comps: compositions.map((c) => ({ comp: c.join('/'), ...group(runs.filter((r) => r.comp === c.join('/'))) })), floors };
}
