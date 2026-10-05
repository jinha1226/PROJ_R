import { GridSim } from '../../../src/sim/grid/gridSim';
import { hitChance } from '../../../src/sim/grid/combat';
import { walkBlocked } from '../../../src/sim/grid/actions';
import { WEAPONS } from '../../../src/sim/grid/items';
import { findPath } from '../../../src/sim/grid/path';
import { canRegenerate } from '../../../src/sim/grid/regen';
import { heroDmg, weaponRange } from '../../../src/sim/grid/weapons';
import { add, canStep, DIRS, dist, idx, same, type Cell, type Ent, type GAction, type GridState } from '../../../src/sim/grid/types';
import type { BotMemory } from './policy';
import { adjacentFoes, awakeThreats, bladeIndex, dangerCells, direction, gunReady, isChoke, pistol,
  pistolIndex, safeSteps, shotTargets, stepToward, visibleFoes } from './view';

export const meleeFoe = (f: Ent) => ['minion', 'brute', 'ghoul', 'champion'].includes(f.kind);
const rangedFoe = (f: Ent) => f.kind === 'mage' || f.kind === 'archer';
const move = (s: GridState, to: Cell): GAction => ({ kind: 'move', dir: direction(s.hero.pos, to), plain: true });

export function dodge(s: GridState): GAction | null {
  const danger = dangerCells(s), h = s.hero;
  if (!danger.has(idx(s.map, h.pos))) return null;
  const exposed = (c: Cell) => s.foes.filter(f => f.alive && dist(c, f.pos) === 1).length;
  const safe = safeSteps(s).sort((a, b) => exposed(a) - exposed(b) || shotTargets(s, b).length - shotTargets(s, a).length);
  if (safe[0]) return move(s, safe[0]);
  // A mage marks 3x3: from its centre, escaping takes two steps. Find the safe edge.
  const queue = [{ c: h.pos, path: [] as Cell[] }], seen = new Set([idx(s.map, h.pos)]);
  for (const node of queue) {
    if (node.path.length >= 3) continue;
    for (const d of DIRS) {
      const c = add(node.c, d), k = idx(s.map, c);
      if (seen.has(k) || !canStep(s.map, node.c, d) || walkBlocked(s, c)) continue;
      seen.add(k);
      const path = [...node.path, c];
      if (!danger.has(k)) return move(s, path[0]!);
      queue.push({ c, path });
    }
  }
  return null;
}

