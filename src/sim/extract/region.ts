import { createRng, type Rng } from '../../core/rng';
import type { Vec2 } from '../../core/vec2';
import type { Bounds, Obstacle } from '../battle/types';
import { NavGrid } from '../world/nav';
import { buildLayout } from './regionLayouts';
import { buildPoi, freeSpot, POI_RADIUS } from './poi';
import type { Container, ExtractPoint, PoiKind, Prop, Region, Spawn } from './regionTypes';

export * from './regionTypes';

export const REGION_BOUNDS: Bounds = { minX: -60, maxX: 60, minY: -45, maxY: 45 };
const POI_SPACING = 22;
const NIGHT_CLOSE_SEC = 480;
const d = (a: Vec2, b: Vec2) => Math.hypot(a.x - b.x, a.y - b.y);
const near = (p: Vec2, o: Obstacle, pad: number) =>
  o.kind === 'box' ? Math.abs(p.x - o.pos.x) < o.half!.x + pad && Math.abs(p.y - o.pos.y) < o.half!.y + pad : d(p, o.pos) < o.radius + pad;

type Side = 'w' | 'e' | 'n' | 's';
const edgePoint = (rng: Rng, side: Side, b: Bounds): Vec2 => {
  const inset = 5;
  if (side === 'w' || side === 'e') return { x: side === 'w' ? b.minX + inset : b.maxX - inset, y: rng.int(b.minY + 12, b.maxY - 12) };
  return { x: rng.int(b.minX + 12, b.maxX - 12), y: side === 'n' ? b.minY + inset : b.maxY - inset };
};

function placePois(rng: Rng, n: number, avoid: Vec2[], blockers: Obstacle[], b: Bounds): Vec2[] | null {
  const out: Vec2[] = [];
  for (let k = 0; k < 800 && out.length < n; k++) {
    const p = { x: rng.int(b.minX + 12, b.maxX - 12), y: rng.int(b.minY + 12, b.maxY - 12) };
    if (out.some((q) => d(p, q) < POI_SPACING) || avoid.some((q) => d(p, q) < 14) || blockers.some((o) => near(p, o, 10))) continue;
    out.push(p);
  }
  return out.length === n ? out : null;
}

function assignKinds(rng: Rng, spots: Vec2[], start: Vec2): { kind: PoiKind; c: Vec2 }[] {
  const byFar = [...spots].sort((a, b) => d(b, start) - d(a, start));
  const [boss, ...rest] = byFar;
  const far = rest.slice(0, 3);
  const temple = far.splice(rng.int(0, far.length - 1), 1)[0]!;
  const vault = far.splice(rng.int(0, far.length - 1), 1)[0]!;
  const others = rest.filter((p) => p !== temple && p !== vault);
  const pool: PoiKind[] = ['camp', 'nest', 'ruins', 'ruins'];
  const extras = rng.shuffle<PoiKind>(['camp', 'nest', 'ruins', 'swamp']);
  while (pool.length < others.length) pool.push(extras.pop()!);
  // ruins near the start, the rest shuffled
  const nearFirst = [...others].sort((a, b) => d(a, start) - d(b, start));
  const kinds = [pool.shift()!, ...rng.shuffle(pool)];
  const ruinsFirst = ['ruins' as PoiKind, ...kinds.filter((k, i) => !(k === 'ruins' && i === kinds.indexOf('ruins')))];
  return [{ kind: 'boss', c: boss! }, { kind: 'temple', c: temple }, { kind: 'vault', c: vault }, ...nearFirst.map((c, i) => ({ kind: ruinsFirst[i]!, c }))];
}

function scatter(rng: Rng, region: Omit<Region, 'seed'>, count: number, test: (p: Vec2) => boolean): Vec2[] {
  const out: Vec2[] = [];
  const b = region.bounds;
  for (let k = 0; k < count * 30 && out.length < count; k++) {
    const p = { x: rng.int(b.minX + 4, b.maxX - 4), y: rng.int(b.minY + 4, b.maxY - 4) };
    if (test(p) && !out.some((q) => d(p, q) < 3)) out.push(p);
  }
  return out;
}

