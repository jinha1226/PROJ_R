# Attack Button and PC Mouse Controls

> **For agentic workers:** implemented by Codex in a separate worktree. Test-first. Do not commit or push. Korean player text, terse (no explanatory sentences).

**Why (user, 2026-10-04):** "모바일에서 총 발사는 근접했을 때 공격키로 가능하게 하자" — answered: *when a foe is adjacent the button melees whatever is in hand* (a gun bashes, which also refills suit charge). "PC 조작은 마우스랑 WASD 둘 다" — WASD/QEZC/arrows/numpad already move; add the mouse.

**Context:** TypeScript grid roguelike. Sim in `src/sim/grid/**` (deterministic, no DOM). The grid screen is `src/ui/grid/gridScreen.ts` (288 lines — the file limit is 300, `npm run lint` checks it, so put new logic in new files). Actions are `GAction` (`src/sim/grid/types.ts`): melee is `{ kind: 'move', dir }` into a foe's cell (see `src/sim/grid/actions.ts` ~line 79: a diagonal melee needs `canStep(s.map, h.pos, dir)`), shooting is `{ kind: 'shoot', target }`, swapping hands `{ kind: 'swap' }`. `WEAPONS[group].melee` tells melee from ranged (`src/sim/grid/items.ts`); `activeWeapon(gear)` is the hand in use (`src/sim/grid/gear.ts`); `shootable(s)` / `autoTarget(s)` are in `actions.ts`; `GridSim.autoTarget()` and `GridSim.shotChance(id)` exist. The command handler is `GridScreen.onCmd`-style code at gridScreen.ts ~163 (`if (c === 'shoot') …`), taps go to `onTap` (~194), the fire button label is set at ~265 via `this.touch?.setFire(group, label, sub)` (`src/ui/grid/gridTouch.ts`). `this.rt?.cellAt(clientX, clientY)` maps a screen point to a cell. Keyboard: `F` = 'shoot' command (`src/ui/grid/gridControls.ts`).

## Global constraints
- `npx tsc --noEmit -p .` · `npm run lint` · `npx vitest run` pass. Do not edit `tests/e2e/**` (but keep `data-testid`s unchanged — e2e uses `grid-shoot`, `grid-wait`, etc.).
- Files ≤ 300 lines. Sim stays deterministic.

### Task 1: One attack rule for the button, `F` and the gamepad
- Create `src/ui/grid/attackChoice.ts` with a pure function:
  ```ts
  export type AttackChoice = { kind: 'melee'; action: GAction; foe: string } | { kind: 'shoot'; action: GAction; foe: string } | { kind: 'swap' } | null;
  export function attackChoice(s: GridState, target: string | undefined): AttackChoice
  ```
  Rule, in order:
  1. **Adjacent foe** (alive, visible, Chebyshev distance 1, and reachable: orthogonal, or diagonal with `canStep(s.map, s.hero.pos, dir)`): prefer `target` (or `s.hero.target`) when it is adjacent, otherwise the first adjacent foe in `s.foes` order → `{ kind: 'melee', action: { kind: 'move', dir }, foe }` — **whatever is in hand** (gun, staff, empty hand, melee weapon).
  2. Else, the hand in use is ranged (not `melee`, not empty) and `target` is set and in `shootable(s)` → `{ kind: 'shoot', action: { kind: 'shoot', target }, foe: target }`.
  3. Else the hand in use is melee or empty and the other hand is ranged → `{ kind: 'swap' }`.
  4. Else `null`.
- In gridScreen's `'shoot'` command branch use it: `const c = attackChoice(s, this.api.sim.autoTarget() ?? s.hero.target)`; melee/shoot → `doAction(c.action)` (set `s.hero.target = c.foe` first), swap → `doAction({ kind: 'swap' })`.
- Fire button label (gridScreen ~265): when `attackChoice(...)` is melee → label `근접`, sub = the hand's name or `맨손`; shoot → keep today's `사격 <name>` and `충전 a/b · nn%`; swap → `교체` / `원거리로` (today's text). Keep the throwing override line after it.
- Tests `tests/unit/attackChoice.test.ts` (build states with the sim kit — see `tests/sim/grid/kit.ts`: `sim(OPEN, heroCell, foes)`, `makeWeapon`):
  - pistol in hand + adjacent foe → melee into it (dir correct), even when a farther foe is the target;
  - adjacent target preferred over another adjacent foe;
  - diagonal foe behind a wall corner is not "adjacent" → with a pistol it is shot instead;
  - pistol, foe 3 cells away → shoot that target;
  - sword in hand, no adjacent foe, pistol in the other hand → swap; sword with no ranged other hand → null;
  - empty hands + adjacent foe → melee.

### Task 2: Mouse on PC
- Create `src/ui/grid/mouseAim.ts`, attached by gridScreen to the stage element (return a detach function and push it to `this.cleanup`). Only for `pointerType === 'mouse'` (touch and pen keep today's behaviour).
  - **Hover**: on `pointermove`, when the cell under the cursor holds an alive, visible foe, set `s.hero.target` to it (only when it changes) and set the stage's CSS cursor to `crosshair`; otherwise cursor `default`. Do not act.
  - **Left click on a foe**: set it as the target, then run the Task 1 rule with that foe as `target`: melee/shoot → act; otherwise (e.g. sword in hand, foe far away) just keep it targeted. Tapping with touch stays target-only.
  - **Left click on a floor cell**: unchanged (walks there, via today's `onTap`).
  - **Right click**: `preventDefault()` the context menu; cancels a walk in progress and the throw aim if one is open (whatever `cancel` does today).
- gridScreen's tap handler must not double-handle a mouse click on a foe (route mouse clicks on foes to mouseAim, everything else unchanged).
- Tests `tests/unit/mouseAim.test.ts` with a fake stage element (jsdom is available if the vitest config uses it — check `vitest.config.ts`; otherwise test the pure decision helper you extract, e.g. `mouseClickChoice(s, cell)` returning `'target' | AttackChoice | 'walk' | null`).

### Task 3: Key hint
- PC key hints on the fire button stay `[F]`. No other UI text.

## Verify
`npx tsc --noEmit -p .` · `npm run lint` · `npx vitest run`. In your final reply list the files changed and any decision you had to make.
