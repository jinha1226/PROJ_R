# 파티 원정 핵심 (1단계 시뮬레이션) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Turn the one-room party prototype (`src/sim/party/*`) into a full headless expedition: five generated dungeon floors explored by a party of three in real time with pause, ten advanced classes, equipment and trinket engravings (with cross-hero links), new foes and a demon general on floor 5, party levels, and soul stones that must be recovered.

**Architecture:** Everything is deterministic simulation under `src/sim/party/` (no DOM, no three.js, no imports from `src/view` or `src/ui`, randomness only through `p.s.rng`). The party keeps the existing convention: the first hero is `p.s.hero` (id `hero`), the other two heroes and all foes live in `p.s.foes`; a `Unit` record in `p.units` carries everything party-specific. Floors reuse `generateMap` from the main game. The screen (`?demo=expedition`) is NOT part of this plan — Claude builds it afterwards on the API below; the existing `?demo=party` arena must keep compiling and working.

**Tech Stack:** TypeScript (strict), Vitest, ESLint. Node 22.

**Spec:** `docs/superpowers/specs/2026-10-06-soulbound-colony-design.md` (sections 3, 4, 6, 8 — phase 1 "원정 핵심").

## Global Constraints

- Source files ≤ 400 lines each (`npm run lint` runs `scripts/check-file-length.mjs`). Split files rather than compress code.
- `src/sim/**` must not import from `src/view/**` or `src/ui/**`.
- Deterministic: all randomness through `p.s.rng` (or a `createRng` stream derived from the expedition seed). Same seed + same orders ⇒ same events.
- Do not change behaviour of the main game (`src/sim/grid/**`). Read-only reuse (`generateMap`, `computeFov`, `findPath`, `shotClear`, `spawnFoe`, `makeFoe`) is fine. If a grid helper needs a tweak, add a new function instead of changing an existing one.
- Player-facing names are short Korean nouns (e.g. `'광전사'`, `'올가미 화살'`). No explanatory sentences in data.
- Time unit = game seconds. `tick(p, dt)` advances time; every action returns the time until that unit's next moment.
- Keep `?demo=party` (`src/ui/party/partyDemo.ts`, `partyPick.ts`) compiling and playable; update it minimally where an API it uses changes.
- Commit after each task on the current branch with a message `feat(party): …` ending with a blank line and `Co-Authored-By: Codex <noreply@openai.com>`. Do NOT push.
- Verification commands for every task: `npx tsc --noEmit -p .`, `npm run lint`, `npx vitest run tests/unit/party*`. Before the final commit run the whole suite `npx vitest run`.

## Review Focus

1. A hero dying mid-skill or mid-order (queued skill, attack order on a dead foe, move order through a closed door) — nothing throws, orders clear, events stay consistent (no `hit` after `die` for the same unit at the same time).
2. Summons (necromancer skeletons) are `side: 'hero'` units that are NOT heroes: they must never count for wipe/victory, promotion, xp sharing, soul stones, or `HERO_IDS` loops.
3. Descending with a hero dead and its soul stone not recovered — the stone is lost; with it recovered, the hero is `recovered` in the result. A wipe loses every unrecovered stone.
4. Equipping an item the class cannot use, into a full pack, or swapping trinkets that change max HP (`bulwark`) — refused or applied without HP going above max or below 1 for a living hero.
5. Floors where a foe group spawns inside the hero's starting sight, and a corridor jammed by bodies — the party still wakes the group once (one `wake` event per group), and followers don't oscillate forever (bounded by the 100-action guard per tick).

Each of these has a test in the owning task below.

---

## Current code you are building on (read these first)

- `src/sim/party/partyDefs.ts` — weapons, 7 classes, skills, foes, waves, picks.
- `src/sim/party/partyCore.ts` — `Unit`, `Party`, `entOf`, `unitOf`, `alive`, `stats`, `canHit`, `targetOf`, `stepToward`, `passiveMult`, `damage`, `strike`.
- `src/sim/party/partySkills.ts` — `queueSkill`, `useSkill` (12 skills).
- `src/sim/party/partySim.ts` — `partyRoom` (arena), `nextWave`, `promote`, `turn`, `tick`.
- `tests/unit/partySim.test.ts` — 12 tests of the arena; keep them passing (update numbers only where this plan changes a rule, e.g. promotion needs).
- Grid helpers: `src/sim/grid/mapgen.ts` (`generateMap(seed, floor)` → 48×48, rooms, `spawns` with `group` per room, `chests`, `stairs` on non-boss floors, a `champion` spawn in the deepest room on floor 5), `src/sim/grid/fov.ts` (`computeFov(map, from, radius)` → `Set<number>` of tile indices), `src/sim/grid/path.ts` (`findPath`), `src/sim/grid/combat.ts` (`shotClear`), `src/sim/grid/foes.ts` (`spawnFoe`), `src/sim/grid/types.ts` (`Cell`, `Ent`, `GEvent`, `GEventType`, `dist` = Chebyshev, `idx`, `tileAt`, `walkable`).
- Events the view already knows (use these `type`s only): `move`, `bump`, `shoot`, `hit`, `miss`, `die`, `heal`, `buff`, `react`, `teleport`, `wake`, `door`, `open`, `loot`, `telegraph`, `summon`, `drop`, `pickup`, `stairs`, `floor`, `victory`, `levelUp`, `status`.

---

## File Structure

| File | Responsibility |
|---|---|
| `src/sim/party/partyDefs.ts` (modify) | weapons, ids, picks, `HERO_IDS`; re-exports class/foe data so existing imports keep working |
| `src/sim/party/partyClasses.ts` (create) | `ClassId`, `CLASSES` (5 base + 10 advanced), `SKILLS`, `PROMOTIONS`, `CondId`, `PROMOTE_LEVEL` |
| `src/sim/party/partyFoeDefs.ts` (create) | `FoeId`, `FOES` (6 kinds), `FOE_XP`, floor scaling, elite numbers, arena `WAVES` |
| `src/sim/party/partyCore.ts` (modify) | `Unit`/`Party` types, lookups, targeting, damage pipeline, strike |
| `src/sim/party/partyStatus.ts` (create) | burn, poison, chill, root, mark, exposed, bulwark, sanctuary zones, damage-over-time ticking |
| `src/sim/party/partySkills.ts` (modify) | `queueSkill`, `useSkill` dispatcher for base skills |
| `src/sim/party/partySkills2.ts` (create) | advanced-class skills (bulwark, snare, storm, raise, smite, sanctuary, venom, smoke) |
| `src/sim/party/partyHeal.ts` (create) | `heal()` helper (vital affix, overheal, healed counter) |
| `src/sim/party/partyItems.ts` (create) | armor, rarity, affixes, trinkets, `Item`, `Loadout`, `rollItem`, `equip`, `unequip`, gear-derived numbers |
| `src/sim/party/partyEngrave.ts` (create) | trinket engraving hooks called from the damage pipeline |
| `src/sim/party/partyFoeAi.ts` (create) | shaman heal, warlord slam telegraph + summon, foe turn specials |
| `src/sim/party/partyProgress.ts` (create) | condition counters, party xp/levels, promotion options, `promote` |
| `src/sim/party/expedition.ts` (create) | `newExpedition`, floor setup + bolstering, vision, waking, combat state, doors, chests, potions |
| `src/sim/party/expeditionFlow.ts` (create) | following the leader, stairs/`descend`, `retreat`, soul stones, outcome, `expeditionResult` |
| `src/sim/party/partySim.ts` (modify) | arena `partyRoom`/`nextWave`, `turn`, `tick` (shared by arena and expedition) |
| `tests/unit/partyClasses.test.ts`, `partyStatus.test.ts`, `partyItems.test.ts`, `partyFoes.test.ts`, `expedition.test.ts`, `expeditionFlow.test.ts`, `partyProgress.test.ts` (create) | unit tests per task |
| `tests/bot/partyBot.ts`, `tests/bot/partyExpedition.bot.ts` (create) | headless expedition bot + balance report |
| `docs/superpowers/plans/2026-10-06-party-expedition-results.md` (create) | bot results and tuning notes |

---

### Task 1: Class data — 15 classes, skills, promotion conditions

**Files:**
- Create: `src/sim/party/partyClasses.ts`, `src/sim/party/partyFoeDefs.ts`, `tests/unit/partyClasses.test.ts`
- Modify: `src/sim/party/partyDefs.ts` (move class/skill/promotion/foe data out, re-export), `src/sim/party/partyCore.ts` (Unit fields), `src/sim/party/partySim.ts` (`promote` → moved), `src/ui/party/partyDemo.ts`, `src/ui/party/partyPick.ts` (new promotion shape), `tests/unit/partySim.test.ts`
- Create: `src/sim/party/partyProgress.ts`

