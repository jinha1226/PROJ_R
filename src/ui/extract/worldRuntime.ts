import * as THREE from 'three';
import { DT } from '../../sim/battle/constants';
import type { Snapshot, UnitSetup } from '../../sim/battle/types';
import type { Loadout } from '../../sim/extract/loadout';
import type { Region } from '../../sim/extract/regionTypes';
import type { Mercenary } from '../../sim/roster/types';
import { phaseOf } from '../../sim/world/clock';
import { WorldSim, type HeroInput } from '../../sim/world/worldSim';
import type { Actor } from '../../view/actors/actor';
import { actorFromSetup } from '../../view/actors/actorFactory';
import type { AssetLibrary } from '../../view/actors/assets';
import type { EnvLibrary } from '../../view/explore/envAssets';
import { IsoCamera } from '../../view/explore/exploreCamera';
import { ProjectileFx } from '../../view/fx/projectileFx';
import { TelegraphFx } from '../../view/fx/telegraphFx';
import { TransientFx } from '../../view/fx/transientFx';
import { DamageNumbers } from '../../view/overlay/damageNumbers';
import { UnitOverlay } from '../../view/overlay/unitOverlay';
import { EventRouter } from '../../view/playback/eventRouter';
import { interpUnit } from '../../view/playback/interpolate';
import { createScene, type SceneHandle } from '../../view/scene/renderer';
import { buildTerrain } from '../../view/world/terrain';
import { UnitPool } from '../../view/world/unitPool';
import { VisionMask } from '../../view/world/visionMask';
import { WorldLighting } from '../../view/world/worldLighting';
import { WorldMarkers } from '../../view/world/worldMarkers';
import { t } from '../i18n/ko';

const VIEW_RADIUS = 34;
const MAX_STEPS = 8;
const SIGHT: Record<string, number> = { day: 18, dusk: 16, night: 12, storm: 11 };

/** The sortie's sim plus everything that draws it (terrain, pooled actors, effects, vision). */
export class WorldRuntime {
  readonly sim: WorldSim;
  readonly cam: IsoCamera;
  private readonly h: SceneHandle;
  private readonly light: WorldLighting;
  private readonly markers: WorldMarkers;
  private readonly vision = new VisionMask(260);
  private readonly doors: Map<string, THREE.Object3D>;
  private readonly overlay: UnitOverlay;
  private readonly numbers: DamageNumbers;
  private readonly tel: TelegraphFx;
  private readonly proj: ProjectileFx;
  private readonly fx: TransientFx;
  private readonly pool: UnitPool<UnitSetup, Actor>;
  private readonly actors = new Map<string, Actor>();
  private readonly router: EventRouter;
  private readonly pos = new Map<string, { x: number; z: number; facing: number }>();
  private prev: Snapshot;
  private curr: Snapshot;
  private acc = 0;
  private heroLook = '';

  constructor(private readonly container: HTMLElement, region: Region, hero: Mercenary, loadout: Loadout, seed: number, private readonly lib: AssetLibrary, env: EnvLibrary, mobile: boolean) {
    this.sim = new WorldSim(region, hero, loadout, seed);
    this.h = createScene(container);
    if (mobile) { this.h.renderer.shadowMap.enabled = false; this.h.renderer.setPixelRatio(1); }
    this.light = new WorldLighting(this.h.scene, !mobile);
    const terrain = buildTerrain(region, env, !mobile);
    this.doors = terrain.doors;
    this.h.scene.add(terrain.root);
    this.markers = new WorldMarkers(region, env);
    this.h.scene.add(this.markers.root, this.vision.mesh);
    this.cam = new IsoCamera(this.h.camera, 19);
    const nameOf = (u: UnitSetup) => (u.team === 'ally' ? u.name : t(`enemy.${u.defId}`));
    this.overlay = new UnitOverlay(container, this.h.camera, nameOf, () => '');
    this.numbers = new DamageNumbers(container);
    this.tel = new TelegraphFx(this.h.scene);
    this.proj = new ProjectileFx(this.h.scene);
    this.fx = new TransientFx(this.h.scene);
    this.pool = new UnitPool<UnitSetup, Actor>({
      keyOf: (s) => `${s.model}|${JSON.stringify(s.gear)}|${s.tint ?? ''}|${s.scale ?? 1}|${s.team}`,
      create: (s) => { const a = actorFromSetup(s, lib); this.h.scene.add(a.root); return a; },
      show: (a, s) => { a.root.visible = true; a.root.userData.unitId = s.id; a.play('idle'); },
      hide: (a) => { a.root.visible = false; },
      reusable: (a) => !a.isDown,
      drop: (a) => { this.h.scene.remove(a.root); a.dispose(); },
    });
    this.router = new EventRouter({
      actors: this.actors, fx: this.fx, numbers: this.numbers, posOf: (id) => this.pos.get(id),
      toScreen: (x, y, z) => this.overlay.screenPos(x, y, z, container.clientWidth, container.clientHeight),
      teamOf: (id) => this.sim.w.b.units.find((u) => u.id === id)?.team,
      shake: () => undefined, onSummon: () => undefined, onBerserk: () => undefined, log: () => undefined,
      tether: () => undefined, bark: () => undefined, popIcon: (id, icon) => this.overlay.pop(id, icon), slowmo: () => undefined, punch: () => undefined,
    });
    this.prev = this.curr = this.sim.snapshot(VIEW_RADIUS);
  }

