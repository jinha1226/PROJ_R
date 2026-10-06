import { CATALOG, type GearItem, type ItemDef, type WeaponFamily } from '../../sim/delve/catalog';
import { gearBase, numbers, PACK_SIZE, sacrificeRate } from '../../sim/delve/gear';
import { CONSUMABLE_TEXT } from '../../sim/delve/consumableText';
import { itemName } from '../../sim/delve/items';
import { kitOf } from '../../sim/party/classKit';
import type { Unit } from '../../sim/party/partyCore';
import type { Cond } from '../../sim/party/triggers';
import { triggerText } from '../../sim/party/triggerText';
import { causeOf, effectOf } from './pipSkills';
import { richText } from './richText';
import type { RoamParty } from '../../sim/roam/roam';

const SLOT: Record<ItemDef['slot'], string> = { weapon: '무기', armor: '방어구', accessory: '장신구' };
export const FAMILY_NAME: Record<WeaponFamily, string> = { sword: '한손검', great: '양손 무기', mace: '철퇴', dagger: '단검', bow: '활', crossbow: '석궁', staff: '지팡이', relic: '성물' };
export const WHEN: Partial<Record<Cond, string>> = { hit: '적중', crit: '치명', kill: '처치', struck: '피격', block: '막기', dodge: '회피', crisis: '위기', nth: 'n번째 공격', still: '제자리', moved: '이동 후', allyHit: '아군 피격', allyCrisis: '아군 위기', combatStart: '전투 시작', statusApplied: '상태 부여', ultimate: '궁극기', healed: '치유받음', taunt: '도발', allyUltimate: '아군 궁극기', beforeHit: '적중 직전', guard: '대신 맞기', overflow: '넘친 치유', fireball: '화염구' };

const num = (x: number): string => String(Math.round(x * 10) / 10);
/** what power and sacrifice added on top of the base, in green (nothing when nothing was) */
const gain = (d: number, text: string): string => (d > 0.05 ? ` <b class="up">+${text}</b>` : '');
/** a weapon's damage as its base, then the gain: "7-10 +1.8-2.5" */
export function dmgText(it: GearItem): string {
  const n = numbers(it), b = gearBase(it);
  return `${num(b.min)}-${num(b.max)}${gain(n.max - b.max, `${num(n.min - b.min)}-${num(n.max - b.max)}`)}`;
}
const stat = (it: GearItem): string => {
  const d = CATALOG[it.def]!, n = numbers(it), b = gearBase(it), pct = (x: number) => `${Math.round(x * 100)}%`;
  if (d.slot === 'weapon') return `피해 ${dmgText(it)} · 사거리 ${n.range} · 무게 ${n.weight}`;
  if (d.slot === 'armor') return `받는 피해 -${pct(b.armor)}${gain(n.armor - b.armor, pct(n.armor - b.armor))} · 무게 ${n.weight}`;
  return d.block ? `막기 +${pct(b.block)}${gain(n.block - b.block, pct(n.block - b.block))}` : '';
};
/** what the item sets off, Achra style: the condition, then the effect with its keywords coloured, its name after */
const triggers = (d: ItemDef): string => d.triggers.map((t) => { const text = triggerText(t.id); return `<span class="pg-trig"><i class="k-when">${causeOf(text, t)}</i> ${richText(effectOf(text) || t.id)} <small>${t.id}</small></span>`; }).join('');

/** One item's card: name, numbers, tags, what it sets off; against the worn one, how the damage or protection changes. */
function card(it: GearItem, u: Unit, worn: GearItem | undefined, buttons: string): string {
  const d = CATALOG[it.def]!;
  const off = d.family && u.cls && u.cls !== 'shell' && !kitOf(u).proficient.includes(d.family);
  let cmp = '';
  if (worn && worn.id !== it.id) {
    const a = numbers(it), b = numbers(worn);
    const delta = d.slot === 'weapon' ? (a.min + a.max - b.min - b.max) / 2 : d.slot === 'armor' ? (a.armor - b.armor) * 100 : 0;
    if (delta) cmp = `<b class="${delta > 0 ? 'up' : 'down'}">${delta > 0 ? '▲' : '▼'}${Math.abs(Math.round(delta * 10) / 10)}${d.slot === 'armor' ? '%' : ''}</b>`;
  }
  return `<div class="pg-card${off ? ' off' : ''}"><div class="pg-head"><b>${itemName(it)}</b>${it.power ? `<small>+${Math.round(it.power * 100)}%</small>` : ''}${cmp}</div>
    <div class="pg-stat">${d.family ? `${FAMILY_NAME[d.family]}${d.shield ? '·방패' : ''} · ` : ''}${stat(it)}</div>
    <div class="pg-tags">${d.tags.map((t) => `#${t}`).join(' ')}</div>${triggers(d)}
    ${off ? '<div class="pg-warn">숙련 아님 · 피해 -30% · 공격 느림</div>' : ''}<div class="pg-btns">${buttons}</div></div>`;
}

/** The gear tab: the chosen clone's three slots, then the pack (gear compared with what is worn, consumables to use). */
export function gearHtml(p: RoamParty, u: Unit | undefined): string {
  if (!u?.gear) return '<p class="pg-none">장비 없음</p>';
  const gear = u.gear;
  const slots = (['weapon', 'armor', 'accessory'] as const).map((s) => {
    const it = gear[s];
    return `<div class="pg-slot"><h5>${SLOT[s]}</h5>${it ? card(it, u, undefined, `<button type="button" data-off="${s}">해제</button>`) : '<div class="pg-card empty">빈 칸</div>'}</div>`;
  }).join('');
  return `<section class="pg"><div class="pg-slots">${slots}</div>${packHtml(p, u)}</section>`;
}

/** The pack: gear compared with what the chosen clone wears (equip, sacrifice), consumables to use. */
export function packHtml(p: RoamParty, u: Unit | undefined): string {
  const gear = u?.gear;
  const pack = p.pack.map((it) => {
    if (!('def' in it)) return `<div class="pg-card use"><div class="pg-head"><b>${itemName(it)}</b>${it.charges === undefined ? '' : `<small>${it.charges}회</small>`}</div><div class="pg-stat">${richText(CONSUMABLE_TEXT[it.consumable])}</div><div class="pg-btns"><button type="button" data-item="${it.id}" data-action="use">사용</button></div></div>`;
    if (!u || !gear) return `<div class="pg-card"><div class="pg-head"><b>${itemName(it)}</b></div></div>`;
    const slot = CATALOG[it.def]!.slot, worn = gear[slot];
    return card(it, u, worn ?? undefined, `<button type="button" data-item="${it.id}" data-action="equip">착용</button><button type="button" data-item="${it.id}" data-action="sacrifice" ${worn ? '' : 'disabled'} title="같은 칸 장비에 수치 ${Math.round(sacrificeRate(p) * 100)}%를 더함">희생</button>`);
  }).join('');
  return `<h4>가방 <small>${p.pack.length}/${PACK_SIZE}</small></h4><div class="pg-pack">${pack || '<p class="pg-none">비어 있음</p>'}</div>`;
}
