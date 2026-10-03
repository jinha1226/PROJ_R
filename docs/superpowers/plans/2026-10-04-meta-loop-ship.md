# Meta Loop — The Ship (Energy · Facilities · Death Suit · Saves · Walkable Deck) Implementation Plan

> **For agentic workers:** implemented by Codex in two runs — **Run A = Tasks 1–3 (sim + persistence)**, **Run B = Tasks 4–6 (ship deck view, screens, flow)**. Test-first for every sim rule and pure helper. Do not commit or push.

**Goal:** The second half of the meta loop: kills send energy to the crashed ship; energy buys facilities on a small walkable ship deck; dying leaves the suit on that floor to be recovered next run; progress and a run in progress are saved.

**Spec:** `docs/superpowers/specs/2026-10-03-meta-loop-core-design.md` §1 (shortcuts), §5 (death and suit), §6 (energy and facilities), §7 (walkable ship deck), §8 (saves). Overview: `docs/superpowers/specs/2026-10-03-meta-structure-design.md`.

## Constraints (every task)
- Sim (`src/sim/grid/**`) deterministic: no DOM/three/`Math.random`/`Date.now`; randomness only from `s.rng` or seed-derived `createRng` streams; never imports view/ui/app. **localStorage lives only in `src/app/**`.**
- Files ≤ 300 lines (`npm run lint`). Korean player text. Keep existing `data-testid`s. Other game modes are off limits. Do not edit `tests/e2e/**` (the reviewer updates e2e).
- Done = `npx tsc --noEmit -p .` · `npm run lint` · `npx vitest run` pass.

---

### Task 1: Meta state, energy and facilities (sim) + persistence (app)
- New `src/sim/grid/meta.ts`:
  ```ts
  export type FacilityId = 'armory' | 'suitlab' | 'nav';
  export interface MetaState {
    energy: number;
    facilities: { armoryShotgun: boolean; armoryRifle: boolean; suitSlots: 1 | 2 | 3; chargePlus: 0 | 1 | 2; navCrypt: boolean; navRuins: boolean };
    records: EngraveId[];                 // starts ['dash', 'rapid', 'chain', 'momentum']
    startCandidates: EngraveId[];         // from a recovered suit
    suit?: { floor: number; ids: EngraveId[]; killer: { kind: string; elite?: boolean } };  // the latest suit left in the dungeon
    bossesKilled: number[];               // floors 5 / 10 once cleared (unlock shortcuts for sale)
    best: number; wins: number;
  }
  export function freshMeta(): MetaState;
  export const SHOP: { id: string; name: string; cost: number; can(m: MetaState): boolean; apply(m: MetaState): void }[];
  //   산탄총 해금 80 · 소총 해금 120 · 시작 각인 칸 2 (100) / 3 (250, needs 2) · 충전 최대치 +2 (60) / +4 (140, needs +2)
  //   지름길: 지하 묘지(6층) 150 — needs bossesKilled includes 5 · 고대 유적(11층) 300 — needs 10
  export function buy(m: MetaState, id: string): boolean;   // spends energy if affordable and allowed
  export function energyFor(kind: FoeKind, floor: number, elite: boolean): number;
  //   base minion 2 · ghoul 3 · archer 3 · brute 4 · mage 4; × (1 + 0.15 × (floor − 1)); elite × 3; champion 60 on floors 5/10, 150 on 15; rounded
  export function unlockedGuns(m: MetaState): GunGroup[];   // pistol always
  ```
- Energy in the run: `settleKills` adds `energyFor(...)` to a new `s.run.energy` and pushes `{ type: 'energy', amount, to: foe cell }`.
- A run is created from the meta: `newRunState(seed, meta, opts: { gun: GunGroup; start: 1 | 6 | 11; startSuit: EngraveId[] })` (in `state.ts` or a new `runSetup.ts`): uses `meta.records` as `s.records`; `maxCharge = 10 + 2 × chargePlus`; start floor 1 → hero level 1 and `startSuit` (at most `suitSlots`) on the suit; start 6 → level 4, start 11 → level 7 (apply the level HP growth), empty suit. `GridSim.createRun(seed, meta, opts)` wraps it (keep `GridSim.create(seed)` working for tests).
- Settling a run: `settleRun(meta, s): MetaState` — `energy += s.run.energy`; records merged; best/wins updated; bosses killed recorded (floor of each champion killed: 5/10); if the hero died, `meta.suit = { floor, ids: s.hero.suit, killer: s.run.killedBy ?? { kind: 'self' } }` (replaces any older one; skip when the suit was empty); if the run recovered the suit (Task 2), `startCandidates` is already set.
- App: `src/app/gridMeta.ts` — `loadMeta()` / `saveMeta(m)` with key `projr.grid.meta.v1`; on first load, migrate `projr.grid.v1` `{ best, wins }`. Guard every storage access with try/catch.
- Tests (`tests/sim/grid/meta.test.ts`): `energyFor` values; `buy` spends and respects requirements and money; `newRunState` with each start floor (level, suit, maxCharge); `settleRun` adds energy, records, best/wins, bosses, and writes `meta.suit` on death (not on victory, not with an empty suit).

### Task 2: The suit left in the dungeon (sim)
- When a run reaches `meta.suit.floor` (at creation if it starts there, or on `nextFloor`), place a floor item `{ kind: 'suit', ids, name: '남겨진 슈트' }` on a free floor cell in the room **farthest from the start that is not the stairs room** (deterministic), and spawn one **guardian elite** next to it: the killer's kind if it was a foe (a champion killer → an elite brute), otherwise the floor's most common spawn kind; elite rules as usual (×1.6, echo on death).
- Walking onto it: remove it, emit `{ type: 'suit', text: ids.join(',') }`, set `s.run.recovered = ids`. `settleRun` then sets `meta.startCandidates = recovered` and clears `meta.suit`. If the hero dies again before recovering it, `settleRun` overwrites `meta.suit` with the new one (only the latest is kept).
- The suit is placed only on the matching floor and only once per run.
- Tests: placement on the right floor and not on others; guardian kind for a minion killer, a champion killer and a trap; pickup → `recovered`; `settleRun` start candidates and clearing; dying again replaces the suit.

