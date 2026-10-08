import type { GEvent } from '../../sim/grid/types';
import { entOf, unitOf, type Party, type Unit } from '../../sim/party/partyCore';
import { TRAITS, rank, type TraitId } from '../../sim/party/traitDefs';
import { traitText } from '../../sim/party/traitText';
import { ULT_NAMES, ultSlots } from '../../sim/party/ultimate';
import { richText } from './richText';

/** how long a card stays lit after it fires (ms) */
const LIT_MS = 650;
/** up to this many cards are told by name; more are told by their marks (the row is one line) */
const FEW = 4;

/** A card's two-letter mark on its tile: the head of its name's last word (화염 전이 → 전이, 운석 → 운석, 블리자드 → 블리). */
export const cardMark = (name: string): string => [...name.trim().split(/\s+/).pop()!].slice(0, 2).join('');
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
  return byEffect.get(text) ?? [];
}

/** The cards a clone holds, in the order it took them. */
export const cardsOf = (u: Unit): TraitId[] => (Object.keys(u.traits ?? {}) as TraitId[]).filter((id) => TRAITS[id] && rank(u, id) > 0);

/** Which of a clone's cards an effect's line belongs to (none for an innate, a resonance, gear). */
export function cardsLit(u: Unit, text: string): TraitId[] { return cardsNamed(text).filter((id) => rank(u, id) > 0); }

/** The strip's markup, two rows: the ultimates as keys along the top (the only things here that are pressed), every card in one row under them. */
export function cardStripHtml(p: Party, id: string): string {
  const u = unitOf(p, id), e = entOf(p, id);
  if (!u || !e) return '';
  const ults = ultSlots(u).map((s) => {
    const left = Math.max(0, s.ready - p.time), q = u.ultQueued && u.ultSlot === s.slot, name = ULT_NAMES[s.ult];
    return `<button type="button" class="cs-ult${q ? ' queued' : ''}${left > 0 || !e.alive ? ' wait' : ''}" data-skill="${s.slot}" data-name="${name}"><span>${name}</span>${left > 0 ? `<em>${Math.ceil(left)}</em>` : ''}</button>`;
  }).join('');
  // a few cards have room for their whole names; more than that and each is its two-letter mark
  const held = cardsOf(u), few = held.length <= FEW;
  const cards = held.map((c) => `<button type="button" class="cs-card" data-card="${c}" title="${TRAITS[c]!.name}">${few ? TRAITS[c]!.name : cardMark(TRAITS[c]!.name)}</button>`).join('');
  return `<div class="cs-ults">${ults}</div><div class="cs-cards${few ? ' few' : ''}">${cards}</div>`;
}

/** What a card is, for the line shown when its tile is tapped: its name, its rank, what it does. */
export function cardInfoHtml(u: Unit, id: TraitId): string {
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
  private readonly lit = new Map<string, number>();

  constructor(private readonly p: () => Party, private readonly sel: () => string, private readonly a: { ult(slot: number): void; info(html: string): void }) {
    this.el.className = 'card-strip';
    this.el.addEventListener('click', (e) => {
      const t = e.target as HTMLElement, ult = t.closest<HTMLElement>('[data-skill]'), card = t.closest<HTMLElement>('[data-card]'), u = unitOf(this.p(), this.sel());
      if (ult) this.a.ult(Number(ult.dataset.skill));
      else if (card && u) this.a.info(cardInfoHtml(u, card.dataset.card as TraitId));
    });
  }

  /** An effect showing on screen: the cards it belongs to light up (an ultimate's own name lights its key). */
  flash(e: GEvent): void {
    if (e.type !== 'buff' || !e.text || !e.src) return;
    const p = this.p(), src = unitOf(p, e.src), who = src?.summoner ?? src?.id, u = unitOf(p, this.sel());
    if (!u || who !== u.id) return;
    const until = performance.now() + LIT_MS;
    for (const id of cardsLit(u, e.text)) this.lit.set(`[data-card="${id}"]`, until);
    if ((Object.values(ULT_NAMES) as string[]).includes(e.text)) this.lit.set(`[data-name="${e.text}"]`, until);
  }

  update(): void {
    const html = cardStripHtml(this.p(), this.sel());
    if (html !== this.html) { this.html = html; this.el.innerHTML = html; }
    const now = performance.now();
    for (const [q, until] of this.lit) {
      const el = this.el.querySelector(q);
      if (now > until) { this.lit.delete(q); el?.classList.remove('lit'); } else el?.classList.add('lit');
    }
  }
}
