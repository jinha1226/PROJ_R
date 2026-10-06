# Delve loot: headless balance results

## Reproduction and denominators

Run from the repository root:

```sh
npx vitest run -c tests/bot/vitest.bot.config.ts tests/bot/delveBot.bot.ts --silent=false
```

The default is seeds 1–20 for each of warrior/archer/cleric, warrior/mage/rogue, and archer/cleric/mage (60 runs). `DELVE_BOT_SEEDS=1` is an optional diagnostic subset, never the final measurement. Each run prints a JSON record; the final line summarizes all runs. Three persistent Node workers each load the unchanged simulation through Vite SSR; runs have isolated state and their results are sorted before aggregation. Worker scheduling never feeds simulation RNG. Assertions concern exceptions and recognized termination only, never balance targets.

Three level-1 clones start with ordinary starter gear and two shared potions. The initial body uses `implant`; the other two use `print`. A 75-bio allowance pays 25 for each initial body and leaves zero bio. `printHere` remains false; there are no replacements, trait picks, promotions, implants after initialization, extra healing, or combat orders. `manual` remains unset. The real scheduler advances by 0.5 game seconds; each individual action still resolves through production simulation.

Every half-second the policy drinks below 30% HP and equips compatible strict rarity upgrades. Trinkets have no rarity: an eligible trinket fills the first empty slot, never replaces an occupied slot. Out of combat, the nearest reachable known actionable chest, ore, shrine, soul, or floor item wins; ties follow that order. Full-pack chests/items are skipped. Otherwise it explores the nearest unseen walkable frontier, then gathers at stairs. Reachability uses the walking graph with occupied clone cells blocked and discovered traps avoided, with the game's unsafe fallback if necessary. Cached BFS results supply adjacent `orderTo` waypoints. These are real movement orders, not teleportation.

Stairs need all living clones within one tile; ordinary follow behavior stops at two. The bot batches normal `orderTo` gathering orders toward distinct adjacent slots, preserving each order because `orderTo` clears previous party orders. Arrived clones receive stay orders. This narrow gathering adaptation avoids leadership-switch oscillation while preserving movement costs and collision rules.

Runs stop on a wipe, general death, floor-5 completion, or 3,600 total game seconds. Floor reached is the deepest entered floor. Reach percentages and mean clones lost use all runs as denominator. Floor loot/time means use only runs that visited that floor, including partial floors from deaths/timeouts. Items mean newly acquired items, excluding starter IDs and recovered clone gear; uncollected floor drops are excluded. Stopping immediately at general death means its two rare floor drops are usually uncollected and therefore absent from these item counts; its three crystal reward is counted immediately. Common/fine/rare exclude trinkets, which have their own column. Materials sum actual acquisition events, including enemy bio and chest bio, rather than subtracting the initial allowance from a final balance. Time is simulated seconds, not wall time. `idleSeconds` is time since the last movement, hit, death, loot, pickup, or chest opening; a moving loop can still time out with zero idle time.

## Test-first record and earlier task rulings

The bot assertion was written first and run before the helper existed: Vitest failed to import `./delveBotRun`. Helpers were then implemented. Initial diagnostics caught starting-companion waypoint blocking, unsafe-path fallback needs, and stair-gathering oscillation; those were bot-only fixes before the baseline.

- Task 1: the distributive `ItemDraft` helper fixes `Omit` over a union; seven supplied assertions stayed unchanged. Gear changes clamp HP, while level changes retain their health-gap rule. Optional arena gear preserves the party demo. Targeted count: 67.
- Task 2: map-dependent fixture positions, awake state, and foe count were updated without weakening assertions. Targeted count: 74.
- Task 3: numeric `ore` is distinct from `oreNodes`; the minimal warlord definition moved earlier for the boss-gate test. A real entry-trap fixture replaced a non-entry setup. Ordinary soul assertions exclude crypt heroes. Carry preserves named identity; a minimal `pipWindow` adapter compiles it. `expedition.down` resets `foundHeroes` each trip. Targeted count: 99.
- Task 4: supplied AI fixtures keep targets awake/in range and a hero alive so they actually observe the specified behavior. Targeted count: 106.
- Full-spec and quality reviews for Tasks 1–4 completed before Task 5.

## Baseline and numeric tuning

The original-numbers baseline was stopped after 11 completed warrior/archer/cleric runs (seeds 1–11) to avoid repeating long combat stalls during tuning. This is a diagnostic baseline, **not a comparable 60-run before/after experiment**. Its raw records are in `2026-10-06-delve-loot-baseline.jsonl`. It used the same movement policy; the later collector additionally ensures one-to-one exclusion when multiple dead clones recreate the same trinket base in one tick.

