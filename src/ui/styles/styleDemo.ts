import * as THREE from 'three';
import type { DungeonKit } from '../../view/grid/dungeonKit';
import { PixelPass } from '../../view/grid/pixelPass';
import type { UalLibrary } from '../../view/grid/ualActor';
import { D, DOOR_X, TORCH_BACK, TORCH_SIDE, W, type Built } from './roomPlan';
import { buildCurrent } from './styleCurrent';
import { buildKaykit } from './styleKaykit';
import { buildVoxel } from './styleVoxel';

const STYLES = [['current', '현재'], ['kaykit', 'KayKit'], ['voxel', '복셀']] as const;
type Style = (typeof STYLES)[number][0];

/** `?demo=styles`: one dungeon room in each candidate art style, same light and camera, switched with 1 2 3 (D: dot look). */
export async function mountStyleDemo(root: HTMLElement, lib: UalLibrary, kit: DungeonKit, base: string): Promise<void> {
  const renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.2;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  root.replaceChildren(renderer.domElement);
  const scene = new THREE.Scene();
  scene.background = new THREE.Color('#050404');
  // the game's light: a dim cold fill, warm torches on the walls, a blue spill through the door, a lamp over the party
  scene.add(new THREE.HemisphereLight('#4a5a7a', '#1a1410', 0.35));
  const lamp = (color: string, power: number, x: number, y: number, z: number, dist = 6): void => {
    const l = new THREE.PointLight(color, power, dist, 1.6);
    l.position.set(x, y, z);
    scene.add(l);
  };
  for (const x of TORCH_BACK) lamp('#ffa050', 7, x, 1.5, 1.0);
  for (const z of TORCH_SIDE) { lamp('#ffa050', 6, 1.0, 1.5, z); lamp('#ffa050', 6, W, 1.5, z); }
  lamp('#5a8aff', 6, DOOR_X, 1.2, 0.8, 5);
  const key = new THREE.DirectionalLight('#ffe0c0', 0.9);
  key.position.set(W / 2 - 3, 9, D + 4);
  key.target.position.set(W / 2, 0, D / 2);
  key.castShadow = true;
  key.shadow.mapSize.set(1024, 1024);
  Object.assign(key.shadow.camera, { left: -9, right: 9, top: 9, bottom: -9 });
  scene.add(key, key.target);

  const built = new Map<Style, Built>();
  built.set('current', buildCurrent(kit, lib));
  built.set('voxel', buildVoxel(lib));
  for (const b of built.values()) scene.add(b.root);
  void buildKaykit(base).then((b) => { built.set('kaykit', b); scene.add(b.root); show(style); });

  const cam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.1, 200);
  const elev = (45 * Math.PI) / 180, centre = new THREE.Vector3(W / 2 + 0.5, 0, D / 2 + 0.8);
  cam.position.set(centre.x, Math.sin(elev) * 40, centre.z + Math.cos(elev) * 40);
  cam.lookAt(centre);
  const pixel = new PixelPass(renderer, 2);
  let dot = false;
  let style: Style = (new URLSearchParams(location.search).get('style') as Style | null) ?? 'current';

  const bar = document.createElement('div');
  bar.className = 'style-bar';
  bar.style.cssText = 'position:fixed;top:12px;left:50%;transform:translateX(-50%);display:flex;gap:6px;z-index:5;font:14px monospace';
  root.appendChild(bar);
  const draw = (): void => {
    const btn = (k: string, label: string, on: boolean) => `<button type="button" data-k="${k}" style="padding:6px 12px;background:${on ? '#5fe08a' : '#0a140c'};color:${on ? '#04140a' : '#5fe08a'};border:1px solid #5fe08a;font:inherit">${label}</button>`;
    bar.innerHTML = STYLES.map(([k, label], i) => btn(k, `${i + 1} ${label}`, style === k)).join('') + btn('dot', 'D 도트', dot);
  };
  const show = (s: Style): void => {
    style = s;
    for (const [k, b] of built) b.root.visible = k === s;
    draw();
  };
  bar.addEventListener('click', (e) => {
    const k = (e.target as HTMLElement).closest<HTMLElement>('[data-k]')?.dataset.k;
    if (k === 'dot') { dot = !dot; draw(); } else if (k) show(k as Style);
  });
  addEventListener('keydown', (e) => {
    const n = Number(e.key);
    if (n >= 1 && n <= 3) show(STYLES[n - 1]![0]);
    if (e.key === 'd' || e.key === 'D') { dot = !dot; draw(); }
  });
  const fit = (): void => {
    const w = innerWidth, h = innerHeight, aspect = w / h;
    // the whole room fits the narrow side, so a phone held upright sees it all too
    const half = Math.max(4.6, (W / 2 + 1.2) / aspect);
    renderer.setSize(w, h);
    Object.assign(cam, { left: -half * aspect, right: half * aspect, top: half, bottom: -half });
    cam.updateProjectionMatrix();
  };
  addEventListener('resize', fit);
  fit();
  show(style);
  let last = performance.now();
  const frame = (now: number): void => {
    const dt = Math.max(0, Math.min(0.05, (now - last) / 1000));
    last = now;
    built.get(style)?.update(dt);
    if (dot) pixel.render(scene, cam); else renderer.render(scene, cam);
    requestAnimationFrame(frame);
  };
  requestAnimationFrame(frame);
}