  /** Advances the sim in fixed ticks (none while paused), then draws the interpolated frame. */
  update(dt: number, input: () => HeroInput, paused: boolean): void {
    if (!paused && !this.sim.w.outcome) {
      this.acc += Math.min(dt, 0.1);
      let steps = 0;
      while (this.acc >= DT - 1e-9 && steps < MAX_STEPS && !this.sim.w.outcome) {
        this.sim.step(input());
        for (const e of this.sim.w.b.events) this.router.handle(e);
        this.prev = this.curr;
        this.curr = this.sim.snapshot(VIEW_RADIUS);
        this.acc -= DT;
        steps++;
      }
      if (steps >= MAX_STEPS) this.acc = 0;
    }
    this.draw(dt, paused ? 0 : Math.min(0.999, this.acc / DT), paused);
  }

  private draw(dt: number, alpha: number, paused: boolean): void {
    const w = this.sim.w;
    this.syncHeroLook();
    const setups = new Map(w.b.units.map((u) => [u.id, u.setup]));
    const visible = this.curr.units.map((u) => setups.get(u.id)!).filter(Boolean);
    const { added, removed } = this.pool.sync(visible);
    for (const id of removed) { this.actors.delete(id); this.overlay.remove(id); }
    for (const id of added) { this.actors.set(id, this.pool.get(id)!); this.overlay.add(setups.get(id)!); }
    const before = new Map(this.prev.units.map((u) => [u.id, u]));
    const cw = this.container.clientWidth;
    const ch = this.container.clientHeight;
    for (const u of this.curr.units) {
      const a = this.actors.get(u.id);
      if (!a) continue;
      const b = before.get(u.id);
      const p = interpUnit(b, u, alpha);
      this.pos.set(u.id, { x: p.x, z: p.y, facing: p.facing });
      a.root.position.set(p.x, 0, p.y);
      a.root.rotation.y = Math.PI / 2 - p.facing;
      a.setLocomotion(paused || !b ? 0 : Math.hypot(u.x - b.x, u.y - b.y) / DT);
      if (u.downed !== a.isDown && u.alive) a.setDowned(u.downed);
      if (!u.alive && !a.isDown) a.setDead();
      a.update(paused ? 0 : dt);
      this.overlay.update(u, p.x, p.y, cw, ch);
    }
    const hero = this.pos.get(w.heroId) ?? { x: 0, z: 0 };
    const phase = phaseOf(w.b.tick);
    for (const id of w.doorsOpen) { const d = this.doors.get(id); if (d?.parent) d.parent.remove(d); }
    this.markers.update(dt, w.containers, w.closed, w.piles);
    this.vision.set(hero.x, hero.z, SIGHT[phase]!);
    this.light.update(hero.x, hero.z, phase);
    this.tel.sync(this.curr.telegraphs);
    this.proj.sync(this.prev, this.curr, alpha);
    this.fx.update(dt);
    this.cam.follow(hero.x, hero.z, dt);
    this.h.renderer.render(this.h.scene, this.h.camera);
  }

  /** Rebuilds the hero's model when worn gear changes its look. */
  private syncHeroLook(): void {
    const s = this.sim.w.b.units.find((u) => u.id === this.sim.w.heroId)!.setup;
    const look = JSON.stringify([s.gear, s.gearTiers]);
    if (look === this.heroLook) return;
    this.heroLook = look;
    const old = this.actors.get(s.id);
    if (!old) return;
    this.h.scene.remove(old.root);
    old.dispose();
    const a = actorFromSetup(s, this.lib);
    this.h.scene.add(a.root);
    this.actors.set(s.id, a);
    this.pool.replace(s.id, a, `hero-${look}`);
  }

  /** Screen-relative stick → world direction on the ground plane. */
  worldMove(mx: number, my: number): { x: number; y: number } {
    const ax = this.cam.axes();
    return { x: ax.right.x * mx + ax.down.x * my, y: ax.right.z * mx + ax.down.z * my };
  }

  dispose(): void {
    for (const a of this.pool.all()) a.dispose();
    this.tel.dispose();
    this.proj.dispose();
    this.fx.dispose();
    this.overlay.dispose();
    this.numbers.dispose();
    this.vision.dispose();
    this.h.dispose();
  }
}
