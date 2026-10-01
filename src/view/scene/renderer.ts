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
    renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true });
  } catch {
    throw new Error('webgl-unavailable');
  }
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;
  renderer.domElement.className = 'battle-canvas';
  container.appendChild(renderer.domElement);

  const scene = new THREE.Scene();
  scene.background = new THREE.Color('#2a2620');
  scene.fog = new THREE.Fog('#2a2620', 40, 70);
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
