import { describe, it, expect } from 'vitest';
import { partyRoom, tick } from '../../src/sim/party/partySim';
import { damage, entOf } from '../../src/sim/party/partyCore';
import { emit, CHAIN_CAP } from '../../src/sim/party/triggers';
import type { GEvent } from '../../src/sim/grid/types';

describe('trigger bus', () => {
  it('caps a repeating effect that calls itself at the chain limit', () => {
    const p = partyRoom(), u = p.units[0]!, ev: GEvent[] = []; let n = 0;
    u.triggers = [{ id: '연타', when: 'hit', repeat: true, run: (p, c) => { n++; c.src.progress++; emit(p, 'hit', c); } }];
    emit(p, 'hit', { t: 0, src: u, ev }); expect(n).toBe(CHAIN_CAP);
  });
  it('honours cooldowns across repeated hits', () => {
    const p = partyRoom(), u = p.units[0]!; let n = 0;
    u.triggers = [{ id: '대기', when: 'hit', cd: 6, run: (_p,c) => { n++; c.src.progress++; } }];
    for (let t = 0; t < 5; t++) emit(p, 'hit', { t, src: u, ev: [] });
    expect(n).toBe(1);
    for (let t = 5; t < 13; t++) emit(p, 'hit', { t, src: u, ev: [] });
    expect(n).toBe(3);
  });
  it('fires crisis once and resets between fights', () => {
    const p = partyRoom(), u = p.units[0]!, e = entOf(p, u.id)!; let n = 0;
    u.triggers = [{ id: '위기', when: 'crisis', run: (_p,c) => { n++; c.src.progress++; } }];
    damage(p, 0, 'trap', u, 60, []); damage(p, 0, 'trap', u, 1, []); expect(n).toBe(1);
    p.combat = false; tick(p, 0); p.combat = true; e.hp = e.maxHp; u.shield=0;
    damage(p, 1, 'trap', u, 60, []); expect(n).toBe(2);
  });
  it('stops a source killed inside a chain', () => {
    const p = partyRoom(), u = p.units[0]!; let n = 0;
    u.triggers = [{ id: '가시', when: 'hit', run: (p, c) => { damage(p, 0, 'trap', u, 999, c.ev); emit(p, 'hit', c); } }, { id: '후속', when: 'hit', run: (_p,c) => { n++; c.src.progress++; } }];
    emit(p, 'hit', { t: 0, src: u, ev: [] }); expect(n).toBe(0);
  });
});