function chokeStep(s: GridState): GAction | null {
  const danger = dangerCells(s), queue = [{ c: s.hero.pos, path: [] as Cell[] }];
  const seen = new Set([idx(s.map, s.hero.pos)]);
  for (const node of queue) {
    if (node.path.length && isChoke(s, node.c)) return move(s, node.path[0]!);
    if (node.path.length >= 4) continue;
    for (const d of DIRS) {
      const c = add(node.c, d), k = idx(s.map, c);
      if (seen.has(k) || !canStep(s.map, node.c, d) || walkBlocked(s, c) || danger.has(k)
        || (s.map.stairs && same(c, s.map.stairs))) continue;
      seen.add(k); queue.push({ c, path: [...node.path, c] });
    }
  }
  return null;
}
function shootTarget(s: GridState): Ent | undefined {
  const w = pistol(s); if (!w) return;
  const sim = GridSim.fromState(s);
  const chance = (f: Ent) => sim.shotChance(f.id) ?? hitChance(s.map, s.hero.pos, f.pos, WEAPONS[w.group].hit + (s.hero.modStats?.hit ?? 0));
  const all = shotTargets(s), good = all.filter(f => chance(f) >= 0.35);
  const damage = heroDmg(s, w).reduce((a, b) => a + b) / 2;
  const rank = (f: Ent) => rangedFoe(f) ? 0 : f.hp <= damage ? 1 : f.elite || f.kind === 'champion' ? 2 : 3;
  return (good.length ? good : all).sort((a, b) => rank(a) - rank(b)
    || (rank(a) <= 1 ? a.hp - b.hp : 0) || dist(s.hero.pos, a.pos) - dist(s.hero.pos, b.pos))[0];
}
export function tactic(s: GridState, mem: BotMemory): GAction | null {
  const evasion = dodge(s); if (evasion) return evasion;
  const h = s.hero, threats = awakeThreats(s), visible = visibleFoes(s), adj = adjacentFoes(s);
  const remembered = mem.pursuit && s.foes.find(f => f.id === mem.pursuit!.id && f.alive);
  if (mem.pursuit && (mem.pursuit.floor !== s.run.floor || !remembered || same(h.pos, mem.pursuit.pos))) delete mem.pursuit;
  const tracked = threats.find(f => f.id === mem.pursuit?.id) ?? (!mem.pursuit ? threats[0] : undefined);
  if (tracked) mem.pursuit = { floor: s.run.floor, id: tracked.id, pos: { ...tracked.pos } };
  const blade = h.gear.hands[bladeIndex(s)];
  const damage = blade ? heroDmg(s, blade)[0] : 0;
  const target = adj.sort((a, b) => Number(b.hp <= damage) - Number(a.hp <= damage)
    || a.hp - b.hp || Number(a.kind === 'brute') - Number(b.kind === 'brute'))[0];
  const boss = visible.find(f => f.kind === 'champion');
  if (boss && !mem.bosses.includes(boss.id) && h.hp < h.maxHp * 0.8 && !threats.length && canRegenerate(s)) return { kind: 'wait' };
  if (boss && !mem.bosses.includes(boss.id)) mem.bosses.push(boss.id);
  const nearby = threats.filter(f => meleeFoe(f) && dist(f.pos, h.pos) <= 4);
  const surroundedBuild = h.suit.includes('tempest') || h.suit.includes('spinShot');
  const summoned = boss?.summoned && h.hp < h.maxHp * 0.5;
  if (!isChoke(s, h.pos) && (summoned || nearby.length >= 2 && (h.hp < h.maxHp * 0.7 || nearby.length >= 3))
    && !(surroundedBuild && h.hp >= h.maxHp * 0.6)) {
    const retreat = chokeStep(s); if (retreat) return retreat;
  }
  if (target && !(gunReady(s) && (h.suit.includes('reverseCut') || h.suit.includes('kite')))) {
    mem.chargeWaits = 0;
    return h.gear.active !== bladeIndex(s) ? { kind: 'swap' } : { kind: 'move', dir: direction(h.pos, target.pos) };
  }
  // Safe recovery takes precedence over waking a sleeper.
  if (!threats.length && !mem.pursuit && h.hp < h.maxHp * 0.85 && canRegenerate(s)) return null;
  const shot = gunReady(s) ? shootTarget(s) : undefined;
  const opener = h.suit.some(id => ['headshot', 'sniper', 'steady'].includes(id));
  if (shot && (shot.awake || opener || !!target)) {
    mem.chargeWaits = 0;
    if (!shot.awake && !threats.length) {
      const range = weaponRange(pistol(s), s.hero);
      const farther = safeSteps(s).filter(c => dist(c, shot.pos) > dist(h.pos, shot.pos) && dist(c, shot.pos) <= range
        && shotTargets(s, c).some(f => f.id === shot.id)).sort((a, b) => dist(b, shot.pos) - dist(a, shot.pos))[0];
      if (farther) return move(s, farther);
    }
    if (h.gear.active !== pistolIndex(s)) return { kind: 'swap' };
    if (!shot.awake && h.suit.includes('steady') && h.fx.lastAction !== 'wait') return { kind: 'wait' };
    return { kind: 'shoot', target: shot.id };
  }
  const ranged = visible.filter(f => f.awake && rangedFoe(f)).sort((a, b) => dist(a.pos, h.pos) - dist(b.pos, h.pos))[0];
  if (ranged) { const d = stepToward(s, ranged.pos); if (d) return { kind: 'move', dir: d }; }
  const approaching = threats.find(f => meleeFoe(f) && findPath(s.map, f.pos, h.pos, c => walkBlocked(s, c), 8));
  if (!gunReady(s) && approaching && mem.chargeWaits++ < 4) return { kind: 'wait' };
  const sleeper = visible.filter(f => !f.awake).sort((a, b) => dist(a.pos, h.pos) - dist(b.pos, h.pos))[0];
  const approach = approaching ?? (mem.pursuit ? { pos: mem.pursuit.pos } : sleeper);
  if (approach) {
    const d = stepToward(s, approach.pos);
    if (d) return h.gear.active !== bladeIndex(s) ? { kind: 'swap' } : { kind: 'move', dir: d };
  }
  return null;
}
