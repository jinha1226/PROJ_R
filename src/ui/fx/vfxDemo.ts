import * as THREE from 'three';
import { PRESETS, Vfx, type VfxKind } from '../../view/fx/vfx';
import { UalActor, type UalLibrary } from '../../view/grid/ualActor';
import { lookOf } from '../party/partyPick';

const KINDS = Object.keys(PRESETS) as VfxKind[];
const COLS = 6;
const GAP = 2.6;

/** `?demo=vfx`: every effect on loop beside a dressed figure, seen from the game's camera, for tuning. */
export function mountVfxDemo(root: HTMLElement, lib: UalLibrary, vfx: Vfx): void {
  const renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.2;
  root.replaceChildren(renderer.domElement);
  const scene = new THREE.Scene();
  scene.background = new THREE.Color('#0c0b0a');
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(40, 20), new THREE.MeshStandardMaterial({ color: '#4a3e34', roughness: 0.9 }));
  floor.rotation.x = -Math.PI / 2;
  scene.add(floor, new THREE.HemisphereLight('#c8d0ff', '#2a2018', 0.9), vfx.root);
  const lamp = new THREE.DirectionalLight('#ffd8a8', 1.6);
  lamp.position.set(-4, 8, 6);
  scene.add(lamp);
  const rows = Math.ceil(KINDS.length / COLS);
  const spots = KINDS.map((k, i) => new THREE.Vector3((i % COLS - (COLS - 1) / 2) * GAP, 0, (Math.floor(i / COLS) - (rows - 1) / 2) * GAP * 1.2));
  const actors = spots.map((p, i) => {
    // each class with its own weapon, turned side-on to the camera so held weapons read in profile
    const [cls, weapon] = ([['warrior', 'swordShield'], ['archer', 'longbow'], ['mage', 'staff'], ['cleric', 'mace'], ['rogue', 'daggers']] as const)[i % 5]!;
    const a = new UalActor(lib, lookOf(cls, weapon));
    a.root.position.set(p.x - 0.7, 0, p.z);
    a.root.rotation.y = Math.PI / 2;
    scene.add(a.root);
    return a;
  });
  const labels = document.createElement('div');
  labels.style.cssText = 'position:fixed;inset:0;z-index:5;pointer-events:none;font:12px monospace;color:#9fe8b0';
  root.appendChild(labels);
  const cam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.1, 200);
  const elev = (45 * Math.PI) / 180;
  cam.position.set(0, Math.sin(elev) * 40, Math.cos(elev) * 40);
  cam.lookAt(0, 0, 0);
  const fit = (): void => {
    const w = innerWidth, h = innerHeight, half = 5.2;
    renderer.setSize(w, h);
    Object.assign(cam, { left: -half * (w / h), right: half * (w / h), top: half, bottom: -half });
    cam.updateProjectionMatrix();
    labels.innerHTML = spots.map((p, i) => {
      const s = p.clone().add(new THREE.Vector3(0, 0, 0.7)).project(cam);
      return `<span style="position:absolute;left:${((s.x + 1) / 2) * w}px;top:${((1 - s.y) / 2) * h}px;transform:translateX(-50%)">${KINDS[i]}</span>`;
    }).join('');
  };
  addEventListener('resize', fit);
  fit();
  // `&at=0.2`: fire once and hold the frame 0.2 s in (for stills)
  const hold = Number(new URLSearchParams(location.search).get('at')) || 0;
  if (hold) {
    KINDS.forEach((k, i) => vfx.fire(k, spots[i]!));
    for (let t = 0; t < hold; t += 1 / 60) vfx.update(1 / 60);
    renderer.render(scene, cam);
    return;
  }
  let last = performance.now(), clock = 0, beat = 0;
  const frame = (now: number): void => {
    const dt = Math.max(0, Math.min(0.05, (now - last) / 1000));
    last = now;
    clock += dt;
    if (clock >= beat) { beat = clock + 1.6; KINDS.forEach((k, i) => vfx.fire(k, spots[i]!)); for (const a of actors) a.play('hit'); }
    vfx.update(dt);
    for (const a of actors) a.update(dt);
    renderer.render(scene, cam);
    requestAnimationFrame(frame);
  };
  requestAnimationFrame(frame);
}
