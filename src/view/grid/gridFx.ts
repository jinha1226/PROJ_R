import * as THREE from 'three';
import { TransientFx } from '../fx/transientFx';
import { DamageNumbers, type NumberKind } from '../overlay/damageNumbers';
import '../overlay/overlay.css';
import { CELL } from './gridTerrain';
import { FlashLights } from './flashLights';

const BOLT_SPEED = 4 / 0.08;   // cells per second
const HITSTOP = 0.06;

interface Bolt { mesh: THREE.Mesh; trail: THREE.Mesh; from: THREE.Vector3; to: THREE.Vector3; t: number; total: number; done: () => void }

/** Bolts, numbers, hit-stop, camera shake, aim lines and intent icons. */
export class GridFx {
  readonly transient: TransientFx;
  private readonly numbers: DamageNumbers;
  private readonly bolts: Bolt[] = [];
  private readonly beams: { mesh: THREE.Mesh; life: number }[] = [];
  private readonly aim: THREE.LineSegments;
  private readonly icons = new Map<string, HTMLDivElement>();
  private readonly iconLayer = document.createElement('div');
  private readonly hurtEl = document.createElement('div');
  private stop = 0;
  private slowLeft = 0;
  private slowScale = 1;
  private shakeT = 0;
  private shakeAmp = 0;

  private readonly flashes: FlashLights;

  constructor(private readonly scene: THREE.Scene, private readonly overlay: HTMLElement, private readonly project: (p: THREE.Vector3) => { left: number; top: number }, flashCount = 4) {
    this.transient = new TransientFx(scene);
    this.flashes = new FlashLights(scene, flashCount);
    this.numbers = new DamageNumbers(overlay);
    this.iconLayer.className = 'grid-icons';
    this.hurtEl.className = 'grid-hurt';
    overlay.append(this.iconLayer, this.hurtEl);
    this.aim = new THREE.LineSegments(new THREE.BufferGeometry(), new THREE.LineBasicMaterial({ color: '#ff4a3a', transparent: true, opacity: 0.75 }));
    this.aim.frustumCulled = false;
    scene.add(this.aim);
  }

  /** A crossbow bolt flying from → to; `done` runs on arrival (hit or miss shows then). */
  bolt(from: THREE.Vector3, to: THREE.Vector3, done: () => void, thick = 1): void {
    const yaw = Math.atan2(to.x - from.x, to.z - from.z);
    const mesh = new THREE.Mesh(new THREE.CylinderGeometry(0.025 * thick, 0.025 * thick, 0.5 * Math.sqrt(thick), 6), new THREE.MeshBasicMaterial({ color: '#fff4d0' }));
    const trail = new THREE.Mesh(new THREE.CylinderGeometry(0.05 * thick, 0.01 * thick, 1, 6, 1, true).translate(0, -0.5, 0), new THREE.MeshBasicMaterial({ color: '#ffb050', transparent: true, opacity: 0.55, blending: THREE.AdditiveBlending, depthWrite: false }));
    for (const m of [mesh, trail]) { m.rotation.order = 'YXZ'; m.rotation.y = yaw; m.rotation.x = Math.PI / 2; this.scene.add(m); }
    const cells = from.distanceTo(to) / CELL;
    this.bolts.push({ mesh, trail, from: from.clone().setY(1.1), to: to.clone().setY(1.0), t: 0, total: Math.max(0.05, cells / BOLT_SPEED), done });
  }

