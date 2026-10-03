import { activeWeapon, CLASS_NAME } from '../../sim/grid/gear';
import type { GEvent, GridState } from '../../sim/grid/types';
import { icon, weaponIcon } from './icons';
import { weaponState } from './weaponInfo';

const LOG: Partial<Record<GEvent['type'], string>> = {
  alarm: '발소리가 늘었다 — 잠든 해골들이 깨어난다', reinforce: '묘지 깊은 곳에서 증원이 몰려온다!', exitClosed: '탈출 지점 하나가 무너졌다',
};
const KIND: Record<string, string> = { minion: '해골 졸개', archer: '해골 석궁병', brute: '해골 전사', ghoul: '구울', mage: '해골 마법사', champion: '해골 챔피언' };

/** Top bar (level badge, health, arrows/potions/turn, weapon in hand), target card, danger line, toasts. */
export class GridHud {
  readonly el = document.createElement('div');
  private logTimer = 0;
  private key = '';

  constructor() {
    this.el.className = 'ghud';
    this.el.innerHTML = `<div class="gh-top">
        <div class="gh-badge"><b></b><small></small></div>
        <div class="gh-main">
          <div class="gh-hp">${icon('heart', 'gh-hp-ic')}<div class="gh-hp-bar"><div class="gh-hp-fill"></div><div class="gh-hp-lag"></div></div><span class="gh-hp-num"></span></div>
          <div class="gh-res" data-testid="grid-stats"></div>
        </div>
        <div class="gh-weapon"></div>
      </div>
      <div class="gh-target" hidden></div>
      <div class="gh-danger"></div>
      <div class="ghud-log" hidden></div>
      <div class="ghud-help muted">WASD·QEZC 이동(꾹 누르면 연속) · F 사격 · X 교체 · I 가방 · Tab 표적 · Space 쉬기 · 1 물약 · 클릭 이동 · 휠 확대</div>`;
  }

  cue(e: GEvent): void {
    const text = e.type === 'pickup' ? `${e.text} 획득` : e.type === 'full' ? `가방이 가득 찼다 — ${e.text}은(는) 바닥에` : e.type === 'equip' || e.type === 'swap' ? `${e.text} 듦` : e.type === 'loot' && e.text && !e.amount ? `${e.text} 획득` : LOG[e.type];
    if (!text) return;
    const el = this.el.querySelector<HTMLElement>('.ghud-log')!;
    el.textContent = text;
    el.hidden = false;
    el.classList.toggle('warn', !!LOG[e.type]);
    this.logTimer = 2.6;
  }

  update(s: GridState, target: { id: string; chance: number } | null, dt: number): void {
    const h = s.hero;
    const g = h.gear;
    const w = activeWeapon(g);
    const t = target ? s.foes.find((f) => f.id === target.id) : undefined;
    const key = JSON.stringify([h.hp, h.maxHp, h.level, g.hands, g.active, g.arrows, g.belt.potion, Math.floor(s.time), target, t?.hp, s.run]);
    if (key !== this.key) {
      this.key = key;
      const q = <T extends HTMLElement>(sel: string) => this.el.querySelector<T>(sel)!;
      q('.gh-badge b').textContent = `${h.level}`;
      q('.gh-badge small').textContent = CLASS_NAME[g.cls];
      const frac = Math.max(0, h.hp / h.maxHp);
      q('.gh-hp-fill').style.width = `${frac * 100}%`;
      q('.gh-hp-fill').classList.toggle('low', frac < 0.35);
      q('.gh-hp-lag').style.width = `${frac * 100}%`;
      q('.gh-hp-num').textContent = `${h.hp} / ${h.maxHp}`;
      q('.gh-res').innerHTML = `<span title="화살">${icon('arrow')}<b>${g.arrows}</b><i>화살</i></span><span title="물약">${icon('potion')}<b>${g.belt.potion}</b><i>물약</i></span><span title="턴">${icon('hourglass')}<b>${Math.floor(s.time)}</b><i>턴</i></span>`;
      q('.gh-weapon').innerHTML = w ? `${weaponIcon(w.group)}<div><b>${w.name}</b><small>${weaponState(w, g.arrows) || '근접'}</small></div>` : `${icon('swap')}<div><b>빈손</b></div>`;
      const card = q('.gh-target');
      card.hidden = !t;
      if (t) card.innerHTML = `${icon('skull')}<b>${KIND[t.kind] ?? '적'}</b><div class="gh-t-bar"><div style="width:${(t.hp / t.maxHp) * 100}%"></div></div><span>${Math.round(target!.chance * 100)}%</span>`;
      q('.gh-danger').textContent = `${s.run.floor}층 / 3 · 처치 ${s.run.kills}${s.run.floor >= 3 ? ' · 해골 챔피언이 기다린다' : ''}`;
    }
    this.logTimer -= dt;
    if (this.logTimer <= 0) this.el.querySelector<HTMLElement>('.ghud-log')!.hidden = true;
  }
}
