# 전사·궁수·성직자, 조합 카드, 정리 (계획 C3c) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans. Steps use checkbox (`- [ ]`) syntax.

**Goal:** The warrior, archer and cleric rebuilt on the branch framework (36 cards, signatures as sustained states), their ultimates per spec, the 15 combo cards for one body with two souls, the nine advanced classes removed, the common cards read for a solo body, every amp card multiplicative, and the branch demo menu grouped by class.

**Architecture:** Same as C3b: one file per class (`cardsWarrior.ts`, `cardsArcher.ts`, `cardsCleric.ts`, 12 cards each via `inBranch`), branches in `BRANCHES`, innates in `KITS`. Sustained signature states live on the unit (`spinUntil`, `frenzy`, `shoutUntil`, `volleyUntil`) and are driven by the `turn` / `attack` / `hit` / `kill` events. Blessed hammers are orbit objects on the party (`p.hammers`, ticked like snares, not units). The sanctuary ultimate becomes an aimed zone (`p.zones`, ticked). Combo cards replace the duo pool in `cardsCombo.ts` and read both lines from one body (`linesOf`).

**Tech Stack:** TypeScript, Vitest, three.js view (cue names only; VFX in C5).

**Spec:** `docs/superpowers/specs/2026-10-07-class-branches-design.md` §2 (branches), §3.1 warrior, §3.3 archer, §3.4 cleric, §4 combo cards, §5 summons, §6 cleanup, §7 (C3c).

