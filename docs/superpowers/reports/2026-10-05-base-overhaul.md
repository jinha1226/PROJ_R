# Base overhaul — Tasks 1–5 implementation report

Implemented internal simulation/meta changes. No new screens or workbench UI wiring.
The sim model is structurally checked against `src/ui/grid/ship/workbenchTypes.ts`.
No balance tables were adjusted. No staging, commits, pushes, dependency installs, or symlink replacements.
`tests/e2e` was not edited.

## Decisions and adaptations

1. Elite and champion deaths call the current `absorbOffer` directly. This preserves locked-base priority, family pools, equipped-engraving exclusion, and optional element-round cards. Empty offers are skipped; remains still drop. The existing `absorb` event now means an immediate offer.
2. Removed the runtime Echo floor-item type, pickup path, and renderer branch. Loading old echo items discards them, including legacy family names. The engraving named `echo` remains unchanged.
3. Ordinary kills alone roll the zone-material probability. Elites/champions instead guarantee 1/3 remains. Catch-up uses the run-start stock snapshot, not materials collected during that run; the optional base argument allows the cap to be tested.
4. The two ordinary floor material stacks contain one unit each. Existing potion/scroll counts and their seeded selection are preserved. Tool-room rewards are additional stacks of 3–4.
5. Chest material stacks of 2–3 go directly into run inventory when the chest opens, like its existing supplies. Opening it again cannot duplicate the award.
6. Settlement halves each material independently on death, rounding the kept portion down. Won or otherwise alive settlement keeps all. The existing application abandon action already classifies abandonment as death; it retains that behavior.
7. A death with materials but no engravings still leaves a recoverable suit. A new nonempty death suit replaces the older suit, preserving the existing single-suit rule. A death with neither engravings nor lost materials preserves the older suit.
8. Recovered suit materials are returned in full during settlement, even if the recovery run ends in death. Newly collected materials still follow that run's outcome. The run's copied `leftSuit` is the recovery source, with a meta-suit fallback for older saves.
9. Winning by picking up the final guardian's core sets `coreSecured`; killing the guardian alone does not. Repairing the ship core sets `departed`. Historical win counts do not fabricate a newly secured core during migration.
10. Suit slots, charge upgrades, and engraving purchases require `suitlab`; navigation purchases require `nav`; permanent round purchases require `workbench`. In-run element-round offers retain the merged engine's rules.
11. Legacy repair inference runs only when the repairs field is absent. Purchased rounds or former armory flags grant workbench; improved suit slots/charge or additional permanent engravings grant suitlab. Existing shortcuts grant nav and its workbench prerequisite, preserving navigation progress.
12. Loaded tools are derived from repaired systems. Material counts default to zero and normalize to finite nonnegative integers. Saved mods retain known owned IDs and fitted IDs that match their slots. Legacy runs default materials/stock to zero and tools to none; resumed runs never reapply mods.
13. The existing armory station maps to the workbench repair. Suitlab/nav/core use their corresponding repairs. Pod/records/hatch remain powered regardless of repair state. No station or screen was added.
14. Optional rooms are 3×3, the lower size allowed by the plan. They are stored separately from ordinary `map.rooms`, keeping existing room groups, spawns, and suit placement intact. Each gate kind is attempted once; a floor may omit a kind if no safe placement exists.
15. Generation carves only solid rock with an intact wall border and one entrance. A flood fill checks every previously reachable cell and verifies that the reward stays inaccessible without its tool. A separate seeded map stream preserves existing floor generation. Optional chests use a fixed 50% roll; no balance search/tuning was performed.
16. Cutter use from an orthogonal neighbor changes seal to closed door for the existing door-opening cost; the next step opens and traverses it. Grapple crosses one orthogonal chasm cell for one normal movement cost, in either direction. Diagonal crossings and obstructed landings are refused. Root still prevents movement.
17. Grapple landings run normal pickup, trap/status, noise, and subsequent simulation processing. Scanner converts visible marked walls into closed doors during sight refresh, including at run start. Ordinary pathfinding continues treating unopened tool gates as blocked.
18. Teleports only choose cells connected to the floor start by ordinary walkable tiles. This prevents a tool-less hero from being stranded in a sealed, hidden, or chasm room. Opened seal/hidden rooms become eligible normally.
19. Blocked tool actions retain their `seal`/`chasm` event reason instead of the simulator replacing it with a generic blocked event. Existing HUD text uses terse Korean labels.
20. All 12 mod definitions use the plan's exact costs and stats, with no extra per-mod repair prerequisites. Crafting is one-time ownership and requires workbench; fitting requires ownership and a matching slot; null unfits. Fitting itself needs no extra repair gate.
21. Run-start mods add HP/charge/shield and existing combat bonuses once. Hit, shot noise, and swap adjustments are saved in `hero.modStats` and read by real attacks and shot-chance reporting. Noise applies to pistol shots, including barrel shots, not footsteps. Quick grip changes swap time additively by −0.25 while retaining free quickswap and positive swapstrike behavior. No listed mod changes movement speed.
22. Workbench stats describe a level-one pistol/suit baseline: average damage 5, base hit 0.9, charge including existing ship upgrades, shot noise 4, HP 35, starting evasion 0.1, shield 0. Preview replaces a slot (or removes it), then sums all fitted modifiers. The damage label is `피해`, as in the plan.
23. The workbench model is a detached snapshot. Returned materials and definitions cannot mutate meta or the shared catalog; previews do not spend, fit, or change ownership. Owned mods are not craftable again; missing costs report material deficits even while the workbench is locked.
24. Existing panel changes only align purchase availability and text with the new sim rules. Existing item rendering uses its generic mesh for materials. Workbench UI files remain untouched and still await the separate integration.
25. Existing unit tests that assumed echo pickups, purchase availability before repair, or consumables-only floor loot were updated to the new contract. Original-floor snapshot tests strip the newly added rooms before comparing, retaining the original-layout regression check.

