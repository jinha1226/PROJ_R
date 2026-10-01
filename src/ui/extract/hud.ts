import { xitem } from '../../data/extract';
import type { Nearby } from '../../sim/world/interact';
import type { WorldState } from '../../sim/world/types';
import { hudState } from './hudState';
import { Minimap } from './minimap';
import { ALERT, PHASE_NAME } from './names';
import { PartyBar } from './partyBar';

export type Order = 'focus' | 'retreat' | 'regroup' | 'pick';
const ORDERS: { k: Order; label: string; key: string }[] = [
  { k: 'focus', label: '집중 공격', key: 'F' }, { k: 'retreat', label: '후퇴', key: 'R' }, { k: 'regroup', label: '재집결', key: 'G' },
];
const TOAST_SEC = 2.2;

/** Sortie HUD: draws only what hudState reports (party, value, clock, minimap, orders, channel, prompt) plus alerts and pickup toasts. */
export class Hud {
  readonly el = document.createElement('div');
  private readonly bar = new PartyBar();
  private map: Minimap | null = null;
  private lastEvent = 0;
  private alertTimer = 0;
  private toasts: { text: string; t: number }[] = [];
  private toastKey = '';
  private readonly clicked = new Set<Order>();

  constructor() {
    this.el.className = 'xhud';
    this.el.innerHTML = `<div class="xhud-top">
        <div class="xhud-value" data-testid="carried-value"></div>
        <div class="xhud-clock" data-testid="clock"></div>
        <div class="xhud-mode" hidden>전투 중</div>
      </div>
      <div class="xhud-channel" hidden><span></span><div><div></div></div></div>
      <div class="xhud-prompt" data-testid="prompt" hidden></div>
      <div class="xhud-alert" hidden></div>
      <div class="xhud-toasts"></div>
      <div class="xhud-orders">${ORDERS.map((o) => `<button class="btn" data-order="${o.k}" data-testid="order-${o.k}"><b>${o.key}</b> ${o.label}</button>`).join('')}
        <button class="btn primary" data-order="pick" data-testid="order-pick" hidden><b>E</b> <span></span></button></div>
      <div class="xhud-help muted">WASD 리더 이동 · F 집중 · R 후퇴 · G 재집결 · E 조사 · Esc 짐/일시정지 · Z X 카메라 · 휠 확대</div>`;
    this.el.insertBefore(this.bar.el, this.el.querySelector('.xhud-channel'));
    this.el.querySelector('.xhud-orders')!.addEventListener('click', (e) => {
      const k = (e.target as HTMLElement).closest<HTMLElement>('[data-order]')?.dataset.order as Order | undefined;
      if (k) this.clicked.add(k);
    });
  }

  /** An order clicked on screen since the last frame (consumed once). */
  takeOrder(k: Order): boolean {
    return this.clicked.delete(k);
  }

  update(w: WorldState, nearby: Nearby, dt: number): void {
    const q = <T extends HTMLElement>(sel: string) => this.el.querySelector<T>(sel)!;
    const h = hudState(w, nearby);
    q('.xhud-value').innerHTML = `<b>${h.value}G</b> <small>${h.slots[0]}/${h.slots[1]}칸 · ${h.weight[0]}/${h.weight[1]}</small>`;
    q('.xhud-clock').innerHTML = `<b>${h.clock}</b> ${PHASE_NAME[h.phase]}`;
    q('.xhud-clock').className = `xhud-clock ph-${h.phase}`;
    q('.xhud-mode').hidden = !h.combat;
    this.bar.update(h.party);
    q('.xhud-channel').hidden = !h.channel;
    if (h.channel) {
      q('.xhud-channel span').textContent = h.channel.label;
      q('.xhud-channel div div').style.width = `${h.channel.frac * 100}%`;
    }
    q('.xhud-prompt').hidden = !h.prompt;
    if (h.prompt) q('.xhud-prompt').innerHTML = `<b>E</b> / Ⓑ ${h.prompt}`;
    const pick = q('[data-order="pick"]');
    pick.hidden = !h.prompt;
    if (h.prompt) q('[data-order="pick"] span').textContent = h.prompt;
    (q('[data-order="retreat"]') as HTMLButtonElement).disabled = !h.orders.retreat;
    this.alerts(w, dt);
    if (!this.map) {
      this.map = new Minimap(w.region.bounds);
      this.el.insertBefore(this.map.el, q('.xhud-channel'));
    }
    this.map.draw(h.minimap);
  }

  private alerts(w: WorldState, dt: number): void {
    const el = this.el.querySelector<HTMLElement>('.xhud-alert')!;
    for (; this.lastEvent < w.events.length; this.lastEvent++) {
      const e = w.events[this.lastEvent]!;
      if (e.type === 'picked') this.toast(`+ ${xitem(String(e.data?.id)).name}${Number(e.data?.n) > 1 ? ` ×${e.data?.n}` : ''}`);
      const text = e.type === 'found' ? (e.data?.rare ? '귀한 물건을 찾았다!' : '') : ALERT[e.type];
      if (e.type === 'found' && !e.data?.rare) this.toast(`짐에 챙겼다 (${(e.data?.items as unknown[] | undefined)?.length ?? 0}개)`);
      if (!text) continue;
      el.textContent = text;
      el.className = `xhud-alert a-${e.type}${e.data?.rare ? ' a-rare' : ''}`;
      el.hidden = false;
      this.alertTimer = 3;
    }
    this.alertTimer -= dt;
    if (this.alertTimer <= 0) el.hidden = true;
    this.toasts = this.toasts.map((t) => ({ ...t, t: t.t - dt })).filter((t) => t.t > 0);
    const key = this.toasts.map((t) => t.text).join('|');
    if (key === this.toastKey) return;
    this.toastKey = key;
    this.el.querySelector('.xhud-toasts')!.innerHTML = this.toasts.map((t) => `<div>${t.text}</div>`).join('');
  }

  private toast(text: string): void {
    this.toasts = [...this.toasts.slice(-3), { text, t: TOAST_SEC }];
  }
}