  energy(at: THREE.Vector3, amount: number): void {
    this.number(`⚡+${amount}`, 'combo', at);
    const mesh = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.16, 1, 8), new THREE.MeshBasicMaterial({ color: '#69eaff', transparent: true, opacity: 0.8, depthWrite: false }));
    mesh.position.copy(at); this.scene.add(mesh); this.beams.push({ mesh, life: 0.5 });
  }

  /** A floating label over a point; `height` lifts it (loot floats above the blow that dropped it). */
  number(text: string, kind: NumberKind, at: THREE.Vector3, height = 2.0): void {
    const p = this.project(at.clone().setY(height));
    this.numbers.show(text, kind, p.left, p.top);
  }

  /** The screen edge flashes red when the hero is hurt. */
  hurt(): void {
    this.hurtEl.classList.remove('on');
    void this.hurtEl.offsetWidth;
    this.hurtEl.classList.add('on');
  }

  slow(sec: number, scale: number): void {
    // a short slow never cuts a longer one short; the slower of the two wins while both run
    if (this.slowLeft > sec) { this.slowScale = Math.min(this.slowScale, scale); return; }
    this.slowLeft = sec;
    this.slowScale = scale;
  }

  get timeScale(): number { return this.slowLeft > 0 ? this.slowScale : 1; }

  hitStop(sec = HITSTOP): void {
    this.stop = Math.max(this.stop, sec);
  }

  shake(sec = 0.12, amp = 0.18): void {
    this.shakeT = Math.max(this.shakeT, sec);
    this.shakeAmp = amp;
  }

  get frozen(): boolean {
    return this.stop > 0;
  }

  /** Random camera offset this frame (zero when calm). */
  jolt(): THREE.Vector3 {
    if (this.shakeT <= 0) return new THREE.Vector3();
    const a = this.shakeAmp * Math.min(1, this.shakeT * 8);
    return new THREE.Vector3((Math.random() - 0.5) * 2 * a, 0, (Math.random() - 0.5) * 2 * a);
  }

  /** Red lines from every archer that can shoot the hero next. */
  setAim(lines: [THREE.Vector3, THREE.Vector3][]): void {
    const pts = lines.flatMap(([a, b]) => [a.x, 1.0, a.z, b.x, 1.0, b.z]);
    this.aim.geometry.setAttribute('position', new THREE.Float32BufferAttribute(pts, 3));
    this.aim.visible = pts.length > 0;
  }

  /** Small marks over awake foes: ! closing in, ◎ aiming. */
  setIcons(list: { id: string; at: THREE.Vector3; icon: string }[]): void {
    const keep = new Set(list.map((l) => l.id));
    for (const [id, el] of this.icons) if (!keep.has(id)) { el.remove(); this.icons.delete(id); }
    for (const l of list) {
      let el = this.icons.get(l.id);
      if (!el) { el = document.createElement('div'); el.className = 'grid-icon'; this.iconLayer.appendChild(el); this.icons.set(l.id, el); }
      el.textContent = l.icon;
      el.classList.toggle('aim', l.icon === '◎');
      el.classList.toggle('label', l.icon.length > 1);
      const p = this.project(l.at.clone().setY(2.3));
      el.style.transform = `translate(${p.left}px, ${p.top}px)`;
    }
  }

  /** A brief light at `at` (muzzle flash, blast, spell). */
  flash(at: THREE.Vector3, color: string, power?: number, sec?: number, range?: number): void {
    this.flashes.flash(at, color, power, sec, range);
  }

  update(dt: number): void {
    const scaled = dt * this.timeScale;
    this.slowLeft = Math.max(0, this.slowLeft - dt);
    this.flashes.update(scaled);
    for (let i = this.beams.length - 1; i >= 0; i--) {
      const b = this.beams[i]!; b.life -= dt;
      b.mesh.scale.y = 1 + (0.5 - b.life) * 10; b.mesh.position.y = b.mesh.scale.y / 2;
      const mat = b.mesh.material as THREE.MeshBasicMaterial; mat.opacity = Math.max(0, b.life * 1.6);
      if (b.life <= 0) { this.scene.remove(b.mesh); b.mesh.geometry.dispose(); mat.dispose(); this.beams.splice(i, 1); }
    }
    this.stop = Math.max(0, this.stop - dt);
    this.shakeT = Math.max(0, this.shakeT - dt);
    const step = this.stop > 0 ? 0 : scaled;
    this.transient.update(step);
    for (let i = this.bolts.length - 1; i >= 0; i--) {
      const b = this.bolts[i]!;
      b.t += step;
      const k = Math.min(1, b.t / b.total);
      b.mesh.position.lerpVectors(b.from, b.to, k);
      b.trail.position.copy(b.mesh.position);
      b.trail.scale.y = Math.min(1.6, b.from.distanceTo(b.mesh.position));
      if (k >= 1) {
        for (const m of [b.mesh, b.trail]) { this.scene.remove(m); m.geometry.dispose(); (m.material as THREE.Material).dispose(); }
        this.bolts.splice(i, 1);
        b.done();
      }
    }
  }

  dispose(): void {
    for (const b of this.beams) { this.scene.remove(b.mesh); b.mesh.geometry.dispose(); (b.mesh.material as THREE.Material).dispose(); }
    this.flashes.dispose();
    this.transient.dispose();
    this.numbers.dispose();
    this.iconLayer.remove();
    this.hurtEl.remove();
    for (const b of this.bolts) { this.scene.remove(b.mesh); this.scene.remove(b.trail); }
  }
}
