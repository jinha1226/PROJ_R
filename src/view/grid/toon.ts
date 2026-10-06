import * as THREE from 'three';

/** Materials figures are drawn with (both carry colour and emissive for flashes, tints and the death darkening). */
export type FigureMat = THREE.MeshStandardMaterial | THREE.MeshToonMaterial;

let ramp: THREE.DataTexture | null = null;
/** Three hard bands of light: shadow, mid, lit — what keeps a figure crisp once the screen is pixelated. */
function toonRamp(): THREE.DataTexture {
  if (ramp) return ramp;
  const bands = new Uint8Array([70, 70, 70, 255, 165, 165, 165, 255, 255, 255, 255, 255]);
  ramp = new THREE.DataTexture(bands, 3, 1, THREE.RGBAFormat);
  ramp.minFilter = ramp.magFilter = THREE.NearestFilter;
  ramp.needsUpdate = true;
  return ramp;
}

/** A banded material with a rim of light on the edges facing away from the camera, so the figure stands off a dark floor. */
export function toonMat(color: string, rim = '#9fd8ff', rimStrength = 0.55, map?: THREE.Texture): THREE.MeshToonMaterial {
  const m = new THREE.MeshToonMaterial({ color, gradientMap: toonRamp(), map: map ?? null });
  const rimColor = new THREE.Color(rim).multiplyScalar(rimStrength);
  m.onBeforeCompile = (sh) => {
    sh.uniforms.uRim = { value: rimColor };
    sh.fragmentShader = sh.fragmentShader
      .replace('void main() {', 'uniform vec3 uRim;\nvoid main() {')
      .replace('#include <emissivemap_fragment>', `#include <emissivemap_fragment>
        { float facing = clamp(dot(normalize(vNormal), normalize(vViewPosition)), 0.0, 1.0);
          totalEmissiveRadiance += uRim * pow(1.0 - facing, 3.0); }`);
  };
  m.customProgramCacheKey = () => `toon-rim-${rim}-${rimStrength}`;
  return m;
}

/**
 * A dark shell around every mesh of a figure (the inverted-hull trick): the same geometry drawn back faces only, pushed out
 * along its normals by `worldThick` metres. Skinned meshes get a skinned shell bound to the same skeleton, so it animates too.
 * Call once the figure's parts are all attached (rest pose).
 */
export function addOutlines(model: THREE.Object3D, worldThick: number, color = '#040608'): void {
  model.updateMatrixWorld(true);
  const meshes: THREE.Mesh[] = [];
  model.traverse((o) => { if ((o as THREE.Mesh).isMesh && !o.userData.outline) meshes.push(o as THREE.Mesh); });
  for (const m of meshes) {
    const s = m.getWorldScale(new THREE.Vector3());
    const thick = worldThick / Math.max(1e-6, (s.x + s.y + s.z) / 3);
    const mat = new THREE.MeshBasicMaterial({ color, side: THREE.BackSide });
    mat.onBeforeCompile = (sh) => {
      sh.uniforms.uThick = { value: thick };
      sh.vertexShader = sh.vertexShader
        .replace('void main() {', 'uniform float uThick;\nvoid main() {')
        .replace('#include <begin_vertex>', '#include <begin_vertex>\n  transformed += normalize(normal) * uThick;');
    };
    mat.customProgramCacheKey = () => 'outline-hull';
    let hull: THREE.Mesh;
    if ((m as THREE.SkinnedMesh).isSkinnedMesh) {
      const sm = m as THREE.SkinnedMesh;
      const sk = new THREE.SkinnedMesh(sm.geometry, mat);
      sk.bind(sm.skeleton, sm.bindMatrix);
      sk.position.copy(sm.position); sk.quaternion.copy(sm.quaternion); sk.scale.copy(sm.scale);
      sk.frustumCulled = sm.frustumCulled;
      sm.parent!.add(sk);
      hull = sk;
    } else {
      hull = new THREE.Mesh(m.geometry, mat);
      m.add(hull);
    }
    hull.userData.outline = true;
    hull.castShadow = false;
  }
}
