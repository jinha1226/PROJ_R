import type { Vec2 } from '../../core/vec2';
import { createRng } from '../../core/rng';
import { enemyFromDef, makeUnitState } from '../battle/setup';
import type { WorldState } from './types';
import { emitW, heroUnit } from './worldState';
import { alertGroup } from './perception';

export const SEC = 20;
export const DUSK_SEC = 240;
export const WARN_SEC = 390;
export const NIGHT_SEC = 480;
export const STORM_SEC = 600;
const HUNTER_EVERY = 60;
const UNIT_CAP = 120;

export type Phase = 'day' | 'dusk' | 'night' | 'storm';
export function phaseOf(tick: number): Phase {
  const s = tick / SEC;
  return s >= STORM_SEC ? 'storm' : s >= NIGHT_SEC ? 'night' : s >= DUSK_SEC ? 'dusk' : 'day';
}

const baseStage = (w: WorldState) => Math.max(1, Math.min(...w.region.spawns.map((s) => s.stage), 9));

/** Adds a group of enemies mid-sortie (patrols at dusk, guards at night, storm hunters). */
function spawnGroup(w: WorldState, id: string, members: string[], at: Vec2, stage: number, opts: { patrol?: Vec2[]; hunter?: boolean } = {}): void {
  if (w.b.units.length + members.length > UNIT_CAP) return;
  const ids: string[] = [];
  members.forEach((enemyId, k) => {
    const uid = `${id}_${k}`;
    const pos = { x: at.x + (k % 2) * 1.4 - 0.7, y: at.y + Math.floor(k / 2) * 1.4 };
    const setup = { ...enemyFromDef(enemyId, 2, 0, stage, w.b.units.length), id: uid, spawn: pos, controlled: true };
    const u = makeUnitState(setup, pos, w.b.units.length, false);
    u.dormant = true;
    w.b.units.push(u);
    w.ai[uid] = { mode: opts.patrol ? 'patrol' : 'idle', wp: 0, home: { ...pos }, repathIn: 0 };
    w.groupOf[uid] = id;
    if (opts.patrol) w.routes[uid] = opts.patrol;
    ids.push(uid);
  });
  w.groups[id] = { alerted: false, home: { ...at }, members: ids, hunter: opts.hunter };
  if (opts.hunter) alertGroup(w, id);
}

/** The risk clock: dusk patrols, the closing warning, nightfall, then storm hunters every minute. */
export function updateClock(w: WorldState): void {
  const t = w.b.tick;
  if (t % SEC !== 0) return;
  const sec = t / SEC;
  const rng = createRng((w.seed ^ Math.imul(sec + 1, 2654435761)) >>> 0);
  const hero = heroUnit(w).pos;
  const far = w.region.pois.filter((p) => Math.hypot(p.center.x - hero.x, p.center.y - hero.y) > 30 && p.kind !== 'vault');
  const stage = baseStage(w);
  if (sec === DUSK_SEC) {
    emitW(w, 'dusk');
    for (let k = 0; k < 2 && far.length >= 3; k++) {
      // walk just outside each point (its centre is always walkable, so fall back to that)
      const route = rng.shuffle([...far]).slice(0, 3).map((p) => {
        const out = { x: p.center.x + p.radius + 3, y: p.center.y };
        return w.nav.walkable(out) ? out : { ...p.center };
      });
      spawnGroup(w, `dusk${k}`, rng.chance(0.5) ? ['bandit_cutthroat', 'bandit_archer'] : ['skeleton_minion', 'skeleton_warrior'], route[0]!, stage + 1, { patrol: route });
    }
  }
  for (const e of w.region.extracts) {
    if (e.closesAt === undefined) continue;
    if (sec === Math.max(1, e.closesAt - (NIGHT_SEC - WARN_SEC))) emitW(w, 'closing', { id: e.id });
    if (sec === e.closesAt && !w.closed.includes(e.id)) {
      w.closed.push(e.id);
      emitW(w, 'closed', { id: e.id });
    }
  }
  if (sec === NIGHT_SEC) {
    emitW(w, 'night');
    const p = far.length ? rng.pick(far) : undefined;
    if (p) spawnGroup(w, 'night0', ['skeleton_warrior', 'skeleton_mage', 'skeleton_warrior'], { x: p.center.x + p.radius + 2, y: p.center.y }, stage + 2);
  }
  if (sec >= STORM_SEC && (sec - STORM_SEC) % HUNTER_EVERY === 0) {
    if (sec === STORM_SEC) emitW(w, 'storm');
    const k = (sec - STORM_SEC) / HUNTER_EVERY;
    spawnGroup(w, `hunt${k}`, ['bandit_cutthroat', 'skeleton_warrior'], edgeNear(w, hero), stage + 2 + k, { hunter: true });
  }
}

/** The walkable map edge point closest to the hero but at least 20 m away. */
function edgeNear(w: WorldState, h: Vec2): Vec2 {
  const b = w.region.bounds;
  const cands: Vec2[] = [];
  for (let x = b.minX + 4; x <= b.maxX - 4; x += 4) cands.push({ x, y: b.minY + 4 }, { x, y: b.maxY - 4 });
  for (let y = b.minY + 4; y <= b.maxY - 4; y += 4) cands.push({ x: b.minX + 4, y }, { x: b.maxX - 4, y });
  const ok = cands.filter((p) => w.nav.walkable(p) && Math.hypot(p.x - h.x, p.y - h.y) >= 20);
  const d = (p: Vec2) => Math.hypot(p.x - h.x, p.y - h.y);
  return (ok.length ? ok : cands).reduce((a, p) => (d(p) < d(a) ? p : a));
}
