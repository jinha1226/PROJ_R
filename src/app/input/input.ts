/** Minimal gamepad shape (standard mapping) so tests can inject fakes. */
export interface PadLike {
  axes: readonly number[];
  buttons: readonly { pressed: boolean }[];
}

export interface InputState {
  move: { x: number; y: number };
  interact: boolean;
  cancel: boolean;
  rotateL: boolean;
  rotateR: boolean;
  menu: boolean;
  toggleManual: boolean;
  attack: boolean;
  skill1: boolean;
  skill2: boolean;
  ult: boolean;
}

type Action = Exclude<keyof InputState, 'move'>;

const DEAD = 0.2;
const PAD: Record<Action, number> = { interact: 0, cancel: 1, attack: 0, skill1: 2, skill2: 3, rotateL: 4, rotateR: 5, ult: 5, toggleManual: 8, menu: 9 };
const KEYS: Record<Action, string[]> = {
  interact: ['KeyE', 'Enter'], cancel: ['Escape', 'Backspace'], rotateL: ['KeyZ'], rotateR: ['KeyX'], menu: ['Escape'],
  toggleManual: ['Tab'], attack: ['KeyJ'], skill1: ['KeyK'], skill2: ['KeyL'], ult: ['KeyI'],
};
const MOVE_KEYS = { up: ['KeyW', 'ArrowUp'], down: ['KeyS', 'ArrowDown'], left: ['KeyA', 'ArrowLeft'], right: ['KeyD', 'ArrowRight'] };

/** Keyboard + first connected gamepad, merged; buttons are edge-triggered, movement is continuous. */
export class Input {
  private readonly down = new Set<string>();
  /** keys pressed since the last poll, so a tap between two frames is not lost */
  private readonly tapped = new Set<string>();
  private readonly prev = new Set<Action>();

  constructor(private readonly pads: () => readonly (PadLike | null | undefined)[] = () => navigator.getGamepads?.() ?? []) {}

  key(code: string, isDown: boolean): void {
    if (isDown) { this.down.add(code); this.tapped.add(code); }
    else this.down.delete(code);
  }

  attach(target: Window): () => void {
    const kd = (e: KeyboardEvent) => { if (!(e.target instanceof HTMLInputElement)) this.key(e.code, true); };
    const ku = (e: KeyboardEvent) => this.key(e.code, false);
    const blur = () => this.down.clear();
    target.addEventListener('keydown', kd);
    target.addEventListener('keyup', ku);
    target.addEventListener('blur', blur);
    return () => { target.removeEventListener('keydown', kd); target.removeEventListener('keyup', ku); target.removeEventListener('blur', blur); };
  }

  private pad(): PadLike | undefined {
    try {
      return [...this.pads()].find((p): p is PadLike => !!p);
    } catch {
      return undefined;
    }
  }

  poll(): InputState {
    const pad = this.pad();
    const any = (codes: string[]) => codes.some((c) => this.down.has(c));
    let x = (any(MOVE_KEYS.right) ? 1 : 0) - (any(MOVE_KEYS.left) ? 1 : 0);
    let y = (any(MOVE_KEYS.down) ? 1 : 0) - (any(MOVE_KEYS.up) ? 1 : 0);
    const kl = Math.hypot(x, y);
    if (kl > 0) { x /= kl; y /= kl; }
    if (pad) {
      const ax = pad.axes[0] ?? 0;
      const ay = pad.axes[1] ?? 0;
      const m = Math.hypot(ax, ay);
      if (m > DEAD) {
        const k = Math.min(1, (m - DEAD) / (1 - DEAD)) / m;
        x = ax * k;
        y = ay * k;
      }
    }
    const held = (a: Action) => any(KEYS[a]) || KEYS[a].some((c) => this.tapped.has(c)) || !!pad?.buttons[PAD[a]]?.pressed;
    const state = { move: { x: x || 0, y: y || 0 } } as InputState;
    for (const a of Object.keys(PAD) as Action[]) {
      const h = held(a);
      state[a] = h && !this.prev.has(a);
      if (h) this.prev.add(a);
      else this.prev.delete(a);
    }
    this.tapped.clear();
    return state;
  }
}
