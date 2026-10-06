import * as THREE from 'three';
import { UalActor, type UalLibrary, type UalLook } from '../../view/grid/ualActor';
import type { BlockLook } from '../../view/grid/blockBody';
import { BANNER_X, D, DOOR_X, FIGS, PILLARS, PROPS, TORCH_BACK, TORCH_SIDE, W, facing, type Built, type Fig, type PropKind } from './roomPlan';

/** A 16-pixel texture drawn by hand-rolled rules, hard-edged like a block game's. */
function px(draw: (put: (x: number, y: number, c: string) => void, rnd: () => number) => void, seed = 7): THREE.Texture {
  const c = document.createElement('canvas');
  c.width = c.height = 16;
  const g = c.getContext('2d')!;
  let s = seed * 9301 + 49297;
  const rnd = () => { s = (s * 9301 + 49297) % 233280; return s / 233280; };
  draw((x, y, col) => { g.fillStyle = col; g.fillRect(x, y, 1, 1); }, rnd);
  const t = new THREE.CanvasTexture(c);
  t.magFilter = t.minFilter = THREE.NearestFilter;
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}
const tone = (hex: string, k: number) => `#${new THREE.Color(hex).multiplyScalar(k).getHexString()}`;
const fill = (base: string, spread = 0.12) => (put: (x: number, y: number, c: string) => void, rnd: () => number, x: number, y: number) => put(x, y, tone(base, 1 + (rnd() - 0.5) * spread * 2));

const TEX = {
  brick: px((put, rnd) => { for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) { const row = Math.floor(y / 4), off = row % 2 ? 4 : 0; const mortar = y % 4 === 3 || (x + off) % 8 === 7; if (mortar) put(x, y, '#2e2a27'); else fill('#6e6862', 0.14)(put, rnd, x, y); } }),
  cobble: px((put, rnd) => { for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) { const edge = x % 8 === 0 || y % 8 === 0; if (edge) put(x, y, '#34302c'); else fill(((x >> 3) + (y >> 3)) % 2 ? '#5e5952' : '#55504a', 0.06)(put, rnd, x, y); } }, 3),
  plank: px((put, rnd) => { for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) put(x, y, y % 4 === 0 ? '#4a2e18' : tone('#8a5a32', 1 + (rnd() - 0.5) * 0.18)); }, 5),
  barrel: px((put, rnd) => { for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) put(x, y, y === 2 || y === 13 ? '#3a3a40' : x % 4 === 0 ? '#4a2e18' : tone('#7a4a28', 1 + (rnd() - 0.5) * 0.2)); }, 9),
  gold: px((put, rnd) => { for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) put(x, y, y < 3 || x < 2 || x > 13 ? '#c89a30' : tone('#7a4a28', 1 + (rnd() - 0.5) * 0.2)); if (true) { put(7, 6, '#ffe070'); put(8, 6, '#ffe070'); put(7, 7, '#ffe070'); put(8, 7, '#ffe070'); } }, 11),
  banner: px((put) => { for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) put(x, y, (x === 7 || x === 8) && y > 2 && y < 13 ? '#e0b040' : y > 5 && y < 8 && x > 3 && x < 12 ? '#e0b040' : '#8a1a1a'); }),
  bone: px((put, rnd) => { for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) fill('#e0dccc', 0.08)(put, rnd, x, y); }, 13),
};
const mat = (t: THREE.Texture) => new THREE.MeshLambertMaterial({ map: t });
const M = { brick: mat(TEX.brick), cobble: mat(TEX.cobble), plank: mat(TEX.plank), barrel: mat(TEX.barrel), gold: mat(TEX.gold), banner: mat(TEX.banner), bone: mat(TEX.bone),
  flame: new THREE.MeshBasicMaterial({ color: '#ffb040' }), iron: new THREE.MeshLambertMaterial({ color: '#4a4a52' }) };

const BLOCK: Record<Fig['cls'], BlockLook> = {
  warrior: { skin: '#e0b090', hair: '#5a3a20', shirt: '#8a96a8', trim: '#c8b080', pants: '#3a3a44', boots: '#2a2420', face: 'helmet', bulk: 1.1 },
  archer: { skin: '#e0b090', hair: '#3a2a18', shirt: '#35502e', trim: '#8a6a3a', pants: '#4a3a28', boots: '#2a2018', face: 'hood' },
  mage: { skin: '#e8c0a0', hair: '#c8c8d0', shirt: '#4a2a6a', trim: '#d0b040', pants: '#3a2050', boots: '#2a1a30', face: 'human' },
  skeleton: { skin: '#e8e2d0', hair: '#e8e2d0', shirt: '#d8d2c0', trim: '#a8a090', pants: '#d8d2c0', boots: '#c8c2b0', face: 'skull', ribs: true },
  skelMage: { skin: '#e8e2d0', hair: '#e8e2d0', shirt: '#3a1a4a', trim: '#8a5ab0', pants: '#2a1a3a', boots: '#c8c2b0', face: 'skull', ribs: true },
  skelBrute: { skin: '#e8e2d0', hair: '#e8e2d0', shirt: '#5a2a24', trim: '#8a7a68', pants: '#3a2a24', boots: '#2a2420', face: 'skull', ribs: true, bulk: 1.25 },
};
const WEAPON: Record<Fig['cls'], UalLook['weapon']> = { warrior: 'sword', archer: 'bow', mage: 'none', skeleton: 'blade', skelMage: 'none', skelBrute: 'axe' };

