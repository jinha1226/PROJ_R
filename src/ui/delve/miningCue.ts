import * as THREE from 'three';
import type { DelveParty } from '../../sim/delve/delveSim';
import { dist } from '../../sim/grid/types';
import { entOf } from '../../sim/party/partyCore';
import { clones } from '../../sim/roam/roam';
import type { GridRuntime } from '../../view/grid/gridRuntime';

/** game seconds between swings at an ore vein */
const MINE_BEAT = 0.9;

/** Clones working a vein swing at it in time with the game clock, chips flying off the rock (the sim mines; this shows it). */
export class MiningCue {
  /** game time of each clone's last swing */
  private readonly swungAt = new Map<string, number>();

  update(p: DelveParty, rt: GridRuntime | null): void {
    if (!rt || p.combat) return;
    for (const u of clones(p)) {
      const e = entOf(p, u.id);
      const node = e?.alive && (!u.order || u.order.kind === 'hold') ? p.oreNodes.find((n) => n.left > 0 && dist(n.pos, e.pos) <= 1) : undefined;
      if (!node) { this.swungAt.delete(u.id); continue; }
      if (p.time - (this.swungAt.get(u.id) ?? -9) < MINE_BEAT) continue;
      this.swungAt.set(u.id, p.time);
      const rock = new THREE.Vector3(node.pos.x, 0, node.pos.y);
      rt.actors.lunge(u.id, rock, 'swing');
      rt.fireVfx('dust', rock, '#8a7a68');
      rt.fireVfx('hit', rock, '#c8b8ff');
    }
  }
}
