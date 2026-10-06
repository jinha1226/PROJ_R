import * as THREE from 'three';

/** A per-cell texture the world's materials read: alpha = darkness (unseen black, remembered dim), green = claimed land. */
export class WorldFog {
  readonly tex: THREE.DataTexture;
  private readonly data: Uint8Array;
  readonly uniforms: { uFog: { value: THREE.DataTexture }; uFogSize: { value: THREE.Vector2 } };

  constructor(readonly w: number, readonly h: number) {
    this.data = new Uint8Array(w * h * 4).fill(0);
    for (let i = 0; i < w * h; i++) this.data[i * 4 + 3] = 255;
    this.tex = new THREE.DataTexture(this.data, w, h, THREE.RGBAFormat);
    this.tex.magFilter = THREE.LinearFilter;
    this.tex.minFilter = THREE.LinearFilter;
    this.tex.needsUpdate = true;
    this.uniforms = { uFog: { value: this.tex }, uFogSize: { value: new THREE.Vector2(w, h) } };
  }

  /** Visible cells are clear, seen ones dim, the rest dark; claimed land is marked for the ground's tint. */
  update(visible: Set<number>, seen: Uint8Array, claimed: Uint8Array): void {
    for (let i = 0; i < this.w * this.h; i++) {
      this.data[i * 4 + 3] = visible.has(i) ? 0 : seen[i] ? 150 : 255;
      this.data[i * 4 + 1] = claimed[i] ? 255 : 0;
    }
    this.tex.needsUpdate = true;
  }

  /** Teaches a material to darken itself by the cell it is drawn over, and to go ashen on land the demon army still holds. */
  apply<T extends THREE.Material>(mat: T, tint = false): T {
    mat.onBeforeCompile = (sh) => {
      Object.assign(sh.uniforms, this.uniforms);
      sh.vertexShader = sh.vertexShader
        .replace('#include <common>', '#include <common>\nvarying vec2 vFogUv;\nuniform vec2 uFogSize;')
        .replace('#include <begin_vertex>', `#include <begin_vertex>
          vec4 fogWp = vec4(transformed, 1.0);
          #ifdef USE_INSTANCING
            fogWp = instanceMatrix * fogWp;
          #endif
          fogWp = modelMatrix * fogWp;
          vFogUv = vec2((fogWp.x + 0.5) / uFogSize.x, (fogWp.z + 0.5) / uFogSize.y);`);
      sh.fragmentShader = sh.fragmentShader
        .replace('#include <common>', '#include <common>\nvarying vec2 vFogUv;\nuniform sampler2D uFog;')
        .replace('#include <dithering_fragment>', `#include <dithering_fragment>
          vec4 fogC = texture2D(uFog, vFogUv);
          // land the demon army holds is ashen and cold; claimed land keeps its colour
          vec3 ash = vec3(dot(gl_FragColor.rgb, vec3(0.3, 0.59, 0.11))) * vec3(0.86, 0.8, 0.88);
          gl_FragColor.rgb = mix(mix(gl_FragColor.rgb, ash, 0.5), gl_FragColor.rgb${tint ? ' * 1.08' : ''}, fogC.g);
          gl_FragColor.rgb *= 1.0 - fogC.a;`);
    };
    mat.customProgramCacheKey = () => `worldFog${tint ? 'T' : ''}`;
    return mat;
  }

  dispose(): void { this.tex.dispose(); }
}
