import * as THREE from 'three';

/** One photo-scanned surface (Poly Haven, CC0): colour with occlusion baked in, normal map, roughness. */
export interface StoneSet { diff: THREE.Texture; nor: THREE.Texture; rough: THREE.Texture }

/** Loads a set from `assets/textures/stone/<name>_{diff,nor,rough}.jpg` (textures fill in as they arrive). */
export function loadStone(base: string, name: string): StoneSet {
  const loader = new THREE.TextureLoader();
  const t = (part: string, color: boolean): THREE.Texture => {
    const tex = loader.load(`${base}assets/textures/stone/${name}_${part}.jpg`);
    tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
    tex.anisotropy = 4;
    if (color) tex.colorSpace = THREE.SRGBColorSpace;
    return tex;
  };
  return { diff: t('diff', true), nor: t('nor', false), rough: t('rough', false) };
}

/**
 * A stone material whose texture follows world position, not the mesh's own UVs: a floor tiled cell by cell (or a run of
 * instanced wall panels) shows one continuous surface with no seams or repeats per piece. `metres` is how much ground one
 * texture repeat covers; walls pick the face plane from their world normal.
 */
export function stoneMat(set: StoneSet, metres: number, kind: 'floor' | 'wall', tint = '#ffffff'): THREE.MeshStandardMaterial {
  const m = new THREE.MeshStandardMaterial({ map: set.diff, normalMap: set.nor, roughnessMap: set.rough, color: tint, roughness: 1, metalness: 0 });
  m.normalScale.set(1.4, 1.4);
  m.onBeforeCompile = (sh) => {
    sh.uniforms.uStoneScale = { value: 1 / metres };
    sh.vertexShader = sh.vertexShader
      .replace('void main() {', 'uniform float uStoneScale;\nvoid main() {')
      .replace('#include <fog_vertex>', `#include <fog_vertex>
        {
          vec4 sw = vec4(position, 1.0);
          vec3 sn = normal;
          #ifdef USE_INSTANCING
            sw = instanceMatrix * sw;
            sn = mat3(instanceMatrix) * sn;
          #endif
          sw = modelMatrix * sw;
          sn = normalize(mat3(modelMatrix) * sn);
          vec2 suv = ${kind === 'floor' ? 'sw.xz' : 'abs(sn.y) > 0.7 ? sw.xz : abs(sn.x) > abs(sn.z) ? vec2(sw.z, sw.y) : vec2(sw.x, sw.y)'} * uStoneScale;
          #ifdef USE_MAP
            vMapUv = suv;
          #endif
          #ifdef USE_NORMALMAP
            vNormalMapUv = suv;
          #endif
          #ifdef USE_ROUGHNESSMAP
            vRoughnessMapUv = suv;
          #endif
        }`);
  };
  m.customProgramCacheKey = () => `stone-${kind}-${metres}`;
  return m;
}
