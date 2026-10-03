import { describe, it, expect } from 'vitest';
import { applyElement } from '../../../src/sim/grid/status';
import { losClear } from '../../../src/sim/grid/fov';
import { shotClear } from '../../../src/sim/grid/combat';
import { OPEN, sim, sureHits } from './kit';

const reacts = (g: ReturnType<typeof sim>) => g.s.events.filter((e) => e.type === 'react').map((e) => e.text);

describe('element reactions (base rules)', () => {
  it('fire on a poisoned foe ignites: a blast around it, the poison and clouds gone', () => {
    const g = sim(OPEN, { x: 2, y: 2 }, [{ kind: 'brute', pos: { x: 8, y: 7 }, awake: false }, { kind: 'brute', pos: { x: 9, y: 7 }, awake: false }]);
    sureHits(g);
    const [a, b] = g.s.foes;
    applyElement(g.s, 0, 'poison', a!.pos, 1, null, 'hero');
    expect(g.s.tiles.some((t) => t.kind === 'poison')).toBe(true);
    g.s.events = [];
    applyElement(g.s, 0, 'fire', a!.pos, 0, [1, 1], 'hero');
    expect(reacts(g)).toEqual(['ignite']);
    expect(a!.status?.poison).toBe(0);
    expect(b!.hp).toBeLessThan(b!.maxHp);
    expect(g.s.tiles.some((t) => t.kind === 'poison' && Math.abs(t.pos.x - a!.pos.x) <= 1 && Math.abs(t.pos.y - a!.pos.y) <= 1)).toBe(false);
  });

  it('lightning on a frozen foe shatters: double damage, the ice breaks', () => {
    const g = sim(OPEN, { x: 2, y: 2 }, [{ kind: 'brute', pos: { x: 8, y: 7 }, awake: false }]);
    const f = g.s.foes[0]!;
    applyElement(g.s, 0, 'frost', f.pos, 0, null, 'hero');
    g.s.events = [];
    applyElement(g.s, 0, 'shock', f.pos, 0, [5, 5], 'hero');
    expect(reacts(g)).toEqual(['shatter']);
    expect(f.hp).toBe(f.maxHp - 10);
    expect(f.status?.freeze).toBe(0);
  });

  it('frost on a burning foe makes steam that blocks sight and shots for a while', () => {
    const g = sim(OPEN, { x: 2, y: 7 }, [{ kind: 'brute', pos: { x: 8, y: 7 }, awake: false }]);
    const f = g.s.foes[0]!;
    applyElement(g.s, 0, 'fire', f.pos, 0, null, 'hero');
    g.s.events = [];
    applyElement(g.s, 0, 'frost', f.pos, 0, null, 'hero');
    expect(reacts(g)).toEqual(['steam']);
    expect(f.status?.burn).toBe(0);
    expect(f.status?.freeze ?? 0).toBe(0);
    expect(g.s.tiles.filter((t) => t.kind === 'steam').length).toBeGreaterThan(3);
    expect(losClear(g.s.map, { x: 2, y: 7 }, { x: 12, y: 7 }, undefined, g.s)).toBe(false);
    expect(shotClear(g.s, { x: 2, y: 7 }, { x: 12, y: 7 })).toBe(false);
  });

  it('lightning on a poisoned foe paralyses it for two turns', () => {
    const g = sim(OPEN, { x: 2, y: 2 }, [{ kind: 'brute', pos: { x: 8, y: 7 } }]);
    const f = g.s.foes[0]!;
    applyElement(g.s, 0, 'poison', f.pos, 0, null, 'hero');
    g.s.events = [];
    applyElement(g.s, 0, 'shock', f.pos, 0, [2, 2], 'hero');
    expect(reacts(g)).toEqual(['paralyse']);
    expect(f.stun).toBe(2);
  });

  it('one application reacts once', () => {
    const g = sim(OPEN, { x: 2, y: 2 }, [{ kind: 'brute', pos: { x: 8, y: 7 }, awake: false }]);
    const f = g.s.foes[0]!;
    applyElement(g.s, 0, 'poison', f.pos, 1, null, 'hero');
    g.s.events = [];
    applyElement(g.s, 0, 'fire', f.pos, 1, [1, 1], 'hero');
    expect(reacts(g).filter((r) => r === 'ignite')).toHaveLength(1);
  });
});
