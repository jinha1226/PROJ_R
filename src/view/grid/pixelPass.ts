import * as THREE from 'three';

/** Rough pixel look: the scene is drawn to a small linear-colour target (one pixel per `px` screen pixels) and blown up with hard edges; tone mapping and sRGB happen on the way out, then colours are slightly posterised. */
export class PixelPass {
  private readonly target = new THREE.WebGLRenderTarget(1, 1, { minFilter: THREE.NearestFilter, magFilter: THREE.NearestFilter, type: THREE.HalfFloatType });
  private readonly quad: THREE.Mesh;
  private readonly scene = new THREE.Scene();
  private readonly cam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
  private readonly size = new THREE.Vector2();

  constructor(private readonly renderer: THREE.WebGLRenderer, private readonly px = 3) {
    this.target.texture.generateMipmaps = false;
    const mat = new THREE.ShaderMaterial({
      uniforms: { tex: { value: this.target.texture }, levels: { value: 28 } },
      vertexShader: 'varying vec2 vUv; void main() { vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }',
      fragmentShader: `uniform sampler2D tex; uniform float levels; varying vec2 vUv;
        void main() {
          gl_FragColor = vec4(texture2D(tex, vUv).rgb, 1.0);
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
    if (this.target.width !== w || this.target.height !== h) this.target.setSize(w, h);
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
