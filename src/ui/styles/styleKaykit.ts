import { markFigure } from '../../view/grid/pixelPass';
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { clone as cloneSkinned } from 'three/examples/jsm/utils/SkeletonUtils.js';
import { BANNER_X, D, DOOR_X, FIGS, PILLARS, PROPS, TORCH_BACK, TORCH_SIDE, W, facing, type Built, type Fig, type PropKind } from './roomPlan';

/** KayKit pieces are built on a 2 m grid: half size makes one small tile one cell. */
const K = 0.5;
/** figures a little over native, so they read beside the game's other styles */
const FIG_K = 0.62;

const PROP: Record<PropKind, string> = {
  barrel: 'barrel_large', barrels: 'barrel_small_stack', crates: 'crates_stacked', chest: 'chest_gold', table: 'table_medium_decorated_A',
  chair: 'chair', rubble: 'rubble_half', bones: 'sword_shield_broken', shelf: 'shelf_small_candles', keg: 'keg_decorated',
};
const CHAR: Record<Fig['cls'], { file: string; show: string[]; set: 'adventurer' | 'skeleton'; idle: string }> = {
  warrior: { file: 'Knight', show: ['1H_Sword', 'Round_Shield'], set: 'adventurer', idle: 'Idle' },
  archer: { file: 'Rogue_Hooded', show: ['2H_Crossbow'], set: 'adventurer', idle: 'Idle' },
  mage: { file: 'Mage', show: ['2H_Staff'], set: 'adventurer', idle: 'Idle' },
  skeleton: { file: 'Skeleton_Minion', show: [], set: 'skeleton', idle: 'Idle_Combat' },
  skelMage: { file: 'Skeleton_Mage', show: [], set: 'skeleton', idle: 'Idle_Combat' },
  skelBrute: { file: 'Skeleton_Warrior', show: [], set: 'skeleton', idle: 'Idle_Combat' },
};
/** gear nodes a KayKit character carries; only the listed ones stay visible */
const GEAR = /^(1H_|2H_|Badge_Shield|Rectangle_Shield|Round_Shield|Spike_Shield|Spellbook|Knife|Throwable|Mug|Barbarian_Round_Shield)/;

