import type { Material, ModDef, ModSlot, ModStat, WorkbenchModel, WorkbenchOption } from './workbenchTypes';

/** The plan's twelve mods (base-overhaul Task 5), for running the screen before the sim side lands. */
export const MOCK_MODS: ModDef[] = [
  { id: 'longBarrel', slot: 'barrel', name: '장총열', stats: { hit: 0.08 }, cost: { scrap: 4 } },
  { id: 'heavyBarrel', slot: 'barrel', name: '중총열', stats: { gunDmg: 1, noise: 2 }, cost: { scrap: 3, relic: 2 } },
  { id: 'extMag', slot: 'mag', name: '확장 탄창', stats: { maxCharge: 2 }, cost: { scrap: 5 } },
  { id: 'soulCell', slot: 'mag', name: '영혼 전지', stats: { maxCharge: 4 }, cost: { soul: 4, remains: 1 } },
  { id: 'redDot', slot: 'sight', name: '점조준기', stats: { hit: 0.05 }, cost: { scrap: 3 } },
  { id: 'runeScope', slot: 'sight', name: '룬 조준경', stats: { hit: 0.12 }, cost: { relic: 4 } },
  { id: 'quickGrip', slot: 'grip', name: '속사 손잡이', stats: { swap: -0.25 }, cost: { scrap: 4 } },
  { id: 'plating', slot: 'chest', name: '강화 판', stats: { maxHp: 6 }, cost: { scrap: 6 } },
  { id: 'soulWeave', slot: 'chest', name: '영혼 직조', stats: { shield: 3 }, cost: { soul: 5 } },
  { id: 'servoArms', slot: 'arms', name: '서보 팔', stats: { meleeDmg: 1 }, cost: { scrap: 4, soul: 2 } },
  { id: 'sprintLegs', slot: 'legs', name: '질주 다리', stats: { evasion: 0.05 }, cost: { soul: 3 } },
  { id: 'silencer', slot: 'back', name: '소음 차폐', stats: { noise: -2 }, cost: { relic: 3, remains: 1 } },
];
const LABEL: Record<Exclude<ModSlot, 'heart'>, string> = { barrel: '총열', mag: '탄창', sight: '조준기', grip: '손잡이', chest: '흉갑', arms: '팔', legs: '다리', back: '등 장치' };
const PISTOL: ModSlot[] = ['barrel', 'mag', 'sight', 'grip'];
const BASE: [string, ModStat | null, number][] = [['총 피해', 'gunDmg', 5], ['명중', 'hit', 0.9], ['충전', 'maxCharge', 10], ['소음', 'noise', 4], ['체력', 'maxHp', 35], ['회피', 'evasion', 0.1], ['보호막', 'shield', 0]];

/** A self-contained model with its own materials, owned and fitted mods; `craft`/`fit` change it like the meta would. */
export class MockBench {
  materials: Record<Material, number> = { scrap: 12, soul: 5, relic: 2, remains: 1 };
  owned = new Set<string>(['redDot']);
  fitted: Partial<Record<ModSlot, string>> = { sight: 'redDot' };

  craft(id: string): void {
    const mod = MOCK_MODS.find((m) => m.id === id)!;
    if (!this.craftable(mod)) return;
    for (const [k, n] of Object.entries(mod.cost)) this.materials[k as Material] -= n!;
    this.owned.add(id);
  }

  fit(slot: ModSlot, id: string | null): void {
    if (id) this.fitted[slot] = id; else delete this.fitted[slot];
  }

  private craftable(mod: ModDef): boolean {
    return Object.entries(mod.cost).every(([k, n]) => this.materials[k as Material] >= n!);
  }

  model(): WorkbenchModel {
    const find = (id?: string) => MOCK_MODS.find((m) => m.id === id) ?? null;
    const sum = (fitted: Partial<Record<ModSlot, string>>) => {
      const total: Partial<Record<ModStat, number>> = {};
      for (const id of Object.values(fitted)) for (const [k, v] of Object.entries(find(id)?.stats ?? {})) total[k as ModStat] = (total[k as ModStat] ?? 0) + v;
      return total;
    };
    return {
      open: true,
      materials: { ...this.materials },
      slots: (Object.keys(LABEL) as Exclude<ModSlot, 'heart'>[]).map((slot) => ({ slot, part: PISTOL.includes(slot) ? 'pistol' : 'suit', label: LABEL[slot], fitted: find(this.fitted[slot]) })),
      options: (slot) => MOCK_MODS.filter((m) => m.slot === slot).map((mod): WorkbenchOption => {
        const missing: Partial<Record<Material, number>> = {};
        for (const [k, n] of Object.entries(mod.cost)) if (this.materials[k as Material] < n!) missing[k as Material] = n! - this.materials[k as Material];
        return { mod, owned: this.owned.has(mod.id), craftable: !Object.keys(missing).length, missing, fitted: this.fitted[slot] === mod.id };
      }),
      stats: (preview) => {
        const now = sum(this.fitted);
        const next = preview ? sum({ ...this.fitted, [preview.slot]: preview.mod ?? undefined }) : null;
        return BASE.map(([label, stat, base]) => ({ label, now: base + (stat ? now[stat] ?? 0 : 0), next: next && stat ? base + (next[stat] ?? 0) : undefined }));
      },
    };
  }
}
