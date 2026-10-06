import { addShield } from '../party/shield';
import { alive, damage, posOf, type Party, type Unit } from '../party/partyCore';
import { heal, nearby, summon } from '../party/kitEffects';
import { applyStatus, type StatusId } from '../party/status';
import type { Ctx, TriggerDef } from '../party/triggers';
export const status = (id: string, status: StatusId, when: TriggerDef['when'] = 'hit', stacks = 1): TriggerDef => ({ id, when, run: (p, c) => { if (c.target)
        applyStatus(p, c.src, c.target, status, c.t, c.ev, stacks); } });
export const cleave: TriggerDef = { id: '양손 휩쓸기', when: 'hit', run: (p, c) => { for (const f of nearby(p, c.src, 1, 'foe'))
        if (f !== c.target)
            damage(p, c.t, c.src.id, f, (c.amount ?? 0) / 2, c.ev); } };
export const stun: TriggerDef = { ...status('둔격', 'stun'), chance: .2 };
export const ward: TriggerDef = { id: '방벽', when: 'block', run: (p, c) => { for (const a of nearby(p, c.src, 2, 'hero'))
        addShield(a, 5); } };
export const hide = (id: string, seconds: number): TriggerDef => ({ id, when: 'combatStart', run: (_p, c) => { c.src.hiddenUntil = c.t + seconds; } });
export const bloodFinish: TriggerDef = { id: '피의 마무리', when: 'kill', test: (_p, c) => (c.target?.status.bleed?.until ?? 0) > c.t, run: (_p, c) => { c.src.empower = Math.max(c.src.empower, 2); } };
export const emberGround: TriggerDef = { id: '잿불 지대', when: 'nth', nth: 3, run: (p, c) => { if (c.target)
        (p.grounds ??= []).push({ at: { ...posOf(p, c.target) }, by: c.src.id, until: c.t + 3, next: c.t + 1 }); } };
export function tickGrounds(p: Party, t: number, ev: Ctx['ev']): void {
    for (const g of p.grounds ?? [])
        while (g.next <= Math.min(t, g.until)) {
            const src = p.units.find(u => u.id === g.by);
            if (src && alive(p, src))
                for (const f of p.units)
                    if (f.side === 'foe' && alive(p, f) && Math.max(Math.abs(posOf(p, f).x - g.at.x), Math.abs(posOf(p, f).y - g.at.y)) <= 1)
                        applyStatus(p, src, f, 'burn', g.next, ev);
            g.next++;
        }
    p.grounds = p.grounds?.filter(g => g.until > t);
}
const holy = (p: Party, c: Ctx) => { if (c.target)
    for (const f of nearby(p, c.target, 1, 'foe'))
        damage(p, c.t, c.src.id, f, 5, c.ev); };
export const pilgrimage = {
    trigger: { id: '순례의 빛', when: 'healed', run: holy } as TriggerDef,
    healSelf: (p: Party, c: Ctx) => heal(p, c.src, c.src, 1, c.t, c.ev),
    crisis: (p: Party, c: Ctx) => heal(p, c.src, c.src, 12, c.t, c.ev),
    leech: (p: Party, c: Ctx) => heal(p, c.src, c.src, (c.amount ?? 0) * .15, c.t, c.ev),
};
export const bait: TriggerDef = { id: '미끼', when: 'taunt', run: (p, c) => { if (c.target) {
        applyStatus(p, c.src, c.target, 'exposed', c.t, c.ev);
        if (c.target.status.exposed)
            c.target.status.exposed.until = c.t + 5;
    } } };
export const echo: TriggerDef = { id: '메아리', when: 'allyUltimate', run: (_p, c) => { c.src.empower = Math.max(c.src.empower, 2); } };
export const guard = {
    trigger: { id: '수호 서약', when: 'allyCrisis', run: (_p, c) => { if (c.target)
            addShield(c.target, 5); } } as TriggerDef,
    thorns: (p: Party, c: Ctx) => { if (c.target && alive(p, c.target))
        damage(p, c.t, c.src.id, c.target, 3, c.ev, true); },
};
export const shatter: TriggerDef = { id: '공명 파쇄', when: 'hit', test: (_p, c) => (c.target?.status.freeze?.until ?? 0) > c.t, run: (p, c) => { if (c.target) {
        delete c.target.status.freeze;
        damage(p, c.t, c.src.id, c.target, c.amount ?? 0, c.ev);
    } } };
export const haste: TriggerDef = { id: '광전사의 박동', when: 'struck', run: (_p, c) => { c.src.fastNext = true; } };
export const wind: TriggerDef = { id: '순풍', when: 'moved', run: (_p, c) => { c.src.dodgeNext = true; } };
export const thunder: TriggerDef = { id: '천둥', when: 'crit', run: (p, c) => { if (c.target)
        for (const f of nearby(p, c.target, 2, 'foe'))
            applyStatus(p, c.src, f, 'shock', c.t, c.ev); } };
export const bones: TriggerDef = { id: '망자의 부름', when: 'kill', chance: .2, run: (p, c) => { if (c.target)
        summon(p, c.src, posOf(p, c.target), c.t, c.ev); } };
export function gearTaken(u: Unit): number { return u.gear?.armor?.def === 'ironPlate' && u.ironGuard && u.still >= 2 ? .8 : 1; }
