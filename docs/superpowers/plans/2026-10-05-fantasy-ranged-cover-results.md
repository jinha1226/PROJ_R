# Fantasy ranged weapons and cover: implementation results

Implemented Task 1, Task 2, Task 3, then Final in the existing worktree. No commit or push.

## Verification

Each task used failing regression tests before implementation. Task 1: initial eight new tests failed, then the thrift regression failed before its fix. Task 2: nine new cases failed; the existing tile predicates already passed the tenth. Task 3: resource/pickup tests and subsequent sleeping-foe, naive-pickup, movement-cycle and barrel-obstruction regressions failed before their fixes.

All three required commands (`npx tsc --noEmit`, `npm run lint`, `npm test`) passed after each task:

| Stage | Passed tests | Skipped tests |
|---|---:|---:|
| Task 1 | 1297 | 3 |
| Task 2 | 1307 | 3 |
| Task 3 | 1318 | 3 |

Final validation is recorded in the final response. The implementation uses seeded RNG only; lint enforces the 400-line limit. The original plan is unchanged.

## UI/view touches (compile compatibility only)

- `src/view/grid/weaponMeshes.ts`: retain `pistol` in the visual-only `WeaponLook` union, so existing model and stance branches compile.
- `src/ui/grid/kataScenes.ts`: change the typed shooting event group from `pistol` to `bow`.
- `src/ui/grid/weaponInfo.ts`: replace the exhaustive weapon-note map's pistol entry with bow/staff entries.
- `src/ui/grid/ship/panelContents.ts`: add the bow label required by the widened launch-options type, retaining the old pistol label.

## Calls where the plan was unclear

1. Retained `isGun`, `gunCost`, `gunInHand`, gun event/engraving IDs, `GUNS`/`GUN_COST`, and a legacy `GunGroup` input type to limit churn. Their gameplay behavior covers bow and staff; actual `WeaponGroup` excludes pistol. Existing workbench part IDs and visual pistol references stay compatible.
2. Migrated legacy rifle/shotgun as well as pistol to tier-one bows in hands, bags and floor loot. Preserved existing staff saves instead of the previous removal behavior. Missing arrows default to 24; existing values and meta data are preserved. Old staffs without an element remain valid; newly found staffs roll one.
3. Every bow projectile, including pierce, extra, spin, execute and barrel shots, spends one arrow. Staff base cost is two mana; existing explicit engraving/perk discounts remain (including free pierce/double-tap and one-mana barrage). Thrift refunds a bow arrow; other charge rewards remain mana rewards.
4. Staff elements override imbued-round elements while still advancing the existing shared round index and echo cadence. Offhand special shots pass their weapon explicitly. Mana retains fractional time, cannot bank time at full capacity, and does not regenerate a dead hero.
5. Kept existing equipment tier probabilities. Arrow bundles replace 30% of ordinary floor-consumable slots and occupy one equally weighted chest-supply option. Chest bundles remain on the chest cell for pickup. Excess pickup arrows remain on the floor. A barrel shot uses the hit recovery probability.
6. Cover quota uses room floor cells, rounds 4% up and 10% down, and caps at six. Prefer inner cells, try runs of one to three, and retry shorter prefixes after a disconnected run is undone. Converted cover cells are excluded from the reachability comparison. Previously sealed tool rooms remain intentionally inaccessible. Spawn cells and tool approaches receive additional protection; doorway adjacency includes diagonals.
7. Archers/mages may proactively leave an open shooting cell for covered shooting positions. Half and full cover receive equal movement preference, preserving existing distance/DIRS tie order. Pending mage spells resolve first. Existing walkability/opacity predicates already implement the new tile semantics, so `fov.ts` needed no edit.
8. Bots collect visible, reachable arrows within the existing twelve-step loot radius when no threat is awake, and skip them at a full quiver. Mana waits and recharge-scroll decisions apply to staffs only.
9. Updated the support simulation bot's resource readiness during Task 1 so its mandatory checks remained meaningful. In Task 3, reused movement-cycle recovery for the naive policy after seed 1000 stalled, and added last-resort routes through destructible obstacles only after safe routes failed, following the seed 1133 campaign stall.
10. Added assertions against stuck/timeouts to the previously report-only bot suite and optional `BOT_REPORT` output so passing-run summaries can be retained. Kept five standalone seeds per policy/mode and both existing thirty-run campaigns unchanged.
11. Increased timeouts to thirty seconds for three existing 200-map seed sweeps because cover now requires connectivity BFS checks. Kept their samples/assertions. Normalized cover to floor in the old layout snapshot to preserve its original purpose. Used a static round-HUD test import to avoid an import-only timeout under suite load. Updated old resource/damage/timing expectations and descriptions; removed redundant legacy launch-option fixture edits in Final.
12. Restricted UI/view edits to the four compiler-required changes above. Added this report for the complete file inventory and decision record; no visual/HUD feature work was performed.

## Bot summary

Command: `BOT_REPORT=/tmp/fantasy-final-bot-summary.log SEEDS=5 npx vitest run -c tests/bot/vitest.bot.config.ts --silent=false`

Result: 7 test files passed, 8 tests passed. All 80 reported standalone/campaign runs completed without stuck runs or timeouts.

