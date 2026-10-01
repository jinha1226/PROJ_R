import type { RelationKind, TraitId } from '../../data/types';

export const KO_PERSONALITY = {
  trait: {
    reckless: '무모함', cautious: '신중함', protective: '보호본능', coward: '겁쟁이', competitive: '경쟁심', vengeful: '복수심',
    hotheaded: '다혈질', calm: '냉정함', glory: '영광 추구', loner: '외톨이', chatty: '수다쟁이', altruist: '이타적',
  } as Record<TraitId, string>,
  traitDesc: {
    reckless: '돌진을 좋아하고 위험을 잘 피하지 않는다. 기세가 빨리 찬다.',
    cautious: '위험 범위를 잘 피하지만 첫 행동이 느리다.',
    protective: '위험에 빠진 동료를 감싸러 달려간다.',
    coward: '체력이 낮으면 도망친다. 친구가 곁에 있으면 용기를 낸다.',
    competitive: '다른 동료가 노리는 적의 막타를 탐낸다. 라이벌이 잘 생긴다.',
    vengeful: '친구가 쓰러지면 쓰러뜨린 적을 끝까지 쫓는다.',
    hotheaded: '맞으면 쉽게 분노한다.',
    calm: '감정에 덜 휘둘린다(감정 효과 절반).',
    glory: '보스와 정예를 우선 노리고, 처치하면 기세가 크게 오른다.',
    loner: '주변에 동료가 없을 때 강하다. 친해지는 데 오래 걸린다.',
    chatty: '동료와 빨리 친해진다.',
    altruist: '자기보다 동료의 치유와 보호를 우선한다.',
  } as Record<TraitId, string>,
  relation: { friend: '친구', comrade: '전우', rival: '라이벌', feud: '반목', mentor: '사제' } as Record<RelationKind, string>,
  rule: {
    friend: '{a}은(는) {b}이(가) 위험하면 엄호하러 달려간다. 가까이 있으면 서로 방어가 오른다.',
    comrade: '{a}와(과) {b}은(는) 전우 연계기 「{combo}」를 쓸 수 있다.',
    rival: '{a}와(과) {b}은(는) 가까이 있으면 공격 속도·치명타가 오르지만 같은 적을 두고 다툰다.',
    feud: '{a}와(과) {b}은(는) 가까이 있으면 공격력이 떨어지고 서로 잘 돕지 않는다.',
    mentor: '스승 {a}은(는) 제자 {b}을(를) 지킨다.',
  } as Record<RelationKind, string>,
  combo: {
    shield_chant: '방패 뒤 영창', mark_snipe: '표식 저격', hammer_anvil: '망치와 모루', holy_bulwark: '성스러운 방벽',
    purging_storm: '정화의 폭풍', blood_hunt: '피의 사냥', fire_arrows: '불화살 비', zealot_charge: '광신의 돌격', joint_strike: '합동 공격',
  } as Record<string, string>,
  comboSkill: {
    combo_shield_chant: '방패 뒤 영창', combo_guard_taunt: '수호의 함성', combo_mark_snipe: '표식 저격', combo_mark: '저격 표식',
    combo_hammer: '망치', combo_anvil: '모루', combo_holy_bulwark: '성스러운 방벽', combo_purging_storm: '정화의 폭풍',
    combo_judgment: '정화의 심판', combo_blood_hunt: '피의 사냥', combo_charge: '몰이 돌격', combo_fire_arrows: '불화살 비',
    combo_assist: '화살에 불 붙이기', combo_zealot: '광신의 돌격', combo_zealot_bless: '광신의 축복',
    combo_joint_strike: '합동 공격', combo_joint_follow: '합동 추격',
  } as Record<string, string>,
  reason: {
    protectFriend: '위험한 동료를 엄호함', rivalry: '라이벌보다 먼저 쓰러뜨리려 함', revenge: '복수를 노림', fear: '겁에 질려 도망침',
    rage: '분노에 휩싸임', glory: '영광을 노림', comboPair: '전우와 연계기를 펼침', feud: '반목하는 동료를 외면함', competitive: '막타를 노림',
    flee: '겁에 질려 도망침', protect: '동료를 엄호함',
  } as Record<string, string>,
};