Three balanced diagnostic samples used seeds 1–2 for all three compositions (six runs each). Raw records are `2026-10-06-delve-loot-tuning1.jsonl`, `2026-10-06-delve-loot-tuning2.jsonl`, and `2026-10-06-delve-loot-tuning3.jsonl`.

| Sample | N | Mean floor | Reach 3 | General kills | Timeouts |
|---|---:|---:|---:|---:|---:|
| Original numbers, WAC only | 11 | 3.82 | 90.91% | 0% | 9 |
| Loot tuning, balanced sample | 6 | 1.83 | 33.33% | 0% | 4 |
| Loot + damage tuning, balanced sample | 6 | 2.00 | 33.33% | 0% | 4 |
| Loot + damage tuning, full sample | 60 | 2.73 | 45.00% | 1.67% | 34 |
| Extra HP + shrines, diagnostic | 6 | 2.17 | 33.33% | 0% | 5 |

Changing chest locations/loot RNG consumption also changes exploration and combat trajectories; these samples do not isolate individual causal effects. Loot tuning brought first-floor acquired items from roughly 5–7 in initial baseline examples toward 2–3. Damage tuning helped the sampled warrior/mage/rogue composition reach floor 2 in both runs (previously floors 1 and 2), but did not remove combat stalls.

The first full 60-run candidate reached floor 3 in 45% and killed the general in 1.67%, missing both progression targets. Floors 1–3 averaged 3.10/2.45/2.89 acquired items and 13.75/11.22/11.67 ore. Its raw records are `2026-10-06-delve-loot-candidate2.jsonl`. A further attrition trial increased warrior/mage/rogue HP and shrine chance. In its six-run sample, warrior/mage/rogue mean floor improved 2.0 → 2.5 and overall clones lost fell 1.0 → 0.83, though overall reach-3 stayed 33.33%. The trial used warrior HP 85; final HP is 80 to retain a positive 5-HP berserker promotion gain. Thus the final full run, not the six-run trial, measures the final numbers.

Every production numeric change, relative to the Task-4 commit:

| File / field | Old | Final | Intent |
|---|---|---|---|
| `delveGen.ts`: normal-room chest chance | 0.25 | 0.08 | Reduce incidental loot |
| `delveRooms.ts`: ore-node `rng.int` bounds | 3, 5 | 2, 2 | Reduce ore supply |
| `delveRooms.ts`: elite item-drop chance | 0.60 | 0.15 | Reduce excess fine gear |
| `delveRooms.ts`: tier-2 chest ore bounds | 2, 4 | 1, 2 | Reduce ore supply |
| `partyDefs.ts`: goblin damage bounds | 3, 5 | 2, 4 | Lower attrition |
| `partyDefs.ts`: archer foe damage bounds | 3, 5 | 2, 4 | Lower ranged attrition |
| `partyDefs.ts`: brute damage bounds | 7, 10 | 6, 9 | Lower deep-floor attrition |
| `partyDefs.ts`: shaman damage bounds | 4, 6 | 3, 5 | Lower deep-floor attrition |
| `partyDefs.ts`: warrior HP | 70 | 80 | Lower front-line attrition; trial was 85 |
| `partyDefs.ts`: mage HP | 34 | 45 | Lower caster attrition |
| `partyDefs.ts`: rogue HP | 42 | 55 | Lower melee attrition |
| `delveGen.ts`: shrine chance | 0.50 | 0.80 | More opportunities for ordinary floor healing |

The temporary trial warrior HP 85 was reduced to 80 before the final measurement. No other production values or logic changed. The reinforcement scaling fixture's exact damage expectation changed `[5, 8] → [3, 6]`, matching rounding of the new goblin damage at scale 1.6; the assertion remains exact. The arena promotion fixture changes wounded HP `35 → 25`, because warrior 80 → berserker 85 adds 5 rather than 15. No assertions were removed or made less strict. These shared foe numbers also affect the party arena and other consumers of `FOES`; grid simulation files are unchanged.

## Final 60 runs

The exact command above passed all 60 runs on the final numbers in 275.29 wall seconds. Raw reproducible records: `2026-10-06-delve-loot-final.jsonl`. No run threw. The same six candidate-2 seeds reproduced byte-for-byte equivalent parsed run records in the diagnostic and full run, confirming scheduling-independent results for that sample.

