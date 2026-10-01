import type { Screen } from '../../app/router';
import { reachable } from '../../sim/run/state';
import type { RunState } from '../../sim/run/types';
import { iconBadge } from '../../view/overlay/icons';
import { runHud } from './runHud';

const COL_W = 92;
const ROW_H = 96;
const PAD = 50;

export interface MapApi {
  run(): RunState;
  enter(nodeId: string): void;
  roster(): void;
  quit(): void;
}

/** 12 × 3 node map; reachable nodes are clickable. */
export class MapScreen implements Screen {
  private el = document.createElement('div');

  constructor(private readonly api: MapApi) {}

  mount(root: HTMLElement): void {
    const run = this.api.run();
    const nodes = Object.values(run.map.nodes);
    const open = new Set(reachable(run).map((n) => n.id));
    const xy = (step: number, lane: number) => ({ x: PAD + (step - 1) * COL_W, y: PAD + lane * ROW_H });
    const w = PAD * 2 + (run.map.steps - 1) * COL_W;
    const h = PAD * 2 + 2 * ROW_H;
    const lines = nodes.flatMap((n) => n.next.map((id) => {
      const a = xy(n.step, n.lane);
      const to = run.map.nodes[id]!;
      const b = xy(to.step, to.lane);
      const walked = run.visited.includes(n.id) && run.visited.includes(id);
      return `<line x1="${a.x}" y1="${a.y}" x2="${b.x}" y2="${b.y}" class="${walked ? 'walked' : ''}"/>`;
    })).join('');
    const buttons = nodes.map((n) => {
      const p = xy(n.step, n.lane);
      const state = n.id === run.at ? 'here' : run.visited.includes(n.id) ? 'done' : open.has(n.id) ? 'open' : 'locked';
      return `<button class="map-node ${state} t-${n.type}" style="left:${p.x}px;top:${p.y}px" data-node="${n.id}" data-testid="node-${n.id}"
        ${state === 'open' ? '' : 'disabled'} title="${n.type}">${iconBadge(`node:${n.type}`, n.type === 'boss' ? 44 : 34)}</button>`;
    }).join('');
    this.el.className = 'screen run-map';
    this.el.innerHTML = `${runHud(run)}<div class="map-scroll"><div class="map" style="width:${w}px;height:${h}px">
      <svg width="${w}" height="${h}">${lines}</svg>${buttons}</div></div>
      <p class="map-hint muted">빛나는 노드를 눌러 다음 목적지를 고르세요. 지역: 잿빛 변경</p>`;
    this.el.addEventListener('click', (e) => {
      const t = e.target as HTMLElement;
      const node = t.closest<HTMLButtonElement>('.map-node.open');
      const act = t.closest<HTMLElement>('[data-act]')?.dataset.act;
      if (node?.dataset.node) this.api.enter(node.dataset.node);
      else if (act === 'roster') this.api.roster();
      else if (act === 'quit') this.api.quit();
    });
    root.appendChild(this.el);
  }

  unmount(): void {
    this.el.remove();
  }
}
