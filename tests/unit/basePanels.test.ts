import { expect, it } from 'vitest';
import { newSurface } from '../../src/sim/overworld/worldSim';
import { podPanelHtml, labPanelHtml, panelAt } from '../../src/ui/overworld/basePanels';
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

it('a tap on the core or the lab finds its panel; a barricade or bare ground none', () => {
  const p = newSurface(4);
  expect(panelAt(p, p.drill!)?.kind).toBe('pod');
  expect(panelAt(p, p.cloner!)?.kind).toBe('lab');
  const at = { x: p.base.x + 4, y: p.base.y + 3 };
  expect(place(p, at)).toBe(true);
  expect(panelAt(p, at)).toBeNull();
  expect(panelAt(p, { x: 1, y: 1 })).toBeNull();
});

it('the core panel offers its repair when hurt and the lift\'s next step; no ship support', () => {
  const p = newSurface(4); p.ore = 300; p.crystal = 40; p.podHp = 120;
  const pod = podPanelHtml(p, 1);
  expect(pod).toContain('코어 120/600'); expect(pod).toContain('data-podrepair'); expect(pod).toContain('data-drill'); expect(pod).not.toContain('data-unlock');
  p.ore = 0;
  expect(podPanelHtml(p, 1)).toMatch(/data-drill[^>]*disabled/);
});

it('the ability bar groups each clone with its health and ultimates: a cooldown counts down, the aimed one is lit, a fallen clone is dimmed', async () => {
  const { ultBarHtml } = await import('../../src/ui/overworld/raidControl');
  const { entOf } = await import('../../src/sim/party/partyCore');
  const p = newSurface(4), other = print(p, undefined, [], p.s.map.start)!;
  let html = ultBarHtml(p, { id: 'hero', slot: 0 }, 2);
  expect(html).toMatch(/data-ult="hero:0" class="on"/); expect(html).toContain('중력탄'); expect(html).toMatch(/data-speed="2" class="on"/); expect(html).not.toContain('data-sup');
  unitOf(p, 'hero')!.ultReady = p.time + 7; entOf(p, other.id)!.alive = false;
  html = ultBarHtml(p, null, 1, true);
  expect(html).toMatch(/data-ult="hero:0" class="" disabled/); expect(html).toContain('<em>7</em>');
  expect(html).toContain('ub-clone down'); expect(html).toContain('쓰러짐'); expect(html).toContain('재개');
});

it('the base keys: a trip down, barricades, posts, the lab, the workshop — the tool in hand lit; the tool tells what it does', async () => {
  const { baseMenuHtml } = await import('../../src/ui/overworld/baseMenu');
  const { toolHint } = await import('../../src/ui/overworld/baseTools');
  const html = baseMenuHtml('wall');
  for (const k of ['pod', 'wall', 'post', 'lab', 'bench']) expect(html).toContain(`data-menu="${k}"`);
  expect(html).toMatch(/data-menu="wall" class="on"/); expect(baseMenuHtml(null)).not.toContain('class="on"');
  const p = newSurface(4);
  expect(toolHint(p, 'wall', null)).toContain('바리케이드 0/12'); expect(toolHint(p, 'post', 'hero')).toContain('MODEL 0'); expect(toolHint(p, null, null)).toBe('');
});
