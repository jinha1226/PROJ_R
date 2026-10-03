import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { attachFoePress } from '../../src/ui/grid/foePress';
import { newState } from '../../src/sim/grid/state';
import { idx } from '../../src/sim/grid/types';
import { handMap, OPEN } from '../sim/grid/kit';

class Surface {
  closest() { return this; }
  contains(target: unknown) { return target === this; }
}

describe('touch foe inspection', () => {
  let dispose: () => void;
  let win: EventTarget;
  let surface: Surface;
  const select = vi.fn();
  function pointer(type: string, id = 1, x = 10, pointerType = 'touch') {
    const event = new Event(type, { cancelable: true });
    Object.defineProperties(event, {
      target: { value: surface }, pointerId: { value: id }, pointerType: { value: pointerType },
      clientX: { value: x }, clientY: { value: 10 },
    });
    win.dispatchEvent(event);
  }
  beforeEach(() => {
    vi.useFakeTimers(); select.mockClear();
    win = new EventTarget(); surface = new Surface();
    vi.stubGlobal('window', win); vi.stubGlobal('Element', Surface);
    const map = handMap(OPEN);
    map.spawns = [{ kind: 'minion', pos: { x: 4, y: 1 }, group: 1 }];
    const s = newState(map, 3);
    s.visible.add(idx(map, s.foes[0]!.pos));
    dispose = attachFoePress(surface as unknown as HTMLElement, () => s, () => s.foes[0]!.pos, select);
  });
  afterEach(() => { dispose(); vi.useRealTimers(); vi.unstubAllGlobals(); });

  it('selects at 400 ms and does not select again on release', () => {
    pointer('pointerdown'); vi.advanceTimersByTime(399);
    expect(select).not.toHaveBeenCalled();
    vi.advanceTimersByTime(1);
    expect(select).toHaveBeenCalledTimes(1);
    pointer('pointerup'); expect(select).toHaveBeenCalledTimes(1);
  });
  it('keeps short foe taps working', () => {
    pointer('pointerdown'); pointer('pointerup');
    expect(select).toHaveBeenCalledTimes(1);
  });
  it.each(['move', 'second finger', 'cancel', 'blur', 'dispose'])('cancels on %s', (reason) => {
    pointer('pointerdown');
    if (reason === 'move') pointer('pointermove', 1, 22);
    if (reason === 'second finger') pointer('pointerdown', 2);
    if (reason === 'cancel') pointer('pointercancel');
    if (reason === 'blur') win.dispatchEvent(new Event('blur'));
    if (reason === 'dispose') dispose();
    vi.advanceTimersByTime(500); pointer('pointerup');
    expect(select).not.toHaveBeenCalled();
  });
  it('leaves mouse input alone', () => {
    pointer('pointerdown', 1, 10, 'mouse'); vi.advanceTimersByTime(500);
    pointer('pointerup', 1, 10, 'mouse');
    expect(select).not.toHaveBeenCalled();
  });
});
