/**
 * Probe (spec 2026-10-08 base-mode-raids §4): a flowing horde on a base map, in two movement models to compare by eye —
 * A: on the grid, up to four fodder to a cell, stepping cell to cell; B: free coordinates, steered down the flow field and
 * pushed apart. Both follow one flow field to the pod and break walls in the way. Throwaway: the chosen model is rebuilt
 * on the game's units afterwards.
 */
export type Mode = 'grid' | 'free';
export interface Probe {
  w: number; h: number; walls: Int16Array; pod: { x: number; y: number };
  dist: Float32Array; mode: Mode; units: Foe[]; time: number; spawned: number; reached: number; killed: number;
  queue: { at: number; x: number; y: number }[]; rng: () => number; slotCount: Uint8Array;
}
/** a fodder: its cell and slot (grid), or its position and velocity (free); where it is drawn from and to, and when */
export interface Foe { atPod?: boolean; id: number; x: number; y: number; vx: number; vy: number; cell: number; slot: number; next: number; fromX: number; fromY: number; t0: number; dur: number; alive: boolean; phase: number }

export const CAP = 4;
/** where each of a cell's four fodder stands (cell-relative) */
export const SLOTS = [[-0.22, -0.2], [0.22, -0.24], [-0.24, 0.22], [0.2, 0.2]] as const;
const WALL_HP = 24, WALL_COST = 8;
/** how close to the pod a fodder stops to strike it (field distance) */
const POD_REACH = 2.5;
const DIRS = [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [1, -1], [-1, 1], [-1, -1]] as const;

