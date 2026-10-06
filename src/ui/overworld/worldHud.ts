import type { Party } from '../../sim/party/partyCore';
import { detailHtml, partyFramesHtml } from './partyFrames';
import type { WorldLog } from './worldLog';

export interface HudActions { pause(): void; speed(): void; stat(): void; bag(): void; restart(): void; quit?: () => void; select(id: string): void; skill(id: string, slot: 0 | 1): void; promote(): void;
  /** turn-based ⇄ real-time fighting (shown when given) */
  mode?: () => void;
  /** down the stairs or the shaft (shown when given; enabled by draw) */
  descend?: () => void;
  descendLabel?: string;
  /** back up to the pod (shown when given; enabled by draw) */
  ascend?: () => void;
  /** pass the turn (Space) — a button for touch screens, shown on the clone's turn */
  wait?: () => void;
  /** open the level-up trait choice for a clone */
  traits?: (id: string) => void }

/**
 * The world screen's frame, laid out like Jupiter Hell: minimap and area top left, the log bottom left, mode and controls top right,
 * the chosen clone bottom right, the party along the bottom; a short toast for what just happened.
 */
export class WorldHud {
  private readonly cache = new Map<string, string>();
  private toastUntil = 0;

  constructor(private readonly el: HTMLElement, private readonly a: HudActions) {
    el.insertAdjacentHTML('beforeend', `<div class="wh-toast"></div>
      <aside class="wh-tl"><div class="wh-mini"></div><div class="wh-area"></div></aside>
      <aside class="wh-bl"><div class="wh-cap">기록</div><div class="wh-log"></div></aside>
      <aside class="wh-tr"><div class="wh-mode"></div><div class="wh-btns">
        <button type="button" data-k="pause"></button><button type="button" data-k="speed"></button>
        <button type="button" data-k="stat">상태 <kbd>C</kbd></button><button type="button" data-k="bag">가방 <kbd>I</kbd></button>
        ${a.mode ? '<button type="button" data-k="mode"></button>' : ''}${a.descend ? `<button type="button" data-k="descend" hidden>${a.descendLabel ?? '▼ 내려가기'}</button>` : ''}${a.ascend ? '<button type="button" data-k="ascend" hidden>▲ 지상으로</button>' : ''}${a.wait ? '<button type="button" data-k="wait" hidden>대기</button>' : ''}
        <button type="button" data-k="restart">다시</button>${a.quit ? '<button type="button" data-k="quit">타이틀</button>' : ''}</div>
        <div class="wh-keys"></div></aside>
      <aside class="wh-br"></aside>
      <div class="wh-party"></div>`);
    el.querySelector('.wh-btns')!.addEventListener('click', (e) => {
      const k = (e.target as HTMLElement).closest<HTMLElement>('[data-k]')?.dataset.k;
      if (k === 'pause') a.pause();
      if (k === 'speed') a.speed();
      if (k === 'stat') a.stat();
      if (k === 'bag') a.bag();
      if (k === 'restart') a.restart();
      if (k === 'quit') a.quit?.();
      if (k === 'mode') a.mode?.();
      if (k === 'descend') a.descend?.();
      if (k === 'ascend') a.ascend?.();
      if (k === 'wait') a.wait?.();
    });
    const party = (e: Event) => {
      const t = e.target as HTMLElement, frame = t.closest<HTMLElement>('[data-hero]'), skill = t.closest<HTMLElement>('[data-skill]');
      if (frame) a.select(frame.dataset.hero!);
      if (skill && frame) a.skill(frame.dataset.hero!, Number(skill.dataset.skill) as 0 | 1);
      if (t.closest('[data-traits]') && frame) a.traits?.(frame.dataset.hero!);
    };
    el.querySelector('.wh-party')!.addEventListener('click', party);
    el.querySelector('.wh-br')!.addEventListener('click', (e) => {
      const t = e.target as HTMLElement, skill = t.closest<HTMLElement>('[data-skill]');
      if (skill) a.skill('', Number(skill.dataset.skill) as 0 | 1);
      if (t.closest('[data-promote]')) a.promote();
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
  private put(sel: string, html: string): void {
    if (this.cache.get(sel) === html) return;
    this.cache.set(sel, html);
    this.el.querySelector(sel)!.innerHTML = html;
  }

  /** area: the top-left figures; mode: the top-right banner; turnBased/realTime label and whether the stairs can be taken. */
  draw(p: Party, ids: string[], sel: string, view: { paused: boolean; speed: number; log: WorldLog; area: string; mode: string; keys: string; turnBased?: boolean; stairs?: boolean; lift?: boolean; myTurn?: boolean }): void {
    if (performance.now() > this.toastUntil) this.el.querySelector('.wh-toast')!.classList.remove('on');
    this.put('.wh-area', view.area);
    this.put('.wh-mode', view.mode);
    this.put('.wh-keys', view.keys);
    this.put('[data-k="pause"]', view.paused ? '▶ 재개' : '❚❚ 정지');
    this.put('[data-k="speed"]', `×${view.speed}`);
    if (this.a.mode) this.put('[data-k="mode"]', view.turnBased ? '전투: 턴제' : '전투: 실시간');
    const down = this.el.querySelector<HTMLElement>('[data-k="descend"]');
    if (down) down.hidden = !view.stairs;
    const up = this.el.querySelector<HTMLElement>('[data-k="ascend"]');
    if (up) up.hidden = !view.lift;
    const wait = this.el.querySelector<HTMLElement>('[data-k="wait"]');
    if (wait) wait.hidden = !view.myTurn;
    this.put('.wh-log', view.log.html());
    this.put('.wh-party', partyFramesHtml(p, ids, sel));
    this.put('.wh-br', detailHtml(p, sel));
  }
}
