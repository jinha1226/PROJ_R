import * as THREE from 'three';
import { CLASSES, WEAPONS, type ClassId, type WeaponId } from '../../sim/party/partyDefs';
import { UalActor, type UalAnim, type UalLibrary } from '../../view/grid/ualActor';
import { DOT_LOOK, markFigure, PixelPass } from '../../view/grid/pixelPass';
import { TUNE, type HeldTune } from '../../view/grid/figureTune';
import { lookOf } from '../party/partyPick';

/**
 * `?demo=tune`: one figure to set by hand — where each weapon sits in the hand (offset, turn, size), the off hand's
 * dagger, and each class's height and build. 저장 writes `src/data/figureTune.json` through `npm run dev`; elsewhere it
 * downloads the file instead.
 */
const LINE: ClassId[] = ['shell', 'warrior', 'archer', 'mage', 'cleric', 'rogue', 'necromancer'];
/** one weapon per look (the tune is per look) */
const GEAR = Object.entries(WEAPONS).filter(([, w]) => w.look !== 'none').filter(([, w], i, all) => all.findIndex(([, o]) => o.look === w.look) === i).map(([id]) => id as WeaponId);
const MOVES: [string, UalAnim][] = [['서기', 'idle'], ['달리기', 'run'], ['휘두르기', 'swing'], ['찌르기', 'jab'], ['사격', 'shoot'], ['활', 'shootBow'], ['시전', 'cast'], ['피격', 'hit']];
const CSS = `
.tune-ui{position:fixed;left:10px;top:10px;bottom:10px;width:300px;overflow:auto;font:12px/1.5 'Galmuri',monospace;color:#9dffb8;background:#03140af0;border:1px solid #1f7a3e;padding:8px 10px;z-index:5}
.tune-ui h3{margin:8px 0 4px;color:#e6ffb0;font-size:12px;letter-spacing:.15em}
.tune-ui button{font:inherit;color:#9dffb8;background:#062012;border:1px solid #1f7a3e;padding:2px 6px;margin:0 3px 3px 0;cursor:pointer}
.tune-ui button.on{background:#1f7a3e;color:#021006}
.tune-ui label{display:grid;grid-template-columns:52px 1fr 56px;gap:6px;align-items:center}
.tune-ui input[type=range]{width:100%}
.tune-ui input[type=number]{width:56px;font:inherit;color:#e6ffb0;background:#021006;border:1px solid #1f7a3e}
.tune-ui .note{color:#e6ffb0}
`;

