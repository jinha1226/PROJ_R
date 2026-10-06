import * as THREE from 'three';
import type { Cell } from '../../sim/grid/types';
import type { WorldFog } from './worldFog';

const FALL = 2.4;
const OPEN = 0.8;

/**
 * The landing pod: an upright capsule on three legs with a scorched ring round it. It can come down from the sky —
 * a burning streak, a thump of dust, then the door slides open.
 */
export class LandingPod {
  readonly root = new THREE.Group();
  private readonly body = new THREE.Group();
  private readonly flame: THREE.Mesh;
  private readonly dust: THREE.Mesh;
  private readonly door: THREE.Mesh;
  private t = -1;
  private thumped = false;

  constructor(base: Cell, fog: WorldFog, private readonly onThump: () => void = () => undefined) {
    const hull = fog.apply(new THREE.MeshLambertMaterial({ color: '#9aa2ac' }));
    const dark = fog.apply(new THREE.MeshLambertMaterial({ color: '#3a4048' }));
    const shell = new THREE.Mesh(new THREE.CylinderGeometry(0.75, 0.9, 1.9, 12), hull);
    shell.position.y = 1.25;
    const nose = new THREE.Mesh(new THREE.ConeGeometry(0.75, 0.9, 12), hull);
    nose.position.y = 2.65;
    this.body.add(shell, nose);
    for (let k = 0; k < 3; k++) {
      const a = (k / 3) * Math.PI * 2, leg = new THREE.Mesh(new THREE.BoxGeometry(0.1, 1.0, 0.1), dark);
      leg.position.set(Math.cos(a) * 0.85, 0.45, Math.sin(a) * 0.85);
      leg.rotation.set(Math.sin(a) * 0.45, 0, -Math.cos(a) * 0.45);
      this.body.add(leg);
    }
    // the door faces the way the clone walks out (south, toward the start cell)
    this.door = new THREE.Mesh(new THREE.BoxGeometry(0.7, 1.2, 0.06), new THREE.MeshBasicMaterial({ color: '#5ae0ff' }));
    this.door.position.set(0, 1.1, 0.86);
    const glow = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.05, 0.05), new THREE.MeshBasicMaterial({ color: '#5ae0ff' }));
    glow.position.set(0, 2.05, 0.8);
    this.body.add(this.door, glow);
    for (const m of [shell, nose]) { m.castShadow = true; m.receiveShadow = true; }
    this.flame = new THREE.Mesh(new THREE.ConeGeometry(0.5, 2.6, 10, 1, true), new THREE.MeshBasicMaterial({ color: '#ffb050', transparent: true, opacity: 0.85, blending: THREE.AdditiveBlending, depthWrite: false }));
    this.flame.rotation.x = Math.PI;
    this.flame.position.y = -0.9;
    this.flame.visible = false;
    this.body.add(this.flame);
    const scorch = new THREE.Mesh(new THREE.CircleGeometry(1.9, 24), fog.apply(new THREE.MeshBasicMaterial({ color: '#0c0a08', transparent: true, opacity: 0.75, depthWrite: false })));
    scorch.rotation.x = -Math.PI / 2;
    scorch.position.y = 0.015;
    this.dust = new THREE.Mesh(new THREE.RingGeometry(0.6, 1.0, 32), new THREE.MeshBasicMaterial({ color: '#b8a890', transparent: true, opacity: 0, depthWrite: false }));
    this.dust.rotation.x = -Math.PI / 2;
    this.dust.position.y = 0.05;
    this.root.add(scorch, this.dust, this.body);
    this.root.position.set(base.x + 0.5, 0, base.y + 0.5);
  }

  /** Sends the pod up into the sky to fall in. */
  land(): void { this.t = 0; this.thumped = false; this.body.position.y = 60; this.flame.visible = true; this.door.position.x = 0; }

  get landing(): boolean { return this.t >= 0; }

  update(dt: number): void {
    if (this.t < 0 || dt <= 0) return;
    this.t += dt;
    const k = Math.min(1, this.t / FALL);
    // falls fast, brakes hard at the end
    this.body.position.y = 60 * Math.pow(1 - k, 2.6);
    this.flame.scale.setScalar(0.8 + Math.sin(this.t * 40) * 0.15 + (1 - k) * 0.6);
    if (k >= 1 && !this.thumped) { this.thumped = true; this.flame.visible = false; this.onThump(); }
    if (this.thumped) {
      const d = this.t - FALL;
      this.dust.scale.setScalar(1 + d * 3.5);
      (this.dust.material as THREE.MeshBasicMaterial).opacity = Math.max(0, 0.55 - d * 0.9);
      // the door slides aside
      this.door.position.x = Math.min(1, d / OPEN) * 0.62;
      if (d > OPEN + 0.6) { this.t = -1; (this.dust.material as THREE.MeshBasicMaterial).opacity = 0; }
    }
  }
}

/** The drill rig over the shaft: four legs leaning in, the bit down the middle, an amber lamp on top, the black hole beneath. */
export function drillRig(at: Cell, fog: WorldFog): THREE.Group {
  const g = new THREE.Group();
  const steel = fog.apply(new THREE.MeshLambertMaterial({ color: '#6a625a' }));
  for (let k = 0; k < 4; k++) {
    const a = Math.PI / 4 + (k / 4) * Math.PI * 2, leg = new THREE.Mesh(new THREE.BoxGeometry(0.08, 2.8, 0.08), steel);
    leg.position.set(Math.cos(a) * 0.42, 1.3, Math.sin(a) * 0.42);
    leg.rotation.set(Math.sin(a) * 0.3, 0, -Math.cos(a) * 0.3);
    g.add(leg);
  }
  const bit = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.04, 2.2, 8), steel);
  bit.position.y = 1.0;
  const hole = new THREE.Mesh(new THREE.CircleGeometry(0.55, 20), new THREE.MeshBasicMaterial({ color: '#000' }));
  hole.rotation.x = -Math.PI / 2;
  hole.position.y = 0.02;
  const lamp = new THREE.Mesh(new THREE.SphereGeometry(0.1, 8, 6), fog.apply(new THREE.MeshBasicMaterial({ color: '#ffb84a' })));
  lamp.position.y = 2.75;
  g.add(bit, hole, lamp);
  g.position.set(at.x, 0, at.y);
  return g;
}
