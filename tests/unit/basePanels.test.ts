import { expect, it } from 'vitest';
import { newSurface } from '../../src/sim/overworld/worldSim';
import { podPanelHtml, labPanelHtml, defencePanelHtml, panelAt } from '../../src/ui/overworld/basePanels';
import { unitOf } from '../../src/sim/party/partyCore';
import { place } from '../../src/sim/base/buildings';
import { BODY_COST, print } from '../../src/sim/roam/roam';

it('the pod panel lists the clones at the base with a send button (greyed for the injured) and the start floors', () => {
  const p = newSurface(4); p.drillLevel = 1;
  let html = podPanelHtml(p, 1);
  expect(html).toContain('data-send="hero"'); expect(html).toContain('data-floor="3"'); expect(html).toContain('▼ 지하로');
  print(p, undefined, [], p.s.map.start); unitOf(p, 'hero')!.injured = true;
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

it('a defence’s panel offers its next level and, when hurt, a repair; the pod’s offers its repair and the ship’s support', async () => {
  const { breakBuilding, canPlace } = await import('../../src/sim/base/buildings');
  const p = newSurface(4); p.ore = 300; p.crystal = 40;
  let at = { x: 0, y: 0 };
  for (let dy = -6; dy <= 6; dy++) for (let dx = -6; dx <= 6; dx++) if (!at.x && canPlace(p, 'watchtower', { x: p.base.x + dx, y: p.base.y + dy })) at = { x: p.base.x + dx, y: p.base.y + dy };
  place(p, 'watchtower', at);
  const b = p.buildings[0]!;
  expect(defencePanelHtml(p, b.id)).toContain('data-upgrade'); expect(defencePanelHtml(p, b.id)).not.toContain('data-repair');
  breakBuilding(p, b);
  expect(defencePanelHtml(p, b.id)).toContain('data-repair'); expect(defencePanelHtml(p, b.id)).toContain('파손');
  p.podHp = 120;
  const pod = podPanelHtml(p, 1);
  expect(pod).toContain('data-podrepair'); expect(pod).toContain('data-unlock="strike"'); expect(pod).toContain('data-unlock="laser"');
});

it('opened ship support sits at the end of the ultimate bar with its cooldown', async () => {
  const { ultBarHtml } = await import('../../src/ui/overworld/raidControl');
  const p = newSurface(4); p.support = { strike: true, strikeReady: p.time + 5 };
  const html = ultBarHtml(p, null, 1);
  expect(html).toContain('data-sup="strike"'); expect(html).toContain('궤도 포격'); expect(html).not.toContain('data-sup="laser"');
});
