import * as THREE from 'three';
import type { EmotionId, TagId } from '../../data/types';
import type { UnitSnap, UnitSetup } from '../../sim/battle/types';
import { iconBadge, type IconKey } from './icons';
import { intentLabel } from './intentLabel';
import './overlay.css';

interface Row {
  el: HTMLDivElement;
  hp: HTMLDivElement;
  shield: HTMLDivElement;
  mom: HTMLDivElement;
  tags: HTMLDivElement;
  intent: HTMLDivElement;
  tagKey: string;
  intentKey: string;
  height: number;
}

/** DOM name tags, HP/momentum bars, and tag icons that follow units on screen. */
export class UnitOverlay {
  readonly el = document.createElement('div');
  private readonly rows = new Map<string, Row>();
  private readonly v = new THREE.Vector3();

  constructor(
    parent: HTMLElement,
    private readonly camera: THREE.Camera,
    private readonly nameOf: (u: UnitSetup) => string,
    private readonly targetName: (id: string) => string,
  ) {
    this.el.className = 'unit-overlay';
    parent.appendChild(this.el);
  }

  add(u: UnitSetup): void {
    const el = document.createElement('div');
    el.className = `uo ${u.team}${u.boss ? ' boss' : ''}${u.rank === 'hero' ? ' hero' : ''}`;
    el.innerHTML = `<div class="uo-intent"></div><div class="uo-tags"></div><div class="uo-name"></div><div class="uo-bar"><div class="uo-hp"></div><div class="uo-shield"></div></div><div class="uo-mom"><div></div></div>`;
    const name = el.querySelector<HTMLDivElement>('.uo-name')!;
    name.textContent = this.nameOf(u);
    if (u.injured) name.insertAdjacentHTML('afterbegin', iconBadge('status:injured', 13, 'injured'));
    name.style.color = u.team === 'ally' ? u.color : '#ffb4a8';
    this.el.appendChild(el);
    this.rows.set(u.id, {
      el, hp: el.querySelector('.uo-hp')!, shield: el.querySelector('.uo-shield')!, mom: el.querySelector('.uo-mom')!,
      tags: el.querySelector('.uo-tags')!, intent: el.querySelector('.uo-intent')!, tagKey: '', intentKey: '',
      height: 2.0 * (u.scale ?? 1),
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
    const label = u.alive && !u.downed ? intentLabel(u.intent, this.targetName) : null;
    const ikey = label ? `${label.icon}|${label.text}` : '';
    if (ikey !== r.intentKey) {
      r.intentKey = ikey;
      r.intent.innerHTML = label ? `${iconBadge(label.icon, 15)}<span>${label.text}</span>` : '';
    }
    const key = `${u.emotions.join(',')}|${u.tags.join(',')}`;
    if (key !== r.tagKey) {
      r.tagKey = key;
      const emotions = [...new Set(u.emotions)].map((em) => iconBadge(`emotion:${em as EmotionId}`, 17, 'emotion'));
      const tags = [...new Set(u.tags)].map((tg) => iconBadge(tg as TagId, 16));
      r.tags.innerHTML = [...emotions, ...tags].join('');
    }
  }

  /** Large icon that pops above the unit for ~2s. */
  pop(id: string, icon: IconKey): void {
    const r = this.rows.get(id);
    if (!r) return;
    const el = document.createElement('div');
    el.className = 'uo-pop';
    el.innerHTML = iconBadge(icon, 26);
    r.el.appendChild(el);
    setTimeout(() => el.remove(), 2000);
  }

  setIntentsVisible(on: boolean): void {
    this.el.classList.toggle('hide-intents', !on);
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
