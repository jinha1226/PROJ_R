import * as THREE from 'three';

/** Places rigid parts on a skinned model's bones, measured in its rest pose (call straight after cloning). */
export function boneParts(model: THREE.Object3D) {
  model.updateMatrixWorld(true);
  const rootQ = model.getWorldQuaternion(new THREE.Quaternion());
  const s = model.getWorldScale(new THREE.Vector3()).y;
  const bone = (n: string) => model.getObjectByName(n);
  return {
    /** world position of a bone */
    at: (n: string) => bone(n)?.getWorldPosition(new THREE.Vector3()) ?? new THREE.Vector3(),
    /** an offset in metres of a full-size figure */
    v: (x: number, y: number, z: number) => new THREE.Vector3(x, y, z).multiplyScalar(s),
    /** A part square to the body, centred at a world point, sized in metres of a full-size figure. */
    piece(boneName: string, geo: THREE.BufferGeometry, m: THREE.Material, center: THREE.Vector3, turn?: THREE.Euler): THREE.Mesh | undefined {
      const b = bone(boneName);
      if (!b) return undefined;
      const bs = b.getWorldScale(new THREE.Vector3());
      if (turn) geo.applyQuaternion(new THREE.Quaternion().setFromEuler(turn));
      const mesh = new THREE.Mesh(geo.scale(s / bs.x, s / bs.y, s / bs.z), m);
      mesh.position.copy(center.clone().applyMatrix4(b.matrixWorld.clone().invert()));
      mesh.quaternion.copy(b.getWorldQuaternion(new THREE.Quaternion()).invert().multiply(rootQ));
      mesh.castShadow = true;
      b.add(mesh);
      return mesh;
    },
    /** A sleeve along a bone toward its child, covering `from`–`to` of its length. */
    sleeve(boneName: string, childName: string, thick: number, m: THREE.Material, from = 0, to = 1): void {
      const b = bone(boneName);
      const c = bone(childName);
      if (!b || !c) return;
      const dir = c.position.clone();
      const len = dir.length();
      const t = thick * s / b.getWorldScale(new THREE.Vector3()).x;
      const mesh = new THREE.Mesh(new THREE.BoxGeometry(t, len * (to - from), t).translate(0, len * (from + to) / 2, 0), m);
      mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir.normalize());
      mesh.castShadow = true;
      b.add(mesh);
    },
  };
}
