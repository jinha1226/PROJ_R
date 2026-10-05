import { it } from 'vitest';
import { GridSim } from '../../src/sim/grid/gridSim';
import { Playback } from '../../src/view/grid/playback';
import { FEELS, setFeel } from '../../src/view/grid/feel';
import { SCENES, showcaseState } from '../../src/ui/grid/chainShowcase';

/** How long the showcase plays in each tempo at 60 fps, with slow motion and hit-stops as the view applies them. */
it('showcase tempo', () => {
  for (const sc of SCENES) for (const k of ['classic', 'kata'] as const) {
    setFeel(k);
    const f = FEELS[k];
    const s = showcaseState(sc.seed, sc.suit, sc.foes, undefined, sc.hand);
    s.hero.fx.free = true;
    const sim = GridSim.fromState(s);
    const pb = new Playback();
    let time = 0, slowLeft = 0, slowScale = 1, stop = 0;
    const beats: string[] = [];
    let links = 0;
    for (const [i, a] of sc.plan.entries()) {
      const t0 = sim.s.hero.nextAt;
      pb.push(sim.act(a), t0);
      while (pb.busy) {
        const dt = 1 / 60;
        time += dt;
        const scale = slowLeft > 0 ? slowScale : 1;
        slowLeft = Math.max(0, slowLeft - dt);
        if (stop > 0) { stop -= dt; continue; }
        for (const e of pb.update(dt * scale)) {
          if (e.type === 'engrave' && f.engraveSlow) { slowLeft = Math.max(slowLeft, f.engraveSlow[0]); slowScale = f.engraveSlow[1]; }
          if (e.type === 'chain' && f.chainSlow) { slowLeft = Math.max(slowLeft, f.chainSlow[0]); slowScale = f.chainSlow[1]; }
          if (e.type === 'engrave') links++;
          if (e.type === 'hit') stop = Math.max(stop, f.hitStop);
          if (e.type === 'die') stop = Math.max(stop, f.killStop);
          if (e.type === 'die' || (e.type === 'move' && e.text === 'dash')) beats.push(`${time.toFixed(2)}${e.type === 'die' ? 'K' : 'D'}`);
        }
      }
      time += k === 'kata' ? 0.14 : 0.09;
      if (i === sc.plan.length - 1) break;
    }
    console.log(sc.id, k, 'total', time.toFixed(2), 's  links', links, ' ', beats.join(' '));
  }
});
