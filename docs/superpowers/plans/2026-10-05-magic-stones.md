# Magic Stones, Behaviour Mods and Guardian Portals Implementation Plan

> **For agentic workers:** implement task by task with TDD. Steps use checkbox (`- [ ]`) syntax.

**Goal:**
- The workbench offers 3 mods per slot (24 in all). 8 are plain base mods; 16 change how the hero plays.
- Those 16 come only from **magic stones (마석)** found in the dungeon. A stone can be socketed at once (for this run) and unlocks its mod permanently once brought home.
- Guardians on floors 5 and 10 drop a **guardian stone**. It is either fitted to a special heart socket (a strong power) or used to **open a portal**: the run ends safely, everything is banked, and later runs may start below that guardian.

**Architecture:**
- Data lives in `src/sim/grid/mods.ts`, split into `modDefs.ts` if it grows.
- Behaviours are perk ids on the hero, checked at the few places they act.
- Stones are a new floor item kind and run state, with a pending prompt like the engraving offers.
- Settlement banks or leaves stones.
- The UI (screens and prompts) is done separately by Claude; this plan covers sim, meta, migration and bot only, plus the minimal `GridScreen` plumbing noted in Task 4.

**Tech Stack:** TypeScript, vitest. Deterministic sim (`s.rng` only).

## Global Constraints

- Files ≤ 400 lines. **Task 0 changes the limit from 300 to 400.**
- No `Math.random` or `Date.now` in `src/sim`. Everything random uses `s.rng`.
- Terse Korean names. No explanatory sentences in data strings.
- Old saves (meta and run) must load: add migrations, never crash on missing fields.
- `npx tsc --noEmit`, `npm run lint` and `npm test` pass after every task. Do not commit or push.
- Balance numbers below are first guesses; keep them in data tables so they are easy to tune.

## Review Focus

- A run save from before this change (no `stones`, no `sockets`, no `perks`) loads and plays.
- A meta save with `facilities.navCrypt` / `navRuins` true becomes `portals: [5]` / `[10]`, and the start-floor choice still works.
- Socketing a stone over a base-fitted mod removes that mod's stats (no double HP or charge).
- Dying with stones puts them in the left suit; recovering the suit next run puts them back into the run's stones; dying again before recovery loses the older suit's stones.
- A portal opened mid-run ends the run as `returned`. Materials are kept in full, stones are unlocked, and nothing is left on the floor.

---

### Task 0: File length limit 400

- [ ] In `scripts/check-file-length.mjs` set `const MAX = 400;`. Run `npm run lint`.

### Task 1: Mod catalogue (24 mods, base vs stone, perks)

**Files:** `src/sim/grid/mods.ts` (split the catalogue into `src/sim/grid/modDefs.ts` if needed), `src/sim/grid/meta.ts`, `src/sim/grid/baseMigration.ts`, `src/sim/grid/workbench.ts`, tests.

**Types:**
```ts
export type PerkId = 'scatter' | 'pierceBarrel' | 'soulCell' | 'elemChamber' | 'runeScope' | 'thermal'
  | 'bayonetGrip' | 'doubleTap' | 'soulWeave' | 'reactive' | 'hookArms' | 'shockArms'
  | 'chargeLegs' | 'silentLegs' | 'regenPack' | 'elemTank' | 'whirlHeart' | 'undyingHeart';
export interface ModDef { id: string; slot: ModSlot; name: string; stats: Partial<Record<ModStat, number>>;
  perk?: PerkId; stone: boolean; cost: Partial<Record<Material, number>> }
```
`ModSlot` gains `'heart'` (guardian mods only; not craftable; see Task 5).

**Catalogue.** Base mods (`stone: false`) are craftable once the workbench is repaired. Stone mods need the id in `meta.mods.unlocked`.

