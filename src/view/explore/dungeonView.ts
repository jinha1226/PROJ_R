import * as THREE from 'three';
import type { Dir, Exploration, Room } from '../../sim/explore/types';
import { ROOM_PITCH } from '../../sim/explore/space';
export { ROOM_PITCH };
import type { EnvLibrary } from './envAssets';
import { buildRoom } from './roomMesh';
import { THEME_KITS } from './themeKit';

const DOOR_OFFSET: Record<Dir, [number, number]> = { n: [0, -7], s: [0, 7], e: [12, 0], w: [-12, 0] };

export const roomOrigin = (r: Room): { x: number; z: number } => ({ x: r.gx * ROOM_PITCH.x, z: r.gy * ROOM_PITCH.z });

/** All rooms of an exploration, corridors between doors, and fog over rooms not yet seen. */
export class DungeonView {
  readonly group = new THREE.Group();
  private readonly rooms = new Map<string, { group: THREE.Group; fog: THREE.Mesh; done: boolean }>();
  private readonly fogMat = new THREE.MeshBasicMaterial({ color: '#0b0a0d', transparent: true, opacity: 0.92, depthWrite: false });
  private readonly hintMat = new THREE.MeshBasicMaterial({ color: '#0b0a0d', transparent: true, opacity: 0.6, depthWrite: false });
  private t = 0;

  constructor(private readonly scene: THREE.Scene, private e: Exploration, private readonly env: EnvLibrary) {
    scene.add(this.group);
    scene.background = new THREE.Color(THEME_KITS[e.theme].sky);
    this.corridors();
    for (const r of Object.values(e.rooms)) this.addRoom(r);
    this.update(e);
  }

  private addRoom(r: Room): void {
    const o = roomOrigin(r);
    const g = buildRoom(r, this.e.theme, this.env);
    g.position.set(o.x, 0, o.z);
    const fog = new THREE.Mesh(new THREE.BoxGeometry(24.4, 6, 14.4), this.fogMat);
    fog.position.set(o.x, 3, o.z);
    this.group.add(g, fog);
    this.rooms.set(r.id, { group: g, fog, done: r.done });
  }

  private corridors(): void {
    const mat = new THREE.MeshStandardMaterial({ color: THEME_KITS[this.e.theme].groundAccent, roughness: 1 });
    const seen = new Set<string>();
    for (const r of Object.values(this.e.rooms))
      for (const [dir, to] of Object.entries(r.doors) as [Dir, string][]) {
        const key = [r.id, to].sort().join('|');
        if (seen.has(key)) continue;
        seen.add(key);
        const o = roomOrigin(r);
        const [dx, dz] = DOOR_OFFSET[dir];
        const horizontal = dir === 'e' || dir === 'w';
        const len = horizontal ? ROOM_PITCH.x - 24 : ROOM_PITCH.z - 14;
        const strip = new THREE.Mesh(new THREE.PlaneGeometry(horizontal ? len + 1 : 3.4, horizontal ? 3.4 : len + 1), mat);
        strip.rotation.x = -Math.PI / 2;
        strip.position.set(o.x + dx + Math.sign(dx) * len / 2, 0.005, o.z + dz + Math.sign(dz) * len / 2);
        strip.receiveShadow = true;
        this.group.add(strip);
      }
  }

  /** Rebuild rooms whose state changed (chest opened, enemies cleared) and refresh fog. */
  update(e: Exploration): void {
    this.e = e;
    const visited = new Set(e.visited);
    const near = new Set(e.visited.flatMap((id) => Object.values(e.rooms[id]!.doors)));
    for (const r of Object.values(e.rooms)) {
      const entry = this.rooms.get(r.id)!;
      if (entry.done !== r.done) {
        this.group.remove(entry.group, entry.fog);
        this.addRoom(r);
      }
      const cur = this.rooms.get(r.id)!;
      cur.fog.visible = !visited.has(r.id);
      cur.fog.material = near.has(r.id) ? this.hintMat : this.fogMat;
    }
  }

  tick(dt: number): void {
    this.t += dt;
    this.group.traverse((o) => { if (o.userData.bob) o.position.y = 1.2 + Math.sin(this.t * 2) * 0.15; });
  }

  dispose(): void {
    this.scene.remove(this.group);
    this.group.traverse((o) => {
      const m = o as THREE.Mesh;
      if (m.isMesh) m.geometry.dispose();
    });
    this.fogMat.dispose();
    this.hintMat.dispose();
  }
}
