import { describe, it, expect } from 'vitest';
import { makeWeapon } from '../../../src/sim/grid/items';
import { addBuff, buffOn } from '../../../src/sim/grid/buffs';
import { lootText } from '../../../src/view/grid/cueText';
import { identifyLine } from '../../../src/ui/grid/gridHud';
import { OPEN, sim, sureHits } from './kit';

const R = { x: 1, y: 0 };
const engraved = (group: 'sword' | 'axe' | 'pistol', id: 'dash' | 'leap' | 'kite') => Object.assign(makeWeapon(group, 1), { engraves: [{ id, lvl: 1 as const }] });

describe('final review fixes (roguelike basics)', () => {
  it('a dash or leap cut short by a teleport trap strikes nobody', () => {
    for (const [w, from, foe] of [[engraved('sword', 'dash'), 3, 5], [engraved('axe', 'leap'), 2, 5]] as const) {
      const g = sim(OPEN, { x: from, y: 7 }, [{ kind: 'brute', pos: { x: foe, y: 7 } }]);
      g.s.hero.gear.hands[0] = w;
      g.s.hero.gear.active = 0;
      // the landing cell: a dash steps one in, a leap flies over one and lands on the next
      g.s.traps = [{ pos: { x: foe - 1, y: 7 }, kind: 'teleport', found: false }];
      g.s.foes[0]!.hp = 99;
      g.act({ kind: 'move', dir: R });
      expect(g.s.foes[0]!.hp).toBe(99);
    }
  });

  it('kite never rolls onto a found trap, nor out of a net', () => {
    const g = sim(OPEN, { x: 5, y: 7 }, [{ kind: 'brute', pos: { x: 6, y: 7 } }]);
    sureHits(g);
    g.s.hero.gear.hands[0] = engraved('pistol', 'kite');
    g.s.hero.gear.active = 0;
    g.s.hero.charge = 5;
    g.s.foes[0]!.hp = 99;
    g.s.traps = [{ pos: { x: 4, y: 7 }, kind: 'spike', found: true }];
    g.act({ kind: 'shoot', target: g.s.foes[0]!.id });
    expect(g.s.hero.pos).toEqual({ x: 5, y: 7 });
    g.s.traps = [];
    addBuff(g.s, g.s.hero, 'root', 5, g.s.time);
    g.act({ kind: 'shoot', target: g.s.foes[0]!.id });
    expect(g.s.hero.pos).toEqual({ x: 5, y: 7 });
  });

  it('shooting or bumping a barrel gives an invisible hero away; drinking a healing potion does not', () => {
    const shot = sim(OPEN, { x: 3, y: 7 });
    shot.s.barrels = [{ x: 7, y: 7 }];
    shot.s.hero.gear.hands[0] = makeWeapon('pistol', 1);
    shot.s.hero.gear.active = 0;
    shot.s.hero.charge = 3;
    addBuff(shot.s, shot.s.hero, 'invis', 10, shot.s.time);
    shot.act({ kind: 'shoot', at: { x: 7, y: 7 } });
    expect(buffOn(shot.s.hero, 'invis', shot.s.time)).toBe(false);
    const bump = sim(OPEN, { x: 3, y: 7 });
    bump.s.barrels = [{ x: 4, y: 7 }];
    addBuff(bump.s, bump.s.hero, 'invis', 10, bump.s.time);
    bump.act({ kind: 'move', dir: R });
    expect(buffOn(bump.s.hero, 'invis', bump.s.time)).toBe(false);
    const heal = sim(OPEN, { x: 3, y: 7 });
    heal.s.hero.gear.belt.potion = 1;
    heal.s.hero.hp = 10;
    addBuff(heal.s, heal.s.hero, 'invis', 10, heal.s.time);
    heal.act({ kind: 'use', item: 'potion' });
    expect(buffOn(heal.s.hero, 'invis', heal.s.time)).toBe(true);
  });

  it('a foe confused or frightened loses the spell it had marked (it never lands late on an empty spot)', () => {
    const g = sim(OPEN, { x: 3, y: 7 }, [{ kind: 'mage', pos: { x: 7, y: 7 } }]);
    const mage = g.s.foes[0]!;
    g.s.telegraphs = [{ cells: [{ x: 3, y: 7 }], center: { x: 3, y: 7 }, src: mage.id, kind: 'spell', el: 'fire', dmg: [5, 5], at: g.s.time + 2 }];
    addBuff(g.s, mage, 'confuse', 5, g.s.time);
    expect(g.s.telegraphs).toHaveLength(0);
    g.s.telegraphs = [{ cells: [{ x: 3, y: 7 }], center: { x: 3, y: 7 }, src: mage.id, kind: 'spell', el: 'fire', dmg: [5, 5], at: g.s.time + 2 }];
    addBuff(g.s, mage, 'fear', 5, g.s.time);
    expect(g.s.telegraphs).toHaveLength(0);
  });

  it('a confused step into a wall still spends the turn (no free re-rolls)', () => {
    let free = 0;
    for (let seed = 1; seed <= 30; seed++) {
      const g = sim(OPEN, { x: 1, y: 1 }, [], seed);
      addBuff(g.s, g.s.hero, 'confuse', 50, g.s.time);
      const t = g.s.time;
      const ev = g.act({ kind: 'move', dir: R });
      if (ev[0]?.type === 'blocked' || g.s.time === t) free++;
    }
    expect(free).toBe(0);
  });

  it('a sleeper close by can be crept up on sometimes; sight is rolled once per action', () => {
    let asleep = 0;
    for (let seed = 1; seed <= 60; seed++) {
      const g = sim(OPEN, { x: 3, y: 7 }, [{ kind: 'minion', pos: { x: 5, y: 7 }, awake: false }], seed);
      g.s.hero.gear.hands[0]!.engraves = [];
      g.act({ kind: 'move', dir: R });
      if (!g.s.foes[0]!.awake) asleep++;
    }
    expect(asleep).toBeGreaterThan(5);
    expect(asleep).toBeLessThan(60);
  });

  it('screen text: chest potions pop up without a gold amount; identify reads naturally', () => {
    expect(lootText({ t: 0, type: 'loot', text: '붉은 물약' })).toBe('+붉은 물약');
    expect(lootText({ t: 0, type: 'loot', text: '화살', amount: 3 })).toBe('+화살 3');
    expect(identifyLine('「조르」 주문서|순간이동 주문서')).toBe('「조르」 주문서는 순간이동 주문서였다');
    expect(identifyLine('붉은 물약|신속 물약')).toBe('붉은 물약은 신속 물약이었다');
  });
});
