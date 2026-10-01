import * as THREE from 'three';

export function addLighting(scene: THREE.Scene): void {
  scene.add(new THREE.HemisphereLight('#fff6e6', '#6a5c48', 1.4));
  const sun = new THREE.DirectionalLight('#ffe8c0', 2.6);
  sun.position.set(-8, 14, 6);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  const cam = sun.shadow.camera;
  cam.left = -16; cam.right = 16; cam.top = 12; cam.bottom = -12; cam.near = 1; cam.far = 50;
  sun.shadow.bias = -0.0005;
  scene.add(sun);
  scene.add(sun.target);
}
