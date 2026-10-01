import * as THREE from 'three';

const ELEVATION = (40 * Math.PI) / 180;
const DISTANCE = 60;
const VIEW_H = 17;

/** Isometric follow camera (yaw 45° + 90° steps). Screen-relative movement axes come from `axes()`. */
export class IsoCamera {
  private yaw = Math.PI / 4;
  private targetYaw = Math.PI / 4;
  private readonly center = new THREE.Vector3();
  private inited = false;

  constructor(private readonly cam: THREE.OrthographicCamera, private height = VIEW_H) {}

  rotateStep(dir: 1 | -1): void {
    this.targetYaw += (dir * Math.PI) / 2;
  }

  /** View height in metres of ground (smaller = closer). */
  setHeight(h: number): void {
    this.height = h;
  }

  get viewHeight(): number {
    return this.height;
  }

  get yawAngle(): number {
    return this.yaw;
  }

  /** World directions for screen right (+x) and screen down (+y) on the ground plane. */
  axes(): { right: { x: number; z: number }; down: { x: number; z: number } } {
    return { right: { x: Math.cos(this.yaw), z: -Math.sin(this.yaw) }, down: { x: Math.sin(this.yaw), z: Math.cos(this.yaw) } };
  }

  follow(x: number, z: number, dt: number): void {
    if (!this.inited) { this.center.set(x, 0, z); this.inited = true; }
    const k = Math.min(1, dt * 5);
    this.center.x += (x - this.center.x) * k;
    this.center.z += (z - this.center.z) * k;
    this.yaw += (this.targetYaw - this.yaw) * Math.min(1, dt * 8);
    const aspect = (this.cam.userData.aspect as number | undefined) ?? 16 / 9;
    const h = this.height / 2;
    Object.assign(this.cam, { left: -h * aspect, right: h * aspect, top: h, bottom: -h });
    this.cam.updateProjectionMatrix();
    const flat = Math.cos(ELEVATION) * DISTANCE;
    this.cam.position.set(this.center.x + Math.sin(this.yaw) * flat, Math.sin(ELEVATION) * DISTANCE, this.center.z + Math.cos(this.yaw) * flat);
    this.cam.lookAt(this.center);
  }
}
