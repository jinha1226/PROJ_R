# 발동형 빌드 (특성 · 궁극기 · 아크라식 장비 · 소모품) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace class active skills with a trigger engine: every class has two innate triggers and one ultimate; level-up traits, gear and consumables all speak the same trigger language with tags; gear becomes Achra-style named items in three slots with weapon proficiency and sacrifice; promotions are decided by build composition.

**Architecture:** Deterministic simulation under `src/sim/party/` and `src/sim/delve/`. One trigger bus (`emit(p, cond, ctx)`) is fired from the combat code; sources (class innates, traits, gear, statuses) subscribe through data. The screens are NOT part of this plan — Claude rebuilds the frames, the Pip-Boy tabs and the pop-ups afterwards; here only keep the UI compiling with the smallest edits (see Global Constraints).

**Tech Stack:** TypeScript (strict), Vitest, ESLint, Node 22.

**Spec (binding, read it whole):** `docs/superpowers/specs/2026-10-06-trigger-traits-design.md` — sections 1–9 hold every number and name: the trigger conditions/effects (2), statuses and reactions (3), tags (4), class innates, ultimates, advanced classes and **build-composition promotions + 베테랑** (5), the 80 traits and offer rules (6), Achra-style gear: 3 slots, 8 weapon families, proficiency, weight, sacrifice, example items (7), consumables (8), what changes (9).

## Global Constraints

- Source files ≤ 400 lines (`npm run lint` checks). Split rather than compress.
- `src/sim/**` never imports `src/view/**` or `src/ui/**`.
- Deterministic: randomness only through `p.s.rng` or `createRng` streams from the floor seed.
- The main grid game (`src/sim/grid/**`) unchanged; you may read its old engraving engine (`engraveCore.ts`, `engraveDefs.ts`) and element reactions (`reactions.ts`) for ideas but do not import them.
- Korean, short names for everything player-facing; no explanatory sentences in data.
- UI: only the edits needed to compile and stay playable — `src/ui/overworld/partyFrames.ts`, `pipWindow.ts`, `traitPicker.ts`, `classIcons.ts`, `src/ui/delve/delveDemo.ts`, `src/ui/overworld/worldDemo.ts`, `src/ui/party/*`. Q and W become one key **R** for the ultimate (the frames show one ultimate tile where the two skill tiles were). Leave layout and styling alone.
- Keep the demos and the title flow working (`?demo=delve`, `?demo=world`, `?demo=party`, title → pod → shaft).
- Commit after each task on the current branch: `feat(build): …` + blank line + `Co-Authored-By: Codex <noreply@openai.com>`. Do NOT push.
- Verify every task: `npx tsc --noEmit -p .`, `npm run lint`, `npx vitest run tests/unit`. Before the final commit: `npx vitest run` (if one unrelated UI test times out under load, rerun it alone and say so).

## Review Focus

1. Trigger loops: a trigger whose effect fires the same condition (e.g. "on hit → extra attack") must stop at the chain cap (5 per action) and never throw or hang.
2. A clone dying inside a chain (thorns, reactions, burn ticks): no effect runs from a dead source; no `hit` after `die` for the same unit at the same time.
3. Off-proficiency weapons: innates switch off and on as the weapon changes; promotions recount tags when gear changes (equipping a shield can satisfy 수호기사; unequipping can make the condition false again before promotion).
4. Sacrifice: the sacrificed item leaves the pack; the same-slot item gains exactly 25% of the sacrificed item's numbers; nothing changes if the slot is empty or kinds differ.
5. Save/carry: traits, ultimate cooldowns, gear (with sacrifice power), consumables and promotion state survive `takeParty`/`placeParty` (shaft round trips).

Each line gets a test in its task.

---

## Code you are building on (read first)

