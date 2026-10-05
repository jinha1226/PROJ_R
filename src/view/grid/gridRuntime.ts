import { cellAtScreen, cellVec, shotGroup } from './runtimeHelpers';
import { ShipTerrain } from './shipTerrain';
import { heroLook } from './heroLook';
import { speciesOf } from './species';
import type { ShipKit } from './shipKit';
import type { MetaState } from '../../sim/grid/meta';
import { STATIONS } from '../../sim/grid/ship';
import * as THREE from 'three';
import { zoneOf } from '../../sim/grid/zones';
import { applyZoneLook } from './zoneLook';
import type { GridSim } from '../../sim/grid/gridSim';
import { archerCanShoot } from '../../sim/grid/ai';
import { activeWeapon } from '../../sim/grid/gear';
import { idx, type Cell, type GEvent } from '../../sim/grid/types';
import type { UalLibrary } from './ualActor';
import type { DungeonKit } from './dungeonKit';
import { createScene, type SceneHandle } from '../scene/renderer';
import { chase } from './chase';
import { GridActors } from './gridActors';
import { GridFx } from './gridFx';
import { GridItems } from './gridItems';
import { EngravePops } from './engravePops';
import { buffOn } from '../../sim/grid/buffs';
import { lootText } from './cueText';
import { comboCue, type CueKit } from './comboCues';
import { GridElements } from './gridElements';
import { GridParticles } from './gridParticles';
import { GridTorches } from './gridTorches';
import { CELL, GridTerrain } from './gridTerrain';
import { Playback } from './playback';
import { PixelPass } from './pixelPass';
import { ShipIntro } from './shipIntro';
import { Afterimages } from './afterimage';
import { sensedFoes } from '../../sim/grid/perks';
import { feel } from './feel';
let ELEVATION = (45 * Math.PI) / 180;
/** Scripted views (the comparison demo) may tilt the camera. */
export const setCameraElevation = (deg: number): void => { ELEVATION = (deg * Math.PI) / 180; };
const CAM_DIST = 40;
const CAM_K = 8;
/** Draws a grid sortie: the map, models chasing their cells, and each turn's events replayed as a quick overlapping show. */
export class GridRuntime {
  private readonly h: SceneHandle;
  private terrain: GridTerrain | ShipTerrain;
  actors: GridActors;
  private elements: GridElements;
  private mapRef: GridSim['s']['map'];
  private readonly banner = document.createElement('div');
  readonly fx: GridFx;
  private torches: GridTorches;
  private readonly particles = new GridParticles();
  private readonly items = new GridItems();
  private readonly pops: EngravePops;
  private readonly kit2: CueKit;
  private punch = 0;
  private readonly pixel: PixelPass;
  /** rough pixel look on/off */
  pixelated = true;
  private playback = new Playback();
  private readonly hemi = new THREE.HemisphereLight('#aab0c8', '#1a1410', 0.85);
  private readonly light = new THREE.PointLight('#ffd9a0', 16, 9, 1.4);
  private readonly center = new THREE.Vector3();
  private readonly pending = new Map<string, { ready: boolean; queue: GEvent[] }>();
  private height = 18;
  private clock = 0;
  /** the ship's waking shot and the hatch beacon (ship only) */
  private intro?: ShipIntro;
  private zoomMul = 1;
  /** keep the view inside the map instead of following the hero past its edge (the showcase) */
  stayInMap = false;
  private readonly ghosts = new Afterimages();
  /** dims the screen edge while the game runs slow (an engraving moment) */
  private readonly slowmo = document.createElement('div');
  constructor(private readonly el: HTMLElement, private readonly sim: GridSim, private readonly lib: UalLibrary, private readonly kit: DungeonKit, private readonly mobile: boolean, private readonly onCue: (e: GEvent) => void = () => undefined, theme?: { theme: 'ship'; kit: ShipKit; meta: MetaState }) {
    this.h = createScene(el);
    if (mobile) { this.h.renderer.shadowMap.enabled = false; this.h.renderer.setPixelRatio(1); }
    const scene = this.h.scene;
    scene.background = new THREE.Color('#0b0b0e');
    scene.fog = null;
    const look = applyZoneLook(this.hemi, sim.s.run.floor, mobile);
    const sun = new THREE.DirectionalLight('#9fb0ff', 0.16);
    sun.position.set(-10, 30, 14);
    scene.add(this.hemi, sun, this.light);
    this.pixel = new PixelPass(this.h.renderer, 2);
    if (!theme) kit.tint(look.tint);
    this.terrain = theme ? new ShipTerrain(sim.s.map, theme.kit, theme.meta) : new GridTerrain(sim.s.map, kit, look.decal);
    for (const st of theme ? sim.s.map.stations ?? [] : []) this.stationAt.set(`st-${st.id}`, new THREE.Vector3(st.pos.x * CELL, 0, st.pos.y * CELL));
    if (theme) { this.intro = new ShipIntro(this.stationAt.get('st-pod'), this.stationAt.get('st-hatch'), theme.meta.best === 0); scene.add(this.intro.root); }
    if (theme) { this.hemi.color.set('#b7ddff'); this.hemi.groundColor.set('#162432'); this.hemi.intensity = 0.62; this.light.color.set('#b7eaff'); this.light.intensity = 3; }
    this.actors = new GridActors(lib);
    this.torches = new GridTorches(sim.s.map, kit, look.lights, theme ? 0 : look.density, look);
    this.elements = new GridElements(kit, sim.s);
    this.mapRef = sim.s.map;
    scene.add(this.terrain.root, this.actors.root, this.torches.root, this.particles.root, this.items.root, this.elements.root, this.ghosts.root);
    this.slowmo.className = 'grid-slowmo';
    el.appendChild(this.slowmo);
    this.banner.className = 'grid-banner';
    el.appendChild(this.banner);
    this.fx = new GridFx(scene, el, (p) => this.project(p), mobile ? 1 : 4);
    this.pops = new EngravePops(el);
    this.kit2 = { actors: this.actors, fx: this.fx, particles: this.particles, pops: this.pops, at: (id) => (id ? this.actors.pos(id) : undefined), punch: () => { this.punch = 0.16; }, trail: (id, sec) => { if (id) this.ghosts.trailOf(() => this.actors.figure(id), sec, id === 'hero' ? '#6dffb4' : '#ff8a6a'); } };
    this.actors.sync(sim.s);
    const hp = sim.s.hero.pos;
    this.center.set(hp.x * CELL, 0, hp.y * CELL);
    this.refresh();
  }
  project(p: THREE.Vector3): { left: number; top: number } {
    const v = p.clone().project(this.h.camera);
    return { left: ((v.x + 1) / 2) * this.el.clientWidth, top: ((1 - v.y) / 2) * this.el.clientHeight };
  }
  /** A new turn's events: hurry the last show, queue this one, and update what is seen. */
  apply(events: GEvent[], startTime: number): void {
    if (this.sim.s.map !== this.mapRef) { this.newFloor(); return; }
    this.playback.hurry();
    this.playback.push(events, startTime);
    this.actors.sync(this.sim.s);
    this.refresh();
  }
  /** Down the stairs: rebuild the floor, the figures and the lights; drop what was left of the last show. */
  private newFloor(): void {
    const s = this.sim.s;
    const scene = this.h.scene;
    for (const part of [this.terrain, this.torches, this.elements, this.actors]) { scene.remove(part.root); part.dispose(); }
    const look = applyZoneLook(this.hemi, s.run.floor, this.mobile);
    this.kit.tint(look.tint);
    this.terrain = new GridTerrain(s.map, this.kit, look.decal);
    this.torches = new GridTorches(s.map, this.kit, look.lights, look.density, look);
    this.elements = new GridElements(this.kit, s);
    this.actors = new GridActors(this.lib);
    scene.add(this.terrain.root, this.torches.root, this.elements.root, this.actors.root);
    this.mapRef = s.map;
    this.playback = new Playback();
    this.pending.clear();
    this.actors.sync(s);
    this.center.set(s.hero.pos.x * CELL, 0, s.hero.pos.y * CELL);
    this.banner.textContent = `${s.run.floor}층 · ${zoneOf(s.run.floor).name}`;
    this.banner.classList.remove('on');
    void this.banner.offsetWidth;
    this.banner.classList.add('on');
    this.refresh();
  }
  /** A clone steps out of the pod: start close on it and pull back (any input cuts it short). */
  playIntro(): void {
    if (!this.intro?.pod) return;
    this.intro.start();
    this.fx.transient.burst(this.intro.pod.x, this.intro.pod.z, '#b8ffd0', 1.4, 0.9);
  }
  skipIntro(): void { this.intro?.skip(); }
  powerShip(meta: MetaState): void { if (this.terrain instanceof ShipTerrain) this.terrain.power(meta); }
  showAim(cells: { x: number; y: number }[] | null, ok: boolean): void {
    this.elements.setAim(cells, ok);
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
    if (this.terrain instanceof GridTerrain) this.terrain.syncTiles();
    this.terrain.shade(s);
    this.items.sync(s);
    this.elements.sync(s);
    for (const e of [s.hero, ...s.foes]) this.actors.setStatus(e.id, e.status);
    const g = s.hero.gear;
    this.actors.setWeapon('hero', heroLook(activeWeapon(g)?.group, this.terrain instanceof ShipTerrain), heroLook(g.hands[g.active === 0 ? 1 : 0]?.group, this.terrain instanceof ShipTerrain));
    this.actors.setGhost('hero', buffOn(s.hero, 'invis', s.time));
    this.actors.setSuitLights('hero', s.hero.suit.length);
    this.torches.shade(s, new THREE.Vector3(s.hero.pos.x * CELL, 1, s.hero.pos.y * CELL));
    // a thermal sight shows foes behind walls as faint ghosts
    const sensed = new Set(sensedFoes(s));
    for (const f of s.foes) {
      this.actors.setVisible(f.id, s.visible.has(idx(s.map, f.pos)) || sensed.has(f.id) || (!f.alive && s.seen[idx(s.map, f.pos)] === 1));
      if (f.alive) this.actors.setGhost(f.id, sensed.has(f.id));
    }
    const hero = new THREE.Vector3(s.hero.pos.x * CELL, 0, s.hero.pos.y * CELL);
    const shown = s.foes.filter((f) => f.alive && f.awake && s.visible.has(idx(s.map, f.pos)));
    const aiming = shown.filter((f) => f.kind === 'archer' && archerCanShoot(s, f));
    this.fx.setAim(aiming.map((f) => [new THREE.Vector3(f.pos.x * CELL, 0, f.pos.y * CELL), hero]));
    // on the ship deck the floating labels name the stations instead
    this.icons = this.stationAt.size ? (s.map.stations ?? []).map((st) => ({ id: `st-${st.id}`, icon: STATIONS[st.id] })) : shown.map((f) => ({ id: f.id, icon: aiming.includes(f) ? '◎' : '!' }));
  }
  /** The dead of the crypt shed bone chips; goblins and orcs bleed. */
  private gore(p: THREE.Vector3, n: number, from?: THREE.Vector3): void {
    if (speciesOf(this.sim.s.run.floor) === 'skeleton') this.particles.bones(p, n, from); else this.particles.blood(p, n * 2, from);
  }
  private icons: { id: string; icon: string }[] = [];
  private readonly stationAt = new Map<string, THREE.Vector3>();
  private cue(e: GEvent): void {
    const a = this.actors;
    const at = (id?: string) => (id ? a.pos(id) : undefined);
    const key = `${e.src}>${e.dst}`;
    const shot = this.pending.get(key);
    if (shot && !shot.ready && (e.type === 'hit' || e.type === 'miss' || e.type === 'die')) { shot.queue.push(e); return; }
    if (comboCue({ ...this.kit2, actors: a }, e)) { this.onCue(e); return; }
    switch (e.type) {
      case 'move': if (e.to) a.moveTo(e.src, e.to.x, e.to.y); break;
      case 'bump': {
        const p = at(e.dst);
        if (p) { a.lunge(e.src, p, e.text === 'finisher' ? 'finisher' : undefined, e.group); const from = at(e.src)!; this.fx.transient.slash(p.x, p.z, Math.atan2(p.z - from.z, p.x - from.x)); }
        break;
      }
      case 'shoot': {
        const p = at(e.dst) ?? (e.to ? cellVec(e.to) : undefined);
        // a bounce, a chain jump or a volley's extra bullets fly on their own; the shooter does not draw again
        const quiet = e.text === 'ricochet' || e.text === 'chain' || e.text === 'volley' || e.text === 'burst';
        const from = quiet && e.from ? cellVec(e.from) : at(e.src);
        if (!p || !from) break;
        if (!quiet) a.shoot(e.src, p, shotGroup(e), e.text === 'spin');
        if (e.text === 'execute') this.punch = 0.16;
        if (!e.dst) break;
        const entry = { ready: false, queue: [] as GEvent[] };
        this.pending.set(key, entry);
        const magic = e.text === 'spell';
        const f = feel(), mine = e.src === 'hero';
        this.fx.flash(from, magic ? '#b48aff' : '#ffd890', mine ? f.flash : 22, 0.08);
        if (mine && f.shotKick) this.fx.shake(0.07, f.shotKick);
        this.fx.bolt(from, p, () => { entry.ready = true; if (this.pending.get(key) === entry) this.pending.delete(key); for (const q of entry.queue) this.cue(q); }, mine ? f.bolt : 1);
        break;
      }
      case 'hit': {
        const p = at(e.dst);
        if (e.crit) a.knock(e.dst); else a.hurt(e.dst, at(e.src));
        if (e.crit) a.flashOnly(e.dst);
        if (p) {
          this.fx.number(`${e.amount}${e.crit ? '!' : ''}`, e.crit ? 'crit' : e.dst === 'hero' ? 'ally-hurt' : 'dmg', p);
          this.particles.spray(p, e.dst === 'hero' ? '#ff4a30' : '#ffe6a8', e.crit ? 12 : 6);
          if (e.dst !== 'hero') this.gore(p, e.crit ? 8 : 4, at(e.src));
        }
        this.fx.hitStop(feel().hitStop);
        if (e.dst === 'hero') this.fx.hurt();
        if (e.crit) this.punch = 0.16;
        if (e.crit || e.dst === 'hero') this.fx.shake(e.crit ? 0.14 : 0.1, e.crit ? 0.22 : 0.14);
        break;
      }
      case 'miss': {
        const p = at(e.dst);
        if (p) { this.fx.number('빗나감', 'miss', p); this.fx.transient.burst(p.x, p.z, '#b8a890', 0.35, 0.3); }
        break;
      }
      case 'reload': a.anim(e.src, 'reload'); break;
      case 'die': { a.die(e.dst); const p = at(e.dst); if (p && e.dst !== 'hero') { this.gore(p, 18, at(e.src)); this.fx.hitStop(feel().killStop); } break; }
      case 'door': if (e.to) this.terrain.openDoor(idx(this.sim.s.map, e.to)); break;
      case 'open': a.anim('hero', 'interact'); if (e.to) { this.terrain.openChest(idx(this.sim.s.map, e.to)); this.fx.transient.burst(e.to.x * CELL, e.to.y * CELL, '#ffd76a', 0.7, 0.5); } break;
      case 'energy': if (e.to) this.fx.energy(cellVec(e.to), e.amount ?? 0); break;
      case 'loot': if (e.to) this.fx.number(lootText(e), 'combo', cellVec(e.to)); break;
      case 'stun': a.knock(e.dst); break;
      case 'dodge': a.anim('hero', e.text === 'L' ? 'weaveL' : 'weaveR'); { const p = at('hero'); if (p) this.fx.number('회피', 'miss', p); } break;
      case 'parry': a.anim('hero', 'parry'); { const p = at('hero'); if (p) { this.fx.number('패링!', 'combo', p); this.particles.spray(p, '#e8f0ff', 12); } } break;
      case 'explode': if (e.to) { const p = cellVec(e.to); this.fx.transient.burst(p.x, p.z, '#ffb04a', 1.4, 0.5); this.fx.flash(p, '#ff8a2a', 40, 0.45, 9); this.particles.spray(p, '#ff8a2a', 30); this.fx.shake(0.25, 0.35); this.fx.hitStop(); } break;
      case 'telegraph': { const p = at(e.src); if (p) this.fx.transient.burst(p.x, p.z, e.text === 'frost' ? '#5ab4ff' : '#ff5a3a', 0.6, 0.4); break; }
      case 'levelUp': { const p = at('hero'); if (p) { this.fx.number(`레벨 ${e.amount}!`, 'combo', p); this.fx.transient.glow(p.x, p.z, '#ffd76a'); } break; }
      case 'heal': {
        if (e.text !== 'regen') a.anim(e.dst, 'drink');
        const p = at(e.dst); if (p) this.fx.number(`+${e.amount}`, 'heal', p); break; }
      case 'wake': { const p = at(e.src); if (p) this.fx.number('!', 'crit', p); break; }
      default: break;
    }
    this.onCue(e);
  }
  update(dt: number): void {
    this.clock += dt;
    const scaled = dt * this.fx.timeScale;
    for (const e of this.playback.update(this.fx.frozen ? 0 : scaled)) this.cue(e);
    this.fx.update(dt);
    this.pops.update(dt);
    if (this.terrain instanceof ShipTerrain) this.terrain.update(dt);
    this.actors.update(scaled, this.fx.frozen);
    this.torches.update(dt);
    this.items.update(dt);
    this.elements.update(dt);
    this.ghosts.update(dt);
    this.slowmo.classList.toggle('on', this.fx.timeScale < 1);
    this.particles.update(this.fx.frozen ? 0 : scaled, this.center);
    this.punch = Math.max(0, this.punch - dt);
    const hero = this.actors.pos('hero') ?? this.center;
    // the small ship deck stays framed in the middle; in the dungeon the camera follows the hero
    const deck = new THREE.Vector3(((this.sim.s.map.w - 1) / 2) * CELL, 0, ((this.sim.s.map.h - 1) / 2) * CELL);
    const shot = this.intro?.update(dt);
    this.zoomMul = shot?.zoom ?? 1;
    let aim = shot && this.intro?.pod ? this.intro.pod.clone().lerp(deck, shot.k) : this.stationAt.size ? deck : hero;
    if (shot) { this.center.x = aim.x; this.center.z = aim.z; }
    // a copy: the hero's own position must not be moved by the clamp
    if (this.stayInMap && !this.stationAt.size) aim = this.clampAim(aim.clone());
    this.center.x = chase(this.center.x, aim.x, dt, CAM_K);
    this.center.z = chase(this.center.z, aim.z, dt, CAM_K);
    this.light.position.set(hero.x, 2.6, hero.z);
    if (this.sim.s.hero.exitTime > 0) this.terrain.pulseExit(this.clock);
    this.placeCamera();
    this.fx.setIcons(this.icons.map((i) => ({ ...i, at: this.actors.pos(i.id) ?? this.stationAt.get(i.id) ?? new THREE.Vector3() })));
    if (this.pixelated) this.pixel.render(this.h.scene, this.h.camera);
    else this.h.renderer.render(this.h.scene, this.h.camera);
  }
  /** Pulls the camera target in so the view's edge stops at the map's edge (centred when the map is smaller than the view). */
  private clampAim(aim: THREE.Vector3): THREE.Vector3 {
    const cam = this.h.camera;
    const aspect = (cam.userData.aspect as number | undefined) ?? 9 / 16;
    const halfX = (this.height * this.zoomMul * aspect) / 2, halfZ = (this.height * this.zoomMul) / 2 / Math.sin(ELEVATION);
    const maxX = (this.sim.s.map.w - 1) * CELL, maxZ = (this.sim.s.map.h - 1) * CELL;
    const fit = (v: number, half: number, max: number) => (max - 2 * half < 0 ? max / 2 : Math.min(max - half, Math.max(half, v)));
    return aim.set(fit(aim.x, halfX - CELL / 2, maxX), aim.y, fit(aim.z, halfZ - CELL / 2, maxZ));
  }
  private placeCamera(): void {
    const cam = this.h.camera;
    const aspect = (cam.userData.aspect as number | undefined) ?? 9 / 16;
    // a heavy hit punches the camera in for a moment
    const half = (this.height * this.zoomMul * (1 - 0.07 * Math.sin((this.punch / 0.16) * Math.PI))) / 2;
    Object.assign(cam, { left: -half * aspect, right: half * aspect, top: half, bottom: -half });
    cam.updateProjectionMatrix();
    const c = this.center.clone().add(this.fx.jolt());
    if (this.pixelated) this.pixel.snap(c, half, ELEVATION);
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
    return cellAtScreen(this.el, this.h.camera, this.sim.s.map, clientX, clientY);
  }

  dispose(): void {
    this.actors.dispose();
    this.fx.dispose();
    this.torches.dispose();
    this.particles.dispose();
    this.items.dispose();
    this.elements.dispose();
    this.banner.remove();
    this.pops.dispose();
    this.intro?.dispose();
    this.ghosts.dispose();
    this.slowmo.remove();
    this.pixel.dispose();
    this.terrain.dispose();
    this.h.dispose();
  }
}
