import * as THREE from 'three';

const ELEVATION = (55 * Math.PI) / 180;
const DISTANCE = 60;
const MARGIN = 3;
const AUTO_MIN_H = 10;
const AUTO_MAX_H = 18;
const MANUAL_MIN_H = 6;
const MANUAL_MAX_H = 24;
const PAN_X = 13;
const PAN_Z = 8;
const RATE = 3;

/**
 * Fixed light quarter-view ortho camera. In 'auto' mode it frames the living units;
 * any pan/zoom switches to 'manual' until resetAuto().
 */
export class BattleCamera {
  readonly center = new THREE.Vector3(0, 0, 0);
  mode: 'auto' | 'manual' = 'auto';
  private height = 14;
  private shakeLeft = 0;
  private punch = 0;

  constructor(private readonly cam: THREE.OrthographicCamera) {
    this.apply(0);
  }

  shake(sec: number): void {
    this.shakeLeft = Math.max(this.shakeLeft, sec);
  }

  /** Brief zoom-in (fraction of height) that decays back; used for highlight moments. */
  punchIn(amount: number): void {
    this.punch = Math.max(this.punch, amount);
  }

  zoomBy(factor: number): void {
    this.mode = 'manual';
    this.height = Math.min(MANUAL_MAX_H, Math.max(MANUAL_MIN_H, this.height * factor));
    this.apply(0);
  }

  panBy(dx: number, dz: number): void {
    this.mode = 'manual';
    this.center.x = Math.min(PAN_X, Math.max(-PAN_X, this.center.x + dx));
    this.center.z = Math.min(PAN_Z, Math.max(-PAN_Z, this.center.z + dz));
    this.apply(0);
  }

  /** Drag in screen pixels: the ground follows the pointer. */
  panScreen(dxPx: number, dyPx: number, _viewW: number, viewH: number): void {
    const worldPerPx = this.height / Math.max(1, viewH);
    this.panBy(-dxPx * worldPerPx, (-dyPx * worldPerPx) / Math.sin(ELEVATION));
  }

  resetAuto(): void {
    this.mode = 'auto';
  }

  frame(points: { x: number; y: number }[], dt: number): void {
    if (this.mode === 'auto' && points.length) {
      let minX = Infinity, maxX = -Infinity, minZ = Infinity, maxZ = -Infinity;
      for (const p of points) {
        minX = Math.min(minX, p.x); maxX = Math.max(maxX, p.x);
        minZ = Math.min(minZ, p.y); maxZ = Math.max(maxZ, p.y);
      }
      const aspect = (this.cam.userData.aspect as number | undefined) ?? 16 / 9;
      const needW = (maxX - minX + MARGIN * 2) / aspect;
      const needD = (maxZ - minZ) * Math.sin(ELEVATION) + MARGIN * 2;
      const target = Math.min(AUTO_MAX_H, Math.max(AUTO_MIN_H, needW, needD));
      const k = Math.min(1, dt * RATE);
      this.height += (target - this.height) * k;
      this.center.x += ((minX + maxX) / 2 - this.center.x) * k;
      this.center.z += ((minZ + maxZ) / 2 + 0.6 - this.center.z) * k;
    }
    this.apply(dt);
  }

  private apply(dt: number): void {
    const aspect = (this.cam.userData.aspect as number | undefined) ?? 16 / 9;
    this.punch = Math.max(0, this.punch - dt * 0.8);
    const h = (this.height * (1 - this.punch)) / 2;
    this.cam.left = -h * aspect;
    this.cam.right = h * aspect;
    this.cam.top = h;
    this.cam.bottom = -h;
    this.cam.updateProjectionMatrix();
    let jx = 0, jz = 0;
    if (this.shakeLeft > 0) {
      this.shakeLeft = Math.max(0, this.shakeLeft - dt);
      jx = (Math.random() - 0.5) * 0.35;
      jz = (Math.random() - 0.5) * 0.35;
    }
    const c = this.center;
    this.cam.position.set(c.x + jx, Math.sin(ELEVATION) * DISTANCE, c.z + jz + Math.cos(ELEVATION) * DISTANCE);
    this.cam.lookAt(c.x + jx, 0, c.z + jz);
  }
}
