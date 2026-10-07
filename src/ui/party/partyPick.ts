import { KITS } from '../../sim/party/classKit';
import { ULT_NAMES } from '../../sim/party/ultimate';
import { BASE_CLASSES, CLASSES, WEAPONS, type BaseClass, type ClassId, type Pick, type WeaponId } from '../../sim/party/partyDefs';
import type { OutfitLook } from '../../view/grid/outfitKit';
import type { UalLook } from '../../view/grid/ualActor';
import { RING } from '../../view/grid/pixelPass';

const COLORS: Partial<Record<ClassId, [string, string]>> = {
  shell: ['#b4b8c0', '#8a9098'],
  warrior: ['#2a3a5a', '#c8b080'], archer: ['#35502e', '#8a6a3a'],
  mage: ['#4a2a6a', '#c8a0e0'], cleric: ['#cfc6a8', '#c8a040'], rogue: ['#262626', '#7a3a3a'],
};

/** Build by class: a stocky warrior, a slight rogue (heights the dot look can tell apart). */
const BUILD: Partial<Record<ClassId, number>> = { shell: 0.8, warrior: 1.06, archer: 0.95, mage: 0.93, cleric: 0.98, rogue: 0.88 };

/** What each soul wears; the empty clone goes bare. */
export const OUTFITS: Partial<Record<ClassId, OutfitLook>> = {
  // strong, near-primary dyes (the cloth texture keeps only its shading): each class reads by colour against torchlit stone
  warrior: { set: 'Peasant', tint: '#2f6bff', extra: ['pauldron'] },
  archer: { set: 'Ranger', tint: '#2fd040' },
  mage: { set: 'Peasant', tint: '#9a3cff', extra: ['hood'] },
  cleric: { set: 'Peasant', tint: '#f4f4f0' },
  rogue: { set: 'Ranger', tint: '#ff2f8a', extra: ['hood'] },
  necromancer: { set: 'Peasant', tint: '#22c8a0', extra: ['hood'] },
};

/** The outfit a class shows. */
export const outfitOf = (cls: ClassId): OutfitLook | undefined => OUTFITS[cls];

/** How a hero of this class with this weapon looks: a dressed soul shows the clone's grey under its clothes. */
export function lookOf(cls: ClassId, weapon: WeaponId): UalLook {
  const w = WEAPONS[weapon], outfit = outfitOf(cls), [body, trim] = outfit ? COLORS.shell! : COLORS[cls] ?? COLORS.warrior!;
  const caster = w.look === 'staff' || w.look === 'wand' || w.look === 'symbol';
  const idle = cls === 'shell' ? 'Idle_Loop' : caster || w.look === 'none' ? 'Spell_Simple_Idle_Loop' : w.range > 1 ? 'Idle_Loop' : 'Sword_Idle';
  return { body, trim, scale: BUILD[cls] ?? 0.95, weapon: w.look, off: weapon === 'daggers' ? 'dagger' : undefined, shield: w.shield, idle, fullRun: true, outfit, ring: RING[cls as keyof typeof RING] ?? RING.shell };
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
      const c = CLASSES[cls], slot = this.chosen.indexOf(cls);
      const weapons = c.weapons.map((w) => `<button type="button" data-weapon="${w}" class="${this.weapon.get(cls) === w ? 'on' : ''}">${WEAPONS[w].name}<small>${WEAPONS[w].note}</small></button>`).join('');
      return `<div class="pd-class${slot >= 0 ? ' on' : ''}" data-cls="${cls}">
        <b>${slot >= 0 ? `${slot + 1} ` : ''}${c.name}</b><span class="hp">체력 ${c.hp}</span>
        <p>${ULT_NAMES[KITS[cls].ultimate!]}</p><p class="pas">${c.passiveName}</p>
        <div class="wpn">${weapons}</div>
      </div>`;
    }).join('');
    this.el.innerHTML = `<h2>파티 편성 <small>${this.chosen.length}/3</small></h2><div class="pd-classes">${cards}</div><button type="button" data-go ${this.chosen.length === 3 ? '' : 'disabled'}>출발</button>`;
  }
}
