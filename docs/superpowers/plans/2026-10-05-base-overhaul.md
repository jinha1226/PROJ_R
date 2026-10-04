# Base Overhaul (internals) — Implementation Plan

> **For agentic workers:** implemented by Codex in a git worktree. Tests first for every rule. Do not commit, push or stage. Do not edit `tests/e2e/**`. Do not tune balance numbers. **No UI work** beyond keeping existing panels compiling: the workbench screen and ship layout are built separately against the `workbenchModel` interface below.

**Goal:** Give the run loop a clear purpose — bring materials home to repair the crashed ship system by system, each repair opening ship functions and a suit tool that opens optional places in the dungeon; mod the pistol and suit from materials.

**Architecture:** Meta (`src/sim/grid/meta.ts` and new `src/sim/grid/ship*/` modules) gains materials, repairs, tools and mods. The run drops materials and keeps them in `s.run.materials` until settled. Elite kills offer engravings directly (no echo item). Map generation places tool-gated spots. A pure `workbenchModel(meta)` serves the UI.

**Tech Stack:** TypeScript, vitest; deterministic sim (no DOM, no `Math.random`, no `Date.now`; randomness from `s.rng`).

**Spec:** decided with the user 2026-10-05: currencies are energy, materials (4), engravings — the echo item goes; four materials (one per zone + elite remains) with catch-up; ship repair is the backbone (final 차원 코어 needs the floor-15 guardian's core); repairs grant three suit tools (절단기, 갈고리, 스캐너) that open optional spots; pistol and suit mods crafted from materials at the workbench. Clones come in a later plan.

## Global Constraints
- Files ≤ 300 lines (`npm run lint`). Korean player text, terse labels.
- Old meta and saved runs load (new fields default; old `echo` floor items are dropped).
- Done = `npx tsc --noEmit -p .` · `npm run lint` · `npx vitest run` pass.

## Review Focus
1. A tool-gated spot must never block the stairs path or trap the hero (the map stays fully reachable without tools).
2. Materials picked up in a run and then lost on death: decide by rule (below) and test both outcomes.
3. Repairs and mods survive a save/load round trip; fitted mods apply at run start exactly once.
4. Catch-up never pushes a drop chance above 1.
5. `workbenchModel` stays pure (no mutation of meta) — the UI calls it every render.

---

### Task 1: Elites offer engravings directly; elite remains

**Files:** `src/sim/grid/run.ts` (`settleKills` / where echo items are dropped), `absorb.ts`, `save.ts`; tests.
- When an elite (or a guardian) dies, push its family's 3-choice engraving offer to `s.offers` right away (same pool rules as `absorbOffer`). No `echo` floor item.
- It also drops a material floor item `{ kind: 'material', mat: 'remains', n: 1 }` (guardians: 3).
- Old saves: `echo` floor items are removed on load.
- Tests: killing an elite adds an offer and a remains item, no echo; an old save with an echo item loads without it.

### Task 2: Materials

**Files:** create `src/sim/grid/materials.ts`; `items.ts` (floor item kind), `weapons.ts` (`pickUp`), `consumables.ts` (`scatterLoot`), `run.ts` (foe drops), `meta.ts` (`settleRun`), `types.ts` (`RunState.materials`); tests `tests/sim/grid/materials.test.ts`.
```ts
export type Material = 'scrap' | 'soul' | 'relic' | 'remains';
export const MATERIAL_NAME: Record<Material, string> = { scrap: '고철', soul: '영혼 결정', relic: '고대 부품', remains: '정예 잔해' };
/** The zone's own material: cave scrap, crypt soul, ruins relic. */
export function zoneMaterial(floor: number): Exclude<Material, 'remains'>;
```
- Drops: an ordinary foe drops its zone material with chance 0.25 (n = 1); a chest adds one stack of n = 2–3; `scatterLoot` places 2 stacks per floor.
- Catch-up: `dropChance(meta, mat) = min(1, base × (stock < 5 ? 1.5 : 1))` where stock is `meta.materials[mat]`; the run copies `meta.materials` into `s.run.stock` at start for this.
- Picking up adds to `s.run.materials`. Settlement: a won run or an abandoned-alive run (if that exists) keeps all; **a death keeps half (rounded down)** — the rest stays with the left suit and comes back when the suit is recovered (add to `meta.suit.materials`, returned in `settleRun` when `s.run.recovered`).
- `meta.materials: Record<Material, number>` (fresh zeros).
- Tests: drop rates by rng stub; catch-up cap; death halves and the suit carries the rest; recovery returns it.

### Task 3: Ship repair

**Files:** create `src/sim/grid/repairs.ts`; `meta.ts`, `ship.ts` (station lighting uses repairs), `stationLit.ts`; tests `tests/sim/grid/repairs.test.ts`.
```ts
export type SystemId = 'workbench' | 'suitlab' | 'nav' | 'lifeSupport' | 'pod' | 'core';
export const SYSTEMS: Record<SystemId, { name: string; cost: Partial<Record<Material, number>>; needs?: SystemId[]; tool?: ToolId }> = {
  workbench:   { name: '작업대', cost: { scrap: 6 }, tool: 'cutter' },
  suitlab:     { name: '슈트 공방', cost: { scrap: 4, soul: 4 }, tool: 'grapple' },
  nav:         { name: '항법', cost: { soul: 3, relic: 3 }, needs: ['workbench'], tool: 'scanner' },
  lifeSupport: { name: '생명 유지', cost: { soul: 6, remains: 2 }, needs: ['suitlab'] },
  pod:         { name: '복제 포드', cost: { relic: 4, remains: 3 }, needs: ['lifeSupport'] },
  core:        { name: '차원 코어', cost: { relic: 8, remains: 5 }, needs: ['nav', 'pod'] },
};
export function canRepair(m: MetaState, id: SystemId): boolean;  // needs met, not repaired, materials enough; core also needs m.coreSecured
export function repair(m: MetaState, id: SystemId): boolean;     // spends, marks, grants the tool
```
- `meta.repairs: SystemId[]`, `meta.tools: ToolId[]`, `meta.coreSecured: boolean` (set by a won run — the floor-15 guardian's core). Repairing `core` sets `meta.departed = true` (the ending; UI later).
- Existing energy shop gating: suit-slot purchases need `suitlab` repaired; nav shortcuts need `nav`; engraving unlocks need `suitlab`; round unlocks (Part B of the engraving plan, if present) need `workbench`.
- Station powered state (`stationLit`) = the matching system repaired (pod/records/hatch always lit).
- Old meta: grant `workbench` and `suitlab` as repaired if the player already bought any of their old shop items (keeps progress).
- Tests: needs chain; costs spent; tool granted; core needs coreSecured; gating of shop items; old meta migration.

### Task 4: Suit tools open optional spots

**Files:** `src/sim/grid/mapgen.ts` (or a new `toolSpots.ts` called from it), `types.ts` (tiles), `actions.ts` (interacting), `runSetup.ts` (`s.run.tools` from meta); tests `tests/sim/grid/toolSpots.test.ts`.
- New tiles: `seal` (a sealed door; `절단기` opens it into `door`), `chasm` (impassable; with `갈고리` the hero can cross one chasm cell in a straight line as a single 2-cell move), and hidden rooms (a `wall` cell marked `hidden` that `스캐너` reveals as `door` when it comes into sight).
- Each floor places up to one spot of each kind, each guarding a small side room (3×3 to 4×4) holding a material stack (n = 3–4) and sometimes a chest. Spots are only placed where the rest of the floor (start, stairs, every ordinary room) stays reachable without tools — verify with a flood fill.
- Without the tool the spot is visible but blocked (the bump is a blocked action with event text `seal` / `chasm`).
- Tests: flood-fill reachability without tools over 50 seeds; cutter opens a seal; grapple crosses a chasm; scanner reveals a hidden door; without tools each is blocked.

### Task 5: Mods and the workbench model

**Files:** create `src/sim/grid/mods.ts` and `src/sim/grid/workbench.ts`; `meta.ts`, `runSetup.ts` (apply fitted mods); tests `tests/sim/grid/mods.test.ts`, `tests/sim/grid/workbench.test.ts`.
```ts
export type ModSlot = 'barrel' | 'mag' | 'sight' | 'grip' | 'chest' | 'arms' | 'legs' | 'back';
export type ModStat = 'gunDmg' | 'hit' | 'maxCharge' | 'noise' | 'swap' | 'maxHp' | 'evasion' | 'shield' | 'meleeDmg' | 'move';
export interface ModDef { id: string; slot: ModSlot; name: string; stats: Partial<Record<ModStat, number>>; cost: Partial<Record<Material, number>>; needs?: SystemId }
export const MODS: ModDef[];
```
Mods (12; stats are additive at run start):
| id | slot | name | stats | cost |
|---|---|---|---|---|
| longBarrel | barrel | 장총열 | hit +0.08 | scrap 4 |
| heavyBarrel | barrel | 중총열 | gunDmg +1, noise +2 | scrap 3, relic 2 |
| extMag | mag | 확장 탄창 | maxCharge +2 | scrap 5 |
| soulCell | mag | 영혼 전지 | maxCharge +4 | soul 4, remains 1 |
| redDot | sight | 점조준기 | hit +0.05 | scrap 3 |
| runeScope | sight | 룬 조준경 | hit +0.12 | relic 4 |
| quickGrip | grip | 속사 손잡이 | swap −0.25 (swap time) | scrap 4 |
| plating | chest | 강화 판 | maxHp +6 | scrap 6 |
| soulWeave | chest | 영혼 직조 | shield +3 at run start | soul 5 |
| servoArms | arms | 서보 팔 | meleeDmg +1 | scrap 4, soul 2 |
| sprintLegs | legs | 질주 다리 | evasion +0.05 | soul 3 |
| silencer | back | 소음 차폐 | noise −2 | relic 3, remains 1 |
- `meta.mods: { owned: string[]; fitted: Partial<Record<ModSlot, string>> }`. `craft(m, id)` spends materials, adds to owned; `fit(m, slot, id | null)`; one mod per slot. Crafting needs `workbench` repaired.
- The UI binds to exactly this (pure, no mutation):
```ts
export interface WorkbenchSlot { slot: ModSlot; part: 'pistol' | 'suit'; label: string; fitted: ModDef | null }
export interface WorkbenchOption { mod: ModDef; owned: boolean; craftable: boolean; missing: Partial<Record<Material, number>>; fitted: boolean }
export interface WorkbenchModel {
  open: boolean;                                   // workbench repaired
  materials: Record<Material, number>;
  slots: WorkbenchSlot[];                          // pistol: barrel, mag, sight, grip; suit: chest, arms, legs, back
  options(slot: ModSlot): WorkbenchOption[];
  stats(preview?: { slot: ModSlot; mod: string | null }): { label: string; now: number; next?: number }[]; // 피해, 명중, 충전, 소음, 체력, 회피, 보호막
}
export function workbenchModel(m: MetaState): WorkbenchModel;
```
- Tests: craft spends and owns; cannot craft without materials or before repair; fit/unfit; a new run applies fitted stats once; `stats` preview shows next values without changing meta.

## Verify
`npx tsc --noEmit -p .` · `npm run lint` · `npx vitest run`. Report changed files and every decision made.
