import * as THREE from 'three';
import { CELL } from './gridTerrain';
import type { GEvent } from '../../sim/grid/types';
import type { GridActors } from './gridActors';
import type { GridFx } from './gridFx';
import type { GridParticles } from './gridParticles';
import type { EngravePops } from './engravePops';
import { feel } from './feel';
import type { VfxKind } from '../fx/vfx';
import { effectCue } from './effectCues';

export interface CueKit { actors: GridActors; fx: GridFx; particles: GridParticles; pops: EngravePops; at(id?: string): THREE.Vector3 | undefined; punch(): void; trail(id: string | undefined, sec: number): void }

const TRAP_COLOR: Record<string, string> = { spike: '#d8d8d8', alarm: '#ffd23a', poison: '#7ad04a', fire: '#ff6a2a', teleport: '#b48aff', net: '#c8b090' };
const TRAP_LABEL: Record<string, string> = { spike: '가시 함정!', alarm: '경보!', poison: '독가스!', fire: '화염 함정!', teleport: '순간이동!', net: '그물!' };
const BUFF_LABEL: Record<string, string> = { haste: '신속!', invis: '투명', confuse: '혼란', fear: '공포', taunt: '도발!', ward: '보호막', stealth: '은신', frenzy: '광분!', promote: '전직!', claim: '영역 확보!', soul: '영혼 깃듦!', print: '클론 출력', beacon: '신호기 작동', beaconOpen: '포탈 열림', beaconCut: '신호기 끊김', beaconClosed: '포탈 닫힘', beaconEnter: '귀환' };

const REACT: Record<string, { color: string; label: string; vfx: VfxKind }> = {
  ignite: { color: '#ff7a2a', label: '점화!', vfx: 'blast' },
  shatter: { color: '#bfe8ff', label: '파쇄!', vfx: 'frost' },
  steam: { color: '#e8eef4', label: '증기', vfx: 'smoke' },
  paralyse: { color: '#ffe85a', label: '마비!', vfx: 'shock' },
  freeze: { color: '#9fd8ff', label: '빙결!', vfx: 'frost' },
};
const TRAP_VFX: Record<string, VfxKind> = { fire: 'blast', poison: 'smoke', teleport: 'magic', alarm: 'shock' };
const BUFF_VFX: Record<string, [VfxKind, string?]> = { ward: ['shield'], promote: ['magic', '#ffd76a'], soul: ['soul'], print: ['magic', '#9fe8ff'], taunt: ['warn'] };

