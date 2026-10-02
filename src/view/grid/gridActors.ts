import * as THREE from 'three';
import type { ModelId, GearVisual } from '../../data/types';
import type { Ent, GridState } from '../../sim/grid/types';
import { Actor, type ActorSpec } from '../actors/actor';
import type { AssetLibrary } from '../actors/assets';
import { chase } from './chase';
import { CELL } from './gridTerrain';

const LOOK: Record<Ent['kind'], { model: ModelId; gear: GearVisual; scale?: number; color: string }> = {
  hero: { model: 'Knight', gear: { weapon: '1H_Sword', helmet: false, cape: true }, color: '#e0a64a' },
  minion: { model: 'Skeleton_Minion', gear: { weapon: 'Blade', helmet: false, cape: false }, color: '#c8c8c8' },
  archer: { model: 'Skeleton_Rogue', gear: { weapon: 'Crossbow', helmet: true, cape: false }, color: '#c8c8c8' },
  brute: { model: 'Skeleton_Warrior', gear: { weapon: 'Axe', offhand: 'Shield_Small', helmet: true, cape: false }, color: '#c8c8c8', scale: 1.15 },
};
const LUNGE = 0.3;
const LUNGE_SEC = 0.12;
const SHOVE = 0.15;

interface View {
  actor: Actor;
  /** visual position (metres) chasing the logical cell */
  x: number;
  z: number;
  tx: number;
  tz: number;
  facing: number;
  /** a short offset (lunge toward a target, recoil, shove), decaying over `offT` */
  ox: number;
  oz: number;
  offT: number;
  dead: boolean;
}

/** One model per entity: chases its cell, faces where it goes, lunges, recoils and flinches on cue. */
export class GridActors {
  readonly root = new THREE.Group();
  private readonly views = new Map<string, View>();

  constructor(private readonly lib: AssetLibrary) {}

  /** Creates models for entities that do not have one yet (reinforcements appear mid-run). */
  sync(s: GridState): void {
    for (const e of [s.hero, ...s.foes]) {
      if (this.views.has(e.id)) continue;
      const look = LOOK[e.kind];
      const spec: ActorSpec = { id: e.id, model: look.model, gear: look.gear, color: look.color, scale: look.scale, team: e.kind === 'hero' ? 'ally' : 'enemy' };
      const actor = new Actor(spec, this.lib);
      const x = e.pos.x * CELL;
      const z = e.pos.y * CELL;
      actor.root.position.set(x, 0, z);
      this.root.add(actor.root);
      this.views.set(e.id, { actor, x, z, tx: x, tz: z, facing: Math.PI / 2, ox: 0, oz: 0, offT: 0, dead: !e.alive });
      if (!e.alive) actor.setDead();
    }
  }

  private v(id: string | undefined): View | undefined {
    return id ? this.views.get(id) : undefined;
  }

  pos(id: string): THREE.Vector3 | undefined {
    const v = this.views.get(id);
    return v ? new THREE.Vector3(v.x + v.ox, 0, v.z + v.oz) : undefined;
  }

  moveTo(id: string | undefined, cx: number, cy: number): void {
    const v = this.v(id);
    if (!v) return;
    v.tx = cx * CELL;
    v.tz = cy * CELL;
    v.facing = Math.atan2(v.tz - v.z, v.tx - v.x);
  }

  face(id: string | undefined, toward: THREE.Vector3): void {
    const v = this.v(id);
    if (v) v.facing = Math.atan2(toward.z - v.z, toward.x - v.x);
  }

  private nudge(v: View, toward: THREE.Vector3, amount: number): void {
    const dx = toward.x - v.x;
    const dz = toward.z - v.z;
    const l = Math.hypot(dx, dz) || 1;
    v.ox = (dx / l) * amount * CELL;
    v.oz = (dz / l) * amount * CELL;
    v.offT = LUNGE_SEC;
  }

  /** Melee: step into the target and back, swinging. */
  lunge(id: string | undefined, at: THREE.Vector3): void {
    const v = this.v(id);
    if (!v) return;
    this.face(id, at);
    this.nudge(v, at, LUNGE);
    v.actor.play(Math.random() < 0.5 ? 'attack1h' : 'attack1hStab', { once: true, fade: 0.05, speed: 1.6 });
  }

  /** Ranged: aim, fire, kick back a little. */
  shoot(id: string | undefined, at: THREE.Vector3, twoHanded: boolean): void {
    const v = this.v(id);
    if (!v) return;
    this.face(id, at);
    this.nudge(v, at, -0.1);
    v.actor.play(twoHanded ? 'shoot2h' : 'shoot1h', { once: true, fade: 0.05, speed: 1.8 });
  }

  /** Took a hit: flash, flinch and get shoved away from the attacker. */
  hurt(id: string | undefined, from: THREE.Vector3 | undefined): void {
    const v = this.v(id);
    if (!v || v.dead) return;
    v.actor.flash(0xffffff, 110);
    v.actor.play('hit', { once: true, fade: 0.04, speed: 1.6 });
    if (from) this.nudge(v, from, -SHOVE);
  }

  die(id: string | undefined): void {
    const v = this.v(id);
    if (!v || v.dead) return;
    v.dead = true;
    v.actor.setDead();
  }

  /** Foes are shown only on tiles the hero can see (the dead stay where they fell once seen). */
  setVisible(id: string, on: boolean): void {
    const v = this.views.get(id);
    if (v) v.actor.root.visible = on;
  }

  /** frozen: hit-stop — models hold their pose for a moment. */
  update(dt: number, frozen: boolean): void {
    for (const v of this.views.values()) {
      const step = frozen ? 0 : dt;
      const px = v.x;
      const pz = v.z;
      v.x = chase(v.x, v.tx, step);
      v.z = chase(v.z, v.tz, step);
      if (v.offT > 0) {
        v.offT -= step;
        const k = Math.max(0, v.offT / LUNGE_SEC);
        v.actor.root.position.set(v.x + v.ox * k, 0, v.z + v.oz * k);
      } else v.actor.root.position.set(v.x, 0, v.z);
      v.actor.root.rotation.y = Math.PI / 2 - v.facing;
      if (!v.dead) v.actor.setLocomotion(step > 0 ? Math.hypot(v.x - px, v.z - pz) / step : 0);
      v.actor.update(step);
    }
  }

  dispose(): void {
    for (const v of this.views.values()) v.actor.dispose();
    this.views.clear();
  }
}