```text
SUMMARY naive god: runs 5, won 5, returned 0, dead 0, safe 5, avg floor 15.00, best 15, stuck 0, timeout 0, stones found/socketed/banked 23/21/16, portals 0
SUMMARY smart god: runs 5, won 5, returned 0, dead 0, safe 5, avg floor 15.00, best 15, stuck 0, timeout 0, stones found/socketed/banked 72/46/64, portals 0
SUMMARY naive real: runs 5, won 0, returned 0, dead 5, safe 0, avg floor 1.60, best 3, stuck 0, timeout 0, stones found/socketed/banked 1/1/0, portals 0
SUMMARY smart real: runs 5, won 2, returned 0, dead 3, safe 2, avg floor 12.40, best 15, stuck 0, timeout 0, stones found/socketed/banked 55/33/30, portals 0
SUMMARY campaign always-1: runs 30, won 9, returned 2, dead 19, safe 11, avg floor 13.20, best 15, stuck 0, timeout 0, stones found/socketed/banked 579/75/321, portals 2, first win 3, last 10 avg floor 14.00
SUMMARY campaign deepest: runs 30, won 1, returned 2, dead 27, safe 3, avg floor 11.83, best 15, stuck 0, timeout 0, stones found/socketed/banked 79/24/23, portals 2, first win 3, last 10 avg floor 12.00
```

## Changed files

- `docs/superpowers/plans/2026-10-05-fantasy-ranged-cover-results.md`
- `src/sim/grid/actions.ts`
- `src/sim/grid/ai.ts`
- `src/sim/grid/combat.ts`
- `src/sim/grid/consumables.ts`
- `src/sim/grid/engraveCore.ts`
- `src/sim/grid/gear.ts`
- `src/sim/grid/gridSim.ts`
- `src/sim/grid/items.ts`
- `src/sim/grid/kataEffects.ts`
- `src/sim/grid/kataTargets.ts`
- `src/sim/grid/mapCover.ts`
- `src/sim/grid/mapgen.ts`
- `src/sim/grid/rangedResources.ts`
- `src/sim/grid/regen.ts`
- `src/sim/grid/rounds.ts`
- `src/sim/grid/runSetup.ts`
- `src/sim/grid/saveMigration.ts`
- `src/sim/grid/shotCombos.ts`
- `src/sim/grid/state.ts`
- `src/sim/grid/suitCharge.ts`
- `src/sim/grid/types.ts`
- `src/sim/grid/weapons.ts`
- `src/sim/grid/workbench.ts`
- `src/ui/grid/kataScenes.ts`
- `src/ui/grid/ship/panelContents.ts`
- `src/ui/grid/weaponInfo.ts`
- `src/view/grid/weaponMeshes.ts`
- `tests/bot/brain/campaign.ts`
- `tests/bot/brain/items.ts`
- `tests/bot/brain/policy.ts`
- `tests/bot/brain/tactics.ts`
- `tests/bot/brain/view.ts`
- `tests/bot/fullRun.bot.ts`
- `tests/bot/runBot.ts`
- `tests/sim/grid/absorb.test.ts`
- `tests/sim/grid/acquire.test.ts`
- `tests/sim/grid/actions.test.ts`
- `tests/sim/grid/ai.test.ts`
- `tests/sim/grid/elements.test.ts`
- `tests/sim/grid/engrave.test.ts`
- `tests/sim/grid/engraveCatalog.test.ts`
- `tests/sim/grid/engraveSetEdges.test.ts`
- `tests/sim/grid/engraveSetFusion.test.ts`
- `tests/sim/grid/engraveSetRanged.test.ts`
- `tests/sim/grid/fantasyCover.test.ts`
- `tests/sim/grid/fantasyRanged.test.ts`
- `tests/sim/grid/gear.test.ts`
- `tests/sim/grid/gunRoles.test.ts`
- `tests/sim/grid/guns.test.ts`
- `tests/sim/grid/kata.test.ts`
- `tests/sim/grid/kataBus.test.ts`
- `tests/sim/grid/kataEdges.test.ts`
- `tests/sim/grid/kataEffects.test.ts`
- `tests/sim/grid/kataTriggers.test.ts`
- `tests/sim/grid/lore.test.ts`
- `tests/sim/grid/meta.test.ts`
- `tests/sim/grid/mods.test.ts`
- `tests/sim/grid/perks.test.ts`
- `tests/sim/grid/resonance.test.ts`
- `tests/sim/grid/review.test.ts`
- `tests/sim/grid/review3.test.ts`
- `tests/sim/grid/review4.test.ts`
- `tests/sim/grid/review5.test.ts`
- `tests/sim/grid/roundEdges.test.ts`
- `tests/sim/grid/rounds.test.ts`
- `tests/sim/grid/run.test.ts`
- `tests/sim/grid/startKit.test.ts`
- `tests/sim/grid/stoneEdges.test.ts`
- `tests/sim/grid/suit.test.ts`
- `tests/sim/grid/toolSpots.test.ts`
- `tests/sim/grid/upgrades.test.ts`
- `tests/sim/grid/weaponMigration.test.ts`
- `tests/sim/grid/weapons.test.ts`
- `tests/sim/grid/workbench.test.ts`
- `tests/sim/grid/zones.test.ts`
- `tests/sim/gridBot.test.ts`
- `tests/sim/support/gridBot.ts`
- `tests/unit/attackChoice.test.ts`
- `tests/unit/fantasyBot.test.ts`
- `tests/unit/gridHudLayout.test.ts`
- `tests/unit/gridRun.test.ts`
- `tests/unit/gridSmallFixes.test.ts`
- `tests/unit/heroLook.test.ts`
- `tests/unit/mouseAim.test.ts`
- `tests/unit/roundHud.test.ts`
- `tests/unit/shipFlow.test.ts`
- `tests/unit/strikeStyle.test.ts`
