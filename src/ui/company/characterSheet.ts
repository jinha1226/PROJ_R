import { CLASSES } from '../../data/classes';
import { relationKinds } from '../../sim/personality/relations';
import { mercStats } from '../../sim/roster/toSetup';
import { rankOf, type Mercenary, type Roster } from '../../sim/roster/types';
import { tacticSlots } from '../../sim/roster/tactics';
import { t } from '../i18n/ko';
import { renderEquip } from './equipPanel';
import { chronicleText, displayName, growthGrade } from './text';

export type SheetTab = 'stats' | 'skills' | 'gear' | 'relations' | 'chronicle';
const TABS: [SheetTab, string][] = [['stats', '능력치'], ['skills', '스킬'], ['gear', '장비'], ['relations', '관계'], ['chronicle', '연대기']];
const pct = (v: number) => `${Math.round(v * 100)}%`;

function statsTab(m: Mercenary): string {
  const s = mercStats(m);
  const traits = m.traits.map((tr) => (m.revealed.includes(tr) ? `<span class="trait-chip" title="${t(`traitDesc.${tr}`)}">${t(`trait.${tr}`)}</span>` : '<span class="trait-chip">?</span>')).join('');
  const temp = m.tempTraits.map((x) => `<span class="trait-chip temp">${t(`trait.${x.trait}`)} (${x.battles})</span>`).join('');
  const scars = m.scars.map((sc) => `<li title="${t(`scarDesc.${sc}`)}">${t(`scar.${sc}`)} — ${t(`scarDesc.${sc}`)}</li>`).join('');
  return `<div class="sheet-grid">
    <div><b>체력</b> ${s.maxHp}</div><div><b>공격</b> ${s.atk.toFixed(1)}</div><div><b>방어</b> ${s.def.toFixed(1)}</div>
    <div><b>공속</b> ${s.atkSpeed.toFixed(2)}</div><div><b>이동</b> ${s.moveSpeed.toFixed(1)}</div><div><b>사거리</b> ${s.range.toFixed(1)}</div>
    <div><b>회피</b> ${pct(s.dodge)}</div><div><b>치명</b> ${pct(s.crit)}</div>
    <div><b>성장</b> 체 ${growthGrade(m.growth.maxHp)} · 공 ${growthGrade(m.growth.atk)} · 방 ${growthGrade(m.growth.def)}</div></div>
    <div class="sheet-row"><b>특성</b> ${traits}${temp}</div>
    ${m.title ? `<div class="sheet-row"><b>별명</b> ${t(`title.${m.title}`)} — ${t(`titleDesc.${m.title}`)}</div>` : ''}
    ${m.injury ? `<div class="sheet-row warn"><b>부상</b> ${m.injury}전투 동안 능력치 −15%</div>` : ''}
    ${scars ? `<div class="sheet-row"><b>흉터</b><ul>${scars}</ul></div>` : ''}
    <div class="sheet-row muted">${m.backstory}</div>`;
}

function tacticSelects(m: Mercenary, r: Roster): string {
  return Array.from({ length: tacticSlots(m.level) }, (_, slot) => {
    const cur = m.tactics[slot];
    const opts = r.tacticsOwned.map((tc) => `<option value="${tc}" ${tc === cur ? 'selected' : ''}>${t(`tactic.${tc}`)}</option>`).join('');
    return `<select data-act="tactic" data-slot="${slot}" data-testid="tactic-${slot}">${cur ? '' : '<option value="" selected>—</option>'}${opts}</select>`;
  }).join(' ');
}

function skillsTab(m: Mercenary, r: Roster): string {
  const lv = (id: string) => m.skillLevels[id] ?? 1;
  const row = (id: string, kind: string) => `<li><span class="kind">${kind}</span> ${t(`skill.${id}`)} <em>Lv${lv(id)}</em></li>`;
  const passives = m.passives.map((p) => `<li><span class="kind">패시브</span> ${t(`passive.${p}`)} <em>${t(`passiveDesc.${p}`)}</em></li>`).join('');
  return `<ul class="skill-list">${row(CLASSES[m.classId].basic, '기본')}${m.actives.map((a) => row(a, '액티브')).join('')}${row(m.ultimate, '궁극기')}${passives}</ul>
    <div class="sheet-row"><b>전술</b> ${tacticSelects(m, r)}</div>`;
}

function relationsTab(m: Mercenary, r: Roster): string {
  const rows = r.relations.filter((x) => x.a === m.id || x.b === m.id).map((x) => {
    const other = r.mercs.find((o) => o.id === (x.a === m.id ? x.b : x.a));
    if (!other) return '';
    const kinds = [...relationKinds(x, x.a === m.id ? m.level : other.level, x.a === m.id ? other.level : m.level)].map((k) => t(`relation.${k}`)).join('·');
    return `<li><b>${other.name}</b> 친밀도 ${x.affinity}${kinds ? ` <em>${kinds}</em>` : ''} · 함께한 전투 ${x.battlesTogether}</li>`;
  }).join('');
  return rows ? `<ul class="rel-list">${rows}</ul>` : '<p class="muted">아직 특별한 관계가 없다.</p>';
}

export function renderSheet(m: Mercenary, r: Roster, tab: SheetTab): string {
  const body = tab === 'stats' ? statsTab(m) : tab === 'skills' ? skillsTab(m, r) : tab === 'gear' ? renderEquip(m, r)
    : tab === 'relations' ? relationsTab(m, r) : `<ol class="chronicle">${m.chronicle.map((e) => `<li><span>${e.battle ? `#${e.battle}` : '—'}</span>${chronicleText(e, r)}</li>`).join('')}</ol>`;
  return `<div class="sheet" data-testid="sheet" data-merc="${m.id}">
    <div class="sheet-head" style="border-color:${m.color}"><div class="sheet-name">${displayName(m)}</div>
      <div class="muted">Lv${m.level} ${t(`class.${m.classId}`)} · ${t(`rank.${rankOf(m.level)}`)}</div><button class="btn sheet-close" data-act="close">✕</button></div>
    <div class="tabs">${TABS.map(([k, label]) => `<button class="tab ${k === tab ? 'active' : ''}" data-tab="${k}" data-testid="tab-${k}">${label}</button>`).join('')}</div>
    <div class="sheet-body">${body}</div></div>`;
}
