import * as THREE from 'three';
import type { Cell } from '../../sim/grid/types';
import type { GridRuntime } from '../../view/grid/gridRuntime';

/** A thing in the world that can be used now (the shaft, the lift, the stairs): its cell, its label, what pressing it does. */
export interface Prompt { at: Cell; label: string; act: () => void }

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
    const key = prompts.map((p) => p.label).join('|');
    if (key !== this.key) {
      this.key = key;
      this.el.innerHTML = prompts.map((p, i) => `<button type="button" data-i="${i}">${p.label}</button>`).join('');
    }
    if (!rt) return;
    prompts.forEach((p, i) => {
      const b = this.el.children[i] as HTMLElement | undefined, s = rt.project(new THREE.Vector3(p.at.x, 1.9, p.at.y));
      if (b) { b.style.left = `${s.left}px`; b.style.top = `${s.top}px`; }
    });
  }
}
