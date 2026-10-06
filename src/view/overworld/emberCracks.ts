import * as THREE from 'three';
import type { Cell } from '../../sim/grid/types';
import type { WorldFog } from './worldFog';
import { jitter } from './worldProps';
import type { WorldLook } from './worldTerrain';

/** Glowing cracks in the ground round the demon army's places (obelisks, camp totems, wrecks); they close up once the land is ours. */
export class EmberCracks {
  readonly mesh: THREE.InstancedMesh;
  private readonly cells: Cell[] = [];
  private readonly mats: THREE.Matrix4[] = [];
  private claimed = -1;

  constructor(private readonly look: WorldLook, private readonly w: number, fog: WorldFog) {
    const sources = [...look.lights.filter((l) => l.kind !== 'brazier').map((l) => l.pos), ...look.camps.map((c) => c.totem)];
    const taken = new Set<number>();
    for (const s of sources) for (let dy = -5; dy <= 5; dy++) for (let dx = -5; dx <= 5; dx++) {
      const c = { x: s.x + dx, y: s.y + dy }, k = c.y * w + c.x;
      const g = look.ground[k];
      if (taken.has(k) || (g !== 'grass' && g !== 'dirt' && g !== 'camp' && g !== 'forest') || Math.hypot(dx, dy) > 5 || jitter(c.x, c.y, 60) > 0.32) continue;
      taken.add(k);
      for (let n = 0; n < 2; n++) {
        this.cells.push(c);
        const len = 0.4 + jitter(c.x, c.y, 61 + n) * 0.5;
        this.mats.push(new THREE.Matrix4().compose(new THREE.Vector3(c.x + (jitter(c.x, c.y, 63 + n) - 0.5) * 0.7, 0.02, c.y + (jitter(c.x, c.y, 65 + n) - 0.5) * 0.7),
          new THREE.Quaternion().setFromEuler(new THREE.Euler(0, jitter(c.x, c.y, 67 + n) * Math.PI, 0)), new THREE.Vector3(len, 1, 1)));
      }
    }
    this.mesh = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 0.02, 0.035), fog.apply(new THREE.MeshBasicMaterial({ color: '#e8300a' })), Math.max(1, this.cells.length));
    this.mesh.count = this.cells.length;
    this.shade();
  }

  /** Hides the cracks on claimed land (only when the claim has grown). */
  shade(): void {
    let n = 0;
    for (const v of this.look.claimed) n += v;
    if (n === this.claimed) return;
    this.claimed = n;
    const gone = new THREE.Matrix4().makeScale(0, 0, 0);
    this.cells.forEach((c, i) => this.mesh.setMatrixAt(i, this.look.claimed[c.y * this.w + c.x] ? gone : this.mats[i]!));
    this.mesh.instanceMatrix.needsUpdate = true;
  }
}