export function mountTuneDemo(root: HTMLElement, lib: UalLibrary): void {
  const style = document.createElement('style'); style.textContent = CSS; document.head.appendChild(style);
  const renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.outputColorSpace = THREE.SRGBColorSpace; renderer.toneMapping = THREE.ACESFilmicToneMapping;
  root.replaceChildren(renderer.domElement);
  const scene = new THREE.Scene(); scene.background = new THREE.Color('#0b0f0d');
  scene.add(new THREE.HemisphereLight('#a0b0c8', '#201810', 0.9));
  const key = new THREE.DirectionalLight('#ffe2b8', 1.6); key.position.set(-3, 6, 4); scene.add(key);
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(6, 6), new THREE.MeshLambertMaterial({ color: '#2a2e24' })); floor.rotation.x = -Math.PI / 2; scene.add(floor);
  // the one cell a figure stands in, to judge sizes against the grid
  const cell = new THREE.LineSegments(new THREE.EdgesGeometry(new THREE.PlaneGeometry(1, 1)), new THREE.LineBasicMaterial({ color: '#5dff8a' })); cell.rotation.x = -Math.PI / 2; cell.position.y = 0.01; scene.add(cell);
  const cam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.1, 100);
  const pixel = new PixelPass(renderer, 2, DOT_LOOK);
  let zoom = 1.6, dot = false, yaw = 0.6;
  const fit = () => { const w = innerWidth, h = innerHeight; renderer.setSize(w, h); Object.assign(cam, { left: -zoom * (w / h), right: zoom * (w / h), top: zoom, bottom: -zoom }); cam.updateProjectionMatrix(); };
  const elev = (45 * Math.PI) / 180; cam.position.set(0, Math.sin(elev) * 20, Math.cos(elev) * 20); cam.lookAt(0, 0.7, 0);
  addEventListener('resize', fit); fit();
  renderer.domElement.addEventListener('wheel', (e) => { zoom = Math.max(0.6, Math.min(4, zoom * (e.deltaY > 0 ? 1.1 : 0.9))); fit(); e.preventDefault(); }, { passive: false });
  let drag: number | null = null;
  renderer.domElement.addEventListener('pointerdown', (e) => { drag = e.clientX; });
  addEventListener('pointermove', (e) => { if (drag === null) return; yaw += (e.clientX - drag) * 0.01; drag = e.clientX; });
  addEventListener('pointerup', () => { drag = null; });

  let cls: ClassId = 'warrior', weapon: WeaponId = CLASSES.warrior.weapons[0]!, move: UalAnim = 'idle', actor: UalActor | null = null, again = 0;
  const build = () => {
    if (actor) scene.remove(actor.root);
    const look = lookOf(cls, weapon);
    actor = new UalActor(lib, look); markFigure(actor.root, look.ring ?? '#c0cbdc'); scene.add(actor.root);
    actor.play(move); again = 1.6;
  };
  let pending = false;
  const rebuild = () => { if (pending) return; pending = true; requestAnimationFrame(() => { pending = false; build(); }); };

  const ui = document.createElement('div'); ui.className = 'tune-ui'; document.body.appendChild(ui);
  const look = () => WEAPONS[weapon].look as string, off = () => (lookOf(cls, weapon).off as string | undefined);
  const row = (path: string, label: string, v: number, min: number, max: number, step: number) =>
    `<label><span>${label}</span><input type="range" data-k="${path}" min="${min}" max="${max}" step="${step}" value="${v}"><input type="number" data-k="${path}" step="${step}" value="${v}"></label>`;
  const heldRows = (key: string, t: HeldTune) =>
    ['x', 'y', 'z'].map((a, i) => row(`${key}.pos.${i}`, `위치 ${a}`, t.pos[i]!, -0.4, 0.4, 0.005)).join('')
    + ['x', 'y', 'z'].map((a, i) => row(`${key}.rot.${i}`, `회전 ${a}`, t.rot[i]!, -180, 180, 1)).join('')
    + row(`${key}.scale`, '크기', t.scale, 0.3, 2.5, 0.01);
  const draw = (note = '') => {
    const w = TUNE.weapons[look()], o = off(), body = TUNE.classes[cls]!;
    ui.innerHTML = `<h3>직업</h3>${LINE.map((c) => `<button data-cls="${c}" class="${c === cls ? 'on' : ''}">${CLASSES[c].name}</button>`).join('')}
      <h3>무기</h3>${GEAR.map((g) => `<button data-w="${g}" class="${g === weapon ? 'on' : ''}">${WEAPONS[g].name}</button>`).join('')}
      <h3>동작</h3>${MOVES.map(([n, m]) => `<button data-m="${m}" class="${m === move ? 'on' : ''}">${n}</button>`).join('')}
      <h3>무기 · ${look()}</h3>${w ? heldRows(`weapons.${look()}`, w) : '<p>조정 없음</p>'}
      ${o && TUNE.offhand[o] ? `<h3>보조 손 · ${o}</h3>${heldRows(`offhand.${o}`, TUNE.offhand[o]!)}` : ''}
      <h3>체형 · ${CLASSES[cls].name}</h3>${row(`classes.${cls}.height`, '키', body.height, 0.6, 1.5, 0.01)}${row(`classes.${cls}.girth`, '덩치', body.girth, 0.6, 1.6, 0.01)}
      <h3>보기</h3><button data-dot class="${dot ? 'on' : ''}">도트</button><button data-reset>이 무기 초기화</button>
      <h3>저장</h3><button data-save>저장</button><button data-copy>JSON 복사</button><p class="note">${note}</p>`;
  };
  const setPath = (path: string, v: number) => {
    const parts = path.split('.');
    let o: Record<string, unknown> = TUNE as unknown as Record<string, unknown>;
    for (const p of parts.slice(0, -1)) o = o[p] as Record<string, unknown>;
    (o as Record<string, number>)[parts[parts.length - 1]!] = v;
  };
  ui.addEventListener('input', (e) => {
    const t = e.target as HTMLInputElement, k = t.dataset.k;
    if (!k || Number.isNaN(Number(t.value))) return;
    setPath(k, Number(t.value));
    for (const other of ui.querySelectorAll<HTMLInputElement>(`[data-k="${k}"]`)) if (other !== t) other.value = t.value;
    rebuild();
  });
  ui.addEventListener('click', async (e) => {
    const b = (e.target as HTMLElement).closest('button'); if (!b) return;
    if (b.dataset.cls) { cls = b.dataset.cls as ClassId; weapon = CLASSES[cls].weapons[0]!; build(); }
    if (b.dataset.w) { weapon = b.dataset.w as WeaponId; build(); }
    if (b.dataset.m) { move = b.dataset.m as UalAnim; actor?.play(move); again = 1.6; }
    if (b.hasAttribute('data-dot')) dot = !dot;
    if (b.hasAttribute('data-reset')) { TUNE.weapons[look()] = { pos: [0, 0, 0], rot: [0, 0, 0], scale: 1 }; build(); }
    const json = `${JSON.stringify(TUNE, null, 2)}\n`;
    if (b.hasAttribute('data-copy')) { await navigator.clipboard?.writeText(json).catch(() => undefined); draw('복사됨'); return; }
    if (b.hasAttribute('data-save')) {
      // npm run dev writes the repo's file; a built page downloads it instead
      const ok = await fetch('/__tune', { method: 'POST', body: json }).then((r) => r.ok).catch(() => false);
      if (!ok) { const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([json], { type: 'application/json' })); a.download = 'figureTune.json'; a.click(); }
      draw(ok ? '저장됨 · src/data/figureTune.json' : '파일로 내려받음'); return;
    }
    draw();
  });
  draw(); build();

  let last = performance.now();
  const frame = (now: number) => {
    const dt = Math.min(0.05, (now - last) / 1000); last = now;
    if (actor) {
      actor.root.rotation.y = yaw; actor.update(dt);
      // a one-off move plays again every so often, so the hand can be watched through it
      if (move !== 'idle' && move !== 'run') { again -= dt; if (again <= 0) { actor.play(move); again = 1.6; } }
    }
    if (dot) pixel.render(scene, cam); else renderer.render(scene, cam);
    requestAnimationFrame(frame);
  };
  requestAnimationFrame(frame);
}
