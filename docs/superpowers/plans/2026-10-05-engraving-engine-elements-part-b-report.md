# Part B implementation report

Implemented B1–B3 only. No balance constants were tuned, no Part C engravings were added, and no files were staged, committed, or pushed. The node_modules symlinks were not replaced or edited. tests/e2e was not edited or run.

## Decisions

1. Removal is scoped to grid mode. Other modes retain their independent staff equipment. Enemy spell behavior and casting animation remain, but grid mages no longer hold a staff model. Removed shotgun/rifle models and legacy muzzle effects instead of retaining unused assets in code.
2. Kept the existing gun option/API shape, narrowed to pistol; launch setup explicitly constructs a pistol even if runtime input contains an obsolete gun choice.
3. Converted saved rifles/shotguns in both hands, bags, and floor loot to canonical tier-1 pistols. Removed staffs from those locations; an occupied staff hand becomes null without changing the active hand index.
4. Kept save version 1. Missing rounds default to an empty list, index to zero, and shot counter to zero. Round lists are validated/deduplicated/capped at two; invalid indices reset to zero. Unknown engraving IDs are filtered from suit, offers, records, run unlock/taste/recovery lists, lost suits, and fired IDs. Valid fired IDs survive even if currently absent from the suit.
5. Meta migration ignores obsolete gun flags without refunds or implicit element unlocks. It validates round unlocks and engraving lists, including records, start candidates, and the lost suit.
6. RunOptions.round is optional for existing callers, defaulting to plain. Launch applies exactly one chosen, unlocked element; unlocked-but-unselected elements are never applied. Armory lists plain plus unlocked rounds, and only locked round purchases. Prices are exactly 80/80/100/80 from the plan.
7. Remembered loadouts retain the existing in-memory lifetime across ShipDeck instances. The selected round is included; launch revalidates it against current meta. It does not introduce browser-persistent loadout settings.
8. Kept engraving IDs as string cards and added the discriminated round card object. A round card uses no suit slot and rejects duplicates or a third element. Queued cards become unavailable after the element is acquired.
9. For a level-up/echo offer, draw uniformly with s.rng from the generated engraving cards plus all not-yet-owned elements. An element draw replaces the third card (or appends to a shorter offer), preserving the first locked echo engraving. At most one round card appears; an exhausted engraving pool can still offer a round. No new probability/balance constant was added. Engraving scrolls retain engraving-only offers.
10. Every actual pistol bullet advances the loaded index and shot counter, including misses, barrel shots, and engraving shots; refused shots do not. Reserve its element before nested effects so the shot applies its own element. Melee never advances rounds. A newly acquired element leaves the current index intact.
11. Apply elements through the existing radius-zero applyElement path, which calls addStatus for non-shock statuses while preserving reactions. Shock uses the specified [1, 2] damage. Ordinary bullets do not create fire ground/clouds or inflict statuses on already-dead targets.
12. Alternate requires two elements and a change from the previous fired bullet. It uses the specified 1.5 multiplier, including special pistol shots, without the old casting speed bonus. Echo counts all fired bullets, repeats only the loaded element on a surviving third-shot target, and does not fire/spend another bullet.
13. Element blade applies on successful armed melee hits, including counter/riposte and leap, but not gun/empty-hand bashes or misses. Sweeps still activate the engraving only once per action via fire().
14. Chain repeats the actual reaction once on the first adjacent living foe in stable entity order with line of sight; the second foe need not already have the initiating status. Ignite/steam reuse the existing area reaction; shatter/paralysis repeat their reaction effect. Enemy reactions do not trigger it, and fire() prevents recursive spread. Engraving-applied champion freeze/stun is capped at one; ordinary status durations remain unchanged.
15. Connected spin, execute, ricochet, and volley bullets to round handling. Applied the global charge requirement to the previously free ricochet/volley shots, using the existing pistol gunCost; they stop at insufficient charge. Echo and blade status applications are effects, not extra bullets. Existing recharge scroll behavior for the suit remains; staff recharge is removed.
16. Both HUD weapon lines use the same terse Korean label, e.g. 권총 · 화염. Converted obsolete weapon tests to pistol/round coverage or removed tests solely for deleted mechanics. Preserved tests for unrelated modes. The zero-charge shove-shot guard now uses zero capacity because an ordinary landed melee hit refills enough for a pistol.

