import * as THREE from 'three';

const ELEVATION = (55 * Math.PI) / 180;
const DISTANCE = 60;
const MARGIN = 3;
const MIN_H = 10;
const MAX_H = 18;
const RATE = 3;

/** Fixed light quarter-view ortho camera that frames the living units. */
export class BattleCamera {
  private center = new THREE.Vector3(0, 0, 0);
  private height = 14;
  private shakeLeft = 0;

  constructor(private readonly cam: THREE.OrthographicCamera) {
    this.apply(0);
  }

  shake(sec: number): void {
    this.shakeLeft = Math.max(this.shakeLeft, sec);
  }

  frame(points: { x: number; y: number }[], dt: number): void {
    if (points.length) {
      let minX = Infinity, maxX = -Infinity, minZ = Infinity, maxZ = -Infinity;
      for (const p of points) {
        minX = Math.min(minX, p.x); maxX = Math.max(maxX, p.x);
        minZ = Math.min(minZ, p.y); maxZ = Math.max(maxZ, p.y);
      }
      const aspect = (this.cam.userData.aspect as number | undefined) ?? 16 / 9;
      const needW = (maxX - minX + MARGIN * 2) / aspect;
      const needD = (maxZ - minZ) * Math.sin(ELEVATION) + MARGIN * 2;
      const target = Math.min(MAX_H, Math.max(MIN_H, needW, needD));
      const k = Math.min(1, dt * RATE);
      this.height += (target - this.height) * k;
      this.center.x += ((minX + maxX) / 2 - this.center.x) * k;
      this.center.z += ((minZ + maxZ) / 2 + 0.6 - this.center.z) * k;
    }
    this.apply(dt);
  }

  private apply(dt: number): void {
    const aspect = (this.cam.userData.aspect as number | undefined) ?? 16 / 9;
    const h = this.height / 2;
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
