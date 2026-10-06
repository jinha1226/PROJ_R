import * as THREE from 'three';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js';

/** Bright things bleed light into the dark round them (fires, eyes, ghost flames, the ship's lamps) — the Jupiter Hell glow. */
export class Bloom {
  private readonly composer: EffectComposer;
  private readonly pass: UnrealBloomPass;
  private readonly size = new THREE.Vector2();
  private readonly last = new THREE.Vector2();

  constructor(private readonly renderer: THREE.WebGLRenderer, scene: THREE.Scene, camera: THREE.Camera, glow = { strength: 0.5, radius: 0.45, threshold: 0.8 }) {
    this.composer = new EffectComposer(renderer);
    this.composer.addPass(new RenderPass(scene, camera));
    this.pass = new UnrealBloomPass(new THREE.Vector2(256, 256), glow.strength, glow.radius, glow.threshold);
    this.composer.addPass(this.pass);
    this.composer.addPass(new OutputPass());
  }

  render(): void {
    this.renderer.getSize(this.size);
    if (!this.size.equals(this.last)) {
      this.last.copy(this.size);
      this.composer.setPixelRatio(this.renderer.getPixelRatio());
      this.composer.setSize(this.size.x, this.size.y);
    }
    this.composer.render();
  }

  dispose(): void { this.composer.dispose(); this.pass.dispose(); }
}
