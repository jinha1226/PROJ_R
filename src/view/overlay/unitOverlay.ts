import * as THREE from 'three';
import type { TagId } from '../../data/types';
import type { UnitSnap, UnitSetup } from '../../sim/battle/types';
import './overlay.css';

/** One-letter Korean badges with tag colors — renders without emoji fonts. */
const TAG_BADGE: Record<TagId, { label: string; color: string }> = {
  marked: { label: '표', color: '#e0a040' }, knockdown: { label: '넘', color: '#b0a090' },
  wet: { label: '젖', color: '#4aa3ff' }, stun: { label: '기', color: '#ffe040' },
  burn: { label: '화', color: '#ff6a2a' }, bleed: { label: '출', color: '#d03040' },
  slow: { label: '둔', color: '#8a7ad0' }, shield: { label: '막', color: '#bfe6ff' },
  taunted: { label: '도', color: '#ff5050' },
};

interface Row {
  el: HTMLDivElement;
  hp: HTMLDivElement;
  shield: HTMLDivElement;
  mom: HTMLDivElement;
  tags: HTMLDivElement;
  tagKey: string;
  height: number;
}

/** DOM name tags, HP/momentum bars, and tag icons that follow units on screen. */
export class UnitOverlay {
  readonly el = document.createElement('div');
  private readonly rows = new Map<string, Row>();
  private readonly v = new THREE.Vector3();

  constructor(parent: HTMLElement, private readonly camera: THREE.Camera, private readonly nameOf: (u: UnitSetup) => string) {
    this.el.className = 'unit-overlay';
    parent.appendChild(this.el);
  }

  add(u: UnitSetup): void {
    const el = document.createElement('div');
    el.className = `uo ${u.team}${u.boss ? ' boss' : ''}`;
    el.innerHTML = `<div class="uo-tags"></div><div class="uo-name"></div><div class="uo-bar"><div class="uo-hp"></div><div class="uo-shield"></div></div><div class="uo-mom"><div></div></div>`;
    const name = el.querySelector<HTMLDivElement>('.uo-name')!;
    name.textContent = this.nameOf(u);
    name.style.color = u.team === 'ally' ? u.color : '#ffb4a8';
    this.el.appendChild(el);
    this.rows.set(u.id, {
      el, hp: el.querySelector('.uo-hp')!, shield: el.querySelector('.uo-shield')!, mom: el.querySelector('.uo-mom')!,
      tags: el.querySelector('.uo-tags')!, tagKey: '', height: 2.0 * (u.scale ?? 1),
    });
  }

  update(u: UnitSnap, x: number, z: number, w: number, h: number): void {
    const r = this.rows.get(u.id);
    if (!r) return;
    this.v.set(x, r.height, z).project(this.camera);
    r.el.style.left = `${((this.v.x + 1) / 2) * w}px`;
    r.el.style.top = `${((1 - this.v.y) / 2) * h}px`;
    r.el.classList.toggle('dead', !u.alive);
    r.el.classList.toggle('downed', u.downed);
    const hpFrac = u.downed ? u.lifeline / (u.maxHp * 0.5) : u.hp / u.maxHp;
    r.hp.style.width = `${Math.max(0, hpFrac) * 100}%`;
    r.hp.style.background = u.downed ? '#9a3a3a' : '';
    r.shield.style.width = `${Math.min(1, u.shield / u.maxHp) * 100}%`;
    (r.mom.firstElementChild as HTMLDivElement).style.width = `${u.momentum}%`;
    r.mom.classList.toggle('full', u.momentum >= 100);
    const key = u.tags.join(',');
    if (key !== r.tagKey) {
      r.tagKey = key;
      r.tags.innerHTML = [...new Set(u.tags)]
        .map((t) => TAG_BADGE[t as TagId])
        .filter((b) => b)
        .map((b) => `<span class="uo-tag" style="background:${b!.color}">${b!.label}</span>`)
        .join('');
    }
  }

  screenPos(x: number, y: number, z: number, w: number, h: number): { left: number; top: number } {
    this.v.set(x, y, z).project(this.camera);
    return { left: ((this.v.x + 1) / 2) * w, top: ((1 - this.v.y) / 2) * h };
  }

  dispose(): void {
    this.el.remove();
    this.rows.clear();
  }
}
