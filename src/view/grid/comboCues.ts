import * as THREE from 'three';
import { CELL } from './gridTerrain';
import type { GEvent } from '../../sim/grid/types';
import type { GridActors } from './gridActors';
import type { GridFx } from './gridFx';
import type { GridParticles } from './gridParticles';
import type { EngravePops } from './engravePops';
import { feel } from './feel';

export interface CueKit { actors: GridActors; fx: GridFx; particles: GridParticles; pops: EngravePops; at(id?: string): THREE.Vector3 | undefined; punch(): void; trail(id: string | undefined, sec: number): void }

const TRAP_COLOR: Record<string, string> = { spike: '#d8d8d8', alarm: '#ffd23a', poison: '#7ad04a', fire: '#ff6a2a', teleport: '#b48aff', net: '#c8b090' };
const TRAP_LABEL: Record<string, string> = { spike: '가시 함정!', alarm: '경보!', poison: '독가스!', fire: '화염 함정!', teleport: '순간이동!', net: '그물!' };
const BUFF_LABEL: Record<string, string> = { haste: '신속!', invis: '투명', confuse: '혼란', fear: '공포', taunt: '도발!', ward: '보호막', stealth: '은신', frenzy: '광분!', promote: '전직!', claim: '영역 확보!', soul: '영혼 깃듦!', print: '클론 출력' };

const REACT: Record<string, { color: string; label: string; size: number }> = {
  ignite: { color: '#ff7a2a', label: '점화!', size: 1.5 },
  shatter: { color: '#bfe8ff', label: '파쇄!', size: 0.9 },
  steam: { color: '#e8eef4', label: '증기', size: 1.4 },
  paralyse: { color: '#ffe85a', label: '마비!', size: 0.8 },
  freeze: { color: '#9fd8ff', label: '빙결!', size: 0.9 },
};

/** Combo moves, engraving triggers, element reactions and shoves; true when the event is fully shown here. */
export function comboCue(k: CueKit, e: GEvent): boolean {
  const a = k.actors;
  switch (e.type) {
    case 'move':
      if (!e.to || (e.text !== 'dash' && e.text !== 'leap' && e.text !== 'roll' && e.text !== 'kite')) return false;
      // shooting and falling back is a back roll
      if (e.text === 'roll' || e.text === 'kite') { a.roll(e.src, e.to.x, e.to.y); k.trail(e.src, 0.25); const p = k.at(e.src); if (p) k.particles.spray(p, '#d8d0c0', 6); }
      else if (e.text === 'dash') { a.dash(e.src, e.to.x, e.to.y); k.trail(e.src, 0.22); const p = k.at(e.src); if (p) k.particles.spray(p, '#d8d0c0', 8); }
      else { a.leap(e.src, e.to.x, e.to.y); k.trail(e.src, 0.3); }
      return true;
    case 'push':
      if (!e.to) return false;
      a.moveTo(e.src, e.to.x, e.to.y);
      a.knock(e.src);
      return true;
    case 'engrave':
      k.pops.engrave(e.text ?? '');
      { const sl = feel().engraveSlow; if (sl) k.fx.slow(sl[0], sl[1]); }
      k.trail(e.src ?? 'hero', 0.5);
      return true;
    case 'chain':
      { const sl = feel().chainSlow; if (sl) k.fx.slow(sl[0], sl[1]); }
      k.trail('hero', 1.1);
      k.pops.hits(e.amount ?? 0, true);
      return true;
    case 'combo': {
      const fin = e.text === 'finisher';
      k.pops.hits(e.amount ?? 0, fin);
      if (fin) { k.fx.shake(0.22, 0.3); k.punch(); const p = k.at(e.dst); if (p) k.fx.transient.burst(p.x, p.z, '#ffd76a', 1.0, 0.35); }
      return true;
    }
    case 'react': {
      const r = REACT[e.text ?? ''];
      if (!r || !e.to) return true;
      const cell = new THREE.Vector3(e.to.x * CELL, 0, e.to.y * CELL);
      k.fx.transient.burst(cell.x, cell.z, r.color, r.size, 0.5);
      k.fx.flash(cell, r.color, 30, 0.35, 8);
      k.particles.spray(cell, r.color, e.text === 'shatter' ? 26 : 18);
      k.fx.number(r.label, 'combo', cell);
      if (e.text === 'ignite' || e.text === 'shatter') { k.fx.shake(0.2, 0.25); k.fx.hitStop(); }
      return true;
    }
    case 'trap': {
      if (!e.to) return true;
      const p = new THREE.Vector3(e.to.x * CELL, 0, e.to.y * CELL);
      const color = TRAP_COLOR[e.text ?? ''] ?? '#ffffff';
      k.fx.transient.burst(p.x, p.z, color, 0.9, 0.45);
      k.fx.flash(p, color, 24, 0.3);
      k.particles.spray(p, color, 16);
      k.fx.number(TRAP_LABEL[e.text ?? ''] ?? '함정!', 'crit', p);
      k.fx.shake(0.14, 0.18);
      return true;
    }
    case 'trapFound': {
      if (!e.to) return true;
      const p = new THREE.Vector3(e.to.x * CELL, 0, e.to.y * CELL);
      k.fx.transient.glow(p.x, p.z, '#ffd76a');
      k.fx.number('함정!', 'combo', p);
      return true;
    }
    case 'teleport': {
      if (!e.to) return true;
      if (e.from) k.particles.spray(new THREE.Vector3(e.from.x * CELL, 0, e.from.y * CELL), '#b48aff', 20);
      a.snap(e.src, e.to.x, e.to.y);
      k.particles.spray(new THREE.Vector3(e.to.x * CELL, 0, e.to.y * CELL), '#b48aff', 20);
      return true;
    }
    case 'search': { const p = k.at(e.src); if (p) k.fx.transient.burst(p.x, p.z, '#b8d0ff', 2.2, 0.6); a.anim(e.src, 'interact'); return true; }
    case 'root': { const p = k.at(e.src); if (p) k.fx.number('그물', 'miss', p); return true; }
    case 'stumble': { const p = k.at(e.src); if (p) k.fx.number('비틀', 'miss', p); return true; }
    case 'suit': { const p = k.at('hero'); if (p) { k.fx.transient.glow(p.x, p.z, '#5ae0ff'); k.fx.flash(p, '#5ae0ff', 26, 0.4); k.fx.number('슈트 회수!', 'combo', p); } return true; }
    case 'drink': a.anim(e.src, 'drink'); return true;
    case 'read': { a.anim(e.src, 'interact'); const p = k.at(e.src); if (p) k.particles.spray(p, '#f3e6b0', 14); return true; }
    case 'buff': { const p = k.at(e.dst); const label = BUFF_LABEL[e.text ?? '']; if (p && label) k.fx.number(label, 'combo', p); return true; }
    default:
      return false;
  }
}
