# 기지 모드와 흘러오는 습격 (계획 C4a) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans. Steps use checkbox (`- [ ]`) syntax.

**Goal:** Above ground becomes a base-building screen (free camera, buildings clicked to act, clones living about the base), and raids become a flowing horde fought in running time: command the clones or take one, fire their ultimates from a bar, pay per kill, injuries instead of losses.

**Architecture:** The world screen gets two modes on the same `WorldParty`: `base` (free camera via a `GridRuntime.freeAim`, no hand-controlled clone) and `raid` (time runs; `p.manual` only for a clone the player drives). The raid horde's fodder are ordinary units flagged `swarm` with float positions `sx/sy`, moved each frame by `swarmTick` down the raid flow field (`raidField`) and pushed apart; their entity cell is the cell their position falls in, so every existing card, blast and ultimate hits them. Elites and the general keep the existing `raidTurn`. Fodder are drawn by an instanced `SwarmView`, never by the figure actors.

**Tech Stack:** TypeScript, Vitest, three.js (InstancedMesh), Playwright e2e.

**Spec:** `docs/superpowers/specs/2026-10-08-base-mode-raids-design.md` (and the raid schedule rules it keeps from `2026-10-06-base-raids-design.md` §10).

## Global Constraints
- Terse Korean UI copy, no explanatory text; files ≤ 500 lines; typecheck + lint + unit tests per task; build + e2e + bot + CI at the end.
- Time runs in raids: the hand-controlled clone never stops the clock (`p.waiting` stays false in a raid).
- Raid total 60–150 (by raids done and deepest floor), 40–60 on screen; fodder in free coordinates, several to a cell.
- A clone downed in a raid keeps soul and level; injured (skips the next trip) unless an infirmary stands.
- A raid lost costs repairs only (no stored materials lost).
- Commits end with `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.

## Rulings carried in
- The flow field reuses `raidPath`'s Dijkstra (buildings cost 8, palisades passable) exposed as `raidField(p): Float64Array`.
- Fodder are units (`Unit.swarm`, `Ent.swarm`) with `nextAt = Infinity`; `occupied()` ignores them; the figure actors skip them.
- Old destroyed-building removal becomes "broken" (hp 0, inactive, kept for repair) — spec §5.
- `?demo=horde` (probe) is removed when `?demo=raid` lands.

## Review Focus
1. A raid fought while the run's clone is down below: only clones at the base defend and show on the ultimate bar.
2. A clone falling in a raid must not drop its soul or trigger the wipe/game-over rules; every clone down in a raid ends the raid as lost, not the run.
3. Fodder pressed into walls, buildings, the pod or the map edge, or stalled forever so the raid never ends.
4. A full ring of walls round the pod: the horde must still get through by breaking walls (finite field).
5. Pausing, aiming an ultimate or driving a clone when the raid ends: the screen returns to base mode cleanly.

---

### Task 1: Base mode (free camera, buildings to click, clones at home)
- Files: `src/view/grid/gridRuntime.ts` (`freeAim?: THREE.Vector3` — when set the camera aims there instead of the focus), `src/ui/overworld/worldScreen.ts` (mode `base`: drag/WASD pan, wheel zoom, no hand-controlled clone, party frames and stick hidden; building clicks route to panels), `src/ui/overworld/basePanels.ts` (new: pod panel — clone to send, start floor, ▼ 지하로; lab panel — print, implant; defence panel — hp, repair; pure HTML builders + handlers), `src/ui/overworld/buildMode.ts` (fixed bottom bar), `src/sim/base/baseLife.ts` (new: `homeLife(p, t)`: idle clones at the base wander to claimed floor cells within 6 of the pod every few seconds; never in a raid, never the clone away).
- Tests `tests/unit/baseLife.test.ts`: idle clones get move orders to claimed cells within 6 of the pod; none during a raid or for a clone away; `tests/unit/basePanels.test.ts`: pod panel lists base clones (injured ones disabled), lab and defence panels show the right actions.
- E2E: the title flow still lands the pod and the base shows (update the expedition spec's expectations to the base mode).

### Task 2: Raid mode (running time, commands, driving, ultimate bar, injuries, results)
- Files: `src/ui/overworld/worldScreen.ts` (mode `raid` while `p.raid`: never waits; Space pause, 1×/2×; click/drag select, right-click ground = hold there, right-click foe = attack; number key / double-click = drive that clone (WASD) and again to release; touch: tap a clone to select, tap ground or a foe to order, tap the ultimate bar then a cell), `src/sim/party/partySim.ts` (`p.drive?: { id: string; dir: Cell | null }`: the driven clone steps that way on its moment or strikes the nearest foe in reach; no waiting in a raid), `src/sim/party/ultimate.ts` (`ULT_REACH: Record<UltId, number>`; a queued ultimate whose cell is beyond reach walks the caster toward it and stays queued), `src/ui/overworld/ultBar.ts` (new: every base clone's ultimate with its cooldown; click then cell → `queueUltimate`), `src/sim/base/raids.ts` (raid deaths: downed clones kept, revived at half health when the raid ends, `injured` unless an infirmary stands; a raid with every clone down ends lost), `src/sim/roam/roam.ts` (no soul drop / wipe while `p.raid`), `src/sim/overworld/worldSim.ts` (`canDrill`/`drillClone` skip injured; `onRaidReturn` clears injuries after a trip), `src/ui/overworld/raidBar.ts` (result window: kills, materials, broken buildings, injured clones).
- Tests `tests/unit/raidMode.test.ts`: no waiting in a raid with a manual clone; the driven clone steps by `dir` and strikes when `dir` is null; a queued ultimate out of reach walks closer and fires in reach; a clone downed in a raid keeps soul and level, is revived at half health and injured; with an infirmary not injured; injured clones can't be sent and heal after a trip; every clone down ends the raid lost without a game over.

### Task 3: The flowing horde (flow field, swarm, waves, rewards, view, demo)
- Files: `src/sim/base/raidPath.ts` (`raidField(p): Float64Array` — the shared distances), `src/sim/base/swarm.ts` (new: `spawnWaves(p)`, `swarmTick(p, dt, ev)`: steer down the field, push apart, stop at blocked cells and hit the building/wall/pod/clone in contact every second; entity cell = floor of `sx/sy`), `src/sim/base/raids.ts` (`raidSize` 60→150 by raids done and deepest; 3 waves from 2–4 edges, about 10% elites, the general in the last wave; fodder `swarm`), `src/sim/base/raidLoot.ts` (new: pay per kill — fodder ore/bio, elites more, the general crystal; `p.raidLoot` tally), `src/sim/party/partyCore.ts` (`Unit.swarm`, `sx`, `sy`; `occupied` ignores swarm), `src/sim/grid/types.ts` (`Ent.swarm`), `src/view/grid/gridActors.ts` (skip swarm), `src/view/overworld/swarmView.ts` (new: instanced fodder from the probe's look, bob and facing), `src/app/main.ts` + `src/ui/demo/raidDemo.ts` (`?demo=raid`: a walled base, three clones and a raid that runs by itself); remove `src/ui/demo/hordeDemo.ts`, `src/sim/raid/hordeProbe.ts`, its test and route.
- Tests `tests/unit/swarm.test.ts`: fodder never stand in a wall, building or off the map; a ring of walls is broken through; several fodder may share a cell; a blast through the existing `damage` kills fodder in its cells; fodder at the pod hit it; waves spawn the sized total over time; kills pay materials (kept on a loss); a 150-strong raid tick stays under a fixed bound.

### Task 4: Defence upgrades, ship support, repairs, auto-defence
- Files: `src/sim/base/buildings.ts` (a level table — one row per building, levels 1–3: range, damage, health, cost — for watchtower/wall/palisade/shockMine; new `shockMine` building; broken state at 0 hp — inactive, repaired with ore), `src/sim/base/raidAi.ts` (towers use their level; shock mines hurt and shock what stands on them), display names go SF: 포탑 (watchtower), 방벽 (wall), 바리케이드 (palisade), 전기 지뢰 (shockMine) — ids unchanged, `src/sim/base/support.ts` (new: ship support unlocks — `orbitalStrike(p, cell)` radius 2, `orbitalLaser(p, from, dir)` straight line; cooldowns; on the ultimate bar), `src/sim/base/raids.ts` (loss = broken buildings + pod repair cost, no materials lost; auto-defence against the new size), `src/ui/overworld/basePanels.ts` + `ultBar.ts` (upgrade and repair buttons, support slots).
- Tests `tests/unit/defence.test.ts`: each upgrade raises its stat and costs; broken buildings do nothing until repaired; a shock mine hurts and shocks; orbital strike and laser hit what they should and wait their cooldown; a lost raid keeps stored materials and leaves repairs; auto-defence uses the new size.

### Task 5: Checks
- Full suite, build, e2e (one raid: start → result window), bot once, push, CI, final review (opus) and fix pass, memory update.
