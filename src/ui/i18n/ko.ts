import type { ClassId, TacticId, TagId } from '../../data/types';

export const KO = {
  class: {
    novice: '견습 모험가', warrior: '전사', berserker: '광전사', rogue: '도적',
    crossbow: '석궁수', mage: '마법사', priest: '사제',
  } satisfies Record<ClassId, string>,
  skill: {
    novice_slash: '베기', novice_lunge: '찌르며 돌진', novice_desperate: '필사의 일격',
    warrior_strike: '내려치기', shield_bash: '방패 강타', taunt_shout: '도발의 함성', bulwark: '방벽',
    cleave: '가르기', charge: '돌격', whirlwind: '회오리 베기', bloodrage: '피의 광란',
    stab: '찌르기', mark_for_death: '죽음의 표식', shadow_step: '그림자 걸음', assassinate: '암살',
    bolt_shot: '석궁 사격', crippling_shot: '절름발이 사격', piercing_bolt: '관통 볼트', volley: '일제 사격',
    arcane_bolt: '비전 화살', water_splash: '물보라', fireball: '화염구', thunderstorm: '뇌우',
    smite: '징벌', heal: '치유', judgment: '심판의 번개', sanctuary: '성역',
    dirty_strike: '비열한 일격', hex: '저주', ground_slam: '대지 강타', grave_bolt: '무덤의 화살',
    heavy_cleave: '육중한 베기', crushing_slam: '분쇄 강타', ashen_charge: '잿빛 돌진', raise_dead: '망자 소환',
  } as Record<string, string>,
  enemy: {
    bandit_cutthroat: '산적 검사', bandit_archer: '산적 궁수', bandit_hexer: '산적 주술사', bandit_chief: '산적 두목',
    skeleton_minion: '해골 졸개', skeleton_warrior: '해골 병사', skeleton_archer: '해골 궁수',
    skeleton_mage: '해골 마법사', ashen_knight: '잿빛 기사',
  } as Record<string, string>,
  tactic: {
    weakHunt: '약자 사냥', guardBack: '후열 호위', casterHunt: '술사 견제', keepDistance: '거리 유지',
    markHunt: '표식 추적', vanguard: '선봉 돌격', dangerFirst: '위험 우선 회피', rescueDowned: '쓰러진 아군 구출',
    useCover: '엄폐 활용', followLeader: '리더 목표 따르기',
  } as Record<TacticId, string>,
  tag: {
    marked: '표식', knockdown: '넘어짐', wet: '젖음', stun: '기절', burn: '화상',
    bleed: '출혈', slow: '둔화', shield: '보호막', taunted: '도발됨',
  } satisfies Record<TagId, string>,
  reason: {
    attack: '공격 중', skill: '기술 사용', approach: '목표에게 접근 중', kite: '거리를 벌리는 중',
    dodge: '위험 범위를 피하는 중', rescue: '쓰러진 동료를 구하러 가는 중', guard: '후열을 지키는 중',
    retreat: '후퇴 중', idle: '대기 중', focusLow: '약해진 적을 노림', focusMarked: '표식된 적을 노림',
    focusCaster: '술사를 견제함', combo: '연계를 노림', heal: '다친 동료를 치유함', protectBack: '후열을 노리는 적을 막음',
    followLeader: '리더의 목표를 따름', cover: '엄폐물 뒤로 이동', taunted: '도발에 걸림', threat: '가장 위협적인 적을 노림',
  } as Record<string, string>,
  ui: {
    title: 'PROJ_R', sandbox: '전투 샌드박스', start: '전투 시작', seed: '시드', allies: '아군', enemies: '적',
    loading: '불러오는 중…', victory: '승리', defeat: '패배', retreatResult: '후퇴', retry: '다시 하기',
    backToSandbox: '샌드박스로', pause: '일시정지', resume: '재개', retreat: '후퇴', log: '전투 기록',
    logFilter: '연계·구출만', kills: '처치', damage: '피해', healing: '치유', dodges: '회피',
    fatalWebgl: '이 브라우저에서는 WebGL을 사용할 수 없어 게임을 표시할 수 없습니다.',
    fatalAssets: '게임 데이터를 불러오지 못했습니다. 새로고침해 주세요.',
  } as Record<string, string>,
};

/** Dot-path lookup with {var} substitution; returns the path itself when missing. */
export function t(path: string, vars?: Record<string, string | number>): string {
  let node: unknown = KO;
  for (const key of path.split('.')) {
    if (node && typeof node === 'object' && key in node) node = (node as Record<string, unknown>)[key];
    else return path;
  }
  if (typeof node !== 'string') return path;
  return vars ? node.replace(/\{(\w+)\}/g, (_, k: string) => String(vars[k] ?? `{${k}}`)) : node;
}
