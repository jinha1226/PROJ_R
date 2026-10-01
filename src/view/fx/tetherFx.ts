import * as THREE from 'three';

const COLORS: Record<string, string> = {
  protect: '#6ac8ff', mentor: '#f0c040', rivalry: '#ff8a2a', revenge: '#ff3030',
  courage: '#f0d060', combo: '#fff0a0', feud: '#b070e0',
};
const LIFE = 1.2;

interface Tether {
  a: string;
  b: string;
  line: THREE.Line;
  life: number;
}

/** Glowing line between two related units that follows them and fades out. */
export class TetherFx {
  private readonly items: Tether[] = [];

  constructor(private readonly scene: THREE.Scene, private readonly posOf: (id: string) => { x: number; z: number } | undefined) {}

  add(a: string, b: string, kind: string): void {
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(new Array(6).fill(0), 3));
    const mat = new THREE.LineBasicMaterial({ color: COLORS[kind] ?? '#ffffff', transparent: true, opacity: 1, depthWrite: false });
    const line = new THREE.Line(geo, mat);
    this.scene.add(line);
    this.items.push({ a, b, line, life: LIFE });
  }

  update(dt: number): void {
    for (let i = this.items.length - 1; i >= 0; i--) {
      const t = this.items[i]!;
      t.life -= dt;
      const pa = this.posOf(t.a);
      const pb = this.posOf(t.b);
      const mat = t.line.material as THREE.LineBasicMaterial;
      if (t.life <= 0 || !pa || !pb) {
        this.scene.remove(t.line);
        t.line.geometry.dispose();
        mat.dispose();
        this.items.splice(i, 1);
        continue;
      }
      const pos = t.line.geometry.getAttribute('position') as THREE.BufferAttribute;
      pos.setXYZ(0, pa.x, 1.2, pa.z);
      pos.setXYZ(1, pb.x, 1.2, pb.z);
      pos.needsUpdate = true;
      t.line.geometry.computeBoundingSphere();
      mat.opacity = Math.min(1, t.life / (LIFE * 0.5));
    }
  }

  dispose(): void {
    while (this.items.length) this.update(LIFE * 10);
  }
}
