import { ENGRAVES, type EngraveId, type Engraving } from '../../sim/grid/engraveCore';
import type { Weapon } from '../../sim/grid/items';
import type { GAction } from '../../sim/grid/types';

const FIT: Record<string, string> = { melee: '근접', ranged: '원거리', magic: '마법', any: '공용' };
const esc = (v: unknown): string => String(v).replace(/[&"<>]/g, (c) => `&#${c.charCodeAt(0)};`);

/** A weapon's engravings as small chips ("돌진 베기 · 반격 II"). */
export function engraveChips(list: Engraving[] | undefined): string {
  if (!list?.length) return '';
  return `<div class="gengr">${list.map((e) => `<i title="${esc(ENGRAVES[e.id].note)}">${esc(ENGRAVES[e.id].name)}${e.lvl > 1 ? ` ${'I'.repeat(e.lvl)}` : ''}</i>`).join('')}</div>`;
}

/** Level up: three engravings to choose from, inscribed on the weapon in hand. */
export class LevelUpPanel {
  readonly el = document.createElement('div');

  constructor(offer: EngraveId[], weapon: Weapon | null, level: number, act: (a: GAction) => void) {
    this.el.className = 'glvl';
    this.el.dataset.testid = 'grid-levelup';
    const full = (weapon?.engraves?.length ?? 0) >= 2 ? `<small class="muted">칸이 가득 차서 가장 오래된 «${esc(ENGRAVES[weapon!.engraves![0]!.id].name)}»이(가) 지워집니다</small>` : '';
    this.el.innerHTML = `<div class="glvl-panel">
      <h3>레벨 ${level}! 각인 하나를 고르세요</h3>
      <p class="muted">${weapon ? `«${esc(weapon.name)}»에 새겨집니다` : '손에 든 무기가 없습니다'}</p>${full}
      <div class="glvl-cards">${offer.map((id, i) => `<button class="glvl-card" data-i="${i}" data-testid="grid-levelup-${i}" ${weapon ? '' : 'disabled'}>
        <small>${FIT[ENGRAVES[id].fits]}</small><b>${esc(ENGRAVES[id].name)}</b><span>${esc(ENGRAVES[id].note)}</span></button>`).join('')}</div>
      <button class="btn" data-i="skip" data-testid="grid-levelup-skip">넘기기</button>
    </div>`;
    this.el.addEventListener('click', (e) => {
      const i = (e.target as HTMLElement).closest<HTMLElement>('[data-i]')?.dataset.i;
      if (i !== undefined) act({ kind: 'choose', i: i === 'skip' ? null : Number(i) });
    });
  }
}
