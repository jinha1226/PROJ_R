import type * as THREE from 'three';
import type { GEvent } from '../../sim/grid/types';
import type { VfxKind } from '../fx/vfx';
import type { CueKit } from './comboCues';
import { CELL, toWorld } from './gridTerrain';
import { WHIRL_REACH } from '../../sim/party/classKit';

/** How one effect looks: a particle burst (tinted), where it lands (on the target, on the one who set it off, or a streak from one to the other), a ground flash and a shake. */
interface Look { vfx?: VfxKind; color?: string; at: 'dst' | 'src' | 'line'; burst?: number; shake?: number }
const L = (vfx: VfxKind | undefined, color: string | undefined, at: Look['at'], burst?: number, shake?: number): Look => ({ vfx, color, at, burst, shake });

/** the states a blow or an effect leaves, on the foe that took them */
const STATUS: Record<string, Look> = {
  burn: L('blast', '#ff7a2a', 'dst'), chill: L('frost', undefined, 'dst'), freeze: L('frost', '#e8f6ff', 'dst', 0.9),
  shock: L('shock', undefined, 'dst'), poison: L('smoke', '#7ad04a', 'dst'), bleed: L('hit', '#ff3a4a', 'dst'),
  mark: L('warn', '#ffd23a', 'dst'), exposed: L('hit', '#ffb0a0', 'dst'), stun: L('shock', '#fff0a0', 'dst'),
};

/** the party's element reactions, where they happen */
const REACTION: Record<string, Look> = {
  증기: L('smoke', '#e8eef4', 'dst', 1.3), 과부하: L('blast', '#ffb04a', 'dst', 1.7, 0.14), 초전도: L('shock', '#8fd0ff', 'dst', 1.1),
  '독연 폭발': L('smoke', '#7ad04a', 'dst', 1.7), 파쇄: L('frost', '#e8f6ff', 'dst', 1.2, 0.12), 혈전: L('hit', '#ff3a4a', 'dst', 0.9),
};

