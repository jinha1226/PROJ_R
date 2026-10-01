import type { Input } from '../../app/input/input';
import { TouchState, type TouchButton } from '../../app/input/touch';

const STICK_RADIUS = 60;
const BUTTONS: { b: TouchButton; label: string; cls: string }[] = [
  { b: 'focus', label: '집중', cls: 'tb-attack' },
  { b: 'retreat', label: '후퇴', cls: 'tb-s1' },
  { b: 'regroup', label: '재집결', cls: 'tb-s2' },
  { b: 'pick', label: '조사', cls: 'tb-pick' },
];
const MENU: { b: TouchButton; label: string; cls: string }[] = [
  { b: 'menu', label: '짐·메뉴', cls: 'tb-menu' },
];

/** Pointer capture can throw for a pointer that already ended; the press itself still counts. */
function capture(el: HTMLElement, id: number): void {
  try {
    el.setPointerCapture?.(id);
  } catch {
    /* pointer no longer active */
  }
}

export const isTouchDevice = (): boolean => typeof matchMedia === 'function' && matchMedia('(pointer: coarse)').matches;

/** Floating stick on the left half, action buttons on the right; feeds Input as its virtual source. */
export class TouchControls {
  readonly el = document.createElement('div');
  private readonly ts: TouchState;
  private readonly knob = document.createElement('div');
  private readonly base = document.createElement('div');

  constructor(private readonly input: Input) {
    this.ts = new TouchState(() => window.innerWidth, STICK_RADIUS);
    this.el.className = 'touch-controls';
    this.base.className = 'tc-stick';
    this.knob.className = 'tc-knob';
    this.base.appendChild(this.knob);
    this.base.hidden = true;
    const pad = document.createElement('div');
    pad.className = 'tc-pad';
    pad.addEventListener('pointerdown', (e) => this.onPadDown(e));
    const buttons = document.createElement('div');
    buttons.className = 'tc-buttons';
    for (const { b, label, cls } of BUTTONS) buttons.appendChild(this.button(b, label, cls));
    const menu = document.createElement('div');
    menu.className = 'tc-menu';
    for (const { b, label, cls } of MENU) menu.appendChild(this.button(b, label, cls));
    this.el.append(pad, this.base, buttons, menu);
    const move = (e: PointerEvent) => { this.ts.move(e.pointerId, e.clientX, e.clientY); this.sync(); };
    const up = (e: PointerEvent) => { this.ts.up(e.pointerId); this.sync(); };
    this.el.addEventListener('pointermove', move);
    this.el.addEventListener('pointerup', up);
    this.el.addEventListener('pointercancel', up);
  }

  private button(b: TouchButton, label: string, cls: string): HTMLElement {
    const el = document.createElement('div');
    el.className = `tc-btn ${cls}`;
    el.textContent = label;
    el.dataset.testid = `touch-${b}`;
    el.addEventListener('pointerdown', (e) => {
      e.stopPropagation();
      capture(el, e.pointerId);
      this.ts.press(e.pointerId, b);
      this.sync();
    });
    return el;
  }

  private onPadDown(e: PointerEvent): void {
    if (!this.ts.down(e.pointerId, e.clientX, e.clientY)) return;
    capture(e.target as HTMLElement, e.pointerId);
    this.sync();
  }

  private sync(): void {
    const st = this.ts.state();
    this.input.setVirtual(st);
    const o = this.ts.stickOrigin();
    this.base.hidden = !o;
    if (o) {
      this.base.style.left = `${o.x}px`;
      this.base.style.top = `${o.y}px`;
      this.knob.style.transform = `translate(${(st.move?.x ?? 0) * STICK_RADIUS}px, ${(st.move?.y ?? 0) * STICK_RADIUS}px)`;
    }
    const on = new Set(Object.entries(st).filter(([, v]) => v === true).map(([k]) => k));
    for (const el of this.el.querySelectorAll<HTMLElement>('.tc-btn')) el.classList.toggle('on', on.has((el.dataset.testid ?? '').slice(6)));
  }

  /** The pick-up button only shows when something is in reach. */
  setPickVisible(on: boolean): void {
    const p = this.el.querySelector<HTMLElement>('.tb-pick');
    if (p) p.hidden = !on;
  }

  dispose(): void {
    this.input.setVirtual({});
    this.el.remove();
  }
}
