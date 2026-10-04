import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
/** Cached source assets are shared; deck instances own only their generated meshes. */
export class ShipKit {
  private static pending: Promise<ShipKit> | undefined;
  private constructor(private readonly scene: THREE.Group, private readonly deck: THREE.Group, readonly textures: Record<'floor' | 'wall' | 'red', THREE.Texture>) {}
  static load(base: string): Promise<ShipKit> {
    return this.pending ??= this.loadAssets(base).catch((e: unknown) => { this.pending = undefined; throw e; });
  }
  private static async loadAssets(base: string): Promise<ShipKit> {
    const [gltf, deck, ...maps] = await Promise.all([
      new GLTFLoader().loadAsync(`${base}assets/models/scifi/ship.glb`),
      new GLTFLoader().loadAsync(`${base}assets/models/scifi/deck.glb`),
      ...(['floor', 'wall', 'red'] as const).map(n => new THREE.TextureLoader().loadAsync(`${base}assets/textures/ship/trim_${n}.jpg`)),
    ]);
    for (const t of maps) { t.colorSpace = THREE.SRGBColorSpace; t.wrapS = t.wrapT = THREE.RepeatWrapping; }
    return new ShipKit(gltf.scene, deck.scene, { floor: maps[0]!, wall: maps[1]!, red: maps[2]! });
  }
  /** A MegaKit module (4 m grid) as built, for the caller to scale onto a 1 m cell. */
  module(name: string): THREE.Object3D {
    const src = this.deck.getObjectByName(name);
    if (!src) throw new Error(`Deck module missing: ${name}`);
    const obj = src.clone(true);
    obj.position.set(0, 0, 0);
    obj.traverse((o) => { if ((o as THREE.Mesh).isMesh) (o as THREE.Mesh).receiveShadow = true; });
    return obj;
  }

  make(name: string, height: number, width = 0.9): THREE.Group {
    const src = this.scene.getObjectByName(name);
    if (!src) throw new Error(`Ship prop missing: ${name}`);
    const obj = src.clone(true);
    obj.position.set(0, 0, 0);
    const box = new THREE.Box3().setFromObject(obj);
    const size = box.getSize(new THREE.Vector3());
    const scale = Math.min(height / Math.max(size.y, 0.001), width / Math.max(size.x, size.z, 0.001));
    obj.scale.multiplyScalar(scale);
    obj.position.set(-(box.min.x + size.x / 2) * scale, -box.min.y * scale, -(box.min.z + size.z / 2) * scale);
    const group = new THREE.Group(); group.add(obj); return group;
  }
}
