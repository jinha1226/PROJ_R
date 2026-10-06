import * as THREE from 'three';
import { CLASSES, type ClassId } from '../../sim/party/partyDefs';
import { UalActor, type UalLibrary } from '../../view/grid/ualActor';
import { DOT_LOOK, markFigure, PixelPass } from '../../view/grid/pixelPass';
import { loadStone, stoneMat } from '../../view/grid/stoneMats';
import { lookOf } from './partyPick';

/** each class with its first weapon, the empty body first */
const LINEUP: ClassId[] = ['shell', 'warrior', 'archer', 'mage', 'cleric', 'rogue'];
const GAP = 1.6;

/** `?demo=looks`: every class side by side on a stone floor by torchlight, through the game's own dot look. */
export function mountLooksDemo(root: HTMLElement, lib: UalLibrary, base: string): void {
  const renderer = new THREE.WebGLRenderer({ antialias: false });
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  root.replaceChildren(renderer.domElement);
  const scene = new THREE.Scene();
  scene.background = new THREE.Color('#05070a');
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(14, 6), stoneMat(loadStone(base, 'floor'), 2, 'floor'));
  floor.rotation.x = -Math.PI / 2;
  scene.add(floor, new THREE.HemisphereLight('#8090b0', '#1a1410', 0.35));
  for (const x of [-3.5, 3.5]) { const torch = new THREE.PointLight('#ffb060', 22, 9, 1.6); torch.position.set(x, 2.2, -1.2); scene.add(torch); }
  const labels = document.createElement('div');
  labels.style.cssText = "position:fixed;inset:0;pointer-events:none;font:11px 'GalmuriMono',monospace;color:#9fe8b0";
  root.appendChild(labels);
  const spots = LINEUP.map((_, i) => new THREE.Vector3((i - (LINEUP.length - 1) / 2) * GAP, 0, 0));
  const actors = LINEUP.map((cls, i) => {
    const look = lookOf(cls, CLASSES[cls].weapons[0]!), a = new UalActor(lib, look);
    a.root.position.copy(spots[i]!);
    a.root.rotation.y = 0.5;
    markFigure(a.root, look.ring ?? '#c0cbdc');
    scene.add(a.root);
    return a;
  });
  const cam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.1, 200);
  const elev = (50 * Math.PI) / 180;
  cam.position.set(0, Math.sin(elev) * 40, Math.cos(elev) * 40);
  cam.lookAt(0, 0.6, 0);
  const pixel = new PixelPass(renderer, 2, DOT_LOOK);
  const fit = (): void => {
    const w = innerWidth, h = innerHeight, half = 2.2;
    renderer.setSize(w, h);
    Object.assign(cam, { left: -half * (w / h), right: half * (w / h), top: half, bottom: -half });
    cam.updateProjectionMatrix();
    placed = false;
  };
  // names under the figures, placed after a frame has set the camera up
  let placed = false;
  const place = (): void => {
    const w = innerWidth, h = innerHeight;
    labels.innerHTML = spots.map((p, i) => {
      const s = p.clone().add(new THREE.Vector3(0, 0, 0.8)).project(cam);
      return `<span style="position:absolute;left:${((s.x + 1) / 2) * w}px;top:${((1 - s.y) / 2) * h}px;transform:translateX(-50%)">${CLASSES[LINEUP[i]!].name}</span>`;
    }).join('');
    placed = true;
  };
  addEventListener('resize', fit);
  fit();
  let last = performance.now();
  const frame = (now: number): void => {
    const dt = Math.max(0, Math.min(0.05, (now - last) / 1000));
    last = now;
    for (const a of actors) a.update(dt);
    pixel.render(scene, cam);
    if (!placed) place();
    requestAnimationFrame(frame);
  };
  requestAnimationFrame(frame);
}
