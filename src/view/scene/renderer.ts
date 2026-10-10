import * as THREE from 'three';

export interface SceneHandle {
  renderer: THREE.WebGLRenderer;
  scene: THREE.Scene;
  camera: THREE.OrthographicCamera;
  resize(): void;
  dispose(): void;
}

export function createScene(container: HTMLElement): SceneHandle {
  let renderer: THREE.WebGLRenderer;
  try {
    renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true, stencil: true });
  } catch {
    throw new Error('webgl-unavailable');
  }
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.2;
  renderer.domElement.className = 'battle-canvas';
  container.appendChild(renderer.domElement);

  const scene = new THREE.Scene();
  scene.background = new THREE.Color('#5d5442');
  // camera sits ~60m from the ground: keep fog well beyond that so it only softens the far edges
  scene.fog = new THREE.Fog('#5d5442', 75, 120);
  const camera = new THREE.OrthographicCamera(-10, 10, 6, -6, 0.1, 200);

  const resize = (): void => {
    const w = Math.max(1, container.clientWidth);
    const h = Math.max(1, container.clientHeight);
    renderer.setSize(w, h, false);
    camera.userData.aspect = w / h;
  };
  const ro = new ResizeObserver(resize);
  ro.observe(container);
  resize();

  return {
    renderer, scene, camera, resize,
    dispose: () => {
      ro.disconnect();
      renderer.dispose();
      renderer.domElement.remove();
    },
  };
}