### Task 3: Run save and continue (sim serialisation + app)
- `src/sim/grid/save.ts`: `toSave(s): string` / `fromSave(text): GridState` — JSON with `Set` (visible, fired) and `Uint8Array` (seen) converted; the rng restored from its state (`createRng` + `getState`; add a setter in `src/core/rng.ts` only if needed — it is shared, keep it backwards compatible). Round trip test: a state saved after N actions and restored produces the **same events** for the same next actions as the original.
- App: save after every action to `projr.grid.run.v1`; clear it when a run ends; the ship deck offers `이어하기` when one exists (Task 6).

---

### Task 4: Ship deck map and stations (sim)
- `src/sim/grid/ship.ts`: a hand-built deck (about 15 × 11) as rows, e.g. `#` wall, `.` floor, and station letters: `P` 복제 포드 (hero start), `A` 무기고, `S` 슈트 공방, `R` 기록 보관소, `N` 항법 콘솔, `C` 에너지 코어, `H` 출격 해치. `GridMap.stations?: { pos: Cell; id: StationId }[]`.
- `shipState(meta): GridState` — a state on that map: no foes, traps, chests, barrels or scattered loot; hero at the pod; `s.mode = 'ship'` (new optional field).
- Moving into a station cell does not move; it emits `{ type: 'station', text: id, to }` and costs 0 (time does not matter on the ship). Station cells are not walkable for tap-walk (`walkBlocked`).
- Tests: the map parses; every station exists once; bumping each station emits its id; nothing else in the state (no foes, no traps).

### Task 5: Ship deck look (view)
- Assets already in the repo: `public/assets/models/scifi/ship.glb` (props named `Prop_Locker`, `Prop_Desk_L`, `Prop_Desk_Medium`, `Prop_Shelves_WideTall`, `Prop_Shelves_ThinTall`, `Prop_SatelliteDish`, `Prop_HealthPack_Tube`, `Prop_Crate_Large`, `Prop_Crate`, `Prop_Chair`, `Prop_Barrel2_Closed`, `Prop_Chest`, `Prop_Ammo_Closed`; sizes in metres are real-world, e.g. the dish is 5.8 m tall — scale props to fit cells) and `public/assets/textures/ship/trim_wall.jpg`, `trim_floor.jpg`, `trim_red.jpg`.
- `src/view/grid/shipKit.ts` (load once, like `WeaponKit`) and `src/view/grid/shipTerrain.ts`: floor tiles with `trim_floor` (repeat per cell), walls as boxes with `trim_wall`, red trim strips with `trim_red`; cool blue-white ceiling-less lighting.
- Stations as props: pod → a large `Prop_HealthPack_Tube` (scaled up to ~1.8 m) + `Prop_Chair`; 무기고 → `Prop_Locker` ×2; 슈트 공방 → `Prop_Desk_L`; 기록 보관소 → `Prop_Shelves_WideTall`; 항법 → `Prop_SatelliteDish` (scaled to ~2 m) on a console (`Prop_Desk_Medium`); 에너지 코어 → a glowing cyan cylinder/crystal; 출격 해치 → a floor ring with red trim. Scatter a few crates/barrels as dressing.
- **Dark until powered**: each station area is dim until its facility is bought (pod, core and hatch always lit); buying lights it (a point light per station turned on).
- `GridRuntime` gains an option to build this ship terrain instead of the dungeon (`theme: 'ship'`), sharing the actor/camera/input code.
- A pure helper `stationLit(meta, id): boolean` is unit-tested.

### Task 6: Ship screen, station panels and the flow
- `GridFlow`: title `격자 출격` → **ship deck** (loading the ship kit too) → hatch → run → on the end, `settleRun` + `saveMeta` → result screen → back to the ship deck (`복제 포드에서 깨어났다`). `이어하기` on the ship when a saved run exists (Task 3).
- The ship screen reuses the grid screen's walking input (keys, stick, tap) — extract shared input if needed rather than duplicating; it shows a small HUD: energy, best floor, and where the suit was left (`7층에 슈트가 남아 있다`).
- Station panels (`src/ui/grid/ship/*.ts`), each with `data-testid="ship-panel-${id}"`:
  - 무기고: unlock guns (cost) and pick the starting gun among unlocked ones.
  - 슈트 공방: buy start slots / charge +2; list `startCandidates`.
  - 기록 보관소: the recorded engravings (name + note).
  - 항법 콘솔: buy shortcuts (only when that boss has been killed) and pick the start floor among unlocked ones.
  - 에너지 코어: energy and what was earned last run.
  - 출격 해치: summary (gun, start floor) + pick up to `suitSlots` start engravings from `startCandidates` (only for a floor-1 start) + `출격` (`data-testid="ship-launch"`).
  - Buying uses `buy()`, saves the meta, and lights the station.
- HUD during a run shows `s.run.energy` (e.g. `⚡전송 34`) and an `energy` cue shows a short upward beam/number at the kill cell (view).
- Tests: unit tests for the pure panel helpers (what each panel lists and enables for a given meta); flow functions that do not need the DOM.

## Verify
Run A and Run B each end with `npx tsc --noEmit -p .` · `npm run lint` · `npx vitest run` passing.
