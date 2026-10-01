import * as THREE from 'three';
import type { Vec2 } from '../../core/vec2';
import type { EnvLibrary } from '../explore/envAssets';

export interface Placement { pos: Vec2; rot: number; scale: number }

/** Footprint radius each env model is normalised to (matches the sim's obstacle radii). */
export const FOOTPRINT: Record<string, number> = {
  'forest/tree': 0.9, 'forest/treeB': 0.9, 'forest/trees': 2.2, 'forest/treesB': 2.2, 'forest/rock': 0.8, 'forest/rockB': 0.8, 'forest/bush': 0.6,
  'dungeon/pillar': 0.6, 'dungeon/crates': 0.7, 'dungeon/barrel': 0.45, 'dungeon/torch': 0.25, 'dungeon/chest': 0.5, 'dungeon/rubble': 0.8,
  'graveyard/grave': 0.45, 'graveyard/graveB': 0.45, 'graveyard/deadtree': 0.7, 'graveyard/deadtreeB': 0.7, 'graveyard/crypt': 1.6,
  'graveyard/arch': 1.4, 'graveyard/lantern': 0.3,
};

/** One InstancedMesh per sub-mesh of the model: hundreds of trees in a handful of draw calls. */
export function instanceModel(lib: EnvLibrary, ref: string, places: Placement[], shadows: boolean): THREE.Group {
  const out = new THREE.Group();
  const src = lib.source(ref);
  if (!src || !places.length) return out;
  const size = src.box.getSize(new THREE.Vector3());
  const norm = ((FOOTPRINT[ref] ?? 0.8) * 2.2) / Math.max(0.01, Math.max(size.x, size.z));
  src.scene.updateMatrixWorld(true);
  const lift = new THREE.Matrix4().makeTranslation(0, -src.box.min.y, 0);
  const t = new THREE.Matrix4();
  const q = new THREE.Quaternion();
  const up = new THREE.Vector3(0, 1, 0);
  src.scene.traverse((o) => {
    const mesh = o as THREE.Mesh;
    if (!mesh.isMesh) return;
    const inst = new THREE.InstancedMesh(mesh.geometry, mesh.material, places.length);
    inst.castShadow = shadows;
    inst.receiveShadow = shadows;
    places.forEach((p, i) => {
      const s = norm * p.scale;
      q.setFromAxisAngle(up, p.rot);
      t.compose(new THREE.Vector3(p.pos.x, 0, p.pos.y), q, new THREE.Vector3(s, s, s)).multiply(lift).multiply(mesh.matrixWorld);
      inst.setMatrixAt(i, t);
    });
    inst.instanceMatrix.needsUpdate = true;
    inst.computeBoundingSphere();
    out.add(inst);
  });
  return out;
}

/** Groups placements by model and instances each group. */
export function instanceAll(lib: EnvLibrary, props: (Placement & { ref: string })[], shadows: boolean): THREE.Group {
  const g = new THREE.Group();
  const by = new Map<string, Placement[]>();
  for (const p of props) by.set(p.ref, [...(by.get(p.ref) ?? []), p]);
  for (const [ref, places] of by) g.add(instanceModel(lib, ref, places, shadows));
  return g;
}
