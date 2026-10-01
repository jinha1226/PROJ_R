import { describe, it, expect } from 'vitest';
import { generateExploration } from '../../src/sim/explore/generate';
import { roomAt, canStand, ROOM_PITCH } from '../../src/sim/explore/space';

describe('exploration space', () => {
  const e = generateExploration(5, 3, { theme: 'forest', stars: 1, reward: 'gold', rooms: 8 }, ['m0']);
  const start = e.rooms[e.at]!;
  const cx = start.gx * ROOM_PITCH.x;
  const cz = start.gy * ROOM_PITCH.z;
  it('finds the room under a world point', () => {
    expect(roomAt(e, cx + 3, cz - 2)).toBe(start.id);
    expect(roomAt(e, cx + 15, cz + 9)).toBeNull();
  });
  it('allows standing inside rooms and corridors, not in walls or props', () => {
    expect(canStand(e, cx, cz)).toBe(true);
    expect(canStand(e, cx + 11.9, cz + 6.9)).toBe(false);
    const [dir] = Object.keys(start.doors);
    const off = { n: [0, -9], s: [0, 9], e: [15, 0], w: [-15, 0] }[dir as 'n']!;
    expect(canStand(e, cx + off[0]!, cz + off[1]!)).toBe(true);
    const any = Object.values(e.rooms).find((r) => r.props.length)!;
    const p = any.props[0]!;
    expect(canStand(e, any.gx * ROOM_PITCH.x + p.x, any.gy * ROOM_PITCH.z + p.y)).toBe(false);
  });
});
