import { describe, it, expect } from 'vitest';
import { existsSync, readFileSync } from 'node:fs';
import { MODELS, visibleMeshes, propsFor } from '../../src/view/actors/modelManifest';
import { CLASSES } from '../../src/data/classes';
import { ENEMIES } from '../../src/data/enemies';

const manifest = JSON.parse(readFileSync('public/assets/models/manifest.json', 'utf8')) as Record<string, string[]>;
const isProp = (n: string) => n.startsWith('prop:');

describe('model manifest', () => {
  it('references only real mesh nodes or existing prop files', () => {
    for (const [id, m] of Object.entries(MODELS)) {
      const real = new Set(manifest[id]);
      const all = [...m.always, ...m.helmet, ...m.cape, ...Object.values(m.weapons), ...Object.values(m.offhands)];
      for (const n of all) {
        if (isProp(n)) expect(existsSync(`public/assets/models/props/${n.slice(5)}.glb`), `${id}:${n}`).toBe(true);
        else expect(real.has(n), `${id}:${n}`).toBe(true);
      }
    }
  });
  it('every class and enemy shows its main weapon', () => {
    for (const d of [...Object.values(CLASSES), ...Object.values(ENEMIES)]) {
      const w = MODELS[d.model].weapons[d.gear.weapon];
      expect(w, `${d.id} weapon ${d.gear.weapon}`).toBeDefined();
      const shown = isProp(w!) ? propsFor(d.model, d.gear).some((p) => p.file === w!.slice(5)) : visibleMeshes(d.model, d.gear).has(w!);
      expect(shown, d.id).toBe(true);
      if (d.gear.offhand) expect(MODELS[d.model].offhands[d.gear.offhand], `${d.id} offhand`).toBeDefined();
    }
  });
  it('helmet flag toggles helmet meshes', () => {
    const on = visibleMeshes('Knight', { weapon: '1H_Sword', helmet: true, cape: false });
    const off = visibleMeshes('Knight', { weapon: '1H_Sword', helmet: false, cape: false });
    expect(on.has('Knight_Helmet')).toBe(true);
    expect(off.has('Knight_Helmet')).toBe(false);
    expect(off.has('2H_Sword')).toBe(false);
  });
});
