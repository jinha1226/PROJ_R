import * as THREE from 'three';
import type { Cell } from '../../sim/grid/types';
import type { WorldFog } from './worldFog';

/** how long after touchdown the lab starts to unfold, and how long it takes (seconds) */
const WAIT = 0.9;
const RISE = 0.7;

/**
 * The pod's basic lab: a steel deck with the clone printer on it (a glass vat of cyan fluid on a steel foot, a capped top)
 * and a console beside it. Hidden while the pod falls, it unfolds out of the ground once the pod is down.
 */
export class Lab {
  readonly root = new THREE.Group();
  private readonly rig = new THREE.Group();
  private t = -1;

  constructor(at: Cell, fog: WorldFog) {
    const steel = fog.apply(new THREE.MeshLambertMaterial({ color: '#6a727c' }));
    const dark = fog.apply(new THREE.MeshLambertMaterial({ color: '#2e343c' }));
    const deck = new THREE.Mesh(new THREE.BoxGeometry(1.8, 0.08, 1.8), dark);
    deck.position.y = 0.04;
    const foot = new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.46, 0.26, 16), steel);
    foot.position.y = 0.21;
    const fluid = new THREE.Mesh(new THREE.CylinderGeometry(0.27, 0.27, 1.1, 16), new THREE.MeshBasicMaterial({ color: '#2ad0e8', transparent: true, opacity: 0.9, depthWrite: false }));
    fluid.position.y = 0.92;
    const glass = new THREE.Mesh(new THREE.CylinderGeometry(0.34, 0.34, 1.3, 16, 1, true), new THREE.MeshBasicMaterial({ color: '#8ff0ff', transparent: true, opacity: 0.08, depthWrite: false, side: THREE.DoubleSide }));
    glass.position.y = 0.99;
    const cap = new THREE.Mesh(new THREE.CylinderGeometry(0.4, 0.42, 0.2, 16), steel);
    cap.position.y = 1.74;
    const lamp = new THREE.Mesh(new THREE.SphereGeometry(0.08, 8, 6), new THREE.MeshBasicMaterial({ color: '#5ae0ff' }));
    lamp.position.y = 1.9;
    const console = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.62, 0.3), steel);
    console.position.set(0.62, 0.39, 0.3);
    const screen = new THREE.Mesh(new THREE.PlaneGeometry(0.26, 0.18), new THREE.MeshBasicMaterial({ color: '#5dff8a' }));
    screen.position.set(0.62, 0.6, 0.46);
    for (const m of [deck, foot, cap, console]) { m.castShadow = true; m.receiveShadow = true; }
    this.rig.add(foot, fluid, glass, cap, lamp, console, screen);
    this.root.add(deck, this.rig);
    this.root.position.set(at.x, 0, at.y);
  }

  /** whether it stands (not hidden for the landing, not still unfolding) */
  get up(): boolean { return this.root.visible && this.t < 0; }

  /** out of sight while the pod falls */
  hide(): void { this.root.visible = false; this.t = -1; }

  /** the pod is down: unfold after a moment */
  rise(): void { this.t = 0; this.root.visible = true; this.rig.scale.set(1, 0.001, 1); this.root.scale.setScalar(0.001); }

  update(dt: number): void {
    if (this.t < 0) return;
    this.t += dt;
    const k = Math.min(1, Math.max(0, (this.t - WAIT) / RISE)), ease = 1 - Math.pow(1 - k, 3);
    this.root.scale.setScalar(k > 0 ? 1 : 0.001);
    this.rig.scale.set(1, Math.max(0.001, ease), 1);
    if (k >= 1) this.t = -1;
  }
}