- `src/sim/party/partyCore.ts` — `Unit`, `Party`, `ENGAGE`, `entOf`, `stats`, `canHit`, `targetOf`, `stepToward`, `behindCover`, `passiveMult`, `damage`, `strike`. Combat events: `bump`, `shoot`, `hit`, `miss` (`text: 'block'` on a block), `die`.
- `src/sim/party/partySim.ts` — `tick`, `moment`, `turn`, `command` (`move` | `attack` | `skill` | `wait`), `promote`.
- `src/sim/party/partySkills.ts` (12 skills, `useSkill`, `queueSkill`) and `partyAuto.ts` (`autoSkill`) — to be replaced by ultimates.
- `src/sim/party/partyDefs.ts` — `WEAPONS`, `CLASSES` (`shell`, 5 base, `berserker`, `sniper`), `SKILLS`, `FOES`, `PROMOTIONS` (counter-based — to be replaced).
- `src/sim/party/partyTraits.ts` (18 stat traits, `T.*`) and `partyLevel.ts` (`LEVEL_XP`, `gainXp`, `rollOffer`, `pickTrait`, `refitHp`) — traits are rewritten; levels stay.
- `src/sim/party/partyEngrave.ts` — current trinket engravings (bait, shatter, mark, guard, echo, ember burns).
- `src/sim/delve/items.ts`, `gear.ts` — random-rarity items, `Loadout { weapon, armor, trinkets }`, `G.*`, `PACK_SIZE`, `equip`, `unequip`, `drink`; `delveRooms.ts` rolls loot with `rollItem`; dropped gear and floor items.
- `src/sim/roam/roam.ts`, `carry.ts` — implant gives starter gear; `Carry` moves pack/gear/potions across the shaft.

---

## File Structure

| File | Responsibility |
|---|---|
| `src/sim/party/triggers.ts` (create) | the bus: conditions, effects, per-source cooldowns, chain cap, `emit` |
| `src/sim/party/status.ts` (create) | statuses (burn, chill, freeze, poison stacks, shock, bleed, stun, mark, exposed), ticking, reactions |
| `src/sim/party/classKit.ts` (create) | innates and ultimates for the 5 base + 10 advanced classes + 베테랑; promotion conditions by build |
| `src/sim/party/ultimate.ts` (create) | `useUltimate`, targeting, cooldown, AI choice (replaces `partySkills.ts`, `partyAuto.ts`) |
| `src/sim/party/traitDefs.ts`, `traitPool.ts` (create; replace `partyTraits.ts`) | the 80 traits as data (tags, ranks, trigger or passive), offers |
| `src/sim/delve/catalog.ts` (create; replaces `items.ts` data) | 36 named items: 8 weapon families + shield, 8 armours, 10 accessories |
| `src/sim/delve/gear.ts` (rewrite) | `Loadout { weapon, armor, accessory }`, proficiency, weight, two-hand/shield bonus, sacrifice, consumables |
| `src/sim/party/partyCore.ts`, `partySim.ts`, `partyLevel.ts`, `partyDefs.ts`, `src/sim/roam/*.ts`, `src/sim/delve/delveRooms.ts` (modify) | emit triggers, use the new kit/gear/traits |
| tests: `tests/unit/triggers.test.ts`, `status.test.ts`, `classKit.test.ts`, `traits.test.ts`, `catalog.test.ts`, `consumables.test.ts` (create) | per task |

---

### Task 1: Trigger bus and statuses

