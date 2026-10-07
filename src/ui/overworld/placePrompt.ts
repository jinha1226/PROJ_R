import * as THREE from 'three';
import type { Cell, GEvent } from '../../sim/grid/types';
import { entOf } from '../../sim/party/partyCore';
import { BODY_COST, canTakeSoul, clones, implantCarried, living, MAX_CLONES, type RoamParty } from '../../sim/roam/roam';
import { canPrintClone, CLONER_REACH, printClone } from '../../sim/base/cloner';
import type { WorldParty } from '../../sim/overworld/worldSim';
import { dist } from '../../sim/grid/types';
import type { GridRuntime } from '../../view/grid/gridRuntime';

/** A thing in the world that can be used now (the shaft, the lift, the stairs): its cell, its label, what pressing it does. */
export interface Prompt { at: Cell; label: string; act: () => void; off?: boolean }

/** Buttons that stand over the places themselves in the field (shown only while usable), instead of in the top bar. */
export class PlacePrompts {
  readonly el = document.createElement('div');
  private prompts: Prompt[] = [];
  private key = '';

  constructor() {
    this.el.className = 'place-prompts';
    this.el.addEventListener('click', (e) => {
      const i = (e.target as HTMLElement).closest<HTMLElement>('[data-i]')?.dataset.i;
      if (i !== undefined) this.prompts[Number(i)]?.act();
    });
  }

  /** Shows these prompts over their cells (an empty list hides them all). */
  update(rt: GridRuntime | null, prompts: Prompt[]): void {
    this.prompts = prompts;
    const key = prompts.map((p) => `${p.label}${p.off ? '-' : ''}`).join('|');
    if (key !== this.key) {
      this.key = key;
      this.el.innerHTML = prompts.map((p, i) => `<button type="button" data-i="${i}"${p.off ? ' class="off" disabled' : ''}>${p.label}</button>`).join('');
    }
    if (!rt) return;
    prompts.forEach((p, i) => {
      // prompts over the same place stack upward
      const under = prompts.slice(0, i).filter((q) => q.at.x === p.at.x && q.at.y === p.at.y).length;
      const b = this.el.children[i] as HTMLElement | undefined, s = rt.project(new THREE.Vector3(p.at.x, 1.9, p.at.y));
      if (b) { b.style.left = `${s.left}px`; b.style.top = `${s.top - under * 38}px`; }
    });
  }
}

/** '영혼 주입' over a fresh body (level 1, never down, a slot free) while souls are stored: one soul goes straight in, more open the bag to choose. */
export function soulPrompt(p: RoamParty, live: (ev: GEvent[]) => void, choose: (id: string) => void): Prompt[] {
  const u = clones(p).find((v) => entOf(p, v.id)?.alive && canTakeSoul(p, v));
  if (!u || !p.carried.length || p.combat) return [];
  const at = entOf(p, u.id)!.pos;
  return [{ at, label: '영혼 주입', act: () => (p.carried.length === 1 ? live(implantCarried(p, u.id, 0)) : choose(u.id)) }];
}

/** '클론 생성' over the lab's printer while a clone stands by it: greyed with the bio-matter short or the party full. */
export function clonerPrompt(p: WorldParty, live: (ev: GEvent[]) => void): Prompt[] {
  const at = p.cloner;
  if (!at || p.away || p.raid || p.combat || !living(p).some((u) => dist(entOf(p, u.id)!.pos, at) <= CLONER_REACH)) return [];
  const full = living(p).length >= MAX_CLONES;
  const label = full ? `클론 ${living(p).length}/${MAX_CLONES}` : `클론 생성 · 생체 ${p.bio}/${BODY_COST}`;
  return [{ at, label, off: !canPrintClone(p), act: () => live(printClone(p)) }];
}
