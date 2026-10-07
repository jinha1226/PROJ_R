import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { blast, drawPos, newProbe, tickProbe, type Mode, type Probe } from '../../sim/raid/hordeProbe';

/**
 * `?demo=horde` (probe): a horde flowing on a base map, to choose by eye between fodder on the grid (four to a cell) and
 * fodder in free coordinates. Click the ground to drop a blast.
 */
const MAX = 800;
const CSS = `
.horde-ui{position:fixed;left:12px;top:12px;font:13px/1.5 monospace;color:#b8ffcf;background:rgba(4,12,8,.82);border:1px solid #2f6b47;padding:8px 10px;z-index:5}
.horde-ui button{font:inherit;color:#b8ffcf;background:#0b2016;border:1px solid #2f6b47;padding:3px 8px;margin:0 4px 4px 0;cursor:pointer}
.horde-ui button.on{background:#2f6b47;color:#041008}
`;

/** a small goblin: a body, a head, two ears (one geometry, drawn once per fodder) */
function goblinGeometry(): THREE.BufferGeometry {
  const body = new THREE.CylinderGeometry(0.1, 0.14, 0.32, 6).translate(0, 0.16, 0);
  const head = new THREE.SphereGeometry(0.11, 8, 6).translate(0, 0.42, 0.02);
  const earL = new THREE.ConeGeometry(0.04, 0.12, 4).rotateZ(Math.PI / 2.4).translate(-0.12, 0.45, 0);
  const earR = new THREE.ConeGeometry(0.04, 0.12, 4).rotateZ(-Math.PI / 2.4).translate(0.12, 0.45, 0);
  const blade = new THREE.BoxGeometry(0.03, 0.03, 0.22).translate(0.13, 0.22, 0.1);
  return mergeGeometries([body, head, earL, earR, blade].map((g) => g.toNonIndexed()))!;
}

