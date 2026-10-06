import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { CHUNK, ChunkedInstances } from '../../src/view/grid/chunkedInstances';

describe('chunked instances', () => {
  const at = [{ x: 0, y: 0 }, { x: CHUNK + 1, y: 0 }, { x: 1, y: 1 }, { x: 0, y: CHUNK * 3 }];
  const make = () => new ChunkedInstances(new THREE.BoxGeometry(1, 1, 1), new THREE.MeshBasicMaterial(), at);

  it('splits a floor into one mesh per chunk, keeping every instance', () => {
    const c = make();
    expect(c.meshes.length).toBe(3);
    expect(c.meshes.reduce((n, m) => n + m.count, 0)).toBe(4);
    expect(c.total).toBe(4);
  });

  it('addresses instances by their global index, and culls by chunk bounds', () => {
    const c = make();
    at.forEach((p, k) => c.setMatrixAt(k, new THREE.Matrix4().makeTranslation(p.x, 0, p.y)));
    c.commit();
    const far = c.meshes.find((m) => m.count === 1 && m.boundingSphere!.center.z > CHUNK)!;
    expect(far.boundingSphere!.center.z).toBeCloseTo(CHUNK * 3);
    const first = c.meshes.find((m) => m.count === 2)!;
    const out = new THREE.Matrix4();
    first.getMatrixAt(1, out);
    expect(new THREE.Vector3().setFromMatrixPosition(out).x).toBe(1);
  });

  it('a chunk drawn all black (never seen) is skipped until something in it shows', () => {
    const c = make();
    at.forEach((_, k) => c.setColorAt(k, new THREE.Color(0, 0, 0)));
    c.commit();
    expect(c.meshes.every((m) => !m.visible)).toBe(true);
    c.setColorAt(2, new THREE.Color(0.3, 0.3, 0.3));
    c.commit();
    expect(c.meshes.filter((m) => m.visible).length).toBe(1);
  });

  it('colours reach the right chunk', () => {
    const c = make();
    c.setColorAt(1, new THREE.Color(1, 0, 0));
    c.commit();
    const m = c.meshes.find((x) => x.instanceColor && x.count === 1 && x.instanceColor.getX(0) === 1);
    expect(m).toBeDefined();
  });
});
