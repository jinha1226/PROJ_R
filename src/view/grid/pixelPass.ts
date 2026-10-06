import * as THREE from 'three';

/** Endesga 32 (lospec.com, free to use): a 32-colour palette made for dark, readable pixel art. */
export const ENDESGA32 = ['#be4a2f', '#d77643', '#ead4aa', '#e4a672', '#b86f50', '#733e39', '#3e2731', '#a22633', '#e43b44', '#f77622', '#feae34', '#fee761',
  '#63c74d', '#3e8948', '#265c42', '#193c3e', '#124e89', '#0099db', '#2ce8f5', '#ffffff', '#c0cbdc', '#8b9bb4', '#5a6988', '#3a4466',
  '#262b44', '#181425', '#ff0044', '#68386c', '#b55088', '#f6757a', '#e8b796', '#c28569'];

/** The game's dot look: about 270 pixels across the short side, Endesga 32, a light dither. */
export const DOT_LOOK: PixelLook = { lines: 270, palette: ENDESGA32, dither: 0.1, lift: 0.62 };

/** Render layers that mark figures for the dot look's team outlines (heroes and foes). */
export const HERO_LAYER = 2;
export const FOE_LAYER = 3;
/** Tags a figure (and every part under it) so the dot look can ring it in its side's colour. */
export function markFigure(root: THREE.Object3D, side: 'hero' | 'foe'): void {
  root.traverse((o) => o.layers.enable(side === 'hero' ? HERO_LAYER : FOE_LAYER));
}

export interface PixelLook {
  /** a fixed count of pixels along the screen's short side (the same chunky dots on every screen); else one pixel per `px` screen pixels */
  lines?: number;
  /** every colour snapped to this palette, gradients broken into an ordered dither */
  palette?: string[];
  /** how far the dither reaches (0 = flat bands) */
  dither?: number;
  /** a gamma under 1 raises the shadows before the palette snap */
  lift?: number;
}

/**
 * Rough pixel look: the scene is drawn to a small linear-colour target and blown up with hard edges; a dark one-pixel outline
 * where depth jumps keeps figures and walls apart; tone mapping and sRGB happen on the way out. With a palette every colour
 * lands on one of its entries through a 4×4 ordered dither, so models of any make share one look; without, colours are posterised.
 */
export class PixelPass {
  private readonly target = new THREE.WebGLRenderTarget(1, 1, { minFilter: THREE.NearestFilter, magFilter: THREE.NearestFilter, type: THREE.HalfFloatType });
  private readonly quad: THREE.Mesh;
  private readonly scene = new THREE.Scene();
  private readonly cam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
  private readonly size = new THREE.Vector2();
  /** figures only: red where a hero is, green where a foe is (drawn through walls) */
  private readonly mask = new THREE.WebGLRenderTarget(1, 1, { minFilter: THREE.NearestFilter, magFilter: THREE.NearestFilter });
  private readonly heroPaint = new THREE.MeshBasicMaterial({ color: '#ff0000' });
  private readonly foePaint = new THREE.MeshBasicMaterial({ color: '#00ff00' });