## Verification

Tests were added and observed failing before implementing the corresponding rules: initial migration/round rules, special attacks and charge edges, HUD labels, alternate execution damage, scroll offer isolation, and unarmed enemy spell rendering. Regression tests cover remembered armory selection, old meta, deterministic saves, champion caps, no-op paths, and the two-element limit.

Final verification after the last code change:

- `npx tsc --noEmit -p .` — passed.
- `npm run lint` — passed, including the 300-line file limit.
- `npx vitest run` — 154 test files passed, 2 skipped; 1,045 tests passed, 3 skipped; no failures.
- `git diff --check` — passed. The index and tests/e2e have no changes.

## E2E update needed

- tests/e2e/grid.spec.ts:198 — “the ship deck: bump the armory, buy the shotgun with energy, it is saved and can be picked to launch with”. Replace shotgun purchase/selection selectors and saved armoryShotgun assertion with a round unlock/selection assertion. The obsolete flags in its legacy fixture may remain as a migration fixture. This is the only e2e test referencing removed grid weapons/shop items.

## Changed files

- `docs/superpowers/plans/2026-10-05-engraving-engine-elements-part-b-report.md`
- `src/app/gridMeta.ts`
- `src/sim/grid/absorb.ts`
- `src/sim/grid/actions.ts`
- `src/sim/grid/combos.ts`
- `src/sim/grid/consumables.ts`
- `src/sim/grid/engrave.ts`
- `src/sim/grid/engraveCore.ts`
- `src/sim/grid/gear.ts`
- `src/sim/grid/gridSim.ts`
- `src/sim/grid/items.ts`
- `src/sim/grid/kata.ts`
- `src/sim/grid/kataEffects.ts`
- `src/sim/grid/meta.ts`
- `src/sim/grid/reactions.ts`
- `src/sim/grid/rounds.ts`
- `src/sim/grid/runSetup.ts`
- `src/sim/grid/save.ts`
- `src/sim/grid/saveMigration.ts`
- `src/sim/grid/shotCombos.ts`
- `src/sim/grid/state.ts`
- `src/sim/grid/status.ts`
- `src/sim/grid/types.ts`
- `src/sim/grid/weapons.ts`
- `src/ui/grid/gridHud.ts`
- `src/ui/grid/gridTerm.ts`
- `src/ui/grid/icons.ts`
- `src/ui/grid/levelUp.ts`
- `src/ui/grid/ship/panelContents.ts`
- `src/ui/grid/ship/shipDeck.ts`
- `src/ui/grid/weaponInfo.ts`
- `src/view/grid/gridActors.ts`
- `src/view/grid/gridRuntime.ts`
- `src/view/grid/heroLook.ts`
- `src/view/grid/runtimeHelpers.ts`
- `src/view/grid/stationLit.ts`
- `src/view/grid/weaponKit.ts`
- `src/view/grid/weaponMeshes.ts`
- `tests/sim/grid/absorb.test.ts`
- `tests/sim/grid/acquire.test.ts`
- `tests/sim/grid/ai.test.ts`
- `tests/sim/grid/elements.test.ts`
- `tests/sim/grid/engrave.test.ts`
- `tests/sim/grid/engraveCatalog.test.ts`
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
- `tests/sim/grid/resonance.test.ts`
- `tests/sim/grid/review2.test.ts`
- `tests/sim/grid/review3.test.ts`
- `tests/sim/grid/roundEdges.test.ts`
- `tests/sim/grid/rounds.test.ts`
- `tests/sim/grid/startKit.test.ts`
- `tests/sim/grid/suit.test.ts`
- `tests/sim/grid/upgrades.test.ts`
- `tests/sim/grid/weaponMigration.test.ts`
- `tests/sim/grid/weapons.test.ts`
- `tests/unit/attackChoice.test.ts`
- `tests/unit/gridHudLayout.test.ts`
- `tests/unit/gridMeta.test.ts`
- `tests/unit/handSwap.test.ts`
- `tests/unit/heroLook.test.ts`
- `tests/unit/roundHud.test.ts`
- `tests/unit/shipDeckRounds.test.ts`
- `tests/unit/shipFlow.test.ts`
- `tests/unit/shipPanels.test.ts`
