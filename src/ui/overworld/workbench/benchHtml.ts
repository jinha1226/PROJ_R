import type { SfPart } from '../../../sim/base/sfModules';
import { overlaySvg } from './workbenchArt';
import type { BenchModel, BenchSlot, ModuleRow } from './benchModel';

export interface BenchView { part: SfPart; slot: BenchSlot }

function moduleRow(r: ModuleRow, view: BenchView): string {
  const index = Number(view.slot.slice(-1));
  const btn = r.state === 'fitted' ? `<button type="button" class="btn" data-act="unfit" data-id="${r.id}">해제</button>`
    : r.state === 'owned' ? `<button type="button" class="btn primary" data-act="fit" data-id="${r.id}" data-index="${index}">장착</button>`
    : `<button type="button" class="btn" data-act="craft" data-id="${r.id}" ${r.state === 'craftable' ? '' : 'disabled'}>제작</button>`;
  const state = r.state === 'fitted' ? '<em>장착됨</em>' : r.state === 'owned' ? '<em class="own">보유</em>' : '';
  return `<li class="wb-opt${r.state === 'fitted' ? ' fitted' : ''}"><div class="wb-opt-top"><b>${r.name}</b>${state}</div>
    <div class="wb-opt-stat">${r.line}</div><div class="wb-opt-foot"><small>${r.tags}</small>${r.state === 'craftable' || r.state === 'short' ? `<span class="wb-cost${r.state === 'short' ? ' short' : ''}">${r.cost}</span>` : ''}${btn}</div></li>`;
}

/** The workshop screen: the drawing of the gun or the suit with its module slots, the modules and the items to dismantle, numbers, materials, the soul slot. */
export function benchHtml(m: BenchModel, view: BenchView): string {
  const slots = m.slots.filter((s) => s.part === view.part), sel = slots.find((s) => s.slot === view.slot) ?? slots[0]!;
  const mods = m.modules(view.part).map((r) => moduleRow(r, { ...view, slot: sel.slot })).join('') || '<li class="wb-empty">설계도 없음 · 장비를 분해하세요</li>';
  const dis = m.dismantle(view.part).map((r) => `<li class="wb-opt"><div class="wb-opt-top"><b>${r.name}</b>${r.known ? '<em class="own">설계도 보유</em>' : ''}</div>
    <div class="wb-opt-foot"><small>${r.gives} · ${view.part === 'gun' ? '총' : '슈트'} 강화</small><button type="button" class="btn" data-act="dismantle" data-id="${r.itemId}">분해</button></div></li>`).join('') || '<li class="wb-empty">분해할 장비 없음</li>';
  const stats = m.stats(view.part).map((r) => `<tr><th>${r.label}</th><td>${r.now}</td></tr>`).join('');
  const mats = m.mats.map((x) => `<span><i>${x.name}</i> ${x.n}</span>`).join('');
  return `<header class="wb-head"><b>작업장</b>
      <div class="wb-tabs" role="tablist"><button type="button" role="tab" data-tab="gun" aria-selected="${view.part === 'gun'}">권총</button><button type="button" role="tab" data-tab="suit" aria-selected="${view.part === 'suit'}">슈트</button></div>
      <button type="button" class="wb-close" data-close aria-label="닫기">✕</button></header>
    <div class="wb-main">
      <div class="wb-draw"><div class="wb-stage"><canvas class="wb-px" width="320" height="195"></canvas>${overlaySvg(view.part === 'gun' ? 'pistol' : 'suit', m.slots, sel.slot)}</div><table class="wb-stats">${stats}</table></div>
      <div class="wb-side"><div class="wb-slot"><span>${sel.label}</span>${sel.fitted ? sel.fitted.name : '비어 있음'}</div>
        <ul class="wb-opts">${mods}</ul><h4 class="wb-sub-h">분해</h4><ul class="wb-opts">${dis}</ul></div>
    </div>
    <footer class="wb-mats">${mats}<button type="button" class="btn" data-act="soul" ${m.soul.can ? '' : 'disabled'}>영혼 칸 ${m.soul.slots} → ${m.soul.slots + 1} · 마정석 ${m.soul.cost}</button></footer>`;
}
