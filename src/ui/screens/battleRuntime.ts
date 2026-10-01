import * as THREE from 'three';
import { Battle } from '../../sim/battle/battle';
import { DT } from '../../sim/battle/constants';
import type { BattleEvent, BattleSetup, Outcome, UnitSetup, UnitSnap } from '../../sim/battle/types';
import { actorFromSetup } from '../../view/actors/actorFactory';
import type { Actor } from '../../view/actors/actor';
import type { AssetLibrary } from '../../view/actors/assets';
import { ProjectileFx } from '../../view/fx/projectileFx';
import { ShieldFx } from '../../view/fx/shieldFx';
import { TelegraphFx } from '../../view/fx/telegraphFx';
import { TransientFx } from '../../view/fx/transientFx';
import { TargetLineFx } from '../../view/fx/targetLineFx';
import { TetherFx } from '../../view/fx/tetherFx';
import { BarkLayer } from '../../view/overlay/barks';
import { DamageNumbers } from '../../view/overlay/damageNumbers';
import { UnitOverlay } from '../../view/overlay/unitOverlay';
import { BattlePlayer, type Frame } from '../../view/playback/battlePlayer';
import { EventRouter } from '../../view/playback/eventRouter';
import { interpUnit } from '../../view/playback/interpolate';
import { BattleCamera } from '../../view/scene/camera';
import { createScene, type SceneHandle } from '../../view/scene/renderer';
import { addLighting } from '../../view/scene/lighting';
import { buildArena } from '../../view/scene/arena';
import { buildRoom } from '../../view/explore/roomMesh';
import { THEME_KITS } from '../../view/explore/themeKit';
import type { EnvLibrary } from '../../view/explore/envAssets';
import type { Room } from '../../sim/explore/types';
import type { Theme } from '../../sim/run/types';
import { t } from '../i18n/ko';

/** Fight inside an exploration room instead of the open sandbox field. */
export interface RoomArena {
  theme: Theme;
  room: Room;
  env: EnvLibrary;
}

export interface RuntimeHooks {
  log(e: BattleEvent): void;
  onEnd(outcome: Outcome): void;
  onBerserk(mult: number): void;
}

export const unitName = (u: UnitSetup): string => (u.team === 'ally' ? u.name : t(`enemy.${u.defId}`));

/** Owns the sim, the 3D scene, and everything that turns snapshots into pixels. */
export class BattleRuntime {
  readonly battle: Battle;
  readonly player: BattlePlayer;
  private readonly h: SceneHandle;
  readonly cam: BattleCamera;
  private readonly actors = new Map<string, Actor>();
  private readonly overlay: UnitOverlay;
  private readonly numbers: DamageNumbers;
  private readonly tel: TelegraphFx;
  private readonly proj: ProjectileFx;
  private readonly fx: TransientFx;
  private readonly shields: ShieldFx;
  private readonly targetLine: TargetLineFx;
  private readonly tethers: TetherFx;
  private readonly barks: BarkLayer;
  selected: string | null = null;
  private readonly router: EventRouter;
  private frame: Frame;
  private readonly pos = new Map<string, { x: number; z: number; facing: number }>();
  private readonly raycaster = new THREE.Raycaster();

  constructor(
    private readonly container: HTMLElement, setup: BattleSetup, private readonly lib: AssetLibrary, private readonly hooks: RuntimeHooks,
    arena?: RoomArena,
  ) {
    this.battle = new Battle(setup);
    this.h = createScene(container);
    addLighting(this.h.scene);
    if (arena) {
      this.h.scene.add(buildRoom(arena.room, arena.theme, arena.env));
      this.h.scene.background = new THREE.Color(THEME_KITS[arena.theme].sky);
      this.h.scene.fog = null;
    } else buildArena(this.h.scene, this.battle.state.obstacles, setup.seed);
    this.cam = new BattleCamera(this.h.camera);
    this.overlay = new UnitOverlay(container, this.h.camera, unitName, (id) => {
      const u = this.battle.state.units.find((x) => x.id === id);
      return u ? unitName(u.setup) : '';
    });
    this.targetLine = new TargetLineFx(this.h.scene);
    this.tethers = new TetherFx(this.h.scene, (id) => this.pos.get(id));
    this.barks = new BarkLayer(container);
    this.numbers = new DamageNumbers(container);
    this.tel = new TelegraphFx(this.h.scene);
    this.proj = new ProjectileFx(this.h.scene);
    this.fx = new TransientFx(this.h.scene);
    this.shields = new ShieldFx(this.h.scene);
    for (const u of this.battle.state.units) this.addUnit(u.setup);
    this.router = new EventRouter({
      actors: this.actors, fx: this.fx, numbers: this.numbers,
      posOf: (id) => this.pos.get(id),
      toScreen: (x, y, z) => this.overlay.screenPos(x, y, z, container.clientWidth, container.clientHeight),
      teamOf: (id) => this.battle.state.units.find((u) => u.id === id)?.team,
      shake: (s) => this.cam.shake(s),
      onSummon: (id) => {
        const u = this.battle.state.units.find((x) => x.id === id);
        if (u) this.addUnit(u.setup).play('spawn', { once: true });
      },
      onBerserk: (m) => hooks.onBerserk(m),
      log: (e) => hooks.log(e),
      tether: (a, b, kind) => this.tethers.add(a, b, kind),
      bark: (id, key) => this.barks.say(id, key),
      popIcon: (id, icon) => this.overlay.pop(id, icon),
      slowmo: () => this.player.slowmo(0.6, 0.3),
      punch: () => this.cam.punchIn(0.22),
    });
    this.player = new BattlePlayer(this.battle, (r) => {
      for (const e of r.events) {
        this.router.handle(e);
        if (e.type === 'battle_end') hooks.onEnd(e.data?.outcome as Outcome);
      }
    });
    this.frame = this.player.update(0);
  }

