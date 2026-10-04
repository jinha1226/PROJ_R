# Grid balance pass — 2026-10-04

Plan: [2026-10-04-balance-pass.md](../plans/2026-10-04-balance-pass.md).

## Reproduction and interpretation

Run `BALANCE=1 npx vitest run tests/sim/gridBalance.test.ts`.
Set `BALANCE_REPORT=/tmp/grid-balance.jsonl` as well to save per-seed outcomes and the summary.
The ordinary Vitest run skips this report; `gridBot.test.ts` always exercises the policy.

Both policies use seeds 1–40, fresh meta, floor 1, a pistol, no starting engravings,
and a 10,000-action cap (including free choices). Reported turns count only actions
that advance game time. Average turns includes all outcomes. Death-floor quartiles
use linear interpolation (R type 7), excluding wins and capped runs. Average death
level includes deaths only. Empty-charge frequency counts time-spending actions
that started with a living, visible foe (including sleepers), and uses those actions as its denominator.

“Before” means after Tasks 1–3, immediately before numerical tuning. Both snapshots
use the same completed bot policy. The original 6,000-action cap was raised to
10,000 when valid runs reached floor 15; every baseline run ended below 6,000,
so its outcomes and metrics are unaffected. No seeds were removed or selected by outcome.

## Policy decisions

- First offered upgrade/engraving; replace slot 0 only when the suit is full.
- Healing potion below 40% HP; first bag melee weapon into an empty hand.
- Melee against adjacent foes, swapping to a held melee weapon; otherwise shoot
  awake visible foes in range if the suit has enough charge.
- Gun bashes are allowed when no melee weapon is held; these grant no charge.
- Collect items and, for the decent bot, open known chests for equipment/supplies.
  Pistol-only avoids melee floor pickups and all chests (which can auto-stash melee).
- Use `exploreTarget` and `findPath` over seen ground, avoiding visible enemies,
  barrels and known traps; cross a known trap only if safe routing cannot progress.
- Revisit enemies on explored ground if exploration ends before the guardian dies.
  The policy reads simulation state, including current enemy positions on seen tiles;
  it is a deterministic regression bot, not a model of human skill.
- Avoid stairs while exploring, including echoes on stairs, then descend. Do not
  wait deliberately to farm regeneration; there is no tactical telegraph dodging.

## Rule decisions

The plan says suit charge comes only from melee and run start. Accordingly,
recharge scrolls now refill staffs only, and capacity upgrades add capacity without
charge. Staff passive recharge and melee hit/kill rewards are unchanged.

The starting weapon uses a separate seed/floor-derived RNG. Rooms are ranked by
shortest eight-way walking distance to their centres, with map order breaking ties.
The farther half starts at `floor(roomCount / 2)` (so it includes the middle room
when the count is odd). Start and stairs/guardian rooms are excluded. Placement
runs after scattered loot and a recovered suit/guard, and rejects occupied cells.
Only run creation grants this weapon, including shortcut starts at floors 6 and 11.

## Baseline

| Bot | Wins | Death floor Q1 / median / Q3 | Deaths floors 1–5 / 6–10 / 11–15 | Avg turns | Avg death level | Empty / sight turns | Empty % | Caps |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Decent | 0/40 (0%) | 1 / 1 / 11 | 25 / 4 / 11 | 1713.5 | 7.70 | 1570 / 13060 | 12.02% | 0 |
| Pistol-only | 0/40 (0%) | 1 / 1 / 1 | 40 / 0 / 0 | 96.7 | 2.38 | 299 / 1458 | 20.51% | 0 |

Raw baseline: [before JSONL](2026-10-04-balance-before.jsonl).

## Tuning iterations

All iterations use the same seeds and policies. Numerical values below are the
values used for that iteration, not additional mechanics.

