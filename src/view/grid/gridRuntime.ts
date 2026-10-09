import { BURST, cellAtScreen, cellVec, shotGroup } from './runtimeHelpers';
import { ShipTerrain } from './shipTerrain';
import { WorldTerrain, type WorldLook } from '../overworld/worldTerrain';
import { Bloom } from '../overworld/bloom';
import type { NatureKit } from '../overworld/natureKit';
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
import { setActionPace, type UalLibrary } from './ualActor';
import type { DungeonKit } from './dungeonKit';
import { createScene, type SceneHandle } from '../scene/renderer';
import { chase } from './chase';
import { GridActors, LOOK_BY_ID } from './gridActors';
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
import { dotLook, PixelPass } from './pixelPass';
import type { VfxKind } from '../fx/vfx';
import { ShipIntro } from './shipIntro';
import { Afterimages } from './afterimage';
import { sensedFoes } from '../../sim/grid/perks';
import { feel, setFeel } from './feel';
import { StrikeFx } from './strikeFx';
import { StrikeCues } from './strikeCues';
let ELEVATION = (45 * Math.PI) / 180;
/** Scripted views (the comparison demo) may tilt the camera. */
export const setCameraElevation = (deg: number): void => { ELEVATION = (deg * Math.PI) / 180; };
const CAM_DIST = 40;
const CAM_K = 8;
/** Draws a grid sortie: the map, models chasing their cells, and each turn's events replayed as a quick overlapping show. */
export class GridRuntime {
  private readonly h: SceneHandle;
  private terrain: GridTerrain | ShipTerrain | WorldTerrain;
  /** the figure the camera follows */
  focusId = 'hero';
  /** a camera free of the clones (the base's): it aims at this cell instead of following the focus */
  freeAim: { x: number; y: number } | null = null;
  /** a screen that sets the view itself (the base, seen cut open): the camera's tilt (radians) and the height it looks at — null: the usual tilt, at the ground */
  tilt: { elevation: number; y: number } | null = null;
  /** a fight watched from above with nobody under the hand (the besieged base): no catch of breath on a blow, no red edge when a clone is struck, no jolt */
  calm = false;
  /** the world map's glow pass */
  private bloom?: Bloom;
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
  private playback = new Playback(); private partyPace = false;
  private readonly hemi = new THREE.HemisphereLight('#aab0c8', '#1a1410', 0.85);
  /** a dim fill round the hero so it never vanishes between torch pools */
  private readonly light = new THREE.PointLight('#ffd8a8', 4, 6, 1.6);
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
  private readonly strikeFx = new StrikeFx();
  private strikes!: StrikeCues;
  /** dims the screen edge while the game runs slow (an engraving moment) */
  private readonly slowmo = document.createElement('div');
  constructor(private readonly el: HTMLElement, private readonly sim: GridSim, private readonly lib: UalLibrary, private readonly kit: DungeonKit, private readonly mobile: boolean, private readonly onCue: (e: GEvent) => void = () => undefined, themeIn?: { theme: 'ship'; kit: ShipKit; meta: MetaState } | { theme: 'world'; look: WorldLook; nature?: NatureKit }) {
    const theme = themeIn?.theme === 'ship' ? themeIn : undefined, world = themeIn?.theme === 'world' ? themeIn.look : undefined, nature = themeIn?.theme === 'world' ? themeIn.nature : undefined;
    this.h = createScene(el);
    if (mobile) { this.h.renderer.shadowMap.enabled = false; this.h.renderer.setPixelRatio(1); }
    const scene = this.h.scene;
    scene.background = new THREE.Color('#0b0b0e');
    scene.fog = null;
    const look = applyZoneLook(this.hemi, sim.s.run.floor, mobile);
    const sun = new THREE.DirectionalLight('#8090c0', 0.18);
    sun.position.set(-10, 30, 14);
    scene.add(this.hemi, sun, this.light);
    this.pixel = new PixelPass(this.h.renderer, 2, dotLook());
    if (!theme && !world) kit.tint(look.tint);
    this.terrain = world ? new WorldTerrain(sim.s.map.w, sim.s.map.h, world, nature) : theme ? new ShipTerrain(sim.s.map, theme.kit, theme.meta) : new GridTerrain(sim.s.map, kit, look.decal);
    // the occupied world is dark: dim moonlight, a lamp round the party, and the land's own fires
    if (world) { this.hemi.color.set('#7884b4'); this.hemi.groundColor.set('#241c18'); this.hemi.intensity = 0.62; this.light.color.set('#e4eaff'); this.light.intensity = 4.5; this.light.distance = 9; sun.intensity = 0; this.bloom = new Bloom(this.h.renderer, scene, this.h.camera); }
    for (const st of theme ? sim.s.map.stations ?? [] : []) this.stationAt.set(`st-${st.id}`, new THREE.Vector3(st.pos.x * CELL, 0, st.pos.y * CELL));
    if (theme) { this.intro = new ShipIntro(this.stationAt.get('st-pod'), this.stationAt.get('st-hatch'), theme.meta.best === 0); scene.add(this.intro.root); }
    if (theme) { this.hemi.color.set('#b7ddff'); this.hemi.groundColor.set('#162432'); this.hemi.intensity = 0.62; this.light.color.set('#b7eaff'); this.light.intensity = 3; }
    this.actors = new GridActors(lib);
    this.torches = new GridTorches(sim.s.map, kit, look.lights, theme || world ? 0 : look.density, look);
    this.elements = new GridElements(kit, sim.s);
    this.mapRef = sim.s.map;
    scene.add(this.terrain.root, this.actors.root, this.torches.root, this.particles.root, this.items.root, this.elements.root, this.ghosts.root, this.strikeFx.root);
    this.slowmo.className = 'grid-slowmo';
    el.appendChild(this.slowmo);
    this.banner.className = 'grid-banner';
    el.appendChild(this.banner);
    this.fx = new GridFx(scene, el, (p) => this.project(p), mobile ? 1 : 4);
    this.pops = new EngravePops(el);
    this.kit2 = { actors: this.actors, fx: this.fx, particles: this.particles, pops: this.pops, at: (id) => (id ? this.actors.pos(id) : undefined), punch: () => { this.punch = 0.16; }, trail: (id, sec) => { if (id) this.ghosts.trailOf(() => this.actors.figure(id), sec, id === 'hero' ? '#6dffb4' : '#ff8a6a'); } };
    // the figures are rebuilt on each floor, so the cues ask for the current set
    this.strikes = new StrikeCues(this.strikeFx, () => this.actors, this.particles);
    // the camera's cell first: figures far from it and unseen wait until they come into view
    this.actors.focus = { x: sim.s.hero.pos.x, y: sim.s.hero.pos.y };
    this.actors.sync(sim.s);
    const hp = sim.s.hero.pos;
    this.center.set(hp.x * CELL, 0, hp.y * CELL);
    this.refresh();
  }
  /** A particle effect at a floor point (for screens that show work the events do not carry, like mining). */
  fireVfx(kind: VfxKind, at: THREE.Vector3, tint?: string): void { this.particles.vfx.fire(kind, at, tint); }
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
  /** How fast figures walk between cells (a live game sets it from how often its units step). */
  setWalkSpeed(cellsPerSecond: number): void { this.actors.walkSpeed = cellsPerSecond; }
  /** A live game's events (time flowing, not turns): play them as they come, without hurrying what is still showing. */
  applyLive(events: GEvent[], startTime: number): void {
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
    this.playback = new Playback(this.partyPace);
    this.pending.clear();
    this.actors.focus = { x: s.hero.pos.x, y: s.hero.pos.y };
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
  /** Marks the foe the attack key would strike (a turning reticle on the floor under it); nothing clears it. */
  markTarget(id: string | undefined): void { this.actors.setTarget(id); }
  showPath(cells: { x: number; y: number }[] | null): void {
    this.elements.setPath(cells);
  }
  showAim(cells: { x: number; y: number }[] | null, ok: boolean): void {
    this.elements.setAim(cells, ok);
  }
  /** a square on the ground: how far something standing on the cell reaches (null hides it) */
  showReach(c: { x: number; y: number } | null, r: number, color?: string): void {
    this.elements.setReach(c, r, color);
  }
  hurry(): void {
    this.playback.hurry();
  }
  /** The party screens' pacing: attacks play out and chains show one effect at a time (the screen waits for the show in a fight). */
  partyShow(): void { this.partyPace = true; this.playback = new Playback(true); setActionPace(1.5); setFeel('kata'); }
  /**
   * Party fights: the states each unit stands in right now (burning, frozen, poisoned). They get a steady glow, and the
   * burning have flames licking up them for as long as they burn (a burn used to show only the moment it was laid).
   */
  partyStates(list: { id: string; burn: boolean; freeze: boolean; poison: boolean }[]): void {
    const now = new Set<string>();
    this.burning.clear();
    for (const st of list) {
      now.add(st.id); if (st.burn) this.burning.add(st.id);
      this.actors.setStatus(st.id, { burn: st.burn ? 1 : 0, freeze: st.freeze ? 1 : 0, poison: st.poison ? 1 : 0 });
    }
    for (const id of this.stated) if (!now.has(id)) this.actors.setStatus(id, undefined);
    this.stated = now;
  }
  private readonly burning = new Set<string>(); private stated = new Set<string>(); private emberAt = 0;
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
    // a party's units carry their own states (see `partyStates`); the grid game's are on its entities
    if (!this.partyPace) for (const e of [s.hero, ...s.foes]) this.actors.setStatus(e.id, e.status);
    const g = s.hero.gear;
    // a figure with its own look (the party demo) keeps the weapon it was given
    if (!LOOK_BY_ID.has('hero')) this.actors.setWeapon('hero', heroLook(activeWeapon(g)?.group, this.terrain instanceof ShipTerrain), heroLook(g.hands[g.active === 0 ? 1 : 0]?.group, this.terrain instanceof ShipTerrain));
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
    if (e.src === 'hero' || e.type === 'engrave') this.strikes.note(e);
    const shot = this.pending.get(key);
    if (shot && !shot.ready && (e.type === 'hit' || e.type === 'miss' || e.type === 'die')) { shot.queue.push(e); return; }
    if (comboCue({ ...this.kit2, actors: a }, e)) { this.onCue(e); return; }
    switch (e.type) {
      case 'move': if (e.to) a.moveTo(e.src, e.to.x, e.to.y); break;
      case 'bump': {
        const p = at(e.dst);
        if (p) {
          a.lunge(e.src, p, e.text === 'finisher' ? 'finisher' : undefined, e.group);
          const from = at(e.src)!;
          if (e.src === 'hero') this.strikes.slash(e, p, from); else this.fx.transient.slash(p.x, p.z, Math.atan2(p.z - from.z, p.x - from.x));
        }
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
        const f = feel(), mine = e.src === 'hero' || (this.partyPace && a.isAlly(e.src));
        if (e.src === 'hero') this.strikes.shot(e, from, p);
        const round = () => { this.fx.flash(from, magic ? '#b48aff' : '#ffd890', mine ? f.flash : 22, 0.08); if (mine && f.shotKick) this.fx.shake(0.07, f.shotKick); };
        round();
        this.fx.bolt(from, p, () => { entry.ready = true; if (this.pending.get(key) === entry) this.pending.delete(key); for (const q of entry.queue) this.cue(q); }, mine ? f.bolt : 1);
        // a pistol fires a double tap: the second round is for the eye alone (the blow is the first's), a little off its line
        if (e.text === 'gun') for (let k = 1; k < BURST.rounds; k++) this.fx.later(k * BURST.gap, () => {
          const src = at(e.src) ?? from, off = new THREE.Vector3((Math.random() - 0.5) * BURST.spread, 0, (Math.random() - 0.5) * BURST.spread);
          round(); a.shoot(e.src, p, shotGroup(e)); this.fx.bolt(src, p.clone().add(off), () => {}, mine ? f.bolt : 1);
          if (mine) this.particles.spray(src.clone().setY(1.1), '#e8c060', 1);
        });
        break;
      }
      case 'hit': {
        // a foe bleeds where it is struck (no white flash); a clone flinches with a red flash and the screen's edge
        const p = at(e.dst), ally = a.isAlly(e.dst);
        // a blow on something built (the pod, a module): sparks where it stands, and the game does not catch its breath for it
        if (!p && e.to && e.dst === 'dome') { this.particles.vfx.fire('hit', cellVec(e.to).setY(0.9), '#ffb02a'); break; }
        // one of the horde's small fry (drawn in a batch, not a figure of its own): what the blow was worth, where it stands
        if (!p && e.to) { if (e.amount) this.fx.number(String(e.amount), 'dmg', cellVec(e.to), 1.1); break; }
        if (e.crit) a.knock(e.dst, at(e.src)); else a.hurt(e.dst, at(e.src));
        if (p) {
          this.fx.number(`${e.amount}${e.crit ? '!' : ''}`, e.crit ? 'crit' : ally ? 'ally-hurt' : 'dmg', p);
          this.particles.vfx.fire(e.crit ? 'crit' : 'hit', p, ally ? '#ff5a3a' : '#c81e1e');
          if (!ally) this.gore(p, e.crit ? 12 : 7, at(e.src));
        }
        if (this.calm) break;
        this.fx.hitStop(feel().hitStop);
        if (ally) this.fx.hurt();
        if (e.crit) this.punch = 0.16;
        if (e.crit || e.dst === 'hero') this.fx.shake(e.crit ? 0.14 : 0.1, e.crit ? 0.22 : 0.14);
        break;
      }
      case 'miss': {
        const p = at(e.dst);
        if (p) { this.fx.number('빗나감', 'miss', p); this.particles.vfx.fire('dust', p); }
        break;
      }
      case 'reload': a.anim(e.src, 'reload'); break;
      case 'pickup': a.anim(e.src, 'pickup'); break;
      case 'die': { a.die(e.dst, at(e.src)); const p = at(e.dst); if (p && e.dst !== 'hero') { this.gore(p, 18, at(e.src)); if (!this.calm) this.fx.hitStop(feel().killStop); if (e.dst) this.strikes.kill(e.dst, p); } break; }
      case 'door': if (e.to) this.terrain.openDoor(idx(this.sim.s.map, e.to)); break;
      case 'open': a.anim('hero', 'interact'); if (e.to) { this.terrain.openChest(idx(this.sim.s.map, e.to)); this.fx.transient.burst(e.to.x * CELL, e.to.y * CELL, '#ffd76a', 0.7, 0.5); } break;
      case 'energy': if (e.to) this.fx.energy(cellVec(e.to), e.amount ?? 0); break;
      case 'loot': if (e.to) this.fx.number(lootText(e), 'combo', cellVec(e.to), 3.4); break;
      case 'stun': a.knock(e.dst); break;
      case 'dodge': a.anim('hero', e.text === 'L' ? 'weaveL' : 'weaveR'); { const p = at('hero'); if (p) this.fx.number('회피', 'miss', p); } break;
      case 'parry': a.anim('hero', 'parry'); { const p = at('hero'); if (p) { this.fx.number('패링!', 'combo', p); this.particles.vfx.fire('hit', p, '#e8f0ff'); } } break;
      case 'explode': if (e.to) { const p = cellVec(e.to); this.particles.vfx.fire('blast', p); this.fx.flash(p, '#ff8a2a', 40, 0.45, 9); this.fx.shake(0.25, 0.35); this.fx.hitStop(); } break;
      case 'telegraph': { const p = at(e.src); if (p) this.particles.vfx.fire('warn', p, e.text === 'frost' ? '#5ab4ff' : undefined); break; }
      case 'levelUp': { const p = at('hero'); if (p) { this.fx.number(`레벨 ${e.amount}!`, 'combo', p); this.particles.vfx.fire('magic', p, '#ffd76a'); } break; }
      case 'heal': {
        if (e.text !== 'regen') a.anim(e.dst, 'drink');
        const p = at(e.dst); if (p) { this.fx.number(`+${e.amount}`, 'heal', p); if (e.text !== 'regen') this.particles.vfx.fire('heal', p); } break; }
      case 'wake': { const p = at(e.src); if (p) this.fx.number('!', 'crit', p); break; }
      default: break;
    }
    this.onCue(e);
  }
  update(dt: number): void {
    this.clock += dt;
    const scaled = dt * this.fx.timeScale;
    for (const e of this.playback.update(this.fx.frozen ? 0 : scaled)) this.cue(e);
    // flames on everything that burns, a few embers at a time
    this.emberAt -= scaled;
    if (this.emberAt <= 0 && this.burning.size) { this.emberAt = 0.07; for (const id of this.burning) { const at = this.actors.pos(id); if (at && this.actors.shown(id)) this.particles.embers(at, 3); } }
    this.fx.update(dt);
    this.pops.update(dt);
    if (this.terrain instanceof ShipTerrain) this.terrain.update(dt);
    if (this.terrain instanceof WorldTerrain) this.terrain.update(dt, this.center);
    this.actors.focus = { x: this.center.x / CELL, y: this.center.z / CELL };
    this.actors.update(scaled, this.fx.frozen);
    this.torches.update(dt);
    this.items.update(dt);
    this.elements.update(dt);
    this.ghosts.update(dt);
    this.strikeFx.update(scaled);
    this.strikes.update(dt);
    this.slowmo.classList.toggle('on', this.fx.timeScale < 1);
    this.particles.update(this.fx.frozen ? 0 : scaled, this.center);
    this.punch = Math.max(0, this.punch - dt);
    const hero = this.actors.pos(this.focusId) ?? this.actors.pos('hero') ?? this.center;
    // the small ship deck stays framed in the middle; in the dungeon the camera follows the hero
    const deck = new THREE.Vector3(((this.sim.s.map.w - 1) / 2) * CELL, 0, ((this.sim.s.map.h - 1) / 2) * CELL);
    const shot = this.intro?.update(dt);
    this.zoomMul = shot?.zoom ?? 1;
    const free = this.freeAim ? new THREE.Vector3(this.freeAim.x * CELL, 0, this.freeAim.y * CELL) : null;
    let aim = shot && this.intro?.pod ? this.intro.pod.clone().lerp(deck, shot.k) : this.stationAt.size ? deck : free ?? hero;
    if (shot) { this.center.x = aim.x; this.center.z = aim.z; }
    // a copy: the hero's own position must not be moved by the clamp
    if (this.stayInMap && !this.stationAt.size) aim = this.clampAim(aim.clone());
    this.center.x = chase(this.center.x, aim.x, dt, CAM_K);
    this.center.z = chase(this.center.z, aim.z, dt, CAM_K);
    // the lamp round the party hangs a little behind it (away from the camera): figures are rimmed, not burnt out
    this.light.position.set(hero.x, 2.6, hero.z - 1.2);
    if (this.sim.s.hero.exitTime > 0) this.terrain.pulseExit(this.clock);
    this.placeCamera();
    this.fx.setIcons(this.icons.map((i) => ({ ...i, at: this.actors.pos(i.id) ?? this.stationAt.get(i.id) ?? new THREE.Vector3() })));
    // the dot look wins over glow: the coarse target already blurs nothing
    if (this.pixelated) this.pixel.render(this.h.scene, this.h.camera);
    else if (this.bloom) this.bloom.render();
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
    const c = this.center.clone().add(this.fx.jolt()), el = this.tilt?.elevation ?? ELEVATION;
    if (this.pixelated) this.pixel.snap(c, half, el);
    c.y += this.tilt?.y ?? 0;
    cam.position.set(c.x, c.y + Math.sin(el) * CAM_DIST, c.z + Math.cos(el) * CAM_DIST);
    cam.lookAt(c);
  }
  /** Nothing south of this line (world z) is drawn: the land seen cut open there (null: all of it is drawn). */
  cutSouth(z: number | null): void { this.h.renderer.clippingPlanes = z === null ? [] : [new THREE.Plane(new THREE.Vector3(0, 0, -1), z)]; }
  /** Extra things a screen draws in the scene (a dungeon floor's souls, shrine, floor items). */
  addOverlay(o: THREE.Object3D): void { this.h.scene.add(o); }
  /** The pod falls from the sky (the pod's ground only); false if there is no pod. */
  landPod(onDown?: () => void): boolean { if (!(this.terrain instanceof WorldTerrain) || !this.terrain.pod) return false; this.terrain.onThump = () => { this.fx.shake(0.45, 0.55); onDown?.(); }; this.terrain.landPod(); return true; }
  get podLanding(): boolean { return this.terrain instanceof WorldTerrain && !!this.terrain.pod?.landing; }
  /** The glow pass (fires and lamps bleed light), as on the world map. */
  enableBloom(glow?: { strength: number; radius: number; threshold: number }): void { this.bloom ??= new Bloom(this.h.renderer, this.h.scene, this.h.camera, glow); }
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

  /**
   * Which of these figures a finger rests on: the one whose body (feet to head, as drawn) passes nearest the point, within
   * `reach` screen pixels. A figure stands taller than its cell, so a finger on its chest is over the cell behind it.
   */
  figureAt(clientX: number, clientY: number, ids: string[], reach = 26): string | undefined {
    const box = this.el.getBoundingClientRect(), x = clientX - box.left, y = clientY - box.top;
    let best: string | undefined, near = reach;
    for (const id of ids) {
      const at = this.actors.shown(id) ? this.actors.pos(id) : undefined;
      if (!at) continue;
      const a = this.project(at), b = this.project(at.clone().setY(at.y + 1.5));
      const dx = b.left - a.left, dy = b.top - a.top, k = Math.max(0, Math.min(1, ((x - a.left) * dx + (y - a.top) * dy) / Math.max(1e-6, dx * dx + dy * dy)));
      const d = Math.hypot(x - (a.left + dx * k), y - (a.top + dy * k));
      if (d < near) { near = d; best = id; }
    }
    return best;
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
    this.strikeFx.dispose();
    this.slowmo.remove();
    this.pixel.dispose();
    this.bloom?.dispose();
    this.terrain.dispose();
    this.h.dispose();
  }
}
