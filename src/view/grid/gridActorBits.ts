import * as THREE from 'three';
import type { Ent } from '../../sim/grid/types';
import type { UalActor, UalLook } from './ualActor';

/** a two-cell leap takes as long as the glide over two cells */
export const LEAP_SEC = 0.28;
export const LEAP_HEIGHT = 0.9;

/** Every kind is the same mannequin: colour, size and the weapon tell them apart. */
export const LOOK: Record<Ent['kind'], UalLook> = {
  hero: { body: '#1d2630', trim: '#2c3946', scale: 1, weapon: 'sword', idle: 'Sword_Idle', suit: true, armor: false },
  minion: { body: '#d8d2c0', trim: '#7a7262', scale: 0.92, weapon: 'blade', idle: 'Idle_Loop' },
  archer: { body: '#9fb08a', trim: '#4a5a3a', scale: 0.95, weapon: 'crossbow', idle: 'Idle_Loop' },
  brute: { body: '#8a3a32', trim: '#2a2420', scale: 1.22, weapon: 'axe', shield: true, idle: 'Sword_Idle' },
  ghoul: { body: '#6a8a4a', trim: '#3a2a1a', scale: 0.95, weapon: 'none', idle: 'Zombie_Idle_Loop', run: 'Zombie_Walk_Fwd_Loop' },
  mage: { body: '#5a3a7a', trim: '#2a1a3a', scale: 0.95, weapon: 'none', idle: 'Spell_Simple_Idle_Loop' },
  champion: { body: '#3a3a44', trim: '#d8b040', scale: 1.45, weapon: 'sword', shield: true, idle: 'Sword_Idle' },
};
export const LUNGE = 0.3;

/** The coloured ring under each figure (gold hero and elites, red ordinary foes). */
export function ring(color: string, scale: number): THREE.Mesh {
  const m = new THREE.Mesh(new THREE.RingGeometry(0.32 * scale, 0.4 * scale, 28), new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.8, depthWrite: false }));
  m.rotation.x = -Math.PI / 2;
  m.position.y = 0.03;
  m.userData.ring = true;
  return m;
}
export const LUNGE_SEC = 0.12;
export const SHOVE = 0.15;

/** a clone taking a soul glows and casts this long before it stands up in its new look, which then grows in over POP_SEC */
export const ABSORB_SEC = 0.9;
export const POP_SEC = 0.4;
export const SOUL_GOLD = 0xffd76a;

export interface View {
  actor: UalActor;
  bar: THREE.Group;
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
  /** time left in a leap (the figure arcs up and lands when it runs out) */
  air: number;
  dead: boolean;
  /** seconds since it fell (a fallen foe sinks away after a moment); gone once it has */
  deadFor?: number; gone?: boolean;
}

/** a fallen foe lies this long, then sinks into the floor over this long and is gone (its blood stays) */
export const SINK_AT = 1.3;
export const SINK_SEC = 0.8;
