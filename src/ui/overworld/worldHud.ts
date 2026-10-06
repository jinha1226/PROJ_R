import { claimedShare, type WorldParty } from '../../sim/overworld/worldSim';
import { detailHtml, partyFramesHtml } from './partyFrames';
import type { WorldLog } from './worldLog';

export interface HudActions { pause(): void; speed(): void; stat(): void; bag(): void; restart(): void; quit?: () => void; select(id: string): void; skill(id: string, slot: 0 | 1): void; promote(): void }

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
        <button type="button" data-k="restart">다시</button>${a.quit ? '<button type="button" data-k="quit">타이틀</button>' : ''}</div>
        <div class="wh-keys">클릭 이동 · 적 클릭 공격 · Q W 기술 · Space 정지 · 휠 확대</div></aside>
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
    });
    const party = (e: Event) => {
      const t = e.target as HTMLElement, frame = t.closest<HTMLElement>('[data-hero]'), skill = t.closest<HTMLElement>('[data-skill]');
      if (frame) a.select(frame.dataset.hero!);
      if (skill && frame) a.skill(frame.dataset.hero!, Number(skill.dataset.skill) as 0 | 1);
    };
    el.querySelector('.wh-party')!.addEventListener('click', party);
    el.querySelector('.wh-br')!.addEventListener('click', (e) => {
      const t = e.target as HTMLElement, skill = t.closest<HTMLElement>('[data-skill]');
      if (skill) a.skill('', Number(skill.dataset.skill) as 0 | 1);
      if (t.closest('[data-promote]')) a.promote();
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

  draw(p: WorldParty, ids: string[], sel: string, paused: boolean, speed: number, log: WorldLog): void {
    if (performance.now() > this.toastUntil) this.el.querySelector('.wh-toast')!.classList.remove('on');
    const taken = p.camps.filter((c) => c.cleared).length;
    this.put('.wh-area', `<div><span>영역</span><b>${Math.round(claimedShare(p) * 100)}%</b></div><div><span>진지</span><b>${taken}/${p.camps.length}</b></div><div><span>클론</span><b>${ids.length}/3</b></div>${p.carried.length ? `<div class="soul"><span>영혼</span><b>${p.carried.length}</b></div>` : ''}`);
    this.put('.wh-mode', p.combat ? '<b class="fight">전투</b>' : '<b>탐색</b>');
    this.put('[data-k="pause"]', paused ? '▶ 재개' : '❚❚ 정지');
    this.put('[data-k="speed"]', `×${speed}`);
    this.put('.wh-log', log.html());
    this.put('.wh-party', partyFramesHtml(p, ids, sel));
    this.put('.wh-br', detailHtml(p, sel));
  }
}
