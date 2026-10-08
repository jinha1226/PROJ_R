import { expect, it } from 'vitest';
import { newSurface } from '../../src/sim/overworld/worldSim';
import { podPanelHtml, labPanelHtml, quartersPanelHtml, workshopPanelHtml, panelAt } from '../../src/ui/overworld/basePanels';
import { unitOf } from '../../src/sim/party/partyCore';
import { place } from '../../src/sim/base/buildings';
import { moduleOf, repairModule } from '../../src/sim/base/modules';
import { BODY_COST, print } from '../../src/sim/roam/roam';

it('the pod panel lists the clones at the base with a send button (greyed for the injured) and the start floors', () => {
  const p = newSurface(4); p.drillLevel = 1;
  let html = podPanelHtml(p, 1);
  expect(html).toContain('data-send="hero"'); expect(html).toContain('data-floor="3"'); expect(html).toContain('▼ 지하로');
  print(p, undefined, [], p.s.map.start); unitOf(p, 'hero')!.injured = true;
  html = podPanelHtml(p, 1);
  expect(html).toMatch(/data-send="hero"[^>]*disabled/); expect(html).toContain('부상');
});

it('the lab panel prints a body when there is bio-matter and a bed, implants carried souls, and offers its medical bay; broken, only its repair', () => {
  const p = newSurface(4);
  expect(labPanelHtml(p)).toMatch(/data-print[^>]*disabled/);
  p.bio = BODY_COST; p.carried = [{ cls: 'mage' }];
  const html = labPanelHtml(p);
  expect(html).not.toMatch(/data-print[^>]*disabled/);
  expect(html).toContain('data-implant="hero:0"'); expect(html).toContain('data-up="medical"'); expect(html).toContain('data-move');
  const lab = moduleOf(p, 'lab')!; lab.hp = 0; lab.broken = true;
  const off = labPanelHtml(p);
  expect(off).toContain('고장'); expect(off).toContain('data-fix'); expect(off).not.toContain('data-print');
});

it('the quarters panel counts the clones against the beds and offers another; the workshop is broken until mended, then opens the bench and its steps', () => {
  const p = newSurface(4); p.ore = 300;
  expect(quartersPanelHtml(p)).toContain('클론 1/2'); expect(quartersPanelHtml(p)).toContain('data-up="beds"');
  expect(workshopPanelHtml(p)).toContain('고장'); expect(workshopPanelHtml(p)).not.toContain('data-bench');
  expect(repairModule(p, 'workshop')).toBe(true); expect(p.ore).toBe(260);
  const html = workshopPanelHtml(p);
  expect(html).toContain('data-bench'); expect(html).toContain('data-up="stock"'); expect(html).toContain('바리케이드 24 → 32'); expect(html).toContain('data-up="salvage"');
});

it('a tap on the core or a module finds its panel; a barricade or bare ground none', () => {
  const p = newSurface(4);
  expect(panelAt(p, p.drill!)?.kind).toBe('pod');
  expect(panelAt(p, { x: p.cloner!.x + 1, y: p.cloner!.y + 1 })?.kind).toBe('lab');
  expect(panelAt(p, moduleOf(p, 'quarters')!.at)?.kind).toBe('quarters'); expect(panelAt(p, moduleOf(p, 'workshop')!.at)?.kind).toBe('workshop');
  const at = { x: p.base.x + 4, y: p.base.y + 3 };
  expect(place(p, at)).toBe(true);
  expect(panelAt(p, at)).toBeNull();
  expect(panelAt(p, { x: 1, y: 1 })).toBeNull();
});

it('the core panel offers its repair when hurt, the lift\'s next step and its gathering; no ship support', () => {
  const p = newSurface(4); p.ore = 300; p.crystal = 40; p.podHp = 120;
  const pod = podPanelHtml(p, 1);
  expect(pod).toContain('체력 120/600'); expect(pod).toContain('data-podrepair'); expect(pod).toContain('data-drill'); expect(pod).toContain('data-up="gather"'); expect(pod).not.toContain('data-unlock');
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

it('the base keys: a trip down, barricades, posts — the tool in hand lit; the tool tells what it does; the ground names the modules', async () => {
  const { baseMenuHtml } = await import('../../src/ui/overworld/baseMenu');
  const { toolHint, baseLabels } = await import('../../src/ui/overworld/baseTools');
  const html = baseMenuHtml('wall');
  for (const k of ['pod', 'wall', 'post']) expect(html).toContain(`data-menu="${k}"`);
  expect(html).toMatch(/data-menu="wall" class="on"/); expect(baseMenuHtml(null)).not.toContain('class="on"');
  const p = newSurface(4);
  expect(toolHint(p, 'wall', null)).toContain('바리케이드 0/24'); expect(toolHint(p, 'move', null, 'quarters')).toContain('숙소');
  expect(baseLabels(p, null).map((l) => l.text)).toEqual(['연구실', '숙소', '작업장 · 고장']); expect(toolHint(p, 'post', 'hero')).toContain('MODEL 0'); expect(toolHint(p, null, null)).toBe('');
});