| Composition | Runs | Mean floor | Reach 3 | Reach 5 | General killed | Mean clones lost | Timeouts |
|---|---:|---:|---:|---:|---:|---:|---:|
| All | 60 | 2.88 | 58.33% | 18.33% | 3.33% | 1.13 | 41 |
| warrior/archer/cleric | 20 | 3.50 | 75.00% | 40.00% | 10.00% | 0.65 | 16 |
| warrior/mage/rogue | 20 | 2.55 | 55.00% | 0.00% | 0.00% | 2.70 | 5 |
| archer/cleric/mage | 20 | 2.60 | 45.00% | 15.00% | 0.00% | 0.05 | 20 |

Per visited floor, including partial visits:

| Floor | Visits | Common | Fine | Rare | Trinkets | Total items | Ore | Crystal | Bio | Game seconds |
|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| 1 | 60 | 0.57 | 1.30 | 0.98 | 0.40 | 3.25 | 13.73 | 1.40 | 95.68 | 1085.19 |
| 2 | 49 | 0.61 | 0.94 | 1.00 | 0.22 | 2.78 | 11.61 | 1.18 | 85.78 | 1033.55 |
| 3 | 35 | 0.26 | 1.00 | 0.86 | 0.37 | 2.49 | 12.14 | 1.17 | 95.71 | 973.59 |
| 4 | 18 | 0.50 | 1.00 | 1.06 | 0.28 | 2.83 | 9.83 | 1.17 | 129.22 | 989.17 |
| 5 | 11 | 0.18 | 0.45 | 0.27 | 0.09 | 1.00 | 5.55 | 0.91 | 87.64 | 722.00 |

### Targets and limitations

- Reach floor 3: **35/60 = 58.33%**, below the 60% target by one run. This improved from 27/60 (45%) in candidate 2.
- Kill the general: **2/60 = 3.33%**, below the 10–30% target. Both wins used warrior/archer/cleric (10% within that composition). This improved from one win in candidate 2.
- Floors 1–3 acquired items: **3.25 / 2.78 / 2.49**. Floors 2–3 meet the approximate 2–3 target; floor 1 remains slightly high. Ore **13.73 / 11.61 / 12.14** is within the 8–15 target on all three floors.
- There were **17 wipes, 41 timeouts, and 2 general kills**. Of the timeouts, 40 ended in combat and 40 had at least 60 seconds without tracked activity. All archer/cleric/mage runs timed out despite losing only one clone across the composition; survival is not the only progression limit.
- Existing roaming combat remains active at distance 12 while `targetOf` ignores roaming targets beyond distance 10. Parties and enemies separated by 11–12 tiles can therefore remain in combat without taking useful actions. Geometry, occupied paths, and separated party members may also contribute; the aggregate log does not diagnose every timeout. Numeric tuning cannot reliably remove this behavior, and Task 5 forbids production AI logic changes.
- Higher survival shifted some wipes into stalls (timeouts 34 → 41); it did not establish a balanced general fight. This first tuning pass leaves the progression targets unmet. A subsequent AI/pathing fix and another complete 60-run measurement are needed before evaluating deeper-floor combat balance confidently.
- The policy uses no potion replenishment, discretionary retreat, trait selection, promotion, or tactical combat commands. Its performance describes this simple autoplay policy, not skilled player success. Full packs may suppress later acquired loot, and the immediate boss stop suppresses boss-drop collection.


## Validation

- Test-first missing-helper failure observed before implementation.
- `npx tsc --noEmit -p .`: passed.
- `npm run lint`: passed, including the 400-line limit.
- Targeted delve/party/surface/overworld suite: 106 tests passed after the documented numeric fixture update.
- Whole `npx vitest run` on final numbers: 1391 passed, 3 skipped (1394), 84.29 seconds.
- Final bot run: 60 passed, 275.29 seconds.

## Rerun after the stall fix (Claude, 2026-10-06)

