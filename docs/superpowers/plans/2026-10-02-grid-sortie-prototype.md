# Grid Sortie Prototype Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A playable Jupiter Hell–style single-character grid sortie (turn-based, time-cost actions, non-blocking animation) as a separate title mode.

**Architecture:** A new deterministic grid sim (`src/sim/grid/*`) resolves each player action instantly and returns time-stamped events; a new view layer (`src/view/grid/*`) chases logical positions with exponential decay and replays events compressed (1.0 turn → 0.18 s, ×3 catch-up on new input); new UI/flow (`src/ui/grid/*`, `src/app/gridFlow.ts`) wires input → sim → playback. Only assets and generic infra (rng, renderer, Actor, EnvLibrary, zoom math, DamageNumbers, TransientFx) are reused.

**Tech Stack:** TypeScript, three.js, Vite, Vitest, Playwright.

**Spec:** `docs/superpowers/specs/2026-10-02-grid-sortie-prototype-design.md`

## Global Constraints

- Sim has no DOM, three.js, `Math.random`, `Date.now`; randomness only from `createRng` (`src/core/rng.ts`). Same seed + same action list → same state.
- Files ≤ 300 lines (`npm run lint` runs `scripts/check-file-length.mjs`); layering core → data → sim → app → view/ui.
- Existing party extraction code is not modified (only `titleScreen.ts`/`main.ts` gain a button and a route).
- Player-facing text in Korean. Touch buttons ≥ 56 px. Portrait first, landscape works.
- Commit messages end with `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.

## Review Focus

1. **Input never waits for animation** — a held stick at 0.14 s/step must not desync view from sim (view lag is bounded by the chase formula; events from a superseded turn are fast-forwarded, not dropped).
2. **Turn order ties and slow units** — a 1.4-cost brute must act ~5 times per 7 hero moves; ties resolve hero-first then id order; no infinite loop when all foes are dead or asleep.
3. **Line of sight/cover symmetry** — enemy archers use the same LOS and hit formula as the hero; diagonal corner-cutting is forbidden for movement and also blocks LOS through a closed corner.
4. **Path-walk interruption** — tap-to-walk must stop when a new enemy becomes visible or the hero is hit, never walk into an enemy (no accidental bump).
5. **Outcome finality** — after `extracted`/`dead`, `act()` is a no-op and the result screen fires exactly once.

---

## File Structure

| File | Responsibility |
|---|---|
| `src/sim/grid/types.ts` | Tile, Cell, Ent, Hero, Chest, GridMap, GridState, GAction, GEvent, constants |
| `src/sim/grid/mapgen.ts` | rooms + corridors + doors + pillars + chests + exits + foe spawns |
| `src/sim/grid/fov.ts` | shadowcasting visibility; `losClear` (Bresenham, corner rule) |
| `src/sim/grid/path.ts` | BFS path on walkable tiles (optional blockers) |
| `src/sim/grid/combat.ts` | `hitChance`, `inCover`, damage rolls, `applyDamage` |
| `src/sim/grid/actions.ts` | hero actions: move/bump/open, shoot, reload, wait, potion |
| `src/sim/grid/ai.ts` | foe turn: wake, chase, melee, archer spacing/shoot |
| `src/sim/grid/clock.ts` | scheduler: run foes until hero's turn; danger clock; extraction |
| `src/sim/grid/gridSim.ts` | `GridSim.create(seed)`, `act(a)`, `autoTarget()`, `stepToward(cell)` |
| `src/app/input/gridInput.ts` | pure: 8-dir quantize, hold-repeat timer |
| `src/view/grid/chase.ts` | pure: exponential-decay chase |
| `src/view/grid/playback.ts` | pure: event queue with compression and catch-up |
| `src/view/grid/gridTerrain.ts` | instanced floor/walls + env props (pillars, chests, torches, exits, doors) |
| `src/view/grid/gridActors.ts` | Actor per entity, chase, bump/recoil/hit animations |
| `src/view/grid/gridFx.ts` | bolt projectile, numbers, hit-stop, shake, aim line, intent icons |
| `src/view/grid/gridFog.ts` | per-tile visibility shading |
| `src/view/grid/gridRuntime.ts` | scene + camera + the pieces above; `apply(events)`, `update(dt)` |
| `src/ui/grid/gridScreen.ts` | loop: input → sim → runtime; debug hook |
| `src/ui/grid/gridHud.ts` | HP, bolts/loaded, potions, turn, value, danger, target % |
| `src/ui/grid/gridTouch.ts` | stick + buttons (fire/reload/wait/potion/◀▶) |
| `src/ui/grid/gridResult.ts` | result screen |
| `src/ui/styles/grid.css` | styles |
| `src/app/gridFlow.ts` | title → loading → sortie → result; `projr.grid.v1` |

---

### Task 1: Grid map, FOV, path

**Files:** Create `src/sim/grid/{types,mapgen,fov,path}.ts`; Test `tests/sim/grid/map.test.ts`

**Interfaces — Produces:**
```ts
export type Tile = 'floor' | 'wall' | 'door' | 'open' | 'pillar';   // 'open' = opened door
export interface Cell { x: number; y: number }
export type FoeKind = 'minion' | 'archer' | 'brute';
export interface Room { x: number; y: number; w: number; h: number }
export interface GridMap { w: number; h: number; tiles: Tile[]; rooms: Room[]; start: Cell; exits: Cell[]; chests: Cell[]; spawns: { kind: FoeKind; pos: Cell; group: number }[] }
export const idx = (m: { w: number }, c: Cell) => c.y * m.w + c.x;
export const tileAt = (m: GridMap, c: Cell): Tile;           // out of bounds → 'wall'
export const walkable = (t: Tile) => t === 'floor' || t === 'open' || t === 'door';
export const opaque = (t: Tile) => t === 'wall' || t === 'door' || t === 'pillar';
export function generateMap(seed: number): GridMap;          // 48×48
export function computeFov(m: GridMap, from: Cell, radius: number): Set<number>;  // tile indices
export function losClear(m: GridMap, a: Cell, b: Cell, blockers?: (c: Cell) => boolean): boolean;
export function findPath(m: GridMap, from: Cell, to: Cell, blocked?: (c: Cell) => boolean): Cell[] | null; // excludes from, includes to
export const DIRS: Cell[];  // 8 directions
export function canStep(m: GridMap, from: Cell, d: Cell): boolean; // diagonal needs both side tiles walkable
```
- [ ] Tests: map 48×48 with ≥ 8 rooms; start and both exits walkable and mutually reachable (`findPath`); every chest/spawn on a floor tile, no spawn in the start room; same seed → identical tiles; `computeFov` sees through floor but not past a wall (hand map); `losClear` false through a pillar, true along open floor, false squeezing between two diagonal walls; `canStep` diagonal blocked when one side is wall; `findPath` routes around walls and returns null when sealed.
- [ ] Implement: rooms by rejection sampling (5–9 × 5–9, 1-tile gap), connect consecutive rooms (sorted by x) with L-shaped 1-wide corridors, doors where a corridor enters a room wall (when that tile was wall), 0–2 pillars inside rooms ≥ 7×7 (not blocking the room's door tiles), start = room 0 centre, exits = centres of the two rooms farthest from start (BFS distance), chests 1 per non-start room (60%), spawns 1–3 per non-start room (minion 55%, archer 30%, brute 15%), group = room index. Shadowcasting: recursive 8-octant (radius check `dx²+dy² ≤ r²+r`), opaque tiles visible but block. `losClear`: Bresenham from a to b excluding endpoints; any opaque or `blockers` cell → false; on a diagonal step where both side tiles are opaque → false.
- [ ] Run `npx vitest run tests/sim/grid/map.test.ts` → PASS; commit `sim(grid): map generation, field of view, paths`.

### Task 2: State, actions, combat, scheduler

**Files:** Create `src/sim/grid/{combat,actions,clock,gridSim}.ts`, extend `types.ts`; Test `tests/sim/grid/actions.test.ts`

**Interfaces — Produces:**
```ts
export interface Ent { id: string; kind: 'hero' | FoeKind; pos: Cell; hp: number; maxHp: number; nextAt: number; alive: boolean; awake: boolean; group: number; lastSeen?: Cell }
export interface Hero extends Ent { kind: 'hero'; loaded: boolean; bolts: number; potions: number; value: number; loot: { name: string; value: number }[]; target?: string; exitTime: number }
export interface ChestState { pos: Cell; opened: boolean }
export interface GridState { seed: number; time: number; map: GridMap; hero: Hero; foes: Ent[]; chests: ChestState[]; seen: Uint8Array; visible: Set<number>; rng: Rng; events: GEvent[]; outcome?: 'extracted' | 'dead'; closedExits: number[]; alarms: number }
export type GAction = { kind: 'move'; dir: Cell } | { kind: 'shoot'; target?: string } | { kind: 'reload' } | { kind: 'wait' } | { kind: 'potion' };
export interface GEvent { t: number; type: GEventType; src?: string; dst?: string; from?: Cell; to?: Cell; amount?: number; crit?: boolean; text?: string }
export type GEventType = 'move' | 'bump' | 'shoot' | 'hit' | 'miss' | 'die' | 'door' | 'open' | 'loot' | 'reload' | 'heal' | 'wake' | 'blocked' | 'alarm' | 'reinforce' | 'exitClosed' | 'extracting' | 'extracted' | 'dead';
export const COST = { move: 1, melee: 1, shoot: 1, reload: 1.5, wait: 1, potion: 1, open: 0.5 };
export const HERO = { hp: 30, bolts: 12, potions: 2, sight: 8, range: 8, heal: 12, melee: [6, 9], bolt: [5, 8], meleeHit: 0.9 };
export const FOES: Record<FoeKind, { hp: number; move: number; dmg: [number, number]; range: number; hit: number }>;
// minion {10,1,[3,5],1,0.8} archer {8,1,[3,5],7,0.85} brute {20,1.4,[6,9],1,0.8}
export function hitChance(m: GridMap, from: Cell, to: Cell, base: number): number; // base − 0.04·(dist−1), −0.30 cover, min 0.05; dist = Chebyshev
export function inCover(m: GridMap, shooter: Cell, target: Cell): boolean;
export class GridSim { static create(seed: number): GridSim; readonly s: GridState; act(a: GAction): GEvent[]; autoTarget(): string | undefined; shotChance(id: string): number | null; }
```
- [ ] Tests (use a hand-built `GridState` helper `tests/sim/grid/kit.ts` making an open 15×15 room with walls around, hero at (7,7), placing foes by kind/pos, seed fixed):
  - move onto floor: hero pos changes, time +1, event `move`; into wall: no time spent, event `blocked`.
  - diagonal past a wall corner refused.
  - bump: foe adjacent, `move` toward it → `bump` + `hit`/`miss`, foe hp drops on hit, hero did not move.
  - shoot: loaded → `shoot` event, `loaded=false`, bolts −1; shoot again → refused (`blocked`, no time); reload → time +1.5, loaded.
  - hit chance: dist 1 → 0.85, dist 6 → 0.65, target beside a wall on the shooter side → −0.30, never below 0.05; shot through a pillar refused.
  - potion heals +12 capped at maxHp, potions −1.
  - entering a door tile turns it `open` and emits `door`; bumping/stepping onto a chest cell opens it (`open` + `loot` events, value added, bolts/potions maybe).
  - scheduler: brute (move 1.4) awake and chasing acts 5 times over 7 hero waits; two foes with equal `nextAt` act in id order; hero acts first on a tie.
  - foe killed → `die`, removed from turn order (alive=false); `autoTarget` returns nearest visible living foe with LOS, keeps the previous target while valid.
- [ ] Implement `GridSim.act`: if outcome → `[]`. Resolve hero action (refusals cost nothing and return `[blocked]`), add cost to `hero.nextAt`, then `runUntilHero(s)` (clock.ts): repeatedly take the living awake foe with smallest `nextAt` < hero.nextAt (ties → id), call `foeTurn` (Task 3 stub: wait cost 1), add its cost; finally `s.time = hero.nextAt`, recompute FOV (`visible`, `seen`), danger/extraction hooks (Task 3). Events carry `t` = actor's `nextAt` before acting. Damage: `rng.int`, crit = rolled max.
- [ ] Run tests → PASS; commit `sim(grid): actions, combat, turn scheduler`.

### Task 3: Foe AI, waking, danger clock, extraction

**Files:** Create `src/sim/grid/ai.ts`; Modify `clock.ts`, `gridSim.ts`; Test `tests/sim/grid/ai.test.ts`

**Interfaces — Produces:** `foeTurn(s, foe): number` (returns time cost); `wakeGroup(s, group)`; `noise(s, at, radius)`; constants `DANGER = { alarm: 200, reinforce: 300 }`, `EXIT_TIME = 3`.
- [ ] Tests:
  - asleep foe not in hero's FOV never moves; once the hero is visible to it (hero in foe's FOV radius 8 and LOS) it wakes, emits `wake`, and its room group wakes.
  - shooting wakes sleeping foes within 6 tiles (`noise`).
  - minion chases along a path and bumps the hero when adjacent (hero hp drops on hit).
  - archer at distance 2 with an open tile behind steps away; at distance 5 with LOS shoots (`shoot` src=archer); without LOS moves to a tile that has LOS.
  - danger: at time ≥ 200 one `alarm` event and some sleeping foes awake; at ≥ 300 a `reinforce` event spawns ≥ 2 minions out of hero sight and an `exitClosed` closes one exit (exit tile no longer counts).
  - extraction: hero on an open exit tile accumulates `exitTime` by spent time; at ≥ 3 → outcome `extracted`, event `extracted`; leaving resets to 0; hp ≤ 0 → outcome `dead`, `hero.value = 0`, event `dead`; after outcome `act()` returns `[]`.
  - determinism: the same seed and the same 40-action list produce identical `hero`, foe positions and `time`.
- [ ] Implement AI: awake foes track `lastSeen` (hero pos when visible); melee kinds: adjacent to hero → attack (hit roll vs `FOES.hit`), else step along `findPath` toward `lastSeen` treating other living foes as blocked (no path → wait 1); archer: dist ≤ 2 → step to the neighbour maximising distance (if none, melee-swing for 1–2), 3 ≤ dist ≤ 7 with `losClear` (other foes block) → shoot with `hitChance(base 0.85)`, else step along path toward the nearest tile within 3–6 with LOS (fallback: toward hero). Asleep foes cost 1 and only check sight.
- [ ] Run tests → PASS; commit `sim(grid): foe AI, waking, danger clock, extraction`.

### Task 4: Pure view/input helpers

**Files:** Create `src/app/input/gridInput.ts`, `src/view/grid/{chase,playback}.ts`; Test `tests/unit/gridFeel.test.ts`

**Interfaces — Produces:**
```ts
// gridInput.ts
export function quantize8(x: number, y: number, dead = 0.35): Cell | null;  // screen-space vector → 8-dir (screen y down = +y)
export class HoldRepeat { constructor(first = 0, every = 0.14); update(dir: Cell | null, dt: number): Cell | null; reset(): void }  // emits dir immediately on press, then every 0.14 s while held; changing dir emits immediately
// chase.ts
export const CHASE_K = 18;
export function chase(cur: number, target: number, dt: number, k = CHASE_K): number;
// playback.ts
export const TURN_SEC = 0.18; export const STAGGER = 0.03; export const CATCHUP = 3;
export interface Cue { at: number; ev: GEvent }
export class Playback { push(events: GEvent[], startTime: number): void; hurry(): void; update(dt: number): GEvent[]; get busy(): boolean }
```
- [ ] Tests: `quantize8(1,0)`→(1,0), `(0.7,0.7)`→(1,1), `(0.1,0.1)`→null, `(-1,0.2)`→(-1,0); HoldRepeat emits on first update, not again until 0.14 s, again at 0.28 s, immediately on direction change, null after release; `chase` halves the gap in ln2/k seconds and never overshoots; Playback: events at t=0 and t=1 of a pushed batch fire at 0 s and 0.18 s; two events with equal t from different actors are staggered 0.03 s; `hurry()` makes the remaining cues fire 3× sooner; `busy` false once drained.
- [ ] Implement; run tests → PASS; commit `view(grid): chase, event playback, 8-way hold input`.

### Task 5: Grid view

**Files:** Create `src/view/grid/{gridTerrain,gridActors,gridFx,gridFog,gridRuntime}.ts`

**Interfaces — Consumes:** `createScene`, `Actor` (`play`, `setLocomotion`, `flash`, `setDead`, `update`, `root`), `AssetLibrary`, `EnvLibrary.clone(ref, {width,height,radius})`, `TransientFx` (`slash`, `burst`), `DamageNumbers.show(text, kind, left, top)`, `IsoCamera`-like top-down camera (new: elevation 60°, no yaw changes), `clampZoom`.
**Produces:** `class GridRuntime { constructor(el: HTMLElement, sim: GridSim, lib: AssetLibrary, env: EnvLibrary, mobile: boolean); apply(events: GEvent[], startTime: number): void; hurry(): void; update(dt: number): void; setZoom(h: number): void; get zoom(): number; cellAt(clientX: number, clientY: number): Cell | null; dispose(): void }`; `CELL = 1.4` metres.
- Terrain: one InstancedMesh for floor tiles (dark stone), one for walls (box CELL×2.2×CELL, stone colour), pillars/chests/torches (on some wall faces next to rooms)/doors via `EnvLibrary` clones (`dungeon/pillar`, `dungeon/chest`, `dungeon/torch`, `graveyard/arch` for doors), exits as a glowing green ring; closed exit turns red.
- Actors: hero `Knight` with `{weapon:'1H_Sword', helmet:false, cape:true}`; minion `Skeleton_Minion` Blade; archer `Skeleton_Rogue` Crossbow; brute `Skeleton_Warrior` Axe+Shield_Small scale 1.15. Visual pos chases logical pos (`chase`), facing turns toward movement/target; locomotion speed from visual velocity.
- Event visuals (on cue): `move` set target; `bump` lunge 0.3 cell toward dst and back over 0.12 s + `attack1h`; `shoot` `shoot1h`/`shoot2h` + recoil 0.1 cell + bolt projectile (0.08 s per 4 cells, trail) then `hit`/`miss`; `hit` flash + number + 0.06 s hit-stop (freeze actor/fx updates, not input) + 0.15-cell shove; crit → camera shake 0.12 s; `miss` "빗나감" + dust burst; `die` `setDead`; `door` swap closed→open model; `open`/`loot` floating "+이름 N G"; `heal` green number.
- Fog: per-tile shade (visible 1.0, seen 0.35, unknown 0) via instance colour on floor/walls; actors/props hidden on non-visible tiles.
- Aim line: when an awake archer has LOS to the hero, a thin red line from it to the hero; intent icon above awake foes (`!` approaching, `◎` aiming).
- Camera: orthographic, elevation 60°, fixed yaw (north up), follows hero visual pos with chase k=8, view height from zoom (default portrait 13 / landscape 10).
- [ ] Verify with `npx tsc --noEmit -p .` and `npm run lint`; visual check happens in Task 6. Commit `view(grid): terrain, actors, effects, fog, runtime`.

### Task 6: Screen, HUD, touch, flow, title entry

**Files:** Create `src/ui/grid/{gridScreen,gridHud,gridTouch,gridResult}.ts`, `src/ui/styles/grid.css`, `src/app/gridFlow.ts`; Modify `src/ui/run/titleScreen.ts` (button `data-testid="to-grid"` `격자 출격 (시험)`, api `grid()`), `src/app/main.ts` (route).
- Screen loop each frame: read keyboard/pad/touch → at most one action per frame when `sim` is waiting: held direction via `HoldRepeat`; tap path walking (one step per 0.14 s via `findPath`, stop when a new foe becomes visible, when hit, or when the next step holds a foe); fire = `shoot` at current target (if unloaded → `reload`); keys per spec §4. On every action: `runtime.hurry()` then `runtime.apply(events, startTime)`; update HUD; outcome → after 1.2 s show result.
- Keyboard: WASD + QEZC + numpad 1–9 (5 = wait), arrows; F shoot, Tab cycle target, R reload, Space wait, 1 potion. Pad: left stick quantized, A shoot, LB/RB cycle, X reload, Y potion, B wait (read `navigator.getGamepads()` directly).
- Touch: floating stick on the left (quantized, hold-repeat), right-bottom buttons: 사격 (big, shows `NN%` or `장전`), 쉬기, 물약 (count), ◀ ▶ target; tap on the canvas (not on controls) → `runtime.cellAt` → foe? set target : walk there.
- HUD: HP bar, `볼트 n (장전됨/빔)`, `물약 n`, `턴 t`, `가치 nG`, danger line (`위험: 200턴 순찰 · 300턴 증원`), extraction progress when on an exit, last log line.
- Result: `탈출 성공`/`사망`, value, loot list, total banked gold (`projr.grid.v1` `{gold}` in try/catch), buttons `다시`(new seed) / `타이틀`.
- Debug hook `window.__PROJR_GRID__ = { state(), act(a: GAction), seed }`.
- Portrait/landscape via existing `watchLayout`; zoom buttons/wheel/pinch through the existing `ZoomControl`-style logic (reuse `src/app/input/zoom.ts` math; separate key `projr.grid.zoom`).
- [ ] Manual verification: `npm run build` + Playwright screenshot (portrait 390×844) after a few moves and a shot; look at it. Commit `ui(grid): sortie screen, HUD, touch controls, result, title entry`.

### Task 7: E2E, README, push

**Files:** Create `tests/e2e/grid.spec.ts`; Modify `README.md`
- [ ] e2e: title → `to-grid` → wait for `__PROJR_GRID__` → `act({kind:'move',...})` toward a walkable neighbour and check `state().time` grew → `act({kind:'shoot'})`/`reload` don't throw → force outcome by walking? (use hook `state().hero.hp = 0` then `act({kind:'wait'})`) → result screen visible → `다시` returns to a new sortie; portrait viewport: touch fire button box ≥ 56 px; console errors = 0.
- [ ] README section `격자 출격 (시험)` with controls; full `npx vitest run`, `npm run lint`, `npm run build`, `npx playwright test` green; commit; push main; verify CI.
