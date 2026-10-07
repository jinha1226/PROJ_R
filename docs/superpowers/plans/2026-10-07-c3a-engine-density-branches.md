# 엔진·밀도·갈래 틀 (계획 C3a) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Path of Achra's attack/hit/damage event model in the chain engine, floors that grow wider and fuller with depth (fodder hordes) and still run on a phone, and the class-branch framework (branch/signature on cards, the new level-up offer rules with rerolls, five new tags) — applied first to the empty body's 12 cards.

**Architecture:** The trigger engine gains three event tiers: `attack` (every attack, basic or extra), `hit` (an attack that lands, or a `freeHit` an effect makes — defence ignored), `damage` (any damage, typed). Cards declare which they produce by calling `strike(..., false)` (extra attack), `freeHit(...)` (hit) or `damage(..., kind)` (damage). The "did this effect change anything" check moves from a JSON snapshot of every unit to a light fingerprint. Floors pick size, room count and band size from a depth table, and the view builds figures lazily and stops animating far ones. Cards get `branch`/`sig` fields; `rollOffer` reads them.

**Tech Stack:** TypeScript, Vite, Vitest, three.js view, Playwright.

**Spec:** `docs/superpowers/specs/2026-10-07-class-branches-design.md` (§1.5 Achra rules, §1.6 density, §2 structure and offers, §2.3 tags, §3.7 empty body). Earlier specs: `2026-10-07-solo-soul-design.md`.

## Global Constraints

- Terse Korean UI; files ≤ 500 lines; `npm run typecheck` and `npm run lint` pass after every task.
- Unit tests per task; at plan end the full suite, `npm run build && npm run e2e` (rebuild first: e2e serves `dist`), push, CI.
- Commits end with `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.
- Damage kinds: `physical | fire | cold | lightning | poison | holy | bone`.
- Chain cap **30**. Same effect once per action unless `repeat`.
- Density table (spec §1.6): floors 1–2 64×64, 16–22 rooms, 3–5 foes per normal room; 3–5 80×80, 24–32, 5–8; 6–9 96×96, 32–42, 8–12; 10–15 112×112, 42–54, 12–18; fodder share 100%·70%·65%·60% (floors 1–2 all fodder except archers by `foeKind`), elite 0·5·10·12%.
- Offer rules (spec §2.2): first level-up = signatures of the body's lines (3 for one line; two lines → 3 of 6, at least one per line); same-branch ×3, owned tag ×2; one card from an owned branch guaranteed when any is left; 2 rerolls per run; scholar +1 card, oaths at 10/14 as now.

## Review Focus

1. A card that deals damage triggering an `on damage` card of the same source in a loop (e.g. a fire-damage card that deals fire damage): must stop (once per action, cap 30), never hang. → test in Task 1.
2. The fingerprint missing a real change (an effect that only sets a flag on another unit) and re-firing it in the same action. → test in Task 2.
3. Generating a floor whose room cannot hold its band (small rooms on deep floors): spawns must not crash or overlap. → test in Task 3.
4. A clone walking into a far, never-seen part of a big floor: its figures must appear before they act on screen (lazy creation keyed to sight). → manual check in Task 4.
5. A body with two lines where one line has no branch cards yet (fantasy classes before C3b/C3c): the first offer must still give that line's cards, not an empty offer. → test in Task 6.

---

### Task 1: Achra event tiers (attack / hit / damage)

**Files:**
- Modify: `src/sim/party/triggers.ts` (`Cond` + `'attack' | 'damage' | 'teleport' | 'summon'`; `Ctx.kind?: DamageKind`; `CHAIN_CAP = 30`)
- Modify: `src/sim/party/partyCore.ts` (`DamageKind`; `damage(..., kind = 'physical')` emits `damage` for a hero attacker hitting a foe; `strikeAction` emits `attack` before the hit roll; `freeHit`)
- Modify: `src/sim/party/status.ts` (DoT ticks pass their kind: burn fire, chill/freeze cold, shock lightning, poison poison, bleed physical)
- Modify teleport sites to emit `teleport`: `src/sim/party/cardFx.ts:23`, `src/sim/party/traitCombat.ts:45`, `src/sim/party/memories.ts:20`, `src/sim/party/ultimate.ts:78`; `src/sim/party/kitEffects.ts` `summon` emits `summon`
- Test: `tests/unit/achraEvents.test.ts`

**Interfaces:**
- Produces: `type DamageKind = 'physical' | 'fire' | 'cold' | 'lightning' | 'poison' | 'holy' | 'bone'`; `damage(p, t, src, dst, amount, ev, secondary?, statusScaled?, kind?: DamageKind)`; `freeHit(p: Party, u: Unit, target: Unit, amount: number, kind: DamageKind, t: number, ev: GEvent[]): void`; conds `attack`, `damage` (ctx `kind`, `amount`, `target`), `teleport`, `summon` (ctx `target` = the summoned unit).

- [ ] **Step 1: Write the failing test**

```ts
// tests/unit/achraEvents.test.ts
import { expect, it } from 'vitest';
import { newDelve } from '../../src/sim/delve/delveSim';
import { damage, entOf, freeHit, strike, unitOf, type Unit } from '../../src/sim/party/partyCore';
import { action, emit, CHAIN_CAP, type Cond, type TriggerDef } from '../../src/sim/party/triggers';
import { applyStatus, tickStatuses } from '../../src/sim/party/status';
import type { GEvent } from '../../src/sim/grid/types';