| slot | id | name | stats / perk | cost | stone |
|---|---|---|---|---|---|
| barrel | longBarrel | 장총열 | hit +0.08 | scrap 4 | no |
| barrel | scatter | 산탄 총열 | perk scatter | scrap 4, soul 2 | yes |
| barrel | pierceBarrel | 관통 총열 | perk pierceBarrel | scrap 3, relic 2 | yes |
| mag | extMag | 확장 탄창 | maxCharge +2 | scrap 5 | no |
| mag | soulCell | 영혼 전지 | perk soulCell | soul 4, remains 1 | yes |
| mag | elemChamber | 원소 약실 | perk elemChamber | relic 3, soul 2 | yes |
| sight | redDot | 점조준기 | hit +0.1 | scrap 3 | no |
| sight | runeScope | 룬 조준경 | perk runeScope | relic 4 | yes |
| sight | thermal | 열 감지경 | perk thermal | soul 3, relic 2 | yes |
| grip | quickGrip | 속사 손잡이 | swap −0.25 | scrap 4 | no |
| grip | bayonetGrip | 총검 손잡이 | perk bayonetGrip | scrap 4, remains 1 | yes |
| grip | doubleTap | 연발 손잡이 | perk doubleTap | scrap 3, relic 2 | yes |
| chest | plating | 강화 판 | maxHp +6 | scrap 6 | no |
| chest | soulWeave | 영혼 직조 | perk soulWeave | soul 5 | yes |
| chest | reactive | 반응 장갑 | perk reactive | scrap 4, remains 2 | yes |
| arms | servoArms | 서보 팔 | meleeDmg +2 | scrap 4, soul 2 | no |
| arms | hookArms | 갈고리 팔 | perk hookArms | scrap 5, relic 1 | yes |
| arms | shockArms | 충격 팔 | perk shockArms | soul 3, remains 2 | yes |
| legs | sprintLegs | 질주 다리 | evasion +0.05 | soul 3 | no |
| legs | chargeLegs | 돌격 다리 | perk chargeLegs | scrap 4, soul 2 | yes |
| legs | silentLegs | 무음 다리 | perk silentLegs | soul 3, relic 2 | yes |
| back | silencer | 소음 차폐 | noise −2 | relic 3, remains 1 | no |
| back | regenPack | 재생기 | perk regenPack | soul 4, remains 2 | yes |
| back | elemTank | 원소 탱크 | perk elemTank | relic 3, remains 2 | yes |

Remove `heavyBarrel`. Guardian mods (slot `heart`, never crafted or in the workbench options) are added in Task 5.

**Meta:**
- `MetaState.mods` becomes `{ owned: string[]; fitted: Partial<Record<ModSlot, string>>; unlocked: string[] }`.
- `freshMeta()` has `unlocked: []`.
- `canCraft` additionally requires `!mod.stone || m.mods.unlocked.includes(id)`, and never allows the `heart` slot.

**Migration (`baseMigration.ts`):**
- Keep only owned ids that exist.
- Any owned stone mod (`soulCell`, `runeScope`, `soulWeave` from old saves) is added to `unlocked`.
- `unlocked` is filtered to existing stone mod ids.

**Workbench model:** `WorkbenchOption` gains `locked: boolean` (a stone mod not in `unlocked`). `options(slot)` lists all 3 mods of the slot.

**Perks on the hero:**
- `Hero` gains `perks?: PerkId[]`.
- `applyMods` sets `h.perks` from the fitted mods' perks, besides the stats.
- Export `has(h, perk)` (or `hasPerk`) from `mods.ts`.

**Tests:**
- 24 non-heart mods, 3 per slot, exactly 8 base.
- A locked stone mod cannot be crafted; unlocking makes it craftable.
- Migration moves an owned `soulCell` into `unlocked` and drops `heavyBarrel`.
- `applyMods` sets the perks.

### Task 2: Perk behaviours

**Files:** the sim files named below, plus `src/sim/grid/perks.ts` for shared helpers, tests. Each perk is checked with `hasPerk(s.hero, id)`.

