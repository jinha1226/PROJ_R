import { CATALOG } from '../../../sim/delve/catalog';
import { itemName } from '../../../sim/delve/items';
import { numbers } from '../../../sim/delve/gear';
import { sfModule, sfModules, type SfPart } from '../../../sim/base/sfModules';
import { canCraft, sfOf, SF_SLOTS, soulSlotCost } from '../../../sim/base/workshop';
import { triggerText } from '../../../sim/party/triggerText';
import { slotsOf, type RoamParty } from '../../../sim/roam/roam';

export type BenchSlot = 'gun0' | 'gun1' | 'suit0';
export interface WorkbenchSlot { slot: BenchSlot; part: SfPart; label: string; fitted: { name: string } | null }
export interface ModuleRow { id: string; name: string; line: string; tags: string; state: 'fitted' | 'owned' | 'craftable' | 'short'; cost: string; at?: number }
export interface DismantleRow { itemId: string; name: string; gives: string; known: boolean }
export interface BenchModel {
  slots: WorkbenchSlot[]; modules(part: SfPart): ModuleRow[]; dismantle(part: SfPart): DismantleRow[];
  stats(part: SfPart): { label: string; now: string }[]; mats: { name: string; n: number }[]; soul: { slots: number; cost: number; can: boolean };
}

const costText = (c: { ore?: number; crystal?: number; bio?: number }) => [c.ore ? `광석 ${c.ore}` : '', c.crystal ? `마정석 ${c.crystal}` : '', c.bio ? `생체 ${c.bio}` : ''].filter(Boolean).join(' · ');

/** What the workshop screen shows, read from the base (a snapshot: drawing it never changes anything). */
export function benchModel(p: RoamParty): BenchModel {
  const sf = sfOf(p);
  const slot = (part: SfPart, i: number): WorkbenchSlot => {
    const id = sf.fitted[part][i] ?? null, m = id ? sfModule(id) : undefined;
    return { slot: `${part}${i}` as BenchSlot, part, label: part === 'gun' ? `모듈 ${i + 1}` : '모듈', fitted: m ? { name: m.name } : null };
  };
  const kit = (def: string, grown: { power: number; bonus: object }) => numbers({ id: 'kit', def, power: grown.power, bonus: grown.bonus });
  return {
    slots: [slot('gun', 0), slot('gun', 1), slot('suit', 0)],
    modules: (part) => sfModules().filter((m) => m.part === part && sf.blueprints.includes(m.id)).map((m) => ({
      id: m.id, name: m.name, line: m.triggers.map((t) => triggerText(t.id) || t.id).join(' · '), tags: m.tags.map((t) => `#${t}`).join(' '), cost: costText(m.cost),
      at: sf.fitted[part].indexOf(m.id) >= 0 ? sf.fitted[part].indexOf(m.id) : undefined,
      state: [...sf.fitted.gun, ...sf.fitted.suit].includes(m.id) ? 'fitted' : sf.owned.includes(m.id) ? 'owned' : canCraft(p, m.id) ? 'craftable' : 'short',
    })),
    dismantle: (part) => p.pack.flatMap((it) => {
      if (!('def' in it)) return [];
      const d = CATALOG[it.def];
      if (!d || (part === 'gun' ? d.slot !== 'weapon' || d.family === 'gun' : d.slot !== 'armor' || d.id === 'agentSuit')) return [];
      const m = sfModule(`sf-${d.id}`);
      return [{ itemId: it.id, name: itemName(it), gives: m ? `${m.name} 설계도` : '강화만', known: !!m && sf.blueprints.includes(m.id) }];
    }),
    stats: (part) => {
      if (part === 'gun') { const n = kit('pistol', sf.gun); return [{ label: '피해', now: `${Math.round(n.min)}–${Math.round(n.max)}` }, { label: '사거리', now: `${n.range}` }, { label: '탄창', now: '6' }]; }
      const n = kit('agentSuit', sf.suit); return [{ label: '받는 피해', now: `−${Math.round(n.armor * 100)}%` }];
    },
    mats: [{ name: '광석', n: p.ore }, { name: '마정석', n: p.crystal }, { name: '생체', n: p.bio }],
    soul: { slots: slotsOf(p), cost: soulSlotCost(p), can: p.crystal >= soulSlotCost(p) },
  };
}
export { SF_SLOTS };
