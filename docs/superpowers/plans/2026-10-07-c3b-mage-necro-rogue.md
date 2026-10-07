# 마법사·강령술사·도적 (계획 C3b) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans. Steps use checkbox (`- [ ]`) syntax.

**Goal:** The mage, the necromancer (now a base class) and the rogue rebuilt on the branch framework: 36 cards whose signatures run as sustained states, corpses as a resource, skeletons and a golem on the summon AI, rogue traps, shadow clones that copy the rogue's blows, and the three aimed ultimates (teleport, golem, shadow clone).

**Architecture:** Each class gets a `cardsMage.ts` / `cardsNecro.ts` / `cardsRogue.ts` file (12 cards each via `inBranch`), its two innates in `KITS`, and its branches in `BRANCHES`. Corpses are dead foe units not yet `raised` (`corpses.ts`). Player traps are a `p.snares` list ticked like gravity wells (`snares.ts`). Shadow clones are summoned units with `mirror: true` that take no turns of their own and strike when their owner attacks. Ultimates are new `UltId`s in `ultimate.ts`.

**Tech Stack:** TypeScript, Vitest, three.js view (cue names only; VFX in C5).

**Spec:** `docs/superpowers/specs/2026-10-07-class-branches-design.md` §1.5 (attack/hit/damage), §2 (branches, offers), §3.2 mage, §3.5 rogue, §3.6 necromancer, §5 summons, §6 cleanup (mage/rogue part).

## Global Constraints
- Terse Korean card text; files ≤ 500 lines; typecheck + lint per task; unit tests per task; full suite + build + e2e + CI at the end.
- Every card states its result: extra attack (`strike(...,false)`), hit (`freeHit`), or damage (`damage(..., kind)`).
- Signatures are sustained states (spec §2.1 table row 상징).
- Commits end with `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.

## Rulings carried in
- The old mage/rogue cards not in the spec's lists are removed (spec §6), with their tests; 원소 순환 becomes the mage innate (the card goes).
- `necromancer` moves from `AdvancedClass` to `BaseClass` (same id); its old advanced kit (해골 innate, 망자의 군세 ult) is replaced.
- Corpses are dead foes (`!alive && !raised`); explosions, skeletons and golems set `raised = true`.
- Snares (player traps) fire when a foe stands on the cell at a tick; charges and lifetime per spec.
- Shadow clones: 1 HP, 3 turns, no turns of their own; when the owner attacks, each clone makes an extra attack on the nearest foe it can reach from where it stands; the owner's snare cards also lay snares at the clones' cells.

## Review Focus
1. A corpse used twice (explosion and skeleton in the same action).
2. Chain explosion recursion over a packed room (corpse explosion `repeat` + kills) must stop at the cap and never revisit a corpse.
3. A shadow clone's copied attack triggering the clone-making ultimate again, or clones copying clones.
4. A snare under a foe that is already dead / two snares on one cell.
5. Teleport onto an occupied or wall cell.

---

### Task 1: Necromancer as a base class, corpses, innates
- Files: `partyDefs.ts` (BaseClass + 'necromancer', BASE_CLASSES), `classKit.ts` (KITS.necromancer innates 시체 폭발 repeat / 망자의 부름, ult 'golem' placeholder until Task 3, proficient staff), `corpses.ts` (`corpsesNear(p, at, r)`, `consume(u)`), `branches.ts` (necro/mage/rogue branches), visuals for necromancer in `partyPick.ts` (exists) and class icon/tint.
- Test `tests/unit/necroBase.test.ts`: a soul `necromancer` implants with a staff; killing a foe next to two others makes the corpse burst (fire? no — bone damage) hurting both; the burst killing one makes that corpse burst too (repeat), each corpse once; 망자의 부름 raises a skeleton 20% (forced rng).

### Task 2: Mage (12 cards, innates, teleport)
- Files: `cardsMage.ts` (화염: 운석·화염구·화염 전이·화염 숙련 / 냉기: 블리자드·서리 고리·서리 감옥·냉기 숙련 / 번개: 연쇄 번개·정전기장·과전류·번개 숙련), `classKit.ts` (mage innates 원소 순환 + 파쇄, ult 'teleport'), `ultimate.ts` (teleport), remove MAGE from `cardsRanged.ts`.
- Test `tests/unit/cardsMage.test.ts`: one test per signature (meteor every turn while a burning foe lives, a meteor kill drops another; blizzard after two turns near one spot hits foes within 2 every turn and stops when the mage moves 3+; chain lightning each turn while a shocked foe lives), one per other card, teleport moves to a free floor cell and blasts both ends, refuses walls/occupied cells.

### Task 3: Necromancer (12 cards, skeleton archer, golem)
- Files: `cardsNecro.ts` (뼈: 뼈 창·뼈 감옥·뼈 갑옷·뼈 숙련 / 군단: 해골 일으키기·망자의 손아귀·사령의 연결·망자의 군세 / 독·저주: 독 신성·저주·독 폭발·독 숙련), `kitEffects.ts` (`summon` options: kind skeleton/archer/golem, hp, weapon, lifetime), `ultimate.ts` (golem: consume corpses within 3 of the cell; size by count; burn/frozen corpses → element; taunt within 3; death → big corpse burst).
- Test `tests/unit/cardsNecro.test.ts`: per card; golem needs corpses, grows with them, draws foes, bursts on death.

### Task 4: Rogue (12 cards, snares, shadow clones)
- Files: `cardsRogue.ts` (함정: 번개 함정·화염 함정·연쇄 기폭·함정 숙련 / 무술: 기 모으기·마무리 일격·용의 발톱·무술 숙련 / 그림자: 그림자 걸음·급소 찌르기·그림자 독·기습), `snares.ts` (`laySnare`, `tickSnares`, chain detonation), `partySim.ts` (tick snares), `ultimate.ts` (shadowClone), mirror strikes in `partySim`/`partyCore` attack path, remove ROGUE from `cardsMelee.ts`.
- Test `tests/unit/cardsRogue.test.ts`: per card; snares fire on a foe stepping in, chain detonation reaches snares within 2 once each; clones copy attacks, vanish when hit, never copy each other.

### Task 5: Cleanup and plan-end checks
- Remove the replaced cards' tests and references (effect cues, trigger texts, duo cards that reference removed ids keep working), update counts (`traits.test.ts`), bot comps (`mage/archer` → still valid), full suite, build, e2e, bot once, push, CI.
