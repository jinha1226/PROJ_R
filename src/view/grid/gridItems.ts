import * as THREE from 'three';
import { idx, type GridState } from '../../sim/grid/types';
import { CELL } from './gridTerrain';
import { weaponMesh } from './weaponMeshes';
import { MATERIAL_HEX, materialMesh } from './toolGates';

const POTION_HEX: Record<string, string> = { 붉은: '#e0403a', 푸른: '#3a70e0', 초록: '#3ac060', 노란: '#e8d040', 보라: '#9a50d8', 주황: '#f08a30', 검은: '#3a3540', 하얀: '#f0f0f0', 분홍: '#f080b0', 은빛: '#b8c0c8' };

/** Items lying on the floor: a weapon on its side with a soft ring. */
export class GridItems {
  readonly root = new THREE.Group();
  private key = '';
  private t = 0;

  sync(s: GridState): void {
    const key = JSON.stringify(s.floorItems.map((f) => [f.pos, f.item]));
    if (key !== this.key) {
      this.key = key;
      this.clear();
      for (const f of s.floorItems) {
        const g = new THREE.Group();
        const it = f.item;
        // a potion is a small bottle in its run colour, a scroll a rolled sheet; armour is a grey plate
        const model = it.kind === 'weapon' ? weaponMesh(it.group)
          : it.kind === 'potion' ? new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.12, 0.3, 8), new THREE.MeshStandardMaterial({ color: POTION_HEX[s.lore.colors[it.p]] ?? '#d0d0d0', emissive: POTION_HEX[s.lore.colors[it.p]] ?? '#d0d0d0', emissiveIntensity: 0.4 }))
          : it.kind === 'scroll' ? new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.07, 0.4, 8), new THREE.MeshStandardMaterial({ color: '#efe0b0', emissive: '#6a5a30', emissiveIntensity: 0.3 }))
          : it.kind === 'suit' ? new THREE.Mesh(new THREE.CapsuleGeometry(0.16, 0.34, 4, 8), new THREE.MeshStandardMaterial({ color: '#7fd8ff', emissive: '#2a9ad8', emissiveIntensity: 1.1 }))
          : it.kind === 'core' ? new THREE.Mesh(new THREE.OctahedronGeometry(0.3), new THREE.MeshStandardMaterial({ color: '#5ae0ff', emissive: '#5ae0ff', emissiveIntensity: 1.4 }))
          : it.kind === 'material' ? materialMesh(it.mat)
          // a magic stone: a floating violet crystal; a guardian's core is larger and gold
          : it.kind === 'stone' ? new THREE.Mesh(new THREE.OctahedronGeometry(it.id.startsWith('guardian') ? 0.28 : 0.2).scale(1, 1.5, 1), new THREE.MeshStandardMaterial({ color: it.id.startsWith('guardian') ? '#ffd23a' : '#c77dff', emissive: it.id.startsWith('guardian') ? '#ffb000' : '#9a3dff', emissiveIntensity: 1.3 }))
          : new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.12, 0.3), new THREE.MeshStandardMaterial({ color: '#8a8a92', metalness: 0.5 }));
        if (it.kind !== 'material' && it.kind !== 'stone') model.rotation.set(0, 0, Math.PI / 2);
        model.position.y = it.kind === 'core' || it.kind === 'stone' ? 0.5 : 0.08;
        g.userData.core = it.kind === 'core' || it.kind === 'stone';
        // fit within one cell (a spear lying down is otherwise longer than a tile)
        const size = new THREE.Box3().setFromObject(model).getSize(new THREE.Vector3());
        model.scale.multiplyScalar(Math.min(1, 0.8 / Math.max(size.x, size.z, 0.01)));
        const ring = new THREE.Mesh(new THREE.RingGeometry(0.28, 0.36, 24), new THREE.MeshBasicMaterial({ color: it.kind === 'core' || it.kind === 'suit' ? '#5ae0ff' : it.kind === 'stone' ? '#c77dff' : it.kind === 'material' ? MATERIAL_HEX[it.mat] ?? '#ffd76a' : '#ffd76a', transparent: true, opacity: 0.55, depthWrite: false }));
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
    for (const g of this.root.children) {
      const model = g.children[0]!;
      model.position.y = (g.userData.core ? 0.5 : 0.08) + Math.sin(this.t * 3 + g.position.x) * 0.03;
      if (g.userData.core) model.rotation.y += dt * 0.6;
    }
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
