import { expect, it } from 'vitest';
import { newSurface } from '../../src/sim/overworld/worldSim';
import { podPanelHtml, labPanelHtml, defencePanelHtml, panelAt } from '../../src/ui/overworld/basePanels';
import { unitOf } from '../../src/sim/party/partyCore';
import { place } from '../../src/sim/base/buildings';
import { BODY_COST } from '../../src/sim/roam/roam';

it('the pod panel lists the clones at the base with a send button (greyed for the injured) and the start floors', () => {
  const p = newSurface(4); p.drillLevel = 1;
  let html = podPanelHtml(p, 1);
  expect(html).toContain('data-send="hero"'); expect(html).toContain('data-floor="3"'); expect(html).toContain('▼ 지하로');
  unitOf(p, 'hero')!.injured = true;
  html = podPanelHtml(p, 1);
  expect(html).toMatch(/data-send="hero"[^>]*disabled/); expect(html).toContain('부상');
});

it('the lab panel prints a body when there is bio-matter, implants carried souls and opens the workshop', () => {
  const p = newSurface(4);
  expect(labPanelHtml(p)).toMatch(/data-print[^>]*disabled/);
  p.bio = BODY_COST; p.carried = [{ cls: 'mage' }];
  const html = labPanelHtml(p);
  expect(html).not.toMatch(/data-print[^>]*disabled/);
  expect(html).toContain('data-implant="hero:0"'); expect(html).toContain('data-bench');
});

it('a click on the pod, the lab or a building finds its panel; elsewhere none', () => {
  const p = newSurface(4); p.ore = 100;
  expect(panelAt(p, p.drill!)?.kind).toBe('pod');
  expect(panelAt(p, p.cloner!)?.kind).toBe('lab');
  const at = { x: p.base.x + 4, y: p.base.y + 3 };
  expect(place(p, 'watchtower', at)).toBe(true);
  const hit = panelAt(p, at); expect(hit?.kind).toBe('defence');
  expect(defencePanelHtml(p, hit!.id!)).toContain('60/60');
  expect(panelAt(p, { x: 1, y: 1 })).toBeNull();
});
