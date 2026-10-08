import * as THREE from 'three';

/** Endesga 32 (lospec.com, free to use): a 32-colour palette made for dark, readable pixel art. */
export const ENDESGA32 = ['#be4a2f', '#d77643', '#ead4aa', '#e4a672', '#b86f50', '#733e39', '#3e2731', '#a22633', '#e43b44', '#f77622', '#feae34', '#fee761',
  '#63c74d', '#3e8948', '#265c42', '#193c3e', '#124e89', '#0099db', '#2ce8f5', '#ffffff', '#c0cbdc', '#8b9bb4', '#5a6988', '#3a4466',
  '#262b44', '#181425', '#ff0044', '#68386c', '#b55088', '#f6757a', '#e8b796', '#c28569'];

/** The game's dot look: about 270 pixels across the short side, Endesga 32, a light dither. */
export const DOT_LOOK: PixelLook = { lines: 270, palette: ENDESGA32, dither: 0.1, lift: 0.62, ground: { contrast: 0.6, dim: 0.84, dither: 0.7 } };

/** The render layer that marks figures for the dot look's outlines. */
export const FIGURE_LAYER = 2;
/** Ring colours: one per class line for the party (as their frames), red for every foe. */
export const RING = { foe: '#e43b44', shell: '#c0cbdc', warrior: '#0099db', archer: '#63c74d', mage: '#b55088', cleric: '#feae34', rogue: '#f6757a' } as const;
/** Tags a figure (and every part under it) so the dot look rings it in `ring`. */
export function markFigure(root: THREE.Object3D, ring: string): void {
  root.traverse((o) => { o.layers.enable(FIGURE_LAYER); o.userData.ring = ring; });
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
  /**
   * What is not a figure (floor, walls, props) is pressed flat so the figures stand out on it: its mid tones drawn toward
   * one another (`contrast` under 1), the whole a little darker (`dim`), its dither quieter (`dither`). The dark stays
   * black and what is bright (a torch, a blast) stays bright.
   */
  ground?: { contrast: number; dim: number; dither: number };
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
  private readonly paints = new Map<string, THREE.MeshBasicMaterial>();

  constructor(private readonly renderer: THREE.WebGLRenderer, private readonly px = 3, private readonly look: PixelLook = {}) {
    this.target.texture.generateMipmaps = false;
    this.target.depthTexture = new THREE.DepthTexture(1, 1);
    const pal = (look.palette ?? []).map((h) => new THREE.Color().setStyle(h, THREE.SRGBColorSpace));
    // the palette is compared in display (sRGB) values, where the dither and the eye work
    const palVec = pal.map((c) => new THREE.Vector3(...c.clone().convertLinearToSRGB().toArray()));
    const n = palVec.length;
    const mat = new THREE.ShaderMaterial({
      uniforms: { mask: { value: this.mask.texture }, tex: { value: this.target.texture }, depth: { value: this.target.depthTexture }, texel: { value: new THREE.Vector2(1, 1) }, levels: { value: 28 },
        pal: { value: n ? palVec : [new THREE.Vector3()] }, spread: { value: look.dither ?? 0.09 }, lift: { value: look.lift ?? 1 },
        ground: { value: new THREE.Vector3(look.ground?.contrast ?? 1, look.ground?.dim ?? 0.88, look.ground?.dither ?? 1) } },
      defines: { PAL_N: Math.max(1, n), USE_PAL: n ? 1 : 0 },
      vertexShader: 'varying vec2 vUv; void main() { vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }',
      fragmentShader: `uniform sampler2D tex; uniform sampler2D depth; uniform vec2 texel; uniform float levels; uniform vec3 pal[PAL_N]; uniform float spread; uniform float lift; uniform vec3 ground; uniform sampler2D mask; varying vec2 vUv;
        vec3 ringAt(vec2 o) { return texture2D(mask, vUv + o).rgb; }
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
            // figures are drawn clean and bright (no dither, shadows lifted more); the ground sits a touch darker behind them
            vec3 fig = ringAt(vec2(0.0));
            bool isFig = fig.r + fig.g + fig.b >= 0.02;
            vec3 base = pow(clamp(gl_FragColor.rgb, 0.0, 1.0), vec3(isFig ? lift * 0.8 : lift));
            if (!isFig) {
              // the ground pressed flat: mid tones drawn toward one another, the dark left black, the bright left bright
              float gl = max(max(base.r, base.g), base.b);
              vec3 pressed = (base - 0.24) * ground.x + 0.24;
              base = mix(mix(base, pressed, smoothstep(0.04, 0.2, gl)) * ground.y, base * 0.88, smoothstep(0.7, 0.97, gl));
            }
            vec3 c = base + (bayer(floor(vUv / texel)) - 0.5) * (isFig ? 0.0 : spread * ground.z * smoothstep(0.03, 0.1, lum));
            vec3 best = pal[0]; float bd = 1e9;
            for (int k = 0; k < PAL_N; k++) {
              vec3 e = (c - pal[k]) * vec3(0.55, 0.75, 0.4);
              float dd = dot(e, e);
              if (dd < bd) { bd = dd; best = pal[k]; }
            }
            gl_FragColor.rgb = best;
            // a one-pixel ring round every figure in its side's colour, where the figure itself is not
            // the mask holds each figure's ring colour (linear); a pixel just outside a figure takes its neighbour's
            vec3 me = ringAt(vec2(0.0));
            if (me.r + me.g + me.b < 0.02) {
              vec3 nb = ringAt(vec2(texel.x, 0.0));
              if (nb.r + nb.g + nb.b < 0.02) nb = ringAt(vec2(-texel.x, 0.0));
              if (nb.r + nb.g + nb.b < 0.02) nb = ringAt(vec2(0.0, texel.y));
              if (nb.r + nb.g + nb.b < 0.02) nb = ringAt(vec2(0.0, -texel.y));
              if (nb.r + nb.g + nb.b >= 0.02) gl_FragColor.rgb = pow(nb, vec3(1.0 / 2.2));
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
    r.getDrawingBufferSize(this.size);
    // a whole number of screen pixels per dot (about `lines` along the short side): fractional scaling makes dots uneven and mushy
    const short = Math.max(1, Math.min(this.size.x, this.size.y));
    const k = Math.max(1, Math.round(this.look.lines ? short / this.look.lines : this.px * r.getPixelRatio()));
    const h = Math.max(1, Math.round(this.size.y / k));
    const w = Math.max(1, Math.round(this.size.x / k));
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
    r.autoClear = false;
    scene.background = null;
    scene.fog = null;
    // every marked part drawn flat in its ring colour, then its own material put back
    const swapped: [THREE.Mesh, THREE.Material | THREE.Material[]][] = [];
    scene.traverse((o) => {
      const m = o as THREE.Mesh, ring = o.userData.ring as string | undefined;
      if (!m.isMesh || !ring || !o.layers.isEnabled(FIGURE_LAYER)) return;
      let paint = this.paints.get(ring);
      if (!paint) { paint = new THREE.MeshBasicMaterial({ color: ring }); this.paints.set(ring, paint); }
      swapped.push([m, m.material]);
      m.material = paint;
    });
    camera.layers.set(FIGURE_LAYER);
    r.render(scene, camera);
    for (const [m, mat] of swapped) m.material = mat;
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
    for (const m of this.paints.values()) m.dispose();
    this.quad.geometry.dispose();
    (this.quad.material as THREE.Material).dispose();
  }
}