function attempt(seed: number, tier: number): Omit<Region, 'seed'> | null {
  const rng = createRng(seed);
  const b = REGION_BOUNDS;
  const { layout, decor, blockers } = buildLayout(rng, b);
  const sides = rng.shuffle<Side>(['w', 'e', 'n', 's']);
  const start = edgePoint(rng, sides[0]!, b);
  const extracts: ExtractPoint[] = [];
  for (const side of sides.slice(1)) {
    const p = edgePoint(rng, side, b);
    if (d(p, start) >= 40 && !blockers.some((o) => near(p, o, 4))) extracts.push({ id: `x${extracts.length}`, pos: p, radius: 2.5 });
    if (extracts.length === 3 || (extracts.length === 2 && rng.chance(0.5))) break;
  }
  if (extracts.length < 2 || blockers.some((o) => near(start, o, 4))) return null;
  extracts[rng.int(0, extracts.length - 1)]!.closesAt = NIGHT_CLOSE_SEC;

  const spots = placePois(rng, rng.int(8, 10), [start, ...extracts.map((e) => e.pos)], blockers, b);
  if (!spots) return null;
  const builds = assignKinds(rng, spots, start).map(({ kind, c }, i) => buildPoi(rng, kind, `p${i}`, c, start, tier));
  const obstacles = [...blockers, ...builds.flatMap((x) => x.obstacles)];
  const containers: Container[] = builds.flatMap((x) => x.containers);
  const spawns: Spawn[] = builds.flatMap((x) => x.spawns);
  const props: Prop[] = builds.flatMap((x) => x.props);
  const pois = builds.map((x) => x.poi);
  const region: Omit<Region, 'seed'> = { layout, bounds: b, obstacles, props, decor, pois, containers, spawns, extracts, hazards: builds.flatMap((x) => x.hazards), start };

  // the vault key waits in another point's container
  const keyHolder = rng.pick(containers.filter((c) => c.kind !== 'vault' && c.kind !== 'herb' && pois.find((p) => p.id === c.poi)?.kind !== 'vault'));
  keyHolder.extra = ['x_vault_key'];

  const clearOfPois = (p: Vec2, pad: number) => !pois.some((q) => d(p, q.center) < q.radius + pad);
  const clearOfAll = (p: Vec2, pad: number) => clearOfPois(p, pad) && !obstacles.some((o) => near(p, o, 1.5)) && d(p, start) > 6 && !extracts.some((e) => d(p, e.pos) < 6);
  // forest cover: trees and rocks block, bushes do not
  for (const p of scatter(rng, region, 110, (p) => clearOfAll(p, 3))) {
    const roll = rng.next();
    const ref = roll < 0.55 ? rng.pick(['forest/tree', 'forest/treeB']) : roll < 0.8 ? rng.pick(['forest/rock', 'forest/rockB']) : 'forest/bush';
    if (ref !== 'forest/bush') obstacles.push({ pos: p, radius: ref.startsWith('forest/tree') ? 0.6 : 0.8, kind: 'rock' });
    props.push({ ref, pos: p, rot: Math.round(rng.next() * 628) / 100, scale: 0.9 + Math.round(rng.next() * 30) / 100 });
  }
  // small finds along the way
  scatter(rng, region, rng.int(10, 16), (p) => clearOfAll(p, 8)).forEach((p, i) =>
    containers.push({ id: `s${i}`, kind: rng.pick(['crate', 'bag', 'herb'] as const), pos: p, tier: rng.chance(0.3) ? 1 : 0 }));
  // patrols walk loops between points of interest
  const walkable = pois.filter((p) => p.kind !== 'boss' && p.kind !== 'vault');
  for (let k = 0; k < rng.int(2, 3); k++) {
    const route = rng.shuffle([...walkable]).slice(0, 3).map((p) => freeSpot(rng, p.center, POI_RADIUS[p.kind] + 5, obstacles, []));
    const ids = rng.chance(0.5) ? ['bandit_cutthroat', 'bandit_archer'] : ['skeleton_minion', 'skeleton_warrior'];
    ids.forEach((enemyId, j) => spawns.push({ id: `pt${k}_${j}`, enemyId, pos: freeSpot(rng, route[0]!, 2.5, obstacles, []), stage: tier + 1, group: `pt${k}`, patrol: route }));
  }
  return valid(region) ? region : null;
}

function valid(r: Omit<Region, 'seed'>): boolean {
  const doors = new Set(r.pois.map((p) => p.door?.box).filter(Boolean));
  const reach = new NavGrid(r.bounds, r.obstacles.filter((o) => !doors.has(o))).reachable(r.start);
  if (!r.pois.every((p) => reach(p.center)) || !r.extracts.every((e) => reach(e.pos)) || !r.containers.every((c) => reach(c.pos))) return false;
  if (r.spawns.some((s) => r.obstacles.some((o) => near(s.pos, o, 0)) || !reach(s.pos))) return false;
  return !r.containers.some((c) => r.obstacles.some((o) => near(c.pos, o, 0)));
}

/** A fresh, walkable region for one sortie. Retries sub-seeds until every point checks out. */
export function generateRegion(seed: number, tier = 1): Region {
  for (let k = 0; k < 60; k++) {
    const r = attempt((seed * 7919 + k * 104729) >>> 0, tier);
    if (r) return { seed, ...r };
  }
  throw new Error(`could not generate region ${seed}`);
}