const mulberry = (seed: number) => () => { seed |= 0; seed = (seed + 0x6d2b79f5) | 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
export const idx = (p: Probe, x: number, y: number) => y * p.w + x;
const inside = (p: Probe, x: number, y: number) => x >= 0 && y >= 0 && x < p.w && y < p.h;

/** A base map: the pod in the middle inside a ring of walls with three gaps, a few wall stubs out in the field. */
export function newProbe(mode: Mode, seed = 1, total = 150): Probe {
  const w = 48, h = 36, pod = { x: 24, y: 18 };
  const p: Probe = { w, h, walls: new Int16Array(w * h), pod, dist: new Float32Array(w * h), mode, units: [], time: 0, spawned: 0, reached: 0, killed: 0, queue: [], rng: mulberry(seed), slotCount: new Uint8Array(w * h) };
  const wall = (x: number, y: number) => { if (inside(p, x, y)) p.walls[idx(p, x, y)] = WALL_HP; };
  for (let k = -6; k <= 6; k++) { if (Math.abs(k) > 1) { wall(pod.x + k, pod.y - 6); wall(pod.x + k, pod.y + 6); } if (Math.abs(k) > 1 || k === 0) { wall(pod.x - 6, pod.y + k); } wall(pod.x + 6, pod.y + k); }
  for (let k = 0; k < 6; k++) { wall(10 + k, 8); wall(36, 24 + k); wall(12, 26 + (k % 3)); }
  flowField(p);
  // three waves (twelve seconds apart), each pouring out of three edges across a seven-cell front in three seconds
  const edges = [{ x: 0, y: 8, dx: 0, dy: 1 }, { x: w - 1, y: 14, dx: 0, dy: 1 }, { x: 20, y: h - 1, dx: 1, dy: 0 }];
  for (let k = 0; k < total; k++) {
    const wave = Math.floor((k * 3) / total), e = edges[k % 3]!, along = ((k * 5) % 7) - 3, at = wave * 12 + ((k % Math.ceil(total / 3)) / Math.ceil(total / 3)) * 3;
    p.queue.push({ at, x: Math.max(0, Math.min(w - 1, e.x + e.dx * along)), y: Math.max(0, Math.min(h - 1, e.y + e.dy * along)) });
  }
  p.queue.sort((a, b) => a.at - b.at);
  return p;
}

/** Distance to the pod from every cell (walls cost what breaking them takes). */
export function flowField(p: Probe): void {
  p.dist.fill(Infinity);
  const open: number[] = [idx(p, p.pod.x, p.pod.y)]; p.dist[open[0]!] = 0;
  // a small bucketed Dijkstra (costs are whole numbers)
  const buckets: number[][] = [open];
  for (let b = 0; b < buckets.length; b++) for (const c of buckets[b] ?? []) {
    const d = p.dist[c]!;
    if (Math.ceil(d) !== b) continue;
    const x = c % p.w, y = (c / p.w) | 0;
    for (const [dx, dy] of DIRS) {
      const nx = x + dx, ny = y + dy; if (!inside(p, nx, ny)) continue;
      const n = idx(p, nx, ny), step = (dx && dy ? 1.4 : 1) + (p.walls[n]! > 0 ? WALL_COST : 0), nd = Math.round((d + step) * 10) / 10;
      if (nd < p.dist[n]!) { p.dist[n] = nd; (buckets[Math.ceil(nd)] ??= []).push(n); }
    }
  }
}

function spawn(p: Probe, x: number, y: number): void {
  const cell = idx(p, x, y), slot = p.mode === 'grid' ? freeSlot(p, cell) : 0;
  // the edge cell is full: this one comes out a moment later
  if (p.mode === 'grid' && slot < 0) { p.queue.push({ at: p.time + 0.3, x, y }); p.queue.sort((a, b) => a.at - b.at); return; }
  const f: Foe = { id: p.spawned++, x: x + 0.5, y: y + 0.5, vx: 0, vy: 0, cell, slot, next: p.time + p.rng() * 0.4, fromX: x + 0.5, fromY: y + 0.5, t0: p.time, dur: 0.01, alive: true, phase: p.rng() * Math.PI * 2 };
  if (p.mode === 'grid') { p.slotCount[cell]!++; const [sx, sy] = SLOTS[slot]!; f.x += sx; f.y += sy; f.fromX = f.x; f.fromY = f.y; }
  p.units.push(f);
}
const taken = (p: Probe, cell: number) => new Set(p.units.filter((u) => u.alive && u.cell === cell).map((u) => u.slot));
function freeSlot(p: Probe, cell: number): number {
  if (p.slotCount[cell]! >= CAP) return -1;
  const used = taken(p, cell); for (let s = 0; s < CAP; s++) if (!used.has(s)) return s;
  return -1;
}
function hitWall(p: Probe, cell: number): void {
  p.walls[cell] = Math.max(0, p.walls[cell]! - 1);
  if (p.walls[cell] === 0) flowField(p);
}
function leave(p: Probe, f: Foe): void { f.alive = false; if (p.mode === 'grid') p.slotCount[f.cell]!--; }

/** Grid: on its step each fodder moves to the free slot of the lowest neighbour cell (or hits the wall in the way). */
function stepGrid(p: Probe, f: Foe): void {
  const x = f.cell % p.w, y = (f.cell / p.w) | 0, here = p.dist[f.cell]!;
  // at the pod it stays and hacks at it
  if (here <= POD_REACH) { f.next = p.time + 0.6; f.fromX = f.x; f.fromY = f.y; f.dur = 0.01; return; }
  let best = -1, bestD = here, wallBest = -1, wallD = Infinity;
  for (const [dx, dy] of DIRS) {
    const nx = x + dx, ny = y + dy; if (!inside(p, nx, ny)) continue;
    const n = idx(p, nx, ny);
    if (p.walls[n]! > 0) { if (p.dist[n]! < wallD) { wallD = p.dist[n]!; wallBest = n; } continue; }
    // a small random lean keeps a crowd from marching in lockstep down the same cells
    const d = p.dist[n]! + p.rng() * 0.35;
    if (d < bestD && p.slotCount[n]! < CAP) { bestD = d; best = n; }
  }
  if (best < 0 && wallBest >= 0 && wallD < here) { hitWall(p, wallBest); f.next = p.time + 0.5; return; }
  f.fromX = f.x; f.fromY = f.y; f.t0 = p.time;
  if (best < 0) { f.next = p.time + 0.15 + p.rng() * 0.2; f.dur = 0.01; return; }
  const slot = freeSlot(p, best); if (slot < 0) { f.next = p.time + 0.2; return; }
  p.slotCount[f.cell]!--; p.slotCount[best]!++; f.cell = best; f.slot = slot;
  const [sx, sy] = SLOTS[slot]!, jx = (p.rng() - 0.5) * 0.08, jy = (p.rng() - 0.5) * 0.08;
  f.x = (best % p.w) + 0.5 + sx + jx; f.y = ((best / p.w) | 0) + 0.5 + sy + jy;
  f.dur = 0.38 + p.rng() * 0.18; f.next = p.time + f.dur;
}

/** Free: each fodder steers down the field, is pushed off its neighbours, and stops at walls (hitting them). */
function stepFree(p: Probe, dt: number, grid: Map<number, Foe[]>): void {
  const speed = 2.3;
  for (const f of p.units) {
    if (!f.alive) continue;
    const cx = Math.floor(f.x), cy = Math.floor(f.y), here = p.dist[idx(p, cx, cy)]!;
    let gx = 0, gy = 0;
    for (const [dx, dy] of DIRS) { const nx = cx + dx, ny = cy + dy; if (!inside(p, nx, ny)) continue; const g = here - p.dist[idx(p, nx, ny)]!; if (g > 0) { const l = Math.hypot(dx, dy); gx += (dx / l) * g; gy += (dy / l) * g; } }
    const gl = Math.hypot(gx, gy) || 1, stay = here <= POD_REACH;
    let ax = stay ? -f.vx * 2 : (gx / gl) * speed - f.vx, ay = stay ? -f.vy * 2 : (gy / gl) * speed - f.vy;
    for (let oy = -1; oy <= 1; oy++) for (let ox = -1; ox <= 1; ox++) for (const o of grid.get((cy + oy) * p.w + cx + ox) ?? []) {
      if (o === f) continue; const dx = f.x - o.x, dy = f.y - o.y, d = Math.hypot(dx, dy);
      if (d > 0 && d < 0.5) { const push = (0.5 - d) * 14; ax += (dx / d) * push; ay += (dy / d) * push; }
    }
    f.vx += ax * dt * 4; f.vy += ay * dt * 4;
    const v = Math.hypot(f.vx, f.vy); if (v > speed) { f.vx *= speed / v; f.vy *= speed / v; }
    const nx = f.x + f.vx * dt, ny = f.y + f.vy * dt, cell = (x: number, y: number) => idx(p, Math.floor(x), Math.floor(y));
    const blockX = !inside(p, Math.floor(nx), cy) || p.walls[cell(nx, f.y)]! > 0, blockY = !inside(p, cx, Math.floor(ny)) || p.walls[cell(f.x, ny)]! > 0;
    if (blockX) { if (inside(p, Math.floor(nx), cy) && p.rng() < dt * 2) hitWall(p, cell(nx, f.y)); f.vx = 0; } else f.x = nx;
    if (blockY) { if (inside(p, cx, Math.floor(ny)) && p.rng() < dt * 2) hitWall(p, cell(f.x, ny)); f.vy = 0; } else f.y = ny;
  }
}

/** Time runs on: the queue spawns, every fodder moves, those at the pod are counted and gone. */
export function tickProbe(p: Probe, dt: number): void {
  p.time += dt;
  while (p.queue.length && p.queue[0]!.at <= p.time) { const s = p.queue.shift()!; spawn(p, s.x, s.y); }
  if (p.mode === 'grid') { for (const f of p.units) if (f.alive && f.next <= p.time) stepGrid(p, f); }
  else {
    const grid = new Map<number, Foe[]>();
    for (const f of p.units) if (f.alive) { const k = Math.floor(f.y) * p.w + Math.floor(f.x); const list = grid.get(k); if (list) list.push(f); else grid.set(k, [f]); }
    stepFree(p, Math.min(dt, 0.05), grid);
  }
  // the pod's own cell is solid: those that reach it are counted once and pile up round it
  for (const f of p.units) if (f.alive && !f.atPod && p.dist[idx(p, Math.floor(f.x), Math.floor(f.y))]! <= POD_REACH) { f.atPod = true; p.reached++; }
}

/** A blast: every fodder within `r` of the point is gone. */
export function blast(p: Probe, x: number, y: number, r: number): number {
  let n = 0;
  for (const f of p.units) if (f.alive && Math.hypot(f.x - x, f.y - y) <= r) { leave(p, f); n++; }
  p.killed += n; p.units = p.units.filter((f) => f.alive);
  return n;
}

/** Where to draw a fodder now: grid fodder glide from their last spot to the new one (eased); free fodder are where they are. */
export function drawPos(p: Probe, f: Foe): { x: number; y: number; moving: boolean } {
  if (p.mode === 'free') return { x: f.x, y: f.y, moving: Math.hypot(f.vx, f.vy) > 0.3 };
  const k = Math.min(1, (p.time - f.t0) / f.dur), e = k * k * (3 - 2 * k);
  return { x: f.fromX + (f.x - f.fromX) * e, y: f.fromY + (f.y - f.fromY) * e, moving: k < 1 };
}
