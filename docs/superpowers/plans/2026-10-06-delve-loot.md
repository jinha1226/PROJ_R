# 지하 던전 보상 (1단계) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give the dungeon below the pod things worth finding: wider floors with special rooms (vault, shrine, hero crypt, ore vein, trap corridor, elite den, a general's hall every 5th floor), equipment (weapons, armour, trinkets with cross-hero link engravings), base materials (ore, crystal) and potions, chests and drops, gear that falls with a clone and is lost when the floor is left, three more foe kinds and the demon general.

**Architecture:** Deterministic simulation only, under `src/sim/delve/` and `src/sim/party/`. The screens (`src/ui/**`, `src/view/**`) are NOT part of this plan — Claude builds the equipment tab, item icons and room visuals afterwards on the API below. The existing demos must keep compiling and working (`?demo=delve`, the title flow in `src/app/expedition.ts`).

**Tech Stack:** TypeScript (strict), Vitest, ESLint, Node 22.

**Spec:** `docs/superpowers/specs/2026-10-06-soulbound-colony-design.md` (sections 3, 4, 6, 8) plus the decisions below (2026-10-06, from the user):
- Each trip down the shaft generates fresh floors (later a drill upgrade sets the starting depth — not in this plan).
- Floors are wider and varied through **special rooms**.
- **No soul recovery** (already done): a fallen clone's soul is gone. Its **gear drops where it fell**; a living clone may pick it up during the same trip; **leaving the floor loses it**.
- Raids come by expedition count (every 2nd trip) — stage 2, not in this plan.

## Global Constraints

- Source files ≤ 400 lines each (`npm run lint` runs `scripts/check-file-length.mjs`). Split rather than compress.
- `src/sim/**` must not import from `src/view/**` or `src/ui/**`.
- Deterministic: randomness only through `p.s.rng` or a `createRng(...)` stream derived from the floor seed. Same seed ⇒ same floor and loot.
- Do not change the main grid game's behaviour (`src/sim/grid/**`): reuse helpers (`findPath`, `distanceMap`, `computeFov`, `spawnFoe`, `newState`, types) read-only; do not edit `mapgen.ts`.
- Player-facing names are short Korean nouns. No explanatory sentences in data.
- Keep `?demo=delve`, `?demo=world`, `?demo=party` and the title flow compiling; update their call sites minimally when an API they use changes.
- Commit after each task on the current branch, message `feat(delve): …` + blank line + `Co-Authored-By: Codex <noreply@openai.com>`. Do NOT push.
- Verify every task: `npx tsc --noEmit -p .`, `npm run lint`, `npx vitest run tests/unit/delve* tests/unit/party* tests/unit/surface* tests/unit/overworld*`. Before the last commit: `npx vitest run`.

## Review Focus

1. A clone dying while carrying gear on a floor, then the party taking the stairs or the lift — the gear is gone from the next floor and from `takeParty`; a living clone that walks over it first gets it (pack permitting).
2. A full pack: chests stay closed, floor items stay on the floor, equip-swaps still work (one in, one out).
3. Equipping a weapon of another class line, or unequipping trinkets that change max HP — refused, or HP clamped (never above max, never 0 for a living clone).
4. A boss floor: the stairs do not let the party down until the general is dead; its half-health call happens once.
5. Determinism: two `newDelve(seed, floor)` with the same arguments produce identical rooms, chests, ore, traps, spawns and souls.

Each has a test in its task.

---

## Code you are building on (read first)

- `src/sim/party/partyDefs.ts` — `WEAPONS` (`fists` + 10 weapons, each `{ name, dmg, range, atk, look, shield?, guard?, cleave?, splash?, stun?, note }`), `CLASSES` (`shell` + 5 base + `berserker`, `sniper`; each with `weapons: WeaponId[]`), `SKILLS`, `FOES` (`goblin`, `archer`, `brute`), `PROMOTIONS`, `BASE_CLASSES`.
- `src/sim/party/partyCore.ts` — `Unit` (has `weapon`, `cls`, `soul`, `level`, `xp`, `traits`, `picks`, `offer`, `shield`, …), `Party`, `entOf`, `unitOf`, `alive`, `stats`, `canHit`, `targetOf`, `stepToward`, `passiveMult`, `damage` (guard → shield soak → grit → hp), `strike` (hit chance with cover, trait multipliers, cleave/splash/stun, counter).
- `src/sim/party/partyTraits.ts` — `T.*` trait multipliers (the pattern to copy for gear: a helper object of small functions read in the combat code).
- `src/sim/party/partyLevel.ts` — `refitHp(p, u)` (max HP from class + level + toughness; extend it with gear HP bonuses), `gainXp`, `awardXp`.
- `src/sim/party/partySkills.ts` — `useSkill` (cooldown = `SKILLS[s].cd * T.cd(u)`), `queueSkill`.
- `src/sim/party/partySim.ts` — `tick`, `turn`, `command`, `promote`.
- `src/sim/roam/roam.ts` — `RoamParty` (`souls`, `carried`, `bio`, `nextClone`, `base`, `printHere`, `sight`, `over`), `implant(p, u, cls, ev)`, `print`, `roamStep(p, hpBefore, ev)` (gathers bio + XP from fallen foes, soul pickup, printing, wake/leash/combat), `orderTo`.
- `src/sim/roam/carry.ts` — `Carry`, `takeParty`, `placeParty` (moves the party between the surface and a floor).
- `src/sim/delve/delveSim.ts` — `DelveParty` (`floor`, `seed`), `newDelve(seed, floor, carry?)`, `delveTick`, `canDescend`, `descend`, `canAscend`; floors come from `generateMap` (48×48, ≤12 rooms) — this plan replaces that with its own generator.
- Grid types `src/sim/grid/types.ts`: `GridMap` (`rooms`, `spawns`, `chests: Cell[]`, `stairs`, `traps`), `GridState.chests: ChestState[]` (`{ pos, opened }`), `Trap { pos, kind, found }`, `GEvent`, `GEventType` (use only existing types: `open`, `loot`, `pickup`, `trap`, `trapFound`, `heal`, `buff`, `drink`, `telegraph`, `summon`, `react`, `hit`, `die`, `drop`, `move`, `stairs`, `floor`, `victory`).
- The view already draws `s.chests` (closed/opened via an `open` event whose `to` is the chest cell) and found traps in `s.traps`.

