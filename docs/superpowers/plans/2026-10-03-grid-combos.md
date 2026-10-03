# Grid Combos (Engravings · Reactions · Dodge/Parry) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** See the combo action first: base element reactions, in-place dodge (weave) and parry with animations, and an engraving system with ~20 combo engravings the player can try right away.

**Spec:** `docs/superpowers/specs/2026-10-03-grid-roguelike-systems-design.md` (§2 engravings, §2.6 combos/dodge/parry, §2.7 reactions). User chose order (B): combos before roguelike basics.

## Global Constraints
- Sim deterministic (no DOM/three/Math.random/Date.now in src/sim; rng from state). Files ≤ 300 lines; layering rules.
- Korean player text. Commits end with `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.

## Review Focus
1. **Trigger loops** — an engraving fires at most once per hero action (counter → kill → momentum → …), no recursion.
2. **Reactions consume their parts** — shatter clears freeze, ignition clears poison clouds/poison in the blast, steam clears burn/freeze; no double reaction from one application.
3. **Dodge/parry only on foe melee/shots aimed at the hero**, never on element ticks, explosions or the champion's whirl; counters respect corners/doors like normal attacks.
4. **Engraved weapon identity** — engravings live on the weapon (swap/equip/drop keeps them with it); rune stones never vanish when the bag is full.
5. **View sync** — combo animations (dash, leap) never desync the model from its cell; trigger popups don't pile up.

---

### Task 1: Element reactions (sim)
**Files:** Modify `src/sim/grid/status.ts` (+ new `reactions.ts`), `types.ts` (tile kind `steam`, event `react`), `fov.ts`/`combat.ts` (steam blocks sight and shots); Test `tests/sim/grid/reactions.test.ts`
- ignite: fire onto a poisoned entity or a poison-cloud cell → blast radius 1 (4–7 fire), clouds in the blast removed, poison cleared.
- shatter: shock on a frozen entity → damage ×2, freeze cleared.
- steam: frost on burning/fire tile or fire on frozen → steam tiles radius 1 for 3 turns (opaque), burn/freeze cleared.
- paralyse: shock on a poisoned entity → stun 2.
- Events `react` with `text` = ignite|shatter|steam|paralyse. Tests for each + one application reacts once.

### Task 2: Dodge and parry (sim) + animations (assets)
**Files:** `src/sim/grid/defense.ts`, hook in `combat.strike` for foe→hero; `gear.ts` (evasion/parry from gear); merge script (scratch) to add clips + Blender weaves; Test `tests/sim/grid/defense.test.ts`
- Evasion: 5% base, +10% dagger in hand, +5% no armour/leather, (later engravings). Parry: sword/rune-sword in hand 12%; never vs whirl/explosions/statuses/spells.
- Events `dodge` (text L|R) and `parry`; no damage.
- Assets: add Sword_Dash_RM, NinjaJump_Start/Idle/Land, Punch_Cross, Pistol_Aim_Neutral, Idle_Shield_Break, Roll_RM + Blender-made `Weave_L`/`Weave_R` to `ual.glb`.

### Task 3: Engraving core + 20 engravings (sim)
**Files:** `src/sim/grid/engrave.ts` (table, trigger dispatch), `engraveFx.ts` (effects), hooks in `actions.ts`/`weapons.ts`/`gridSim.ts`/`defense.ts`; `items.ts` (Weapon.engraves, RuneStone item); Test `tests/sim/grid/engrave.test.ts`
- `Engraving { id: EngraveId; lvl: 1|2|3 }`, `Weapon.engraves?: Engraving[]`, slots 1 (+1 at +3/+6 later; prototype weapons may carry 2).
- Trigger context per hero action: `fired: Set<EngraveId>`.
- Engravings (20): melee — dash (돌진 베기), finisher (3연타 마무리), shove-shot (밀치고 쏘기), leap (도약 내려찍기), counter (반격, on dodge), riposte (되받아치기, on parry); general — momentum (기세), quickswap (칼바꿈), swapstrike (연환), wallslam (벽치기), laststand (배수진); ranged — rapid (연사), mark (표식), ricochet (도탄), kite (쏘고 물러나기), volley (삼중 사격); magic — alternate (교대 시전), echo (잔향), chain (연쇄 번개), elemental-arrow (원소 화살).
- Events `engrave` {text: id} on each firing (for popups).
- Tests: each engraving's trigger and effect; once-per-action guard.

### Task 4: Getting engravings (sim + UI)
**Files:** `items.ts` (rune stone drop in chests 35%), `actions.ts` (`inscribe` action: bag rune → active weapon free slot, 1 turn), `state.ts` (prototype rack weapons pre-engraved), level-up 3-choice (`run.ts` pending choice; `GAction choose`); `src/ui/grid/levelUp.ts`, `gridBag.ts` (engravings on weapons, inscribe button); Tests in engrave.test.
- Level-up offers 3 engravings (weighted toward ones matching the weapon in hand); picking inscribes onto the weapon in hand (replaces the lowest if full).

### Task 5: Combo visuals
**Files:** `view/grid/gridRuntime.ts`, `gridActors.ts`, `ualActor.ts`, `gridFx.ts`, `gridElements.ts` (steam tiles)
- dodge → Weave_L/R; parry → Sword_Block (+ riposte swing); dash → Sword_Dash lunge while gliding; leap → NinjaJump start/land arc + landing burst; shove-shot → Melee_Hook then shot; finisher → Sword_Regular_C + bigger hit-stop/zoom; reactions → ignite blast, shatter ice shards, steam cloud, paralyse sparks; engraving popups (name over the hero, stacked, short); combo counter "2 콤보 / 마무리!".

### Task 6: E2E, README, review, push
- e2e: rune stone inscribe, level-up choice modal, a dash triggers (`engrave` event), console clean. README section. Final review → fixes → push → CI.