const scene = () => {
  const p = newDelve(4, 1), u = unitOf(p, 'hero')!, me = entOf(p, 'hero')!;
  for (let y = 2; y < 9; y++) for (let x = 2; x < 16; x++) p.s.map.tiles[y * p.s.map.w + x] = 'floor';
  me.pos = { x: 5, y: 5 };
  for (const f of p.units) if (f.side === 'foe') { entOf(p, f.id)!.alive = false; f.reaped = true; }
  const foe = p.units.find((x) => x.side === 'foe')!, fe = entOf(p, foe.id)!;
  fe.alive = true; fe.hp = fe.maxHp = 999; fe.pos = { x: 7, y: 5 }; foe.asleep = false; foe.reaped = false; foe.nextAt = 999; foe.sighted = [u.id];
  return { p, u, foe };
};
/** records which conditions the clone saw */
const spy = (u: Unit, conds: Cond[]): string[] => {
  const seen: string[] = [];
  u.triggers = conds.map((when): TriggerDef => ({ id: `spy-${when}`, when, repeat: true, run: (_p, c) => { seen.push(c.kind ? `${when}:${c.kind}` : when); } }));
  return seen;
};

it('every attack is an attack; only a landed one is a hit', () => {
  const { p, u, foe } = scene(), seen = spy(u, ['attack', 'hit']);
  p.s.rng.chance = () => true; strike(p, u, foe, p.time, []);
  expect(seen).toEqual(['attack', 'hit']);
  seen.length = 0; p.s.rng.chance = () => false; strike(p, u, foe, p.time, []);
  expect(seen).toEqual(['attack']);
  seen.length = 0; p.s.rng.chance = () => true; strike(p, u, foe, p.time, [], 1, false);
  expect(seen).toEqual(['attack', 'hit']);
});

it('damage an effect deals is damage, typed, never a hit', () => {
  const { p, u, foe } = scene(), seen = spy(u, ['hit', 'damage']);
  action(p, () => damage(p, p.time, u.id, foe, 10, [], true, false, 'fire'));
  expect(seen).toEqual(['damage:fire']);
});

it('a free hit ignores dodging and counts as a hit', () => {
  const { p, u, foe } = scene(), seen = spy(u, ['hit']);
  foe.dodgeNext = true; p.s.rng.chance = () => false;
  const hp = entOf(p, foe.id)!.hp;
  action(p, () => freeHit(p, u, foe, 12, 'bone', p.time, []));
  expect(seen).toEqual(['hit']); expect(entOf(p, foe.id)!.hp).toBe(hp - 12);
});