---

## File Structure

| File | Responsibility |
|---|---|
| `src/sim/delve/items.ts` (create) | item kinds, rarity, affixes, armours, trinkets (engravings), `Item`, `rollItem`, `itemName` |
| `src/sim/delve/gear.ts` (create) | `Loadout` on clones, `G.*` gear multipliers, `starterGear`, `canEquip`, `equip`, `unequip`, pack helpers, `drink` |
| `src/sim/party/partyEngrave.ts` (create) | trinket engraving hooks used by the combat code (taunt → exposed, marks, guard links, echo) |
| `src/sim/delve/delveGen.ts` (create) | the wider floor (64×64, 16–22 rooms) and its room roles |
| `src/sim/delve/delveRooms.ts` (create) | what happens in rooms: chests, ore, shrine, traps, floor items, dropped gear, boss gate |
| `src/sim/delve/heroSouls.ts` (create) | named hero souls found in crypts |
| `src/sim/party/partyFoeAi.ts` (create) | ghoul, shaman and the general's special moves |
| `src/sim/party/partyDefs.ts` (modify) | `FOES` gains `ghoul`, `shaman`, `warlord`; `FoeId` widened |
| `src/sim/party/partyCore.ts`, `partySkills.ts`, `partySim.ts`, `partyLevel.ts` (modify) | read gear (`G.*`) and engravings; call foe specials |
| `src/sim/roam/roam.ts`, `carry.ts` (modify) | materials, potions, pack, hero souls; carry them across the shaft; give gear on implant |
| `src/sim/delve/delveSim.ts` (modify) | use `delveGen`, populate by floor, `delveTick` runs room rules, boss gate on stairs |
| `tests/unit/delveItems.test.ts`, `delveGen.test.ts`, `delveRooms.test.ts`, `delveFoes.test.ts` (create) | tests per task |
| `tests/bot/delveBot.bot.ts` (create), `docs/superpowers/plans/2026-10-06-delve-loot-results.md` (create) | headless runs and the balance report |

---

### Task 1: Items and equipment

**Files:** create `src/sim/delve/items.ts`, `src/sim/delve/gear.ts`, `src/sim/party/partyEngrave.ts`, `tests/unit/delveItems.test.ts`; modify `src/sim/party/partyCore.ts`, `partySkills.ts`, `partyLevel.ts`, `src/sim/roam/roam.ts`, `src/sim/roam/carry.ts`.

