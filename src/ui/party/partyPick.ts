import { LINE } from '../../sim/party/classKit';
import { KITS, PROMOTIONS } from '../../sim/party/classKit';
import { ULT_NAMES } from '../../sim/party/ultimate';
import { BASE_CLASSES, CLASSES, WEAPONS, type BaseClass, type ClassId, type Pick, type WeaponId } from '../../sim/party/partyDefs';
import type { UalLook } from '../../view/grid/ualActor';

const COLORS: Partial<Record<ClassId, [string, string]>> = {
  shell: ['#b4b8c0', '#8a9098'],
  warrior: ['#2a3a5a', '#c8b080'], berserker: ['#5a2020', '#d08040'], archer: ['#35502e', '#8a6a3a'], sniper: ['#2a3a2a', '#a0a070'],
  mage: ['#4a2a6a', '#c8a0e0'], cleric: ['#cfc6a8', '#c8a040'], rogue: ['#262626', '#7a3a3a'],
};

/** How a hero of this class with this weapon looks. */
export function lookOf(cls: ClassId, weapon: WeaponId): UalLook {
  const w = WEAPONS[weapon], [body, trim] = COLORS[cls] ?? COLORS[LINE[cls] ?? 'warrior']!;
  const idle = cls === 'shell' ? 'Idle_Loop' : w.look === 'none' ? 'Spell_Simple_Idle_Loop' : w.range > 1 ? 'Idle_Loop' : 'Sword_Idle';
  return { body, trim, scale: cls === 'warrior' || cls === 'berserker' ? 1 : 0.95, weapon: w.look, shield: w.shield, idle, fullRun: true };
}

/** The party chooser: five classes, three to take, each with a weapon. */
export class PartyPick {
  readonly el = document.createElement('div');
  private chosen: BaseClass[] = [];
  private readonly weapon = new Map<BaseClass, WeaponId>(BASE_CLASSES.map((c) => [c, CLASSES[c].weapons[0]!]));

  constructor(start: Pick[], private readonly go: (picks: Pick[]) => void) {
    this.el.className = 'pd-pick';
    for (const p of start) { this.chosen.push(p.cls); this.weapon.set(p.cls, p.weapon); }
    this.el.addEventListener('click', (e) => {
      const t = e.target as HTMLElement;
      const w = t.closest<HTMLElement>('[data-weapon]');
      const card = t.closest<HTMLElement>('[data-cls]');
      if (t.closest('[data-go]') && this.chosen.length === 3) { this.go(this.picks()); return; }
      if (w && card) { this.weapon.set(card.dataset.cls as BaseClass, w.dataset.weapon as WeaponId); if (!this.chosen.includes(card.dataset.cls as BaseClass)) this.toggle(card.dataset.cls as BaseClass); }
      else if (card) this.toggle(card.dataset.cls as BaseClass);
      this.draw();
    });
    this.draw();
  }

  private picks(): Pick[] { return this.chosen.map((cls) => ({ cls, weapon: this.weapon.get(cls)! })); }

  private toggle(cls: BaseClass): void {
    if (this.chosen.includes(cls)) this.chosen = this.chosen.filter((c) => c !== cls);
    else if (this.chosen.length < 3) this.chosen.push(cls);
  }

  private draw(): void {
    const cards = BASE_CLASSES.map((cls) => {
      const c = CLASSES[cls], slot = this.chosen.indexOf(cls), promo = PROMOTIONS[cls];
      const weapons = c.weapons.map((w) => `<button type="button" data-weapon="${w}" class="${this.weapon.get(cls) === w ? 'on' : ''}">${WEAPONS[w].name}<small>${WEAPONS[w].note}</small></button>`).join('');
      return `<div class="pd-class${slot >= 0 ? ' on' : ''}" data-cls="${cls}">
        <b>${slot >= 0 ? `${slot + 1} ` : ''}${c.name}</b><span class="hp">체력 ${c.hp}</span>
        <p>${ULT_NAMES[KITS[cls].ultimate!]}</p><p class="pas">${c.passiveName}</p>
        <div class="wpn">${weapons}</div>
        ${promo.map(o=>`<p class="promo">${CLASSES[o.to].name} · ${Object.entries(o.need).map(([tag,n])=>`${tag} ${n}`).join(' · ')}</p>`).join('')}
      </div>`;
    }).join('');
    this.el.innerHTML = `<h2>파티 편성 <small>${this.chosen.length}/3</small></h2><div class="pd-classes">${cards}</div><button type="button" data-go ${this.chosen.length === 3 ? '' : 'disabled'}>출발</button>`;
  }
}
