import * as THREE from 'three';
import { idx, type GridState } from '../../sim/grid/types';
import { CELL } from './gridTerrain';
import { weaponMesh } from './weaponMeshes';

const POTION_HEX: Record<string, string> = { 붉은: '#e0403a', 푸른: '#3a70e0', 초록: '#3ac060', 노란: '#e8d040', 보라: '#9a50d8', 주황: '#f08a30', 검은: '#3a3540', 하얀: '#f0f0f0', 분홍: '#f080b0', 은빛: '#b8c0c8' };

/** Things lying on the floor (dropped, thrown, the weapon rack): a weapon on its side with a soft ring. */
export class GridItems {
  readonly root = new THREE.Group();
  private key = '';
  private t = 0;

  sync(s: GridState): void {
    const key = JSON.stringify(s.floorItems.map((f) => [f.pos, f.item.name]));
    if (key !== this.key) {
      this.key = key;
      this.clear();
      for (const f of s.floorItems) {
        const g = new THREE.Group();
        const it = f.item;
        // a rune stone glows violet; a potion is a small bottle in its run colour, a scroll a rolled sheet; armour is a grey plate
        const model = it.kind === 'weapon' ? weaponMesh(it.group)
          : it.kind === 'potion' ? new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.12, 0.3, 8), new THREE.MeshStandardMaterial({ color: POTION_HEX[s.lore.colors[it.p]] ?? '#d0d0d0', emissive: POTION_HEX[s.lore.colors[it.p]] ?? '#d0d0d0', emissiveIntensity: 0.4 }))
          : it.kind === 'scroll' ? new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.07, 0.4, 8), new THREE.MeshStandardMaterial({ color: '#efe0b0', emissive: '#6a5a30', emissiveIntensity: 0.3 }))
          : it.kind === 'rune' ? new THREE.Mesh(new THREE.OctahedronGeometry(0.16), new THREE.MeshStandardMaterial({ color: '#8a6cff', emissive: '#5a3cff', emissiveIntensity: 0.9 }))
          : new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.12, 0.3), new THREE.MeshStandardMaterial({ color: '#8a8a92', metalness: 0.5 }));
        model.rotation.set(0, 0, Math.PI / 2);
        model.position.y = 0.08;
        // fit within one cell (a spear lying down is otherwise longer than a tile)
        const size = new THREE.Box3().setFromObject(model).getSize(new THREE.Vector3());
        model.scale.multiplyScalar(Math.min(1, 0.8 / Math.max(size.x, size.z, 0.01)));
        const ring = new THREE.Mesh(new THREE.RingGeometry(0.28, 0.36, 24), new THREE.MeshBasicMaterial({ color: '#ffd76a', transparent: true, opacity: 0.55, depthWrite: false }));
        ring.rotation.x = -Math.PI / 2;
        ring.position.y = 0.02;
        g.add(model, ring);
        g.position.set(f.pos.x * CELL, 0, f.pos.y * CELL);
        g.userData.cell = idx(s.map, f.pos);
        this.root.add(g);
      }
    }
    for (const g of this.root.children) g.visible = s.seen[g.userData.cell as number] === 1;
  }

  update(dt: number): void {
    this.t += dt;
    for (const g of this.root.children) g.children[0]!.position.y = 0.08 + Math.sin(this.t * 3 + g.position.x) * 0.03;
  }

  private clear(): void {
    for (const g of [...this.root.children]) {
      this.root.remove(g);
      g.traverse((o) => { if (o instanceof THREE.Mesh) { o.geometry.dispose(); (o.material as THREE.Material).dispose(); } });
    }
  }

  dispose(): void {
    this.clear();
  }
}