/** Combo moves, engraving triggers, element reactions and shoves; true when the event is fully shown here. */
export function comboCue(k: CueKit, e: GEvent): boolean {
  const a = k.actors;
  switch (e.type) {
    case 'move':
      if (!e.to || (e.text !== 'dash' && e.text !== 'leap' && e.text !== 'roll' && e.text !== 'kite' && e.text !== 'pull')) return false;
      // dragged by a gravity well: a quick slide with a short trail
      if (e.text === 'pull') { a.dash(e.src, e.to.x, e.to.y); k.trail(e.src, 0.18); return true; }
      // shooting and falling back is a back roll
      if (e.text === 'roll' || e.text === 'kite') { a.roll(e.src, e.to.x, e.to.y); k.trail(e.src, 0.25); const p = k.at(e.src); if (p) k.particles.vfx.fire('dust', p); }
      else if (e.text === 'dash') { a.dash(e.src, e.to.x, e.to.y); k.trail(e.src, 0.22); const p = k.at(e.src); if (p) k.particles.vfx.fire('dust', p); }
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
      // the party's reactions carry their Korean name and the foe they happened on
      if (!r && e.text && /[가-힣]/.test(e.text)) { const q = k.at(e.dst); effectCue(k, e); if (q) k.fx.number(e.text, 'crit', q, 2.4); return true; }
      if (!r || !e.to) return true;
      const cell = new THREE.Vector3(e.to.x * CELL, 0, e.to.y * CELL);
      k.particles.vfx.fire(r.vfx, cell, r.vfx === 'smoke' ? r.color : undefined);
      k.fx.flash(cell, r.color, 30, 0.35, 8);
      k.fx.number(r.label, 'combo', cell);
      if (e.text === 'ignite' || e.text === 'shatter') { k.fx.shake(0.2, 0.25); k.fx.hitStop(); }
      return true;
    }
    case 'trap': {
      if (!e.to) return true;
      const p = new THREE.Vector3(e.to.x * CELL, 0, e.to.y * CELL);
      const color = TRAP_COLOR[e.text ?? ''] ?? '#ffffff';
      k.particles.vfx.fire(TRAP_VFX[e.text ?? ''] ?? 'hit', p, color);
      k.fx.flash(p, color, 24, 0.3);
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
      if (e.from) k.particles.vfx.fire('magic', new THREE.Vector3(e.from.x * CELL, 0, e.from.y * CELL));
      a.snap(e.src, e.to.x, e.to.y);
      k.particles.vfx.fire('magic', new THREE.Vector3(e.to.x * CELL, 0, e.to.y * CELL));
      return true;
    }
    case 'search': { const p = k.at(e.src); if (p) k.fx.transient.burst(p.x, p.z, '#b8d0ff', 2.2, 0.6); a.anim(e.src, 'interact'); return true; }
    case 'root': { const p = k.at(e.src); if (p) k.fx.number('그물', 'miss', p); return true; }
    case 'stumble': { const p = k.at(e.src); if (p) k.fx.number('비틀', 'miss', p); return true; }
    case 'suit': { const p = k.at('hero'); if (p) { k.fx.transient.glow(p.x, p.z, '#5ae0ff'); k.fx.flash(p, '#5ae0ff', 26, 0.4); k.fx.number('슈트 회수!', 'combo', p); } return true; }
    case 'drink': a.anim(e.src, 'drink'); return true;
    case 'read': { a.anim(e.src, 'interact'); const p = k.at(e.src); if (p) k.particles.spray(p, '#f3e6b0', 14); return true; }
    case 'buff': {
      // three or more effects in one action: a chain, counted over the clone that set it off
      // the base's dome gives: the ground jumps and the sky flashes (the ring of light is the dome's own: domeView)
      if (e.text === 'domeBreak') { k.fx.shake(0.5, 0.6); if (e.to) k.fx.flash(new THREE.Vector3(e.to.x * CELL, 0, e.to.y * CELL), '#bff2ff', 60, 0.6, 18); return true; }
      if (e.text === 'domeUp') return true;
      // a fallen clone rises by the pod: it stands again where it is put
      if (e.text === 'revive') { if (e.dst && e.to) { a.revive(e.dst); k.particles.vfx.fire('magic', new THREE.Vector3(e.to.x * CELL, 0, e.to.y * CELL)); } return true; }
      if (e.text === 'chain') { const q = k.at(e.src); if (q) { k.fx.number(`연쇄 ×${e.amount ?? 3}`, 'crit', q, 2.8); if ((e.amount ?? 0) >= 6) k.fx.shake(0.12, 0.16); } return true; }
      // a trigger, an ultimate or a promotion carries its own Korean name: its effect lands where it lands, its name over whoever set it off
      const named = !BUFF_LABEL[e.text ?? ''] && !!e.text && /[가-힣]/.test(e.text);
      const fired = !BUFF_VFX[e.text ?? ''] && effectCue(k, e);
      const p = named ? k.at(e.src) ?? k.at(e.dst) : k.at(e.dst) ?? k.at(e.src);
      // card and trigger names go to the log, not the field: the field shows what they do (the effect), the chain count and reactions
      const label = BUFF_LABEL[e.text ?? ''], fx = fired ? undefined : BUFF_VFX[e.text ?? ''];
      if (p && label) k.fx.number(label, 'combo', p); if (p && fx) k.particles.vfx.fire(fx[0], p, fx[1]); if (p && e.text === 'soul') k.fx.flash(p, '#ffd76a', 30, 1.0, 6); return true; }
    default:
      return false;
  }
}
