import { emptyMaterials, MATERIALS, type Materials } from './materials';
import type { MetaState } from './meta';
import { MODS, type ModSlot } from './mods';
import { SYSTEMS, type SystemId } from './repairs';
export function savedMaterials(value?: Partial<Materials>): Materials {
  const out = emptyMaterials();
  for (const mat of MATERIALS) {
    const n = value?.[mat]; out[mat] = typeof n === 'number' && Number.isFinite(n) ? Math.max(0, Math.floor(n)) : 0;
  }
  return out;
}
/** Infer repairs only on pre-repair saves, so newer saves cannot bypass material costs. */
export function migrateBaseMeta(m: MetaState): Pick<MetaState, 'portals' | 'materials' | 'repairs' | 'tools' | 'mods' | 'coreSecured' | 'departed'> {
  const legacyNav = m.facilities as MetaState['facilities'] & { navCrypt?: boolean; navRuins?: boolean };
  const portals = [...new Set([...(Array.isArray(m.portals) ? m.portals.filter(n => n === 5 || n === 10) : []),
    ...(legacyNav.navCrypt ? [5] : []), ...(legacyNav.navRuins ? [10] : [])])];
  const repairs = Array.isArray(m.repairs) ? [...new Set(m.repairs.filter(id => Object.hasOwn(SYSTEMS, id)))] : [];
  if (!Array.isArray(m.repairs)) {
    const old = m.facilities as MetaState['facilities'] & { armoryShotgun?: boolean; armoryRifle?: boolean };
    if (m.rounds?.length || old.armoryShotgun || old.armoryRifle) repairs.push('workbench');
    if (m.facilities.suitSlots > 2 || m.facilities.chargePlus > 0 || m.unlocked?.some(id => id !== 'gunRelay' && id !== 'spinShot')) repairs.push('suitlab');
    if (legacyNav.navCrypt || legacyNav.navRuins) {
      if (!repairs.includes('workbench')) repairs.push('workbench');
      repairs.push('nav');
    }
  }
  const mods: MetaState['mods'] = { owned: [...new Set((m.mods?.owned ?? []).filter(id => MODS.some(mod => mod.id === id)))], fitted: {}, unlocked: [] };
  mods.unlocked = [...new Set([...(m.mods?.unlocked ?? []), ...mods.owned])].filter(id => MODS.some(mod => mod.id === id && mod.stone));
  for (const [slot, id] of Object.entries(m.mods?.fitted ?? {})) {
    if ((mods.owned.includes(id) || slot === 'heart' && mods.unlocked.includes(id)) && MODS.some(mod => mod.id === id && mod.slot === slot)) mods.fitted[slot as ModSlot] = id;
  }
  return { portals, materials: savedMaterials(m.materials), repairs, tools: repairs.flatMap((id: SystemId) => SYSTEMS[id].tool ? [SYSTEMS[id].tool!] : []),
    mods, coreSecured: !!m.coreSecured, departed: repairs.includes('core') };
}