**Interfaces:**
- Produces:
  ```ts
  // partyClasses.ts
  export type BaseClass = 'warrior' | 'archer' | 'mage' | 'cleric' | 'rogue';
  export type AdvancedClass = 'berserker' | 'guardian' | 'sniper' | 'hunter' | 'elementalist' | 'necromancer' | 'inquisitor' | 'healer' | 'assassin' | 'poisoner';
  export type ClassId = BaseClass | AdvancedClass;
  export type SkillId = 'taunt' | 'whirl' | 'pierce' | 'volley' | 'fireball' | 'frost' | 'heal' | 'ward' | 'stealth' | 'backstab' | 'frenzy' | 'aimed'
    | 'bulwark' | 'snare' | 'storm' | 'raise' | 'smite' | 'sanctuary' | 'venom' | 'smoke';
  export type Passive = 'counter' | 'firstShot' | 'shatter' | 'guardian' | 'flank' | 'rage' | 'cover' | 'farShot' | 'pack' | 'overload' | 'drain' | 'zeal' | 'overheal' | 'execute' | 'toxic';
  export type CondId = 'lowHpKill' | 'tauntedHits' | 'farKill' | 'volleyKill' | 'shatter' | 'corpseCast' | 'basicKill' | 'healed' | 'flankKill' | 'backstabKill';
  export interface ClassDef { name: string; hp: number; move: number; skills: [SkillId, SkillId]; weapons: WeaponId[]; passive: Passive; passiveName: string; magic?: boolean; base: BaseClass }
  export interface PromotionDef { to: AdvancedClass; cond: CondId; need: number; label: string }
  export const CLASSES: Record<ClassId, ClassDef>;
  export const SKILLS: Record<SkillId, { name: string; cd: number }>;
  export const PROMOTIONS: Record<BaseClass, [PromotionDef, PromotionDef]>;
  export const BASE_CLASSES: BaseClass[];
  export const PROMOTE_LEVEL = 5;
  // partyProgress.ts
  export function count(p: Party, u: Unit, cond: CondId, n?: number): void;   // adds n (default 1) to u.counters[cond]
  export function promotionOptions(p: Party, u: Unit): { def: PromotionDef; progress: number; ready: boolean }[];
  export function promote(p: Party, id: string, to?: AdvancedClass): GEvent[];  // moved here from partySim.ts; partySim re-exports it
  ```
  `Unit` gains `counters: Partial<Record<CondId, number>>` and loses `progress`/`promoteReady` (replaced by `counters` + `promotionOptions`). `Party` gains `arena: boolean` (true in `partyRoom`), `level: number` (1), `xp: number` (0).

