# Fantasy Ranged Weapons and Cover Implementation Plan

> **For agentic workers:** implement task by task with TDD. Steps use checkbox (`- [ ]`) syntax.

**Goal:**
- The game becomes "Jupiter Hell, fantasy version". The pistol is replaced by two ranged weapon kinds the hero can find and swap: a **bow** (arrows as ammo) and a **magic staff** (mana and an element).
- Cover becomes a real system: half cover from low obstacles and full cover from walls and pillars. It works for both sides, and ranged foes seek it.

**Architecture:**
- `WeaponGroup` gains `bow` and `staff` in place of `pistol`. The pistol code paths become "ranged" paths keyed on `isRanged(group)`.
- Charge becomes mana for the staff. Arrows are a new hero counter.
- Cover is computed from tiles. A new non-walkable, see-through tile `cover` is placed in rooms by mapgen.
- Claude does the view and UI separately (lighting, weapon models, HUD words, cover icons). This plan touches `src/view` and `src/ui` only where needed to compile, or where a step says so.

**Tech Stack:** TypeScript, vitest. Deterministic sim (`s.rng` only).

## Global Constraints

- Files ≤ 400 lines (`npm run lint`).
- No `Math.random` or `Date.now` in `src/sim`.
- Terse Korean names in data. No explanatory sentences.
- Old saves must load.
  - Run saves: a `pistol` in hand becomes a tier-1 `bow`, and arrows default to 24.
  - Meta saves: unchanged, except that start options with `gun: 'pistol'` keep working (the field may be renamed internally, but old values are accepted).
- `npx tsc --noEmit`, `npm run lint` and `npm test` pass after every task. Do not commit or push.
- Do not modify `src/view/**` or `src/ui/**` beyond what compiling needs (type renames, a `pistol` → `bow` default). List every such touch in the final output.

## Review Focus

- Every engraving that fired on "gun" events still fires on bow and staff shots: gunRelay, bladeRelay, quickdraw, thrift, pierce, ricochet, mark, volley, rapid, sniper, headshot, steady, reverseCut, bayonet, spinShot.
  - grep `isGun`, `gunCost`, `gunInHand`, `'pistol'` across `src/sim` and fix each.
- An empty quiver (0 arrows) or too little mana makes a ranged shot unavailable, never a crash. `shootable` returns `[]` and `shotChance` returns null.
- Mapgen with cover tiles keeps every floor cell reachable from the start, and never puts cover on a doorway, the start, the stairs, a chest, or a tool spot.
- Cover never makes a point-blank (adjacent) shot harder.
- The bot (`tests/bot`) still runs. `SEEDS=5 npx vitest run -c tests/bot/vitest.bot.config.ts` completes without stuck runs.

---

### Task 1: Bow and staff replace the pistol

**Files:**
- `src/sim/grid/items.ts`: `WeaponGroup`, `WEAPONS`, `NAMES`, `GunGroup` → `RangedGroup`, `isGun` → `isRanged` (keep `isGun` as an alias if that keeps the diff small), `makeWeapon`, `rollEquipment`.
- `src/sim/grid/gear.ts`: `startGear`.
- `src/sim/grid/types.ts`: the hero gets `arrows`.
- `src/sim/grid/kataTargets.ts`: `gunCost`.
- `src/sim/grid/weapons.ts`: `rangedAttack`, `weaponRange`, `canFire`.
- `src/sim/grid/suitCharge.ts`, `src/sim/grid/regen.ts` (mana regen), `src/sim/grid/saveMigration.ts`, plus the other sim files that grep finds.
- Tests.

**Weapons** (in `WEAPONS`, replacing `pistol`):

| group | tier 1 / tier 2 damage | hit | time | range | names |
|---|---|---|---|---|---|
| bow | [5,8] / [7,11] | 0.86 | 1.0 | 8 | 사냥 활 / 장궁 |
| staff | [4,6] / [6,9] | 0.95 | 1.0 | 6 | 견습 지팡이 / 마도사 지팡이 |

**Bow:**
- Each shot spends one arrow (`hero.arrows`, start 24, max 40).
- A shot that hits leaves its arrow recoverable with chance 0.5: a floor item `{ kind: 'arrows', n: 1 }` at the target's cell, or merged into an existing arrows item there. A miss leaves one at the target cell with chance 0.3.
- Walking over arrows picks them up (capped at max).
- Arrow bundles (n = 6..10) join the floor loot pool in `scatterLoot` and the chest supplies.
- `gunCost` for a bow is 0 mana. Availability is `arrows > 0`.