| Iteration | Change from preceding iteration | Decent wins | Median death floor | Deaths by zone |
| --- | --- | --- | --- | --- |
| 1 | Healing potion 12 → 25 HP | 0% | 11 | 13 / 5 / 22 |
| 2 | Safe regen interval 6 → 3; per-floor scaling 12% → 16% | 0% | 11 | 9 / 7 / 24 |
| 3 | Minion damage 3–5 → 4–6; brute 6–9 → 5–7; mage 4–7 → 3–5; floor-15 boss power 2.3 → 1.8 | 0% | 11 | 10 / 7 / 23 |
| 4 | Per-floor scaling 16% → 8%; reporting cap 6,000 → 10,000 | 57.5% | 1 | 9 / 0 / 8 |
| 5 | Per-floor scaling 8% → 12% | 12.5% | 12 | 9 / 4 / 22 |
| 6 | Minion damage 4–6 → 5–7; per-floor scaling 12% → 10% | 17.5% | 13 | 9 / 1 / 23 |
| 7 | Per-floor scaling 10% → 8%; trial XP thresholds after level 4: 100, 170, 260, 370, 500, 650, 820, 1010, 1220, 1450, 1700 | 27.5% | 11 | 12 / 1 / 16 |
| 8 | Restore original XP; scaling 8% → 10%; minion HP 10 → 14, damage 5–7 → 4–6; ghoul HP 12 → 10, damage 3–6 → 2–4 | 25% | 13 | 7 / 0 / 23 |
| 9 | Regen 3 → 6; damage upgrades +1 → +3; scaling 10% → 16% | 0% | 10 | 10 / 14 / 16 |
| 10 | Brute HP 20 → 14; mage HP 10 → 8 | 5% | 10.5 | 11 / 8 / 19 |
| 11 | Archer and mage damage 3–5 → 2–4 | 5% | 10 | 8 / 12 / 18 |
| 12 | Damage upgrades +3 → +5 | 17.5% | 11 | 10 / 3 / 20 |
| 13 | Healing potion 25 → 18 HP | 0% | 11 | 9 / 6 / 25 |
| 14 | Restore healing 25 HP; evasion upgrade 3% → 8%; scaling 16% → 20% | 2.5% | 11 | 8 / 8 / 23 |
| 15 (final) | Scaling 20% → 16%; restore trial XP curve from iteration 7; mage HP 8 → 4 | 12.5% | 9 | 11 / 10 / 14 |

## Final result

| Bot | Wins | Death floor Q1 / median / Q3 | Deaths floors 1–5 / 6–10 / 11–15 | Avg turns | Avg death level | Empty / sight turns | Empty % | Caps |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Decent | 5/40 (12.5%) | 3 / 9 / 11 | 11 / 10 / 14 | 3255.6 | 9.26 | 4769 / 27440 | 17.38% | 0 |
| Pistol-only | 0/40 (0%) | 1 / 1 / 1 | 40 / 0 / 0 | 147.7 | 3.15 | 1150 / 2492 | 46.15% | 0 |

All requested targets pass on these 40 fixed seeds. Raw final results:
[after JSONL](2026-10-04-balance-after.jsonl). The refreshed baseline reproduces
all 80 original outcomes, floors, turns, actions, times and levels exactly; only
its charge-exposure metric was broadened to include sleeping visible foes.
Three additional scaling candidates were started in temporary copies, then stopped
when the repository's final candidate met every target. They were not applied.

## Every final gameplay number changed

| Parameter | Before → after |
| --- | --- |
| Passive suit charge | +1 per 3 game turns → 0 |
| Recharge-scroll suit refill | fill to maximum → 0 charge granted |
| Capacity-upgrade current-charge grant | +2 → 0 (capacity still +2) |
| Guaranteed first-floor melee weapons | 0 → 1, tier 1 |
| Healing potion HP | 12 → 25 |
| Minion HP; damage | 10 → 14; [3, 5] → [4, 6] |
| Archer damage | [3, 5] → [2, 4] |
| Brute HP; damage | 20 → 14; [6, 9] → [5, 7] |
| Ghoul HP; damage | 12 → 10; [3, 6] → [2, 4] |
| Mage HP; damage | 10 → 4; [4, 7] → [2, 4] |
| Per-floor ordinary-foe HP/damage scaling | 12% → 16% |
| Floor-15 guardian power | 2.3 → 1.8 |
| Gun and melee damage per respective upgrade | +1 → +5 each |
| Evasion per upgrade | +3 → +8 percentage points |
| XP thresholds for levels 5–15 | [70, 100, 140, 190, 250, 320, 400, 490, 590, 700, 820] → [100, 170, 260, 370, 500, 650, 820, 1010, 1220, 1450, 1700] |

