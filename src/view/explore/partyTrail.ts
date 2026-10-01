type P = { x: number; z: number };

const MIN_STEP = 0.1;
const MAX_POINTS = 400;

/** Records the leader's path; followers stand at fixed distances back along it. */
export class Trail {
  private readonly pts: P[] = [];

  push(p: P): void {
    const last = this.pts[this.pts.length - 1];
    if (last && Math.hypot(last.x - p.x, last.z - p.z) < MIN_STEP) return;
    this.pts.push({ ...p });
    if (this.pts.length > MAX_POINTS) this.pts.shift();
  }

  reset(p: P): void {
    this.pts.length = 0;
    this.pts.push({ ...p });
  }

  positions(count: number, spacing: number): P[] {
    const out: P[] = [];
    let need = spacing;
    let acc = 0;
    for (let i = this.pts.length - 1; i > 0 && out.length < count; i--) {
      const a = this.pts[i]!;
      const b = this.pts[i - 1]!;
      const seg = Math.hypot(a.x - b.x, a.z - b.z);
      while (acc + seg >= need && out.length < count) {
        const t = (need - acc) / seg;
        out.push({ x: a.x + (b.x - a.x) * t, z: a.z + (b.z - a.z) * t });
        need += spacing;
      }
      acc += seg;
    }
    const tail = this.pts[0] ?? { x: 0, z: 0 };
    while (out.length < count) out.push({ ...tail });
    return out;
  }
}
