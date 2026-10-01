import * as THREE from 'three';

/** Dashed ground line from the selected unit to its current target. */
export class TargetLineFx {
  private readonly geo = new THREE.BufferGeometry();
  private readonly line: THREE.Line;
  private readonly mat: THREE.LineDashedMaterial;

  constructor(private readonly scene: THREE.Scene) {
    this.geo.setAttribute('position', new THREE.Float32BufferAttribute([0, 0, 0, 0, 0, 0], 3));
    this.mat = new THREE.LineDashedMaterial({ color: '#4aa3ff', dashSize: 0.35, gapSize: 0.2, transparent: true, opacity: 0.9, depthWrite: false });
    this.line = new THREE.Line(this.geo, this.mat);
    this.line.visible = false;
    scene.add(this.line);
  }

  set(from: { x: number; z: number } | null, to: { x: number; z: number } | null, team: 'ally' | 'enemy' = 'ally'): void {
    if (!from || !to) {
      this.line.visible = false;
      return;
    }
    const pos = this.geo.getAttribute('position') as THREE.BufferAttribute;
    pos.setXYZ(0, from.x, 0.06, from.z);
    pos.setXYZ(1, to.x, 0.06, to.z);
    pos.needsUpdate = true;
    this.geo.computeBoundingSphere();
    this.line.computeLineDistances();
    this.mat.color.set(team === 'ally' ? '#4aa3ff' : '#ff5a4a');
    this.line.visible = true;
  }

  dispose(): void {
    this.scene.remove(this.line);
    this.geo.dispose();
    this.mat.dispose();
  }
}