export async function buildKaykit(base: string): Promise<Built> {
  const loader = new GLTFLoader();
  const load = (f: string) => loader.loadAsync(`${base}assets/${f}`);
  const files = [...new Set(FIGS.map((f) => CHAR[f.cls].file))];
  const [kit, advAnims, skelAnims, ...chars] = await Promise.all([load('models/kaykit/dungeon.glb'), load('models/anims-adventurer.glb'), load('models/anims-skeleton.glb'), ...files.map((f) => load(`models/characters/${f}.glb`))]);
  const root = new THREE.Group();
  // KayKit's toy colours, ground down: less saturation and a little darker, so the dungeon reads grim under the torches
  const grim = new Map<THREE.Material, THREE.Material>();
  const grade = (o: THREE.Object3D): void => o.traverse((c) => {
    const m = c as THREE.Mesh;
    if (!m.isMesh) return;
    const src = m.material as THREE.MeshStandardMaterial;
    let g = grim.get(src) as THREE.MeshStandardMaterial | undefined;
    if (!g) {
      g = src.clone();
      g.color.multiplyScalar(0.6);
      g.onBeforeCompile = (sh) => { sh.fragmentShader = sh.fragmentShader.replace('#include <map_fragment>', '#include <map_fragment>\n  diffuseColor.rgb = mix(vec3(dot(diffuseColor.rgb, vec3(0.299, 0.587, 0.114))), diffuseColor.rgb, 0.5);'); };
      g.customProgramCacheKey = () => 'kaykit-grim';
      grim.set(src, g);
    }
    m.material = g;
  });
  const piece = (name: string): THREE.Object3D => {
    const src = kit.scene.getObjectByName(name);
    const o = src ? src.clone(true) : new THREE.Group();
    o.position.set(0, 0, 0);
    o.traverse((c) => { const m = c as THREE.Mesh; if (m.isMesh) { m.castShadow = true; m.receiveShadow = true; } });
    grade(o);
    const g = new THREE.Group();
    g.add(o);
    g.scale.setScalar(K);
    return g;
  };
  const put = (name: string, x: number, z: number, rot = 0, y = 0): THREE.Object3D => {
    const p = piece(name);
    p.position.set(x, y, z);
    p.rotation.y = rot;
    root.add(p);
    return p;
  };
  // floor: large tiles over pairs of cells, a grate and a broken patch for variety
  for (let x = 1; x <= W; x += 2) for (let z = 1; z <= D; z += 2) {
    const name = x === 7 && z === 3 ? 'floor_tile_big_grate' : 'floor_tile_large';
    put(name, x + 0.5, z + 0.5, ((x + z) % 4) * (Math.PI / 2));
  }
  put('floor_tile_small_broken_A', 2, 4, 0, 0.02);
  put('floor_tile_small_weeds_A', 9, 6, 0, 0.02);
  // walls in two-cell lengths on the boundary lines, a pillar at each corner
  for (let x = 1; x <= W; x += 2) {
    const door = x === DOOR_X || x + 1 === DOOR_X;
    put(door ? 'wall_arched' : x === 9 ? 'wall_cracked' : x === 5 ? 'wall_shelves' : 'wall', x + 0.5, 0.5);
  }
  for (let z = 1; z <= D; z += 2) {
    put(z === 3 ? 'wall_pillar' : 'wall', 0.5, z + 0.5, Math.PI / 2);
    put(z === 5 ? 'wall_broken' : 'wall', W + 0.5, z + 0.5, -Math.PI / 2);
  }
  for (const [x, z] of [[0.5, 0.5], [W + 0.5, 0.5], [0.5, D + 0.5], [W + 0.5, D + 0.5]] as const) put('pillar', x, z);
  for (const [x, z] of PILLARS) put('pillar', x, z).scale.set(K * 0.7, K * 0.8, K * 0.7);
  for (const x of TORCH_BACK) put('torch_mounted', x, 0.75, 0, 1.2);
  for (const z of TORCH_SIDE) { put('torch_mounted', 0.75, z, Math.PI / 2, 1.2); put('torch_mounted', W + 0.25, z, -Math.PI / 2, 1.2); }
  put('banner_patternA_red', BANNER_X, 0.55);
  for (const p of PROPS) put(PROP[p.kind], p.x, p.z, p.rot ?? 0);
  put('candle_triple', 1, 5, 0, 0.95);
  put('coin_stack_large', 6.6, 1.4);
  // the party and the dead, each idling on its own clip
  const mixers: THREE.AnimationMixer[] = [];
  const clips = { adventurer: advAnims.animations, skeleton: skelAnims.animations };
  for (const f of FIGS) {
    const c = CHAR[f.cls], src = chars[files.indexOf(c.file)]!;
    const fig = cloneSkinned(src.scene) as THREE.Group;
    fig.traverse((o) => {
      if (GEAR.test(o.name)) o.visible = c.show.includes(o.name);
      const m = o as THREE.Mesh;
      if (m.isMesh) m.castShadow = true;
    });
    grade(fig);
    markFigure(fig, f.foe ? 'foe' : 'hero');
    fig.scale.setScalar(FIG_K);
    fig.position.set(f.x, 0, f.z);
    fig.rotation.y = facing(f);
    root.add(fig);
    const mixer = new THREE.AnimationMixer(fig);
    const clip = clips[c.set].find((a) => a.name === c.idle) ?? clips[c.set].find((a) => a.name === 'Idle');
    if (clip) mixer.clipAction(clip).setEffectiveTimeScale(0.8 + Math.random() * 0.3).play();
    mixer.update(Math.random());
    mixers.push(mixer);
  }
  return { root, update: (dt) => { for (const m of mixers) m.update(dt); } };
}
