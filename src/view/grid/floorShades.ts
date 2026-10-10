import * as THREE from 'three';
import { DARK } from './zoneLook';

/** Where the clone's light hangs (its height here is the one shadows are thrown from), how far it reaches, and how much of the floor's light a shade leaves. */
export const SHADE = { lamp: { value: new THREE.Vector3(0, DARK.cast, 0) }, reach: { value: DARK.torch.distance }, left: { value: DARK.shade } };

/** The floor shades are thrown from where the clone's light hangs (called every frame). */
export const castFrom = (lamp: THREE.Vector3): void => { SHADE.lamp.value.set(lamp.x, DARK.cast, lamp.z); };

const VERT = `
#include <common>
#include <skinning_pars_vertex>
uniform vec3 uLamp;
uniform float uReach;
varying float vFar;
void main() {
  #include <skinbase_vertex>
  #include <begin_vertex>
  #include <skinning_vertex>
  vec4 wp = modelMatrix * vec4(transformed, 1.0);
  float h = clamp(wp.y, 0.0, uLamp.y - 0.6);
  vec2 f = uLamp.xz + (wp.xz - uLamp.xz) * (uLamp.y / (uLamp.y - h));
  vFar = distance(f, uLamp.xz) / uReach;
  gl_Position = projectionMatrix * viewMatrix * vec4(f.x, 0.07, f.y, 1.0);
}`;
const FRAG = `
uniform float uLeft;
varying float vFar;
void main() {
  float thin = smoothstep(0.45, 1.0, vFar);
  if (thin > 0.97) discard;
  gl_FragColor = vec4(vec3(mix(uLeft, 1.0, thin)), 1.0);
}`;

let shared: THREE.ShaderMaterial | null = null;
/**
 * The material of a floor shade: the mesh itself, pressed flat on the floor away from the fire (so the shape is the figure's own,
 * limbs and all). It multiplies the floor's light down, once a pixel however many shades overlap (the stencil keeps count).
 */
function shadeMaterial(): THREE.ShaderMaterial {
  shared ??= new THREE.ShaderMaterial({
    uniforms: { uLamp: SHADE.lamp, uReach: SHADE.reach, uLeft: SHADE.left }, vertexShader: VERT, fragmentShader: FRAG,
    transparent: true, depthWrite: false, side: THREE.DoubleSide, toneMapped: false,
    blending: THREE.CustomBlending, blendEquation: THREE.AddEquation, blendSrc: THREE.ZeroFactor, blendDst: THREE.SrcColorFactor,
    stencilWrite: true, stencilRef: 1, stencilFunc: THREE.NotEqualStencilFunc, stencilZPass: THREE.ReplaceStencilOp,
    polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2,
  });
  return shared;
}

/**
 * `?dark`: every mesh of a figure or a column gets a twin that is drawn as its shadow on the floor, thrown by the light the clone
 * carries (a skinned mesh's twin shares its skeleton, so the shadow moves as the figure does). No shadow map: one more draw a mesh.
 */
export function addShades(model: THREE.Object3D): void {
  if (!DARK.on) return;
  const meshes: THREE.Mesh[] = [];
  model.traverse((o) => { if ((o as THREE.Mesh).isMesh && !o.userData.outline) meshes.push(o as THREE.Mesh); });
  for (const m of meshes) {
    const sm = m as THREE.SkinnedMesh;
    // a skinned and a rigid mesh need their own program: each kind keeps its own copy of the material
    const mat = sm.isSkinnedMesh ? shadeMaterial() : (rigid ??= shadeMaterial().clone());
    if (mat === rigid) mat.uniforms = shadeMaterial().uniforms;
    let twin: THREE.Mesh;
    if (sm.isSkinnedMesh) {
      const sk = new THREE.SkinnedMesh(sm.geometry, mat);
      sk.bind(sm.skeleton, sm.bindMatrix);
      sk.position.copy(sm.position); sk.quaternion.copy(sm.quaternion); sk.scale.copy(sm.scale);
      sm.parent!.add(sk);
      twin = sk;
    } else {
      twin = new THREE.Mesh(m.geometry, mat);
      m.add(twin);
    }
    // tagged as an outline twin: everything that leaves those alone leaves this alone too
    twin.userData.outline = true;
    twin.frustumCulled = false;
    twin.renderOrder = 1;
  }
}
let rigid: THREE.ShaderMaterial | null = null;
