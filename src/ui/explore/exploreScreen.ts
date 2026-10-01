import type { Screen } from '../../app/router';
import { Input } from '../../app/input/input';
import { DOOR_POS } from '../../sim/explore/generate';
import { ROOM_PITCH } from '../../sim/explore/space';
import type { Dir } from '../../sim/explore/types';
import type { RunState } from '../../sim/run/types';
import { actorFromSetup } from '../../view/actors/actorFactory';
import type { Actor } from '../../view/actors/actor';
import type { AssetLibrary } from '../../view/actors/assets';
import { DungeonView } from '../../view/explore/dungeonView';
import type { EnvLibrary } from '../../view/explore/envAssets';
import { IsoCamera } from '../../view/explore/exploreCamera';
import { Explorer } from '../../view/explore/explorer';
import { iconBadge } from '../../view/overlay/icons';
import { addLighting } from '../../view/scene/lighting';
import { createScene, type SceneHandle } from '../../view/scene/renderer';
import { mercToUnitSetup } from '../../sim/roster/toSetup';
import { guardFrame } from '../screens/loopGuard';
import { t } from '../i18n/ko';
import '../styles/explore.css';

export interface ExploreApi {
  run(): RunState;
  lib: AssetLibrary;
  env: EnvLibrary;
  /** the leader crossed into roomId; return false to keep them out */
  enterRoom(roomId: string): boolean;
  interact(type: string): void;
  leave(): void;
  fatal(e: unknown): void;
}

const THEME_NAME: Record<string, string> = { forest: '숲', dungeon: '던전', graveyard: '묘지' };

export class ExploreScreen implements Screen {
  private el = document.createElement('div');
  private h: SceneHandle | null = null;
  private view: DungeonView | null = null;
  private explorer: Explorer | null = null;
  private actors: Actor[] = [];
  private input = new Input();
  private detach: (() => void) | null = null;
  private raf = 0;
  private leaveArmed = false;
  private gone = false;

  constructor(private readonly api: ExploreApi) {}

  mount(root: HTMLElement): void {
    this.el.className = 'screen explore';
    this.el.innerHTML = `<div class="explore-stage"></div><div class="explore-hud"></div><div class="explore-prompt" hidden></div>`;
    root.appendChild(this.el);
    const run = this.api.run();
    const e = run.exploration!;
    try {
      this.h = createScene(this.el.querySelector('.explore-stage')!);
    } catch (err) {
      return this.api.fatal(err);
    }
    addLighting(this.h.scene);
    this.h.scene.fog = null;
    this.view = new DungeonView(this.h.scene, e, this.api.env);
    const mercs = e.party.map((id) => run.roster.mercs.find((m) => m.id === id)).filter((m): m is NonNullable<typeof m> => !!m);
    this.actors = mercs.map((m, i) => { const a = actorFromSetup(mercToUnitSetup(m, i, { col: 2, row: 1 }), this.api.lib); this.h!.scene.add(a.root); return a; });
    const cam = new IsoCamera(this.h.camera);
    this.explorer = new Explorer(e, this.actors[0]!, this.actors.slice(1), cam, { enterRoom: (id) => this.api.enterRoom(id) });
    this.detach = this.input.attach(window);
    this.el.addEventListener('click', (ev) => {
      if ((ev.target as HTMLElement).closest('[data-act="leave"]')) this.api.leave();
    });
    (window as unknown as { __PROJR_EXPLORE__: unknown }).__PROJR_EXPLORE__ = {
      room: () => this.api.run().exploration?.at,
      /** debug/e2e: step the leader through the door toward an adjacent room */
      walkTo: (roomId: string) => {
        const ex = this.api.run().exploration!;
        const here = ex.rooms[ex.at]!;
        const dir = (Object.keys(here.doors) as Dir[]).find((d) => here.doors[d] === roomId);
        if (!dir || !this.explorer) return false;
        const d = DOOR_POS[dir];
        this.explorer.pos = { x: here.gx * ROOM_PITCH.x + d.x * 1.12, z: here.gy * ROOM_PITCH.z + d.y * 1.2 };
        return this.api.enterRoom(roomId);
      },
    };
    this.renderHud();
    let last = performance.now();
    const loop = (now: number) => {
      const dt = Math.min(0.1, (now - last) / 1000);
      last = now;
      // a frame may route away (exit, event, 귀환); never schedule past unmount
      if (guardFrame(() => this.frame(dt, cam), (err) => this.api.fatal(err)) && !this.gone) this.raf = requestAnimationFrame(loop);
    };
    this.raf = requestAnimationFrame(loop);
  }

  /** Called by the flow after the run's exploration changed (room cleared, chest opened). */
  refresh(snap = false): void {
    const e = this.api.run().exploration;
    if (!e || !this.view || !this.explorer) return;
    this.view.update(e);
    this.explorer.setExploration(e, snap);
    this.renderHud();
  }

  private frame(dt: number, cam: IsoCamera): void {
    const s = this.input.poll();
    if (s.rotateL) cam.rotateStep(-1);
    if (s.rotateR) cam.rotateStep(1);
    this.explorer!.update(dt, s);
    this.view!.tick(dt);
    const near = this.explorer!.nearby();
    const prompt = this.el.querySelector<HTMLElement>('.explore-prompt')!;
    prompt.hidden = !near;
    if (near) prompt.innerHTML = `${iconBadge(`room:${near}` as 'room:chest', 22)} <b>E</b> / Ⓐ ${t(`explore.act.${near}`)}`;
    if (near && s.interact) {
      this.api.interact(near);
      if (this.gone) return;
    }
    if (s.cancel && !near) {
      // first Esc/B arms 귀환, the second confirms it (pad players have no mouse)
      if (this.leaveArmed) return this.api.leave();
      this.leaveArmed = true;
      this.renderHud(true);
    }
    this.h!.renderer.render(this.h!.scene, this.h!.camera);
  }

  private renderHud(confirmLeave = false): void {
    const run = this.api.run();
    const e = run.exploration;
    if (!e) return;
    const cells = Object.values(e.rooms).map((r) => {
      const seen = e.visited.includes(r.id) || e.visited.some((v) => Object.values(e.rooms[v]!.doors).includes(r.id));
      const cls = r.id === e.at ? 'here' : e.visited.includes(r.id) ? 'done' : seen ? 'seen' : 'hidden';
      return `<div class="mm ${cls}" style="grid-column:${r.gx + 1};grid-row:${r.gy + 1}">${seen ? iconBadge(`room:${r.type}`, 14) : ''}</div>`;
    }).join('');
    this.el.querySelector('.explore-hud')!.innerHTML = `<div class="ex-title"><b>${THEME_NAME[e.theme]}</b> ${'★'.repeat(e.stars)} · ${run.week}주차 · 골드 ${run.gold}</div>
      <div class="minimap">${cells}</div>
      <div class="ex-help muted">WASD/스틱 이동 · E/Ⓐ 상호작용 · Z X/LB RB 카메라 회전</div>
      <button class="btn ${confirmLeave ? 'primary' : ''}" data-act="leave" data-testid="leave-explore">귀환 (보상 유지)</button>`;
  }

  unmount(): void {
    this.gone = true;
    cancelAnimationFrame(this.raf);
    this.detach?.();
    for (const a of this.actors) a.dispose();
    this.view?.dispose();
    this.h?.dispose();
    delete (window as unknown as { __PROJR_EXPLORE__?: unknown }).__PROJR_EXPLORE__;
    this.el.remove();
  }
}