  constructor(private readonly renderer: THREE.WebGLRenderer, private readonly px = 3, private readonly look: PixelLook = {}) {
    this.target.texture.generateMipmaps = false;
    this.target.depthTexture = new THREE.DepthTexture(1, 1);
    const pal = (look.palette ?? []).map((h) => new THREE.Color().setStyle(h, THREE.SRGBColorSpace));
    // the palette is compared in display (sRGB) values, where the dither and the eye work
    const palVec = pal.map((c) => new THREE.Vector3(...c.clone().convertLinearToSRGB().toArray()));
    const n = palVec.length;
    const mat = new THREE.ShaderMaterial({
      uniforms: { mask: { value: this.mask.texture }, heroRing: { value: palVec.length ? new THREE.Vector3(0.17, 0.91, 0.96) : new THREE.Vector3() }, foeRing: { value: new THREE.Vector3(1, 0, 0.27) }, tex: { value: this.target.texture }, depth: { value: this.target.depthTexture }, texel: { value: new THREE.Vector2(1, 1) }, levels: { value: 28 },
        pal: { value: n ? palVec : [new THREE.Vector3()] }, spread: { value: look.dither ?? 0.09 }, lift: { value: look.lift ?? 1 } },
      defines: { PAL_N: Math.max(1, n), USE_PAL: n ? 1 : 0 },
      vertexShader: 'varying vec2 vUv; void main() { vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }',
      fragmentShader: `uniform sampler2D tex; uniform sampler2D depth; uniform vec2 texel; uniform float levels; uniform vec3 pal[PAL_N]; uniform float spread; uniform float lift; uniform sampler2D mask; uniform vec3 heroRing; uniform vec3 foeRing; varying vec2 vUv;
        float dz(vec2 o) { return texture2D(depth, vUv + o * texel).x; }
        float bayer(vec2 p) {
          int x = int(mod(p.x, 4.0)), y = int(mod(p.y, 4.0)), i = x + y * 4;
          int m[16]; m[0]=0; m[1]=8; m[2]=2; m[3]=10; m[4]=12; m[5]=4; m[6]=14; m[7]=6; m[8]=3; m[9]=11; m[10]=1; m[11]=9; m[12]=15; m[13]=7; m[14]=13; m[15]=5;
          for (int k = 0; k < 16; k++) if (k == i) return (float(m[k]) + 0.5) / 16.0;
          return 0.5;
        }
        void main() {
          // the camera is orthographic, so depth is linear: a neighbour much farther means this pixel is a figure's or wall's rim
          float d = dz(vec2(0.0));
          float far = max(max(dz(vec2(1.0, 0.0)), dz(vec2(-1.0, 0.0))), max(dz(vec2(0.0, 1.0)), dz(vec2(0.0, -1.0))));
          float rim = step(0.0025, far - d);
          gl_FragColor = vec4(texture2D(tex, vUv).rgb * mix(1.0, 0.22, rim), 1.0);
          #include <tonemapping_fragment>
          #include <colorspace_fragment>
          #if USE_PAL == 1
            // shadows lifted before the snap: the palette's darkest entries would swallow a dim figure whole
            // near-black stays flat black: the unseen dark must not crawl with dither dots
            float lum = max(max(gl_FragColor.r, gl_FragColor.g), gl_FragColor.b);
            vec3 c = pow(clamp(gl_FragColor.rgb, 0.0, 1.0), vec3(lift)) + (bayer(floor(vUv / texel)) - 0.5) * spread * smoothstep(0.03, 0.1, lum);
            vec3 best = pal[0]; float bd = 1e9;
            for (int k = 0; k < PAL_N; k++) {
              vec3 e = (c - pal[k]) * vec3(0.55, 0.75, 0.4);
              float dd = dot(e, e);
              if (dd < bd) { bd = dd; best = pal[k]; }
            }
            gl_FragColor.rgb = best;
            // a one-pixel ring round every figure in its side's colour, where the figure itself is not
            vec2 me = texture2D(mask, vUv).rg;
            if (me.r + me.g < 0.5) {
              vec2 nb = max(max(texture2D(mask, vUv + vec2(texel.x, 0.0)).rg, texture2D(mask, vUv - vec2(texel.x, 0.0)).rg),
                            max(texture2D(mask, vUv + vec2(0.0, texel.y)).rg, texture2D(mask, vUv - vec2(0.0, texel.y)).rg));
              if (nb.r > 0.5) gl_FragColor.rgb = heroRing;
              else if (nb.g > 0.5) gl_FragColor.rgb = foeRing;
            }
          #else
            gl_FragColor.rgb = floor(gl_FragColor.rgb * levels + 0.5) / levels;
          #endif
        }`,
      depthTest: false, depthWrite: false, toneMapped: true,
    });
    this.quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), mat);
    this.scene.add(this.quad);
  }

  render(scene: THREE.Scene, camera: THREE.Camera): void {
    const r = this.renderer;
    r.getSize(this.size);
    const short = Math.max(1, Math.min(this.size.x, this.size.y));
    const k = this.look.lines ? this.look.lines / short : 1 / this.px;
    const h = Math.max(this.look.lines ? 1 : 120, Math.round(this.size.y * k));
    const w = Math.max(1, Math.round(this.size.x * k));
    if (this.target.width !== w || this.target.height !== h) {
      this.target.setSize(w, h);
      this.mask.setSize(w, h);
      ((this.quad.material as THREE.ShaderMaterial).uniforms.texel!.value as THREE.Vector2).set(1 / w, 1 / h);
    }
    r.setRenderTarget(this.target);
    r.render(scene, camera);
    if (this.look.palette) this.paintMask(scene, camera);
    r.setRenderTarget(null);
    r.render(this.scene, this.cam);
  }

  /** Draws heroes then foes, flat, into the mask (no depth test against the world: a figure behind a wall still gets its ring). */
  private paintMask(scene: THREE.Scene, camera: THREE.Camera): void {
    const r = this.renderer, layers = camera.layers.mask, bg = scene.background, over = scene.overrideMaterial, fog = scene.fog;
    const clear = r.getClearColor(new THREE.Color()), alpha = r.getClearAlpha();
    const auto = r.autoClear;
    r.setRenderTarget(this.mask);
    r.setClearColor(0x000000, 1);
    r.clear();
    // both sides into one mask: the second pass must not wipe the first
    r.autoClear = false;
    scene.background = null;
    scene.fog = null;
    for (const [layer, paint] of [[HERO_LAYER, this.heroPaint], [FOE_LAYER, this.foePaint]] as const) {
      camera.layers.set(layer);
      scene.overrideMaterial = paint;
      r.render(scene, camera);
    }
    r.autoClear = auto;
    camera.layers.mask = layers;
    scene.overrideMaterial = over;
    scene.background = bg;
    scene.fog = fog;
    r.setClearColor(clear, alpha);
  }

  /** Moves a camera target onto the low-res pixel grid (screen x is world x; screen y is world z foreshortened by the elevation), so a moving camera does not make edges crawl. */
  snap(target: THREE.Vector3, halfHeight: number, elevation: number): void {
    const step = (2 * halfHeight) / Math.max(1, this.target.height);
    target.x = Math.round(target.x / step) * step;
    const sz = step / Math.sin(elevation);
    target.z = Math.round(target.z / sz) * sz;
  }

  dispose(): void {
    this.target.dispose();
    this.mask.dispose();
    this.heroPaint.dispose();
    this.foePaint.dispose();
    this.quad.geometry.dispose();
    (this.quad.material as THREE.Material).dispose();
  }
}
