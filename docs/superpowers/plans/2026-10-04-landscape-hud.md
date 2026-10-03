# Landscape HUD (Jupiter Hell–style) Implementation Plan

> **For agentic workers:** one task, test-first for the pure helpers. Implemented by Codex in a separate worktree, reviewed with screenshots afterwards. Do not commit or push.

**Goal:** A tidy, game-like HUD for the grid sortie in **landscape**, laid out after Jupiter Hell (map as large as possible, compact info in the corners) and adapted to a phone held sideways, where the two bottom corners belong to the thumbs. The same layout serves PC landscape. Portrait must keep working but is not redesigned.

**Context:** The game is a turn-based grid roguelike (TypeScript + three.js; DOM overlay HUD). Current HUD: `src/ui/grid/gridHud.ts` (top bar with level badge, HP, resources, weapon; target card; floor line; one-line log; help line), touch controls `src/ui/grid/gridTouch.ts` (left stick, right buttons), throwables row `src/ui/grid/gridBelt.ts`, zoom/pixel buttons (`src/ui/extract/zoomControl.ts`, created in `gridScreen.ts`), styles `src/ui/styles/grid.css`. Engraving pop-ups and the combo counter live in `src/view/grid/engravePops.ts`. The screen class is `src/ui/grid/gridScreen.ts`; it toggles `.landscape` / `.portrait` on `.screen.grid`.

## Constraints
- Files ≤ 300 lines (`npm run lint` checks). Korean player text. No new dependencies.
- **Only these files**: `src/ui/grid/**` (except `levelUp.ts` — another task is editing it right now), `src/ui/styles/grid.css`, `src/view/grid/engravePops.ts` (position only), new unit tests under `tests/unit/`. Keep `gridScreen.ts` edits minimal (another task touches it too). Do not edit `src/sim/**` or `tests/e2e/**`.
- Keep every existing `data-testid` working (e2e relies on them): `grid-stats`, `grid-bag-*`, `grid-use-*`, `grid-shoot`, `grid-wait`, `grid-potion`, `grid-prev`, `grid-next`, `grid-pixel`, `zoom-in`, `zoom-out`, `grid-aim-go`, `grid-levelup*`, `grid-pack-*`, `grid-drink-*`, `grid-read-*`, `grid-suit`, etc.
- Touch targets stay ≥ 48 px (main buttons ≥ 56 px) on phones.
- Target viewports to design for: phone landscape **844×390** (also 740×360), PC **1280×720**. Respect `env(safe-area-inset-*)`.

## Layout (landscape)
```
┌──────────────────────────────────────────────────────────────────┐
│ ♥ 28/35 ██████  ⚡7/10 ███   › message 1 (newest)      ┌────────┐│
│ Lv4 ▬▬▬▬ · 7층 지하 묘지      › message 2               │target  ││
│ 화상3 신속2                   › message 3 (faded)       │card    ││
│                                                         └────────┘│
│                       (map)                         [＋][－][도트]│
│                                                  [2폭탄][3화염]  │
│   (stick)                                       [교체:장검][물약]│
│            [돌진][연사][기세][연쇄][  ][  ]       [가방] [쉬기]   │
│                 suit engravings                  [ 사격 권총 ⚡7 ]│
└──────────────────────────────────────────────────────────────────┘
```
1. **Top-left — vitals panel** (one compact panel): HP bar with numbers, suit charge bar `⚡ charge/max`, level + XP bar, `${floor}층 ${zone}` and kills in small text, status/buff chips. Replaces the old badge/top bar in landscape. (Class badge text is gone already — no classes.)
2. **Top-centre — message log**: keep the last **3** log lines (newest on top), each fading out over ~4 s; warnings tinted red. Replaces the single centred toast in landscape. The HUD's `cue(e)` keeps producing the lines it does today.
3. **Top-right — target card**: name (prefix `정예 ` for elites), HP bar, hit chance, and **next intent**: `회전 베기 준비` when that foe has a whirl telegraph, `주문 준비` for a spell telegraph, `조준 중` when it is an archer that can shoot the hero this turn, `잠듦` when asleep, otherwise nothing. Zoom/pixel buttons sit just under the card, small.
4. **Bottom-centre — suit strip**: the suit's 6 slots as small labelled tiles (engraving name, empty tiles dim). A tile is **lit** when the engraving fits the weapon in hand and **dim** when it does not (use `fitsHand` from `src/sim/grid/engraveCore.ts`). When an `engrave` event for that id plays, the tile flashes (~0.4 s). `data-testid="grid-suit-strip"`, tiles `grid-suit-tile-${n}`.
5. **Bottom-right — actions** (mobile: the existing touch buttons re-arranged into a thumb cluster; PC: the same cluster shown as clickable buttons with key hints): big **사격** button showing the gun in hand and charge (or `교체` when a melee weapon is in hand, as today), **교체** button showing the other hand's weapon, 물약, 가방, 쉬기, ◀▶ target; the throwables row (`gridBelt`) just above the cluster. On PC (non-touch) show the cluster too, with key labels (F, X, 1, I, Space, Tab).
6. **Bottom-left**: the stick on touch devices (unchanged behaviour); nothing on PC except the help line moved into a small `?` toggle (or dropped in landscape).
7. **Long-press a foe** (touch, ≥ 400 ms without moving) selects it as the target, so the target card shows its info (no action is taken).
8. Engraving pop-ups and the combo counter (`engravePops.ts`) move to the upper-middle of the map so they do not cover the suit strip or the log.

## Pure helpers to write first (unit-tested, `tests/unit/gridHudLayout.test.ts`)
- `intentOf(s, foe): string` in a new `src/ui/grid/intent.ts` — the rules in item 3 (build states with `newState` + `handMap` from `tests/sim/grid/kit.ts`, add telegraphs by hand).
- A small log buffer (e.g. `pushLog(lines, text, now)` / `visibleLog(lines, now)`) — keeps 3, drops lines older than 4 s.
- `suitTiles(s)` — six entries `{ id | null, name, lit }` from `s.hero.suit` and the weapon in hand.

## Verify
`npx tsc --noEmit -p .` · `npm run lint` · `npx vitest run` pass. The reviewer checks the layout with Playwright screenshots at 844×390 (touch) and 1280×720.