- [ ] **Step 1: Write the data exactly as below** (numbers are the starting balance; Task 7 may tune them).

  Base classes keep their current numbers from `partyDefs.ts` (warrior 70, archer 40, mage 34, cleric 50, rogue 42, same skills/weapons/passives) and gain `base: <itself>`.

  Advanced classes (`weapons` = the base class's two weapons; `base` = the base class):

  | id | name | hp | move | skills | passive | passiveName | magic |
  |---|---|---|---|---|---|---|---|
  | berserker | 광전사 | 85 | 0.85 | frenzy, whirl | rage | 체력 절반 이하 피해 1.5배 | |
  | guardian | 수호기사 | 95 | 0.95 | taunt, bulwark | cover | 곁의 아군 피해 30% 대신 받기 | |
  | sniper | 저격수 | 45 | 0.9 | aimed, pierce | farShot | 사거리 +2 · 5칸 밖 2배 | |
  | hunter | 사냥꾼 | 48 | 0.85 | snare, volley | pack | 묶이거나 느린 적에게 1.3배 | |
  | elementalist | 원소술사 | 38 | 1.0 | fireball, storm | overload | 기술 피해 1.3배 | yes |
  | necromancer | 강령술사 | 40 | 1.0 | raise, frost | drain | 근처 적이 죽으면 회복 5 | yes |
  | inquisitor | 심판관 | 60 | 0.95 | smite, ward | zeal | 적중마다 가장 다친 아군 회복 2 | yes |
  | healer | 치유사 | 52 | 0.95 | heal, sanctuary | overheal | 넘친 치유는 보호막 | yes |
  | assassin | 암살자 | 46 | 0.7 | stealth, backstab | execute | 체력 35% 미만 적에게 2배 | |
  | poisoner | 독술사 | 44 | 0.75 | venom, smoke | toxic | 중독된 적이 받는 피해 1.25배 | |

  New skills (`SKILLS`): bulwark `방벽` cd 10, snare `올가미 화살` cd 7, storm `연쇄 번개` cd 8, raise `시체 일으키기` cd 12, smite `신성 일격` cd 7, sanctuary `성역` cd 14, venom `독 칼날` cd 10, smoke `연막` cd 12.

  Promotions (`label` is what the card shows; `need` is the counter target):

  | base | to | cond | need | label |
  |---|---|---|---|---|
  | warrior | berserker | lowHpKill | 3 | 체력 절반 이하에서 처치 |
  | warrior | guardian | tauntedHits | 20 | 도발한 적에게 맞기 |
  | archer | sniper | farKill | 3 | 5칸 밖에서 처치 |
  | archer | hunter | volleyKill | 3 | 연사로 처치 |
  | mage | elementalist | shatter | 4 | 언 적 깨뜨리기 |
  | mage | necromancer | corpseCast | 4 | 시체 곁에 주문 |
  | cleric | inquisitor | basicKill | 4 | 기본 공격으로 처치 |
  | cleric | healer | healed | 150 | 치유량 |
  | rogue | assassin | flankKill | 4 | 다른 이를 노리는 적 처치 |
  | rogue | poisoner | backstabKill | 3 | 급소 찌르기로 처치 |

  `partyDefs.ts` keeps `WEAPONS`, `WeaponId`, `WeaponDef`, `Pick`, `DEFAULT_PICKS`, `HERO_IDS` and adds `export * from './partyClasses'; export * from './partyFoeDefs';` so `import { CLASSES } from './partyDefs'` still works. `partyFoeDefs.ts` holds the current `FoeId`/`FOES`/`WAVES` unchanged for now (Task 4 extends it).

- [ ] **Step 2: Counters replace the two hard-coded checks.** In `partyCore.ts` `credit()` becomes calls to `count()`:
  - kill by a hero whose own hp < maxHp/2 → `lowHpKill`
  - kill at Chebyshev distance ≥ 5 → `farKill`
  - kill while `p.casting === 'volley'` → `volleyKill`; while `p.casting === 'backstab'` → `backstabKill`
  - kill by a basic attack (`p.casting === undefined`) → `basicKill`
  - `flankKill`, `shatter`, `corpseCast`, `tauntedHits`, `healed` are counted in Tasks 2 (status/skills) and 3 — add the `count` calls where those effects happen: `tauntedHits` in `damage()` when the source foe has `tauntBy === dst.id && t < tauntUntil`; `shatter` where `passiveMult` consumes a freeze; `flankKill` in `strike()` when the flank multiplier was > 1 and the target died.
  - Add `casting?: SkillId` to `Party`; `useSkill` sets `p.casting = skill` before resolving and clears it in a `finally`.
  - Counters are only kept for heroes whose class is a base class (`CLASSES[u.cls].base === u.cls`); summons and advanced classes do not count.

- [ ] **Step 3: `promotionOptions` and `promote`.** `ready` = `progress >= need && (p.arena || p.level >= PROMOTE_LEVEL)`. `promote(p, id, to?)`: if `to` is omitted take the first ready option; refuse (return `[]`) when not ready, dead, not a base class, or `to` not among the class's two options. On success: `maxHp += CLASSES[to].hp - CLASSES[base].hp`, `hp +=` the same, `u.cls = to`, `u.ready = [p.time, p.time]`, `u.queued = undefined`, `u.counters = {}`; event `{ t, type: 'buff', src: id, dst: id, text: 'promote' }`.

- [ ] **Step 4: Update the demo for the new shape.** `partyDemo.ts` card: for each option in `promotionOptions`, show a button `전직 → <name>` with `data-promote="<to>"` when ready, else `<small>${name} ${progress}/${need}</small>`; the click calls `promote(p, sel, to)`. Auto-pause key becomes `${id}:promo` when any option is ready. `partyPick.ts` shows both promotions: `전직 <name> · <label> <need>` lines. Replace every `u.promoteReady` / `u.progress` use.

- [ ] **Step 5: Write the failing tests** `tests/unit/partyClasses.test.ts`:

```ts
import { expect, it } from 'vitest';
import { CLASSES, PROMOTIONS, BASE_CLASSES } from '../../src/sim/party/partyClasses';
import { damage, entOf, unitOf } from '../../src/sim/party/partyCore';
import { promote, promotionOptions } from '../../src/sim/party/partyProgress';
import { partyRoom } from '../../src/sim/party/partySim';

const foes = (p: ReturnType<typeof partyRoom>) => p.units.filter((u) => u.side === 'foe' && entOf(p, u.id)!.alive);

it('every base class has two promotions to advanced classes of its own line', () => {
  for (const b of BASE_CLASSES) {
    const [a, c] = PROMOTIONS[b];
    expect(a.to).not.toBe(c.to);
    expect(CLASSES[a.to].base).toBe(b);
    expect(CLASSES[c.to].weapons).toEqual(CLASSES[b].weapons);
  }
  expect(Object.keys(CLASSES)).toHaveLength(15);
});

it('three kills while badly hurt open berserker; promoting picks it and keeps the hp gap', () => {
  const p = partyRoom();
  const e = entOf(p, 'hero')!; e.hp = 20;
  for (const f of foes(p).slice(0, 3)) damage(p, 0, 'hero', f, 999, []);
  const opts = promotionOptions(p, unitOf(p, 'hero')!);
  expect(opts.find((o) => o.def.to === 'berserker')!.ready).toBe(true);
  expect(opts.find((o) => o.def.to === 'guardian')!.ready).toBe(false);
  expect(promote(p, 'hero', 'guardian')).toEqual([]);
  expect(promote(p, 'hero', 'berserker')).toHaveLength(1);
  expect(unitOf(p, 'hero')!.cls).toBe('berserker');
  expect(e.maxHp).toBe(85);
  expect(e.hp).toBe(35);
});

it('outside the arena a promotion also needs party level 5', () => {
  const p = partyRoom();
  p.arena = false;
  entOf(p, 'hero')!.hp = 20;
  for (const f of foes(p).slice(0, 3)) damage(p, 0, 'hero', f, 999, []);
  expect(promotionOptions(p, unitOf(p, 'hero')!).some((o) => o.ready)).toBe(false);
  p.level = 5;
  expect(promotionOptions(p, unitOf(p, 'hero')!).some((o) => o.ready)).toBe(true);
});

it('blows from a foe the warrior taunted count toward guardian', () => {
  const p = partyRoom();
  const w = unitOf(p, 'hero')!, f = foes(p)[0]!;
  f.tauntBy = 'hero'; f.tauntUntil = 99;
  for (let i = 0; i < 20; i++) damage(p, 1, f.id, w, 1, []);
  expect(promotionOptions(p, w).find((o) => o.def.to === 'guardian')!.progress).toBe(20);
});
```

- [ ] **Step 6:** Run `npx vitest run tests/unit/partyClasses.test.ts` — expect FAIL (module missing). Implement Steps 1–4. Update `tests/unit/partySim.test.ts`: the berserker test now needs 3 kills (third `damage` call) and asserts via `promotionOptions`; the "full health" test asserts `promotionOptions(...).every((o) => !o.ready)`.
- [ ] **Step 7:** Run the verification commands; all green. Commit `feat(party): 15 classes, promotion conditions as counters`.

---

### Task 2: Status effects, advanced skills and passives, healing

**Files:**
- Create: `src/sim/party/partyStatus.ts`, `src/sim/party/partySkills2.ts`, `src/sim/party/partyHeal.ts`, `tests/unit/partyStatus.test.ts`
- Modify: `src/sim/party/partyCore.ts`, `src/sim/party/partySkills.ts`, `src/sim/party/partySim.ts`

**Interfaces:**
- Consumes: Task 1 `CLASSES`, `count`, `p.casting`.
- Produces:
  ```ts
  // Unit gains (all default 0 / empty in a `blank()` factory exported from partyCore):
  burnUntil: number; poison: { stacks: number; until: number }; dotAt: number;
  chillUntil: number; rootUntil: number; markUntil: number; markBy?: string; exposedUntil: number;
  bulwarkUntil: number; venomUntil: number; summon?: { owner: string; expiresAt: number };
  // Party gains: zones: { cell: Cell; until: number; src: string }[]  (sanctuary), raised: Set<string> (corpse ids used by raise), nextSummon: number
  export function blank(): Omit<Unit, 'id' | 'side'>;                       // partyCore
  export function tickStatus(p: Party, from: number, to: number, ev: GEvent[]): void; // partyStatus: dots + sanctuary + summon expiry, each whole second
  export const chilled = (u: Unit, t: number) => t < u.chillUntil;
  export const rooted = (u: Unit, t: number) => t < u.rootUntil;
  export function heal(p: Party, t: number, src: string, dst: Unit, amount: number, ev: GEvent[]): number; // returns hp actually restored
  export function useSkill2(p: Party, u: Unit, skill: SkillId, t: number, ev: GEvent[]): boolean | undefined; // partySkills2: true = cast, false = cannot (no target), undefined = not an advanced skill
  ```

Rules (implement exactly):

- **Damage-over-time:** `tickStatus` runs at the start of every `tick` for the interval `(p.time, end]`. For each alive unit with burn or poison active, while `u.dotAt <= end`: a tick at time `d` applies burn (3) if `d <= burnUntil` and poison (`3 × stacks`) if `d <= poison.until` (source = `'dot'`); then `dotAt += 1`; stop when neither is active. When an effect is first applied, set `dotAt = t + 1` if no dot is active.
- **Chill:** in `tick`, a chilled unit's next moment is `time + turn × 1.5`.
- **Root:** `stepToward` returns false for a rooted unit (it still attacks).
- **Frozen** (existing `frozenUntil`) stays as is.
- **Mark:** hits by other heroes on a marked foe ×1.3 (not the marker itself).
- **Exposed:** hits by any hero on an exposed foe ×1.5.
- **Bulwark:** a hero with `t < bulwarkUntil` takes ×0.5.
- **Damage order in `damage()` for a hero target:** guard (weapon) → armor (Task 3; ×1 until then) → bulwark → cover redirect (see below) → shield soak → hp. For a foe target the multipliers are applied by the caller (`strike`/skills) through `passiveMult` plus the new statuses: `exposed`, `mark`, `toxic` (poisoner in party and target poisoned ⇒ ×1.25).
- **Cover (guardian passive):** when a hero other than the guardian, standing at distance 1 from an alive guardian, takes damage, `floor(amount × 0.3)` goes to the guardian instead (through `damage()` again with a flag so it cannot redirect twice) and the rest to the original target.
- **Passives:**
  - `pack`: ×1.3 vs `rooted || chilled`.
  - `overload`: damage from this hero's skills ×1.3. Use `p.casting !== undefined` to know a skill is resolving.
  - `drain`: whenever a foe dies within 4 of an alive necromancer, it heals 5 via `heal()`.
  - `zeal`: each time the inquisitor's hit lands (damage > 0), heal the most-hurt alive hero (lowest hp/maxHp) by 2.
  - `overheal`: healing done by a healer beyond the target's max hp becomes shield on the target (shield capped at 30).
  - `execute`: ×2 vs target hp < 35% of max.
  - `toxic`: see above.
- **`heal()`:** restores `min(amount × vital, maxHp − hp)` where `vital` = 1.25 if the target wears a `vital` affix item (Task 3; 1 until then); overheal as above; adds the restored amount to `count(src, 'healed')`; pushes `{ type: 'heal', src, dst, amount }`. The existing `heal` skill and the cleric `guardian` passive use it.
- **Skills (in `partySkills2.ts`; `useSkill` in `partySkills.ts` delegates to it first):**
  - `bulwark`: caster and heroes within 1 get `bulwarkUntil = t + 4`; `buff` event text `'ward'` per hero.
  - `snare`: needs a target in weapon range with LOS (`canHit`); 5–8 damage; `rootUntil = t + 3`; event `react` text `'paralyse'`.
  - `storm`: target as snare; 8–11; then up to 2 more hops, each to the nearest alive foe not yet hit within 3 of the previous target; `shoot` event `text: 'spell'` from previous target to next per hop.
  - `raise`: nearest dead foe Ent within 5 of the caster whose id is not in `p.raised`; at most 2 alive summons owned by this caster. Creates an `Ent` via `spawnFoe(p.s, 'ghoul', corpsePos, false)` and re-ids it `skel-${p.nextSummon++}`; `hp = maxHp = 30`; `Unit { side: 'hero', foe: 'goblin', summon: { owner, expiresAt: t + 20 } }` (summons use goblin stats). Event `summon` with `src` caster, `dst` new id, `to` pos. `tickStatus` kills expired summons (`die` event).
  - `smite`: target within 4 with LOS; 14–18; `target.nextAt = max(target.nextAt, t + 1.5)`.
  - `sanctuary`: `p.zones.push({ cell: casterPos, until: t + 4, src: id })`; every whole second `tickStatus` heals heroes within 4 of a live zone's cell by 6 through `heal()`.
  - `venom`: `venomUntil = t + 6`; while active, the caster's basic hits add one poison stack (max 3) and set `poison.until = t + 4`.
  - `smoke`: heroes within 3 of the caster: `hiddenUntil = t + 2`; `buff` text `'stealth'`.
  - Also: `frost` now also sets `chillUntil = t + 4` (after the freeze); `taunt` by a hero wearing `link_bait` (Task 3) sets `exposedUntil = t + 5` on the taunted foes — leave a call to an exported `onTaunt(p, u, foes, t)` hook in `partyEngrave.ts` that Task 3 fills (create the file now with a no-op).
- **Summons AI:** summons use the normal hero turn without orders; out of combat (Task 5) they follow their owner. `targetOf` for foes includes summons.
- **corpseCast:** when a mage (base class) casts any skill whose target cell (or own cell for self-skills) has a dead foe Ent within 3 → `count(u, 'corpseCast')`.

- [ ] **Step 1: Write failing tests** `tests/unit/partyStatus.test.ts`:

```ts
import { expect, it } from 'vitest';
import { damage, entOf, unitOf } from '../../src/sim/party/partyCore';
import { partyRoom, tick } from '../../src/sim/party/partySim';
import { useSkill } from '../../src/sim/party/partySkills';
import type { GEvent } from '../../src/sim/grid/types';

const P = (picks: Parameters<typeof partyRoom>[0]) => partyRoom(picks);
const foes = (p: ReturnType<typeof partyRoom>) => p.units.filter((u) => u.side === 'foe' && entOf(p, u.id)!.alive);
const near = (p: ReturnType<typeof partyRoom>, id: string, at: { x: number; y: number }) => { entOf(p, id)!.pos = { ...at }; };

it('burn deals 3 each whole second until it runs out', () => {
  const p = partyRoom();
  const f = foes(p)[0]!, e = entOf(p, f.id)!;
  for (const o of p.units) o.nextAt = 99;
  const hp = e.hp;
  f.burnUntil = 3; f.dotAt = 1;
  for (let i = 0; i < 40; i++) tick(p, 0.1);
  expect(hp - e.hp).toBe(9);
});

it('poison stacks multiply the tick', () => {
  const p = partyRoom();
  const f = foes(p)[0]!, e = entOf(p, f.id)!;
  for (const o of p.units) o.nextAt = 99;
  const hp = e.hp;
  f.poison = { stacks: 3, until: 1.05 }; f.dotAt = 1;
  for (let i = 0; i < 20; i++) tick(p, 0.1);
  expect(hp - e.hp).toBe(9);
});

it('a rooted foe does not step', () => {
  const p = partyRoom();
  const f = foes(p)[0]!;
  f.rootUntil = 99;
  const at = { ...entOf(p, f.id)!.pos };
  for (let i = 0; i < 30; i++) tick(p, 0.1);
  expect(entOf(p, f.id)!.pos).toEqual(at);
});

it('bulwark halves blows; cover moves 30% of an adjacent ally\'s blow to the guardian', () => {
  const p = P([{ cls: 'warrior', weapon: 'greataxe' }, { cls: 'archer', weapon: 'longbow' }, { cls: 'mage', weapon: 'staff' }]);
  const g = unitOf(p, 'hero')!; g.cls = 'guardian';
  near(p, 'ally-1', { x: 4, y: 4 }); near(p, 'hero', { x: 3, y: 4 });
  const a = entOf(p, 'ally-1')!, h = entOf(p, 'hero')!;
  const ah = a.hp, hh = h.hp;
  damage(p, 0, foes(p)[0]!.id, unitOf(p, 'ally-1')!, 10, []);
  expect(ah - a.hp).toBe(7);
  expect(hh - h.hp).toBe(3);
  unitOf(p, 'ally-1')!.bulwarkUntil = 99;
  const ah2 = a.hp;
  damage(p, 0, foes(p)[0]!.id, unitOf(p, 'ally-1')!, 10, []);
  expect(ah2 - a.hp).toBe(4); // 10 × 0.5 = 5, then 30% (1) to the guardian
});

it('storm hops to two more foes near the first', () => {
  const p = P([{ cls: 'warrior', weapon: 'swordShield' }, { cls: 'archer', weapon: 'longbow' }, { cls: 'mage', weapon: 'staff' }]);
  unitOf(p, 'ally-2')!.cls = 'elementalist';
  const [a, b, c] = foes(p);
  near(p, a!.id, { x: 6, y: 6 }); near(p, b!.id, { x: 7, y: 7 }); near(p, c!.id, { x: 8, y: 7 });
  near(p, 'ally-2', { x: 3, y: 6 });
  const ev = useSkill(p, 'ally-2', 1);
  const hit = new Set(ev.filter((e) => e.type === 'hit').map((e) => e.dst));
  expect(hit.size).toBe(3);
});

it('raise makes a skeleton on a corpse that fights for the party and crumbles after 20s', () => {
  const p = P([{ cls: 'warrior', weapon: 'swordShield' }, { cls: 'archer', weapon: 'longbow' }, { cls: 'mage', weapon: 'staff' }]);
  unitOf(p, 'ally-2')!.cls = 'necromancer';
  const corpse = foes(p)[0]!;
  near(p, corpse.id, { x: 4, y: 7 });
  damage(p, 0, 'x', corpse, 999, []);
  const ev = useSkill(p, 'ally-2', 0);
  const s = ev.find((e) => e.type === 'summon')!;
  const skel = unitOf(p, s.dst!)!;
  expect(skel.side).toBe('hero');
  expect(skel.summon?.owner).toBe('ally-2');
  expect(useSkill(p, 'ally-2', 0)).toEqual([]); // cooldown
  for (let i = 0; i < 220; i++) tick(p, 0.1);
  expect(entOf(p, skel.id)!.alive).toBe(false);
});

it('a healer\'s overflow becomes shield; healing counts toward the healer promotion', () => {
  const p = P([{ cls: 'cleric', weapon: 'mace' }, { cls: 'archer', weapon: 'longbow' }, { cls: 'mage', weapon: 'staff' }]);
  const c = unitOf(p, 'hero')!;
  entOf(p, 'ally-1')!.hp = 30; // 10 below 40
  useSkill(p, 'hero', 0);
  expect(c.counters.healed).toBe(10);
  c.cls = 'healer';
  entOf(p, 'ally-1')!.hp = 30; c.ready = [0, 0];
  for (const u of p.units) if (u.side === 'hero' && u.id !== 'ally-1') entOf(p, u.id)!.hp = entOf(p, u.id)!.maxHp;
  useSkill(p, 'hero', 0);
  expect(unitOf(p, 'ally-1')!.shield).toBe(12); // heal 22: 10 to hp, 12 to shield
});

it('nothing hits a unit after it died in the same moment', () => {
  const p = partyRoom();
  const ev: GEvent[] = [];
  for (let i = 0; i < 600; i++) ev.push(...tick(p, 0.1));
  const dead = new Map<string, number>();
  for (const e of ev) {
    if (e.type === 'die') dead.set(e.dst!, e.t);
    if (e.type === 'hit' && dead.has(e.dst!)) expect(e.t).toBeLessThanOrEqual(dead.get(e.dst!)!);
  }
});
```

  (Note for the healer test: the base `heal` skill heals 22 to the most hurt hero.)

- [ ] **Step 2:** Run `npx vitest run tests/unit/partyStatus.test.ts` → FAIL. Implement the rules above. Ensure `damage()` returns early for dead targets (it does) and that `hit` is never emitted for a dead unit.
- [ ] **Step 3:** Run verification commands; green. Commit `feat(party): statuses, advanced skills and passives, healing`.

---

### Task 3: Equipment — armor, rarity, affixes, trinket engravings, pack, potions

**Files:**
- Create: `src/sim/party/partyItems.ts`, `src/sim/party/partyEngrave.ts` (fill the Task 2 no-op), `tests/unit/partyItems.test.ts`
- Modify: `src/sim/party/partyCore.ts` (stats/damage use gear), `src/sim/party/partySim.ts` (`partyRoom` gives starting loadouts), `src/sim/party/partySkills.ts` (cooldown multiplier)

**Interfaces:**
- Produces:
  ```ts
  export type ArmorId = 'cloth' | 'leather' | 'plate';
  export type Rarity = 'common' | 'fine' | 'rare';
  export type AffixId = 'keen' | 'quick' | 'sturdy' | 'focused' | 'vital';
  export type TrinketId = 'thorns' | 'vampire' | 'swift' | 'focus' | 'bulwark' | 'executioner' | 'ember' | 'frostbite'
    | 'link_bait' | 'link_shatter' | 'link_mark' | 'link_guard' | 'link_echo';
  export type Item =
    | { id: string; kind: 'weapon'; base: WeaponId; rarity: Rarity; affix?: AffixId }
    | { id: string; kind: 'armor'; base: ArmorId; rarity: Rarity; affix?: AffixId }
    | { id: string; kind: 'trinket'; base: TrinketId };
  export interface Loadout { weapon: Item & { kind: 'weapon' }; armor: Item & { kind: 'armor' }; trinkets: [TrinketId | null, TrinketId | null] }
  export const ARMORS: Record<ArmorId, { name: string; reduce: number; moveMul: number; atkMul: number }>;
  export const TRINKETS: Record<TrinketId, { name: string; link: boolean }>;
  export const AFFIXES: Record<AffixId, { name: string }>;
  export const PACK_SIZE = 12;
  export function itemName(it: Item): string;                                // e.g. '고급 장궁', '날카로운 석궁', '불씨'
  export function rollItem(p: Party, floor: number, kind?: Item['kind']): Item;
  export function canEquip(u: Unit, it: Item): boolean;
  export function equip(p: Party, heroId: string, itemId: string, slot?: 0 | 1): boolean; // from p.pack; the replaced item goes back to the pack
  export function unequip(p: Party, heroId: string, slot: 0 | 1): boolean;  // trinket slots only; false if the pack is full
  export const wears = (u: Unit, t: TrinketId) => boolean;
  export function maxHpBonus(u: Unit): number;                               // sturdy +15, bulwark trinket +20
  export function drink(p: Party, heroId: string): GEvent[];                 // potion: heal 40% max, costs the hero 0.6
  // Unit gains: gear?: Loadout (always set on heroes; foes and summons have none); Party gains: pack: Item[]; potions: number (3); nextItem: number
  ```

Rules:

- **Armor reduction** in `damage()`: `amount = Math.max(1, Math.round(amount × (1 − reduce)))` for amount > 0, after the weapon guard. The arena test "the shield of a sword-and-board warrior takes a quarter off each blow" becomes 8 → 6 (guard) → 5 (leather); update its expectation to 5.
- **Armor:** cloth `천옷` reduce 0, move ×1, atk ×1, magic classes' skill cooldowns ×0.9; leather `가죽 갑옷` reduce 0.1, ×1, ×1; plate `판금 갑옷` reduce 0.25, move ×1.15, atk ×1.1, magic classes' cooldowns ×1.25. Any class may wear any armor.
- **Rarity:** fine `고급`: weapon damage ×1.15 / armor reduce +0.05. rare `희귀`: fine's bonus + one affix. Names: common = base name; fine = `고급 <base>`; rare = `<affix name> <base>`.
- **Affixes:** keen `날카로운` damage ×1.15; quick `재빠른` attack time ×0.88; sturdy `튼튼한` max hp +15; focused `집중의` cooldowns ×0.85; vital `생명의` healing received ×1.25. An affix applies from whichever item (weapon or armor) carries it.
- **Weapons:** must be in `CLASSES[u.cls].weapons` (advanced classes share their base's list); `u.weapon` stays the `WeaponId` of `u.gear.weapon.base` (keep it in sync in `equip`).
- **Trinkets (2 slots; the same trinket can't be worn twice by one hero):**
  - thorns `가시`: a melee attacker hitting the wearer takes 3.
  - vampire `흡혈`: wearer heals 15% (rounded down, min 1) of basic-attack damage dealt.
  - swift `질풍`: attack time ×0.85.
  - focus `집중`: skill cooldowns ×0.8.
  - bulwark `철벽`: max hp +20.
  - executioner `처형자`: ×1.5 vs targets below 30% hp.
  - ember `불씨`: basic hits 25% chance to burn 3 s.
  - frostbite `동상`: basic hits 20% chance to chill 3 s.
  - link_bait `미끼` (link): the wearer's taunt makes the taunted foes exposed for 5 s.
  - link_shatter `공명 파쇄` (link): the wearer's hits on frozen or chilled foes ×2; a frozen target's freeze is consumed (`react` `'shatter'`).
  - link_mark `사냥 표식` (link): the wearer's basic hits mark the target 4 s (`markBy` = wearer).
  - link_guard `수호 서약` (link): like `cover` — 30% of the damage an adjacent ally takes goes to the wearer (does not stack with `cover` on the same pair; take the first).
  - link_echo `메아리` (link): when another hero within 3 casts a skill, the wearer's next basic attack ×2 (reuse `empower`; don't lower an existing higher empower).
- **Max HP changes on equip/unequip:** recompute `maxHp = CLASSES[cls].hp + maxHpBonus(u) (+ level bonus from Task 6)`. Gaining max hp also adds it to hp; losing it clamps hp to the new max but never below 1 for a living hero.
- **Starting loadout** (`partyRoom` and Task 5 `newExpedition`): the picked weapon `common`; armor leather for warrior/cleric, cloth otherwise; no trinkets.
- **`rollItem(p, floor, kind?)`:** kind weights weapon 40 / armor 30 / trinket 30 if not given. Weapon base: uniform over all 10 weapons. Armor base: cloth 40 / leather 35 / plate 25. Rarity: rare `0.10 + 0.05 × (floor − 1)`, fine `0.30`, else common. Affix uniform. Trinket uniform over 13. Ids `i${p.nextItem++}`.
- **Pack:** `p.pack` max `PACK_SIZE`. `equip` refuses (false) if the item is not in the pack, the hero is dead, `canEquip` is false, or the slot is invalid. A swap never needs free room (one in, one out).
- **Potions:** `drink` refuses (`[]`) at 0 potions or for a dead hero; heals `round(0.4 × maxHp)` through `heal()` (src = the hero), `potions--`, `u.nextAt = max(u.nextAt, p.time + 0.6)`; event `drink`-like: use `{ type: 'heal', src, dst, amount, text: 'potion' }`.

- [ ] **Step 1: Write failing tests** `tests/unit/partyItems.test.ts`:

```ts
import { expect, it } from 'vitest';
import { damage, entOf, unitOf } from '../../src/sim/party/partyCore';
import { drink, equip, rollItem, unequip, PACK_SIZE, type Item } from '../../src/sim/party/partyItems';
import { partyRoom } from '../../src/sim/party/partySim';
import { useSkill } from '../../src/sim/party/partySkills';

const give = (p: ReturnType<typeof partyRoom>, it: Item) => { p.pack.push(it); return it.id; };
const foe = (p: ReturnType<typeof partyRoom>) => p.units.find((u) => u.side === 'foe')!;

it('heroes start with their picked weapon and class armor, no trinkets, three potions', () => {
  const p = partyRoom();
  expect(unitOf(p, 'hero')!.gear!.armor.base).toBe('leather');
  expect(unitOf(p, 'ally-1')!.gear!.armor.base).toBe('cloth');
  expect(unitOf(p, 'hero')!.gear!.trinkets).toEqual([null, null]);
  expect(p.potions).toBe(3);
});

it('a class cannot take another line\'s weapon; a fitting one swaps with the old', () => {
  const p = partyRoom();
  const bow = give(p, { id: 'x1', kind: 'weapon', base: 'crossbow', rarity: 'common' });
  expect(equip(p, 'hero', bow)).toBe(false);
  expect(equip(p, 'ally-1', bow)).toBe(true);
  expect(unitOf(p, 'ally-1')!.weapon).toBe('crossbow');
  expect(p.pack.some((i) => i.kind === 'weapon' && i.base === 'longbow')).toBe(true);
});

it('plate takes a quarter off and leather a tenth (after the shield guard)', () => {
  const p = partyRoom();
  equip(p, 'ally-1', give(p, { id: 'a1', kind: 'armor', base: 'plate', rarity: 'common' }));
  const e = entOf(p, 'ally-1')!, hp = e.hp;
  damage(p, 0, foe(p).id, unitOf(p, 'ally-1')!, 8, []);
  expect(hp - e.hp).toBe(6);
});

it('the bulwark trinket raises max hp and taking it off never leaves hp above max or at 0', () => {
  const p = partyRoom();
  const e = entOf(p, 'ally-1')!;
  equip(p, 'ally-1', give(p, { id: 't1', kind: 'trinket', base: 'bulwark' }), 0);
  expect(e.maxHp).toBe(60);
  expect(e.hp).toBe(60);
  e.hp = 55;
  expect(unequip(p, 'ally-1', 0)).toBe(true);
  expect(e.maxHp).toBe(40);
  expect(e.hp).toBe(40);
  e.hp = 1;
  equip(p, 'ally-1', p.pack.find((i) => i.id === 't1')!.id, 0);
  unequip(p, 'ally-1', 0);
  expect(e.hp).toBeGreaterThanOrEqual(1);
});

it('unequip refuses when the pack is full', () => {
  const p = partyRoom();
  equip(p, 'hero', give(p, { id: 't2', kind: 'trinket', base: 'thorns' }), 0);
  while (p.pack.length < PACK_SIZE) give(p, { id: `f${p.pack.length}`, kind: 'trinket', base: 'swift' });
  expect(unequip(p, 'hero', 0)).toBe(false);
  expect(unitOf(p, 'hero')!.gear!.trinkets[0]).toBe('thorns');
});

it('rolled items follow the floor: deeper floors roll more rares', () => {
  const p = partyRoom();
  const rares = (floor: number) => Array.from({ length: 400 }, () => rollItem(p, floor)).filter((i) => i.kind !== 'trinket' && i.rarity === 'rare').length;
  expect(rares(5)).toBeGreaterThan(rares(1));
});

it('a potion heals 40% and is used up', () => {
  const p = partyRoom();
  const e = entOf(p, 'hero')!; e.hp = 10;
  drink(p, 'hero');
  expect(e.hp).toBe(10 + 28);
  expect(p.potions).toBe(2);
  p.potions = 0;
  expect(drink(p, 'hero')).toEqual([]);
});

it('link_bait: the warrior\'s taunt exposes nearby foes', () => {
  const p = partyRoom();
  equip(p, 'hero', give(p, { id: 't3', kind: 'trinket', base: 'link_bait' }), 0);
  const f = foe(p);
  entOf(p, f.id)!.pos = { x: 5, y: 4 };
  useSkill(p, 'hero', 0);
  expect(f.exposedUntil).toBeGreaterThan(p.time + 4);
});
```

- [ ] **Step 2:** Run → FAIL. Implement. `stats(u, t)` folds in: weapon rarity/affix damage, quick/swift attack time, armor move/atk multipliers, chill (from Task 2) stays in `tick`. Skill cooldown in `useSkill`: `cd × focusedAffix × focusTrinket × armorMagicMul`.
- [ ] **Step 3:** Run verification commands; green. Commit `feat(party): equipment, trinket engravings with cross-hero links, potions`.

---

### Task 4: Foes — six kinds, floor scaling, elites, shaman and the demon general

**Files:**
- Modify: `src/sim/party/partyFoeDefs.ts`, `src/sim/party/partySim.ts` (`turn` calls foe specials first)
- Create: `src/sim/party/partyFoeAi.ts`, `tests/unit/partyFoes.test.ts`

**Interfaces:**
- Produces:
  ```ts
  export type FoeId = 'goblin' | 'archer' | 'brute' | 'ghoul' | 'shaman' | 'warlord';
  export const FOES: Record<FoeId, { name: string; hp: number; dmg: [number, number]; range: number; atk: number; move: number }>;
  export const FOE_XP: Record<FoeId, number>;
  export const FOE_OF_KIND: Record<FoeKind, FoeId>;   // minion→goblin, archer→archer, brute→brute, ghoul→ghoul, mage→shaman, champion→warlord
  export function foeScale(floor: number, elite: boolean): { hp: number; dmg: number }; // multipliers
  export function foeTurn(p: Party, u: Unit, t: number, ev: GEvent[]): number | undefined; // a special action, or undefined to fall through to the normal turn
  // Unit gains (add the numeric ones with 0 to `blank()`): elite?: boolean; floor?: number (for damage scaling); special: number (next time a special may fire); slamAt?: number; summoned?: boolean (warlord's half-hp call done)
  ```

Numbers:

| id | name | hp | dmg | range | atk | move | xp |
|---|---|---|---|---|---|---|---|
| goblin | 고블린 | 22 | 3–5 | 1 | 1.0 | 0.8 | 2 |
| archer | 고블린 궁수 | 16 | 3–5 | 6 | 1.3 | 1.0 | 2 |
| brute | 오우거 | 48 | 7–10 | 1 | 1.6 | 1.0 | 4 |
| ghoul | 구울 | 18 | 2–4 | 1 | 0.7 | 0.55 | 2 |
| shaman | 주술사 | 20 | 4–6 | 5 | 1.5 | 1.0 | 3 |
| warlord | 마왕군 장군 | 320 | 10–14 | 1 | 1.5 | 1.0 | 30 |

- `foeScale(floor, elite)`: hp × `(1 + 0.2 × (floor − 1)) × (elite ? 1.6 : 1)`, dmg × `(1 + 0.12 × (floor − 1)) × (elite ? 1.3 : 1)`. Elite xp ×2. Damage rolls of a foe are multiplied by its dmg scale (round).
- **Shaman:** when `t >= u.special` and an awake foe within 5 is below 70% hp, heal the most hurt such foe by 12 (event `heal`), `u.special = t + 6`, return 1.2. Otherwise fall through.
- **Warlord:**
  - Slam: when `t >= u.special` and a hero is within 2: emit `{ type: 'telegraph', src: id, to: pos, amount: 2, text: 'slam' }` (amount = radius), set `u.slamAt = t + 1.5`, `u.special = t + 9`, return 1.5 (it winds up). On its next moment at or after `slamAt`: every hero (and summon) within Chebyshev 2 of the warlord takes 18–24 × dmg scale (`react` event `'shatter'` at its cell for the view), clear `slamAt`, return 1.0. Heroes who moved out in between are spared — that is the point of pausing.
  - Call: the first time its hp drops below 50%, spawn 3 goblins (same floor scale) on free walkable cells within 3 (awake, same group) with `summon` events; set `u.summoned = true`.
- `WAVES` for the arena stays as it is (it uses goblin/archer/brute).

- [ ] **Step 1: Write failing tests** `tests/unit/partyFoes.test.ts`:

```ts
import { expect, it } from 'vitest';
import { damage, entOf, unitOf, blank } from '../../src/sim/party/partyCore';
import { FOES, foeScale } from '../../src/sim/party/partyFoeDefs';
import { partyRoom, tick } from '../../src/sim/party/partySim';
import { spawnFoe } from '../../src/sim/grid/foes';
import type { GEvent } from '../../src/sim/grid/types';

function addFoe(p: ReturnType<typeof partyRoom>, foe: 'shaman' | 'warlord', at: { x: number; y: number }) {
  const e = spawnFoe(p.s, foe === 'warlord' ? 'champion' : 'mage', at, true);
  e.hp = e.maxHp = FOES[foe].hp;
  const u = { ...blank(), id: e.id, side: 'foe' as const, foe, floor: 1, special: 0 };
  p.units.push(u);
  return u;
}

it('deeper and elite foes are tougher', () => {
  expect(foeScale(1, false)).toEqual({ hp: 1, dmg: 1 });
  expect(foeScale(5, false).hp).toBeCloseTo(1.8);
  expect(foeScale(1, true).hp).toBeCloseTo(1.6);
});

it('a shaman mends a hurt ally instead of attacking, then waits six seconds', () => {
  const p = partyRoom();
  const sh = addFoe(p, 'shaman', { x: 12, y: 8 });
  const hurt = p.units.find((u) => u.side === 'foe' && u.foe === 'goblin')!;
  entOf(p, hurt.id)!.hp = 5;
  const ev: GEvent[] = [];
  for (let i = 0; i < 20; i++) ev.push(...tick(p, 0.1));
  expect(ev.filter((e) => e.type === 'heal' && e.src === sh.id)).toHaveLength(1);
});

it('the general telegraphs a slam; a hero still in reach when it lands is hit, one who left is not', () => {
  const p = partyRoom();
  for (const u of p.units) if (u.side === 'foe') entOf(p, u.id)!.alive = false;
  const w = addFoe(p, 'warlord', { x: 6, y: 4 });
  entOf(p, 'hero')!.pos = { x: 5, y: 4 };
  entOf(p, 'ally-1')!.pos = { x: 7, y: 5 };
  entOf(p, 'ally-2')!.pos = { x: 2, y: 8 };
  let ev: GEvent[] = [];
  for (let i = 0; i < 30 && !ev.some((e) => e.type === 'telegraph'); i++) ev = tick(p, 0.1);
  expect(ev.some((e) => e.type === 'telegraph' && e.src === w.id)).toBe(true);
  entOf(p, 'ally-1')!.pos = { x: 10, y: 8 }; // steps out
  unitOf(p, 'ally-1')!.nextAt = 99; unitOf(p, 'hero')!.nextAt = 99; unitOf(p, 'ally-2')!.nextAt = 99;
  const after: GEvent[] = [];
  for (let i = 0; i < 25; i++) after.push(...tick(p, 0.1));
  const slam = after.filter((e) => e.type === 'hit' && e.src === w.id);
  expect(slam.some((e) => e.dst === 'hero')).toBe(true);
  expect(slam.some((e) => e.dst === 'ally-1')).toBe(false);
});

it('the general calls three goblins once when it falls below half', () => {
  const p = partyRoom();
  const w = addFoe(p, 'warlord', { x: 12, y: 4 });
  damage(p, 0, 'hero', w, 170, []);
  const ev: GEvent[] = [];
  for (let i = 0; i < 30; i++) ev.push(...tick(p, 0.1));
  expect(ev.filter((e) => e.type === 'summon' && e.src === w.id)).toHaveLength(3);
  damage(p, 1, 'hero', w, 10, []);
  const more: GEvent[] = [];
  for (let i = 0; i < 30; i++) more.push(...tick(p, 0.1));
  expect(more.filter((e) => e.type === 'summon' && e.src === w.id)).toHaveLength(0);
});
```

- [ ] **Step 2:** Run → FAIL. Implement. Arena foes (`partyRoom`/`nextWave`) get `floor: 1, special: 0`.
- [ ] **Step 3:** Run verification commands; green. Commit `feat(party): six foe kinds, floor scaling, elites, shaman, demon general`.

---

### Task 5: The expedition floor — map, vision, waking, following, doors, chests

**Files:**
- Create: `src/sim/party/expedition.ts`, `tests/unit/expedition.test.ts`
- Modify: `src/sim/party/partyCore.ts` (`targetOf`: heroes target only awake foes within 10; foes target heroes and summons), `src/sim/party/partySim.ts` (`turn`: asleep foes skip; following; doors; hold clearing via `inCombat`)

**Interfaces:**
- Produces:
  ```ts
  export const SIGHT = 8;
  export function newExpedition(picks: Pick[], seed: number): Party;     // floor 1, arena = false, level 1
  export function setupFloor(p: Party, floor: number): void;             // used by newExpedition and descend (Task 6)
  export function refreshVision(p: Party): void;                        // union FOV of living heroes → p.s.visible, p.s.seen
  export function inCombat(p: Party): boolean;                          // an awake living foe within 10 of a living hero
  export function orderParty(p: Party, cell: Cell): void;               // the leader moves; the others follow
  export function openChestsNear(p: Party, ev: GEvent[]): void;         // out of combat, a hero within 1 of a closed chest opens it
  // Party gains: floor: number; seed: number; leader: string ('hero' or first alive hero); expedition: boolean
  // Unit gains (foes): asleep: boolean; group: number
  ```

Rules:

- **`setupFloor(p, floor)`**: `map = generateMap(p.seed, floor)`. Replace `p.s.map`, `p.s.seen` (new `Uint8Array`), chests (`p.s.chests` from `map.chests`), `p.s.run.floor = floor`. Remove all foe units and foe/summon Ents; keep the three hero Ents (dead ones too) and place living heroes on `map.start` and the nearest free walkable cells (BFS). Spawn foes from `map.spawns` with `spawnFoe(p.s, kind, pos, false)`, `Unit.foe = FOE_OF_KIND[kind]`, `asleep = true`, `group = spawn.group`, `elite = spawn.elite`, hp scaled with `foeScale(floor, elite)`.
  - **Bolster** (party maps need bigger packs; use a separate stream `createRng((p.seed ^ 0x5a17) + floor * 977)`): for every room group with spawns except the warlord's, add 1–2 more foes on free floor cells of the same room (cells inside that room's `Room` rect, not taken, not the start room): kind 60% goblin(`minion`) / 25% archer / 15% shaman(`mage`) on floors 1–2, and from floor 3 add brute 15% (goblin 45 / archer 25 / shaman 15 / brute 15).
- **Vision:** `refreshVision` after every `tick` and after `setupFloor`: `p.s.visible` = union of `computeFov(map, heroPos, SIGHT)` for living heroes; mark `p.s.seen`.
- **Waking:** at the end of each `tick`, any sleeping foe whose cell is visible and within 7 of a living hero wakes its whole group (`asleep = false` for every foe with the same `group`), one `{ type: 'wake', src: <first foe id>, text: String(group) }` per group. Any damage to a sleeping foe also wakes its group. Sleeping foes take no turns (their `nextAt` is set to `p.time + 0.2 × index` when they wake).
- **Targeting:** heroes (and summons) without orders choose among awake living foes within 10; foes target living heroes and summons not hidden. Attack orders may target any living foe (attacking a sleeping foe wakes it on hit).
- **Combat state:** `inCombat(p)`. When it goes from true to false at the end of a tick, every `hold` order is cleared (`order = null`).
- **Following (out of combat):** a hero without an order that is not the leader, and summons (following their owner), step toward the leader when farther than 2 (Chebyshev); target cell = the free walkable cell within 1 of the leader closest to the follower; if none, wait 0.3. Leader = `p.leader` if alive, else the first living hero in `HERO_IDS` order (update `p.leader`).
- **Moving out of combat:** a `move` order that arrives when not in combat clears (`order = null`) instead of becoming `hold`; in combat it becomes `hold` (Task-0 arena behaviour stays: the arena is always "in combat" — `inCombat` returns true when `p.arena`).
- **`orderParty(p, cell)`:** sets the leader's order to `move` to `cell`, clears other heroes' `move`/`hold` orders.
- **Doors:** when any unit steps onto a `door` tile it becomes `open` and an `{ type: 'door', src, to }` event is pushed. Opaque doors block vision until opened (FOV already treats `door` as opaque).
- **Chests:** `openChestsNear` runs at the end of each tick when not in combat: for each closed chest within 1 of a living hero, if `p.pack.length < PACK_SIZE` mark it opened, add `rollItem(p, p.floor)` to the pack, push `{ type: 'open', src: heroId, to: chestPos }` and `{ type: 'loot', src: heroId, text: itemName(item) }`. Full pack: leave it closed.
- `tick` in an expedition stops acting once `p.outcome` (Task 6) is set.

- [ ] **Step 1: Write failing tests** `tests/unit/expedition.test.ts`:

```ts
import { expect, it } from 'vitest';
import { entOf, unitOf } from '../../src/sim/party/partyCore';
import { DEFAULT_PICKS } from '../../src/sim/party/partyDefs';
import { inCombat, newExpedition, orderParty, refreshVision } from '../../src/sim/party/expedition';
import { tick } from '../../src/sim/party/partySim';
import { losClear } from '../../src/sim/grid/fov';
import { DIRS, dist, idx, tileAt, walkable, type Cell, type Room } from '../../src/sim/grid/types';
import type { GEvent } from '../../src/sim/grid/types';

const heroes = (p: ReturnType<typeof newExpedition>) => p.units.filter((u) => u.side === 'hero' && !u.summon);
const foes = (p: ReturnType<typeof newExpedition>) => p.units.filter((u) => u.side === 'foe');
const free = (p: ReturnType<typeof newExpedition>, c: Cell) => walkable(tileAt(p.s.map, c)) && !p.s.chests.some((k) => k.pos.x === c.x && k.pos.y === c.y);
const freeIn = (p: ReturnType<typeof newExpedition>, r: Room): Cell => {
  for (let y = r.y; y < r.y + r.h; y++) for (let x = r.x; x < r.x + r.w; x++) if (free(p, { x, y }) && tileAt(p.s.map, { x, y }) === 'floor') return { x, y };
  throw new Error('no free cell');
};

it('a new expedition starts on floor 1 with three heroes at the start and sleeping foes in groups', () => {
  const p = newExpedition(DEFAULT_PICKS, 7);
  expect(p.floor).toBe(1);
  expect(heroes(p)).toHaveLength(3);
  for (const h of heroes(p)) expect(dist(entOf(p, h.id)!.pos, p.s.map.start)).toBeLessThanOrEqual(2);
  expect(foes(p).every((f) => f.asleep)).toBe(true);
  const groups = new Map<number, number>();
  for (const f of foes(p)) groups.set(f.group, (groups.get(f.group) ?? 0) + 1);
  expect([...groups.values()].some((n) => n >= 2)).toBe(true); // bolstered packs
});

it('the same seed builds the same floor', () => {
  const a = newExpedition(DEFAULT_PICKS, 3), b = newExpedition(DEFAULT_PICKS, 3);
  expect(foes(a).map((f) => entOf(a, f.id)!.pos)).toEqual(foes(b).map((f) => entOf(b, f.id)!.pos));
});

it('vision is the union of what the three heroes see', () => {
  const p = newExpedition(DEFAULT_PICKS, 7);
  refreshVision(p);
  for (const h of heroes(p)) expect(p.s.visible.has(idx(p.s.map, entOf(p, h.id)!.pos))).toBe(true);
});

it('seeing a sleeping foe wakes its whole group once', () => {
  const p = newExpedition(DEFAULT_PICKS, 7);
  const f = foes(p)[0]!;
  const near = entOf(p, f.id)!.pos;
  // stand the leader two cells from that foe, in clear sight
  const spots: Cell[] = [];
  for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++) { const c = { x: near.x + dx, y: near.y + dy }; if (dist(c, near) === 2 && free(p, c) && losClear(p.s.map, c, near)) spots.push(c); }
  entOf(p, 'hero')!.pos = spots[0]!;
  const ev: GEvent[] = [];
  for (let i = 0; i < 5; i++) ev.push(...tick(p, 0.1));
  expect(foes(p).filter((x) => x.group === f.group).every((x) => !x.asleep)).toBe(true);
  expect(ev.filter((e) => e.type === 'wake' && e.text === String(f.group))).toHaveLength(1);
});

it('out of combat the others follow the leader; a move order there clears on arrival', () => {
  const p = newExpedition(DEFAULT_PICKS, 7);
  for (const f of foes(p)) entOf(p, f.id)!.alive = false;
  const cell = freeIn(p, p.s.map.rooms[1]!);
  orderParty(p, cell);
  for (let i = 0; i < 900 && unitOf(p, 'hero')!.order; i++) tick(p, 0.1);
  for (let i = 0; i < 100; i++) tick(p, 0.1);
  expect(entOf(p, 'hero')!.pos).toEqual(cell);
  expect(unitOf(p, 'hero')!.order).toBeNull();
  expect(inCombat(p)).toBe(false);
  for (const id of ['ally-1', 'ally-2']) expect(dist(entOf(p, id)!.pos, cell)).toBeLessThanOrEqual(2);
});

it('walking through a door opens it', () => {
  const p = newExpedition(DEFAULT_PICKS, 7);
  for (const f of foes(p)) entOf(p, f.id)!.alive = false;
  const doors = p.s.map.tiles.map((t, i) => (t === 'door' ? i : -1)).filter((i) => i >= 0);
  const d = doors[0]!;
  orderParty(p, { x: d % p.s.map.w, y: Math.floor(d / p.s.map.w) });
  const ev: GEvent[] = [];
  for (let i = 0; i < 900; i++) ev.push(...tick(p, 0.1));
  expect(p.s.map.tiles[d]).toBe('open');
  expect(ev.some((e) => e.type === 'door')).toBe(true);
});

it('a hero next to a chest out of combat opens it into the pack; a full pack leaves it shut', () => {
  const p = newExpedition(DEFAULT_PICKS, 7);
  for (const f of foes(p)) entOf(p, f.id)!.alive = false;
  const c = p.s.chests[0]!;
  entOf(p, 'hero')!.pos = DIRS.map((d) => ({ x: c.pos.x + d.x, y: c.pos.y + d.y })).find((n) => free(p, n))!;
  const ev = tick(p, 0.1);
  expect(c.opened).toBe(true);
  expect(p.pack).toHaveLength(1);
  expect(ev.some((e) => e.type === 'loot')).toBe(true);
});

it('bodies jamming a corridor never make tick throw or loop without end', () => {
  const p = newExpedition(DEFAULT_PICKS, 11);
  for (let i = 0; i < 3000 && !p.outcome; i++) expect(() => tick(p, 0.1)).not.toThrow();
});
```

- [ ] **Step 2:** Run → FAIL. Implement. Keep `partyRoom` (arena) behaviour: everything awake, `inCombat` true, no vision changes (it already sets everything visible).
- [ ] **Step 3:** Run verification commands (including the old `partySim.test.ts`); green. Commit `feat(party): expedition floors with vision, waking packs, following, doors, chests`.

---

### Task 6: Levels, soul stones, stairs, retreat, outcome

**Files:**
- Create: `src/sim/party/expeditionFlow.ts`, `tests/unit/expeditionFlow.test.ts`, `tests/unit/partyProgress.test.ts`
- Modify: `src/sim/party/partyProgress.ts` (xp/levels), `src/sim/party/partyCore.ts` (kill → xp; hero death → soul stone), `src/sim/party/partySim.ts`

**Interfaces:**
- Produces:
  ```ts
  // partyProgress.ts
  export const LEVELS = [0, 15, 40, 80, 130, 200, 290, 400]; // xp needed for level 1..8
  export function gainXp(p: Party, xp: number, ev: GEvent[]): void;  // levels up the party (levelUp events)
  export const levelDmg = (p: Party) => 1 + 0.05 * (p.level - 1);
  // expeditionFlow.ts
  export interface SoulStone { heroId: string; pos: Cell; floor: number; gear: Loadout; recovered: boolean }
  export type Outcome = 'won' | 'retreated' | 'wiped';
  export function canDescend(p: Party): boolean;
  export function descend(p: Party): GEvent[];
  export function retreat(p: Party): boolean;
  export function expeditionResult(p: Party): { outcome: Outcome | undefined; floor: number; level: number; heroes: { id: string; cls: ClassId; state: 'alive' | 'recovered' | 'lost' }[]; pack: Item[] };
  // Party gains: souls: SoulStone[]; outcome?: Outcome
  ```

Rules:

- **XP:** each foe kill gives the party `FOE_XP[foe] × (elite ? 2 : 1)` (summons/arena too — harmless). Reaching `LEVELS[level]` raises `p.level` (max 8); per level every hero (alive) gains `round(0.08 × CLASSES[cls].hp)` max hp and the same hp; one `{ type: 'levelUp', text: String(level) }` per level. Hero damage rolls × `levelDmg(p)`. Max hp formula from Task 3 becomes `CLASSES[cls].hp + maxHpBonus(u) + levelHp(u)` where `levelHp` = `(p.level − 1) × round(0.08 × CLASSES[cls].hp)`; promotion keeps the level part (recompute after changing `cls`).
- **Soul stones:** when a hero (not a summon) dies in an expedition, push `{ heroId, pos, floor, gear, recovered: false }` and an event `{ type: 'drop', src: heroId, to: pos, text: 'soul' }`. Its summons die with it. At the end of a tick, if not in combat, a living hero within 1 of an unrecovered stone on this floor picks it up: `recovered = true`, `{ type: 'pickup', src: heroId, dst: stoneHeroId, text: 'soul' }`. A recovered hero stays dead for the rest of the expedition (re-implanting happens at the base, phase 2).
- **Stairs:** `canDescend` = not in combat, `p.s.map.stairs` exists, every living hero within 2 of it. `descend`: refuse (`[]`) if not allowed; unrecovered stones of this floor become lost (keep them in `p.souls` with `recovered: false`); `setupFloor(p, floor + 1)`; events `{ type: 'stairs' }` then `{ type: 'floor', amount: newFloor }`. Living heroes keep hp, cooldowns reset (`ready = [time, time]`), statuses cleared.
- **Victory:** when the warlord dies → `p.outcome = 'won'`, event `{ type: 'victory' }`.
- **Wipe:** all three heroes dead → `p.outcome = 'wiped'`; every unrecovered stone is lost.
- **Retreat:** `retreat(p)` allowed when not in combat and no outcome yet → `p.outcome = 'retreated'`; true/false.
- **Result:** hero state = `alive` if alive, `recovered` if its stone was recovered (or the hero is alive), else `lost`. On `wiped`, recovered stones carried by now-dead heroes are lost too (nobody carried them home): every hero is `lost`.
- After an outcome, `tick` returns `[]` and changes nothing.

- [ ] **Step 1: Write failing tests** `tests/unit/partyProgress.test.ts`:

```ts
import { expect, it } from 'vitest';
import { entOf } from '../../src/sim/party/partyCore';
import { gainXp, levelDmg } from '../../src/sim/party/partyProgress';
import { DEFAULT_PICKS } from '../../src/sim/party/partyDefs';
import { newExpedition } from '../../src/sim/party/expedition';
import type { GEvent } from '../../src/sim/grid/types';

it('xp raises the party level, adds 8% class hp per level and damage 5%', () => {
  const p = newExpedition(DEFAULT_PICKS, 7);
  const ev: GEvent[] = [];
  gainXp(p, 40, ev);
  expect(p.level).toBe(3);
  expect(ev.filter((e) => e.type === 'levelUp')).toHaveLength(2);
  expect(entOf(p, 'hero')!.maxHp).toBe(70 + 2 * 6);
  expect(levelDmg(p)).toBeCloseTo(1.1);
  gainXp(p, 10000, ev);
  expect(p.level).toBe(8);
});
```

  and `tests/unit/expeditionFlow.test.ts`:

```ts
import { expect, it } from 'vitest';
import { damage, entOf, unitOf } from '../../src/sim/party/partyCore';
import { DEFAULT_PICKS } from '../../src/sim/party/partyDefs';
import { newExpedition } from '../../src/sim/party/expedition';
import { canDescend, descend, expeditionResult, retreat } from '../../src/sim/party/expeditionFlow';
import { tick } from '../../src/sim/party/partySim';

const clearFoes = (p: ReturnType<typeof newExpedition>) => { for (const u of p.units) if (u.side === 'foe') entOf(p, u.id)!.alive = false; };
// stacking on one cell is fine here: canDescend only measures distance
const toStairs = (p: ReturnType<typeof newExpedition>) => {
  const s = p.s.map.stairs!;
  for (const id of ['hero', 'ally-1', 'ally-2']) if (entOf(p, id)!.alive) entOf(p, id)!.pos = { x: s.x, y: s.y };
};

it('a fallen hero drops a soul stone; a living hero next to it out of combat recovers it', () => {
  const p = newExpedition(DEFAULT_PICKS, 7);
  clearFoes(p);
  const at = { ...entOf(p, 'ally-1')!.pos };
  damage(p, 0, 'x', unitOf(p, 'ally-1')!, 999, []);
  expect(p.souls).toHaveLength(1);
  entOf(p, 'hero')!.pos = { x: at.x, y: at.y };
  const ev = tick(p, 0.1);
  expect(p.souls[0]!.recovered).toBe(true);
  expect(ev.some((e) => e.type === 'pickup' && e.text === 'soul')).toBe(true);
});

it('descending leaves an unrecovered stone behind for good, and needs everyone at the stairs out of combat', () => {
  const p = newExpedition(DEFAULT_PICKS, 7);
  clearFoes(p);
  damage(p, 0, 'x', unitOf(p, 'ally-2')!, 999, []);
  entOf(p, 'hero')!.pos = { x: 1, y: 1 };
  expect(canDescend(p)).toBe(false);
  toStairs(p);
  expect(canDescend(p)).toBe(true);
  descend(p);
  expect(p.floor).toBe(2);
  retreat(p);
  const r = expeditionResult(p);
  expect(r.outcome).toBe('retreated');
  expect(r.heroes.find((h) => h.id === 'ally-2')!.state).toBe('lost');
  expect(r.heroes.find((h) => h.id === 'hero')!.state).toBe('alive');
});

it('a recovered stone comes home with a retreat', () => {
  const p = newExpedition(DEFAULT_PICKS, 7);
  clearFoes(p);
  const at = { ...entOf(p, 'ally-1')!.pos };
  damage(p, 0, 'x', unitOf(p, 'ally-1')!, 999, []);
  entOf(p, 'hero')!.pos = at;
  tick(p, 0.1);
  expect(retreat(p)).toBe(true);
  expect(expeditionResult(p).heroes.find((h) => h.id === 'ally-1')!.state).toBe('recovered');
});

it('a wipe loses everyone and stops the clock', () => {
  const p = newExpedition(DEFAULT_PICKS, 7);
  for (const id of ['hero', 'ally-1', 'ally-2']) damage(p, 0, 'x', unitOf(p, id)!, 999, []);
  tick(p, 0.1);
  expect(p.outcome).toBe('wiped');
  expect(expeditionResult(p).heroes.every((h) => h.state === 'lost')).toBe(true);
  expect(tick(p, 1)).toEqual([]);
});

it('retreat is refused in combat', () => {
  const p = newExpedition(DEFAULT_PICKS, 7);
  const f = p.units.find((u) => u.side === 'foe')!;
  f.asleep = false;
  entOf(p, f.id)!.pos = { ...entOf(p, 'hero')!.pos, x: entOf(p, 'hero')!.pos.x + 1 };
  expect(retreat(p)).toBe(false);
});

it('floor 5 has the general and no stairs; killing it wins', () => {
  const p = newExpedition(DEFAULT_PICKS, 7);
  for (let f = 1; f < 5; f++) { clearFoes(p); toStairs(p); descend(p); }
  expect(p.floor).toBe(5);
  expect(p.s.map.stairs).toBeUndefined();
  const w = p.units.find((u) => u.foe === 'warlord')!;
  damage(p, p.time, 'hero', w, 99999, []);
  tick(p, 0.1);
  expect(p.outcome).toBe('won');
});
```

- [ ] **Step 2:** Run → FAIL. Implement.
- [ ] **Step 3:** Run verification commands; green. Commit `feat(party): levels, soul stones, stairs, retreat, expedition outcome`.

---

### Task 7: Expedition bot and balance pass

**Files:**
- Create: `tests/bot/partyBot.ts`, `tests/bot/partyExpedition.bot.ts`, `docs/superpowers/plans/2026-10-06-party-expedition-results.md`
- Modify (numbers only, if needed for the targets): `src/sim/party/partyFoeDefs.ts`, `src/sim/party/partyClasses.ts`, `src/sim/party/partyDefs.ts`, `src/sim/party/expedition.ts` (bolster counts)

**Interfaces:**
- Consumes: everything above.
- Produces:
  ```ts
  export type Policy = 'auto' | 'smart';
  export function playExpedition(picks: Pick[], seed: number, policy: Policy, maxGameSeconds?: number): { outcome: Outcome | 'timeout'; floor: number; level: number; time: number; promoted: ClassId[]; lost: number };
  ```

Bot behaviour (one decision pass every 0.5 game seconds, then `tick(p, 0.5)`):

- Both policies, out of combat: if `canDescend` → `descend`. Else recover any unrecovered soul stone on this floor (`orderParty` to it). Else open the nearest reachable closed chest (`orderParty` next to it). Else explore: `orderParty` to the nearest reachable `seen === 0` walkable cell adjacent to a seen walkable cell (frontier, by BFS from the leader); if none left, `orderParty` to the stairs (floor 5: to the warlord's position). Also: equip any pack item that `canEquip` and scores higher (score: weapon/armor rarity common 0 / fine 1 / rare 2; trinkets fill empty slots first), and `promote` (first ready option) when any option is ready.
- `auto`: nothing else (heroes fight on their own).
- `smart`, in combat, per living hero (skill readiness per `u.ready`):
  - `heal`: queue when any hero < 50% hp. `sanctuary`: ≥2 heroes < 70% within 4. `ward`/`bulwark`: ≥2 awake foes within 2 of any hero.
  - `taunt`: ≥2 awake foes within 2 of a non-warrior-line hero. `frenzy`/`stealth`/`smoke`/`venom`: whenever ready and an awake foe is within 3.
  - Damage skills (`whirl`, `pierce`, `volley`, `fireball`, `frost`, `storm`, `snare`, `smite`, `aimed`, `backstab`): whenever ready; `whirl` only with ≥2 adjacent foes; `fireball` prefers ≥2 foes within 1 of the target (otherwise only on elites/warlord).
  - `raise`: whenever ready.
  - Potion: a hero < 30% hp drinks if potions remain.
  - Warlord `telegraph` event seen: every hero within 2 of the warlord gets a `move` order to a free cell at distance 3 from it.
- Timeout: 3600 game seconds.

Report (`npx vitest run -c tests/bot/vitest.bot.config.ts tests/bot/partyExpedition.bot.ts --silent=false`): four comps × 20 seeds × 2 policies:
1. warrior/swordShield + archer/longbow + mage/staff
2. warrior/greataxe + cleric/mace + rogue/daggers
3. cleric/symbol + archer/crossbow + mage/wand
4. warrior/swordShield + cleric/mace + archer/longbow

Print per comp and policy: win %, average floor reached, average level, promotions seen, average heroes lost, average time.

**Targets** (tune numbers until met, prefer foe hp/dmg scaling, bolster counts, `LEVELS`; do not change rules): `smart` win rate 30–55% averaged over the four comps, no comp at 0% or above 80%; `auto` win rate ≤ 10%; at least one promotion seen on average by floor 3 in `smart` runs; typical `smart` win takes 20–45 game minutes. Write the final table, every number you changed (old → new) and anything odd you noticed into the results doc.

- [ ] **Step 1:** Write `tests/bot/partyBot.ts` with `playExpedition` and the bot file that prints the table and asserts only that every run ends (no throw) — balance targets are reported, not asserted.
- [ ] **Step 2:** Run it, tune, rerun (keep unit tests green after every change: `npx vitest run tests/unit/party*`).
- [ ] **Step 3:** Write the results doc. Run the full suite `npx vitest run`, `npx tsc --noEmit -p .`, `npm run lint`. Commit `feat(party): expedition bot and first balance pass`.

---

## Out of scope (Claude does these afterwards)

- `?demo=expedition` screen: floor view with fog, hero cards, pack/equipment panel, chest/loot toasts, soul stone markers, warlord telegraph cells, stairs prompt, result screen.
- Visual change on promotion, item models, outfits.
- Base (phase 2), region map and raids (phase 3).
