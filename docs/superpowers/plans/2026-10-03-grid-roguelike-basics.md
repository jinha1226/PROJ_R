# Grid Roguelike Basics (Noise · Traps · Unidentified Potions/Scrolls) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** The roguelike basics from the systems spec: graded noise that may or may not wake sleepers, hidden traps found by walking near them or searching, and potions and scrolls whose identity is shuffled each run and learned by use.

**Spec:** `docs/superpowers/specs/2026-10-03-grid-roguelike-systems-design.md` §4 (and §6 for the screen). Order chosen by the user: combos → roguelike basics → gear growth.

**Architecture:** New pure sim modules `noise` (in danger.ts), `traps.ts`, `lore.ts` (per-run shuffle + names), `buffs.ts` (timed effects as until-times), `consumables.ts` (drink/read/throw). The view adds found traps and floor potions/scrolls; the UI adds a potions/scrolls section in the bag, buff chips, search input.

## Global Constraints
- Sim deterministic (no DOM/three/Math.random/Date.now in src/sim; rng from state). Files ≤ 300 lines (`npm run lint` counts). Layering rules.
- Korean player text. Commits end with `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.
- Hand-built test maps stay clean: traps come from `generateMap` only, scattered loot from `GridSim.create`/`nextFloor` only (like the weapon rack).
- The lore shuffle uses its own rng stream (seed-derived) so existing rolls on `s.rng` do not shift.

## Scope rulings (made at planning)
- Healing stays the known belt `potion` (the potion button keeps working); the 8 other potion kinds are unidentified.
- Scrolls that need gear growth (upgrade, cleanse, transfer) move to the gear-growth plan; this plan has 7 scrolls.
- Strength: `hero.str` starts 10; each point above 10 adds +1 melee damage (SPD-style excess strength) until gear requirements arrive.

## Review Focus
1. **Traps spring once and only on entering** — standing still, turn-start ticks, or a teleport landing on a found trap must not loop; foes pushed onto traps spring them.
2. **Invisibility really hides** — no shots, telegraphs, wake-by-sight or lastSeen updates while invisible; any attack (melee, shot, spell, throw) ends it.
3. **Identification is per run and stable** — same seed → same colours/runes; known kinds stay known across floors; a fresh run reshuffles.
4. **Buff clocks use game time** — haste halves cost without making zero-cost loops; confusion/root never block level-up choices or free actions; buffs expire on time even across floors.
5. **Tap-walk routes around found traps** and never steps on one by itself.

---

### Task 1: Noise and traps (sim)
**Files:** `src/sim/grid/danger.ts` (graded noise), new `traps.ts`, `buffs.ts`; `types.ts` (`GridMap.traps?`, `GridState.traps`, `Ent.buffs?`, actions `search`, events `trap|trapFound|root`), `mapgen.ts` (place traps), `status.ts` `onEnter` (spring), `actions.ts` (walk/door/melee noise, `search`, rooted move, `walkBlocked` found traps), `gridSim.ts` (discovery after each hero action); Test `tests/sim/grid/traps.test.ts`

**Interfaces — Produces:**
- `noise(s, at, r, sure = r >= LOUD)` — loud noises (r ≥ 6: shots, explosions, alarm) always wake sleepers within r; quiet ones (walk 1, door 2, melee 3) wake each sleeper within r with chance `(r + 1 − d) / (r + 2)`.
- `type TrapKind = 'spike' | 'alarm' | 'poison' | 'fire' | 'teleport' | 'net'`; `interface Trap { pos: Cell; kind: TrapKind; found: boolean }`; `s.traps: Trap[]` (copied from `map.traps` in `newState`).
- `springTrap(s, e, t)` — called from `onEnter`; removes the trap, emits `trap` {text: kind}; spike `3+2·floor … 6+2·floor`, alarm = loud noise 12 + all foes in 12 get `lastSeen = pos`, poison = cloud r1, fire = fire r1 [3,6], teleport = random free floor cell ≥ 8 away (no stairs, no trap), net = buff `root` 2 turns (foe: stun 1).
- `discover(s, t)` — after each hero action: each hidden trap adjacent to the hero is found with 20%; `search` action (1 turn) finds all within 2; both emit `trapFound`.
- `type BuffKind = 'haste' | 'invis' | 'confuse' | 'root' | 'fear'`; `Ent.buffs?: Partial<Record<BuffKind, number>>` (until-times); `buffOn(e, k, now)`, `addBuff(s, e, k, turns)`.
- Rooted hero: a move into an empty cell fails (event `root`, cost 1); bumps still attack.
- mapgen: `3 + floor` traps on floor cells in rooms/corridors, not on start/stairs/chests/spawns/barrels/doorways, weighted spike 3, net 2, poison 2, fire 2, alarm 2, teleport 1.

**Tests:** graded noise (walk next to a sleeper wakes sometimes, never at distance 2; crossbow always within 6); each trap kind's effect and that it is consumed; foe pushed onto a spike trap takes damage; standing still does not re-spring; search finds traps within 2; walking past finds adjacent ones sometimes (seeded); rooted move fails but costs a turn; tap-walk path avoids found traps; mapgen places traps away from start/stairs, deterministic per seed.

### Task 2: Unidentified potions and scrolls (sim)
**Files:** new `lore.ts`, `consumables.ts`; `types.ts` (`GridState.lore`, `Hero.str`, actions `drink|read|throwPotion`, events `drink|read|identify|teleport|buff`), `gear.ts` (`potions`, `scrolls` stacks), `items.ts` (floor `Consumable` item), `weapons.ts` (pickUp consumables; str damage; invis sneak), `actions.ts` (chest drops), `state.ts`/`run.ts` (lore created once per run; `scatterLoot` in `GridSim.create` and `nextFloor`), `ai.ts`/`danger.ts` (invis, confuse, fear), `gridSim.ts` (haste cost, invis ends on attack); Test `tests/sim/grid/lore.test.ts`

**Interfaces — Produces:**
- `type PotionKind = 'strength' | 'cure' | 'invis' | 'fire' | 'poison' | 'frost' | 'haste' | 'confuse'`; `type ScrollKind = 'identify' | 'engrave' | 'teleport' | 'map' | 'fear' | 'lure' | 'recharge'`.
- `s.lore: { colors: Record<PotionKind, string>; runes: Record<ScrollKind, string>; known: string[] }` — `newLore(seed)`; `potionName(s, k)` → `붉은 물약` or `신속 물약`; `scrollName(s, k)` → `「조르」 주문서` or `순간이동 주문서`; `identify(s, key)` emits `identify`.
- `Gear.potions: Partial<Record<PotionKind, number>>`, `Gear.scrolls: Partial<Record<ScrollKind, number>>` (no bag limit).
- `Consumable = { kind: 'potion'; p: PotionKind; name: string } | { kind: 'scroll'; sc: ScrollKind; name: string }`; `FloorItem.item: Equipment | Consumable`; walking over one picks it up.
- Actions (1 turn each): `{ kind: 'drink'; p }`, `{ kind: 'read'; sc }`, `{ kind: 'throwPotion'; p; at }` (range/line like flasks). Drinking/reading identifies; a thrown fire/poison/frost/confuse potion identifies by its effect; other thrown potions just shatter.
- Potions: strength `str+1`; cure clears burn/poison/freeze/confuse; invis 10 turns; fire/poison/frost drunk = that status on the hero, thrown = element r1 (fire [3,6], frost [2,4]); haste 5 turns (hero action cost ×0.5); confuse drunk 5 turns (each move 50% random direction), thrown = foes in r1 confused 5 turns (random step, no attack).
- Scrolls: identify (one unknown kind, preferring kinds the hero carries); engrave (pushes an `offerFor(s)` onto `s.offers` — the 3-choice modal); teleport; map (every tile seen, every trap found); fear (visible foes within 8 flee 5 turns); lure (loud noise 15 + every awake foe's lastSeen = hero); recharge (staffs to full).
- Invisible hero: updateAwareness skips; archers/mages do not shoot/telegraph; melee foes do not attack (walk to lastSeen); hero blows count as sneak attacks; any hero attack/throw ends it.
- Loot: chests 45% one consumable (potion 60% / scroll 40%); `scatterLoot(s)` puts 2 consumables on random room floor cells per floor.

**Tests:** same seed same lore, different seeds differ, every kind distinct colour/rune; names before/after identify; known survives `nextFloor`; each potion and scroll effect; thrown fire potion burns foes and identifies; invis hides from archer and ends on attack, gives sneak bonus; haste halves wait; confused hero moves sometimes elsewhere (seeded); feared foe steps away; pickup of a floor potion; chest can hold a consumable; scatterLoot not on hand maps.

### Task 3: Screen (view + UI)
**Files:** `src/view/grid/gridElements.ts` (found traps: `Trap_spikes`, `Trapdoor`, coloured plates), `gridItems.ts` (potion/scroll models), `gridRuntime.ts`/`comboCues.ts` (trap/identify/teleport cues, invisible hero ghosted), `ualActor.ts` (`setGhost`), `src/ui/grid/gridBag.ts` + new `consumablesPanel.ts` (potions/scrolls list: 마시기/던지기/읽기), `gridAim.ts` (aim a potion throw), `gridHud.ts` (buff chips, log lines), `gridControls.ts`/`gridScreen.ts` (`V` search, tap on the hero = search), styles; Test `tests/unit/gridLook.test.ts` (pure helpers only)
- Bag shows a 물약·주문서 section; unknown names show colour/rune, known show the kind. Throw enters aim mode like flasks.
- HUD chips: 신속 · 투명 · 혼란 · 그물. Log: 함정 발견, 함정 작동(종류), "붉은 물약은 신속 물약이었다".

### Task 4: E2E, README, review, push
- e2e: drink an unknown potion from the bag (name changes to the real one), read a map scroll, search key finds a planted trap, console clean. README section. Final review → one fix pass → push → CI.
