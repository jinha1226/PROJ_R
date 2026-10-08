import * as THREE from 'three';

/** down, held, back up (seconds) */
const TIMES = [0, 0.35, 0.75, 1.2];

/**
 * Picking something up: the mannequin has no pick-up clip, so one is made from two poses — the first frame of standing
 * and the first frame of the crouch — keyed standing → crouched → crouched → standing.
 */
export function squatClip(stand: THREE.AnimationClip, crouch: THREE.AnimationClip): THREE.AnimationClip {
  const tracks: THREE.KeyframeTrack[] = [];
  for (const c of crouch.tracks) {
    const s = stand.tracks.find((t) => t.name === c.name);
    if (!s) continue;
    const n = c.getValueSize(), up = Array.from(s.values.slice(0, n)), down = Array.from(c.values.slice(0, n));
    const Track = c instanceof THREE.QuaternionKeyframeTrack ? THREE.QuaternionKeyframeTrack : THREE.VectorKeyframeTrack;
    tracks.push(new Track(c.name, TIMES, [...up, ...down, ...down, ...up]));
  }
  return new THREE.AnimationClip('Squat_Pickup', TIMES[TIMES.length - 1], tracks);
}
