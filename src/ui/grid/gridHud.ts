import { DANGER, EXIT_TIME } from '../../sim/grid/danger';
import type { GEvent, GridState } from '../../sim/grid/types';
import { GROUP_NOTE, weaponState } from './weaponInfo';

const LOG: Partial<Record<GEvent['type'], string>> = {
  alarm: '발소리가 늘었다 — 잠든 해골들이 깨어난다', reinforce: '묘지 깊은 곳에서 증원이 몰려온다!', exitClosed: '탈출 지점 하나가 무너졌다',
};
const KIND: Record<string, string> = { minion: '해골 졸개', archer: '해골 석궁병', brute: '해골 전사' };

/** HP, crossbow, potions, turn, haul, the danger clock, the current target and one log line. */
export class GridHud {
  readonly el = document.createElement('div');
  private logTimer = 0;
  private key = '';

  constructor() {
    this.el.className = 'ghud';
    this.el.innerHTML = `<div class="ghud-top">
        <div class="ghud-hp"><div></div><span></span></div>
        <div class="ghud-stats" data-testid="grid-stats"></div>
      </div>
      <div class="ghud-hands" data-testid="grid-hands"></div>
      <div class="ghud-danger"></div>
      <div class="ghud-exit" hidden><span>탈출 중</span><div><div></div></div></div>
      <div class="ghud-log" hidden></div>
      <div class="ghud-help muted">WASD·QEZC 이동(꾹 누르면 연속) · F 사격 · Tab 표적 · R 장전 · Space 쉬기 · 1 물약 · 클릭 이동 · 휠 확대</div>`;
  }

  cue(e: GEvent): void {
    const text = e.type === 'pickup' ? `${e.text} 획득` : e.type === 'full' ? `가방이 가득 찼다 — ${e.text}은(는) 바닥에` : e.type === 'equip' || e.type === 'swap' ? `${e.text} 듦` : e.type === 'loot' && e.text && !e.amount ? `${e.text} 획득` : LOG[e.type];
    if (!text) return;
    const el = this.el.querySelector<HTMLElement>('.ghud-log')!;
    el.textContent = text;
    el.hidden = false;
    this.logTimer = 3;
  }

  update(s: GridState, target: { id: string; chance: number } | null, dt: number): void {
    const h = s.hero;
    const t = target ? s.foes.find((f) => f.id === target.id) : undefined;
    const g = h.gear;
    const key = JSON.stringify([h.hp, g.hands, g.active, g.arrows, g.belt.potion, Math.floor(s.time), h.exitTime, target, t?.hp, s.danger]);
    if (key !== this.key) {
      this.key = key;
      const q = <T extends HTMLElement>(sel: string) => this.el.querySelector<T>(sel)!;
      q('.ghud-hp div').style.width = `${(h.hp / h.maxHp) * 100}%`;
      q('.ghud-hp span').textContent = `HP ${h.hp}/${h.maxHp}`;
      q('.ghud-stats').innerHTML = `<span>화살 <b>${g.arrows}</b></span><span>물약 <b>${g.belt.potion}</b></span><span>턴 <b>${Math.floor(s.time)}</b></span>`;
      q('.ghud-hands').innerHTML = g.hands.map((w, i) => `<button class="ghand ${i === g.active ? 'on' : ''}" data-swap="1">${w ? `<b>${w.name}</b><small>${weaponState(w, g.arrows) || GROUP_NOTE[w.group]}</small>` : '<b>빈손</b>'}</button>`).join('<span class="ghand-x">⇄</span>');
      const next = s.danger === 0 ? `${DANGER.alarm}턴 순찰 증가` : s.danger === 1 ? `${DANGER.reinforce}턴 증원 · 탈출 지점 붕괴` : '증원이 왔다';
      q('.ghud-danger').innerHTML = `${t ? `<b>${KIND[t.kind]}</b> HP ${t.hp} · 명중 ${Math.round(target!.chance * 100)}% · ` : ''}위험: ${next}`;
      q('.ghud-exit').hidden = h.exitTime <= 0;
      q('.ghud-exit div div').style.width = `${Math.min(1, h.exitTime / EXIT_TIME) * 100}%`;
    }
    this.logTimer -= dt;
    if (this.logTimer <= 0) this.el.querySelector<HTMLElement>('.ghud-log')!.hidden = true;
  }
}
