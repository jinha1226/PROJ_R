import * as THREE from 'three';

/** Rough pixel look: the scene is drawn to a small linear-colour target (one pixel per `px` screen pixels) and blown up with hard edges; a dark one-pixel outline where depth jumps keeps figures and walls apart; tone mapping and sRGB happen on the way out, then colours are slightly posterised. */
export class PixelPass {
  private readonly target = new THREE.WebGLRenderTarget(1, 1, { minFilter: THREE.NearestFilter, magFilter: THREE.NearestFilter, type: THREE.HalfFloatType });
  private readonly quad: THREE.Mesh;
  private readonly scene = new THREE.Scene();
  private readonly cam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
  private readonly size = new THREE.Vector2();

  constructor(private readonly renderer: THREE.WebGLRenderer, private readonly px = 3) {
    this.target.texture.generateMipmaps = false;
    this.target.depthTexture = new THREE.DepthTexture(1, 1);
    const mat = new THREE.ShaderMaterial({
      uniforms: { tex: { value: this.target.texture }, depth: { value: this.target.depthTexture }, texel: { value: new THREE.Vector2(1, 1) }, levels: { value: 28 } },
      vertexShader: 'varying vec2 vUv; void main() { vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }',
      fragmentShader: `uniform sampler2D tex; uniform sampler2D depth; uniform vec2 texel; uniform float levels; varying vec2 vUv;
        float dz(vec2 o) { return texture2D(depth, vUv + o * texel).x; }
        void main() {
          // the camera is orthographic, so depth is linear: a neighbour much farther means this pixel is a figure's or wall's rim
          float d = dz(vec2(0.0));
          float far = max(max(dz(vec2(1.0, 0.0)), dz(vec2(-1.0, 0.0))), max(dz(vec2(0.0, 1.0)), dz(vec2(0.0, -1.0))));
          float rim = step(0.0025, far - d);
          gl_FragColor = vec4(texture2D(tex, vUv).rgb * mix(1.0, 0.22, rim), 1.0);
          #include <tonemapping_fragment>
          #include <colorspace_fragment>
          gl_FragColor.rgb = floor(gl_FragColor.rgb * levels + 0.5) / levels;
        }`,
      depthTest: false, depthWrite: false, toneMapped: true,
    });
    this.quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), mat);
    this.scene.add(this.quad);
  }

  render(scene: THREE.Scene, camera: THREE.Camera): void {
    const r = this.renderer;
    r.getSize(this.size);
    const h = Math.max(120, Math.round(this.size.y / this.px));
    const w = Math.max(1, Math.round(this.size.x / this.px));
    if (this.target.width !== w || this.target.height !== h) {
      this.target.setSize(w, h);
      ((this.quad.material as THREE.ShaderMaterial).uniforms.texel!.value as THREE.Vector2).set(1 / w, 1 / h);
    }
    r.setRenderTarget(this.target);
    r.render(scene, camera);
    r.setRenderTarget(null);
    r.render(this.scene, this.cam);
  }

  dispose(): void {
    this.target.dispose();
    this.quad.geometry.dispose();
    (this.quad.material as THREE.Material).dispose();
  }
}
