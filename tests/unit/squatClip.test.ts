import { expect, it } from 'vitest';
import * as THREE from 'three';
import { squatClip } from '../../src/view/grid/squatClip';

const pose = (name: string, y: number, turn: number) => new THREE.AnimationClip(name, 1, [
  new THREE.VectorKeyframeTrack('root.position', [0, 1], [0, y, 0, 0, y + 9, 0]),
  new THREE.QuaternionKeyframeTrack('thigh_l.quaternion', [0, 1], [...new THREE.Quaternion().setFromEuler(new THREE.Euler(turn, 0, 0)).toArray(), 0, 0, 0, 1]),
]);

it('a squat goes from standing down to the crouch, holds, and comes back up to standing', () => {
  const c = squatClip(pose('Idle_Loop', 1, 0), pose('Crouch_Idle_Loop', 0.5, 1.2));
  const root = c.tracks.find((t) => t.name === 'root.position')!;
  expect(Array.from(root.values.filter((_, i) => i % 3 === 1))).toEqual([1, 0.5, 0.5, 1]);
  expect(root.times[0]).toBe(0); expect(root.times[3]).toBeCloseTo(c.duration);
  const thigh = c.tracks.find((t) => t.name === 'thigh_l.quaternion')!;
  expect(thigh).toBeInstanceOf(THREE.QuaternionKeyframeTrack);
  expect(thigh.values[4]).toBeCloseTo(Math.sin(0.6)); expect(thigh.values[0]).toBeCloseTo(0);
});