**Interfaces (produce):**
```ts
// triggers.ts
export type Cond = 'hit' | 'crit' | 'kill' | 'struck' | 'block' | 'dodge' | 'crisis' | 'nth' | 'still' | 'moved'
  | 'allyHit' | 'allyCrisis' | 'combatStart' | 'statusApplied' | 'ultimate';
export interface Ctx { t: number; src: Unit; target?: Unit; amount?: number; status?: StatusId; depth: number; ev: GEvent[] }
export interface TriggerDef { id: string; when: Cond; cd?: number; chance?: number; nth?: number; test?: (p: Party, c: Ctx) => boolean; run: (p: Party, c: Ctx) => void }
export const CHAIN_CAP = 5;
export function sourcesOf(p: Party, u: Unit): TriggerDef[];          // class innates (if proficient) + traits + gear + keystone
export function emit(p: Party, cond: Cond, c: Omit<Ctx, 'depth'> & { depth?: number }): void;  // runs every matching source of c.src (and allyX of nearby clones), respecting cd, chance, nth, chain cap
// status.ts
export type StatusId = 'burn' | 'chill' | 'freeze' | 'poison' | 'shock' | 'bleed' | 'stun' | 'mark' | 'exposed';
export function applyStatus(p: Party, src: Unit, target: Unit, id: StatusId, t: number, ev: GEvent[], stacks?: number): void;
export function tickStatuses(p: Party, from: number, to: number, ev: GEvent[]): void;   // burn 3/s, poison 2×stacks/s, bleed 4 per step moved
export function statusMult(p: Party, attacker: Unit, target: Unit, heavy: boolean, t: number, ev: GEvent[]): number; // freeze+heavy shatter ×2, mark ×1.3 (others), exposed ×1.5
// Unit gains: status: Partial<Record<StatusId, { until: number; stacks?: number; by?: string }>>; trig: Record<string, number> (cooldown readiness); nth: number; still: number; crisisUsed: boolean
```
Rules: exactly spec §2–§3. Emit points in `partyCore`: after a landed hit (`hit`, plus `crit` when the roll crits — add a base crit chance 5% ×1.5 to `strike`), on a kill (`kill` from the killer), when a clone is hit (`struck`), on a block/dodge (`block`/`dodge`), first drop below 50% hp per fight (`crisis`, reset when `p.combat` turns false), every attack counts `nth`, attacking without having moved since its last moment (`still`), stepping (`moved`), a clone within 2 landing a hit (`allyHit`), a clone dropping below 50% (`allyCrisis`), the fight starting (`combatStart` from `roamStep` when `p.combat` turns true), a status landing (`statusApplied`), an ultimate (`ultimate`). Reactions per spec §3 (독연 폭발, 파쇄, 혈전). `tickStatuses` runs in `tick` before units act. Keep the existing `T.*`/`G.*` numbers working until Tasks 3–4 replace them.

- [ ] **Tests** `tests/unit/triggers.test.ts` and `status.test.ts` — write at least:
  - a test source "on hit → extra hit" stops after `CHAIN_CAP` follow-ups and does not throw;
  - cooldown: a `cd: 6` trigger fires once in 5 s of repeated hits, twice in 13 s;
  - `crisis` fires once per fight and again after the fight ends and a new one starts;
  - burn ticks 3 per whole second for 3 s; poison 2×stacks; bleed only when the target steps;
  - freeze + a heavy hit (two-hand or crossbow) doubles damage and ends the freeze; burn + poison on the same foe triggers 독연 폭발 (neighbours get poison 2);
  - a dead source runs nothing (kill the source inside a thorns chain; assert no later `hit` from it).
- [ ] implement; verification; commit `feat(build): trigger bus and statuses`.

### Task 2: Class innates, ultimates, promotions by build