it('damage over time is damage of its element', () => {
  const { p, u, foe } = scene(), seen = spy(u, ['damage']);
  applyStatus(p, u, foe, 'burn', p.time, []);
  tickStatuses(p, p.time, p.time + 1.5, []);
  expect(seen).toContain('damage:fire');
});

it('a fire-damage effect that deals fire damage does not feed itself forever; chains stop at the cap', () => {
  const { p, u, foe } = scene();
  u.triggers = [{ id: 'kindle', when: 'damage', test: (_p, c) => c.kind === 'fire', run: (pp, c) => damage(pp, c.t, u.id, foe, 1, c.ev, true, false, 'fire') }];
  const ev: GEvent[] = [];
  action(p, () => damage(p, p.time, u.id, foe, 1, ev, true, false, 'fire'));
  expect(ev.filter((e) => e.text === 'kindle')).toHaveLength(1);
  // a repeating one runs until the cap
  u.triggers = [{ id: 'kindle', when: 'damage', repeat: true, test: (_p, c) => c.kind === 'fire', run: (pp, c) => damage(pp, c.t, u.id, foe, 1, c.ev, true, false, 'fire') }];
  const ev2: GEvent[] = [];
  action(p, () => damage(p, p.time, u.id, foe, 1, ev2, true, false, 'fire'));
  expect(ev2.filter((e) => e.text === 'kindle')).toHaveLength(CHAIN_CAP);
  expect(CHAIN_CAP).toBe(30);
});

