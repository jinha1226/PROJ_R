import { quantize8 } from '../../app/input/gridInput';
import type { Cell } from '../../sim/grid/types';

export type GridCmd = 'shoot' | 'reload' | 'wait' | 'potion' | 'next' | 'prev';

const DIR_KEYS: Record<string, Cell> = {
  KeyW: { x: 0, y: -1 }, ArrowUp: { x: 0, y: -1 }, Numpad8: { x: 0, y: -1 },
  KeyS: { x: 0, y: 1 }, ArrowDown: { x: 0, y: 1 }, Numpad2: { x: 0, y: 1 },
  KeyA: { x: -1, y: 0 }, ArrowLeft: { x: -1, y: 0 }, Numpad4: { x: -1, y: 0 },
  KeyD: { x: 1, y: 0 }, ArrowRight: { x: 1, y: 0 }, Numpad6: { x: 1, y: 0 },
  KeyQ: { x: -1, y: -1 }, Numpad7: { x: -1, y: -1 }, KeyE: { x: 1, y: -1 }, Numpad9: { x: 1, y: -1 },
  KeyZ: { x: -1, y: 1 }, Numpad1: { x: -1, y: 1 }, KeyC: { x: 1, y: 1 }, Numpad3: { x: 1, y: 1 },
};
const CMD_KEYS: Record<string, GridCmd> = {
  KeyF: 'shoot', KeyR: 'reload', Space: 'wait', Numpad5: 'wait', Period: 'wait', Digit1: 'potion', Tab: 'next', Backquote: 'prev',
};
/** pad buttons (standard mapping): A shoot, B wait, X reload, Y potion, LB/RB target */
const PAD_CMDS: [number, GridCmd][] = [[0, 'shoot'], [1, 'wait'], [2, 'reload'], [3, 'potion'], [4, 'prev'], [5, 'next']];

/** Keyboard and gamepad for the grid sortie: a held direction (8-way) and one-shot commands. */
export class GridControls {
  private readonly held = new Set<string>();
  private readonly queue: GridCmd[] = [];
  private padPrev: boolean[] = [];
  private padDir: Cell | null = null;

  private readonly down = (e: KeyboardEvent): void => {
    if (DIR_KEYS[e.code] || CMD_KEYS[e.code]) e.preventDefault();
    if (CMD_KEYS[e.code] && !e.repeat) this.queue.push(e.shiftKey && e.code === 'Tab' ? 'prev' : CMD_KEYS[e.code]!);
    this.held.add(e.code);
  };

  private readonly up = (e: KeyboardEvent): void => {
    this.held.delete(e.code);
  };

  private readonly blur = (): void => this.held.clear();

  attach(): () => void {
    window.addEventListener('keydown', this.down);
    window.addEventListener('keyup', this.up);
    window.addEventListener('blur', this.blur);
    return () => {
      window.removeEventListener('keydown', this.down);
      window.removeEventListener('keyup', this.up);
      window.removeEventListener('blur', this.blur);
    };
  }

  push(cmd: GridCmd): void {
    this.queue.push(cmd);
  }

  take(): GridCmd | undefined {
    return this.queue.shift();
  }

  /** Reads the first gamepad: edge-triggered buttons into the queue, the left stick as a direction. */
  pollPad(): void {
    const pad = typeof navigator !== 'undefined' ? navigator.getGamepads?.()?.find((p) => !!p) : undefined;
    if (!pad) { this.padDir = null; return; }
    const now = pad.buttons.map((b) => b.pressed);
    for (const [i, cmd] of PAD_CMDS) if (now[i] && !this.padPrev[i]) this.queue.push(cmd);
    this.padPrev = now;
    const dpad = { x: (now[15] ? 1 : 0) - (now[14] ? 1 : 0), y: (now[13] ? 1 : 0) - (now[12] ? 1 : 0) };
    this.padDir = dpad.x || dpad.y ? dpad : quantize8(pad.axes[0] ?? 0, pad.axes[1] ?? 0, 0.5);
  }

  /** The direction held on keys (two keys combine into a diagonal) or the pad. */
  dir(): Cell | null {
    let x = 0;
    let y = 0;
    for (const k of this.held) { const d = DIR_KEYS[k]; if (d) { x += d.x; y += d.y; } }
    x = Math.sign(x);
    y = Math.sign(y);
    return x || y ? { x, y } : this.padDir;
  }
}