## Validation

New feature tests were added and run failing before implementation; additional regressions exposed teleport stranding and legacy armory migration before their fixes.
Coverage includes 50 seeds across floors 1, 6, 11, and 15; actual tool movement; blocked landings; RNG-controlled drops; death/recovery; core and shop gating; save/load round trips; actual mod combat hooks; and pure model previews.

Final validation:

- `npx tsc --noEmit -p .` — passed (exit 0).
- `npm run lint` — passed (exit 0), including the 300-line file limit.
- `npx vitest run` — passed (exit 0): 165 files passed, 2 skipped; 1,168 tests passed, 3 skipped.
- `git diff --check` — passed; index and `tests/e2e` remain unchanged.

## E2E updates needed (not edited or run)

- `tests/e2e/grid.spec.ts:94` — “engravings: absorb an echo onto the suit, pick a suit upgrade on level-up, a dash fires, a full suit asks which slot”: replace the injected echo pickup with an elite kill and assert the immediate offer/remains.
- `tests/e2e/grid.spec.ts:198` — “the ship deck: bump the armory, unlock fire rounds with energy, it is saved and can be picked to launch with”: seed a repaired workbench (or repair it when that UI is integrated) before purchasing rounds.

## Changed files

New simulation modules:

- `src/sim/grid/baseMigration.ts`
- `src/sim/grid/materials.ts`
- `src/sim/grid/mods.ts`
- `src/sim/grid/repairs.ts`
- `src/sim/grid/toolActions.ts`
- `src/sim/grid/toolSpots.ts`
- `src/sim/grid/workbench.ts`

Modified simulation/save modules:

- `src/app/gridMeta.ts`
- `src/sim/grid/actions.ts`
- `src/sim/grid/combos.ts`
- `src/sim/grid/consumables.ts`
- `src/sim/grid/gridSim.ts`
- `src/sim/grid/items.ts`
- `src/sim/grid/mapgen.ts`
- `src/sim/grid/meta.ts`
- `src/sim/grid/run.ts`
- `src/sim/grid/runSetup.ts`
- `src/sim/grid/save.ts`
- `src/sim/grid/saveMigration.ts`
- `src/sim/grid/state.ts`
- `src/sim/grid/traps.ts`
- `src/sim/grid/types.ts`
- `src/sim/grid/weapons.ts`

Existing UI/view compatibility:

- `src/ui/grid/gridHud.ts`
- `src/ui/grid/ship/panelContents.ts`
- `src/view/grid/gridItems.ts`
- `src/view/grid/stationLit.ts`

New tests:

- `tests/sim/grid/materials.test.ts`
- `tests/sim/grid/mods.test.ts`
- `tests/sim/grid/repairs.test.ts`
- `tests/sim/grid/toolSpots.test.ts`
- `tests/sim/grid/workbench.test.ts`

Updated tests:

- `tests/sim/grid/absorb.test.ts`
- `tests/sim/grid/deathSuit.test.ts`
- `tests/sim/grid/floorCurves.test.ts`
- `tests/sim/grid/meta.test.ts`
- `tests/sim/grid/metaUnlock.test.ts`
- `tests/sim/grid/partASave.test.ts`
- `tests/sim/grid/run.test.ts`
- `tests/sim/grid/upgrades.test.ts`
- `tests/sim/grid/zones.test.ts`
- `tests/sim/gridBot.test.ts`
- `tests/unit/engraveFamilies.test.ts`
- `tests/unit/gridMeta.test.ts`
- `tests/unit/shipPanels.test.ts`

Report:

- `docs/superpowers/reports/2026-10-05-base-overhaul.md`