**Staff:**
- Each spell spends 2 mana. Mana is `hero.charge` / `hero.maxCharge`, renamed in comments; keep the field names to limit churn.
- Mana regenerates +1 per 1.5 time units, always (in `regenerate` or a new small hook in the action loop).
- The old "melee hits refill charge" (`suitCharge.ts`) still adds mana. Keep it: blade-and-staff play is a build.
- A staff carries an element (`Weapon.element?: Element`, rolled when found: fire, frost, shock or poison).
- Its shot applies that element through the same path element rounds use (`takeRound` / `applyElement` in the shot pipeline).
- If the hero also has rounds (element imbue), the staff's own element wins for staff shots.

**Start gear:**
- `hands[0]` is a tier-1 bow and `hands[1]` is a dagger named `단검` (it was `요원 칼`).
- Arrows start at 24.

**Loot:** `rollEquipment` may now roll a bow (tier by floor) or a staff (tier by floor, random element) besides the melee weapons. Weights: melee 60%, bow 20%, staff 20%.

**Engravings:**
- Every engraving and effect that checks a gun must accept both ranged groups.
- Text in `engraveCore.ts` notes that says 총 becomes 원거리 where it names the weapon (e.g. `총 연계` → name `사격 연계`, note `칼 처치 → 최근접 사격`). Keep the ids.

**Tests:**
- Start gear is a bow and a dagger with 24 arrows.
- A bow shot spends an arrow; with 0 arrows the bow cannot shoot (`shootable` is `[]`).
- A staff shot spends 2 mana and applies its element status.
- Mana regenerates over time.
- A hit can drop recoverable arrows (find a seed), and walking onto them restores arrows.
- gunRelay fires with a bow in the other hand.
- An old save with a pistol loads as a bow with 24 arrows.

- [ ] TDD, then run `npx tsc --noEmit`, `npm run lint` and `npm test`.

### Task 2: Cover

**Files:** `src/sim/grid/types.ts` (Tile), `src/sim/grid/combat.ts` (`inCover`, `hitChance`), `src/sim/grid/fov.ts` (opaque: `cover` does not block sight), `src/sim/grid/mapgen.ts` (placement), `src/sim/grid/ai.ts` (`takeRange` / archer repositioning), tests.

**Tile:** add `'cover'` to `Tile`. It is a low wall or a stack of crates:
- **not walkable** (`walkable` is false),
- **does not block line of sight or line of fire** (`opaque` is false),
- gives **half cover**.

**Cover levels:**
- Export `type Cover = 'none' | 'half' | 'full'` and `coverOf(m, shooter, target): Cover`. It replaces the boolean `inCover`; keep `inCover` returning `coverOf !== 'none'` for callers.
- Full cover: an opaque tile (wall, pillar, closed door) on the side of the target facing the shooter, using the same side cells as now.
- Half cover: a `cover` tile there.
- Full wins over half.
- Adjacent shooters ignore cover, as now.
- `hitChance`: full −0.40, half −0.20 (replacing the single `COVER = 0.3`), times `coverMul`.

**Mapgen:**
- In each room except the start room, place `cover` tiles on 4–10% of its interior floor cells: at least one in a room of 20+ cells, never more than 6.
- Prefer cells not on the room's edge, in short runs of 1–3 (a low wall).
- Never on: a doorway or a cell next to one, the start, the stairs, a chest, a barrel, a trap, a tool spot or its reward cell, or anything in `map.exits`.
- After placing each run, verify with `distanceMap` that every floor cell reachable before is still reachable. If not, undo that run.
- Use the map's own seeded rng, so maps stay deterministic per seed.

**AI:**
- When an archer or mage picks a cell to shoot from (`takeRange` / archer repositioning in `ai.ts`), prefer cells where `coverOf(m, hero, cell) !== 'none'` among the valid ones (in the 3–6 band with a clear line).
- Ties break by the existing order.

**Exports for the UI:** `coverOf` as above, so the view can show a shield over the hero or a target.

**Tests:**
- `coverOf` returns full behind a wall, half behind a cover tile, none in the open, none point-blank.
- `hitChance` drops by 0.4 and 0.2 respectively.
- `cover` tiles block walking but not sight.
- 30 generated maps each have cover in some rooms and keep all floor reachable.
- An archer with a choice of shooting cells picks one in cover.

- [ ] TDD, then run `npx tsc --noEmit`, `npm run lint` and `npm test`.

### Task 3: Bot and saves

- `tests/bot/brain/*`: replace pistol assumptions (`gunReady`, `pistolIndex`, charge for shots) with ranged ones.
  - The bow needs arrows. The bot walks over arrow items in reach when no threat is awake.
  - The staff needs mana.
- Make sure `SEEDS=5 npx vitest run -c tests/bot/vitest.bot.config.ts --silent=false` completes. Paste the summary in the final output.
- Save migration as in Global Constraints, with a test.

### Final

- [ ] `npx tsc --noEmit`, `npm run lint`, `npm test` pass.
- [ ] Final output:
  - changed files;
  - the list of `src/view` / `src/ui` touches;
  - the bot summary;
  - every call made where the plan was unclear.
