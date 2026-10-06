# Trigger builds implementation

## Rulings

- A six-second cooldown permits activations at 0, 6, 12: three in thirteen seconds including time zero. The plan's “twice” example conflicts with the specified cooldown; the cooldown wins.
- Chain cap counts five effect executions across recursive and sibling subscriptions, not five per subscription.
- New advanced classes inherit base HP and movement: the binding spec supplies neither additional HP nor movement numbers. Existing berserker/sniper values remain.
- Shock lasts until consumed. Its chain damage is 3; reaction neighbours use radius 1. These numbers are unspecified in the spec.

## Task 1

Trigger subscriptions, shared five-effect recursion budget, cooldowns, attack/movement/crisis/combat/status emissions; nine statuses and three reactions. Tests were red on missing modules; TypeScript, lint and 406 unit tests passed. Commit: 4b443b0.

## Task 2

Five base kits, ten advanced kits, veteran, fifteen ultimates, build promotion rules, proficiency switching, companion ultimate choice. R replaces Q/W; the old R restart shortcut moves to F5. Shaft transfer keeps remaining ultimate and trigger cooldowns. Removed the skill and auto-skill modules. Existing skill tests now exercise their replacement behaviours.

Open numeric choices: meteor 24–32, judgement 22, piercing shot 18–24, shadow slashes ×2; all offensive aimed ultimates have range 10. Skeletons have 18 HP, fists, a 10-second lifetime; necromancer kill cap 2, army uncapped (one per corpse). Hunter roots use freeze's two-second hold. New advanced classes retain their base proficiency except hunter adds daggers and guardian drops great weapons.

Task 2 validation: missing-module red observed; TypeScript and 427 tests in 73 unit files passed. `roundHud` timed out under concurrent transform load in two intermediate runs, then passed both tests alone; the final unit run passed it as well.

## Task 3

All 80 traits: 24 common / 30 base / 20 advanced / 6 keystones; tagged, ranked data, trigger effects, combat passives and weighted offers. Removed partyTraits. Base/advanced cards are sampled without replacement, and exhausted advanced pools fall back to the parent base pool. Untagged entries in the draft gain a thematic tag: 집중/노련함/약탈자 생존, 연타/추격 근접, 선제 치명. Speed bonuses change action duration by `1/(1+bonus)`.

The ten designed advanced traits (rank-one numbers, additive increments per rank unless noted):

| Class | Trait | Effect |
|---|---|---|
| 광전사 | 붉은 분노 | 위기: 5초 피해 +20% (+20%) |
| 수호기사 | 방벽의 가시 | 막기: 반사 4 (+4) |
| 저격수 | 먼 눈 | 사거리 +1 (+1) |
| 사냥꾼 | 맹독 추적 | 적중: 중독 1, 확률 20% (+20%) |
| 원소술사 | 원소 장막 | 상태 부여: 보호막 3 (+3), 2초 대기 |
| 강령술사 | 뼈의 씨앗 | 궁극기: 해골 1, 소환 상한 +1 (+1) |
| 심판관 | 심판의 메아리 | 처치: 주변 피해 4 (+4) |
| 치유사 | 나눔의 빛 | 궁극기: 3칸 아군 치유 8 (+8) |
| 암살자 | 그림자 수확 | 처치: 궁극기 대기 -2초 (-2초) |
| 독술사 | 독의 파문 | 처치: 주변 중독 1 (+1중첩) |

Blood clot stores doubled bleed damage for that bleed's remaining duration. A whole attack/ultimate shares the five-effect budget, including sibling conditions. Weighted-offer frequency tests isolate held trait tags from worn shield tags.

Task 3 validation: missing-module red observed; TypeScript, lint and all 432 tests in 74 unit files passed.

## Commit blocker

Task 1 committed as `4b443b0`; Task 2 committed as `bf4cec6`. Task 3 passed all required checks but Git staging/commit was blocked by the filesystem sandbox: `Unable to create '/mnt/d/PROJ_R/.git/worktrees/PROJ_R-build/index.lock': Read-only file system`. A direct `git add src/sim/party/traitDefs.ts` reproduced it. The worktree metadata is outside the writable roots; approval is unavailable in this session. Task 3 remains in the working tree. Tasks 4 and 5 have not started because the requested sequence requires committing Task 3 first. No bot results or balance claims are made for the partial implementation. Nothing was pushed.

## Final validation of the partial implementation

- `npx vitest run`: 1423 passed, 3 skipped, one unrelated `roundHud` five-second import timeout; 197 files total (194 passed, two skipped, one failed), 73.06 seconds.
- `npx vitest run tests/unit/roundHud.test.ts`: both tests passed alone in 6.07 seconds. This is the rerun permitted by the plan, not a claim that the original whole-suite command exited successfully.
- Last completed Task 3 checks: TypeScript passed; lint passed including source/test file lengths; unit suite 432/432 passed.
- `git diff --check` passed; no changes under `src/sim/grid`.

## Bot table

No games were run for this incomplete build. A 60-game measurement requires completing Tasks 4–5.

| Composition | Runs | Reach 5 | General | Survives floor 3 |
|---|---:|---:|---:|---:|
| warrior/archer/cleric | 0 | unmeasured | unmeasured | unmeasured |
| warrior/mage/rogue | 0 | unmeasured | unmeasured | unmeasured |
| archer/cleric/mage | 0 | unmeasured | unmeasured | unmeasured |
