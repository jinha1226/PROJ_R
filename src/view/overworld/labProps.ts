import * as THREE from 'three';

/**
 * The lab's figure: a steel deck with the clone printer on it (a glass vat of cyan fluid on a steel foot, a capped top) and
 * a console beside it. Its middle is the middle of the lab's four cells. `rig` is what rises when the lab unfolds.
 */
export function labFigure(): { root: THREE.Group; rig: THREE.Group } {
  const root = new THREE.Group(), rig = new THREE.Group();
  const steel = new THREE.MeshLambertMaterial({ color: '#6a727c' });
  const dark = new THREE.MeshLambertMaterial({ color: '#2e343c' });
  const deck = new THREE.Mesh(new THREE.BoxGeometry(1.8, 0.08, 1.8), dark);
  deck.position.y = 0.04;
  const foot = new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.46, 0.26, 16), steel);
  foot.position.y = 0.21;
  const fluid = new THREE.Mesh(new THREE.CylinderGeometry(0.27, 0.27, 1.1, 16), new THREE.MeshBasicMaterial({ color: '#2ad0e8', transparent: true, opacity: 0.9, depthWrite: false }));
  fluid.position.y = 0.92;
  const glass = new THREE.Mesh(new THREE.CylinderGeometry(0.34, 0.34, 1.3, 16, 1, true), new THREE.MeshBasicMaterial({ color: '#8ff0ff', transparent: true, opacity: 0.08, depthWrite: false, side: THREE.DoubleSide }));
  glass.position.y = 0.99;
  const cap = new THREE.Mesh(new THREE.CylinderGeometry(0.4, 0.42, 0.2, 16), steel);
  cap.position.y = 1.74;
  const lamp = new THREE.Mesh(new THREE.SphereGeometry(0.08, 8, 6), new THREE.MeshBasicMaterial({ color: '#5ae0ff' }));
  lamp.position.y = 1.9;
  const console = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.62, 0.3), steel);
  console.position.set(0.62, 0.39, 0.3);
  const screen = new THREE.Mesh(new THREE.PlaneGeometry(0.26, 0.18), new THREE.MeshBasicMaterial({ color: '#5dff8a' }));
  screen.position.set(0.62, 0.6, 0.46);
  for (const m of [deck, foot, cap, console]) { m.castShadow = true; m.receiveShadow = true; }
  rig.add(foot, fluid, glass, cap, lamp, console, screen);
  root.add(deck, rig);
  return { root, rig };
}