**Interfaces (produce):**
```ts
// classKit.ts
export type UltId = 'warcry' | 'arrowRain' | 'meteor' | 'sanctum' | 'shadowDance'
  | 'bloodFrenzy' | 'bastion' | 'pierceShot' | 'bleedRain' | 'elementStorm' | 'deadHost' | 'judgement' | 'longSanctum' | 'deathDance' | 'toxicFog';
export interface Kit { innate: TriggerDef[]; ultimate: UltId; ultCd: number; proficient: WeaponFamily[] }
export const KITS: Record<ClassId, Kit>;          // shell: no innate, no ultimate; 5 base; 10 advanced; 'veteran'
export interface PromotionRule { to: ClassId; need: Partial<Record<Tag, number>>; wear?: WeaponFamily | 'shield'; anyElements?: number }
export const PROMOTIONS: Record<BaseClass, PromotionRule[]>;   // spec §5 table; plus 베테랑 at level 10 if none met
export function tagsOf(u: Unit): Partial<Record<Tag, number>>; // from traits (each rank counts 1) and worn gear
export function promotionOptions(p: Party, u: Unit): { to: ClassId; met: boolean; have: Partial<Record<Tag, number>> }[];
export function promote(p: Party, id: string, to: ClassId): GEvent[];
// ultimate.ts
export function useUltimate(p: Party, id: string, cell?: Cell): GEvent[];   // fails ([]) if on cooldown, dead, no valid target
export function aiUltimate(p: Party, u: Unit): Cell | undefined | null;      // companions: when to use (spec §5: e.g. 3+ foes, an ally in crisis)
// partySim.ts: Command gains { kind: 'ultimate'; cell?: Cell }; 'skill' is removed. Unit: ultReady: number.
```
Rules: spec §5 — innates and ultimates for all 15 classes (the 8 advanced classes not in `CLASSES` yet are added with their spec hp/move numbers), promotions by build composition only (tags from traits + worn gear, some need a worn family), conditions visible, 베테랑 for anyone reaching level 10 without meeting another. Innates are off while the worn weapon is not one of the kit's proficient families. Remove `SKILLS`, `partySkills.ts`, `partyAuto.ts`; companions use `aiUltimate`.

- [ ] **Tests** `tests/unit/classKit.test.ts`: each base class's two innates fire under their conditions (e.g. warrior with 2 adjacent foes whirls, not more than once per 6 s; cleric heals an ally that drops below 50%); an off-proficiency weapon switches innates off; each ultimate does its spec effect once and then waits its cooldown; `promotionOptions` turns `met` true exactly when the tags/wear match (equip a shield → 수호기사 met; unequip → not met); 베테랑 offered at level 10 when nothing else is met; an AI companion uses its ultimate when its condition holds.
- [ ] implement; minimal UI compile edits (R key, one ultimate tile); verification; commit `feat(build): class innates, ultimates, promotions by build`.

### Task 3: The 80 traits

**Interfaces (produce):**
```ts
// traitDefs.ts
export type Tag = '근접' | '원거리' | '화염' | '냉기' | '독' | '전기' | '출혈' | '방패' | '은신' | '치유' | '협공' | '소환' | '생존' | '치명';
export interface TraitDef { id: string; name: string; tags: Tag[]; pool: 'common' | BaseClass | AdvancedClass | 'keystone'; ranks: 1 | 3; passive?: (u: Unit, rank: number) => Partial<Mods>; trigger?: (rank: number) => TriggerDef; cost?: string }
export const TRAITS: Record<string, TraitDef>;   // spec §6: 24 common, 6 per base class, 2 per advanced class (design the 10 not spelled out in the spec in the same spirit), 6 keystones
// traitPool.ts
export function rollOffer(p: Party, u: Unit): string[];   // 2 from the class/advanced pool + 1 common, tag-weighted ×2; at levels 10 and 14 a 4th card: a keystone (one keystone per clone)
```
Rules: spec §6. `pickTrait`/`refitHp` in `partyLevel.ts` move to the new defs; levels, XP and the +4 hp per level stay. Remove `partyTraits.ts` once nothing reads `T.*`.

- [ ] **Tests** `tests/unit/traits.test.ts`: the pool sizes (24 / 30 / 20 / 6); offers come from the right pools (2 class + 1 common) and never include a maxed trait; a tag the clone holds makes its cards at least twice as likely over 2,000 offers (fixed seed); a keystone appears as a 4th card at levels 10 and 14 only, and only until one is taken; five traits checked end to end (e.g. 마무리: a kill makes the next attack +50%; 사기: a kill heals clones within 2; 끈기 holds a killing blow once per its cooldown; 결속 counts allies within 2; 연타 adds an attack every third).
- [ ] implement; verification; commit `feat(build): trigger traits and offers`.

### Task 4: Achra-style gear and consumables

