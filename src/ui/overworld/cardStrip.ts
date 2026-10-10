import type { GEvent } from '../../sim/grid/types';
import { entOf, unitOf, type Party, type Unit } from '../../sim/party/partyCore';
import { TRAITS, rank, type TraitId } from '../../sim/party/traitDefs';
import { traitText } from '../../sim/party/traitText';
import { ULT_NAMES, ultSlots } from '../../sim/party/ultimate';
import { richText } from './richText';
import { skillLine, skillName, SKILLS, skillsOf, SLOT_NAME, SLOTS, type Slot } from '../../sim/party/skills';
import { CARD_SHORT } from './cardShort';

/** a card blinks each time it fires: lit, a beat dark, lit again (ms from the moment it fired) */
const BLINK: [number, number][] = [[0, 170], [250, 420]];
const BLINK_END = 420;
/** events a card throws under a name of their own, each a firing of that card (every rock of a meteor shower, every skeleton blown) */
const ALSO: Record<string, TraitId> = { '운석 낙하': 'meteor', '해골 자폭': 'raiseSkeleton' };
/** A card with no short name of its own is marked by the head of its name's last word (화염 전이 → 전이). */
export const cardMark = (name: string): string => [...name.trim().split(/\s+/).pop()!].slice(0, 2).join('');
/** What a card's tile says: its short name (two or three letters); the full name stays in the log and the descriptions. */
export const cardLabel = (id: TraitId): string => CARD_SHORT[id] ?? cardMark(TRAITS[id]?.name ?? id);
/** every name an effect of a card is told under (the card's own, and each trigger of each of its ranks), by card */
let byEffect: Map<string, TraitId[]> | undefined;
function cardsNamed(text: string): TraitId[] {
  if (!byEffect) {
    byEffect = new Map();
    const add = (name: string, id: TraitId) => { const l = byEffect!.get(name) ?? []; if (!l.includes(id)) l.push(id); byEffect!.set(name, l); };
    for (const d of Object.values(TRAITS)) {
      add(d.name, d.id as TraitId);
      for (let r = 1; r <= d.ranks; r++) for (const t of [...(d.trigger ? [d.trigger(r)] : []), ...(d.triggers?.(r) ?? [])]) add(t.id, d.id as TraitId);
    }
  }
  return byEffect.get(text) ?? (ALSO[text] ? [ALSO[text]] : []);
}

/** The cards a clone holds, in the order it took them. */
export const cardsOf = (u: Unit): TraitId[] => (Object.keys(u.traits ?? {}) as TraitId[]).filter((id) => TRAITS[id] && rank(u, id) > 0);

/** Which of a clone's cards an effect's line belongs to (none for an innate, a resonance, gear). */
export function cardsLit(u: Unit, text: string): TraitId[] {
  // a skill's effect is told under the skill's own name: its tile is the place it sits in
  if (SKILLS.on) return SLOTS.filter((slot) => { const s = skillsOf(u)[slot]; return !!s && skillName(slot, s) === text; }).map((slot) => `sk:${slot}`);
  return cardsNamed(text).filter((id) => rank(u, id) > 0);
}

/** The strip's markup, two rows: the ultimates as keys along the top (the only things here that are pressed), every card in one row under them. */
export function cardStripHtml(p: Party, id: string): string {
  const u = unitOf(p, id), e = entOf(p, id);
  if (!u || !e) return '';
  const ults = ultSlots(u).map((s) => {
    const left = Math.max(0, s.ready - p.time), q = u.ultQueued && u.ultSlot === s.slot, name = ULT_NAMES[s.ult];
    return `<button type="button" class="cs-ult${q ? ' queued' : ''}${left > 0 || !e.alive ? ' wait' : ''}" data-skill="${s.slot}" data-name="${name}"><span>${name}</span>${left > 0 ? `<em>${Math.ceil(left)}</em>` : ''}</button>`;
  }).join('');
  const cards = SKILLS.on
    ? SLOTS.filter((slot) => skillsOf(u)[slot]).map((slot) => `<button type="button" class="cs-card" data-card="sk:${slot}" title="${skillName(slot, skillsOf(u)[slot]!)}">${SLOT_NAME[slot]}</button>`).join('')
    : cardsOf(u).map((c) => `<button type="button" class="cs-card" data-card="${c}" title="${TRAITS[c]!.name}">${cardLabel(c)}</button>`).join('');
  return `<div class="cs-ults">${ults}</div><div class="cs-cards">${cards}</div>`;
}

/** What a card is, for the line shown when its tile is tapped: its name, its rank, what it does. */
export function cardInfoHtml(u: Unit, id: TraitId): string {
  if (id.startsWith('sk:')) { const slot = id.slice(3) as Slot, s = skillsOf(u)[slot]; return s ? `<b>${skillName(slot, s)} ${'★'.repeat(s.lv)}</b><span class="cs-info">${skillLine(slot, s, u)}</span>` : ''; }
  const d = TRAITS[id]!, r = Math.max(1, rank(u, id));
  return `<b>${d.name}${d.ranks > 1 ? ` ${'★'.repeat(r)}` : ''}</b><span class="cs-info">${richText(traitText(id, r))}</span>`;
}

/**
 * The build along the bottom of the screen: the clone's ultimate over a row of every card it holds. A card lights up
 * the moment one of its effects shows in the fight, so a chain reads as it runs: this card, then that one, then that.
 */
export class CardStrip {
  readonly el = document.createElement('div');
  private html = '';
  /** what is blinking (a selector of its tile), and since when */
  private readonly lit = new Map<string, number>();

  constructor(private readonly p: () => Party, private readonly sel: () => string, private readonly a: { ult(slot: number): void; info(html: string): void }) {
    this.el.className = 'card-strip';
    this.el.addEventListener('click', (e) => {
      const t = e.target as HTMLElement, ult = t.closest<HTMLElement>('[data-skill]'), card = t.closest<HTMLElement>('[data-card]'), u = unitOf(this.p(), this.sel());
      if (ult) this.a.ult(Number(ult.dataset.skill));
      else if (card && u) this.a.info(cardInfoHtml(u, card.dataset.card as TraitId));
    });
  }

  /** An effect showing on screen: the cards it belongs to blink, every time (an ultimate's own name blinks its key). */
  flash(e: GEvent): void {
    if (e.type !== 'buff' || !e.text || !e.src) return;
    const p = this.p(), src = unitOf(p, e.src), who = src?.summoner ?? src?.id, u = unitOf(p, this.sel());
    if (!u || who !== u.id) return;
    const now = performance.now();
    for (const id of cardsLit(u, e.text)) this.lit.set(`[data-card="${id}"]`, now);
    if ((Object.values(ULT_NAMES) as string[]).includes(e.text)) this.lit.set(`[data-name="${e.text}"]`, now);
  }

  update(): void {
    const html = cardStripHtml(this.p(), this.sel());
    if (html !== this.html) { this.html = html; this.el.innerHTML = html; }
    const now = performance.now();
    for (const [q, since] of this.lit) {
      const t = now - since;
      this.el.querySelector(q)?.classList.toggle('lit', blinkOn(t));
      if (t > BLINK_END) this.lit.delete(q);
    }
  }
}

/** Whether a card that fired `ms` ago is lit at this moment of its blink. */
export const blinkOn = (ms: number): boolean => BLINK.some(([a, b]) => ms >= a && ms < b);
