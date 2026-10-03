import * as THREE from 'three';
import type { Ent } from '../../sim/grid/types';

type Health = Pick<Ent, 'hp' | 'maxHp' | 'alive' | 'elite'>;
export function barState(e: Health): { show: boolean; frac: number; elite: boolean } {
  return { show: e.alive && (e.hp < e.maxHp || !!e.elite), frac: e.maxHp > 0 ? Math.max(0, Math.min(1, e.hp / e.maxHp)) : 0, elite: !!e.elite };
}

/** Sprites face the camera and share Three's sprite geometry and these materials. */
export class HpBars {
  private readonly back = new THREE.SpriteMaterial({ color: '#211b20', depthTest: false });
  private readonly red = new THREE.SpriteMaterial({ color: '#d84444', depthTest: false });
  private readonly gold = new THREE.SpriteMaterial({ color: '#e0b344', depthTest: false });

  create(height: number): THREE.Group {
    const root = new THREE.Group();
    root.position.y = height;
    for (const [i, material] of [this.gold, this.back, this.red].entries()) {
      const sprite = new THREE.Sprite(material);
      sprite.renderOrder = 10 + i;
      root.add(sprite);
    }
    return root;
  }

  update(root: THREE.Group, e: Health): void {
    const state = barState(e);
    root.visible = state.show;
    const [frame, back, fill] = root.children as THREE.Sprite[];
    frame!.visible = state.elite;
    frame!.scale.set(0.84, 0.13, 1);
    back!.scale.set(0.8, 0.09, 1);
    fill!.scale.set(0.76 * state.frac, 0.055, 1);
    // Sprite centre anchors the fill at its left edge in camera space.
    fill!.center.set(0.5 / Math.max(state.frac, 1e-9), 0.5);
    fill!.visible = state.frac > 0;
  }

  dispose(): void { this.back.dispose(); this.red.dispose(); this.gold.dispose(); }
}
