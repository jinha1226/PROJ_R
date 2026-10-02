/** How fast a model catches up with its logical position: the gap halves every ln2/k seconds, so lag stays bounded however fast you play. */
export const CHASE_K = 18;

export function chase(cur: number, target: number, dt: number, k = CHASE_K): number {
  return target + (cur - target) * Math.exp(-k * dt);
}

/** Walking speed in cells per second: one cell per held-step interval, so a held walk is one continuous glide. */
export const WALK_SPEED = 1 / 0.14;
const CATCHUP_GAP = 1.2;
const CATCHUP_SEC = 0.12;

/** Moves a model toward its cell at a steady walking pace (no ease-out stall at each cell); more than a cell behind, it hurries. */
export function glide(cur: { x: number; z: number }, target: { x: number; z: number }, dt: number): { x: number; z: number } {
  const dx = target.x - cur.x;
  const dz = target.z - cur.z;
  const d = Math.hypot(dx, dz);
  const speed = d > CATCHUP_GAP ? d / CATCHUP_SEC : WALK_SPEED;
  const step = speed * dt;
  if (step >= d) return { x: target.x, z: target.z };
  return { x: cur.x + (dx / d) * step, z: cur.z + (dz / d) * step };
}

/** Eases an angle toward another the short way round. */
export function turnToward(cur: number, target: number, dt: number, k = 22): number {
  let diff = target - cur;
  while (diff > Math.PI) diff -= Math.PI * 2;
  while (diff < -Math.PI) diff += Math.PI * 2;
  return cur + diff * (1 - Math.exp(-k * dt));
}
