import type * as THREE from 'three';
import type { GEvent } from '../../sim/grid/types';
import type { VfxKind } from '../fx/vfx';
import type { CueKit } from './comboCues';
import { CELL } from './gridTerrain';
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
  '관통 화살': L(undefined, undefined, 'line'), '연속 사격': L(undefined, undefined, 'line'), '사냥 표식': L('warn', '#ffd23a', 'dst'), '표식 이동': L('warn', '#ffd23a', 'dst'),
  독화살: L('smoke', '#7ad04a', 'dst'), '독 표식': L('smoke', '#7ad04a', 'dst'), '가시 덫': L('dust', '#c8b090', 'src', 1.2), '구르며 쏘기': L('dust', undefined, 'src'),
  '가시 갑옷': L('hit', '#d8d8d8', 'dst'), '땅 울림': L('dust', '#c8b090', 'src', 1.8, 0.14), '도발 함성': L('warn', '#ff8a4a', 'src', 3.0), '도발 응징': L('hit', '#ff8a4a', 'dst'),
  '분노 폭발': L('blast', '#ff3a2a', 'dst', 1.0, 0.1), '최후의 버팀': L('shield', '#ffffff', 'src', 1.2), '철벽 반격': L('crit', '#d8e8ff', 'dst'),
  '급소 찌르기': L('crit', '#ffd04a', 'dst'), 처형: L('crit', '#ff2a2a', 'dst', 1.0, 0.16), '독 폭발': L('smoke', '#7ad04a', 'dst', 1.7, 0.1),
  '그림자 걸음': L('smoke', '#3a2a4a', 'src'), '배신의 칼날': L('crit', '#c8a8ff', 'dst'), '상처 벌리기': L('hit', '#ff3a4a', 'dst'),
  '심판 낙인': L('blast', '#ffd76a', 'dst', 1.3), '응답하는 기도': L('heal', '#ffd76a', 'dst', 1.2), '축복 확산': L('shield', '#ffd76a', 'src', 2.4),
  '축복의 처치': L('shield', '#ffd76a', 'src'), '넘친 은총': L('shield', '#ffd76a', 'dst'), '생명 전이': L('magic', '#ffd76a', 'dst'),
  마무리: L('crit', '#ffd76a', 'src'), 연타: L('hit', undefined, 'dst'), '반사 신경': L('magic', '#9fe8ff', 'src'), 선제: L('magic', '#ffd76a', 'src'),
  불굴: L('shield', '#ffffff', 'src', 1.4), 사기: L('heal', undefined, 'src', 2.0), 도약: L('dust', undefined, 'dst'), '피의 갈증': L('heal', '#ff3a4a', 'src'),
  '미끼와 사냥꾼': L('warn', '#ffd23a', 'dst'), 산산조각: L('frost', '#e8f6ff', 'dst', 1.3, 0.12), 틈새: L('crit', '#c8a8ff', 'dst'), '원소 화살': L('magic', '#ffd23a', 'dst', 1.0),
  '빛의 화살': L('heal', '#ffd76a', 'dst'), 사냥감: L('crit', '#ff2a2a', 'dst'), '정화의 불꽃': L('blast', '#ff9a3a', 'dst', 1.2), '피의 성찬': L('heal', '#ff3a4a', 'src'),
  '불탄 자': L('blast', '#ff7a2a', 'dst', 1.0), '서리 무덤': L('frost', undefined, 'dst'), '번개 맞은 자': L('shock', undefined, 'dst'), 백정: L('hit', '#ff3a4a', 'dst'),
  수호자: L('shield', '#8ff0ff', 'src'), 독살자: L('smoke', '#7ad04a', 'dst'), 사냥꾼: L('warn', '#ffd23a', 'dst'), 배신자: L('smoke', '#3a2a4a', 'src'),
};
/** the colour of each tag's resonance flare */
const TAG_COLOR: Record<string, string> = { 화염: '#ff7a2a', 냉기: '#9fd8ff', 전기: '#ffe85a', 독: '#7ad04a', 출혈: '#ff3a4a', 근접: '#ffb04a', 원거리: '#9fe85a', 방패: '#d8e8ff', 은신: '#8a7aa8', 치유: '#5dff8a', 협공: '#ffd76a', 소환: '#b48aff', 생존: '#ffffff', 치명: '#ffd04a' };

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
  const look = lookOf(e);
  if (!look) return false;
  const src = k.at(e.src), dst = k.at(e.dst) ?? src, at: THREE.Vector3 | undefined = look.at === 'src' ? src : dst;
  if (look.at === 'line') { if (src && dst && src !== dst) k.fx.bolt(src, dst, () => undefined, 1.6); return true; }
  if (!at) return false;
  if (look.vfx) k.particles.vfx.fire(look.vfx, at, look.color);
  if (look.burst && look.color) k.fx.transient.burst(at.x, at.z, look.color, look.burst * 0.45, 0.28);
  if (look.burst) k.fx.flash(at, look.color ?? '#ffffff', 18 + look.burst * 8, 0.25, 4 + look.burst * 2);
  if (look.shake) k.fx.shake(look.shake, look.shake * 1.4);
  return true;
}