it('teleports and summons are events', () => {
  const { p, u } = scene(), seen = spy(u, ['teleport', 'summon']);
  action(p, () => emit(p, 'teleport', { t: p.time, src: u, ev: [] }));
  expect(seen).toEqual(['teleport']);
});
```

- [ ] **Step 2:** `npx vitest run tests/unit/achraEvents.test.ts` → FAIL (`freeHit` missing, conds unknown).
- [ ] **Step 3: Implement**
  1. `triggers.ts`: extend `Cond`, add `kind?: DamageKind` to `Ctx` (`import type { DamageKind } from './partyCore'`), `CHAIN_CAP = 30`.
  2. `partyCore.ts`:
     - `export type DamageKind = …`;
     - `damage(..., statusScaled = false, kind: DamageKind = 'physical')`: after the hp is taken, when `attacker?.side === 'hero' && dst.side === 'foe' && amount > 0`, `emit(p, 'damage', { t, src: attacker, target: dst, amount, kind, ev })`;
     - `strikeAction`: right after the `blink` and alive checks, `emit(p, 'attack', { t, src: u, target, ev })`;
     - `freeHit(p, u, target, amount, kind, t, ev)`: `action(p, () => { if (!alive(p, u) || !alive(p, target)) return; const hp = entOf(p, target.id)!.hp; ev.push({ t, type: 'hit', src: u.id, dst: target.id, amount }); damage(p, t, u.id, target, amount, ev, true, false, kind); emit(p, 'hit', { t, src: u, target, amount: hp - entOf(p, target.id)!.hp, ev }); })` (no dodge/block/armour roll; the `hit` event is pushed by `damage` already — check and push only once).
  3. `status.ts`: pass the element to `damage` in the DoT ticks (burn `fire`, poison `poison`, bleed `physical`, the chill-on-move tick `cold`).
  4. Teleport sites: after the `teleport` GEvent is pushed, `emit(p, 'teleport', { t, src: u, ev })`. `kitEffects.summon`: after the unit is pushed, `emit(p, 'summon', { t, src, target: summoned, ev })`.
- [ ] **Step 4:** test PASS; `npx vitest run tests/unit/triggers.test.ts tests/unit/chainEngine.test.ts tests/unit/status.test.ts`; typecheck; lint.
- [ ] **Step 5:** commit `feat: Achra event tiers — attack, hit (incl. free hits), typed damage; teleport/summon events; chain cap 30`.

---

### Task 2: A light "did it change anything" fingerprint

**Files:**
- Modify: `src/sim/party/triggers.ts` (`effectState`)
- Test: `tests/unit/effectFingerprint.test.ts`

**Interfaces:**
- Produces: `effectState(p: Party, src: Unit): string` — the source unit in full (minus `trig`/`triggers`) plus, for every other unit and entity, `hp, alive, x, y, shield, status count and summed untils, tauntUntil, hiddenUntil, immuneUntil, raised, asleep, sighted length`, plus `units.length`, `grounds.length`, `wells.length`.

- [ ] **Step 1: failing tests** — (a) an effect that only sets `foe.tauntUntil` counts as a change (logged once, not re-fired in the same action); (b) an effect that sets `foe.sighted` counts; (c) an effect that changes nothing is not logged; (d) with 300 foes in `p.units`, 200 emits of a no-op trigger finish within the same order of time as with 10 foes ×3 (assert `elapsed300 < elapsed10 * 40`, generous, to catch an O(n²) regression rather than measure speed).
- [ ] **Step 2:** run → (d) FAIL or slow; (a)–(c) pin current behaviour.
- [ ] **Step 3:** implement the fingerprint (numbers joined into one string; the source unit `JSON.stringify` once).
- [ ] **Step 4:** test PASS + `tests/unit/triggers.test.ts tests/unit/chainEngine.test.ts tests/unit/cardsShell.test.ts`.
- [ ] **Step 5:** commit `perf: trigger change check by fingerprint instead of a full JSON snapshot`.

---

### Task 3: Floors grow with depth (size, rooms, hordes of fodder)

**Files:**
- Modify: `src/sim/delve/delveGen.ts` (`delveSize(floor)`, `roomTarget(floor)`, `bandSize(floor, rng)`, composition, fodder flag on spawns, a cells guard)
- Modify: `src/sim/grid/types.ts` (`spawns` entries `fodder?: true`)
- Modify: `src/sim/delve/delveSim.ts` (`populate`: fodder health `FODDER_HP = 10` × scale; fodder XP/bio ½)
- Test: `tests/unit/delveDensity.test.ts`; update `tests/unit/delveGen.test.ts` (`DELVE_SIZE` → `delveSize(1)`)

**Interfaces:**
- Produces: `delveSize(floor: number): number` (64/80/96/112), `DENSITY: { upTo: number; size: number; rooms: [number, number]; band: [number, number]; fodder: number; elite: number }[]`, `FODDER_HP`.

- [ ] **Step 1: failing tests**

```ts
// tests/unit/delveDensity.test.ts
import { expect, it } from 'vitest';
import { delveSize, generateFloor } from '../../src/sim/delve/delveGen';
import { newDelve } from '../../src/sim/delve/delveSim';
import { entOf } from '../../src/sim/party/partyCore';

it('floors grow with depth: 64, 80, 96, 112 cells across', () => {
  expect([1, 2, 3, 5, 6, 9, 10, 15].map(delveSize)).toEqual([64, 64, 80, 80, 96, 96, 112, 112]);
  for (const f of [1, 4, 7, 12]) expect(generateFloor(3, f).map.w).toBe(delveSize(f));
});

it('normal rooms hold bigger bands deeper down, mostly fodder', () => {
  const band = (floor: number) => {
    const f = generateFloor(5, floor), normal = new Set(f.rooms.flatMap((r, g) => (r.kind === 'normal' ? [g] : [])));
    const per = new Map<number, number>();
    for (const s of f.map.spawns) if (normal.has(s.group)) per.set(s.group, (per.get(s.group) ?? 0) + 1);
    const sizes = [...per.values()], fodder = f.map.spawns.filter((s) => normal.has(s.group) && s.fodder).length;
    return { min: Math.min(...sizes), max: Math.max(...sizes), share: fodder / sizes.reduce((a, b) => a + b, 0) };
  };
  const shallow = band(1), mid = band(4), deep = band(12);
  expect(shallow.max).toBeLessThanOrEqual(5); expect(mid.min).toBeGreaterThanOrEqual(4); expect(deep.min).toBeGreaterThanOrEqual(9);
  expect(deep.share).toBeGreaterThan(0.45); expect(deep.share).toBeLessThan(0.75);
});

