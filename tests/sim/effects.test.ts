import { describe, it, expect } from 'vitest';
import { createState, setupFromPresets } from '../../src/sim/battle/setup';
import { applyToTargets } from '../../src/sim/battle/effects';
import { addTag, hasTag, tickTags } from '../../src/sim/battle/tags';
import { updateProjectiles, spawnProjectile } from '../../src/sim/battle/projectiles';
import { getSkill } from '../../src/data/skills';
import { v } from '../../src/core/vec2';

const party = () => {
  const s = createState(setupFromPresets(9, 'elemental', 'bandits'));
  for (const u of s.units) {
    u.setup.stats.crit = 0;
    u.setup.stats.dodge = 0;
  }
  const by = (id: string) => s.units.find((u) => u.setup.defId === id)!;
  return { s, by };
};

describe('effects & reactions', () => {
  it('wet + judgment triggers combo, consumes wet, stuns', () => {
    const { s, by } = party();
    const foe = by('bandit_cutthroat');
    addTag(s, foe, 'wet', 6, 0, 'x');
    applyToTargets(s, by('priest'), getSkill('judgment'), [foe]);
    expect(hasTag(foe, 'wet')).toBe(false);
    expect(hasTag(foe, 'stun')).toBe(true);
    expect(s.events.some((e) => e.type === 'combo' && e.tag === 'wet')).toBe(true);
  });
  it('same skill without the tag deals less and no combo', () => {
    const a = party();
    const b = party();
    const fa = a.by('bandit_cutthroat');
    const fb = b.by('bandit_cutthroat');
    addTag(a.s, fa, 'wet', 6, 0, 'x');
    applyToTargets(a.s, a.by('priest'), getSkill('judgment'), [fa]);
    applyToTargets(b.s, b.by('priest'), getSkill('judgment'), [fb]);
    expect(fa.maxHp - fa.hp).toBeGreaterThan(fb.maxHp - fb.hp);
    expect(b.s.events.some((e) => e.type === 'combo')).toBe(false);
  });
  it('burn ticks damage each second and expires', () => {
    const { s, by } = party();
    const foe = by('bandit_archer');
    addTag(s, foe, 'burn', 2, 0.2, by('mage').id);
    const hp = foe.hp;
    for (let i = 0; i < 45; i++) tickTags(s);
    expect(foe.hp).toBeLessThan(hp);
    expect(hasTag(foe, 'burn')).toBe(false);
  });
  it('re-applying a tag refreshes duration instead of stacking', () => {
    const { s, by } = party();
    const foe = by('bandit_archer');
    addTag(s, foe, 'slow', 2, 0, 'x');
    addTag(s, foe, 'slow', 5, 0, 'x');
    expect(foe.tags.filter((t) => t.tag === 'slow')).toHaveLength(1);
    expect(foe.tags[0]!.ticksLeft).toBe(100);
  });
  it('projectile fizzles if target dies', () => {
    const { s, by } = party();
    const mage = by('mage');
    const foe = by('bandit_hexer');
    mage.pos = v(-8, 0);
    foe.pos = v(8, 0);
    spawnProjectile(s, mage, getSkill('arcane_bolt'), foe);
    foe.alive = false;
    updateProjectiles(s);
    expect(s.projectiles).toHaveLength(0);
    expect(s.events.some((e) => e.type === 'projectile_fizzle')).toBe(true);
  });
  it('projectile travels and hits', () => {
    const { s, by } = party();
    const mage = by('mage');
    const foe = by('bandit_hexer');
    mage.pos = v(0, 0);
    foe.pos = v(3, 0);
    const hp = foe.hp;
    spawnProjectile(s, mage, getSkill('arcane_bolt'), foe);
    for (let i = 0; i < 10; i++) updateProjectiles(s);
    expect(foe.hp).toBeLessThan(hp);
    expect(s.projectiles).toHaveLength(0);
  });
  it('shield and cleanse', () => {
    const { s, by } = party();
    const w = by('warrior');
    const p = by('priest');
    applyToTargets(s, w, getSkill('bulwark'), [p]);
    expect(p.shield).toBeGreaterThan(0);
    addTag(s, p, 'slow', 5, 0, 'x');
    applyToTargets(s, p, getSkill('sanctuary'), [p]);
    expect(hasTag(p, 'slow')).toBe(false);
  });
  it('knockback pushes the target away', () => {
    const { s, by } = party();
    const ber = by('berserker') ?? by('warrior');
    const foe = by('bandit_cutthroat');
    ber.pos = v(0, 0);
    foe.pos = v(1, 0);
    applyToTargets(s, by('rogue'), getSkill('novice_desperate'), [foe]);
    expect(foe.forced?.kind).toBe('knockback');
    expect(foe.forced!.vel.x).toBeGreaterThan(0);
  });
  it('summon adds enemy units', () => {
    const s = createState(setupFromPresets(2, 'standard', 'boss'));
    const boss = s.units.find((u) => u.setup.boss)!;
    const before = s.units.length;
    applyToTargets(s, boss, getSkill('raise_dead'), [boss]);
    expect(s.units.length).toBe(before + 3);
    expect(s.units.at(-1)!.summoned).toBe(true);
    expect(new Set(s.units.map((u) => u.id)).size).toBe(s.units.length);
  });
});
