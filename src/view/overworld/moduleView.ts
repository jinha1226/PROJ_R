import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import type { Module, ModuleId } from '../../sim/base/modules';
import { labFigure } from './labProps';

/** the pack models the quarters and the workshop are drawn with (Quaternius Ultimate Space Kit, CC0): the geodesic dome, the large base */
const MODEL: Partial<Record<ModuleId, string>> = { quarters: 'dome', workshop: 'works' };
/** how wide a module's figure stands on its two cells, and how long after touchdown each unfolds (seconds) */
const WIDTH = 1.84, RISE = 0.7;
const WAIT: Record<ModuleId, number> = { lab: 0.9, quarters: 1.35, workshop: 1.8 };

interface Shown { root: THREE.Group; rig: THREE.Object3D; key: string }

/**
 * The base's modules on the land (spec 2026-10-09 §3): the lab's vat, the quarters' dome, the workshop. They wait
 * underground while the pod falls and unfold one after another once it is down; a moved one stands where it was set; a
 * broken one stands dark and askew until it is mended.
 */
export class ModuleViews {
  readonly root = new THREE.Group();
  private readonly shown = new Map<ModuleId, Shown>();
  private models = new Map<string, THREE.Object3D>();
  /** seconds since touchdown (unfolding), or -1: standing; `hidden`: the pod is still falling */
  private t = -1;
  private hidden = false;

  constructor(base: string) {
    void new GLTFLoader().loadAsync(`${base}assets/models/scifi/base.glb`).then((g) => {
      for (const o of g.scene.children) this.models.set(o.name, o);
      // anything drawn before the models came is drawn again with them
      for (const [, s] of this.shown) this.root.remove(s.root);
      this.shown.clear();
    }).catch(() => undefined);
  }

  /** out of sight while the pod falls */
  land(): void { this.hidden = true; this.t = -1; }
  /** the pod is down: the modules unfold, one after another */
  rise(): void { this.hidden = false; this.t = 0; }
  /** whether they stand (not hidden for the landing, not still unfolding) */
  get up(): boolean { return !this.hidden && this.t < 0; }

  /** Builds, moves and re-dresses the figures so the scene matches the modules, and runs the unfolding. */
  sync(modules: Module[], dt: number): void {
    if (this.t >= 0) { this.t += dt; if (this.t > WAIT.workshop + RISE) this.t = -1; }
    for (const m of modules) {
      const key = `${m.broken ? 'x' : ''}${this.models.size}`;
      let s = this.shown.get(m.id);
      if (!s || s.key !== key) { if (s) this.root.remove(s.root); s = { ...this.make(m.id, !!m.broken), key }; this.root.add(s.root); this.shown.set(m.id, s); }
      s.root.position.set(m.at.x + 0.5, m.broken ? -0.08 : 0, m.at.y + 0.5);
      const k = this.hidden ? 0 : this.t < 0 ? 1 : Math.min(1, Math.max(0, (this.t - WAIT[m.id]) / RISE));
      s.root.visible = k > 0;
      s.rig.scale.y = Math.max(0.001, 1 - Math.pow(1 - k, 3));
    }
  }

  /** One module's figure, its middle on the middle of its four cells; `rig` is the part that rises as it unfolds. */
  private make(id: ModuleId, broken: boolean): { root: THREE.Group; rig: THREE.Object3D } {
    const root = new THREE.Group();
    let rig: THREE.Object3D;
    const src = MODEL[id] && this.models.get(MODEL[id]!);
    if (id === 'lab') { const f = labFigure(); root.add(f.root); rig = f.rig; }
    else {
      const deck = new THREE.Mesh(new THREE.BoxGeometry(1.9, 0.08, 1.9), new THREE.MeshLambertMaterial({ color: '#2e343c' }));
      deck.position.y = 0.04; deck.receiveShadow = true;
      rig = new THREE.Group();
      if (src) {
        const m = src.clone(true), bb = new THREE.Box3().setFromObject(m), size = bb.getSize(new THREE.Vector3()), k = WIDTH / Math.max(size.x, size.z);
        m.scale.setScalar(k);
        m.position.set(-(bb.min.x + size.x / 2) * k, 0.08 - bb.min.y * k, -(bb.min.z + size.z / 2) * k);
        rig.add(m);
      } else {
        const box = new THREE.Mesh(new THREE.BoxGeometry(1.6, 1.1, 1.6), new THREE.MeshLambertMaterial({ color: id === 'quarters' ? '#7a8490' : '#6a6258' }));
        box.position.y = 0.63; rig.add(box);
      }
      root.add(deck, rig);
    }
    root.traverse((c) => {
      const mesh = c as THREE.Mesh;
      if (!mesh.isMesh) return;
      mesh.castShadow = mesh.receiveShadow = true;
      // a broken module: every surface dark, its lights out
      if (broken) mesh.material = (Array.isArray(mesh.material) ? mesh.material : [mesh.material]).map((mat) => { const d = (mat as THREE.MeshLambertMaterial).clone(); d.color?.multiplyScalar(0.32); if ('emissive' in d) (d.emissive as THREE.Color).setScalar(0); return d; })[0]!;
    });
    if (broken) root.rotation.set(0.05, 0, -0.07);
    return { root, rig };
  }

  dispose(): void { this.root.clear(); this.shown.clear(); }
}
