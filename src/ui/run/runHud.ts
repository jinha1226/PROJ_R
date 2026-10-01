import type { RunState } from '../../sim/run/types';
import { currentNode } from '../../sim/run/state';

/** Top bar shared by run screens: gold, step, seed, and navigation buttons (data-act). */
export function runHud(run: RunState, extra = '', buttons = true): string {
  const step = currentNode(run)?.step ?? 0;
  return `<header class="run-hud">
    <div class="hud-stats"><b class="gold" data-testid="gold">${run.gold} G</b><span>단계 ${step}/12</span><span class="muted">시드 ${run.seed}</span>
      <span>용병 ${run.roster.mercs.length}/8</span></div>
    ${buttons ? `<div class="hud-buttons">${extra}<button class="btn" data-act="roster" data-testid="open-roster">용병단</button>
      <button class="btn" data-act="quit" data-testid="quit">저장 후 나가기</button></div>` : ''}</header>`;
}