it('every spawn stands on its own floor cell, even in small rooms on deep floors', () => {
  for (const seed of [1, 2, 3, 4, 5]) for (const floor of [10, 15]) {
    const m = generateFloor(seed, floor).map, cells = m.spawns.map((s) => s.pos.y * m.w + s.pos.x);
    expect(new Set(cells).size).toBe(cells.length);
    for (const s of m.spawns) expect(m.tiles[s.pos.y * m.w + s.pos.x]).toBe('floor');
  }
});

it('fodder falls to a blow or two', () => {
  const p = newDelve(5, 3), f = p.units.find((u) => u.side === 'foe' && p.s.map.spawns.some((s) => s.fodder && entOf(p, u.id)!.pos.x === s.pos.x && entOf(p, u.id)!.pos.y === s.pos.y))!;
  expect(entOf(p, f.id)!.maxHp).toBeLessThanOrEqual(14);
});
```

- [ ] **Step 2:** run → FAIL (`delveSize` missing).
- [ ] **Step 3:** implement: `placeRooms(rng, floor)` uses `delveSize(floor)` and `roomTarget`; the fallback grid uses the size; `contents()` uses `bandSize` for normal rooms, rolls fodder/elite by the table, stops when the room runs out of free cells; `populate` gives fodder `FODDER_HP` × scale and marks the unit (`foeScale`, `fodder`). Fodder bio/XP are half (`roam.ts` BIO, `partyLevel.ts` XP read `f.fodder`).
- [ ] **Step 4:** tests PASS + `tests/unit/delveGen.test.ts tests/unit/delveFloor.test.ts tests/unit/delveRooms.test.ts tests/unit/delve.test.ts`.
- [ ] **Step 5:** commit `feat: floors widen and fill with fodder hordes as they go deeper`.

---

### Task 4: Hordes on screen (lazy figures, sleeping far animation)

**Files:**
- Modify: `src/view/grid/gridActors.ts` (`sync` creates a figure only for an entity on a seen cell or within 14 cells of the focus; `update` skips the animation mixer for figures more than 18 cells from the focus and hides dead ones beyond it)
- Modify: `src/app/main.ts` (`?demo=deep&floor=N`: a delve floor N with a level-10 empty body, `auto`)
- Create: `.claude/fps.mjs` (Playwright: open the demo, sample `requestAnimationFrame` intervals for 6 s, print mean/95th frame time)

- [ ] **Step 1:** before changing anything, build, preview, run `.claude/fps.mjs` on `?demo=deep&floor=12` (landscape and portrait) and record the numbers in the ledger.
- [ ] **Step 2:** implement the lazy creation and far-animation skip (`GridActors` keeps `focus: {x,y}` set by the runtime each frame from the selected clone).
- [ ] **Step 3:** rebuild, rerun `.claude/fps.mjs`; the mean frame time must drop and figures must appear before foes reach the clone (screenshot while a band wakes).
- [ ] **Step 4:** `npx vitest run` (view tests that stub `GridActors` still pass); typecheck; lint.
- [ ] **Step 5:** commit `perf: figures built on sight, far figures stop animating; deep-floor demo`.

---

### Task 5: Branch framework and the empty body's 12 cards

**Files:**
- Modify: `src/sim/party/traitTypes.ts` (`TraitDef.branch?: string`, `TraitDef.sig?: boolean`; `card()` options)
- Create: `src/sim/party/branches.ts` (`BRANCHES`: per line its three branches `{ id, name, tag }`; `branchOf(id)`, `sigCards(line)`)
- Modify: `src/sim/party/cardsShell.ts` (branches `shell:shot`, `shell:blast`, `shell:suit`; the 3 signatures as sustained states per spec §3.7; 4 new cards 유탄 `grenade`, 연쇄 폭발 `chainBlast` (repeat), 폭약 숙련 `blastAmp`, 장갑 숙련 `armorAmp`)
- Modify: `src/sim/party/triggerText.ts`, `src/view/grid/effectCues.ts`
- Test: `tests/unit/branches.test.ts`; update `tests/unit/cardsShell.test.ts` (관통탄 is now "from the third hit in a row every shot pierces"; 반격 사격 also on being struck, two a turn)

**Interfaces:**
- Produces: `interface Branch { id: string; line: string; name: string; tag: Tag }`, `BRANCHES: Branch[]`, `branchOf(cardId: string): Branch | undefined`, `sigCards(line: string): string[]`; card ids above; `explode(p, u, at, radius, amount, ev)` (fire damage around a cell, used by 유탄/연쇄 폭발).

Cards (spec §3.7, result kind in brackets):
| branch | card | rule |
|---|---|---|
| 사격 `shell:shot` | 관통탄 (sig) | from 3 hits in a row every shot also deals [hit] 70% to the foe behind; a miss resets / from 2 |
| | 즉시 재장전 | kill → magazine full + next shot crit / next 2 |
| | 표적 분석 | miss → next shot crit |
| | 산탄 확산 (amp) | within 2 cells ×(1 + #원거리 × 0.1) |
| 폭발물 `shell:blast` | 유탄 (sig, new) | every third shot a grenade [damage fire] radius 1 + burn; a grenade kill makes the next shot a grenade too / radius 2 |
| | 과열탄 | 3 hits in a row → burn / around too |
| | 연쇄 폭발 (new, repeat) | a foe killed by fire damage → a small blast [damage fire] radius 1 where it fell |
| | 폭약 숙련 (amp, new) | #화염 1 → fire damage ×1.12 (multiplicative per tag) |
| 슈트 `shell:suit` | 반격 사격 (sig) | dodge or struck → an extra attack at the attacker, up to 2 a turn / 4 |
| | 슈트 과부하 | crisis → twice as fast for a turn (once a floor) / each fight |
| | 개머리판 밀치기 | point-blank hit → push a cell + stun / +6 against a wall |
| | 장갑 숙련 (amp, new) | #생존 1 → damage taken ×0.96 (multiplicative) |

- [ ] **Step 1: failing tests** — `BRANCHES` has three `shell:*` branches; every shell card has a branch and exactly one `sig` per branch; 유탄 every third shot hurts the foes beside the target with fire damage and does not count as a hit (a `hit` spy sees only the shot); 연쇄 폭발 fires again when its own blast kills a burning foe (two kills → two blasts) and stops at the cap; 관통탄 needs three hits in a row; 반격 사격 answers a blow taken (struck) and stops after two in a turn; 장갑 숙련 with #생존 3 multiplies damage taken by 0.96³.
- [ ] **Step 2:** run → FAIL.
- [ ] **Step 3:** implement (signatures sustained per spec; amps multiply).
- [ ] **Step 4:** tests PASS + `cardsShell.test.ts`, `traits.test.ts` (count 80 = 76 + 4).
- [ ] **Step 5:** commit `feat: card branches; the empty body's three branches and twelve cards`.

