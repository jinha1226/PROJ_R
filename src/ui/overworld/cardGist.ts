/**
 * A card in one plain line: what it does, with no numbers and none of the game's own terms (2026-10-11: the level-up
 * choice was three blocks of small print). The card's full rule stays one tap away. A card without a line here shows its rule.
 */
export const CARD_GIST: Record<string, string> = {
  // common
  finish: '적을 잡으면 다음 한 방이 세다', combo: '세 번째 공격마다 한 번 더 친다', reflex: '피하면 다음 한 방이 치명타',
  initiative: '싸움이 나면 먼저 움직인다', unyielding: '죽을 뻔하면 보호막이 생긴다', morale: '적을 잡으면 소환수가 회복한다',
  leap: '움직인 뒤 첫 공격이 약점을 연다', bloodthirst: '넘치게 때린 만큼 회복한다', firstAid: '대기하면 체력을 회복한다',
  plunder: '강한 적을 잡으면 광석을 얻는다', bond: '곁에 아군이 많을수록 세다', cruel: '치명타가 더 아프다',
  // warrior
  bladeStorm: '돌면서 주변을 계속 벤다', bloodVortex: '피 흘리던 적이 죽으면 그 자리에 회오리', rendWounds: '출혈이 쌓이면 한꺼번에 터진다',
  bladeAmp: '회오리가 더 아프다', frenzy: '때릴수록 빨라진다', carnage: '잡으면 바로 다음 적을 친다', berserk: '빨라질수록 치명타가 잘 뜬다',
  frenzyAmp: '빨라질수록 더 아프다', warShout: '적을 끌어모으고 기절시킨다', rage: '다섯 대 맞으면 주변에 터뜨린다', ironCounter: '맞으면 되받아친다',
  shoutAmp: '기절한 적을 더 아프게 친다',
  // archer
  multiShot: '표식한 적이 죽으면 모두에게 쏜다', huntMark: '첫 화살이 표식을 남긴다', hunterInstinct: '표식한 적을 잡으면 다음 화살이 치명타',
  hunterEye: '표식한 적이 더 아프게 맞는다', explosiveArrow: '화살이 터지며 불을 붙인다', freezeArrow: '오래 조준한 화살이 얼린다',
  elementMesh: '원소가 만나 터질 때 두 배', elementShooter: '불과 얼음 화살이 더 아프다', pierce: '화살이 뒤의 적까지 뚫는다',
  homing: '빗나간 화살이 다른 적을 찾아간다', exposeWeakness: '치명타가 약점을 연다', focusFire: '제자리에서 쏠수록 치명타가 잘 뜬다',
  // cleric
  hammer: '망치가 내 주위를 돌며 친다', judgment: '다섯 번 치면 빛이 터진다', hammerResonance: '망치에 맞은 적이 죽으면 망치가 는다',
  holyAmp: '신성 피해가 더 아프다', divineShield: '싸우는 동안 보호막이 차오른다', shieldBurst: '보호막이 깨지면 주변이 터진다',
  overflowGrace: '넘친 회복이 보호막이 된다', sacredWall: '보호막이 더 두껍다', purifyAura: '주변의 적이 계속 탄다',
  zealAura: '오라 안에서 잡으면 빨라진다', lifeTransfer: '회복할 때 적도 다친다', auraAmp: '오라가 더 아프다',
  // two classes together
  shatterDuo: '언 적을 치면 산산조각 난다', bait: '나를 친 적에게 표식이 남는다', holyShield: '보호막이 있으면 반격이 두 배',
  gap: '기절한 적은 치명타로 맞는다', bloodOffering: '회오리로 죽은 적이 터진다', elemArrow: '표식한 적의 반응이 표식을 옮긴다',
  purifyFlame: '넘친 회복이 적을 태운다', elemTrap: '함정이 원소를 입힌다', iceCorpse: '언 적이 죽으면 주변이 언다',
  lightArrow: '표식한 적을 맞히면 회복한다', prey: '죽어 가는 표식 대상에게 두 배', boneArrow: '뼈 창이 표식 대상에서 갈라진다',
  bloodFeast: '피 흘리는 적을 치면 회복한다', lifeCycle: '시체가 터질 때마다 보호막', poisonTrap: '시체 곁의 함정이 독구름을 낸다',
  // the empty body
  pierceRound: '연달아 맞히면 뒤의 적도 뚫는다', quickReload: '잡으면 바로 장전된다', targetLock: '빗나가면 다음 한 발이 치명타',
  pointBlank: '가까이서 쏘면 더 아프다', grenade: '세 발째마다 유탄이 나간다', overheat: '연달아 맞히면 불이 붙는다',
  chainBlast: '불로 죽은 적이 터진다', blastAmp: '화염 피해가 더 아프다', returnFire: '맞거나 피하면 바로 쏴 준다',
  buttStroke: '붙은 적을 밀쳐 기절시킨다', suitOverload: '죽을 뻔하면 두 번 움직인다', armorAmp: '덜 아프게 맞는다',
  // mage
  meteor: '불붙은 적이 있으면 운석이 떨어진다', fireball: '세 번째 공격마다 화염구', fireSpread: '불로 죽으면 불이 옮겨붙는다',
  fireAmp: '화염 피해가 더 아프다', blizzard: '한곳에 머물면 눈보라가 친다', frostRing: '맞거나 잡으면 주변을 얼리고 밀어낸다',
  frostPrison: '두 번 식히면 얼어붙는다', coldAmp: '언 적이 더 아프게 맞는다', chainLightning: '감전된 적 사이로 번개가 튄다',
  staticField: '맞히면 주변 모두에게 번개', overcurrent: '감전이 옆으로 옮겨 간다', boltAmp: '번개 피해가 더 아프다',
  // necromancer
  boneSpear: '세 번째 공격마다 뼈 창이 뚫는다', bonePrison: '죽을 뻔하면 주변 적을 묶는다', boneArmor: '맞은 만큼 뼈 보호막이 생긴다',
  boneAmp: '뼈 피해가 더 아프다', raiseSkeleton: '죽인 적이 해골로 일어난다', deadGrasp: '소환수가 죽으면 시체가 남는다',
  soulLink: '소환수가 대신 맞아 준다', legionAmp: '소환수가 많을수록 세다', poisonNova: '잡은 자리에 독구름이 핀다',
  curse: '맞힌 적이 더 아프게 맞는다', poisonBurst: '독이 쌓이면 한꺼번에 터진다', plagueAmp: '독 피해가 더 아프다',
  // rogue
  lightningTrap: '싸우는 동안 번개 함정을 깐다', fireTrap: '지나간 자리에 불 함정이 남는다', chainDetonate: '함정이 터지면 옆 함정도 터진다',
  trapAmp: '함정이 더 아프다', chargeUp: '때릴수록 기가 모여 옆 적도 친다', finisher: '기를 다 써서 크게 터뜨린다',
  dragonClaw: '마무리로 잡으면 기가 돌아온다', martialAmp: '기가 더 아프다', shadowStep: '잡으면 숨어서 다음 적에게 간다',
  vitals: '상태 이상이 많은 적을 더 아프게', shadowPoison: '숨어서 치면 독이 묻는다', ambushArt: '숨어서 치는 공격이 더 아프다',
  // oaths
  bloodPact: '궁극기를 체력으로 바로 쓴다', shadowOath: '숨어 있으면 회복하고 세 배로 친다', immortal: '죽을 때 한 번 버틴다',
  fanatic: '모든 발동이 두 배 빨리 돌아온다', avatar: '맞힐 때마다 아무 원소나 입힌다', loneWolf: '혼자 싸우면 더 세다',
};
