import type { Party } from '../../sim/party/partyCore';
import { detailHtml, partyFramesHtml } from './partyFrames';
import type { WorldLog } from './worldLog';
import { BODY_COST, type RoamParty } from '../../sim/roam/roam';

export interface HudActions { menu(): void; stat(): void; bag(): void; select(id: string): void; skill(id: string, slot: number): void;
  /** the return beacon (the dungeon only) */
  beacon?: () => void;
  /** down the stairs or the shaft (shown when given; enabled by draw) */
  descend?: () => void;
  descendLabel?: string;
  /** back up to the pod (shown when given; enabled by draw) */
  ascend?: () => void;
  /** pass the turn (Space) — shown on the clone's turn */
  wait?: () => void;
  /** open the level-up trait choice for a clone */
  traits?: (id: string) => void;
  /** the build panel (the surface only) */
  build?: () => void }

/**
 * The screen's frame, laid out like Jupiter Hell: the minimap top left, floor/turn/bio top centre, the log bottom left,
 * the fight banner and the menu top right, the chosen clone bottom right, the party along the bottom; a short toast for what just happened.
 */
export class WorldHud {
  private readonly cache = new Map<string, string>();
  private toastUntil = 0;

  constructor(private readonly el: HTMLElement, private readonly a: HudActions) {
    el.insertAdjacentHTML('beforeend', `<div class="wh-toast"></div><div class="wh-top"></div><div class="wh-target"></div>
      <aside class="wh-tl"><div class="wh-mini"></div></aside>
      <aside class="wh-bl" title="전체 기록 보기"><div class="wh-cap">기록 <span>▸ 전체</span></div><div class="wh-log"></div></aside>
      <aside class="wh-tr"><div class="wh-mode"></div><div class="wh-btns">
        ${a.descend ? `<button type="button" data-k="descend" hidden>${a.descendLabel ?? '▼ 내려가기'}</button>` : ''}${a.ascend ? '<button type="button" data-k="ascend" hidden>▲ 지상으로</button>' : ''}${a.beacon ? '<button type="button" data-k="beacon">신호기</button>' : ''}
        <button type="button" data-k="menu" class="wh-menu">☰</button></div></aside>
      <aside class="wh-br"></aside>
      <div class="wh-party"></div>`);
    el.querySelector('.wh-btns')!.addEventListener('click', (e) => {
      const k = (e.target as HTMLElement).closest<HTMLElement>('[data-k]')?.dataset.k;
      if (k === 'menu') a.menu();
      if (k === 'stat') a.stat();
      if (k === 'build') a.build?.();
      if (k === 'bag') a.bag();
      if (k === 'descend') a.descend?.();
      if (k === 'ascend') a.ascend?.();
      if (k === 'wait') a.wait?.();
      if (k === 'beacon') a.beacon?.();
    });
    const party = (e: Event) => {
      const t = e.target as HTMLElement, frame = t.closest<HTMLElement>('[data-hero]'), skill = t.closest<HTMLElement>('[data-skill]');
      if (frame) a.select(frame.dataset.hero!);
      if (skill && frame) a.skill(frame.dataset.hero!, Number(skill.dataset.skill));
      if (t.closest('[data-traits]') && frame) a.traits?.(frame.dataset.hero!);
    };
    el.querySelector('.wh-party')!.addEventListener('click', party);
    // the corner log opens the whole of it: a window over the game, the newest at the bottom
    el.querySelector('.wh-bl')!.addEventListener('click', () => this.openLog());
    el.querySelector('.wh-br')!.addEventListener('click', (e) => {
      const t = e.target as HTMLElement, skill = t.closest<HTMLElement>('[data-skill]');
      if (skill) a.skill('', Number(skill.dataset.skill));
      if (t.closest('[data-traits]')) a.traits?.('');
    });
  }

  get minimapSlot(): HTMLElement { return this.el.querySelector('.wh-mini')!; }

  toast(text: string): void {
    const t = this.el.querySelector<HTMLElement>('.wh-toast')!;
    t.textContent = text;
    t.classList.add('on');
    this.toastUntil = performance.now() + 2600;
  }

  /** Writes a part only when its markup changed (a rebuilt button under the cursor would eat the click). */
  private full: HTMLElement | null = null;
  private log: WorldLog | null = null;
  private fullCount = -1;
  private readonly onKey = (e: KeyboardEvent): void => { if (e.key === 'Escape' && this.full) { e.stopPropagation(); e.preventDefault(); this.closeLog(); } };

