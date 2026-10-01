import * as THREE from 'three';
import { MAX_DARK } from './visionMath';

const FADE = 6;

/** A dark veil over everything beyond the hero's sight radius (smoothstep edge, same curve as visionAlpha). */
export class VisionMask {
  readonly mesh: THREE.Mesh;
  private readonly mat: THREE.ShaderMaterial;

  constructor(size: number) {
    this.mat = new THREE.ShaderMaterial({
      transparent: true, depthWrite: false,
      uniforms: { center: { value: new THREE.Vector2() }, radius: { value: 18 }, dark: { value: MAX_DARK }, tint: { value: new THREE.Color('#05060c') } },
      vertexShader: 'varying vec2 vW; void main(){ vec4 w = modelMatrix * vec4(position,1.0); vW = w.xz; gl_Position = projectionMatrix * viewMatrix * w; }',
      fragmentShader: `uniform vec2 center; uniform float radius; uniform float dark; uniform vec3 tint; varying vec2 vW;
        void main(){ float t = clamp((distance(vW, center) - radius) / ${FADE.toFixed(1)}, 0.0, 1.0); gl_FragColor = vec4(tint, dark * t * t * (3.0 - 2.0 * t)); }`,
    });
    this.mesh = new THREE.Mesh(new THREE.PlaneGeometry(size, size), this.mat);
    this.mesh.rotation.x = -Math.PI / 2;
    this.mesh.position.y = 3.5;
    this.mesh.renderOrder = 10;
  }

  set(x: number, z: number, radius: number): void {
    this.mat.uniforms.center!.value.set(x, z);
    this.mat.uniforms.radius!.value = radius;
    this.mesh.position.x = x;
    this.mesh.position.z = z;
  }

  dispose(): void {
    this.mesh.geometry.dispose();
    this.mat.dispose();
  }
}
