import * as THREE from 'three';
import { chestTex, faceTex, noiseTex, type FaceKind } from './blockTextures';

/** Colours and face of a block-built figure. */
export interface BlockLook { skin: string; hair: string; shirt: string; trim: string; pants: string; boots: string; face: FaceKind; ribs?: boolean; bulk?: number }

const find = (root: THREE.Object3D, name: string): THREE.Object3D | undefined => root.getObjectByName(name);

/** Materials for one box: front (+z) may differ from the rest. */
function boxMats(side: THREE.Texture, front?: THREE.Texture): THREE.MeshStandardMaterial[] {
  const m = (t: THREE.Texture) => new THREE.MeshStandardMaterial({ map: t, roughness: 0.9 });
  const s = m(side);
  return [s, s, s, s, front ? m(front) : s, s];
}

/**
 * Hides the mannequin skin and builds a Minecraft-style body of boxes on its bones, so the same animations drive it.
 * Must be called on a model in its rest pose (straight after cloning). Returns the materials (for hit flashes).
 */
export function buildBlockBody(model: THREE.Object3D, look: BlockLook): THREE.MeshStandardMaterial[] {
  const mats: THREE.MeshStandardMaterial[] = [];
  model.traverse((o) => { if ((o as THREE.SkinnedMesh).isSkinnedMesh) o.visible = false; });
  model.updateMatrixWorld(true);
  const rootQ = model.getWorldQuaternion(new THREE.Quaternion());
  const rootS = model.getWorldScale(new THREE.Vector3()).x;
  const k = look.bulk ?? 1;
  const worldPos = (n: string) => find(model, n)?.getWorldPosition(new THREE.Vector3()) ?? new THREE.Vector3();
  const keep = (list: THREE.MeshStandardMaterial[]) => { mats.push(...list); return list; };

  /** A box between a bone and its child, along the bone. */
  const limb = (boneName: string, childName: string, thick: number, tex: THREE.Texture, extend = 0) => {
    const bone = find(model, boneName);
    const child = find(model, childName);
    if (!bone || !child) return;
    const dir = child.position.clone();
    const len = dir.length() + extend;
    const geo = new THREE.BoxGeometry(thick * k, len, thick * k).translate(0, len / 2, 0);
    const mesh = new THREE.Mesh(geo, keep(boxMats(tex)));
    mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir.normalize());
    mesh.castShadow = true;
    bone.add(mesh);
  };

  /** A box kept square to the body (head, torso, hips), centred at a world point, sized in metres. */
  const block = (boneName: string, center: THREE.Vector3, size: THREE.Vector3, side: THREE.Texture, front?: THREE.Texture) => {
    const bone = find(model, boneName);
    if (!bone) return;
    const inv = bone.matrixWorld.clone().invert();
    const boneScale = bone.getWorldScale(new THREE.Vector3()).x;
    const geo = new THREE.BoxGeometry(size.x / boneScale, size.y / boneScale, size.z / boneScale);
    const mesh = new THREE.Mesh(geo, keep(boxMats(side, front)));
    mesh.position.copy(center.clone().applyMatrix4(inv));
    mesh.quaternion.copy(bone.getWorldQuaternion(new THREE.Quaternion()).invert().multiply(rootQ));
    mesh.castShadow = true;
    bone.add(mesh);
  };

  const s = rootS;
  const head = worldPos('Head');
  const neck = worldPos('neck_01');
  const pelvis = worldPos('pelvis');
  const shirt = noiseTex(look.shirt, 3);
  block('Head', head.clone().add(new THREE.Vector3(0, 0.13 * s, 0.01 * s)), new THREE.Vector3(0.3, 0.3, 0.3).multiplyScalar(s), noiseTex(look.hair, 7), faceTex(look.face, look.skin, look.hair));
  const chestMid = pelvis.clone().lerp(neck, 0.55);
  block('spine_02', chestMid, new THREE.Vector3(0.34 * k * s, neck.y - pelvis.y + 0.02 * s, 0.18 * k * s), shirt, chestTex(look.shirt, look.trim, !!look.ribs));
  block('pelvis', pelvis.clone().add(new THREE.Vector3(0, -0.02 * s, 0)), new THREE.Vector3(0.32 * k, 0.14, 0.18 * k).multiplyScalar(s), noiseTex(look.pants, 5));
  for (const side of ['l', 'r'] as const) {
    limb(`upperarm_${side}`, `lowerarm_${side}`, 0.11, shirt);
    limb(`lowerarm_${side}`, `hand_${side}`, 0.1, noiseTex(look.skin, side === 'l' ? 11 : 13), 0.07);
    limb(`thigh_${side}`, `calf_${side}`, 0.13, noiseTex(look.pants, side === 'l' ? 17 : 19));
    limb(`calf_${side}`, `foot_${side}`, 0.12, noiseTex(look.boots, 23));
    limb(`foot_${side}`, `ball_${side}`, 0.12, noiseTex(look.boots, 29), 0.05);
  }
  return mats;
}
