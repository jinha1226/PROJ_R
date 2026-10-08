import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { idx } from '../../sim/grid/types';
import { entOf } from '../../sim/party/partyCore';
import type { WorldParty } from '../../sim/overworld/worldSim';

const MAX = 400;

/** a small goblin: body, head, two ears and a blade (one geometry, drawn once per fodder) */
function goblin(): THREE.BufferGeometry {
  const parts = [
    new THREE.CylinderGeometry(0.1, 0.14, 0.32, 6).translate(0, 0.16, 0),
    new THREE.SphereGeometry(0.11, 8, 6).translate(0, 0.42, 0.02),
    new THREE.ConeGeometry(0.04, 0.12, 4).rotateZ(Math.PI / 2.4).translate(-0.12, 0.45, 0),
    new THREE.ConeGeometry(0.04, 0.12, 4).rotateZ(-Math.PI / 2.4).translate(0.12, 0.45, 0),
    new THREE.BoxGeometry(0.03, 0.03, 0.22).translate(0.13, 0.22, 0.1),
  ];
  return mergeGeometries(parts.map((g) => g.toNonIndexed()))!;
}

/**
 * A raid's fodder (spec 2026-10-08 §4), drawn as one instanced batch at their free coordinates: they bob as they walk and
 * turn to where they head. Only the ones on ground the clones have seen are drawn.
 */
export class SwarmView {
  readonly root: THREE.InstancedMesh;
  private readonly last = new Map<string, { x: number; y: number; fx: number; fy: number; phase: number }>();
  private clock = 0;

  constructor() {
    this.root = new THREE.InstancedMesh(goblin(), new THREE.MeshLambertMaterial({ color: '#ffffff' }), MAX);
    this.root.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.root.frustumCulled = false;
    this.root.count = 0;
  }

  update(p: WorldParty, dt: number): void {
    this.clock += dt;
    const m = new THREE.Matrix4(), q = new THREE.Quaternion(), up = new THREE.Vector3(0, 1, 0), s = new THREE.Vector3(1.4, 1.4, 1.4), v = new THREE.Vector3(), tint = new THREE.Color();
    let n = 0;
    const seen = new Set<string>();
    for (const u of p.units) {
      if (!u.swarm || n >= MAX) continue;
      const e = entOf(p, u.id);
      // in the dark beyond the ground the clones have seen, the horde is not drawn
      if (!e?.alive || !p.s.seen[idx(p.s.map, e.pos)]) continue;
      seen.add(u.id);
      const x = u.sx! - 0.5, y = u.sy! - 0.5, k = this.last.get(u.id) ?? { x, y, fx: 0, fy: 1, phase: (u.id.charCodeAt(u.id.length - 1) * 1.7) % 6.28 };
      const dx = x - k.x, dy = y - k.y, moving = Math.hypot(dx, dy) > 0.002;
      if (moving) { k.fx = k.fx * 0.8 + dx * 0.2; k.fy = k.fy * 0.8 + dy * 0.2; }
      k.x = x; k.y = y; this.last.set(u.id, k);
      const bob = moving ? Math.abs(Math.sin(this.clock * 11 + k.phase)) * 0.07 : 0;
      m.compose(v.set(x, bob, y), q.setFromAxisAngle(up, Math.atan2(k.fx, k.fy)), s);
      this.root.setMatrixAt(n, m);
      const id = u.id.charCodeAt(u.id.length - 1);
      tint.setHSL(0.24 + (id % 10) / 100, 0.45, 0.32 + (id % 7) / 60);
      this.root.setColorAt(n, tint);
      n++;
    }
    for (const id of this.last.keys()) if (!seen.has(id)) this.last.delete(id);
    this.root.count = n;
    this.root.instanceMatrix.needsUpdate = true;
    if (this.root.instanceColor) this.root.instanceColor.needsUpdate = true;
  }
}
