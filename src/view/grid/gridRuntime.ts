import * as THREE from 'three';
import type { GridSim } from '../../sim/grid/gridSim';
import { archerCanShoot } from '../../sim/grid/ai';
import { idx, type Cell, type GEvent } from '../../sim/grid/types';
import type { AssetLibrary } from '../actors/assets';
import type { EnvLibrary } from '../explore/envAssets';
import { createScene, type SceneHandle } from '../scene/renderer';
import { chase } from './chase';
import { GridActors } from './gridActors';
import { GridFx } from './gridFx';
import { CELL, GridTerrain } from './gridTerrain';
import { Playback } from './playback';

const ELEVATION = (60 * Math.PI) / 180;
const CAM_DIST = 40;
const CAM_K = 8;

/** Draws a grid sortie: the map, models chasing their cells, and each turn's events replayed as a quick overlapping show. */
export class GridRuntime {
  private readonly h: SceneHandle;
  private readonly terrain: GridTerrain;
  private readonly actors: GridActors;
  private readonly fx: GridFx;
  private readonly playback = new Playback();
  private readonly light = new THREE.PointLight('#ffcf8a', 30, 11, 1.6);
  private readonly center = new THREE.Vector3();
  private readonly pending = new Map<string, { ready: boolean; queue: GEvent[] }>();
  private height = 18;
  private clock = 0;

  constructor(private readonly el: HTMLElement, private readonly sim: GridSim, lib: AssetLibrary, env: EnvLibrary, mobile: boolean, private readonly onCue: (e: GEvent) => void = () => undefined) {
    this.h = createScene(el);
    if (mobile) { this.h.renderer.shadowMap.enabled = false; this.h.renderer.setPixelRatio(1); }
    const scene = this.h.scene;
    scene.background = new THREE.Color('#0b0b0e');
    scene.fog = null;
    const hemi = new THREE.HemisphereLight('#c8c0b0', '#201c18', 1.1);
    const sun = new THREE.DirectionalLight('#fff0d8', 1.2);
    sun.position.set(-10, 30, 14);
    scene.add(hemi, sun, this.light);
    this.terrain = new GridTerrain(sim.s.map, env);
    this.actors = new GridActors(lib);
    scene.add(this.terrain.root, this.actors.root);
    this.fx = new GridFx(scene, el, (p) => this.project(p));
    this.actors.sync(sim.s);
    const hp = sim.s.hero.pos;
    this.center.set(hp.x * CELL, 0, hp.y * CELL);
    this.refresh();
  }

  private project(p: THREE.Vector3): { left: number; top: number } {
    const v = p.clone().project(this.h.camera);
    return { left: ((v.x + 1) / 2) * this.el.clientWidth, top: ((1 - v.y) / 2) * this.el.clientHeight };
  }

  /** A new turn's events: hurry the last show, queue this one, and update what is seen. */
  apply(events: GEvent[], startTime: number): void {
    this.playback.hurry();
    this.playback.push(events, startTime);
    this.actors.sync(this.sim.s);
    this.refresh();
  }

  hurry(): void {
    this.playback.hurry();
  }

  get busy(): boolean {
    return this.playback.busy;
  }

  /** Sight shading, which foes show, aim lines and intent marks. */
  private refresh(): void {
    const s = this.sim.s;
    this.terrain.shade(s);
    for (const f of s.foes) this.actors.setVisible(f.id, s.visible.has(idx(s.map, f.pos)) || (!f.alive && s.seen[idx(s.map, f.pos)] === 1));
    const hero = new THREE.Vector3(s.hero.pos.x * CELL, 0, s.hero.pos.y * CELL);
    const shown = s.foes.filter((f) => f.alive && f.awake && s.visible.has(idx(s.map, f.pos)));
    const aiming = shown.filter((f) => f.kind === 'archer' && archerCanShoot(s, f));
    this.fx.setAim(aiming.map((f) => [new THREE.Vector3(f.pos.x * CELL, 0, f.pos.y * CELL), hero]));
    this.icons = shown.map((f) => ({ id: f.id, icon: aiming.includes(f) ? '◎' : '!' }));
  }

  private icons: { id: string; icon: string }[] = [];

