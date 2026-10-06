import * as THREE from 'three';
import { boneParts } from './boneParts';
import { figureMat, type FigureMat } from './toon';
import type { Species } from './species';

/** The few rigid bits that sell a species at pixel size: goblin ears, orc tusks and pauldron, skeleton eye holes and ribs. */
export function buildSpeciesParts(model: THREE.Object3D, species: Species, skin: string): FigureMat[] {
  const { at, v, piece } = boneParts(model);
  const mats: FigureMat[] = [];
  const mat = (color: string) => { const m = figureMat(color, '#ffd9a0', 0.35); mats.push(m); return m; };
  const head = at('Head');
  if (species === 'goblin') {
    const ear = mat(skin);
    for (const x of [1, -1]) piece('Head', new THREE.ConeGeometry(0.04, 0.16, 6), ear, head.clone().add(v(0.13 * x, 0.12, -0.01)), new THREE.Euler(0, 0, -x * 1.25));
  }
  if (species === 'orc') {
    const tusk = mat('#efe6cc');
    for (const x of [1, -1]) piece('Head', new THREE.ConeGeometry(0.018, 0.07, 5), tusk, head.clone().add(v(0.045 * x, 0.04, 0.1)));
    const iron = mat('#3a3a40');
    piece('upperarm_l', new THREE.BoxGeometry(0.12, 0.07, 0.13), iron, at('upperarm_l').add(v(0.02, 0.04, 0)));
    piece('Head', new THREE.BoxGeometry(0.17, 0.035, 0.05), mat(skin), head.clone().add(v(0, 0.14, 0.09)));
  }
  if (species === 'skeleton') {
    const hole = mat('#0d0b0a');
    for (const x of [1, -1]) piece('Head', new THREE.BoxGeometry(0.045, 0.04, 0.03), hole, head.clone().add(v(0.04 * x, 0.12, 0.105)));
    const chest = at('spine_03');
    for (let i = 0; i < 3; i++) piece('spine_03', new THREE.BoxGeometry(0.22, 0.015, 0.02), hole, chest.clone().add(v(0, 0.06 - i * 0.05, 0.1)));
  }
  return mats;
}
