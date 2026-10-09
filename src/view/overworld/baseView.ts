import * as THREE from 'three';
import { domeMax, domeR, domeUp } from '../../sim/base/siege';
import type { WorldParty } from '../../sim/overworld/worldSim';
import { DomeView } from './domeView';
import { ModuleViews } from './moduleView';

/** What stands on the base's ground: its modules (moduleView.ts) and the dome over them (domeView.ts). */
export class BaseView {
  readonly root = new THREE.Group();
  readonly modules: ModuleViews;
  readonly dome = new DomeView();

  constructor(base: string) { this.modules = new ModuleViews(base); this.root.add(this.modules.root, this.dome.root); }

  /** The scene is made to match the base: the modules where they stand, the dome as strong as it is. */
  sync(p: WorldParty, dt = 0): void {
    this.modules.sync(p.modules ?? [], dt);
    const s = p.siege;
    this.dome.root.visible = !!s && this.modules.up;
    if (s) this.dome.sync({ x: p.base.x + 1, y: p.base.y + 1 }, domeR(p), s.domeHp, domeMax(p), domeUp(p), dt);
  }

  dispose(): void {
    this.modules.dispose();
    this.root.clear();
  }
}