  /** The whole log in a window (every line kept, wrapped, the newest last). A click outside it, its ✕ or Esc closes it. */
  private openLog(): void {
    if (this.full || !this.log) return;
    const box = document.createElement('div');
    box.className = 'wl-full';
    box.innerHTML = '<div class="wl-box"><header><span>기록</span><button type="button" data-x>✕</button></header><div class="wl-all"></div></div>';
    box.addEventListener('click', (e) => { const t = e.target as HTMLElement; if (t === box || t.closest('[data-x]')) this.closeLog(); });
    // the game's own keys and taps do not act through the window
    for (const type of ['pointerdown', 'mousedown', 'touchstart', 'wheel'] as const) box.addEventListener(type, (e) => e.stopPropagation());
    window.addEventListener('keydown', this.onKey, true);
    this.el.append(box);
    this.full = box; this.fullCount = -1;
    this.fillLog();
  }
  private closeLog(): void {
    window.removeEventListener('keydown', this.onKey, true);
    this.full?.remove(); this.full = null;
  }
  /** Fills the window when lines have come in; it stays at the bottom if the reader was there. */
  private fillLog(): void {
    const all = this.full?.querySelector<HTMLElement>('.wl-all');
    if (!all || !this.log) return;
    const last = this.log.lines[this.log.lines.length - 1], key = this.log.lines.length * 100000 + Math.round((last?.at ?? 0) * 10);
    if (key === this.fullCount) return;
    const atBottom = this.fullCount < 0 || all.scrollHeight - all.scrollTop - all.clientHeight < 24;
    this.fullCount = key;
    all.innerHTML = this.log.fullHtml();
    if (atBottom) all.scrollTop = all.scrollHeight;
  }

  private put(sel: string, html: string): boolean {
    if (this.cache.get(sel) === html) return false;
    this.cache.set(sel, html);
    this.el.querySelector(sel)!.innerHTML = html;
    return true;
  }

  /** status: the top-centre line (floor, turn, bio); mode: the fight banner; and whether the stairs, the lift or a turn is waiting. */
  draw(p: Party, ids: string[], sel: string, view: { log: WorldLog; status: string; mode: string; stairs?: boolean; lift?: boolean; myTurn?: boolean; target?: string; beacon?: { label: string; on: boolean } }): void {
    if (performance.now() > this.toastUntil) this.el.querySelector('.wh-toast')!.classList.remove('on');
    this.put('.wh-top', view.status);
    this.put('.wh-mode', view.mode);
    this.put('.wh-target', view.target ?? '');
    const show = (k: string, on?: boolean) => { const b = this.el.querySelector<HTMLElement>(`[data-k="${k}"]`); if (b) b.hidden = !on; };
    show('descend', view.stairs);
    show('ascend', view.lift);
    show('wait', view.myTurn);
    const bc = this.el.querySelector<HTMLButtonElement>('[data-k="beacon"]');
    if (bc && view.beacon) { if (bc.textContent !== view.beacon.label) bc.textContent = view.beacon.label; bc.disabled = !view.beacon.on; }
    this.put('.wh-log', view.log.html());
    this.log = view.log;
    if (this.full) this.fillLog();
    if (this.put('.wh-party', partyFramesHtml(p, ids, sel))) {
      // on an upright phone the log sits just above the portraits, however tall they come out
      const party = this.el.querySelector<HTMLElement>('.wh-party')!;
      const top = party.getBoundingClientRect().top;
      if (top > 0) this.el.style.setProperty('--log-bottom', `${Math.round(this.el.getBoundingClientRect().bottom - top + 4)}px`);
    }
    this.put('.wh-br', detailHtml(p, sel));
  }
}

/** The top-centre lines: where and which turn, then what the party holds (ore, crystal, bio-matter against a body's cost, souls carried). */
export function statusLine(place: string, p: RoamParty): string {
  const souls = p.carried.length ? `<span class="soul">영혼 <b>${p.carried.length}</b></span>` : '';
  return `<div class="st-row"><span>${place}</span><span>턴 <b>${Math.floor(p.time)}</b></span></div>`
    + `<div class="st-row st-res"><span>광석 <b>${p.ore}</b></span><span>마정석 <b>${p.crystal}</b></span><span class="bio${p.bio >= BODY_COST ? ' ok' : ''}">생체 <b>${p.bio}</b></span>${souls}</div>`;
}
