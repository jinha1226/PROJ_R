import { describe, it, expect } from 'vitest';
import { Input, type PadLike } from '../../src/app/input/input';

const pad = (axes: number[], pressed: number[] = []): PadLike => ({ axes, buttons: Array.from({ length: 16 }, (_, i) => ({ pressed: pressed.includes(i) })) });

describe('input', () => {
  it('normalizes keyboard diagonals', () => {
    const inp = new Input(() => []);
    inp.key('KeyW', true);
    inp.key('KeyD', true);
    const s = inp.poll();
    expect(Math.hypot(s.move.x, s.move.y)).toBeCloseTo(1);
    expect(s.move.y).toBeLessThan(0);
    expect(s.move.x).toBeGreaterThan(0);
  });
  it('applies a 0.2 dead zone to sticks', () => {
    expect(new Input(() => [pad([0.15, -0.1])]).poll().move).toEqual({ x: 0, y: 0 });
    expect(new Input(() => [pad([0.8, 0])]).poll().move.x).toBeGreaterThan(0.7);
  });
  it('fires buttons once per press (edge-triggered)', () => {
    let pressed: number[] = [0];
    const inp = new Input(() => [pad([0, 0], pressed)]);
    expect(inp.poll().interact).toBe(true);
    expect(inp.poll().interact).toBe(false);
    pressed = [];
    inp.poll();
    pressed = [0];
    expect(inp.poll().interact).toBe(true);
    pressed = [];
    inp.poll();
    inp.key('KeyE', true);
    expect(inp.poll().interact).toBe(true);
    expect(inp.poll().interact).toBe(false);
  });
  it('survives environments without gamepads or with disconnected slots', () => {
    expect(() => new Input(() => { throw new Error('no api'); }).poll()).not.toThrow();
    expect(new Input(() => [null, undefined]).poll().move).toEqual({ x: 0, y: 0 });
  });
  it('maps rotate and manual toggle', () => {
    const inp = new Input(() => [pad([0, 0], [4, 8])]);
    const s = inp.poll();
    expect(s.rotateL).toBe(true);
    expect(s.toggleManual).toBe(true);
  });
  it('a tap shorter than a frame still counts as one press', () => {
    const inp = new Input(() => []);
    inp.key('Escape', true);
    inp.key('Escape', false);
    expect(inp.poll().cancel).toBe(true);
    expect(inp.poll().cancel).toBe(false);
  });
});
