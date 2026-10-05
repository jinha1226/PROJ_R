import * as THREE from 'three';
import type { GEvent } from '../../sim/grid/types';
import type { GridActors } from './gridActors';
import type { GridParticles } from './gridParticles';
import type { StrikeFx } from './strikeFx';

export type SlashStyle = 'plain' | 'heavy' | 'dash' | 'storm' | 'cull';
export type ShotStyle = 'plain' | 'pierce' | 'ricochet' | 'volley' | 'spin' | 'rapid' | 'execute' | 'relay';

/** an engraving's name shows just before the blow it set off; within this long the blow takes its look */
const RECENT = 0.6;
const SLASH_BY: Record<string, SlashStyle> = { tempest: 'storm', spinShot: 'storm', cull: 'cull', execute: 'cull', fury: 'heavy', finisher: 'heavy', shoulder: 'heavy', wallslam: 'heavy', dash: 'dash', bladeRelay: 'dash' };
const SHOT_BY: Record<string, ShotStyle> = { pierce: 'pierce', rapid: 'rapid', gunRelay: 'relay', bayonet: 'relay', reverseCut: 'relay', sniper: 'pierce', headshot: 'pierce' };

export function slashStyle(e: GEvent, recent: string | null): SlashStyle {
  if (e.text === 'finisher') return 'heavy';
  if (e.text === 'whirl') return 'storm';
  if (e.text && SLASH_BY[e.text]) return SLASH_BY[e.text]!;
  return (recent && SLASH_BY[recent]) || 'plain';
}

export function shotStyle(e: GEvent, recent: string | null): ShotStyle {
  if (e.text === 'ricochet' || e.text === 'chain') return 'ricochet';
  if (e.text === 'volley' || e.text === 'burst') return 'volley';
  if (e.text === 'spin') return 'spin';
  if (e.text === 'execute') return 'execute';
  return (recent && SHOT_BY[recent]) || 'plain';
}

/** Big blows take a part off with the kill. */
export const severs = (style: SlashStyle | ShotStyle | null, crit: boolean): boolean => crit || style === 'heavy' || style === 'cull' || style === 'pierce' || style === 'execute';

/** Gives each blow and shot its own look, remembers what struck last so the kill can cut a part off. */
export class StrikeCues {
  private recent: { text: string; at: number } | null = null;
  private clock = 0;
  /** what last hit each foe, for its death */
  private lastBlow = new Map<string, { kind: 'slash' | 'shot'; style: SlashStyle | ShotStyle; crit: boolean; from: THREE.Vector3 }>();

  constructor(private readonly fx: StrikeFx, private readonly figures: () => GridActors, private readonly particles: GridParticles) {}
  private get actors(): GridActors { return this.figures(); }

  update(dt: number): void { this.clock += dt; }

  private get latest(): string | null { return this.recent && this.clock - this.recent.at < RECENT ? this.recent.text : null; }

  note(e: GEvent): void {
    if (e.type === 'engrave' && e.text) this.recent = { text: e.text, at: this.clock };
    if (e.type === 'hit' && e.dst && e.dst !== 'hero') {
      const prev = this.lastBlow.get(e.dst);
      if (prev) prev.crit = !!e.crit;
    }
  }

  slash(e: GEvent, at: THREE.Vector3, from: THREE.Vector3): void {
    const style = slashStyle(e, this.latest);
    const facing = Math.atan2(at.z - from.z, at.x - from.x);
    if (e.dst) this.lastBlow.set(e.dst, { kind: 'slash', style, crit: false, from: from.clone() });
    if (style === 'heavy') { this.fx.cross(at.x, at.z, facing); this.particles.spray(at, '#ffd76a', 10); }
    else if (style === 'dash') { this.fx.streak(from, at); this.fx.arc(at.x, at.z, facing, { color: '#bfffe8', spread: 1.4 }); }
    else if (style === 'storm') { this.fx.ring(from.x, from.z); this.fx.arc(at.x, at.z, facing, { color: '#9ff5ff' }); }
    else if (style === 'cull') { this.fx.cut(at.x, at.z, facing); this.particles.spray(at, '#ff3a3a', 12); }
    else this.fx.arc(at.x, at.z, facing, { inner: 0.95, outer: 1.12, spread: 1.6 });
  }

  /** The extra look of a hero shot (the tracer itself is drawn by the runtime). */
  shot(e: GEvent, from: THREE.Vector3, at: THREE.Vector3): ShotStyle {
    const style = shotStyle(e, this.latest);
    if (e.dst) this.lastBlow.set(e.dst, { kind: 'shot', style, crit: false, from: from.clone() });
    // a spent case flies from every shot of the hero's own gun
    if (e.src === 'hero' && style !== 'ricochet' && style !== 'volley') this.particles.spray(from.clone().setY(1.1), '#e8c060', 2);
    if (style === 'pierce') this.fx.beam(from, at);
    else if (style === 'ricochet') { this.particles.spray(from.clone().setY(1), '#ffe08a', 10); this.fx.ring(from.x, from.z, '#ffd060', 0.45); }
    else if (style === 'spin') this.fx.ring(from.x, from.z, '#ffe8b0', 0.9);
    else if (style === 'rapid') this.particles.spray(from.clone().setY(1.1), '#e8c060', 4);
    else if (style === 'execute') this.fx.cut(at.x, at.z, Math.atan2(at.z - from.z, at.x - from.x), '#ff5040');
    return style;
  }

  /** A foe falls: a big blow takes its head or an arm with it, and a shot throws the body back. */
  kill(id: string, at: THREE.Vector3): void {
    const blow = this.lastBlow.get(id);
    this.lastBlow.delete(id);
    if (!blow) return;
    const away = at.clone().sub(blow.from);
    if (severs(blow.style, blow.crit)) {
      const part = blow.style === 'cull' || blow.style === 'pierce' || blow.style === 'execute' || blow.crit ? 'head' : (id.charCodeAt(id.length - 1) % 2 ? 'armL' : 'armR');
      const cut = this.actors.sever(id, part);
      if (cut) { this.fx.limb(cut.at, away, cut.color, part === 'head' ? 'head' : 'arm', cut.size); this.particles.blood(cut.at, 22, blow.from); }
    }
    this.actors.fling(id, blow.from, blow.kind === 'shot' ? 0.45 : 0.2);
  }
}
