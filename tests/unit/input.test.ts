import { describe, it, expect } from 'vitest';
import { Input, type PadLike } from '../../src/app/input/input';
import { stickVector, TouchState } from '../../src/app/input/touch';
import { cameraTurn } from '../../src/app/input/sortieInput';

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
  it('maps the sortie keys: J/K/L/; skills, 1–4 quick slots, E or pad B to pick up, held attack', () => {
    const inp = new Input(() => []);
    inp.key('KeyK', true);
    inp.key('Digit3', true);
    inp.key('KeyE', true);
    inp.key('Semicolon', true);
    let s = inp.poll();
    expect([s.skill1, s.quick, s.pick, s.ult]).toEqual([true, 2, true, true]);
    inp.key('KeyJ', true);
    s = inp.poll();
    expect(s.attackHeld).toBe(true);
    expect(inp.poll().attackHeld).toBe(true);
    const padIn = new Input(() => [pad([0, 0], [1, 13])]);
    s = padIn.poll();
    expect([s.pick, s.quick]).toEqual([true, 1]);
  });
  it('touch controls feed the same state (virtual source)', () => {
    const inp = new Input(() => []);
    inp.setVirtual({ move: { x: 0.5, y: 0 }, attack: true, quick: 0 });
    const s = inp.poll();
    expect(s.move).toEqual({ x: 0.5, y: 0 });
    expect(s.attackHeld).toBe(true);
    expect(s.quick).toBe(0);
    expect(inp.poll().quick).toBeNull();
  });
});

describe('touch controls', () => {
  it('a stick vector is clamped to its radius with a dead zone', () => {
    expect(stickVector({ x: 0, y: 0 }, { x: 5, y: 0 }, 60, 0.15)).toEqual({ x: 0, y: 0 });
    expect(stickVector({ x: 0, y: 0 }, { x: 120, y: 0 }, 60, 0.15)).toEqual({ x: 1, y: 0 });
    const v = stickVector({ x: 0, y: 0 }, { x: 30, y: 30 }, 60, 0.15);
    expect(Math.hypot(v.x, v.y)).toBeGreaterThan(0.5);
    expect(Math.hypot(v.x, v.y)).toBeLessThan(0.8);
  });
  it('holds the stick with one finger while another presses attack', () => {
    const t = new TouchState(800, 60);
    t.down(1, 100, 300);           // left half → stick at the touch point
    t.move(1, 160, 300);
    t.press(2, 'attack');
    expect(t.state().move!.x).toBeCloseTo(1);
    expect(t.state().attack).toBe(true);
    t.up(2);
    expect(t.state().attack).toBe(false);
    expect(t.state().move!.x).toBeCloseTo(1);
    t.up(1);
    expect(t.state().move).toEqual({ x: 0, y: 0 });
  });
  it('quick slot taps are one-shot', () => {
    const t = new TouchState(800, 60);
    t.press(3, 'quick1');
    expect(t.state().quick).toBe(1);
    t.up(3);
    expect(t.state().quick ?? null).toBeNull();
  });
  it('touch has pause and auto buttons that reach the input state', () => {
    const t = new TouchState(() => 800, 60);
    t.press(1, 'menu');
    expect(t.state().menu).toBe(true);
    const inp = new Input(() => []);
    inp.setVirtual({ menu: true, auto: true });
    const s = inp.poll();
    expect([s.menu, s.toggleManual]).toEqual([true, true]);
  });
  it('the stick follows the current screen width (after rotating the phone)', () => {
    let width = 400;
    const t = new TouchState(() => width, 60);
    width = 900;
    expect(t.down(1, 300, 200)).toBe(true);
  });
  it('the pad ultimate (RB) does not also turn the camera', () => {
    expect(cameraTurn({ rotateL: false, rotateR: true, ult: true })).toBe(0);
    expect(cameraTurn({ rotateL: false, rotateR: true, ult: false })).toBe(1);
    expect(cameraTurn({ rotateL: true, rotateR: false, ult: false })).toBe(-1);
  });
  it('party orders: F/R/G on the keyboard, X/Y/RB on a pad, and touch buttons', () => {
    const inp = new Input(() => []);
    inp.key('KeyF', true);
    inp.key('KeyG', true);
    let s = inp.poll();
    expect([s.focus, s.retreat, s.regroup]).toEqual([true, false, true]);
    const pad = new Input(() => [{ axes: [0, 0], buttons: Array.from({ length: 16 }, (_, i) => ({ pressed: i === 3 })) }]);
    expect(pad.poll().retreat).toBe(true);
    const t = new TouchState(() => 800, 60);
    t.press(1, 'focus');
    const v = new Input(() => []);
    v.setVirtual(t.state());
    s = v.poll();
    expect(s.focus).toBe(true);
    expect(cameraTurn({ rotateL: false, rotateR: true, regroup: true })).toBe(0);
  });
});