**Interfaces (produce):**
```ts
// items.ts
export type Rarity = 'common' | 'fine' | 'rare';
export type ArmorId = 'cloth' | 'leather' | 'plate';
export type AffixId = 'keen' | 'quick' | 'sturdy' | 'focused' | 'vital';
export type TrinketId = 'thorns' | 'vampire' | 'swift' | 'focus' | 'bulwark' | 'executioner' | 'ember' | 'frostbite'
  | 'link_bait' | 'link_shatter' | 'link_mark' | 'link_guard' | 'link_echo';
export type Item =
  | { id: string; kind: 'weapon'; base: WeaponId; rarity: Rarity; affix?: AffixId }
  | { id: string; kind: 'armor'; base: ArmorId; rarity: Rarity; affix?: AffixId }
  | { id: string; kind: 'trinket'; base: TrinketId };
export const ARMORS: Record<ArmorId, { name: string; reduce: number; moveMul: number; atkMul: number; magicCdMul: number }>;
export const AFFIXES: Record<AffixId, { name: string }>;
export const TRINKETS: Record<TrinketId, { name: string; link: boolean; desc: string }>;
export function itemName(it: Item): string;            // '장궁' / '고급 장궁' / '날카로운 장궁' / '불씨'
export function rollItem(rng: Rng, floor: number, kind?: Item['kind'], minRarity?: Rarity): Omit<Item, 'id'>;
// gear.ts
export interface Loadout { weapon: Item & { kind: 'weapon' }; armor: (Item & { kind: 'armor' }) | null; trinkets: [TrinketId | null, TrinketId | null] }
export const PACK_SIZE = 16;
export const G: { dmg(u): number; atk(u): number; move(u): number; reduce(u): number; hp(u): number; cd(u): number; healTaken(u): number; wears(u, t: TrinketId): boolean };
export function starterGear(cls: ClassId, nextId: () => string): Loadout;   // class's first weapon (common); leather for warrior/cleric, cloth for others; fists + no armour for the shell
export function canEquip(u: Unit, it: Item): boolean;
export function equip(p: RoamParty, heroId: string, itemId: string, slot?: 0 | 1): boolean;  // from p.pack; the replaced item goes back to the pack
export function unequip(p: RoamParty, heroId: string, slot: 'armor' | 0 | 1): boolean;     // false if the pack is full
export function drink(p: RoamParty, heroId: string): GEvent[];  // potion: heal 40% max hp, potions--, costs 0.6
// Unit gains: gear?: Loadout   (always set on clones with a class; u.weapon stays in sync with gear.weapon.base)
// RoamParty gains: pack: Item[]; potions: number; nextItem: number
```

