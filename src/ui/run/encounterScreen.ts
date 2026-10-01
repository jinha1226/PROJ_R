import type { Screen } from '../../app/router';
import { ROSTER_CAP } from '../../sim/run/recruit';
import type { Candidate, RunState } from '../../sim/run/types';
import { t } from '../i18n/ko';

export interface EncounterApi {
  run(): RunState;
  candidates: Candidate[];
  recruit(c: Candidate): void;
  leave(): void;
}

const PAST: Record<string, string> = { friend: '옛 친구', feud: '오랜 악연', rival: '숙명의 라이벌' };

export class EncounterScreen implements Screen {
  private el = document.createElement('div');

  constructor(private readonly api: EncounterApi) {}

  mount(root: HTMLElement): void {
    const run = this.api.run();
    const full = run.roster.mercs.length >= ROSTER_CAP;
    const name = (id: string) => run.roster.mercs.find((m) => m.id === id)?.name ?? id;
    const cards = this.api.candidates.map((c, i) => {
      const m = c.merc;
      const broke = run.gold < c.fee;
      const why = full ? '용병단이 가득 찼다 (8명)' : broke ? '골드가 부족하다' : '';
      return `<div class="candidate" style="--c:${m.color}">
        <b>${m.name}</b><span>Lv${m.level} ${t(`class.${m.classId}`)}</span>
        <span>성격: ${t(`trait.${m.revealed[0]}`)} · ?</span><span class="muted">${m.backstory}</span>
        ${c.past ? `<span class="past">${name(c.past.with)}의 ${PAST[c.past.kind]}</span>` : ''}
        <button class="btn primary" data-i="${i}" data-testid="recruit-${i}" ${why ? 'disabled' : ''}>${c.fee ? `영입 (${c.fee}G)` : '영입 (무료)'}</button>
        ${why ? `<small class="muted">${why}</small>` : ''}</div>`;
    }).join('');
    this.el.className = 'screen node-screen';
    this.el.innerHTML = `<div class="panel node-panel"><h2>만남</h2><p>길에서 일거리를 찾는 이들을 만났다. 한 명을 데려갈 수 있다. (보유 ${run.gold}G)</p>
      <div class="candidates">${cards}</div><div class="choice-list"><button class="btn" data-testid="leave">지나간다</button></div></div>`;
    this.el.addEventListener('click', (e) => {
      const b = (e.target as HTMLElement).closest<HTMLButtonElement>('button');
      if (!b || b.disabled) return;
      if (b.dataset.testid === 'leave') this.api.leave();
      else if (b.dataset.i) this.api.recruit(this.api.candidates[Number(b.dataset.i)]!);
    });
    root.appendChild(this.el);
  }

  unmount(): void {
    this.el.remove();
  }
}

/** Modal asking the protagonist's name (shown after the first recruit). */
export function askName(parent: HTMLElement): Promise<string> {
  return new Promise((resolve) => {
    const el = document.createElement('div');
    el.className = 'modal-backdrop';
    el.innerHTML = `<div class="panel modal"><h2>"그런데, 당신 이름이 뭐요?"</h2><p>새 동료가 묻는다.</p>
      <input class="name-input" maxlength="12" placeholder="이름 없는 모험가" data-testid="name-input" />
      <div class="choice-list"><button class="btn primary" data-testid="name-ok">이름을 말한다</button></div></div>`;
    parent.appendChild(el);
    const input = el.querySelector<HTMLInputElement>('input')!;
    input.focus();
    const done = () => { el.remove(); resolve(input.value); };
    el.querySelector('button')!.addEventListener('click', done);
    input.addEventListener('keydown', (e) => { if (e.key === 'Enter') done(); });
  });
}