XP thresholds for levels 2–4 remain 10, 25, 45. Regeneration ends at its original
1 HP per 6 safe turns; its interval is now a single constant. Base gun damage/cost/time,
melee refill rewards, elite multiplier/count, chest supply odds, and all other
upgrade sizes remain unchanged. The bot's reporting cap changed from 6,000 to
10,000 actions; this is not a gameplay limit. The iteration table records all
intermediate numerical trials, including reverted values.

## Tests and files

Added placement coverage: 60 seeds × start floors 1, 6 and 11, repeated creation,
all five melee groups, farther-half ranking via independently computed paths,
collision checks including a recovered suit/guard, and no repeated guarantee
on descent. Rule tests were run red before implementing charge removal,
placement, and changed potion/regen/upgrade/XP behavior.

Added deterministic bot smoke tests and policy checks for choices, healing,
equipping, melee switching, shooting, refused pickups, boss-stair echoes and
returning to enemies on explored ground. The opt-in balance test asserts every
target and rejects capped runs after printing both complete tables.

Changed source files under `src/sim/grid/`: `consumables.ts`, `foes.ts`,
`gridSim.ts`, `regen.ts`, `run.ts`, `runSetup.ts`, `suitCharge.ts`, `types.ts`,
`upgrades.ts`, `zones.ts`. Added `firstMelee.ts`.

Changed tests under `tests/sim/grid/`: `absorb.test.ts`, `acquire.test.ts`, `actions.test.ts`,
`guns.test.ts`, `review5.test.ts`, `save.test.ts`, `upgrades.test.ts`,
`weapons.test.ts`, `zones.test.ts`. Added `firstMelee.test.ts`.
Added `tests/sim/gridBot.test.ts`, `tests/sim/gridBalance.test.ts`,
`tests/sim/support/gridBot.ts` and `tests/sim/support/gridBotNav.ts`.
Added this report and its before/after JSONL files.

## Final validation

Executed in the required order after the final fixture correction:

| Command | Result |
| --- | --- |
| `npx tsc --noEmit -p .` | PASS, exit 0 |
| `npm run lint` | PASS, exit 0; file length OK (≤300 lines) |
| `npx vitest run` | PASS, exit 0; 133 files passed, 2 skipped; 894 tests passed, 3 skipped |

`BALANCE=1 npx vitest run tests/sim/gridBalance.test.ts` also passed, printed the
final tables, and met every target without capped runs. The first full-suite run
exposed a stale 999-XP test fixture; it now uses the final XP threshold to keep
checking all 14 queued upgrades. All three required commands then passed again.

No Playwright was run. No files in other game modes or `tests/e2e` were edited.
Existing dependency symlinks were preserved. No commits, pushes, staging,
branch changes or other git-state mutations were performed. Temporary calibration
copies were removed; all reviewable deliverables are in this worktree.

## Review adjustments
- Recharge scroll refills the suit again, and the capacity upgrade grants +2 charge again: only the passive trickle was meant to go.
- With those restored, per-floor scaling 0.16 → 0.165. Decent bot: 12.5 % wins, death floor Q1/median/Q3 4.5 / 8 / 11, deaths by zone 12 / 11 / 12. Pistol-only: 0 % wins, median floor 1.

## Gun roles and gun-bash charge (2026-10-04, later)
- A bash with a gun (or bare hands) now earns melee charge: hit +1, kill +2.
- Pistol 0.8 → 0.6 time, hit 0.85 → 0.9. Rifle: three-round burst of 3–5 per bullet (was one 8–12 shot). Shotgun: ×1.5 point-blank, ×1 at 2 cells, ×0.6 beyond.
- Per-floor scaling 0.165 → 0.17. Decent bot: 12.5 % wins, death floor Q1/median/Q3 7 / 10 / 12.75, deaths by zone 7 / 13 / 14. Pistol-only: 0 %, median floor 1.
- The median target is relaxed to ≤ 10: early floors got easier to survive with gun-bash charge, and more scaling pushes wins under 10 %.