/** card, duo and memory effects by their Korean name (resonance laws are matched by their ending) */
const CARD: Record<string, Look> = {
  '연소 폭발': L('blast', '#ff7a2a', 'dst', 1.7, 0.12), '번개 사슬': L('shock', '#ffe85a', 'dst', 1.4), '연쇄 반응': L('magic', '#b48aff', 'dst', 1.0),
  '원소 과부하': L('blast', '#c88aff', 'src', 2.6, 0.16), '서리 감옥': L('frost', '#bfe8ff', 'dst', 1.0), '마력 역류': L('shield', '#8ff0ff', 'src'),
  '관통 화살': L(undefined, undefined, 'line'), '뼈 창': L(undefined, undefined, 'line'), '뼈 감옥': L('dust', '#e8e0c8', 'src', 1.6), '뼈 파편': L('hit', '#e8e0c8', 'src', 1.0), '해골 일으키기': L('smoke', '#22c8a0', 'dst', 0.8), '망자의 손아귀': L('smoke', '#3a6a5a', 'dst'), '독 신성': L('smoke', '#7ad04a', 'dst', 1.6), 저주: L('magic', '#6a4a8a', 'dst'), '골렘 붕괴': L('blast', '#e8e0c8', 'dst', 2.6, 0.18), 운석: L('magic', '#ff9a3a', 'src', 0.9), 화염구: L('blast', '#ff9a3a', 'dst', 1.2), '화염 전이': L('blast', '#ff7a2a', 'dst', 0.8), 블리자드: L('frost', '#cfeaff', 'src', 2.2, 0.06), '서리 고리': L('frost', '#bfe8ff', 'src', 1.6, 0.08), '얼음 파편': L('frost', '#e8f6ff', 'dst', 1.0), '연쇄 번개': L('shock', '#ffe85a', 'dst', 1.2), 정전기장: L('shock', '#bfe0ff', 'src', 1.6), 과전류: L('shock', '#ffe85a', 'dst', 0.8), '시체 폭발': L('blast', '#e8e0c8', 'dst', 1.2, 0.08), '망자의 부름': L('smoke', '#22c8a0', 'dst'), 관통탄: L(undefined, undefined, 'line'), '반격 사격': L(undefined, undefined, 'line'), '전술 재장전': L(undefined, undefined, 'line'),
  과열탄: L('blast', '#ff7a2a', 'dst', 1.0), 유탄: L('blast', '#ff9a3a', 'dst', 1.4, 0.1), '연쇄 폭발': L('blast', '#ff7a2a', 'dst', 1.2, 0.08), '즉시 재장전': L('magic', '#9fe8ff', 'src'), '개머리판 밀치기': L('hit', '#d8d8d8', 'dst', 0.8, 0.08), '슈트 과부하': L('shield', '#9fe8ff', 'src', 1.4),
  '조준 사격': L('crit', '#ffd04a', 'dst'), '표적 분석': L('warn', '#ffd04a', 'src'), '산탄 확산': L('hit', '#ffb04a', 'dst'), '사냥 표식': L('warn', '#ffd23a', 'dst'), '표식 이동': L('warn', '#ffd23a', 'dst'),
  '가시 갑옷': L('hit', '#d8d8d8', 'dst'),
  '분노 폭발': L('blast', '#ff3a2a', 'dst', 1.0, 0.1), '철벽 반격': L('crit', '#d8e8ff', 'dst'),
  '급소 찌르기': L('crit', '#ffd04a', 'dst'), '독 폭발': L('smoke', '#7ad04a', 'dst', 1.7, 0.1),
  '그림자 걸음': L('smoke', '#3a2a4a', 'src'),
  '다중 사격': L('hit', '#ffd23a', 'dst', 0.8), 난사: L('warn', '#ffd23a', 'src', 1.4), '폭발 화살': L('blast', '#ff7a2a', 'dst', 1.2, 0.08), '빙결 화살': L('frost', '#cfeaff', 'dst', 1.2), '파쇄 화살': L('frost', '#e8f6ff', 'dst', 1.4, 0.1), '유도 화살': L(undefined, undefined, 'line'), '약점 노출': L('hit', '#ffb0a0', 'dst'),
  '축복의 망치': L('magic', '#ffe8a0', 'dst', 0.5), '망치 폭발': L('blast', '#ffe8a0', 'dst', 1.2, 0.08), '정화의 오라': L('magic', '#fff0c0', 'src', 1.6), '오라 고조': L('magic', '#ffe8a0', 'dst', 1.0), '방패 강타': L('shield', '#8ff0ff', 'dst'),
  칼바람: L('dust', '#ff3a4a', 'src', 1.2), '피의 소용돌이': L('hit', '#ff3a4a', 'dst', 1.8, 0.12), '상처 찢기': L('hit', '#ff2a3a', 'dst', 1.3, 0.1), '연속 도륙': L('crit', '#ff6a3a', 'dst'),
  '2연타': L('hit', '#ffb04a', 'dst'), '전투 함성': L('warn', '#ffd23a', 'src', 2.0, 0.1), 함성: L('shock', '#fff0a0', 'src', 1.4), '그림자 독': L('smoke', '#5a8a3a', 'dst'),
  '번개 함정': L('shock', '#ffe85a', 'dst', 1.2), '화염 함정': L('blast', '#ff7a2a', 'dst', 1.4, 0.1), '함정 설치': L('warn', '#ffd23a', 'dst', 0.5),
  충격파: L('dust', '#e8e0c8', 'src', 1.0), '마무리 폭발': L('blast', '#ffd04a', 'dst', 1.6, 0.12), '용의 발톱': L('crit', '#ff9a3a', 'dst'),
  '심판 낙인': L('blast', '#ffd76a', 'dst', 1.3), '넘친 은총': L('shield', '#ffd76a', 'dst'), '생명 전이': L('magic', '#ffd76a', 'dst'),
  마무리: L('crit', '#ffd76a', 'src'), 연타: L('hit', undefined, 'dst'), '반사 신경': L('magic', '#9fe8ff', 'src'), 선제: L('magic', '#ffd76a', 'src'),
  불굴: L('shield', '#ffffff', 'src', 1.4), 사기: L('heal', undefined, 'src', 2.0), 도약: L('dust', undefined, 'dst'), '피의 갈증': L('heal', '#ff3a4a', 'src'),
  '미끼와 사냥꾼': L('warn', '#ffd23a', 'dst'), 산산조각: L('frost', '#e8f6ff', 'dst', 1.3, 0.12), 틈새: L('crit', '#c8a8ff', 'dst'), '원소 화살': L('magic', '#ffd23a', 'dst', 1.0),
  '빛의 화살': L('heal', '#ffd76a', 'dst'), 사냥감: L('crit', '#ff2a2a', 'dst'), '정화의 불꽃': L('blast', '#ff9a3a', 'dst', 1.2), '피의 성찬': L('heal', '#ff3a4a', 'src'),
  '불탄 자': L('blast', '#ff7a2a', 'dst', 1.0), '서리 무덤': L('frost', undefined, 'dst'), '번개 맞은 자': L('shock', undefined, 'dst'), 백정: L('hit', '#ff3a4a', 'dst'),
  수호자: L('shield', '#8ff0ff', 'src'), 독살자: L('smoke', '#7ad04a', 'dst'), 사냥꾼: L('warn', '#ffd23a', 'dst'), 배신자: L('smoke', '#3a2a4a', 'src'),
};
/** the colour of each tag's resonance flare */
const TAG_COLOR: Record<string, string> = { 화염: '#ff7a2a', 냉기: '#9fd8ff', 전기: '#ffe85a', 독: '#7ad04a', 출혈: '#ff3a4a', 근접: '#ffb04a', 원거리: '#9fe85a', 방패: '#d8e8ff', 은신: '#8a7aa8', 치유: '#5dff8a', 협공: '#ffd76a', 소환: '#b48aff', 생존: '#ffffff', 치명: '#ffd04a', 뼈: '#e8e0c8', 함정: '#c8b090', 함성: '#ff8a4a', 오라: '#ffe08a', 신성: '#fff2b0' };