  private cue(e: GEvent): void {
    const a = this.actors;
    const at = (id?: string) => (id ? a.pos(id) : undefined);
    const key = `${e.src}>${e.dst}`;
    const shot = this.pending.get(key);
    if (shot && !shot.ready && (e.type === 'hit' || e.type === 'miss' || e.type === 'die')) { shot.queue.push(e); return; }
    switch (e.type) {
      case 'move': if (e.to) a.moveTo(e.src, e.to.x, e.to.y); break;
      case 'bump': {
        const p = at(e.dst);
        if (p) { a.lunge(e.src, p); const from = at(e.src)!; this.fx.transient.slash(p.x, p.z, Math.atan2(p.z - from.z, p.x - from.x)); }
        break;
      }
      case 'shoot': {
        const p = at(e.dst);
        const from = at(e.src);
        if (!p || !from) break;
        a.shoot(e.src, p, e.src !== 'hero');
        const entry = { ready: false, queue: [] as GEvent[] };
        this.pending.set(key, entry);
        this.fx.bolt(from, p, () => { entry.ready = true; this.pending.delete(key); for (const q of entry.queue) this.cue(q); });
        break;
      }
      case 'hit': {
        const p = at(e.dst);
        a.hurt(e.dst, at(e.src));
        if (p) this.fx.number(`${e.amount}${e.crit ? '!' : ''}`, e.crit ? 'crit' : e.dst === 'hero' ? 'ally-hurt' : 'dmg', p);
        this.fx.hitStop();
        if (e.crit || e.dst === 'hero') this.fx.shake(e.crit ? 0.14 : 0.1, e.crit ? 0.22 : 0.14);
        break;
      }
      case 'miss': {
        const p = at(e.dst);
        if (p) { this.fx.number('빗나감', 'miss', p); this.fx.transient.burst(p.x, p.z, '#b8a890', 0.35, 0.3); }
        break;
      }
      case 'die': a.die(e.dst); break;
      case 'door': if (e.to) this.terrain.openDoor(idx(this.sim.s.map, e.to)); break;
      case 'open': if (e.to) { this.terrain.openChest(idx(this.sim.s.map, e.to)); this.fx.transient.burst(e.to.x * CELL, e.to.y * CELL, '#ffd76a', 0.7, 0.5); } break;
      case 'loot': if (e.to) this.fx.number(e.text === '볼트' || e.text === '물약' ? `+${e.text} ${e.amount}` : `+${e.text} ${e.amount}G`, 'combo', cellVec(e.to)); break;
      case 'heal': { const p = at(e.dst); if (p) this.fx.number(`+${e.amount}`, 'heal', p); break; }
      case 'wake': { const p = at(e.src); if (p) this.fx.number('!', 'crit', p); break; }
      default: break;
    }
    this.onCue(e);
  }

  update(dt: number): void {
    this.clock += dt;
    for (const e of this.playback.update(this.fx.frozen ? 0 : dt)) this.cue(e);
    this.fx.update(dt);
    this.actors.update(dt, this.fx.frozen);
    const hero = this.actors.pos('hero') ?? this.center;
    this.center.x = chase(this.center.x, hero.x, dt, CAM_K);
    this.center.z = chase(this.center.z, hero.z, dt, CAM_K);
    this.light.position.set(hero.x, 2.6, hero.z);
    if (this.sim.s.hero.exitTime > 0) this.terrain.pulseExit(this.clock);
    this.placeCamera();
    this.fx.setIcons(this.icons.map((i) => ({ ...i, at: this.actors.pos(i.id) ?? new THREE.Vector3() })));
    this.h.renderer.render(this.h.scene, this.h.camera);
  }

  private placeCamera(): void {
    const cam = this.h.camera;
    const aspect = (cam.userData.aspect as number | undefined) ?? 9 / 16;
    const half = this.height / 2;
    Object.assign(cam, { left: -half * aspect, right: half * aspect, top: half, bottom: -half });
    cam.updateProjectionMatrix();
    const c = this.center.clone().add(this.fx.jolt());
    cam.position.set(c.x, Math.sin(ELEVATION) * CAM_DIST, c.z + Math.cos(ELEVATION) * CAM_DIST);
    cam.lookAt(c);
  }

  setZoom(h: number): void {
    this.height = h;
  }

  get zoom(): number {
    return this.height;
  }

  /** The grid cell under a screen point (null off the map). */
  cellAt(clientX: number, clientY: number): Cell | null {
    const r = this.el.getBoundingClientRect();
    const ndc = new THREE.Vector2(((clientX - r.left) / r.width) * 2 - 1, -((clientY - r.top) / r.height) * 2 + 1);
    const ray = new THREE.Raycaster();
    ray.setFromCamera(ndc, this.h.camera);
    const hit = ray.ray.intersectPlane(new THREE.Plane(new THREE.Vector3(0, 1, 0), 0), new THREE.Vector3());
    if (!hit) return null;
    const c = { x: Math.round(hit.x / CELL), y: Math.round(hit.z / CELL) };
    const m = this.sim.s.map;
    return c.x >= 0 && c.y >= 0 && c.x < m.w && c.y < m.h ? c : null;
  }

  dispose(): void {
    this.actors.dispose();
    this.fx.dispose();
    this.terrain.dispose();
    this.h.dispose();
  }
}

const cellVec = (c: Cell): THREE.Vector3 => new THREE.Vector3(c.x * CELL, 0, c.y * CELL);
