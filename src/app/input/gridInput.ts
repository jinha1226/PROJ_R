import type { Cell } from '../../sim/grid/types';

const STEP_ANGLE = Math.PI / 4;

/** Extra angle a stick must turn past the 22.5° border before the direction changes (no zig-zag when pushing diagonally-ish). */
const HYSTERESIS = (10 * Math.PI) / 180;

/** A stick/screen vector (screen y down) snapped to one of eight grid directions; null inside the dead zone. With `prev`, the current direction is kept until the stick clearly leaves it. */
export function quantize8(x: number, y: number, dead = 0.35, prev?: Cell | null): Cell | null {
  if (Math.hypot(x, y) < dead) return null;
  const ang = Math.atan2(y, x);
  if (prev) {
    let diff = Math.abs(ang - Math.atan2(prev.y, prev.x));
    if (diff > Math.PI) diff = Math.PI * 2 - diff;
    if (diff <= STEP_ANGLE / 2 + HYSTERESIS) return prev;
  }
  const k = Math.round(ang / STEP_ANGLE);
  const a = k * STEP_ANGLE;
  return { x: Math.round(Math.cos(a)), y: Math.round(Math.sin(a)) };
}

/** What stops movement after an action: a new foe in sight stops everything; a hit only stops tap-walking (holding into a fight keeps swinging). */
export function interruption(newFoe: boolean, hit: boolean): { walk: boolean; hold: boolean } {
  return { walk: newFoe || hit, hold: newFoe };
}

/** Held direction → steps: the first step waits a moment (`chord`) so two keys pressed together make one diagonal, then one step every `every` seconds. Turning restarts the wait. */
export class HoldRepeat {
  private dir: Cell | null = null;
  private timer = 0;
  private first = true;

  constructor(private readonly every = 0.14, private readonly chord = 0.05) {}

  update(dir: Cell | null, dt: number): Cell | null {
    if (!dir) { this.reset(); return null; }
    if (!this.dir || this.dir.x !== dir.x || this.dir.y !== dir.y) {
      this.dir = dir;
      this.first = true;
      this.timer = this.chord;
    }
    this.timer -= dt;
    if (this.timer > 1e-9) return null;
    this.timer = this.first ? this.every : this.timer + this.every;
    this.first = false;
    return dir;
  }

  reset(): void {
    this.dir = null;
    this.timer = 0;
    this.first = true;
  }
}
