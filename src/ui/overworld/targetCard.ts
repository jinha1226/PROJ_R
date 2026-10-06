import { alive, entOf, hitChance, stats, targetOf, unitOf, type Party, type Unit } from '../../sim/party/partyCore';
import { CLASSES } from '../../sim/party/partyDefs';
import { FOE_NAME } from './classIcons';
import { unitChips } from './unitChips';

/** The foe a card is about: the one under the mouse, else the one the chosen clone is going for (in a fight). */
export function cardTarget(p: Party, sel: string, hovered?: string): Unit | undefined {
  const h = hovered ? unitOf(p, hovered) : undefined;
  if (h && h.side === 'foe' && alive(p, h)) return h;
  const me = unitOf(p, sel);
  if (!me || !p.combat || !alive(p, me)) return undefined;
  const t = me.order?.kind === 'attack' ? unitOf(p, me.order.target) : targetOf(p, me, p.time);
  return t && t.side === 'foe' && alive(p, t) ? t : undefined;
}

/** Jupiter Hell's target line: name, health in cells, the chosen clone's odds to land a blow and its damage. */
export function targetCardHtml(p: Party, sel: string, foe: Unit | undefined): string {
  const me = unitOf(p, sel), fe = foe && entOf(p, foe.id);
  if (!me || !foe || !fe?.alive) return '';
  const name = foe.foe ? FOE_NAME[foe.foe] : foe.cls ? CLASSES[foe.cls].name : '?';
  const cells = 10, full = Math.max(0, Math.ceil((fe.hp / fe.maxHp) * cells));
  const bar = '■'.repeat(full) + '□'.repeat(cells - full);
  const [lo, hi] = stats(me, p.time).dmg;
  return `<b>${name}</b><span class="tc-hp">${bar} ${fe.hp}/${fe.maxHp}</span><span>명중 <b>${Math.round(hitChance(p, me, foe, p.time) * 100)}%</b></span><span>피해 <b>${lo}-${hi}</b></span>${unitChips(foe, p.time)}`;
}