  private addUnit(u: UnitSetup): Actor {
    const a = actorFromSetup(u, this.lib);
    a.root.userData.unitId = u.id;
    this.actors.set(u.id, a);
    this.h.scene.add(a.root);
    this.overlay.add(u);
    return a;
  }

  setIntentsVisible(on: boolean): void {
    this.overlay.setIntentsVisible(on);
  }

  snap(id: string): UnitSnap | undefined {
    return this.frame.curr.units.find((u) => u.id === id);
  }

  update(dt: number): void {
    this.frame = this.player.update(dt);
    const { prev, curr, alpha } = this.frame;
    const before = new Map(prev.units.map((u) => [u.id, u]));
    const w = this.container.clientWidth;
    const hgt = this.container.clientHeight;
    const living: { x: number; y: number }[] = [];
    for (const u of curr.units) {
      const a = this.actors.get(u.id);
      if (!a) continue;
      const b = before.get(u.id);
      const p = interpUnit(b, u, alpha);
      this.pos.set(u.id, { x: p.x, z: p.y, facing: p.facing });
      a.root.position.set(p.x, 0, p.y);
      a.root.rotation.y = Math.PI / 2 - p.facing;
      const speed = b ? Math.hypot(u.x - b.x, u.y - b.y) / DT : 0;
      a.setLocomotion(this.player.speed === 0 ? 0 : speed);
      a.update(dt * this.player.speed * this.player.timeScale);
      this.overlay.update(u, p.x, p.y, w, hgt);
      this.shields.set(u.id, u.alive && u.shield > 0, p.x, p.y, a.spec.scale ?? 1);
      if (u.alive && !u.downed) living.push({ x: p.x, y: p.y });
    }
    const sel = this.selected ? curr.units.find((u) => u.id === this.selected) : undefined;
    const tgt = sel?.alive && !sel.downed && sel.intent?.targetId ? this.pos.get(sel.intent.targetId) : undefined;
    const team = sel ? this.battle.state.units.find((u) => u.id === sel.id)?.team : undefined;
    this.targetLine.set(sel && tgt ? this.pos.get(sel.id) ?? null : null, tgt ?? null, team);
    this.tel.sync(curr.telegraphs);
    this.proj.sync(prev, curr, alpha);
    this.fx.update(dt);
    this.tethers.update(dt);
    this.barks.update(dt, (id) => {
      const p = this.pos.get(id);
      return p ? this.overlay.screenPos(p.x, 2.0, p.z, w, hgt) : undefined;
    });
    this.cam.frame(living, dt);
    this.h.renderer.render(this.h.scene, this.h.camera);
  }

  /** Unit id under the given client coordinates, if any. */
  pick(clientX: number, clientY: number): string | null {
    const r = this.h.renderer.domElement.getBoundingClientRect();
    const ndc = new THREE.Vector2(((clientX - r.left) / r.width) * 2 - 1, -((clientY - r.top) / r.height) * 2 + 1);
    this.raycaster.setFromCamera(ndc, this.h.camera);
    const hits = this.raycaster.intersectObjects([...this.actors.values()].map((a) => a.root), true);
    for (const hit of hits) {
      for (let o: THREE.Object3D | null = hit.object; o; o = o.parent) {
        const id = o.userData.unitId as string | undefined;
        if (id) return id;
      }
    }
    return null;
  }

  dispose(): void {
    for (const a of this.actors.values()) a.dispose();
    this.tel.dispose();
    this.proj.dispose();
    this.fx.dispose();
    this.shields.dispose();
    this.targetLine.dispose();
    this.tethers.dispose();
    this.barks.dispose();
    this.overlay.dispose();
    this.numbers.dispose();
    this.h.dispose();
  }
}
