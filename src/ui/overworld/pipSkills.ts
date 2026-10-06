import { CATALOG } from '../../sim/delve/catalog';
import { kitOf } from '../../sim/party/classKit';
import type { TriggerDef } from '../../sim/party/triggers';
import type { Party, Unit } from '../../sim/party/partyCore';
import { TRAITS, rank, type TraitId } from '../../sim/party/traitDefs';
import { traitText } from '../../sim/party/traitText';
import { triggerText } from '../../sim/party/triggerText';
import { ULT_NAMES } from '../../sim/party/ultimate';
import { WHEN } from './pipGear';
import { ULT_TEXT } from './ultText';

/** One line: what it is called, what sets it off, what it does (and where it comes from). */
const row = (name: string, cond: string, effect: string, tag: string) => `<li class="ps-row"><b>${name}</b><span class="ps-when">${cond}</span><span class="ps-what">${effect || '—'}</span><em>${tag}</em></li>`;

/** What sets a trigger off, in words: the event, every n-th time, its odds, its cooldown. */
function condOf(t: TriggerDef): string {
  const parts = [t.nth ? `${t.nth}번째 공격마다` : WHEN[t.when] ?? t.when];
  if (t.chance) parts.push(`${Math.round(t.chance * 100)}% 확률`);
  if (t.cd) parts.push(`대기 ${t.cd}턴`);
  return parts.join(' · ');
}
/** the effect part of a "cause → effect" text (the cause has its own column) */
const effectOf = (text: string): string => (text.includes('→') ? text.slice(text.indexOf('→') + 1).trim() : text);

/** The skills tab: everything a clone has that does something — its class's own triggers, its ultimate, its traits, its gear's triggers — each as name, trigger, effect. */
export function skillsHtml(_p: Party, u: Unit | undefined): string {
  if (!u?.cls) return '<p class="pg-none">없음</p>';
  const kit = kitOf(u);
  const innate = kit.innate.map((t) => row(t.id, condOf(t), effectOf(triggerText(t.id)), '고유')).join('');
  const ult = kit.ultimate ? row(ULT_NAMES[kit.ultimate], `직접 사용 (R) · 대기 ${kit.ultCd}턴`, ULT_TEXT[kit.ultimate], '궁극기') : '';
  const traits = (Object.keys(u.traits ?? {}) as TraitId[]).map((id) => {
    const d = TRAITS[id]!, r = rank(u, id), trig = d.trigger?.(r);
    return row(`${d.name} ${'●'.repeat(r)}`, trig ? condOf(trig) : '상시', effectOf(traitText(id, r)), '특성');
  }).join('');
  const gear = u.gear ? Object.values(u.gear).flatMap((it) => (it ? CATALOG[it.def]!.triggers.map((t) => row(t.id, condOf(t), effectOf(triggerText(t.id)), CATALOG[it.def]!.name)) : [])).join('') : '';
  const head = '<li class="ps-row ps-head"><b>이름</b><span class="ps-when">발동</span><span class="ps-what">효과</span><em></em></li>';
  const sec = (title: string, body: string) => (body ? `<h4>${title}</h4><ul class="pip-skills">${head}${body}</ul>` : '');
  return `<section class="pip-rec ps">${sec('직업', innate + ult)}${sec('특성', traits)}${sec('장비', gear)}${innate + ult + traits + gear ? '' : '<p class="pg-none">없음</p>'}</section>`;
}

/** The log line for a trigger, ultimate or trait that just fired, the first time a clone sets it off (then the skills tab has it). */
export function effectLine(name: string, u: Unit): string {
  const trait = Object.values(TRAITS).find((d) => d.name === name);
  const ult = (Object.entries(ULT_NAMES) as [keyof typeof ULT_TEXT, string][]).find(([, n]) => n === name);
  const text = trait ? traitText(trait.id, Math.max(1, rank(u, trait.id))) : ult ? ULT_TEXT[ult[0]] : triggerText(name);
  return text ? `${name} → ${text}` : name;
}
