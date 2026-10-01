import type { PoiKind } from '../../sim/extract/regionTypes';
import type { Phase } from '../../sim/world/clock';

export const POI_NAME: Record<PoiKind, string> = {
  ruins: '무너진 초소', camp: '산적 야영지', nest: '해골 둥지', temple: '잊힌 신전', vault: '봉인된 보물방', swamp: '독안개 늪', boss: '산적 두목의 요새',
};
export const PHASE_NAME: Record<Phase, string> = { day: '낮', dusk: '해질녘', night: '밤', storm: '마력 폭풍' };
export const CHANNEL_NAME: Record<string, string> = { search: '뒤지는 중', extract: '탈출 중', recall: '귀환 주문 시전 중', equip: '장비 교체 중', drink: '마시는 중' };
export const PROMPT: Record<string, string> = { search: '뒤지기', loot: '줍기', door: '문 열기 (열쇠 사용)', locked: '잠겨 있다 — 열쇠가 필요하다' };
export const ALERT: Record<string, string> = {
  spotted: '발각됐다!', lost: '추격을 따돌렸다', dusk: '해가 기운다 — 순찰이 늘었다', closing: '탈출 지점 하나가 곧 닫힌다!', closed: '탈출 지점이 닫혔다',
  night: '밤이 왔다 — 시야가 좁아지고 강한 적이 나타난다', storm: '마력 폭풍 — 사냥꾼들이 쫓아온다!', interrupted: '방해받았다', door: '보물방 문이 열렸다',
  equip_failed: '장착할 수 없다', combat: '교전 시작!', calm: '전투가 끝났다 — 다시 모인다', leader: '리더가 쓰러져 지휘가 넘어갔다',
  member_died: '동료가 쓰러져 숨을 거뒀다…', focus: '집중 공격!', retreat: '후퇴!', regroup: '재집결!',
};