**Interfaces (produce):**
```ts
// catalog.ts
export type WeaponFamily = 'sword' | 'great' | 'mace' | 'dagger' | 'bow' | 'crossbow' | 'staff' | 'relic';
export interface ItemDef { id: string; name: string; slot: 'weapon' | 'armor' | 'accessory'; family?: WeaponFamily; shield?: boolean; twoHand?: boolean;
  dmg?: [number, number]; range?: number; atk?: number; armor?: number; block?: number; weight: number; tags: Tag[]; triggers: TriggerDef[]; floors: [number, number] }
export const CATALOG: Record<string, ItemDef>;   // spec §7: 18 weapons (all 8 families + shield combos), 8 armours, 10 accessories; include the spec's example items and the old link engravings as accessories (미끼 부적, 사냥 표식 반지, …)
export type ConsumableId = 'potion' | 'fireBomb' | 'iceBomb' | 'poisonJar' | 'smoke' | 'cleanse' | 'rage' | 'boltWand';
export type Item = { id: string; def: string; power: number } | { id: string; consumable: ConsumableId; charges?: number };
// gear.ts
export interface Loadout { weapon: Item | null; armor: Item | null; accessory: Item | null }
export function proficient(u: Unit): boolean;
export function equip(p: RoamParty, heroId: string, itemId: string): boolean;     // swaps into the matching slot
export function sacrifice(p: RoamParty, heroId: string, itemId: string): GEvent[]; // spec §7.4: the same-slot item gains 25% of the sacrificed item's numbers (stored in power)
export function useItem(p: RoamParty, heroId: string, itemId: string, cell?: Cell): GEvent[]; // consumables, spec §8
// Command gains { kind: 'use'; itemId: string; cell?: Cell }
```
Rules: spec §7–§8. Proficiency: off-family −30% damage, +20% attack time, innates off. Weight: total over 6 → move and attack time ×(1 + 0.05 per point over). Two-hand / shield bonuses per item. Loot (`delveRooms.ts`): chests and drops pick catalog items whose `floors` include the floor (rarer/stronger deeper) and consumables (chest tier 1: 50% a consumable). Starter gear by class (spec family + a light armour; the shell has nothing). Dropped gear and floor items keep working. The companion AI drinks a potion below 30% (as now) and throws a bomb at 3+ clustered foes.

- [x] **Tests** `tests/unit/catalog.test.ts`, `consumables.test.ts`: catalog sizes (18 / 8 / 10) and every family present; any clone can equip any weapon; off-family applies exactly the spec penalties (−30% dmg, +20% atk) and turns innates off; weight slows; sacrifice gives exactly +25% of the numbers and removes the item (and does nothing across slots); a fire bomb burns everyone in its 3×3; a smoke bomb hides clones in its 3×3; the bolt wand loses a charge per use and is gone at 0; gear with power survives `takeParty`/`placeParty`.
- [x] implement; replace `items.ts` data and `partyEngrave.ts` with catalog triggers; verification; commit `feat(build): Achra-style gear, sacrifice, consumables`.

### Task 5: Bot rerun and report

Reuse `tests/bot/delveBot.bot.ts` (adapt to ultimates/consumables/new gear: the bot equips the higher-`floors` item of its proficient family, sacrifices duplicates, uses ultimates through `aiUltimate`, picks the first offered trait). Run 60 games as before and append a section to `docs/superpowers/plans/2026-10-06-delve-loot-results.md`: the same table plus the share of runs where a no-healer party (warrior/mage/rogue) survives floor 3. Tune numbers only (trait/item/foe numbers) toward: overall reach-5 50–65%, general 25–40%, warrior/mage/rogue reach-3 ≥ 50%. Record every change (old → new).

- [x] run; tune; report; full suite; commit `feat(build): bot rerun and first build balance`.

---

## Out of scope (Claude does these afterwards)

Frames with the ultimate tile and trigger pop-ups, Pip-Boy tabs (equipment with compare and sacrifice, traits with tags, the build-direction panel with promotion conditions), item icons, status icons, the trait picker's tag colours, the R-key/ultimate targeting UI.
