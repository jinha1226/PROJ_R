import * as THREE from 'three';

export function addLighting(scene: THREE.Scene): void {
  scene.add(new THREE.HemisphereLight('#fff4e0', '#3a3428', 0.9));
  const sun = new THREE.DirectionalLight('#ffe2b0', 2.2);
  sun.position.set(-8, 14, 6);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  const cam = sun.shadow.camera;
  cam.left = -16; cam.right = 16; cam.top = 12; cam.bottom = -12; cam.near = 1; cam.far = 50;
  sun.shadow.bias = -0.0005;
  scene.add(sun);
  scene.add(sun.target);
}
