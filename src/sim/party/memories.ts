import type { Rng } from '../../core/rng';
import { applyStatus } from './status';
import { alive, entOf, occupied, posOf, type Party, type Unit } from './partyCore';
import { foesNear } from './cardFx';
import { addShield } from './shield';
import { DIRS, dist, tileAt, walkable, type GEvent } from '../grid/types';
import type { Tag } from './traitTypes';
import type { TriggerDef } from './triggers';

export type MemoryId = 'burnt' | 'shieldKeeper' | 'hunter' | 'traitor' | 'poisoner' | 'pilgrim' | 'scholar' | 'herald' | 'frostGrave' | 'lightning' | 'butcher' | 'warden';
export interface Memory { name: string; tag: Tag; text: string; trigger?: TriggerDef }

const meleeHit = (p: Party, c: { src: Unit; target?: Unit }) => !!c.target && dist(posOf(p, c.src), posOf(p, c.target)) <= 1;

/** Moves a clone into a free cell beside an ally (the warden's step); false when there is none. */
function besideAlly(p: Party, u: Unit, ally: Unit, t: number, ev: GEvent[]): boolean {
  const at = posOf(p, ally), spot = DIRS.map((d) => ({ x: at.x + d.x, y: at.y + d.y })).find((c) => walkable(tileAt(p.s.map, c)) && !occupied(p, c, u.id));
  if (!spot) return false;
  const move: GEvent = { t, type: 'teleport', src: u.id, from: { ...posOf(p, u) }, to: spot };
  ev.push(move); entOf(p, u.id)!.pos = spot; p.onMovement?.([move], ev);
  return true;
}

/** What a soul remembers of its life (spec §7): a starting rule for the body it goes into, and one tag toward resonance. */
export const MEMORIES: Record<MemoryId, Memory> = {
  burnt: { name: '불탄 자', tag: '화염', text: '처치한 적이 불붙어 곁에 화상',
    trigger: { id: '불탄 자', when: 'kill', test: (_p, c) => !!c.target, run: (p, c) => { for (const f of foesNear(p, entOf(p, c.target!.id)!.pos, 1)) if (f !== c.target) applyStatus(p, c.src, f, 'burn', c.t, c.ev); } } },
  // negated before the blow lands (traitCombat.negate), so even a killing first blow is stopped
  shieldKeeper: { name: '방패지기', tag: '방패', text: '전투마다 첫 피격 무효' },
  hunter: { name: '사냥꾼', tag: '원거리', text: '상처 없는 적에게 첫 공격 → 표식',
    trigger: { id: '사냥꾼', when: 'beforeHit', test: (p, c) => !!c.target && entOf(p, c.target.id)!.hp >= entOf(p, c.target.id)!.maxHp, run: (p, c) => applyStatus(p, c.src, c.target!, 'mark', c.t, c.ev) } },
  traitor: { name: '배신자', tag: '은신', text: '처치 → 1턴 은신',
    trigger: { id: '배신자', when: 'kill', run: (_p, c) => { c.src.hiddenUntil = Math.max(c.src.hiddenUntil, c.t + 1); } } },
  poisoner: { name: '독살자', tag: '독', text: '전투 첫 적중 → 중독 3중첩',
    trigger: { id: '독살자', when: 'hit', test: (p, c) => !c.src.poisonerUsed && !!c.target && alive(p, c.target), run: (p, c) => { c.src.poisonerUsed = true; applyStatus(p, c.src, c.target!, 'poison', c.t, c.ev, 3); } } },
  pilgrim: { name: '순례자', tag: '생존', text: '층을 내려갈 때 체력 전부 회복' },
  scholar: { name: '학자', tag: '치명', text: '레벨업 카드 한 장 더' },
  herald: { name: '전령', tag: '협공', text: '전투 시작 → 아군 전원 즉시 행동',
    trigger: { id: '전령', when: 'combatStart', run: (p, c) => { for (const a of p.units) if (a.side === 'hero' && alive(p, a)) a.nextAt = Math.min(a.nextAt, c.t); } } },
  frostGrave: { name: '서리 무덤', tag: '냉기', text: '피격 → 공격자 냉기',
    trigger: { id: '서리 무덤', when: 'struck', test: (p, c) => !!c.target && alive(p, c.target), run: (p, c) => applyStatus(p, c.src, c.target!, 'chill', c.t, c.ev) } },
  lightning: { name: '번개 맞은 자', tag: '전기', text: '치명 → 감전',
    trigger: { id: '번개 맞은 자', when: 'crit', test: (p, c) => !!c.target && alive(p, c.target), run: (p, c) => applyStatus(p, c.src, c.target!, 'shock', c.t, c.ev) } },
  butcher: { name: '백정', tag: '출혈', text: '근접 적중 30% → 출혈',
    trigger: { id: '백정', when: 'hit', chance: 0.3, test: (p, c) => meleeHit(p, c) && alive(p, c.target!), run: (p, c) => applyStatus(p, c.src, c.target!, 'bleed', c.t, c.ev) } },
  warden: { name: '수호자', tag: '치유', text: '아군이 위기 → 그 곁으로 순간이동, 그 아군 보호막 10',
    trigger: { id: '수호자', when: 'allyCrisis', test: (_p, c) => !!c.target, run: (p, c) => { besideAlly(p, c.src, c.target!, c.t, c.ev); addShield(c.target!, 10, c.src); } } },
};
export const MEMORY_IDS = Object.keys(MEMORIES) as MemoryId[];
export const rollMemory = (rng: Rng): MemoryId => rng.pick(MEMORY_IDS);
/** The memory trigger of a clone's soul, if it has one. */
export const memoryTriggers = (u: Unit): TriggerDef[] => { const m = u.memory && MEMORIES[u.memory as MemoryId]?.trigger; return m ? [m] : []; };
/** Once-a-fight memories start over when a fight starts. */
export function freshFight(u: Unit): void { u.keeperUsed = false; u.poisonerUsed = false; }