---

### Task 6: Level-up offers by branch, with rerolls

**Files:**
- Modify: `src/sim/party/traitPool.ts` (`rollOffer`), `src/sim/party/partyCore.ts` (`Unit.rerolls?: number`), `src/sim/roam/carry.ts` (`takeClone` sets `rerolls = 2` on the departing clone), `src/sim/party/partyLevel.ts` (`rerollOffer(p, id)`)
- Modify: `src/ui/overworld/traitPicker.ts` (`다시 뽑기 n` button)
- Test: `tests/unit/branchOffers.test.ts`; update `tests/unit/cardOffer.test.ts`, `tests/unit/hybridCards.test.ts` where they assert the first offer

**Interfaces:**
- Produces: `rerollOffer(p: Party, id: string): GEvent[]`, `REROLLS_PER_RUN = 2`.

Rules (in this order):
1. **First level-up** (`level === 2` and no card held from any branch): the offer is signatures of the body's lines (`sigCards`); one line → its 3 signatures; two lines → 3 of the 6 with at least one per line; a line without branch cards yet (fantasy lines before C3b/C3c) falls back to its first-level-up laws as now.
2. **Later offers:** draw weights: same branch as an owned card ×3, owned tag ×2, else 1; at least one card from an owned branch when any is left; the rest as C1 (one per line, a common, duos, scholar, oaths).
3. **Reroll:** `rerollOffer` draws a fresh offer for the same pick if `rerolls > 0` and decrements.

