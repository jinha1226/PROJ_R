import * as THREE from 'three';
import type { Dir, Room } from '../../sim/explore/types';
import type { Theme } from '../../sim/run/types';
import type { EnvLibrary } from './envAssets';
import { THEME_KITS, boundarySegments } from './themeKit';

const W = 24;
const H = 14;
const pick = <T,>(list: T[], i: number): T => list[i % list.length]!;

function ground(theme: Theme): THREE.Mesh {
  const kit = THEME_KITS[theme];
  const c = document.createElement('canvas');
  c.width = 512; c.height = 300;
  const g = c.getContext('2d')!;
  g.fillStyle = kit.ground;
  g.fillRect(0, 0, c.width, c.height);
  let seed = theme.length * 9301;
  const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  g.fillStyle = kit.groundAccent;
  for (let i = 0; i < 160; i++) { g.globalAlpha = 0.25 + rnd() * 0.3; g.beginPath(); g.arc(rnd() * c.width, rnd() * c.height, 3 + rnd() * 18, 0, Math.PI * 2); g.fill(); }
  g.globalAlpha = 1;
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  const m = new THREE.Mesh(new THREE.PlaneGeometry(W, H), new THREE.MeshStandardMaterial({ map: tex, roughness: 1 }));
  m.rotation.x = -Math.PI / 2;
  m.receiveShadow = true;
  return m;
}

function marker(type: Room['type'], env: EnvLibrary, theme: Theme, done: boolean): THREE.Object3D | null {
  const g = new THREE.Group();
  if (type === 'chest' && !done) g.add(env.clone(THEME_KITS[theme].chest, { width: 1.4 }));
  if (type === 'exit') {
    const ring = new THREE.Mesh(new THREE.TorusGeometry(1.4, 0.12, 8, 32), new THREE.MeshBasicMaterial({ color: '#7ad08a' }));
    ring.rotation.x = Math.PI / 2;
    ring.position.y = 0.05;
    g.add(ring, env.has('graveyard/arch') ? env.clone('graveyard/arch', { width: 3.4 }) : new THREE.Group());
  }
  if (type === 'campfire' && !done) {
    const fire = new THREE.Mesh(new THREE.ConeGeometry(0.45, 0.9, 7), new THREE.MeshBasicMaterial({ color: '#ff9a3a' }));
    fire.position.y = 0.45;
    const logs = new THREE.Mesh(new THREE.CylinderGeometry(0.6, 0.7, 0.2, 8), new THREE.MeshStandardMaterial({ color: '#5a3a22' }));
    g.add(logs, fire);
  }
  if (type === 'event' && !done) {
    const rune = new THREE.Mesh(new THREE.RingGeometry(0.9, 1.2, 32), new THREE.MeshBasicMaterial({ color: '#b08ae0', transparent: true, opacity: 0.85, side: THREE.DoubleSide }));
    rune.rotation.x = -Math.PI / 2;
    rune.position.y = 0.04;
    const orb = new THREE.Mesh(new THREE.SphereGeometry(0.3, 12, 8), new THREE.MeshBasicMaterial({ color: '#d8b8ff' }));
    orb.position.y = 1.2;
    orb.userData.bob = true;
    g.add(rune, orb);
  }
  g.userData.marker = type;
  return g.children.length ? g : null;
}

/** One room (room-local origin at its center): ground, themed boundary with door gaps, cover props, and room markers. */
export function buildRoom(room: Room, theme: Theme, env: EnvLibrary): THREE.Group {
  const kit = THEME_KITS[theme];
  const group = new THREE.Group();
  group.add(ground(theme));
  if (kit.floorTile && env.has(kit.floorTile.key))
    for (let x = -W / 2 + 2; x < W / 2; x += kit.floorTile.size)
      for (let y = -H / 2 + 2; y < H / 2; y += kit.floorTile.size) {
        const t = env.clone(kit.floorTile.key, { width: kit.floorTile.size });
        t.position.set(x, 0.01, y);
        group.add(t);
      }
  boundarySegments(Object.keys(room.doors) as Dir[], kit.boundary.spacing).forEach((s, i) => {
    const piece = env.clone(pick(kit.boundary.keys, i), theme === 'forest' ? { radius: 1.6 } : { width: kit.boundary.spacing });
    piece.position.set(s.x, 0, s.y);
    piece.rotation.y = s.rot;
    group.add(piece);
  });
  room.props.forEach((p, i) => {
    const prop = env.clone(pick(kit.props[p.kind] ?? [], i), { radius: p.r });
    prop.position.set(p.x, 0, p.y);
    prop.rotation.y = (i * 1.7) % (Math.PI * 2);
    group.add(prop);
  });
  const m = marker(room.type, env, theme, room.done);
  if (m) group.add(m);
  return group;
}
