import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { ANIM_CLIPS, LOOPING } from '../../src/view/actors/animMap';

const clipNames = (file: string) => {
  const b = readFileSync(file);
  const len = b.readUInt32LE(12);
  const json = JSON.parse(b.subarray(20, 20 + len).toString()) as { animations: { name: string }[] };
  return new Set(json.animations.map((a) => a.name));
};

describe('anim map', () => {
  it('every mapped clip exists in its library', () => {
    for (const [set, map] of Object.entries(ANIM_CLIPS)) {
      const names = clipNames(`public/assets/models/anims-${set}.glb`);
      for (const [key, clip] of Object.entries(map)) expect(names.has(clip), `${set}.${key}=${clip}`).toBe(true);
    }
  });
  it('locomotion loops', () => {
    expect(LOOPING.has('idle')).toBe(true);
    expect(LOOPING.has('run')).toBe(true);
    expect(LOOPING.has('attack1h')).toBe(false);
  });
});
