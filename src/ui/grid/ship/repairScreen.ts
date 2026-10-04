import { MATERIAL_NAME, MATERIALS, type Material } from '../../../sim/grid/materials';
import type { MetaState } from '../../../sim/grid/meta';
import { canRepair, SYSTEMS, type SystemId } from '../../../sim/grid/repairs';
import '../../styles/workbench.css';

export interface RepairApi { meta(): MetaState; repair(id: SystemId): void; close(): void }

const TOOL_NAME = { cutter: '절단기', grapple: '갈고리', scanner: '스캐너' } as const;
/** what each repair opens, in a few words */
const OPENS: Record<SystemId, string[]> = {
  workbench: ['개조', '원소탄'], suitlab: ['각인 해금', '시작 각인 칸'], nav: ['지름길'],
  lifeSupport: ['클론 수용'], pod: ['특기 클론'], core: ['출발'],
};
/** where each system sits on the hull drawing (x, y of its room) */
const ROOM: Record<SystemId, [number, number]> = {
  pod: [74, 104], lifeSupport: [140, 64], suitlab: [212, 64], workbench: [176, 150], nav: [300, 104], core: [232, 108],
};
const RW = 56, RH = 30;

type State = 'done' | 'ready' | 'short' | 'locked';
function stateOf(m: MetaState, id: SystemId): State {
  if (m.repairs.includes(id)) return 'done';
  if (canRepair(m, id)) return 'ready';
  return (SYSTEMS[id].needs ?? []).every((n) => m.repairs.includes(n)) ? 'short' : 'locked';
}
const STATE_LABEL: Record<State, string> = { done: '수리됨', ready: '수리 가능', short: '재료 부족', locked: '선행 수리 필요' };

/** The ship's systems on a hull blueprint, linked in repair order; the selected one shows its cost and what it opens. */
export class RepairScreen {
  readonly el = document.createElement('div');
  private sel: SystemId = 'workbench';
  private flash: SystemId | null = null;

  constructor(private readonly api: RepairApi) {
    this.el.className = 'wb rp';
    this.el.dataset.testid = 'repair';
    this.el.addEventListener('click', (e) => {
      const t = e.target as Element;
      if (t.closest('[data-close]')) return this.api.close();
      const sys = t.closest('[data-sys]')?.getAttribute('data-sys') as SystemId | null;
      if (sys) { this.sel = sys; return this.render(); }
      if (t.closest('[data-repair]')) {
        this.api.repair(this.sel);
        this.flash = this.sel;
        setTimeout(() => { this.flash = null; this.render(); }, 700);
        this.render();
      }
    });
    this.el.addEventListener('keydown', (e) => { if (e.key === 'Escape') this.api.close(); });
    this.render();
  }

  private hull(m: MetaState): string {
    const ids = Object.keys(SYSTEMS) as SystemId[];
    const links = ids.flatMap((id) => (SYSTEMS[id].needs ?? []).map((n) => {
      const [x1, y1] = ROOM[n], [x2, y2] = ROOM[id];
      return `<line class="rp-link${m.repairs.includes(n) ? ' on' : ''}" x1="${x1 + RW / 2}" y1="${y1 + RH / 2}" x2="${x2 + RW / 2}" y2="${y2 + RH / 2}"/>`;
    })).join('');
    const rooms = ids.map((id) => {
      const [x, y] = ROOM[id];
      const st = stateOf(m, id);
      return `<g class="rp-room ${st}${this.sel === id ? ' sel' : ''}${this.flash === id ? ' flash' : ''}" data-sys="${id}" tabindex="0" role="button" aria-label="${SYSTEMS[id].name}">
        <rect x="${x}" y="${y}" width="${RW}" height="${RH}"/>
        <text x="${x + RW / 2}" y="${y + 13}" class="wb-call" text-anchor="middle">${SYSTEMS[id].name}</text>
        <text x="${x + RW / 2}" y="${y + 24}" class="wb-sub" text-anchor="middle">${st === 'done' ? '■ 가동' : st === 'ready' ? '▲ 수리' : '□'}</text></g>`;
    }).join('');
    return `<svg viewBox="0 0 400 244" class="wb-svg" aria-label="우주선 도면">
      <defs><pattern id="rpgrid" width="16" height="16" patternUnits="userSpaceOnUse"><path d="M16 0 L0 0 0 16" class="wb-grid"/></pattern></defs>
      <rect width="400" height="244" fill="url(#rpgrid)"/>
      <path class="rp-hull" d="M30 122 L70 52 L300 40 L366 92 L384 122 L366 152 L300 204 L70 192 Z"/>
      <path class="rp-hull thin" d="M70 52 L60 30 L110 46 M70 192 L60 214 L110 198 M300 40 L320 26 M300 204 L320 218"/>
      ${links}${rooms}</svg>`;
  }

  render(): void {
    const m = this.api.meta();
    const sys = SYSTEMS[this.sel];
    const st = stateOf(m, this.sel);
    const cost = (Object.entries(sys.cost) as [Material, number][]).map(([k, n]) => {
      const have = m.materials[k];
      return `<tr class="${have < n && st !== 'done' ? 'down' : ''}"><th>${MATERIAL_NAME[k]}</th><td>${have} / ${n}</td></tr>`;
    }).join('');
    const opens = [...OPENS[this.sel], ...(sys.tool ? [`도구: ${TOOL_NAME[sys.tool]}`] : [])];
    const needs = (sys.needs ?? []).map((n) => `${m.repairs.includes(n) ? '✓' : '·'} ${SYSTEMS[n].name}`);
    const coreNote = this.sel === 'core' && !m.coreSecured ? '<p class="rp-note">15층 수호자의 에너지원 필요</p>' : '';
    const mats = MATERIALS.map((k) => `<span><i>${MATERIAL_NAME[k]}</i> ${m.materials[k]}</span>`).join('');
    this.el.innerHTML = `
      <header class="wb-head"><b>우주선 수리</b><span class="rp-count">${m.repairs.length} / 6</span>
        <button type="button" class="wb-close" data-close aria-label="닫기">✕</button></header>
      <div class="wb-main">
        <div class="wb-draw">${this.hull(m)}</div>
        <aside class="wb-side">
          <div class="wb-slot"><span>${sys.name}</span>${STATE_LABEL[st]}</div>
          <table class="wb-stats">${cost}</table>
          ${needs.length ? `<div class="rp-list"><i>선행</i>${needs.map((n) => `<div>${n}</div>`).join('')}</div>` : ''}
          <div class="rp-list"><i>열리는 것</i>${opens.map((o) => `<div>${o}</div>`).join('')}</div>
          ${coreNote}
          <button type="button" class="btn primary rp-go" data-repair ${st === 'ready' ? '' : 'disabled'}>${st === 'done' ? '수리 완료' : '수리'}</button>
        </aside>
      </div>
      <footer class="wb-mats">${mats}</footer>`;
  }
}