- [ ] **Step 1: failing tests** — empty body at level 2 is offered exactly the three shell signatures; a mage+shell-less hybrid (warrior+mage) at level 2 gets cards of both lines (fallback); after taking 유탄, over 40 offers at level 5 each contains a `shell:blast` card while one is left; blast cards appear ≥ 2× more often than suit cards over 400 draws; `rerollOffer` changes the offer, decrements, refuses at 0; `takeClone` gives 2.
- [ ] **Step 2:** run → FAIL.
- [ ] **Step 3:** implement; `TraitPicker` shows `다시 뽑기 ${u.rerolls}` when `rerolls > 0` and calls `rerollOffer`.
- [ ] **Step 4:** tests PASS + offer tests.
- [ ] **Step 5:** commit `feat: level-up offers follow branches (signature first pick, branch weight, guarantee) with two rerolls a run`.

---

### Task 7: Five new tags, their resonance, and the empty body's resonance

**Files:**
- Modify: `src/sim/party/buildTypes.ts` (`Tag` + `'뼈' | '함정' | '함성' | '오라' | '신성'`), `src/sim/party/resonance.ts` (`LAW_TEXT`, laws; `tagCount` counts the empty body), `src/ui/overworld/…` tag colour tables (`TAG_COLOR` in `effectCues.ts`)
- Test: `tests/unit/newTags.test.ts`

Laws (spec §2.3): 뼈 3 combat start shield 6 · 뼈 6 bone damage also deals 50% [damage bone] to the foe behind · 함정 3 `trapCap +1` (read by trap cards in C3b; exposed via `resonant`) · 함정 6 traps go off twice (read in C3b) · 함성 3 stun/fear from this clone +1 turn · 함성 6 a 함성 card firing gives shield 10 (read in C3c) · 오라 3 aura range +1 (read in C3c) · 오라 6 foes in the aura exposed (read in C3c) · 신성 3 holy damage → heal 2 · 신성 6 holy damage 10% stun.

- [ ] **Step 1: failing tests** — `LAW_TEXT` has the five tags; an empty body with three shell cards tagged #원거리 lights `원거리 공명` (it used to be excluded); 뼈 3 shields at combat start; 신성 3 heals 2 on holy damage; 함성 3 makes a stun this clone applies last one turn longer.
- [ ] **Step 2:** run → FAIL.
- [ ] **Step 3:** implement (passive laws for C3b/C3c read through `resonant(p, u, tag, level)`).
- [ ] **Step 4:** tests PASS + `resonance.test.ts`, `resonanceHtml.test.ts`.
- [ ] **Step 5:** commit `feat: five new tags with resonance; the empty body resonates too`.

---

### Task 8: Plan-end checks

- [ ] **Step 1:** bot: the empty-body composition runs with branch offers; add a "damage per action" line to `summarize` (mean of the largest per-action total each floor) and record floors 1 vs deepest.
- [ ] **Step 2:** `npx vitest run`, `npm run typecheck && npm run lint && npm run build && npm run e2e`.
- [ ] **Step 3:** `.claude/fps.mjs` on `?demo=deep&floor=12` once more; record.
- [ ] **Step 4:** commit, push, watch CI (verify, e2e; deploy may queue).
