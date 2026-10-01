import * as THREE from 'three';
import type { TelegraphSnap } from '../../sim/battle/types';

const COLORS = { enemy: '#ff4a32', ally: '#4aa3ff' } as const;

interface TelMesh {
  group: THREE.Group;
  fill: THREE.Mesh;
}

function outlineAndFill(t: TelegraphSnap): { outline: THREE.BufferGeometry; fill: THREE.BufferGeometry } {
  const a = t.area;
  const m = t.areaMult;
  if (a.shape === 'circle') {
    return { outline: new THREE.RingGeometry(a.radius * m - 0.08, a.radius * m, 48), fill: new THREE.CircleGeometry(a.radius * m, 48) };
  }
  if (a.shape === 'cone') {
    const th = (a.angleDeg * Math.PI) / 180;
    return {
      outline: new THREE.RingGeometry(a.radius * m - 0.08, a.radius * m, 32, 1, -th / 2, th),
      fill: new THREE.CircleGeometry(a.radius * m, 32, -th / 2, th),
    };
  }
  const outline = new THREE.PlaneGeometry(a.length * m, a.width * m);
  outline.translate((a.length * m) / 2, 0, 0);
  const fill = new THREE.PlaneGeometry(a.length * m, a.width * m);
  fill.translate((a.length * m) / 2, 0, 0);
  return { outline, fill };
}

export class TelegraphFx {
  private readonly meshes = new Map<number, TelMesh>();

  constructor(private readonly scene: THREE.Scene) {}

  sync(list: TelegraphSnap[]): void {
    const seen = new Set<number>();
    for (const t of list) {
      seen.add(t.id);
      let m = this.meshes.get(t.id);
      if (!m) m = this.create(t);
      const k = Math.max(0.05, t.progress);
      if (t.area.shape === 'line') m.fill.scale.set(1, k, 1);
      else m.fill.scale.setScalar(k);
      (m.fill.material as THREE.MeshBasicMaterial).opacity = 0.18 + 0.32 * t.progress;
    }
    for (const [id, m] of this.meshes) if (!seen.has(id)) this.remove(id, m);
  }

  private create(t: TelegraphSnap): TelMesh {
    const color = COLORS[t.team === 'ally' ? 'ally' : 'enemy'];
    const { outline, fill } = outlineAndFill(t);
    const lineMat = new THREE.MeshBasicMaterial({ color, transparent: true, opacity: t.area.shape === 'line' ? 0.25 : 0.9, depthWrite: false });
    const fillMat = new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.2, depthWrite: false });
    const group = new THREE.Group();
    const o = new THREE.Mesh(outline, lineMat);
    const f = new THREE.Mesh(fill, fillMat);
    o.rotation.x = f.rotation.x = -Math.PI / 2;
    group.add(o, f);
    group.position.set(t.origin.x, 0.04, t.origin.y);
    group.rotation.y = -Math.atan2(t.dir.y, t.dir.x);
    this.scene.add(group);
    const m = { group, fill: f };
    this.meshes.set(t.id, m);
    return m;
  }

  private remove(id: number, m: TelMesh): void {
    m.group.traverse((o) => {
      const mesh = o as THREE.Mesh;
      if (mesh.isMesh) { mesh.geometry.dispose(); (mesh.material as THREE.Material).dispose(); }
    });
    this.scene.remove(m.group);
    this.meshes.delete(id);
  }

  dispose(): void {
    for (const [id, m] of this.meshes) this.remove(id, m);
  }
}
