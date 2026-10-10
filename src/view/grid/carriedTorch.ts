import * as THREE from 'three';
import type { GridActors } from './gridActors';
import { haloMaterial } from './gridTorches';
import { SHADE } from './floorShades';
import { DARK } from './zoneLook';

/**
 * `?dark`: the fire the clone carries, seen — a torch in its off hand (a stick, a flame, a glow). It also tells the floor shades
 * where the fire is, so every figure's and column's shadow falls away from it and swings round as the clone walks.
 */
export class CarriedTorch {
  readonly root = new THREE.Group();
  private readonly flame: THREE.Mesh;
  private readonly hand = new THREE.Vector3();

  constructor() {
    const stick = new THREE.Mesh(new THREE.CylinderGeometry(0.022, 0.03, 0.5, 6), new THREE.MeshStandardMaterial({ color: '#4a3424', roughness: 1 }));
    stick.position.y = 0.25;
    this.flame = new THREE.Mesh(new THREE.SphereGeometry(0.075, 8, 6), new THREE.MeshBasicMaterial({ color: '#ffc878', transparent: true, opacity: 0.95, blending: THREE.AdditiveBlending, depthWrite: false }));
    this.flame.position.y = 0.56;
    const glow = new THREE.Sprite(haloMaterial().clone());
    glow.material.color.set(DARK.torch.color);
    glow.scale.setScalar(1.8);
    this.flame.add(glow);
    this.root.add(stick, this.flame);
  }

  /** The torch follows the clone's off hand; the shades are thrown from where the light hangs. */
  update(lamp: THREE.Vector3, t: number, focus: string, actors: GridActors): void {
    const held = actors.shown(focus) ? actors.handOf(focus, this.hand) : undefined;
    this.root.visible = !!held;
    if (held) { this.root.position.copy(held); const f = 1 + Math.sin(t * 11) * 0.12 + Math.sin(t * 23) * 0.08; this.flame.scale.set(1, f * 1.4, 1); }
    SHADE.lamp.value.set(lamp.x, DARK.cast, lamp.z);
  }
}
