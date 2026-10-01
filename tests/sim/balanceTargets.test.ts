import { describe, it, expect } from 'vitest';
import { bossBattle, roomBattle, winRate } from './support/balanceKit';

const N = 20;

describe('balance targets (recommended pace party, auto battle)', () => {
  it('week 5: ★1 safe, ★2 fair, ★3 a real gamble', () => {
    const r = [1, 2, 3].map((s) => winRate((seed) => roomBattle(5, s as 1 | 2 | 3, seed), N).rate);
    expect(r[0]).toBeGreaterThanOrEqual(0.85);
    expect(r[1]).toBeGreaterThanOrEqual(0.55);
    expect(r[1]).toBeLessThanOrEqual(0.95);
    expect(r[2]).toBeGreaterThanOrEqual(0.25);
    expect(r[2]).toBeLessThanOrEqual(0.7);
  }, 120_000);
  it('week 11: harder stars stay harder', () => {
    const r = [1, 2, 3].map((s) => winRate((seed) => roomBattle(11, s as 1 | 2 | 3, seed), N).rate);
    expect(r[0]).toBeGreaterThanOrEqual(0.8);
    expect(r[0]! + 0.05).toBeGreaterThanOrEqual(r[1]!);
    expect(r[1]! + 0.05).toBeGreaterThanOrEqual(r[2]!);
    expect(r[2]).toBeGreaterThanOrEqual(0.3);
  }, 120_000);
  it('a well-built company reliably beats the boss (the naive weekly bot is the floor, see docs/balance.md)', () => {
    const r = winRate((seed) => bossBattle(seed), N).rate;
    expect(r).toBeGreaterThanOrEqual(0.8);
  }, 120_000);
});
