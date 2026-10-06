import { markFigure, RING } from '../../view/grid/pixelPass';
import * as THREE from 'three';
import type { DungeonKit, DungeonPiece } from '../../view/grid/dungeonKit';
import { UalActor, type UalLibrary, type UalLook } from '../../view/grid/ualActor';
import { stoneMat, type StoneSet } from '../../view/grid/stoneMats';
import { lookOf } from '../party/partyPick';
import { foeLook } from '../../view/grid/species';
import { BANNER_X, D, DOOR_X, FIGS, PILLARS, PROPS, TORCH_BACK, TORCH_SIDE, W, facing, type Built, type Fig, type PropKind } from './roomPlan';

const WALL_H = 1.5;
const PROP: Record<PropKind, [DungeonPiece, number]> = {
  barrel: ['Barrel', 0.7], barrels: ['Barrel2', 0.8], crates: ['Crate', 0.85], chest: ['Chest_Gold', 0.8], table: ['Table_Small', 0.9],
  chair: ['Chair', 0.55], rubble: ['Brick', 0.6], bones: ['Skull', 0.3], shelf: ['Bag_Standing', 0.5], keg: ['Bucket', 0.45],
};
// the cave folk as the game draws them on floors 1-5: a goblin, a goblin shaman, an ogre
const FOE: Record<string, UalLook> = {
  skeleton: foeLook({ body: '#d8d2c0', trim: '#7a7262', scale: 0.92, weapon: 'blade', idle: 'Idle_Loop' }, 'minion', 'goblin'),
  skelMage: foeLook({ body: '#5a3a7a', trim: '#2a1a3a', scale: 0.95, weapon: 'staff', idle: 'Spell_Simple_Idle_Loop' }, 'mage', 'goblin'),
  skelBrute: foeLook({ body: '#8a3a32', trim: '#2a2420', scale: 1.22, weapon: 'axe', shield: true, idle: 'Sword_Idle' }, 'brute', 'goblin'),
};
const HERO_WEAPON = { warrior: 'swordShield', archer: 'longbow', mage: 'staff' } as const;

/** The look the game has today: the Quaternius dungeon pack and the dressed mannequins. */
export function buildCurrent(kit: DungeonKit, lib: UalLibrary, stone?: { floor: StoneSet; wall: StoneSet }): Built {
  const root = new THREE.Group();
  const put = (name: DungeonPiece, fit: { width?: number; height?: number }, x: number, z: number, rot = 0, y = 0): void => {
    const o = kit.clone(name, fit);
    o.position.set(x, y, z);
    o.rotation.y = rot;
    root.add(o);
  };
  // with scanned stone: one flat floor and plain wall slabs, the texture carrying all the detail
  const floorMat = stone && stoneMat(stone.floor, 2.5, 'floor'), wallMat = stone && stoneMat(stone.wall, 2, 'wall');
  if (floorMat) {
    const f = new THREE.Mesh(new THREE.PlaneGeometry(W, D).rotateX(-Math.PI / 2), floorMat);
    f.position.set((W + 1) / 2, 0, (D + 1) / 2);
    f.receiveShadow = true;
    root.add(f);
  }
  for (let x = 1; x <= W; x++) for (let z = 1; z <= D; z++) {
    if (floorMat) break;
    const p = kit.piece('Floor_Modular')!;
    const m = new THREE.Mesh(p.geometry, p.material);
    m.scale.set(1 / p.size.x, 0.1 / p.size.y, 1 / p.size.z);
    m.position.set(x, -0.1, z);
    m.receiveShadow = true;
    root.add(m);
  }
  const wall = (x: number, z: number, rot: number): void => {
    if (wallMat) {
      const m = new THREE.Mesh(new THREE.BoxGeometry(1, WALL_H, 0.25).translate(0, WALL_H / 2, 0), wallMat);
      m.position.set(x, 0, z);
      m.rotation.y = rot;
      m.castShadow = m.receiveShadow = true;
      root.add(m);
      return;
    }
    const p = kit.piece('Wall_Modular')!;
    const m = new THREE.Mesh(p.geometry, p.material);
    m.scale.set(1 / p.size.x, WALL_H / p.size.y, 0.25 / p.size.z);
    m.position.set(x, 0, z);
    m.rotation.y = rot;
    m.castShadow = m.receiveShadow = true;
    root.add(m);
  };
  for (let x = 1; x <= W; x++) if (x !== DOOR_X) wall(x, 0.375, 0);
  put('Arch_Door', { width: 1 }, DOOR_X, 0.4);
  for (let z = 1; z <= D; z++) { wall(0.375, z, Math.PI / 2); wall(W + 0.625, z, Math.PI / 2); }
  for (const [x, z] of [[0.5, 0.5], [W + 0.5, 0.5], [0.5, D + 0.5], [W + 0.5, D + 0.5]] as const) put('Column', { height: WALL_H * 1.08 }, x, z);
  for (const [x, z] of PILLARS) put('Column2', { height: WALL_H * 1.08 }, x, z);
  for (const x of TORCH_BACK) put('Torch', { height: 0.45 }, x, 0.6, 0, 0.8);
  for (const z of TORCH_SIDE) { put('Torch', { height: 0.45 }, 0.6, z, Math.PI / 2, 0.8); put('Torch', { height: 0.45 }, W + 0.4, z, -Math.PI / 2, 0.8); }
  put('Banner_wall', { height: 1.1 }, BANNER_X, 0.55, 0, 0.2);
  put('Cobweb', { width: 0.8 }, 1, 0.6, 0, 1.0);
  for (const p of PROPS) { const [name, w] = PROP[p.kind]; put(name, { width: w }, p.x, p.z, p.rot ?? 0); }
  const actors: UalActor[] = [];
  for (const f of FIGS) {
    const look = f.foe ? FOE[f.cls]! : lookOf(f.cls as Exclude<Fig['cls'], 'skeleton' | 'skelMage' | 'skelBrute'>, HERO_WEAPON[f.cls as 'warrior']);
    const a = new UalActor(lib, look);
    markFigure(a.root, look.ring ?? RING.foe);
    a.root.position.set(f.x, 0, f.z);
    a.root.rotation.y = facing(f);
    root.add(a.root);
    actors.push(a);
  }
  return { root, update: (dt) => { for (const a of actors) a.update(dt); } };
}
