import type { Cell } from '../../sim/grid/types';

const STEP_ANGLE = Math.PI / 4;

/** A stick/screen vector (screen y down) snapped to one of eight grid directions; null inside the dead zone. */
export function quantize8(x: number, y: number, dead = 0.35): Cell | null {
  if (Math.hypot(x, y) < dead) return null;
  const k = Math.round(Math.atan2(y, x) / STEP_ANGLE);
  const a = k * STEP_ANGLE;
  return { x: Math.round(Math.cos(a)), y: Math.round(Math.sin(a)) };
}

/** What stops movement after an action: a new foe in sight stops everything; a hit only stops tap-walking (holding into a fight keeps swinging). */
export function interruption(newFoe: boolean, hit: boolean): { walk: boolean; hold: boolean } {
  return { walk: newFoe || hit, hold: newFoe };
}

/** Held direction → steps: one at once, then one every `every` seconds; a new direction steps at once. */
export class HoldRepeat {
  private dir: Cell | null = null;
  private timer = 0;

  constructor(private readonly every = 0.14) {}

  update(dir: Cell | null, dt: number): Cell | null {
    if (!dir) { this.reset(); return null; }
    if (!this.dir || this.dir.x !== dir.x || this.dir.y !== dir.y) {
      this.dir = dir;
      this.timer = this.every;
      return dir;
    }
    this.timer -= dt;
    if (this.timer > 1e-9) return null;
    this.timer += this.every;
    return dir;
  }

  reset(): void {
    this.dir = null;
    this.timer = 0;
  }
}
