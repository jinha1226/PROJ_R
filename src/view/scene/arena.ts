import * as THREE from 'three';
import { createRng } from '../../core/rng';
import type { Obstacle } from '../../sim/battle/types';

function groundTexture(seed: number): THREE.CanvasTexture {
  const size = 1024;
  const c = document.createElement('canvas');
  c.width = c.height = size;
  const g = c.getContext('2d')!;
  const rng = createRng(seed);
  g.fillStyle = '#6e5c3f';
  g.fillRect(0, 0, size, size);
  const blot = (color: string, n: number, rMin: number, rMax: number, alpha: number) => {
    g.fillStyle = color;
    for (let i = 0; i < n; i++) {
      g.globalAlpha = alpha * (0.4 + rng.next() * 0.6);
      g.beginPath();
      g.arc(rng.next() * size, rng.next() * size, rMin + rng.next() * (rMax - rMin), 0, Math.PI * 2);
      g.fill();
    }
  };
  blot('#5f6b38', 260, 20, 90, 0.35);
  blot('#4f5a2e', 160, 10, 50, 0.4);
  blot('#85704c', 220, 8, 40, 0.35);
  blot('#3e3426', 400, 2, 6, 0.5);
  blot('#a08a62', 300, 1, 4, 0.5);
  g.globalAlpha = 1;
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  return tex;
}

const stoneMat = new THREE.MeshStandardMaterial({ color: '#8a8478', roughness: 0.95, flatShading: true });

function rock(r: number): THREE.Mesh {
  const m = new THREE.Mesh(new THREE.DodecahedronGeometry(r, 0), stoneMat);
  m.scale.y = 0.6;
  m.castShadow = true;
  m.receiveShadow = true;
  return m;
}

export function buildArena(scene: THREE.Scene, obstacles: Obstacle[], seed = 7): void {
  const ground = new THREE.Mesh(
    new THREE.PlaneGeometry(34, 24),
    new THREE.MeshStandardMaterial({ map: groundTexture(seed), roughness: 1 }),
  );
  ground.rotation.x = -Math.PI / 2;
  ground.receiveShadow = true;
  scene.add(ground);

  const rng = createRng(seed + 1);
  const border = (x: number, z: number) => {
    const s = rock(0.25 + rng.next() * 0.35);
    s.position.set(x + (rng.next() - 0.5) * 0.4, 0.05, z + (rng.next() - 0.5) * 0.4);
    s.rotation.y = rng.next() * Math.PI;
    scene.add(s);
  };
  for (let x = -12.5; x <= 12.5; x += 1.1) { border(x, -7.6); border(x, 7.6); }
  for (let z = -6.5; z <= 6.5; z += 1.1) { border(-12.8, z); border(12.8, z); }

  for (const o of obstacles) {
    let m: THREE.Mesh;
    if (o.kind === 'rock') {
      m = rock(o.radius * 1.05);
      m.position.set(o.pos.x, o.radius * 0.35, o.pos.y);
      m.rotation.y = rng.next() * Math.PI;
    } else {
      m = new THREE.Mesh(new THREE.CylinderGeometry(o.radius * 0.8, o.radius, 2.6, 6), stoneMat);
      m.position.set(o.pos.x, 1.3, o.pos.y);
      m.castShadow = true;
      m.receiveShadow = true;
    }
    scene.add(m);
  }
}
