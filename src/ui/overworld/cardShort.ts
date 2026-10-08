/**
 * What a card's tile says in the build strip along the bottom of the screen: two or three letters, no space. Only the
 * tile is short: the log, the card picker and every description keep the card's full name.
 */
export const CARD_SHORT: Record<string, string> = {
  // common
  finish: '마무리', combo: '연타', reflex: '반사', initiative: '선제', unyielding: '불굴', morale: '사기', leap: '도약', bloodthirst: '갈증', firstAid: '응급', plunder: '약탈자', bond: '결속', cruel: '잔혹',
  // warrior
  bladeStorm: '칼바람', bloodVortex: '피바람', rendWounds: '찢기', bladeAmp: '칼날술', frenzy: '광란', carnage: '도륙', berserk: '광폭화', frenzyAmp: '광기', warShout: '함성', rage: '분노', ironCounter: '철벽', shoutAmp: '함성술',
  // archer
  multiShot: '다중', huntMark: '표식', hunterInstinct: '직감', hunterEye: '사냥눈', explosiveArrow: '폭발', freezeArrow: '빙결', elementMesh: '맞물림', elementShooter: '사수', pierce: '관통', homing: '유도', exposeWeakness: '약점', focusFire: '집중',
  // cleric
  hammer: '망치', judgment: '낙인', hammerResonance: '공명', holyAmp: '신성술', divineShield: '방패', shieldBurst: '막폭발', overflowGrace: '은총', sacredWall: '방벽', purifyAura: '정화', zealAura: '광오라', lifeTransfer: '생명', auraAmp: '오라술',
  // duo
  shatterDuo: '산산', bait: '미끼', holyShield: '성방패', gap: '틈새', bloodOffering: '제물', elemArrow: '원소살', purifyFlame: '불꽃', elemTrap: '원소덫', iceCorpse: '얼음', lightArrow: '빛화살', prey: '사냥감', boneArrow: '뼈화살', bloodFeast: '성찬', lifeCycle: '순환', poisonTrap: '독덫',
  // empty body
  pierceRound: '관통탄', quickReload: '재장전', targetLock: '분석', pointBlank: '산탄', grenade: '유탄', overheat: '과열탄', chainBlast: '연쇄폭', blastAmp: '폭약술', returnFire: '반격', buttStroke: '밀치기', suitOverload: '과부하', armorAmp: '장갑술',
  // mage
  meteor: '운석', fireball: '화염구', fireSpread: '전이', fireAmp: '화염술', blizzard: '눈보라', frostRing: '고리', frostPrison: '감옥', coldAmp: '냉기술', chainLightning: '번개', staticField: '정전기', overcurrent: '과전류', boltAmp: '번개술',
  // necromancer
  boneSpear: '뼈창', bonePrison: '뼈감옥', boneArmor: '뼈갑옷', boneAmp: '뼈술', raiseSkeleton: '해골', deadGrasp: '손아귀', soulLink: '연결', legionAmp: '군세', poisonNova: '독신성', curse: '저주', poisonBurst: '독폭발', plagueAmp: '독술',
  // rogue
  lightningTrap: '번개덫', fireTrap: '화염덫', chainDetonate: '기폭', trapAmp: '함정술', chargeUp: '기모음', finisher: '일격', dragonClaw: '용발톱', martialAmp: '무술', shadowStep: '그림자', vitals: '급소', shadowPoison: '그늘독', ambushArt: '기습',
  // oaths
  bloodPact: '계약', shadowOath: '서약', immortal: '불사', fanatic: '광신', avatar: '화신', loneWolf: '늑대',
};
