import type { Screen } from '../../app/router';
import type { HallEntry } from '../../app/save';
import type { RunState } from '../../sim/run/types';
import { t } from '../i18n/ko';
import { chronicleText, displayName } from '../company/text';

const HIGHLIGHT_KEYS = new Set(['bossKill', 'eliteKill', 'title', 'newComrade', 'newRival', 'promoted', 'downedRescued', 'scar', 'friendDied', 'died']);

/** Victory (asks for a company name first) or defeat summary; calls finish with the hall entry. */
export class EndScreen implements Screen {
  private el = document.createElement('div');

  constructor(private readonly run: RunState, private readonly finish: (e: HallEntry) => void) {}

  mount(root: HTMLElement): void {
    this.el.className = 'screen node-screen end';
    root.appendChild(this.el);
    if (this.run.status === 'won') this.askName();
    else this.summary(undefined);
  }

  private askName(): void {
    this.el.innerHTML = `<div class="panel node-panel"><h2>잿빛 기사가 쓰러졌다!</h2><p>변경에 당신들의 이름이 퍼진다. 이 용병단을 무엇이라 부를까?</p>
      <input class="name-input" maxlength="16" placeholder="잿빛 사냥꾼들" data-testid="company-name" />
      <div class="choice-list"><button class="btn primary" data-testid="company-ok">이름을 새긴다</button></div></div>`;
    this.el.querySelector('button')!.addEventListener('click', () => {
      const v = this.el.querySelector<HTMLInputElement>('input')!.value.trim().slice(0, 16);
      this.summary(v || '잿빛 사냥꾼들');
    });
  }

  private summary(companyName: string | undefined): void {
    const r = this.run.roster;
    const lead = [...r.mercs, ...r.memorial].find((m) => m.protagonist);
    const step = this.run.at ? this.run.map.nodes[this.run.at]!.step : 0;
    const highlights = [...r.mercs, ...r.memorial].flatMap((m) => m.chronicle.filter((c) => HIGHLIGHT_KEYS.has(c.key)).map((c) => `<li><b>${m.name}</b> ${chronicleText(c, r)}</li>`)).slice(0, 12).join('');
    const entry: HallEntry = {
      companyName: companyName ?? '이름 없는 무리', protagonist: lead?.name ?? '?', result: this.run.status === 'won' ? 'won' : 'lost', step,
      survivors: r.mercs.map((m) => ({ name: m.name, level: m.level, title: m.title })), fallen: r.memorial.map((m) => m.name),
      date: new Date().toISOString().slice(0, 10), seed: this.run.seed,
    };
    this.el.innerHTML = `<div class="panel node-panel" data-testid="run-end"><h2>${entry.result === 'won' ? `「${entry.companyName}」의 전설` : '여정이 끝났다'}</h2>
      <p>${entry.result === 'won' ? '잿빛 변경을 평정했다.' : `${step}단계에서 쓰러졌다.`}</p>
      <h3>살아남은 이들</h3><ul>${r.mercs.map((m) => `<li>${displayName(m)} — Lv${m.level} ${t(`class.${m.classId}`)}</li>`).join('') || '<li>없음</li>'}</ul>
      ${r.memorial.length ? `<h3>잠든 이들</h3><ul>${r.memorial.map((m) => `<li>${displayName(m)} — Lv${m.level}</li>`).join('')}</ul>` : ''}
      ${highlights ? `<h3>연대기</h3><ul class="chronicle">${highlights}</ul>` : ''}
      <div class="choice-list"><button class="btn primary" data-testid="end-ok">명예의 전당에 기록</button></div></div>`;
    this.el.querySelector('[data-testid="end-ok"]')!.addEventListener('click', () => this.finish(entry));
  }

  unmount(): void {
    this.el.remove();
  }
}

export class HallScreen implements Screen {
  private el = document.createElement('div');

  constructor(private readonly entries: HallEntry[], private readonly back: () => void) {}

  mount(root: HTMLElement): void {
    const rows = this.entries.map((e) => `<li><b>${e.result === 'won' ? '[평정] ' : ''}${e.companyName}</b> — ${e.protagonist} · ${e.result === 'won' ? '평정' : `${e.step}단계에서 전멸`}
      <small class="muted">${e.date} · 시드 ${e.seed} · 생존 ${e.survivors.length} · 전사 ${e.fallen.length}</small></li>`).join('');
    this.el.className = 'screen node-screen';
    this.el.innerHTML = `<div class="panel node-panel" data-testid="hall-list"><h2>명예의 전당</h2>
      ${rows ? `<ul class="hall">${rows}</ul>` : '<p class="muted">아직 기록이 없다.</p>'}
      <div class="choice-list"><button class="btn" data-testid="hall-back">돌아가기</button></div></div>`;
    this.el.querySelector('button')!.addEventListener('click', this.back);
    root.appendChild(this.el);
  }

  unmount(): void {
    this.el.remove();
  }
}
