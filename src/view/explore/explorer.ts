import type { InputState } from '../../app/input/input';
import { DOOR_POS } from '../../sim/explore/generate';
import { canStand, roomAt, ROOM_PITCH } from '../../sim/explore/space';
import type { Dir, Exploration } from '../../sim/explore/types';
import type { Actor } from '../actors/actor';
import { Trail } from './partyTrail';
import type { IsoCamera } from './exploreCamera';

const SPEED = 4.2;
const SPACING = 1.3;
const REACH = 2.4;

export interface ExplorerHooks {
  /** Called when the leader crosses into another room; return false to push the leader back. */
  enterRoom(roomId: string): boolean;
}

/** Walks the leader with input (sliding along obstacles), trails followers, and reports nearby interactables. */
export class Explorer {
  pos: { x: number; z: number };
  private facing = 0;
  private readonly trail = new Trail();
  private room: string;
  paused = false;

  constructor(private e: Exploration, private readonly leader: Actor, private readonly followers: Actor[], private readonly cam: IsoCamera, private readonly hooks: ExplorerHooks) {
    this.room = e.at;
    this.pos = this.entryPoint(e);
    this.trail.reset(this.pos);
    this.place(0);
  }

  /** Inside the current room, just past the door we came in (room center for the start room). */
  entryPoint(e: Exploration): { x: number; z: number } {
    const r = e.rooms[e.at]!;
    const o = { x: r.gx * ROOM_PITCH.x, z: r.gy * ROOM_PITCH.z };
    if (!e.enteredFrom) return o;
    const d = DOOR_POS[e.enteredFrom as Dir];
    return { x: o.x + d.x * 0.7, z: o.z + d.y * 0.6 };
  }

  setExploration(e: Exploration, snapToEntry = false): void {
    this.e = e;
    this.room = e.at;
    if (snapToEntry) { this.pos = this.entryPoint(e); this.trail.reset(this.pos); }
  }

  /** Nearest unfinished room marker (chest/event/campfire/exit) within reach. */
  nearby(): string | null {
    const r = this.e.rooms[this.room];
    if (!r || r.done || !['chest', 'event', 'campfire', 'exit'].includes(r.type)) return null;
    const o = { x: r.gx * ROOM_PITCH.x, z: r.gy * ROOM_PITCH.z };
    return Math.hypot(this.pos.x - o.x, this.pos.z - o.z) <= REACH ? r.type : null;
  }

  update(dt: number, input: InputState): void {
    if (!this.paused) this.walk(dt, input);
    this.place(dt);
    this.cam.follow(this.pos.x, this.pos.z, dt);
  }

  private walk(dt: number, input: InputState): void {
    const { right, down } = this.cam.axes();
    const vx = (right.x * input.move.x + down.x * input.move.y) * SPEED * dt;
    const vz = (right.z * input.move.x + down.z * input.move.y) * SPEED * dt;
    if (vx === 0 && vz === 0) return;
    const prev = { ...this.pos };
    if (canStand(this.e, this.pos.x + vx, this.pos.z)) this.pos.x += vx;
    if (canStand(this.e, this.pos.x, this.pos.z + vz)) this.pos.z += vz;
    this.facing = Math.atan2(vz, vx);
    const now = roomAt(this.e, this.pos.x, this.pos.z);
    if (now && now !== this.room) {
      if (this.hooks.enterRoom(now)) this.room = now;
      else this.pos = prev;
    }
    this.trail.push(this.pos);
  }

  private place(dt: number): void {
    const moving = (a: Actor, x: number, z: number) => Math.hypot(a.root.position.x - x, a.root.position.z - z) / Math.max(dt, 1e-3);
    const ls = moving(this.leader, this.pos.x, this.pos.z);
    this.leader.root.position.set(this.pos.x, 0, this.pos.z);
    this.leader.root.rotation.y = Math.PI / 2 - this.facing;
    this.leader.setLocomotion(ls > 0.5 ? ls : 0);
    this.leader.update(dt);
    this.trail.positions(this.followers.length, SPACING).forEach((p, i) => {
      const a = this.followers[i]!;
      const sp = moving(a, p.x, p.z);
      if (sp > 0.3) a.root.rotation.y = Math.PI / 2 - Math.atan2(p.z - a.root.position.z, p.x - a.root.position.x);
      a.root.position.set(p.x, 0, p.z);
      a.setLocomotion(sp > 0.5 ? sp : 0);
      a.update(dt);
    });
  }
}
