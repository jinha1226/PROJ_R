import type { Roster } from '../../sim/roster/types';
import { ruleLines, type Party } from '../hud/relationText';
import { t } from '../i18n/ko';
import { graphModel } from './graphModel';

const SIZE = 340;

/** SVG relationship graph; clicking an edge shows its rule sentences. */
export function renderRelationGraph(host: HTMLElement, r: Roster): void {
  const g = graphModel(r, SIZE);
  const pos = new Map(g.nodes.map((n) => [n.id, n]));
  const lines = g.edges.map((e, i) => {
    const a = pos.get(e.a)!;
    const b = pos.get(e.b)!;
    return `<line x1="${a.x}" y1="${a.y}" x2="${b.x}" y2="${b.y}" stroke="${e.color}" stroke-width="${e.kinds.includes('comrade') ? 5 : 3}" data-edge="${i}" class="edge"/>`;
  }).join('');
  const nodes = g.nodes.map((n) => `<g><circle cx="${n.x}" cy="${n.y}" r="16" fill="${n.color}" stroke="#0008" stroke-width="2"/>
    <text x="${n.x}" y="${n.y + 32}" text-anchor="middle">${n.name}</text></g>`).join('');
  const legend = (['friend', 'comrade', 'rival', 'feud', 'mentor'] as const).map((k) => `<span class="lg lg-${k}">${t(`relation.${k}`)}</span>`).join('');
  host.innerHTML = `<div class="graph"><svg viewBox="0 0 ${SIZE} ${SIZE}" width="${SIZE}" height="${SIZE}" data-testid="relation-graph">${lines}${nodes}</svg>
    <div class="graph-side"><div class="legend">${legend}</div><div class="graph-info muted">${g.edges.length ? '선을 누르면 관계 규칙을 볼 수 있다.' : '아직 이름 붙은 관계가 없다.'}</div></div></div>`;
  const party = (id: string): Party => { const m = r.mercs.find((x) => x.id === id)!; return { id, name: m.name, level: m.level, classId: m.classId }; };
  host.querySelectorAll<SVGLineElement>('line.edge').forEach((line) => line.addEventListener('click', () => {
    const e = g.edges[Number(line.dataset.edge)]!;
    const rel = r.relations.find((x) => x.a === e.a && x.b === e.b)!;
    const text = ruleLines(rel, party(e.a), party(e.b)).map((d) => d.text).join('<br>');
    host.querySelector('.graph-info')!.innerHTML = `친밀도 ${e.affinity}<br>${text}`;
  }));
}