export function hordeDemo(root: HTMLElement): void {
  const style = document.createElement('style'); style.textContent = CSS; document.head.appendChild(style);
  const renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setPixelRatio(Math.min(2, devicePixelRatio)); renderer.setSize(innerWidth, innerHeight);
  root.innerHTML = ''; root.appendChild(renderer.domElement);
  const scene = new THREE.Scene(); scene.background = new THREE.Color('#0b0f0d'); scene.fog = new THREE.Fog('#0b0f0d', 40, 90);
  const camera = new THREE.PerspectiveCamera(42, innerWidth / innerHeight, 0.1, 200);
  scene.add(new THREE.HemisphereLight('#9fb8c8', '#2a2018', 0.9));
  const sun = new THREE.DirectionalLight('#ffe2b8', 1.4); sun.position.set(-20, 40, 18); scene.add(sun);

  let p: Probe = newProbe('grid', 1, 300);
  const W = p.w, H = p.h;
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(W, H), new THREE.MeshLambertMaterial({ color: '#2a2e24' }));
  ground.rotation.x = -Math.PI / 2; ground.position.set(W / 2, 0, H / 2); scene.add(ground);
  const grid = new THREE.GridHelper(Math.max(W, H), Math.max(W, H), '#3a4234', '#333a2e'); grid.position.set(W / 2, 0.01, H / 2); scene.add(grid);
  const pod = new THREE.Group();
  pod.add(new THREE.Mesh(new THREE.CylinderGeometry(0.9, 1.1, 2.4, 10), new THREE.MeshLambertMaterial({ color: '#c8d4dc' })));
  const ring = new THREE.Mesh(new THREE.TorusGeometry(1.0, 0.08, 6, 24), new THREE.MeshBasicMaterial({ color: '#5ae0ff' })); ring.rotation.x = Math.PI / 2; ring.position.y = 0.9; pod.add(ring);
  pod.position.set(p.pod.x + 0.5, 1.2, p.pod.y + 0.5); scene.add(pod);
  const podLight = new THREE.PointLight('#5ae0ff', 8, 14); podLight.position.set(p.pod.x + 0.5, 3, p.pod.y + 0.5); scene.add(podLight);

  const walls = new THREE.InstancedMesh(new THREE.BoxGeometry(0.98, 1.1, 0.98).translate(0, 0.55, 0), new THREE.MeshLambertMaterial({ color: '#8a8478' }), W * H);
  scene.add(walls);
  const foes = new THREE.InstancedMesh(goblinGeometry(), new THREE.MeshLambertMaterial({ color: '#ffffff' }), MAX);
  // the instances move every frame: never cull the batch by its first bounds
  foes.instanceMatrix.setUsage(THREE.DynamicDrawUsage); foes.frustumCulled = false; walls.frustumCulled = false; scene.add(foes);
  const tint = new THREE.Color(), m = new THREE.Matrix4(), q = new THREE.Quaternion(), up = new THREE.Vector3(0, 1, 0), s = new THREE.Vector3(), v = new THREE.Vector3();
  for (let i = 0; i < MAX; i++) { tint.setHSL(0.24 + ((i * 37) % 10) / 100, 0.45, 0.32 + ((i * 13) % 7) / 60); foes.setColorAt(i, tint); }
  const facing = new Float32Array(MAX * 2);

  // the blasts: a flash ring that grows and fades
  const blasts: { mesh: THREE.Mesh; t: number }[] = [];
  const boom = (x: number, y: number) => {
    const mesh = new THREE.Mesh(new THREE.RingGeometry(0.2, 0.45, 32), new THREE.MeshBasicMaterial({ color: '#ffb04a', transparent: true, side: THREE.DoubleSide }));
    mesh.rotation.x = -Math.PI / 2; mesh.position.set(x, 0.05, y); scene.add(mesh); blasts.push({ mesh, t: 0 });
  };

  // camera: drag pans, the wheel zooms
  const look = new THREE.Vector3(W / 2, 0, H / 2 + 2); let zoom = 28;
  const place = () => { camera.position.set(look.x, zoom * 0.95, look.z + zoom * 0.62); camera.lookAt(look); };
  let drag: { x: number; y: number; moved: boolean } | null = null;
  renderer.domElement.addEventListener('pointerdown', (e) => { drag = { x: e.clientX, y: e.clientY, moved: false }; });
  addEventListener('pointermove', (e) => { if (!drag) return; const dx = e.clientX - drag.x, dy = e.clientY - drag.y; if (Math.abs(dx) + Math.abs(dy) > 4) drag.moved = true; if (drag.moved) { look.x -= dx * zoom * 0.0015; look.z -= dy * zoom * 0.0015; drag.x = e.clientX; drag.y = e.clientY; } });
  const ray = new THREE.Raycaster(), ndc = new THREE.Vector2();
  addEventListener('pointerup', (e) => {
    if (drag && !drag.moved) {
      ndc.set((e.clientX / innerWidth) * 2 - 1, -(e.clientY / innerHeight) * 2 + 1); ray.setFromCamera(ndc, camera);
      const hit = ray.intersectObject(ground)[0]; if (hit) { blast(p, hit.point.x, hit.point.z, 2); boom(hit.point.x, hit.point.z); }
    }
    drag = null;
  });
  renderer.domElement.addEventListener('wheel', (e) => { zoom = Math.max(12, Math.min(60, zoom * (e.deltaY > 0 ? 1.1 : 0.9))); e.preventDefault(); }, { passive: false });
  addEventListener('resize', () => { renderer.setSize(innerWidth, innerHeight); camera.aspect = innerWidth / innerHeight; camera.updateProjectionMatrix(); });

  const ui = document.createElement('div'); ui.className = 'horde-ui'; document.body.appendChild(ui);
  let speed = 1, count = 300;
  const restart = (mode: Mode) => { p = newProbe(mode, Date.now() % 1000, count); facing.fill(0); draw(); };
  const draw = () => {
    ui.innerHTML = `<div><button data-m="grid" class="${p.mode === 'grid' ? 'on' : ''}">A 격자 4마리</button><button data-m="free" class="${p.mode === 'free' ? 'on' : ''}">B 자유 좌표</button></div>`
      + `<div>${[100, 300, 600].map((n) => `<button data-n="${n}" class="${count === n ? 'on' : ''}">${n}</button>`).join('')}<button data-s="1" class="${speed === 1 ? 'on' : ''}">1×</button><button data-s="2" class="${speed === 2 ? 'on' : ''}">2×</button></div>`
      + `<div id="horde-stat"></div><div>클릭: 폭발 · 드래그: 이동 · 휠: 확대</div>`;
  };
  ui.addEventListener('click', (e) => {
    const b = (e.target as HTMLElement).closest('button'); if (!b) return;
    if (b.dataset.m) restart(b.dataset.m as Mode);
    if (b.dataset.n) { count = Number(b.dataset.n); restart(p.mode); }
    draw();
    if (b.dataset.s) { speed = Number(b.dataset.s); draw(); }
  });
  draw();

  let last = performance.now(), fps = 60, simMs = 0;
  const frame = (now: number) => {
    const dt = Math.min(0.05, (now - last) / 1000); last = now; fps = fps * 0.95 + (1 / Math.max(dt, 1e-3)) * 0.05;
    const t0 = performance.now(); for (let k = 0; k < speed; k++) tickProbe(p, dt); simMs = simMs * 0.9 + (performance.now() - t0) * 0.1;
    let n = 0;
    for (let c = 0; c < W * H; c++) if (p.walls[c]! > 0) {
      const h = 0.4 + 0.6 * (p.walls[c]! / 24); m.compose(v.set((c % W) + 0.5, 0, ((c / W) | 0) + 0.5), q.identity(), s.set(1, h, 1)); walls.setMatrixAt(n++, m);
    }
    walls.count = n; walls.instanceMatrix.needsUpdate = true;
    n = 0;
    for (const f of p.units) {
      if (n >= MAX) break;
      const at = drawPos(p, f), i = f.id % MAX;
      // face where it is heading (smoothed), bob while it walks
      const hx = p.mode === 'free' ? f.vx : f.x - f.fromX, hy = p.mode === 'free' ? f.vy : f.y - f.fromY;
      if (Math.hypot(hx, hy) > 0.01) { facing[i * 2] = facing[i * 2]! * 0.8 + hx * 0.2; facing[i * 2 + 1] = facing[i * 2 + 1]! * 0.8 + hy * 0.2; }
      const yaw = Math.atan2(facing[i * 2]!, facing[i * 2 + 1]!), bob = at.moving ? Math.abs(Math.sin(p.time * 11 + f.phase)) * 0.07 : 0;
      m.compose(v.set(at.x, bob, at.y), q.setFromAxisAngle(up, yaw), s.set(1.5, 1.5, 1.5));
      foes.setMatrixAt(n, m); tint.setHSL(0.24 + (f.id % 10) / 100, 0.45, 0.32 + (f.id % 7) / 60); foes.setColorAt(n, tint); n++;
    }
    foes.count = n; foes.instanceMatrix.needsUpdate = true; if (foes.instanceColor) foes.instanceColor.needsUpdate = true;
    for (const b of blasts) { b.t += dt; b.mesh.scale.setScalar(1 + b.t * 9); (b.mesh.material as THREE.MeshBasicMaterial).opacity = Math.max(0, 1 - b.t * 2.2); }
    for (const b of blasts.filter((x) => x.t > 0.5)) { scene.remove(b.mesh); b.mesh.geometry.dispose(); }
    blasts.splice(0, blasts.length, ...blasts.filter((x) => x.t <= 0.5));
    ring.rotation.z += dt; place();
    const stat = document.getElementById('horde-stat');
    if (stat) stat.textContent = `남은 ${p.units.length + p.queue.length} · 포드 공격 ${p.units.filter((u) => u.atPod).length} · 처치 ${p.killed} · ${fps.toFixed(0)}fps · 계산 ${simMs.toFixed(2)}ms`;
    renderer.render(scene, camera);
    requestAnimationFrame(frame);
  };
  requestAnimationFrame(frame);
}
