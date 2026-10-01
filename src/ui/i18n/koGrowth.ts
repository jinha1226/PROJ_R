export const KO_GROWTH = {
  poolSkill: {
    shield_wall: '방패벽', cleaving_blow: '베어 넘기기', rally: '재집결', leap_slam: '도약 강타', rending_strike: '찢어발기기',
    frenzy: '광분', smoke_bomb: '연막탄', poison_blade: '독 묻은 칼날', fan_of_knives: '칼날 부채', explosive_bolt: '폭발 볼트',
    pinning_shot: '고정 사격', rain_of_bolts: '볼트 비', frost_lance: '서리 창', chain_spark: '연쇄 불꽃', meteor: '유성',
    holy_shield: '신성한 방패', mass_heal: '광역 치유', blessed_strike: '축복의 일격',
    thorns: '가시 반사', lifesteal: '흡혈',
  } as Record<string, string>,
  passive: {
    toughness: '강인함', sharpEdge: '날 선 칼끝', ironSkin: '강철 피부', quickHands: '빠른 손', fleetFoot: '날랜 발', momentumSurge: '기세 폭발',
  } as Record<string, string>,
  passiveDesc: {
    toughness: '최대 체력 +15%', sharpEdge: '공격력 +10%', ironSkin: '방어 +15%', quickHands: '공격 속도 +10%',
    fleetFoot: '이동 속도 +10%, 회피 +15%', momentumSurge: '기세 획득 +25%',
  } as Record<string, string>,
  item: {
    worn_sword: '녹슨 검', knight_blade: '기사단의 검', worn_axe: '이 빠진 도끼', bloodaxe: '피의 도끼',
    worn_daggers: '무딘 단검', shadow_fangs: '그림자 송곳니', worn_crossbow: '낡은 석궁', hunter_crossbow: '사냥꾼의 석궁',
    worn_staff: '나무 지팡이', storm_staff: '폭풍의 지팡이', worn_wand: '부러진 완드', saint_wand: '성자의 완드',
    ragged_clothes: '누더기 옷', padded_vest: '누빔 조끼', leather_armor: '가죽 갑옷', traveler_cloak: '나그네 망토',
    chain_mail: '사슬 갑옷', scale_armor: '비늘 갑옷', ranger_coat: '순찰자 외투', sage_robe: '현자의 로브',
    guard_plate: '수호자의 판금', dragon_plate: '용린 판금', lucky_coin: '행운의 동전', iron_ring: '철 반지',
    swift_boots: '날랜 장화', healer_charm: '치유사의 부적', rune_stone: '룬석', war_horn: '전쟁 뿔피리',
    vampire_fang: '흡혈귀의 송곳니', storm_amulet: '폭풍의 목걸이',
  } as Record<string, string>,
  unique: {
    markReset: '표식된 적을 처치하면 기술 재사용 대기시간 초기화', knockdownBleed: '넘어진 적을 공격하면 출혈',
    friendGuard: '친한 동료 근처에서 방어 +20%', lifesteal: '준 피해의 10% 회복', firstStrike: '전투 시작 시 기세 +30',
    lastStand: '체력 30% 이하에서 공격력 +25%', thorns: '근접 공격을 받으면 일부 반사', wetLightning: '젖은 적에게 피해 +25%',
  } as Record<string, string>,
  tier: { 0: '낡은', 1: '일반', 2: '정예', 3: '명품', 4: '전설' } as Record<string, string>,
  slot: { weapon: '무기', armor: '방어구', trinket: '장신구' } as Record<string, string>,
  scar: { limp: '절름발이', oneEye: '외눈', hardened: '굳은살' } as Record<string, string>,
  scarDesc: {
    limp: '이동 속도 −10% / 전투마다 한 번 결의로 버팀', oneEye: '회피 −40% / 치명타 +60%', hardened: '최대 체력 −10% / 방어 +20%',
  } as Record<string, string>,
  title: { guardian: '수호자', undying: '불사신', giantSlayer: '거인 사냥꾼', hundredCuts: '백인참', shadow: '그림자', healingHand: '치유의 손' } as Record<string, string>,
  titleDesc: {
    guardian: '엄호·호위 중 방어 +15%', undying: '생명선 +25%', giantSlayer: '보스·정예에게 피해 +10%',
    hundredCuts: '처치할 때 기세 +10', shadow: '회피 +5%', healingHand: '치유량 +10%',
  } as Record<string, string>,
  role: { vanguard: '선봉', striker: '공격수', skirmisher: '유격', ranged: '원거리', caster: '술사', support: '지원' } as Record<string, string>,
  rank: { rookie: '신입', skilled: '숙련', veteran: '베테랑', hero: '영웅' } as Record<string, string>,
  chronicle: {
    joined: '용병단에 합류했다.', named: '자신을 "{name}"(이)라 소개했다.', firstKill: '{battle}번째 전투에서 첫 적을 쓰러뜨렸다.',
    downedRescued: '쓰러졌으나 {by}이(가) 일으켜 세웠다.', rescued: '쓰러진 {who}을(를) 구해냈다.',
    bossKill: '{enemy}을(를) 쓰러뜨렸다.', eliteKill: '정예 {enemy}을(를) 쓰러뜨렸다.',
    newFriend: '{who}와(과) 친구가 되었다.', newComrade: '{who}와(과) 전우가 되었다.',
    newRival: '{who}와(과) 라이벌이 되었다.', newFeud: '{who}와(과) 사이가 틀어졌다.',
    title: '"{title}"이라는 별명을 얻었다.', scar: '깊은 상처가 남았다 — {scar}.', friendDied: '{who}을(를) 잃었다.',
    rank: '{rank}이(가) 되었다.', promoted: '{class}(으)로 첫 승급을 했다.', revealed: '숨겨진 성격이 드러났다 — {trait}.',
    died: '{battle}번째 전투에서 전사했다.',
  } as Record<string, string>,
};