**Pistol perks:**
- **scatter** (`weapons.ts` `rangedAttack`, after a gun hit): up to 2 other living foes adjacent (Chebyshev 1) to the target take 50% of the dealt damage (rounded down, minimum 1). Emit `hit` events with `text: 'scatter'`. Range: `weaponRange` returns `range − 3` for the pistol with scatter.
- **pierceBarrel**: after a gun hit, the next living foe on the same line behind the target (use the line logic of `pierceShot` in `engraveTargets.ts`, but extend up to 3 cells beyond) takes 70% damage. No charge cost.
- **soulCell**: any hero kill (gun or melee) gives +1 charge, capped at `maxCharge`. Hook where kills are settled for the hero's action (`settleKills` in `run.ts` or the suitCharge path).
- **elemChamber**: element status applied by the hero's shots gets +1 strength, the same way element resonance adds `bonus` in `status.ts` line ~43. They stack.
- **runeScope**: a shot at a sleeping foe (`!awake`) does ×2 damage (use the existing `nextMult` path or multiply in `rangedAttack`).
- **thermal**: export `sensedFoes(s): string[]`, the alive foes within 8 cells (Chebyshev) that are not in `s.visible`. The sim never treats them as visible; this is for the view only.
- **bayonetGrip**: a melee bump with the pistol in hand uses the dagger's damage and hit (`WEAPONS.dagger`, tier of the hero's blade), and refills charge like an armed melee hit (`refillMelee` path in `weapons.ts` `meleeAttack`).
- **doubleTap**: every 3rd consecutive shot (the hero's `fx.rapid.n` counter, or a new `fx.taps`) costs no charge.

**Suit perks:**
- **soulWeave**: at run start and on each `nextFloor`, set the shield to at least 6.
- **reactive**: when a foe's melee blow hits the hero (not dodged or parried), push the attacker 1 cell away if the cell behind it is free. Reuse the existing push helper used by the `push` effect in `kataEffects.ts`.
- **hookArms**: a melee attack can hit a foe exactly 2 cells away in a straight or diagonal line with a clear middle cell, pulling it adjacent first. Implement in `reachTarget` (`weapons.ts`), which already handles reach; on a hit, move the foe to the middle cell if free.
- **shockArms**: a landed melee hit stuns the foe for one turn with 20% chance (`s.rng.chance(0.2)`), using the existing stun (`f.stun`).
- **chargeLegs**: a melee attack right after a move (`fx.lastAction === 'move'`) gets +3 damage.
- **silentLegs**: the hero's step noise (`STEP_NOISE` in `actions.ts`) becomes 0.
- **regenPack**: when `canRegenerate` is false (in combat), still regenerate 1 HP per 12 turns (a separate clock, e.g. `h.regenCombat`). Never while burning or poisoned.
- **elemTank**: burn and poison tick damage on foes from the hero +1.

**Tests:** one focused test per perk (16), each building a tiny state with `GridSim.create(seed)` and setting `hero.perks` directly:
- scatter hurts a neighbour of the target.
- pierce hits the foe behind.
- soulCell +1 charge on kill.
- runeScope doubles damage on a sleeper.
- thermal lists a foe behind a wall.
- bayonetGrip bash damage ≥ dagger minimum.
- doubleTap third shot free.
- soulWeave shield after `nextFloor`.
- reactive pushes.
- hookArms hits at 2 and pulls.
- shockArms stun with a seeded rng (find a seed that rolls under 0.2).
- chargeLegs +3.
- silentLegs: no step noise.
- regenPack heals in combat.
- elemTank +1 burn tick.
- elemChamber +1 status.

### Task 3: Stones in the dungeon

**Files:** `src/sim/grid/items.ts`, `src/sim/grid/stones.ts` (new), `src/sim/grid/types.ts`, `src/sim/grid/weapons.ts` (`pickUp`), `src/sim/grid/run.ts` (`settleKills` drops), `src/sim/grid/actions.ts` (chest, new action), `src/sim/grid/toolSpots.ts` or `consumables.ts` `scatterLoot` (tool-room reward), `src/sim/grid/save.ts` / `saveMigration.ts`, tests.

**Item:** `export interface StoneItem { kind: 'stone'; id: string; name: string }`. `id` is a stone mod id or a guardian stone id (Task 5). `name` is `${mod.name} 마석`. Add it to the `FloorItem` union.

**Run state:**
- `RunState` gains `stones: string[]`, all stones carried this run, socketed or not.
- `Hero` gains `sockets?: Partial<Record<ModSlot, string>>`, the stones socketed this run.
- `GridState` gains `stonePrompt?: string`, a stone just picked up that waits for the choice.

**Pickup** (`pickUp`): a stone goes into `s.run.stones`, sets `s.stonePrompt = id`, and emits `{ type: 'stone', text: id }`. Add `'stone'` to `GEventType`.

**Action:** `{ kind: 'socket'; stone: string | null }`, free (cost 0) like `choose`.
- `stone === null` keeps the prompted stone unsocketed and clears the prompt.
- Otherwise the stone must be in `s.run.stones` and not already socketed. It is socketed into its mod's slot, and the prompt is cleared.
- If that slot already holds a socketed stone, the old stone **breaks**: it is removed from `s.run.stones` and from `sockets`, with event `{ type: 'stoneBreak', text: oldId }`.
- Socketing works at any time, not only on the prompt, so the UI can offer it from an inventory.
- Socketing recomputes the hero's mod effects: the effective fitted set for the slot is the socketed stone's mod instead of the meta-fitted one.
  - Implement `effectiveMods(meta fitted, sockets)` plus a function that **removes the old slot mod's stats and adds the new one's**: maxHp (clamp hp), maxCharge (clamp charge), shield, gunDmg, meleeDmg, evasion, swap, hit, noise in `modStats`.
  - Recompute `h.perks`.
  - Store the meta-fitted mods on the hero at run start (`h.baseMods`) so the swap is exact.
- While `s.stonePrompt` is set, other actions are still allowed. The UI shows the prompt first; the bot answers it first.

**Drops:**
- **Elite kill** (`settleKills`, elite branch): with chance 0.35, drop a stone at the foe's position.
  - Family pools: melee → arms, legs, chest; ranged → barrel, sight; element → mag, back; fusion → grip, plus any slot.
  - Pick a stone mod from the pool's slots, preferring ids not in `s.run.unlocked` (a snapshot of meta unlocked mods taken at run start: add `s.run.modsUnlocked`). Fall back to any id in the pool.
- **Chest** (`openChest`): chance 0.1 for a random stone mod.
- **Tool-gated room reward** (the `toolSpots` reward cell in `scatterLoot`): one guaranteed random stone besides the materials.
- Keep everything on `s.rng` and stable order so runs stay deterministic.

**Saves:** `saveMigration.ts` defaults `run.stones = []`, `hero.sockets = {}`, `hero.perks = []`, and `run.modsUnlocked = []`. `save.ts` validation accepts the new fields.

**Tests:**
- Picking up a stone adds it and sets the prompt.
- `socket null` clears the prompt.
- Socketing `soulCell` over a fitted `extMag` removes the +2 max charge and adds the perk.
- A second barrel stone breaks the first.
- An elite kill drops a stone for some seed (loop seeds until one does; assert the family pool).
- An old save without the fields loads.

### Task 4: Banking stones, the left suit, and the `returned` outcome

**Files:** `src/sim/grid/meta.ts` (`settleRun`, `MetaState.suit`), `src/sim/grid/weapons.ts` (`pickUp` of the suit), `src/sim/grid/types.ts`, `src/app/gridRun.ts`, tests.

- `GridState.outcome` becomes `'won' | 'dead' | 'returned'`. Grep every `outcome ===` use, and make `returned` behave like `won` for "not dead" checks except `m.wins` and `coreSecured`.
- **settleRun:**
  - `won` or `returned`: every id in `s.run.stones` that is a stone mod is added to `m.mods.unlocked` (deduplicated). Guardian stone handling is in Task 5. Materials are kept in full.
  - `dead`: the materials rule is as now, and the left suit gets `stones: [...s.run.stones]`. `MetaState.suit` gains `stones?: string[]`.
  - A dead run with stones but no engravings and no lost materials still leaves a suit; extend the existing condition with `|| s.run.stones.length`.
  - Recovering the suit (`pickUp` of `kind: 'suit'`): its stones are pushed into `s.run.stones`, using `s.run.leftSuit.stones`. They then bank or are left by the rules above. They are not socketed automatically.
- `src/app/gridRun.ts`: settlement already runs on any outcome. Make sure `returned` settles and clears the save.
- **The UI result screen text for `returned` (귀환) is done by Claude.** Leave the outcome visible in state, and do not crash any screen: grep `outcome` in `src/ui` and add a `returned` branch that reuses the win branch's code path with the label `귀환`.

**Tests:**
- Won with 2 stones unlocks 2.
- Dead with a stone puts it in `meta.suit.stones`.
- A next run recovering the suit gets the stone in `run.stones`.
- `returned` keeps full materials.

### Task 5: Guardian stones, heart mods, and portals

**Files:** `src/sim/grid/stones.ts`, `src/sim/grid/mods.ts` / `modDefs.ts`, `src/sim/grid/run.ts`, `src/sim/grid/actions.ts`, `src/sim/grid/meta.ts`, `src/sim/grid/runSetup.ts`, `src/app/gridMeta.ts`, `src/ui/grid/ship/panelContents.ts` (start choices only), tests.

**Guardian stones:**
- Ids `guardian5`, `guardian10`. Named `동굴 수호자의 핵` and `묘지 수호자의 핵`.
- When the champion on floor 5 or 10 dies (`settleKills`, where it opens the stairs), also drop that floor's guardian stone at its position.
- The floor-15 champion is unchanged (drops the core).

**Heart mods** (slot `heart`, `stone: true`, never in workbench options or `canCraft`):
- `whirlHeart` 선회의 핵, perk `whirlHeart`: every 3rd hero action that costs time, all foes adjacent to the hero are struck once with the blade's damage (or the bash if no blade). Event `bump` with `text: 'whirl'`, one per foe.
- `undyingHeart` 불굴의 핵, perk `undyingHeart`: once per floor, a blow that would kill the hero leaves 30% maxHp instead. Event `{ type: 'buff', text: 'undying' }`. Reset the once-flag on `nextFloor`.
- Mapping: `guardian5` → `whirlHeart`, `guardian10` → `undyingHeart`.
- Socketing a guardian stone uses the same `socket` action into the `heart` slot. Breaking applies as for normal stones.

**Portal action:** `{ kind: 'portal'; stone: string }`, cost 0.
- The stone must be a guardian stone in `s.run.stones`, and not socketed.
- It removes the stone, records `s.run.portal = 5 | 10`, and sets `s.outcome = 'returned'` with event `{ type: 'portal', text: '5' | '10' }`. Add `'portal'` to `GEventType`.

**Prompt:** picking up a guardian stone sets `stonePrompt` like any stone. The UI then offers socket, portal or keep. The `socket null` action means keep.

**Meta:**
- `MetaState` gains `portals: number[]`. `freshMeta` sets `[]`.
- **settleRun:**
  - Add `s.run.portal` to `portals` (deduplicated).
  - Guardian stones banked on `won`/`returned` unlock their heart mod: add `whirlHeart` / `undyingHeart` to `mods.unlocked`.
  - Heart mods can then be fitted at the base: allow `fit(meta, 'heart', id)` when the id is unlocked. No crafting cost; owning equals unlocked. `canCraft` stays false for heart mods, and `fit` checks `unlocked` for the heart slot instead of `owned`.
- **Start floors** replace the nav shortcuts:
  - Start 6 needs `portals.includes(5)` and the `nav` repair. Start 11 needs `portals.includes(10)` and `nav`.
  - Remove the `navCrypt` / `navRuins` SHOP entries and the `facilities` fields.
  - Migration (`gridMeta.ts` and/or `baseMigration.ts`): an old `navCrypt` adds portal 5, `navRuins` adds portal 10.
  - Update `panelContents.ts` start choices to use portals and nav. This is plain logic in the existing render; keep its markup.
  - `nav` repair's OPENS text in `src/ui/grid/ship/repairScreen.ts` changes from `['지름길']` to `['포탈 출발']`.
- After a portal for a floor exists, guardian stones still drop there. They can be socketed or banked; the portal action stays allowed (harmless) so the rule stays simple.

**Tests:**
- The champion on 5 drops `guardian5`.
- The portal action ends the run as `returned`, and settle adds portal 5 and keeps the materials.
- Socketing `guardian10` gives `undyingHeart` and the hero survives a lethal hit once per floor.
- `whirlHeart` strikes adjacent foes on the 3rd action.
- Old meta with `navCrypt` becomes `portals [5]`.
- Start 6 needs portal 5 plus nav.

### Task 6: Bot uses stones and portals

**Files:** `tests/bot/brain/*.ts`, `tests/bot/runBot.ts`, `tests/bot/fullRun.bot.ts`, `tests/unit/botBrain.test.ts`.

- The policy answers `s.stonePrompt` first (after upgrades and offers):
  - A normal stone is socketed if its mod scores higher than the current effective mod in that slot. Score by archetype: ranged/fusion like gun perks, melee likes arm/leg perks, and everyone likes soulCell, regenPack, soulWeave and undyingHeart. Otherwise keep.
  - A guardian stone: in campaign mode, open the portal if `meta.portals` lacks that floor; otherwise socket it. In single-run mode (`runBot` without a campaign), socket it so the bot can reach floor 15.
- **Campaign:**
  - Between runs, craft and fit unlocked stone mods by score, and fit an unlocked heart mod.
  - Start floor is 1 by default. Add an option `startDeep: true` to start at the deepest portal floor available. Print both variants: always-1, and deepest.
- **Report:**
  - Stones found, socketed and banked per run.
  - Portals opened.
  - `returned` counts as a safe end. Separate the counts: won / returned / dead.
- Run `SEEDS=20 npx vitest run -c tests/bot/vitest.bot.config.ts --silent=false` and paste the summary in the final output.

### Final

- [ ] `npx tsc --noEmit`, `npm run lint`, `npm test` pass.
- [ ] Final output: changed files, the bot summary, and any doubts about the spec (where you made a call, say what and why).
