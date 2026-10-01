import type { BattleEvent } from '../../sim/battle/types';
import { KO, t } from '../i18n/ko';

const MAX_LINES = 50;
const HIGHLIGHT = new Set(['combo', 'rescued', 'downed', 'died', 'phase', 'berserk', 'relation_trigger', 'pair_combo', 'emotion', 'resolve']);

/** Collapsible Korean battle log with a "highlights only" filter. */
export class BattleLog {
  readonly el = document.createElement('div');
  private readonly list: HTMLDivElement;
  private onlyHighlights = false;

  constructor(parent: HTMLElement, private readonly nameOf: (id?: string) => string) {
    this.el.className = 'hud-log';
    this.el.innerHTML = `<div class="hud-log-head"><span>${t('ui.log')}</span>
      <label><input type="checkbox" data-testid="log-filter" /> ${t('ui.logFilter')}</label></div><div class="hud-log-list"></div>`;
    this.list = this.el.querySelector('.hud-log-list')!;
    this.el.querySelector('.hud-log-head span')!.addEventListener('click', () => this.el.classList.toggle('collapsed'));
    this.el.querySelector<HTMLInputElement>('[data-testid="log-filter"]')!.addEventListener('change', (e) => {
      this.onlyHighlights = (e.target as HTMLInputElement).checked;
      this.el.classList.toggle('only-hl', this.onlyHighlights);
    });
    parent.appendChild(this.el);
  }

  private line(e: BattleEvent): string | null {
    const s = this.nameOf(e.src);
    const d = this.nameOf(e.dst);
    const skill = !e.skillId ? '' : e.skillId in KO.tag ? t(`tag.${e.skillId}`) : t(`skill.${e.skillId}`);
    switch (e.type) {
      case 'damage': return `${s}의 ${skill} → ${d} ${e.amount}${e.crit ? ' (치명타)' : ''}`;
      case 'heal': return `${s}의 ${skill} → ${d} +${e.amount}`;
      case 'downed': return `${d} 쓰러짐!`;
      case 'rescued': return `${s}이(가) ${d}을(를) 일으켜 세움`;
      case 'died': return `${d} 사망`;
      case 'combo': return `연계! ${s}의 ${skill} — ${d}의 ${t(`tag.${e.tag}`)} 반응`;
      case 'phase': return `${s}이(가) 분노한다!`;
      case 'berserk': return `시간 초과 — 양측 광폭화 (피해 ×${e.data?.mult})`;
      case 'relation_trigger': return this.relationLine(e, s, d);
      case 'pair_combo': return `전우 연계! ${s} & ${d} — 「${t(`combo.${e.skillId}`)}」`;
      case 'emotion': {
        const id = String(e.data?.id);
        return ['rage', 'fear', 'revenge', 'courage', 'elation'].includes(id) ? `${d}: ${t(`emotion.${id}`)}` : null;
      }
      case 'resolve': return `${d}이(가) 결의로 버텨낸다!`;
      default: return null;
    }
  }

  private relationLine(e: BattleEvent, s: string, d: string): string | null {
    switch (e.data?.kind) {
      case 'protect': return `${s}이(가) 위험한 ${d}을(를) 엄호하러 달려간다`;
      case 'mentor': return `스승 ${s}이(가) 제자 ${d}을(를) 지킨다`;
      case 'rivalry': return e.data?.kill ? `${s}: "${d}에게 질 수 없지!"` : `${s}이(가) 쓰러진 라이벌 ${d}을(를) 보고 분노한다`;
      case 'revenge': return `${s}이(가) ${d}의 복수를 다짐한다`;
      case 'courage': return `${s}이(가) ${d} 곁에서 용기를 낸다`;
      case 'feud': return `${s}와(과) ${d}이(가) 서로 날을 세운다`;
      default: return null;
    }
  }

  add(e: BattleEvent): void {
    const text = this.line(e);
    if (!text) return;
    const row = document.createElement('div');
    row.className = `hud-log-row ${HIGHLIGHT.has(e.type) ? 'hl' : ''} ev-${e.type}`;
    row.textContent = text;
    this.list.prepend(row);
    while (this.list.childElementCount > MAX_LINES) this.list.lastElementChild!.remove();
  }

  dispose(): void {
    this.el.remove();
  }
}
