import { dist, idx, type Cell } from '../../sim/grid/types';
import { entOf, unitOf } from '../../sim/party/partyCore';
import type { DelveParty } from '../../sim/delve/delveSim';
import { nearestWant, type AutoExplore } from './explore';

/**
 * A floor run by itself (2026-10-09, to see how it watches): the chosen clone explores, fights under no hand (the party
 * AI's targets, potions and ultimates), takes the first card offered at each level, picks up what explore goes for, and
 * when nothing is left to uncover walks to the stairs and stops there. A tap on the field hands the clone back.
 */
export class AutoRun {
  on = false;
  /** explore has said there is nothing left to uncover */
  private swept = false;

  toggle(): boolean { this.on = !this.on; this.swept = false; return this.on; }
  stop(): void { this.on = false; }
  /** (explore's own word that the floor is uncovered) */
  sweptOut(): void { if (this.on) this.swept = true; }

  /** One look a frame. `go`: walk there; `pick`: take a card; `say`: a line when the run ends. */
  step(p: DelveParty, sel: string, explorer: AutoExplore, act: { go(c: Cell): void; pick(id: string, trait: string): void; say(text: string): void }): void {
    if (!this.on) return;
    const u = unitOf(p, sel), e = entOf(p, sel);
    if (!u || !e?.alive) { this.on = false; return; }
    if (u.picks && u.offer?.length) { act.pick(sel, u.offer[0]!); return; }
    if (p.combat || explorer.on || u.order?.kind === 'move') return;
    if (!this.swept) { explorer.start(); return; }
    const stairs = p.s.map.stairs, known = stairs && p.s.seen[idx(p.s.map, stairs)];
    if (!stairs || !known) { this.on = false; act.say('탐험 끝'); return; }
    if (dist(e.pos, stairs) <= 1) { this.on = false; act.say('탐험 끝 · 계단 앞'); return; }
    const spot = nearestWant(p.s, e.pos, [stairs]);
    if (spot) act.go(spot.at); else { this.on = false; act.say('탐험 끝'); }
  }
}