/** Everything in blocks: pixel textures, block walls, block figures on the same rig and clips. */
export function buildVoxel(lib: UalLibrary): Built {
  const root = new THREE.Group();
  const box = (w: number, h: number, d: number, m: THREE.Material, x: number, y: number, z: number): THREE.Mesh => {
    const b = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m);
    b.position.set(x, y + h / 2, z);
    b.castShadow = b.receiveShadow = true;
    root.add(b);
    return b;
  };
  for (let x = 1; x <= W; x++) for (let z = 1; z <= D; z++) box(1, 0.25, 1, M.cobble, x, -0.25, z);
  // walls: two blocks high in the boundary row, a lintel over the door
  for (let x = 0; x <= W + 1; x++) { if (x !== DOOR_X) box(1, 1, 1, M.brick, x, 0, 0); box(1, 1, 1, M.brick, x, 1, 0); }
  for (let z = 1; z <= D + 1; z++) for (const x of [0, W + 1]) { box(1, 1, 1, M.brick, x, 0, z); if (z <= D) box(1, 1, 1, M.brick, x, 1, z); }
  for (const [x, z] of PILLARS) { box(0.7, 1.8, 0.7, M.brick, x, 0, z); box(0.9, 0.2, 0.9, M.brick, x, 1.8, z); }
  const torch = (x: number, z: number) => { box(0.12, 0.4, 0.12, M.plank, x, 0.9, z); box(0.18, 0.18, 0.18, M.flame, x, 1.3, z); };
  for (const x of TORCH_BACK) torch(x, 0.62);
  for (const z of TORCH_SIDE) { torch(0.62, z); torch(W + 0.38, z); }
  box(0.8, 1.2, 0.06, M.banner, BANNER_X, 0.6, 0.53);
  const PROP: Record<PropKind, (x: number, z: number) => void> = {
    barrel: (x, z) => box(0.7, 0.85, 0.7, M.barrel, x, 0, z),
    barrels: (x, z) => { box(0.45, 0.55, 0.45, M.barrel, x - 0.2, 0, z - 0.15); box(0.45, 0.55, 0.45, M.barrel, x + 0.22, 0, z + 0.1); box(0.45, 0.55, 0.45, M.barrel, x, 0.55, z); },
    crates: (x, z) => { box(0.8, 0.8, 0.8, M.plank, x, 0, z); box(0.55, 0.55, 0.55, M.plank, x + 0.05, 0.8, z - 0.05).rotation.y = 0.4; },
    chest: (x, z) => box(0.8, 0.55, 0.55, M.gold, x, 0, z),
    table: (x, z) => { box(1, 0.12, 0.8, M.plank, x, 0.6, z); for (const [dx, dz] of [[-0.4, -0.3], [0.4, -0.3], [-0.4, 0.3], [0.4, 0.3]]) box(0.1, 0.6, 0.1, M.plank, x + dx!, 0, z + dz!); },
    chair: (x, z) => { box(0.45, 0.08, 0.45, M.plank, x, 0.35, z); box(0.45, 0.5, 0.08, M.plank, x, 0.43, z + 0.2); for (const [dx, dz] of [[-0.18, -0.18], [0.18, -0.18], [-0.18, 0.18], [0.18, 0.18]]) box(0.07, 0.35, 0.07, M.plank, x + dx!, 0, z + dz!); },
    rubble: (x, z) => { for (let i = 0; i < 6; i++) box(0.25 + (i % 3) * 0.08, 0.2, 0.25, M.brick, x + Math.sin(i * 2.1) * 0.35, 0, z + Math.cos(i * 1.7) * 0.3).rotation.y = i; },
    bones: (x, z) => { box(0.25, 0.22, 0.25, M.bone, x, 0, z); box(0.5, 0.06, 0.08, M.bone, x + 0.3, 0, z + 0.1).rotation.y = 0.6; box(0.4, 0.06, 0.08, M.bone, x - 0.2, 0, z + 0.25).rotation.y = -0.4; },
    shelf: (x, z) => { box(0.3, 1.4, 0.9, M.plank, x + 0.25, 0, z); for (const y of [0.45, 0.9]) box(0.12, 0.2, 0.12, M.gold, x + 0.1, y, z - 0.2); },
    keg: (x, z) => { box(0.6, 0.5, 0.6, M.barrel, x, 0, z).rotation.y = 0.78; },
  };
  for (const p of PROPS) PROP[p.kind](p.x, p.z);
  const actors = FIGS.map((f) => {
    const a = new UalActor(lib, { body: '#ffffff', trim: '#ffffff', scale: f.cls === 'skelBrute' ? 1.1 : 1, weapon: WEAPON[f.cls], idle: WEAPON[f.cls] === 'none' ? 'Spell_Simple_Idle_Loop' : 'Sword_Idle', block: BLOCK[f.cls] });
    a.root.position.set(f.x, 0, f.z);
    a.root.rotation.y = facing(f);
    root.add(a.root);
    return a;
  });
  return { root, update: (dt) => { for (const a of actors) a.update(dt); } };
}
