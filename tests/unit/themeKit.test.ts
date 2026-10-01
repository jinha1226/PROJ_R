import { describe, it, expect } from 'vitest';
import { readFileSync, existsSync } from 'node:fs';
import { THEME_KITS, boundarySegments } from '../../src/view/explore/themeKit';
import { THEME_PROPS } from '../../src/sim/explore/themes';

const manifest = JSON.parse(readFileSync('public/assets/models/env/manifest.json', 'utf8')) as Record<string, string[]>;
const exists = (ref: string) => { const [theme, key] = ref.split('/'); return manifest[theme!]?.includes(key!) && existsSync(`public/assets/models/env/${ref}.glb`); };

describe('theme kits', () => {
  it('reference only prepared environment models and cover every sim prop kind', () => {
    for (const [theme, kit] of Object.entries(THEME_KITS)) {
      for (const ref of [...kit.boundary.keys, kit.chest, ...(kit.floorTile ? [kit.floorTile.key] : []), ...Object.values(kit.props).flat()]) expect(exists(ref), `${theme}:${ref}`).toBe(true);
      for (const p of THEME_PROPS[theme as keyof typeof THEME_PROPS]) expect(kit.props[p.kind], `${theme}:${p.kind}`).toBeDefined();
    }
  });
  it('boundary segments leave gaps exactly at doors', () => {
    const segs = boundarySegments(['e', 'n'], 4);
    const nearDoor = (x: number, y: number, dx: number, dy: number) => Math.hypot(x - dx, y - dy) < 2.2;
    expect(segs.some((s) => nearDoor(s.x, s.y, 12, 0))).toBe(false);
    expect(segs.some((s) => nearDoor(s.x, s.y, 0, -7))).toBe(false);
    expect(segs.some((s) => nearDoor(s.x, s.y, -12, 0))).toBe(true);
    expect(segs.some((s) => nearDoor(s.x, s.y, 0, 7))).toBe(true);
    for (const s of segs) expect(Math.abs(s.x) === 12 || Math.abs(s.y) === 7).toBe(true);
  });
});