## Global Constraints
- Terse Korean card text; files ≤ 500 lines; typecheck + lint per task; unit tests per task; full suite + build + e2e + bot + CI at the end.
- Every card states its result: extra attack (`strike(...,false)`), hit (`freeHit`), or damage (`damage(..., kind)`).
- Signatures are sustained states: switched on by a frequent condition, extended by their chain events.
- Sustained laws that run on `turn` wait for a fight (`fighting` in `cardFx.ts`).
- Amps multiply per tag: `base ** tagCount` (spec §7 "증폭 카드의 곱연산 통일"); amp rank 2 adds 0.04 to the base.
- Card ranks (spec §2.2.1): signature and law cards 3 ranks (rank 3 = the special effect in the spec table), convert and amp cards 2.
- Commits end with `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.

## Rulings carried in
- Old warrior/archer/cleric cards not in the spec's lists are removed with their tests (spec §6): 가시 갑옷, 최후의 버팀, 피의 대가, 땅 울림, 굳건함, 독화살, 가시 덫, 구르며 쏘기, 연속 사격, 응답하는 기도, 축복 확산, 순교. Cards the spec keeps by name keep their ids (`rage` 분노 축적, `ironCounter` 철벽 반격, `huntMark` 사냥 표식, `pierce` 관통 화살, `focusFire` 집중 사격, `hunterEye` 사냥꾼의 눈, `shieldBurst` 보호막 폭발, `judgment` 심판 낙인, `overflowGrace` 넘친 은총, `lifeTransfer` 생명 전이, `sacredWall` 신성 방벽) and are rewritten to the spec text.
- Ultimates: warrior `warcry` → `earthSlam` 대지 강타 (aimed leap within 5, stun within 2, one whirlwind on landing); archer `arrowRain` marks what it hits; cleric `sanctum` becomes aimed (radius 2, 3 turns: allies inside immune, foes inside take holy damage each turn).
- Hero souls that held removed cards get cards from their branch.
- The nine advanced classes go (ids, kits, ultimates `bloodFrenzy bastion pierceShot bleedRain elementStorm judgement longSanctum deathDance toxicFog deadHost shadowDance warcry`, looks, picks, i18n); tests that used them move to base classes or go.
- Common cards that assume allies (결속, 사기, #협공 resonance) count summons and shadow clones as allies.

## Review Focus
1. A sustained state that never ends (spin/frenzy/volley extended by its own kills past its cap).
2. Hammers or the sanctuary zone surviving the stairs or the clone's death.
3. A combo card firing for a body that holds only one of its two lines.
4. Earth slam onto a wall, an occupied cell or out of reach.
5. A removed class id still reachable from a save, a hero soul, a demo or the pick screen.

---

### Task 1: Warrior (12 cards, earth slam)
- Files: `cardsWarrior.ts` (회오리: 칼바람·피의 소용돌이·상처 찢기·칼날 숙련 / 광란: 광란·연속 도륙·광폭화·피의 광기 / 함성: 전투 함성·분노 축적·철벽 반격·함성 숙련), `classKit.ts` (ult `earthSlam`), `ultimate.ts`, remove WARRIOR from `cardsMelee.ts` (file goes if empty), `branches.ts` already lists warrior branches (check), `heroSouls.ts`.
- Test `tests/unit/cardsWarrior.test.ts`: twelve cards in three branches, one signature each, ult earthSlam; 칼바람: a whirlwind starts the spin state, every attack then sweeps round (bleed), kills extend to at most 6 turns; 피의 소용돌이: a bleeding foe dying sets off a whirlwind there; 상처 찢기: five bleed stacks burst; 광란: hits build frenzy (cap 5), frenzy 5 strikes twice, 3 turns without a hit clears it; 연속 도륙: a kill at frenzy 5 strikes again; 전투 함성: fight start opens the shout (taunt within 3 each turn, stun 30%), stunned kills extend it; 함성 숙련 multiplies damage to stunned/taunted foes; earth slam lands on a free cell within 5, stuns within 2, refuses walls/occupied/far cells.

### Task 2: Card ranks (framework, empty body, warrior)
- Files: `traitTypes.ts` (`card(..., up, up3)`: ranks 3 when `up3`, `TraitDef.up3`; `ampBase(u, id, base)` = base + 0.04 at rank 2), `traitText.ts` and `traitPicker.ts` (show the next rank's text: rank 1 → `up`, rank 2 → `up3`), `cardsShell.ts`, `cardsWarrior.ts` (rank 3 effects and convert/amp rank 2 per spec §2.2.1).
- Test `tests/unit/cardRanks.test.ts`: every branch card's ranks follow its slot (sig/law 3, convert/amp 2); offers stop at the top rank; the picker shows `up3` for a clone at rank 2; one test per new rank-3 effect / convert rank 2 for shell and warrior; amp rank 2 multiplies by base+0.04 per tag.

### Task 3: Card ranks (mage, necromancer, rogue)
- Files: `cardsMage.ts`, `cardsNecro.ts`, `cardsRogue.ts`, `snares.ts` per spec §2.2.1.
- Test: extend `tests/unit/cardRanks.test.ts`, one test per new effect.

### Task 4: Archer (12 cards, marking arrow rain)
- Files: `cardsArcher.ts` (다중 사격: 다중 사격·사냥 표식·사냥꾼의 직감·사냥꾼의 눈 / 원소 화살: 폭발 화살·빙결 화살·원소 맞물림·원소 사수 / 정밀: 관통 화살·유도 화살·약점 노출·집중 사격), remove ARCHER from `cardsRanged.ts` (keep the helpers `beyond`, `markMult` there), `ultimate.ts` (arrow rain marks), `heroSouls.ts`.
- Cards carry their ranks from the start (spec §2.2.1).
- Test `tests/unit/cardsArcher.test.ts`: per card (rank 3 effects included); 다중 사격: a marked foe dying opens the volley state, every shot then hits all foes within 4 and marks them, kills extend it (cap); 관통 화살 stacks +10% per foe pierced (cap +50%) and resets on a miss; 유도 화살 turns a miss on the nearest other foe; arrow rain marks.

### Task 5: Cleric (12 cards, hammers, aimed sanctuary)
- Files: `cardsCleric.ts` (축복의 망치: 축복의 망치·심판 낙인·망치 공명·신성 숙련 / 방패 강타: 신성 방패·보호막 폭발·넘친 은총·신성 방벽 / 오라: 정화의 오라·광신의 오라·생명 전이·오라 숙련), `hammers.ts` (`p.hammers`, orbit radius 1 round the owner, a foe on an orbit cell takes holy damage once a turn; ticked in `partySim`), `ultimate.ts` + `zones.ts` (aimed sanctuary), remove the cleric part of `cardsSupport.ts`, descend clears hammers/zones, `heroSouls.ts`.
- Cards carry their ranks from the start (spec §2.2.1).
- Test `tests/unit/cardsCleric.test.ts`: per card (rank 3 effects included); one hammer turns from the fight's start, struck / every third attack adds one (3 turns, cap 3), a hammer kill adds one (repeat, cap 4); holy shield fills (start 10, 3 a turn, 5 per kill); purifying aura hits within 2 each turn and grows per kill (cap +100%); sanctuary: allies inside immune, foes inside take holy damage each turn, gone after 3 turns and on the stairs.

### Task 6: Combo cards (15)
- Files: `cardsCombo.ts` (15 per spec §4, pool `duo`, `lines: [a, b]`), offers in `partyLevel.ts` / `traitPool.ts` only offer a combo when the body holds both lines, remove the old duo list from `cardsSupport.ts` (file goes if empty), `duoFor(p,u,id)` reads one body.
- Test `tests/unit/cardsCombo.test.ts`: 15 combos, each pair of the six fantasy lines once; offered only to a body with both souls; one test per new combo (피의 제물, 원소 함정, 얼음 시체, 뼈 화살, 생명의 순환, 독 함정) and the kept ones still fire in one body.

### Task 7: Advanced classes out, commons for solo, multiplicative amps, demo menu, checks
- Files: `partyDefs.ts` (ClassId = BaseClass | 'shell'), `classKit.ts` (KITS, LINE), `ultimate.ts`, `partyPick.ts`, `classIcons.ts`, i18n, `cardsCommon.ts` (결속/사기 count summons and clones), `resonance.ts` (#협공), amp cards across files → `**`, `branchArena.ts` menu grouped by class (빈 몸·전사·마법사·궁수·성직자·도적·강령술사), `utility.ts` stale ids, effect cues and trigger texts for the new names.
- Test: `tests/unit/advancedGone.test.ts` (no advanced id in CLASSES/KITS/ULT_NAMES; a saved clone with an old class id loads as its base line), common cards with a summon nearby, every amp card multiplies (two tags = base²), menu lists seven classes with three branches each; full suite, build, e2e, bot, push, CI, final review (opus), fix pass, memory.