Rules:
- Rarity: `fine` = damage ×1.15 (weapon) / reduce +0.05 (armour); `rare` = fine + one affix. Affixes (from whichever item carries them): keen 날카로운 dmg ×1.15; quick 재빠른 attack time ×0.88; sturdy 튼튼한 max hp +15; focused 집중의 skill cooldown ×0.85; vital 생명의 healing received ×1.25.
- Armours: cloth 천옷 (reduce 0, magic classes' cooldown ×0.9), leather 가죽 갑옷 (reduce 0.1), plate 판금 갑옷 (reduce 0.25, move ×1.15, attack ×1.1, magic classes' cooldown ×1.25). Armour reduction in `damage()` for hero targets, after the weapon guard: `amount = Math.max(1, Math.round(amount * (1 - reduce)))`.
- Trinkets (two slots, never the same twice on one clone): thorns 가시 (a melee attacker takes 3); vampire 흡혈 (heal 15% of basic-attack damage dealt, min 1); swift 질풍 (attack time ×0.85); focus 집중 (cooldowns ×0.8); bulwark 철벽 (max hp +20); executioner 처형자 (×1.5 vs targets below 30% hp); ember 불씨 (basic hits 25%: target takes 3 more each second for 3 s — keep it simple: a `burnUntil`/`dotAt` pair on `Unit` ticked in `partyTick`’s loop or in `roamStep`); frostbite 동상 (basic hits 20%: target's next moment comes 1 s later); link_bait 미끼 (the wearer's taunt makes taunted foes exposed 5 s: hits on them ×1.5 from any clone); link_shatter 공명 파쇄 (the wearer's hits on a frozen foe ×2 and end the freeze); link_mark 사냥 표식 (the wearer's basic hits mark the target 4 s; other clones deal +30% to it); link_guard 수호 서약 (30% of the damage an adjacent ally takes goes to the wearer instead); link_echo 메아리 (when another clone within 3 casts a skill, the wearer's next basic attack ×2 — use `empower`, never lowering a higher one).
- `refitHp` adds `G.hp(u)` (sturdy, bulwark) to max HP.
- `implant(p, u, cls, ev)` gives `u.gear = starterGear(cls, …)` and sets `u.weapon`. The shell has `gear = { weapon: fists common, armor: null, trinkets: [null, null] }`.
- Pack, potions and `nextItem` travel with `takeParty`/`placeParty`. A new surface or dungeon party starts with `pack: []`, `potions: 2`.

- [ ] **Step 1: tests** `tests/unit/delveItems.test.ts`:

```ts
import { expect, it } from 'vitest';
import { createRng } from '../../src/core/rng';
import { damage, entOf, unitOf } from '../../src/sim/party/partyCore';
import { drink, equip, PACK_SIZE, unequip } from '../../src/sim/delve/gear';
import { itemName, rollItem, type Item } from '../../src/sim/delve/items';
import { delveTick, newDelve } from '../../src/sim/delve/delveSim';
import { clones } from '../../src/sim/roam/roam';

const archer = () => { const p = newDelve(2); entOf(p, 'hero')!.pos = { ...p.souls[0]!.pos }; delveTick(p, 0.1); return p; };
const give = (p: ReturnType<typeof newDelve>, it: Omit<Item, 'id'>) => { const full = { ...it, id: `t${p.pack.length}` } as Item; p.pack.push(full); return full.id; };

it('a clone that takes a soul gets its class\'s first weapon and armour; the party starts with two potions', () => {
  const p = archer();
  const u = clones(p)[0]!;
  expect(u.gear!.weapon.base).toBe('longbow');
  expect(u.gear!.armor!.base).toBe('cloth');
  expect(u.weapon).toBe('longbow');
  expect(p.potions).toBe(2);
});

it('names say rarity and affix', () => {
  expect(itemName({ id: 'a', kind: 'weapon', base: 'longbow', rarity: 'common' })).toBe('장궁');
  expect(itemName({ id: 'a', kind: 'weapon', base: 'longbow', rarity: 'fine' })).toBe('고급 장궁');
  expect(itemName({ id: 'a', kind: 'weapon', base: 'longbow', rarity: 'rare', affix: 'keen' })).toBe('날카로운 장궁');
});

it('deeper floors roll more rares', () => {
  const r = createRng(7);
  const rares = (floor: number) => Array.from({ length: 400 }, () => rollItem(r, floor)).filter((i) => i.kind !== 'trinket' && i.rarity === 'rare').length;
  expect(rares(10)).toBeGreaterThan(rares(1));
});

it('another line\'s weapon is refused; a fitting one swaps with the old into the pack', () => {
  const p = archer();
  expect(equip(p, 'hero', give(p, { kind: 'weapon', base: 'greataxe', rarity: 'common' }))).toBe(false);
  expect(equip(p, 'hero', give(p, { kind: 'weapon', base: 'crossbow', rarity: 'fine' }))).toBe(true);
  expect(unitOf(p, 'hero')!.weapon).toBe('crossbow');
  expect(p.pack.some((i) => i.kind === 'weapon' && i.base === 'longbow')).toBe(true);
});

it('plate takes a quarter off a blow', () => {
  const p = archer();
  equip(p, 'hero', give(p, { kind: 'armor', base: 'plate', rarity: 'common' }));
  const e = entOf(p, 'hero')!, hp = e.hp;
  damage(p, p.time, 'x', unitOf(p, 'hero')!, 8, []);
  expect(hp - e.hp).toBe(6);
});

it('the bulwark trinket raises max hp; taking it off clamps hp; a full pack refuses the unequip', () => {
  const p = archer();
  const e = entOf(p, 'hero')!;
  equip(p, 'hero', give(p, { kind: 'trinket', base: 'bulwark' }), 0);
  expect(e.maxHp).toBe(60);
  e.hp = 58;
  expect(unequip(p, 'hero', 0)).toBe(true);
  expect(e.maxHp).toBe(40);
  expect(e.hp).toBe(40);
  equip(p, 'hero', p.pack.find((i) => i.kind === 'trinket')!.id, 0);
  while (p.pack.length < PACK_SIZE) give(p, { kind: 'trinket', base: 'swift' });
  expect(unequip(p, 'hero', 0)).toBe(false);
});

it('a potion heals 40% and is used up', () => {
  const p = archer();
  const e = entOf(p, 'hero')!; e.hp = 10;
  drink(p, 'hero');
  expect(e.hp).toBe(26);
  expect(p.potions).toBe(1);
  p.potions = 0;
  expect(drink(p, 'hero')).toEqual([]);
});
```

- [ ] **Step 2:** run → FAIL; implement; hook `G.*` and the engravings into `stats`, `damage`, `strike`, `useSkill` (cooldown `× G.cd(u)`), heal (`× G.healTaken(target)`), and `refitHp`.
- [ ] **Step 3:** verification commands; commit `feat(delve): items, equipment, trinket engravings, potions`.

---

### Task 2: Wider floors with special rooms

**Files:** create `src/sim/delve/delveGen.ts`, `tests/unit/delveGen.test.ts`; modify `src/sim/delve/delveSim.ts` (use it).

**Interfaces (produce):**
```ts
export type RoomKind = 'start' | 'normal' | 'stairs' | 'vault' | 'shrine' | 'crypt' | 'ore' | 'den' | 'boss';
export interface DelveRoom { rect: Room; kind: RoomKind }
export interface ChestSpot { pos: Cell; tier: 1 | 2 | 3 }
export interface DelveFloor {
  map: GridMap;                 // 64×64; tiles 'floor' | 'wall' | 'door' | 'pillar'; rooms; start; stairs (in the stairs or boss room); spawns (group = room index); traps
  rooms: DelveRoom[]; chests: ChestSpot[]; ore: Cell[]; shrine?: Cell; crypt?: Cell;  // crypt = the hero soul's cell
  boss: boolean;
}
export const DELVE_SIZE = 64;
export function generateFloor(seed: number, floor: number): DelveFloor;
```

Rules:
- Rooms: 16–22 rooms of 5–11 cells a side, at least 2 apart, joined by L-corridors in a spanning order plus 2–3 extra links (loops); doors where a corridor meets a room wall (same rule as `src/sim/grid/mapgen.ts`'s `addDoors`). Pillars: 1–2 in rooms of 7×7 or more.
- Roles: room 0 = `start` (nearest the map's centre-left). Deepest room by walking distance from the start = `stairs` (or `boss` on floors 5, 10, 15). Of the rest: 1 `vault`, 1–2 `ore`, 1 `den`, a `shrine` with chance 0.5, a `crypt` with chance 0.4 on floors ≥ 2; the rest `normal`.
- Spawns (sleeping bands, `group` = room index): `normal` 1–3 foes (+1 from floor 4); `den` 4–5 with two elites; `crypt` 2 guards with one elite; `vault` 2 foes; `boss` = one `champion` (the general) + 2 `brute` guards; `start`, `shrine`, `ore` none. Kinds by floor: floors 1–2 `minion` 65% / `archer` 35%; floors 3+ add `brute` 15%, `ghoul` 15%, `mage` (shaman) 10% (rest minion/archer).
- Chests: `vault` one tier 3; `den` one tier 2; `normal` rooms chance 0.25 a tier 1.
- Ore: in each `ore` room 3–5 cells turned to `pillar` tiles along the walls (listed in `ore`).
- Shrine: one cell in the `shrine` room's centre (stays `floor`; it is used by standing next to it).
- Crypt: the hero soul's cell in the `crypt` room's centre.
- Traps: pick 1–2 corridors of length ≥ 6; put 2–4 `spike` traps (and 1 `alarm` from floor 3) on their cells, `found: false`.
- Deterministic from `(seed, floor)` with separate `createRng` streams for layout, spawns, loot spots and traps.
- `delveSim.ts`: `newDelve` and `descend` use `generateFloor`; `s.chests` from `chests`; `s.traps` from `map.traps`; keep `placeSouls` but place the floor's ordinary souls in `normal` rooms (the first floor's first soul — an archer — in the start room only when the party arrives without any classed clone).

- [ ] **Step 1: tests** `tests/unit/delveGen.test.ts`:

```ts
import { expect, it } from 'vitest';
import { distanceMap } from '../../src/sim/grid/path';
import { idx } from '../../src/sim/grid/types';
import { DELVE_SIZE, generateFloor } from '../../src/sim/delve/delveGen';

it('a floor is 64 wide with 16–22 rooms, all reachable, with one vault, a den and ore', () => {
  for (const seed of [1, 2, 3, 4, 5]) {
    const f = generateFloor(seed, 3);
    expect(f.map.w).toBe(DELVE_SIZE);
    expect(f.rooms.length).toBeGreaterThanOrEqual(16);
    expect(f.rooms.length).toBeLessThanOrEqual(22);
    const d = distanceMap(f.map, f.map.start);
    for (const r of f.rooms) expect(d[idx(f.map, { x: r.rect.x + (r.rect.w >> 1), y: r.rect.y + (r.rect.h >> 1) })]).toBeGreaterThanOrEqual(0);
    expect(f.rooms.filter((r) => r.kind === 'vault')).toHaveLength(1);
    expect(f.rooms.filter((r) => r.kind === 'den')).toHaveLength(1);
    expect(f.ore.length).toBeGreaterThanOrEqual(3);
    expect(f.chests.some((c) => c.tier === 3)).toBe(true);
  }
});

it('the same seed and floor build the same floor', () => {
  expect(generateFloor(9, 4)).toEqual(generateFloor(9, 4));
});

it('every fifth floor ends in the general\'s hall', () => {
  const f = generateFloor(2, 5);
  expect(f.boss).toBe(true);
  expect(f.rooms.some((r) => r.kind === 'boss')).toBe(true);
  expect(f.map.spawns.some((s) => s.kind === 'champion')).toBe(true);
  expect(generateFloor(2, 4).boss).toBe(false);
});

it('traps lie hidden in corridors', () => {
  const f = generateFloor(3, 2);
  expect(f.map.traps!.length).toBeGreaterThanOrEqual(2);
  expect(f.map.traps!.every((t) => !t.found)).toBe(true);
});
```

- [ ] **Step 2:** run → FAIL; implement; update `newDelve`/`descend`; keep `tests/unit/delve.test.ts` green (adjust only numbers that depended on the old 48×48 map — e.g. pick doors/souls from the new floor the same way).
- [ ] **Step 3:** verification; commit `feat(delve): wider floors with special rooms`.

---

### Task 3: Room rules — chests, ore, shrine, crypt, traps, floor items, dropped gear, boss gate

**Files:** create `src/sim/delve/delveRooms.ts`, `src/sim/delve/heroSouls.ts`, `tests/unit/delveRooms.test.ts`; modify `src/sim/delve/delveSim.ts`, `src/sim/roam/roam.ts`, `src/sim/roam/carry.ts`.

**Interfaces (produce):**
```ts
// DelveParty gains: rooms: DelveRoom[]; chests: (ChestSpot & { opened: boolean })[]; ore: { pos: Cell; left: number; progress: number }[];
//   shrine?: { pos: Cell; used: boolean }; floorItems: { pos: Cell; item: Item }[]; boss: boolean
// RoamParty gains: ore: number; crystal: number   (carried with takeParty/placeParty)
export function roomStep(p: DelveParty, before: Map<string, Cell>, ev: GEvent[]): void;  // run by delveTick after roamStep
export type HeroSoulId = 'aren' | 'seraphine' | 'kael' | 'mira' | 'dorn';
export const HERO_SOULS: Record<HeroSoulId, { name: string; cls: BaseClass; level: number; traits: Partial<Record<TraitId, number>> }>;
// Soul gains: hero?: HeroSoulId;   Unit gains: name?: string
```

Rules (all only while **not in combat**, except traps and floor items which work any time):
- **Chests:** a living clone within 1 of a closed chest opens it if the pack has room: `open` event (`to` = chest cell), then loot by tier: tier 1 — 60% materials (ore 3–6, or bio 4–8) / 40% one item (rarity ≥ common); tier 2 — one item (≥ fine) + ore 2–4; tier 3 — two items (one ≥ rare) + crystal 1–2. Each item: `loot` event `{ text: itemName, src: clone }`; materials: `loot` `{ text: 'ore' | 'crystal' | 'bio', amount }`. Mark `s.chests[i].opened` too (the view reads it).
- **Elites and the general drop loot when they fall:** elite 60% one item (≥ fine) as a floor item at its cell; the general 2 items (≥ rare) + crystal 3.
- **Ore:** a living clone standing next to an ore cell with `left > 0` and no order adds its seconds to `progress`; every 2 s of progress gives 1 ore (`loot` `{ text: 'ore', amount: 1 }`), `left--`; when `left` reaches 0 the cell turns back to `floor`. Each node starts with `left` 3–5.
- **Shrine:** a living clone within 1 of an unused shrine uses it: every living clone heals to full, `heal` events, `used = true`, `buff` `{ text: 'shrine' }`.
- **Crypt:** its soul is a `Soul` with `hero` set; implanting it (`roam.implant`) uses the hero's class, sets `u.name`, `u.level`, `u.traits` (and `refitHp`), XP to that level's threshold. Five heroes:
  - aren 아렌 (warrior, level 4, tough 1, shieldPro 1)
  - seraphine 세라핀 (cleric, level 4, blessing 2)
  - kael 카엘 (archer, level 4, rapid 1, eagle 1)
  - mira 미라 (mage, level 4, amplify 1, resonance 1)
  - dorn 도른 (rogue, level 4, vital 1, sprint 1)
  Which hero lies in a crypt: deterministic from the floor seed; a hero already in the party or already found this expedition is not placed again (keep a `foundHeroes: HeroSoulId[]` on `RoamParty`, carried).
- **Traps:** a clone (or foe) entering a hidden or found trap cell triggers it: `spike` deals `6 + floor` damage (through `damage()`), `alarm` wakes every sleeping band within 10; `trap` event `{ text: kind, to }`, trap becomes `found`. A rogue-line clone spots hidden traps within 3 (`trapFound` event) before stepping on them; spotted traps are walked around by `stepToward` (treat found traps as blocked for heroes when another path exists).
- **Dropped gear:** when a clone falls, its weapon (unless fists), armour and trinkets (as `Item`s) become floor items on its cell, then the clone's gear is cleared. `drop` event `{ text: 'gear', to }`.
- **Floor items:** a living clone stepping onto a floor item's cell takes it if the pack has room (`pickup` event `{ text: itemName }`). Floor items are **not** carried by `takeParty`: leaving the floor (stairs or lift) loses them.
- **Boss gate:** on a boss floor `canDescend` is false while the general lives; when it falls: `victory` event.

- [ ] **Step 1: tests** `tests/unit/delveRooms.test.ts`:

```ts
import { expect, it } from 'vitest';
import { damage, entOf, unitOf } from '../../src/sim/party/partyCore';
import { canDescend, delveTick, descend, newDelve, type DelveParty } from '../../src/sim/delve/delveSim';
import { takeParty } from '../../src/sim/roam/carry';
import { clones } from '../../src/sim/roam/roam';
import { PACK_SIZE } from '../../src/sim/delve/gear';

const calm = (p: DelveParty) => { for (const u of p.units) if (u.side === 'foe') entOf(p, u.id)!.alive = false; delveTick(p, 0.1); };
const archer = (seed = 2, floor = 1) => { const p = newDelve(seed, floor); entOf(p, 'hero')!.pos = { ...p.souls[0]!.pos }; delveTick(p, 0.1); return p; };
const beside = (p: DelveParty, c: { x: number; y: number }) => {
  for (const d of [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [-1, -1], [1, -1], [-1, 1]]) {
    const n = { x: c.x + d[0]!, y: c.y + d[1]! };
    if (p.s.map.tiles[n.y * p.s.map.w + n.x] === 'floor') return n;
  }
  throw new Error('no free cell');
};

it('a clone beside a closed chest out of combat opens it and the loot goes to the pack or the stores', () => {
  const p = archer(); calm(p);
  const c = p.chests.find((x) => x.tier === 3)!;
  entOf(p, 'hero')!.pos = beside(p, c.pos);
  const ev = delveTick(p, 0.1);
  expect(c.opened).toBe(true);
  expect(ev.some((e) => e.type === 'open')).toBe(true);
  expect(p.pack.length).toBeGreaterThanOrEqual(2);
  expect(p.crystal).toBeGreaterThan(0);
});

it('a full pack leaves a chest shut', () => {
  const p = archer(); calm(p);
  while (p.pack.length < PACK_SIZE) p.pack.push({ id: `x${p.pack.length}`, kind: 'trinket', base: 'swift' });
  const c = p.chests[0]!;
  entOf(p, 'hero')!.pos = beside(p, c.pos);
  delveTick(p, 0.1);
  expect(c.opened).toBe(false);
});

it('standing by ore mines it, one ore every two seconds', () => {
  const p = archer(); calm(p);
  const o = p.ore[0]!;
  entOf(p, 'hero')!.pos = beside(p, o.pos);
  const before = o.left;
  for (let i = 0; i < 45; i++) delveTick(p, 0.1);
  expect(o.left).toBe(before - 2);
  expect(p.ore.length).toBeGreaterThan(0);
});

it('the shrine heals everyone once', () => {
  let p = archer(1, 1);
  for (let s = 1; s < 30 && !p.shrine; s++) p = archer(s, 1);
  calm(p);
  entOf(p, 'hero')!.hp = 5;
  entOf(p, 'hero')!.pos = beside(p, p.shrine!.pos);
  delveTick(p, 0.1);
  expect(entOf(p, 'hero')!.hp).toBe(entOf(p, 'hero')!.maxHp);
  expect(p.shrine!.used).toBe(true);
});

it('a fallen clone\'s gear lies where it fell; a living clone can pick it up; leaving the floor loses what is left', () => {
  const p = archer(); calm(p);
  p.bio = 100; p.printHere = true;
  entOf(p, 'hero')!.pos = { ...p.souls[1]!.pos }; delveTick(p, 0.1);
  entOf(p, 'hero')!.pos = { ...p.s.map.start }; for (let i = 0; i < 10; i++) delveTick(p, 0.1);
  const two = clones(p)[1]!;
  const at = { ...entOf(p, two.id)!.pos };
  damage(p, p.time, 'x', two, 999, []);
  delveTick(p, 0.1);
  expect(p.floorItems.length).toBeGreaterThanOrEqual(1);
  entOf(p, 'hero')!.pos = at;
  delveTick(p, 0.1);
  expect(p.pack.length).toBeGreaterThanOrEqual(1);
  p.floorItems.push({ pos: { x: 1, y: 1 }, item: { id: 'z', kind: 'trinket', base: 'thorns' } });
  expect(JSON.stringify(takeParty(p))).not.toContain('"z"');
});

it('a spike trap hurts whoever steps on it and is found', () => {
  const p = archer(); calm(p);
  const t = p.s.traps[0]!;
  const e = entOf(p, 'hero')!, hp = e.hp;
  e.pos = { ...t.pos };
  delveTick(p, 0.1);
  expect(e.hp).toBeLessThan(hp);
  expect(t.found).toBe(true);
});

it('on a boss floor the stairs stay shut until the general falls', () => {
  const p = archer(2, 5);
  for (const u of p.units) if (u.side === 'foe' && u.foe !== 'warlord') entOf(p, u.id)!.alive = false;
  delveTick(p, 0.1);
  for (const u of clones(p)) entOf(p, u.id)!.pos = { ...p.s.map.stairs! };
  delveTick(p, 0.1);
  expect(canDescend(p)).toBe(false);
  const boss = p.units.find((u) => u.foe === 'warlord')!;
  damage(p, p.time, 'hero', boss, 99999, []);
  delveTick(p, 0.1);
  expect(canDescend(p)).toBe(true);
  expect(descend(p)).toBe(true);
  expect(unitOf(p, 'hero')).toBeDefined();
});
```

- [ ] **Step 2:** run → FAIL; implement; in `delveTick` remember each clone's cell before `tick` (for trap entry) and call `roomStep` after `roamStep`.
- [ ] **Step 3:** verification; commit `feat(delve): chests, ore, shrine, hero crypts, traps, dropped gear, boss gate`.

---

### Task 4: Foes — ghoul, shaman, the general

**Files:** create `src/sim/party/partyFoeAi.ts`, `tests/unit/delveFoes.test.ts`; modify `src/sim/party/partyDefs.ts` (`FOES`, `FoeId`), `src/sim/party/partySim.ts` (`turn` asks `foeTurn` first), `src/sim/delve/delveSim.ts` (`FOE_OF`: `ghoul → ghoul`, `mage → shaman`, `champion → warlord`), `src/sim/roam/roam.ts` (bio/xp per kind).

Numbers (party `FOES`; hp and damage scale by floor `× (1 + 0.15 × (floor − 1))`, elites ×1.8 hp):

| id | name | hp | dmg | range | atk | move | bio | xp |
|---|---|---|---|---|---|---|---|---|
| ghoul | 구울 | 18 | 2–4 | 1 | 0.7 | 0.55 | 3 | 4 |
| shaman | 주술사 | 20 | 4–6 | 5 | 1.5 | 1.0 | 4 | 6 |
| warlord | 마왕군 장군 | 260 | 10–14 | 1 | 1.5 | 1.0 | 30 | 60 |

- **Shaman:** at most every 6 s, if an awake foe within 5 is below 70% hp, heal the most hurt one by 12 instead of attacking (`heal` event).
- **General:** every 9 s, with a clone within 2: `telegraph` `{ src, to: its cell, amount: 2, text: 'slam' }`, winds up 1.5 s; on its next moment every clone within 2 takes 18–24 (× floor scale) and a `react` `{ text: 'shatter', to }`. The first time it drops below half health it calls 3 goblins (awake, same group) on free cells within 3 (`summon` events).
- Ghouls are simply fast.

- [ ] **Step 1: tests** `tests/unit/delveFoes.test.ts`:

```ts
import { expect, it } from 'vitest';
import type { GEvent } from '../../src/sim/grid/types';
import { damage, entOf } from '../../src/sim/party/partyCore';
import { delveTick, newDelve } from '../../src/sim/delve/delveSim';

it('a shaman mends a hurt band-mate instead of attacking, then waits', () => {
  for (let seed = 1; seed < 40; seed++) {
    const p = newDelve(seed, 4);
    const sh = p.units.find((u) => u.foe === 'shaman');
    if (!sh) continue;
    const mate = p.units.find((u) => u.side === 'foe' && u.group === sh.group && u !== sh);
    if (!mate) continue;
    for (const u of p.units) if (u.group === sh.group) u.asleep = false;
    entOf(p, mate.id)!.hp = 3;
    const ev: GEvent[] = [];
    for (let i = 0; i < 30; i++) ev.push(...delveTick(p, 0.1));
    expect(ev.filter((e) => e.type === 'heal' && e.src === sh.id).length).toBeGreaterThanOrEqual(1);
    return;
  }
  throw new Error('no shaman with a band-mate found');
});

it('the general telegraphs its slam, and calls goblins once at half health', () => {
  const p = newDelve(2, 5);
  entOf(p, 'hero')!.pos = { ...p.souls[0]!.pos }; delveTick(p, 0.1);
  const w = p.units.find((u) => u.foe === 'warlord')!;
  for (const u of p.units) if (u.group === w.group) u.asleep = false;
  const we = entOf(p, w.id)!;
  entOf(p, 'hero')!.pos = { x: we.pos.x + 1, y: we.pos.y };
  const ev: GEvent[] = [];
  for (let i = 0; i < 40; i++) ev.push(...delveTick(p, 0.1));
  expect(ev.some((e) => e.type === 'telegraph' && e.src === w.id)).toBe(true);
  damage(p, p.time, 'x', w, Math.ceil(we.hp - we.maxHp * 0.45), []);
  const more: GEvent[] = [];
  for (let i = 0; i < 30; i++) more.push(...delveTick(p, 0.1));
  expect(more.filter((e) => e.type === 'summon' && e.src === w.id)).toHaveLength(3);
});
```

- [ ] **Step 2:** run → FAIL; implement.
- [ ] **Step 3:** verification; commit `feat(delve): ghouls, shamans and the demon general`.

---

### Task 5: Headless delve bot and balance report

**Files:** create `tests/bot/delveBot.bot.ts`, `docs/superpowers/plans/2026-10-06-delve-loot-results.md`; numbers only may change in `partyDefs.ts`, `delveGen.ts`, `delveRooms.ts`, `items.ts`.

Bot: start a dungeon party with three classed clones (implant three base classes directly — e.g. warrior, archer, cleric — and give the bio for them), run floors 1→5 in real-time mode (`p.manual` unset) with a simple policy every 0.5 game seconds: out of combat walk the leader (`orderTo`) to the nearest unopened chest, unmined ore, unused shrine, untaken soul or floor item, else the nearest unseen walkable frontier cell, else the stairs; take the stairs when `canDescend`; drink a potion when a clone is below 30%; equip any pack item that `canEquip` and has higher rarity than what is worn. Stop at a wipe, after floor 5, or after 3600 game seconds.

Report (run with `npx vitest run -c tests/bot/vitest.bot.config.ts tests/bot/delveBot.bot.ts --silent=false`), 20 seeds × 3 compositions (warrior/archer/cleric, warrior/mage/rogue, archer/cleric/mage): floor reached (avg, % reaching 5, % killing the general), clones lost, items found per floor by rarity, ore/crystal/bio per floor, time per floor. Targets to tune toward: auto play reaches floor 3 in ≥ 60% of runs, beats the general in 10–30%; ~2–3 items and 8–15 ore per floor on floors 1–3. Write the table, every number changed (old → new) and anything odd into the results doc. The bot file asserts only that every run ends without throwing.

- [ ] **Step 1:** bot + report; **Step 2:** tune and rerun (keep unit tests green); **Step 3:** results doc; full suite; commit `feat(delve): delve bot and first loot balance`.

---

## Out of scope (Claude does these afterwards)

- Pip-Boy equipment tab (wear/swap/compare), item icons, chest/ore/shrine/crypt/trap/floor-item visuals, loot toasts, boss telegraph cells on the floor, the hero soul's name on frames.
- Stage 2: base building around the pod (facilities as buildings, defences as tiles), drill depth, raids every 2nd trip.