/** where fire last leapt from a body: for a moment, flame runs from there to each foe it sets alight */
let spread: { at: THREE.Vector3; until: number } | undefined;
const SPREAD_MS = 700, SPREAD_REACH = 2.9;

function lookOf(e: GEvent): Look | undefined {
  const text = e.text ?? '';
  if (e.type === 'react') return REACTION[text];
  if (STATUS[text]) return STATUS[text];
  if (CARD[text]) return CARD[text];
  const tag = text.match(/^(\S+) 공명/)?.[1];
  if (tag) return L('magic', TAG_COLOR[tag], 'src', text.endsWith('2단') ? 1.2 : 0.8);
  // any other Korean effect name (gear, ultimates already have their own shows): a small sparkle on the one who set it off
  return /[가-힣]/.test(text) && e.type === 'buff' ? L('magic', undefined, 'src') : undefined;
}

/** Plays an effect's own look (particles, ground flash, a streak or a shake); false when the event has none. */
export function effectCue(k: CueKit, e: GEvent): boolean {
  // the whirlwind: the warrior spins and a blade sweeps round it out to four cells
  if (e.type === 'buff' && e.text === '회오리 베기') {
    const at = k.at(e.src);
    if (!at) return false;
    k.actors.spin(e.src); k.fx.sweep.play(at, WHIRL_REACH * CELL); k.particles.vfx.fire('dust', at); k.fx.shake(0.14, 0.2);
    return true;
  }
  // the gravity well collapsing: a dark implosion on the cell, then a burst and a shake
  if (e.type === 'buff' && e.text === '중력 붕괴' && e.to) {
    const at = toWorld(e.to.x, e.to.y);
    k.particles.vfx.fire('magic', at, '#7a4aff'); k.fx.transient.burst(at.x, at.z, '#b48aff', 1.2, 0.35); k.fx.flash(at, '#b48aff', 40, 0.3, 8); k.fx.shake(0.16, 0.22);
    return true;
  }
  // a meteor: a burning rock out of the sky, and the blast where it lands (its hits wait for the fall: playback.ts)
  if (e.type === 'buff' && e.text === '운석 낙하') {
    const at = e.to ? toWorld(e.to.x, e.to.y) : k.at(e.dst);
    if (!at) return false;
    k.fx.drop(at, () => {
      k.particles.vfx.fire('blast', at, '#ff7a2a'); k.fx.transient.burst(at.x, at.z, '#ff7a2a', 1.1, 0.35);
      // the ground takes it: the whole screen jolts
      k.fx.flash(at, '#ff8a2a', 46, 0.35, 9); k.fx.shake(0.32, 0.42);
    });
    return true;
  }
  // a blizzard: ice out of the sky all over the ground it covers, shard after shard for a moment (its hits wait for the first: playback.ts)
  if (e.type === 'buff' && e.text === 'blizzard' && e.to) {
    const c = toWorld(e.to.x, e.to.y), reach = (e.amount ?? 2) * CELL, n = Math.round(8 + reach * 3);
    for (let i = 0; i < n; i++) {
      // spread over the disc without clumps (the golden angle), the middle first
      const a = i * 2.39996, r = reach * Math.sqrt((i + 0.5) / n), at = c.clone().set(c.x + Math.cos(a) * r, 0, c.z + Math.sin(a) * r);
      k.fx.drop(at, () => { k.particles.vfx.fire('frost', at, '#e8f6ff'); if (i % 3 === 0) k.fx.transient.burst(at.x, at.z, '#bfe8ff', 0.45, 0.25); }, '#8fd0ff', 0.08 + (i / n) * 0.34, '#e8f6ff', 0.16);
    }
    k.fx.flash(c, '#9fd8ff', 20, 0.4, reach * 2); k.fx.shake(0.2, 0.14);
    return true;
  }
  // fire leaping from a body: a ring where it fell, then (below) a streak of flame to every foe it sets alight
  if (e.type === 'buff' && e.text === '화염 전이') {
    const at = k.at(e.dst);
    if (!at) return false;
    spread = { at: at.clone(), until: performance.now() + SPREAD_MS };
    k.particles.vfx.fire('blast', at, '#ffb04a'); k.fx.transient.burst(at.x, at.z, '#ff9a3a', 0.9, 0.4); k.fx.flash(at, '#ff8a2a', 30, 0.3, 7);
    return true;
  }
  if (e.type === 'buff' && e.text === 'burn' && spread && performance.now() < spread.until) {
    const to = k.at(e.dst), d = to ? to.distanceTo(spread.at) : 0;
    if (to && d > 0.1 && d <= SPREAD_REACH * CELL) k.fx.bolt(spread.at, to, () => undefined, 1.4);
  }
  const look = lookOf(e);
  if (!look) return false;
  const src = k.at(e.src), dst = k.at(e.dst) ?? (e.to ? toWorld(e.to.x, e.to.y) : src), at: THREE.Vector3 | undefined = look.at === 'src' ? src : dst;
  if (look.at === 'line') { if (src && dst && src !== dst) k.fx.bolt(src, dst, () => undefined, 1.6); return true; }
  if (!at) return false;
  if (look.vfx) k.particles.vfx.fire(look.vfx, at, look.color);
  if (look.burst && look.color) k.fx.transient.burst(at.x, at.z, look.color, look.burst * 0.45, 0.28);
  if (look.burst) k.fx.flash(at, look.color ?? '#ffffff', 18 + look.burst * 8, 0.25, 4 + look.burst * 2);
  if (look.shake) k.fx.shake(look.shake, look.shake * 1.4);
  return true;
}