Fix (production AI, outside Task 5's numeric scope): one engage distance `ENGAGE = 10` for both "in a fight" (`roamStep`) and roaming targets (`targetOf`), and a clone in a fight with nothing in reach now closes on the nearest awake foe or keeps up with the leader instead of standing still.

| Composition | Runs | Mean floor | Reach 3 | Reach 5 | General killed | Wipes | Timeouts |
|---|---:|---:|---:|---:|---:|---:|---:|
| Warrior/archer/cleric | 20 | 4.75 | 100% | 85% | 40% | 10 | 2 |
| Warrior/mage/rogue | 20 | 2.75 | 75% | 0% | 0% | 20 | 0 |
| Archer/cleric/mage | 20 | 4.70 | 100% | 80% | 50% | 7 | 3 |
| **Overall** | 60 | **4.07** | **92%** | **55%** | **30%** | 37 | **5** |

Timeouts fell from 41 to 5. The party without a healer (warrior/mage/rogue) wipes every run — a balance item for the trigger-trait redesign (sustain without a cleric).


## Trigger-build rerun: Tasks 4–5 (2026-10-06)

The three-slot fixed catalog replaces random rarities; shared-pack consumables, trigger traits and ultimates are included. The bot equips strict upgrades by the item's minimum appearance floor, keeps weapons within proficiency, sacrifices exact-definition duplicates and picks the first offered trait. It queues `aiUltimate` decisions; potion/bomb use occurs through the production companion AI with the actual action cost. It does not promote automatically or prefer keystones. Bombs affect allies; the AI avoids clusters containing a living ally. Movement/exploration/gathering policy and the 3,600-game-second stop remain as above.

Reproduce the complete measurement (use a fresh output filename; streaming appends):

```sh
DELVE_BOT_WORKERS=6 DELVE_BOT_OUTPUT=/tmp/trigger-builds-rerun.jsonl npx vitest run --config tests/bot/vitest.bot.config.ts --maxConcurrency=12 tests/bot/delveBot.bot.ts
```

Seeds 1–20 × three compositions: **60/60 passed**, 569.78 wall seconds. Raw records: [final JSONL](../reports/2026-10-06-trigger-builds-final.jsonl). All six seeds from the last diagnostic pilot reproduced exactly in the full run. [Task report](../reports/2026-10-06-trigger-builds.md) records the historical baseline, every numerical trial, exact old→new values and rulings. Task 5 production changes are only foe HP/damage numbers; no production AI, item or trait logic changed. Shared foe definitions also affect the party arena; the grid game is unchanged.

Reach 3 means entering floor 3; **survives floor 3 means entering floor 4**, even if a later wipe occurs. All percentage denominators are all runs within their composition. Floor loot means use only runs that visited that floor, including partial visits.

| Composition | Runs | Mean floor | Reach 3 | Survives floor 3 | Reach 5 | General killed | Mean clones lost | Wipes | Timeouts |
|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| All | 60 | 4.28 | 93.33% | 75.00% | 63.33% | 31.67% | 1.90 | 28 | 13 |
| warrior/archer/cleric | 20 | 4.80 | 100.00% | 90.00% | 90.00% | 70.00% | 1.40 | 3 | 3 |
| warrior/mage/rogue | 20 | 3.95 | 90.00% | 60.00% | 45.00% | 0.00% | 2.65 | 17 | 3 |
| archer/cleric/mage | 20 | 4.10 | 90.00% | 75.00% | 55.00% | 25.00% | 1.65 | 8 | 7 |

Per visited floor, including partial visits:

| Floor | Visits | Common¹ | Fine¹ | Rare¹ | Accessories | Consumables | Total items | Ore | Crystal | Bio | Game seconds |
|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| 1 | 60 | 2.27 | 0.00 | 0.00 | 1.10 | 4.00 | 7.37 | 14.03 | 1.47 | 99.65 | 629.11 |
| 2 | 58 | 0.86 | 1.41 | 0.00 | 1.10 | 3.76 | 7.14 | 14.00 | 1.55 | 100.81 | 683.14 |
| 3 | 56 | 0.27 | 1.45 | 0.00 | 0.91 | 3.91 | 6.54 | 13.34 | 1.05 | 124.88 | 696.65 |
| 4 | 45 | 0.20 | 0.53 | 0.71 | 0.60 | 2.89 | 4.93 | 12.27 | 0.67 | 158.00 | 683.88 |
| 5 | 38 | 0.05 | 0.26 | 0.29 | 0.32 | 1.21 | 2.13 | 7.24 | 1.71 | 152.37 | 520.36 |


¹ Common/Fine/Rare are compatibility columns for fixed catalog gear with minimum appearance floor 1 / 2–3 / 4–5; they are no longer random rarities. Accessories and consumables have separate columns. Total items includes both. Starter items and recovered clone gear are excluded; immediate general termination still excludes uncollected boss drops.

Targets met: **38/60 = 63.33% reach 5** (target 50–65%), **19/60 = 31.67% general** (25–40%), and the no-healer warrior/mage/rogue party **18/20 = 90% reach 3** (≥50%). That party survives floor 3 in **12/20 = 60%**. There are 28 wipes and 13 timeouts. No-healer parties still kill no generals; this simple first-card policy measures progression, not skilled play or optimized builds. The 60-game sample does not establish a universal success rate. The earlier 60-game baseline used enemy-only bombs and is not a controlled causal comparison.

Validation: TypeScript and lint passed; 448/448 unit tests passed. Exact whole-suite `npx vitest run`: 1,439 passed, 3 skipped, one unrelated `roundHud` import timeout; both tests in that file passed alone. This is the plan's allowed timeout rerun, not a successful exit from the original whole-suite command.
