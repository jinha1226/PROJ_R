import * as THREE from 'three';
import type { Ent, GridState } from '../../sim/grid/types';
import { UalActor, type UalAnim, type UalLibrary, type UalLook } from './ualActor';
import type { WeaponLook } from './weaponMeshes';
import { glide, turnToward } from './chase';
import { CELL } from './gridTerrain';

/** Every kind is the same mannequin: colour, size and the block weapon tell them apart. */
const LOOK: Record<Ent['kind'], UalLook> = {
  hero: { body: '#3f6fb0', trim: '#e0a64a', scale: 1, weapon: 'sword', idle: 'Sword_Idle',
    block: { skin: '#e8b890', hair: '#5a3a1c', shirt: '#3a62a8', trim: '#5a3a1c', pants: '#3a3a52', boots: '#4a2e1a', face: 'human' } },
  minion: { body: '#d8d2c0', trim: '#7a7262', scale: 0.92, weapon: 'blade', idle: 'Idle_Loop',
    block: { skin: '#e8e2d0', hair: '#d8d2c0', shirt: '#e0dac8', trim: '#8a8270', pants: '#d0cab8', boots: '#b8b2a0', face: 'skull', ribs: true, bulk: 0.8 } },
  archer: { body: '#9fb08a', trim: '#4a5a3a', scale: 0.95, weapon: 'crossbow', idle: 'Idle_Loop',
    block: { skin: '#e8e2d0', hair: '#3e5a2e', shirt: '#4e6a3a', trim: '#2e3a22', pants: '#3e4a2e', boots: '#2a2a1e', face: 'hood', bulk: 0.85 } },
  brute: { body: '#8a3a32', trim: '#2a2420', scale: 1.22, weapon: 'axe', shield: true, idle: 'Sword_Idle',
    block: { skin: '#e8e2d0', hair: '#6a6e78', shirt: '#7a2e28', trim: '#2a2420', pants: '#4a2a24', boots: '#2a2420', face: 'helmet', bulk: 1.15 } },
  ghoul: { body: '#6a8a4a', trim: '#3a2a1a', scale: 0.95, weapon: 'none', idle: 'Zombie_Idle_Loop', run: 'Zombie_Walk_Fwd_Loop',
    block: { skin: '#7a9a5a', hair: '#4a5a32', shirt: '#5a4a32', trim: '#3a2a1a', pants: '#4a3a28', boots: '#3a2e20', face: 'ghoul' } },
  mage: { body: '#5a3a7a', trim: '#2a1a3a', scale: 0.95, weapon: 'staff', idle: 'Spell_Simple_Idle_Loop',
    block: { skin: '#e8e2d0', hair: '#4a2a6a', shirt: '#5a3a8a', trim: '#d8b040', pants: '#4a2a6a', boots: '#2a1a3a', face: 'hood', bulk: 0.85 } },
  champion: { body: '#3a3a44', trim: '#d8b040', scale: 1.45, weapon: 'sword', shield: true, idle: 'Sword_Idle',
    block: { skin: '#e8e2d0', hair: '#c8a040', shirt: '#4a4a56', trim: '#d8b040', pants: '#2e2e36', boots: '#1e1e24', face: 'helmet', bulk: 1.2 } },
};
const LUNGE = 0.3;

/** The coloured ring under each figure (gold hero, red foes). */
function ring(color: string, scale: number): THREE.Mesh {
  const m = new THREE.Mesh(new THREE.RingGeometry(0.32 * scale, 0.4 * scale, 28), new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.8, depthWrite: false }));
  m.rotation.x = -Math.PI / 2;
  m.position.y = 0.03;
  return m;
}
const LUNGE_SEC = 0.12;
const SHOVE = 0.15;

interface View {
  actor: UalActor;
  /** visual position (metres) chasing the logical cell */
  x: number;
  z: number;
  tx: number;
  tz: number;
  facing: number;
  /** drawn yaw, easing toward `facing` */
  yaw: number;
  /** keeps the run cycle going briefly between steps so a held walk never flickers to idle */
  runHold: number;
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
  private readonly kinds = new Map<string, Ent['kind']>();

  constructor(private readonly lib: UalLibrary) {}

  /** Creates models for entities that do not have one yet (reinforcements appear mid-run). */
  sync(s: GridState): void {
    for (const e of [s.hero, ...s.foes]) {
      if (this.views.has(e.id)) continue;
      this.kinds.set(e.id, e.kind);
      const actor = new UalActor(this.lib, LOOK[e.kind]);
      actor.root.add(ring(e.kind === 'hero' ? '#e0a64a' : '#d0533f', LOOK[e.kind].scale));
      const x = e.pos.x * CELL;
      const z = e.pos.y * CELL;
      actor.root.position.set(x, 0, z);
      this.root.add(actor.root);
      this.views.set(e.id, { actor, x, z, tx: x, tz: z, facing: Math.PI / 2, yaw: Math.PI / 2, runHold: 0, ox: 0, oz: 0, offT: 0, dead: !e.alive });
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
    v.actor.play(this.meleeAnim(id!), 1.7);
  }

  /** Ranged: aim, fire, kick back a little. */
  /** Fires: the motion follows the weapon (bow draw, crossbow, staff spell, overhand throw). */
  shoot(id: string | undefined, at: THREE.Vector3, group?: string): void {
    const v = this.v(id);
    if (!v) return;
    this.face(id, at);
    this.nudge(v, at, -0.1);
    const anim: UalAnim = group === 'bow' ? 'shootBow' : group === 'staff' ? 'cast' : group === 'throwing' ? 'throw' : 'shoot';
    v.actor.play(anim, anim === 'shootBow' ? 2.2 : 1.7);
  }

  /** Status glow from the sim: frozen, poisoned, burning. */
  setStatus(id: string, st: { burn: number; freeze: number; poison: number } | undefined): void {
    const v = this.views.get(id);
    if (!v || v.dead) return;
    v.actor.setTint(!st ? null : st.freeze > 0 ? '#5ab4ff' : st.burn > 0 ? '#ff7a2a' : st.poison > 0 ? '#7ad04a' : null);
  }

  /** Just the white flash (the knock-back motion carries the rest). */
  flashOnly(id: string | undefined): void {
    this.v(id)?.actor.flash(0xffffff, 110);
  }

  /** Took a hit: flash, flinch and get shoved away from the attacker. */
  hurt(id: string | undefined, from: THREE.Vector3 | undefined): void {
    const v = this.v(id);
    if (!v || v.dead) return;
    v.actor.flash(0xffffff, 110);
    v.actor.play('hit', 1.8);
    if (from) this.nudge(v, from, -SHOVE);
  }

  /** Shows the weapon group a figure is holding. */
  setWeapon(id: string, kind: WeaponLook): void {
    // ranged weapons rest at ease; melee keeps a guard stance
    const idle = kind === 'bow' || kind === 'crossbow' || kind === 'staff' || kind === 'throwing' ? 'Idle_Loop' : 'Sword_Idle';
    if (id === 'hero') this.heroWeapon = kind;
    this.v(id)?.actor.setWeapon(kind, idle);
  }

  /** A one-off action (reload, opening a chest). */
  anim(id: string | undefined, a: UalAnim): void {
    this.v(id)?.actor.play(a, 1.6);
  }

  /** Which close-quarters motion: daggers and skeleton blades jab, ranged weapons in hand bash, the rest swing. */
  private meleeAnim(id: string): UalAnim {
    const w = this.heroWeapon && id === 'hero' ? this.heroWeapon : LOOK[this.kindOf(id)].weapon;
    if (this.kindOf(id) === 'ghoul') return 'scratch';
    if (w === 'dagger' || w === 'blade') return 'jab';
    if (w === 'bow' || w === 'crossbow' || w === 'staff' || w === 'throwing') return 'bash';
    return 'swing';
  }

  private heroWeapon: WeaponLook | null = null;

  /** Hard hits throw the figure back instead of a flinch. */
  knock(id: string | undefined): void {
    this.v(id)?.actor.play('knockback', 1.6);
  }

  private kindOf(id: string): Ent['kind'] {
    return this.kinds.get(id) ?? 'minion';
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
      const g = glide({ x: v.x / CELL, z: v.z / CELL }, { x: v.tx / CELL, z: v.tz / CELL }, step);
      v.x = g.x * CELL;
      v.z = g.z * CELL;
      const moved = Math.hypot(v.x - px, v.z - pz);
      v.runHold = moved > 1e-4 ? 0.16 : Math.max(0, v.runHold - step);
      v.yaw = turnToward(v.yaw, v.facing, step);
      if (v.offT > 0) {
        v.offT -= step;
        const k = Math.max(0, v.offT / LUNGE_SEC);
        v.actor.root.position.set(v.x + v.ox * k, 0, v.z + v.oz * k);
      } else v.actor.root.position.set(v.x, 0, v.z);
      v.actor.root.rotation.y = Math.PI / 2 - v.yaw;
      if (!v.dead) v.actor.setLocomotion(v.runHold > 0);
      v.actor.update(step);
    }
  }

  dispose(): void {
    for (const v of this.views.values()) v.actor.dispose();
    this.views.clear();
    this.root.clear();
  }
}
