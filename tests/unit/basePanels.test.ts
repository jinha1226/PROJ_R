import { expect, it } from 'vitest';
import { newSurface } from '../../src/sim/overworld/worldSim';
import { podPanelHtml, labPanelHtml, quartersPanelHtml, workshopPanelHtml, panelAt } from '../../src/ui/overworld/basePanels';
import { entOf, unitOf } from '../../src/sim/party/partyCore';
import { moduleOf, repairModule } from '../../src/sim/base/modules';
import { hitDome } from '../../src/sim/base/siege';
import { BODY_COST, print } from '../../src/sim/roam/roam';

it('the core panel lists the clones at the base with a send button, the start floors, the lift\'s next step and its gathering', () => {
  const p = newSurface(4); p.drillLevel = 1; p.ore = 300; p.crystal = 40;
  const html = podPanelHtml(p, 1);
  expect(html).toContain('data-send="hero"'); expect(html).toContain('data-floor="3"'); expect(html).toContain('▼ 지하로');
  expect(html).not.toMatch(/data-send="hero"[^>]*disabled/);
  expect(html).toContain('data-drill'); expect(html).toContain('data-up="gather"'); expect(html).not.toContain('data-podrepair');
  p.ore = 0;
  expect(podPanelHtml(p, 1)).toMatch(/data-drill[^>]*disabled/);
});

it('the lab panel prints a body when there is bio-matter and a bed, implants carried souls, and offers its medical bay', () => {
  const p = newSurface(4);
  expect(labPanelHtml(p)).toMatch(/data-print[^>]*disabled/);
  p.bio = BODY_COST; p.carried = [{ cls: 'mage' }];
  const html = labPanelHtml(p);
  expect(html).not.toMatch(/data-print[^>]*disabled/);
  expect(html).toContain('data-implant="hero:0"'); expect(html).toContain('data-up="medical"'); expect(html).not.toContain('data-move');
});

it('the quarters panel counts the clones against the beds and offers another; the workshop is broken until mended, then opens the bench and its salvage step', () => {
  const p = newSurface(4); p.ore = 300;
  expect(quartersPanelHtml(p)).toContain('클론 1/2'); expect(quartersPanelHtml(p)).toContain('data-up="beds"');
  expect(workshopPanelHtml(p)).toContain('고장'); expect(workshopPanelHtml(p)).toContain('data-fix'); expect(workshopPanelHtml(p)).not.toContain('data-bench');
  expect(repairModule(p, 'workshop')).toBe(true); expect(p.ore).toBe(260);
  const html = workshopPanelHtml(p);
  expect(html).toContain('data-bench'); expect(html).toContain('data-up="salvage"'); expect(html).not.toContain('data-fix');
});

it('a tap on the core or a module finds its panel; bare ground none', () => {
  const p = newSurface(4);
  expect(panelAt(p, p.drill!)?.kind).toBe('pod');
  expect(panelAt(p, { x: p.cloner!.x + 1, y: p.cloner!.y + 1 })?.kind).toBe('lab');
  expect(panelAt(p, moduleOf(p, 'quarters')!.at)?.kind).toBe('quarters'); expect(panelAt(p, moduleOf(p, 'workshop')!.at)?.kind).toBe('workshop');
  expect(panelAt(p, { x: p.base.x + 3, y: p.base.y + 4 })).toBeNull(); expect(panelAt(p, { x: 1, y: 1 })).toBeNull();
});

it('the base\'s bar groups each clone with its health and ultimates — a cooldown counts down, the aimed one is lit, a fallen clone is dimmed — then the keys: down, Auto, speed, pause', async () => {
  const { ultBarHtml } = await import('../../src/ui/overworld/abilityBar');
  const p = newSurface(4), other = print(p, undefined, [], p.s.map.start)!;
  let html = ultBarHtml(p, { id: 'hero', slot: 0 }, 2);
  expect(html).toMatch(/data-ult="hero:0" class="on"/); expect(html).toContain('중력탄'); expect(html).toMatch(/data-speed="2" class="on"/);
  expect(html).toContain('data-go'); expect(html).toMatch(/data-auto class=""/);
  unitOf(p, 'hero')!.ultReady = p.time + 7; entOf(p, other.id)!.alive = false; p.siege!.auto = true;
  html = ultBarHtml(p, null, 1, true);
  expect(html).toMatch(/data-ult="hero:0" class="" disabled/); expect(html).toContain('<em>7</em>');
  expect(html).toContain('ub-clone down'); expect(html).toContain('쓰러짐'); expect(html).toContain('재개'); expect(html).toMatch(/data-auto class="on"/);
});

it('the siege\'s lines: the wave and the best, how many are out, the dome in cells — or how long until it relights; its events read as short lines; the ground names the modules', async () => {
  const { siegeHtml, siegeNote } = await import('../../src/ui/overworld/siegeBar');
  const { baseLabels } = await import('../../src/ui/overworld/baseTools');
  const p = newSurface(4), s = p.siege!;
  s.wave = 7; s.best = 12;
  expect(siegeHtml(p)).toContain('파도 <b>7</b>'); expect(siegeHtml(p)).toContain('최고 12'); expect(siegeHtml(p)).toContain('] 200');
  hitDome(p, 150, 'x', p.base, []);
  expect(siegeHtml(p)).toContain('sg-dome low'); expect(siegeHtml(p)).toContain('] 50');
  s.downUntil = p.time + 36;
  expect(siegeHtml(p)).toContain('돔 재가동 <b>10초</b>');
  expect(siegeNote({ t: 0, type: 'buff', text: 'domeBreak', amount: 4 })).toContain('파도 4부터'); expect(siegeNote({ t: 0, type: 'buff', text: 'domeUp' })).toBe('돔 재가동');
  expect(siegeNote({ t: 0, type: 'buff', text: 'gather', amount: 6 })).toContain('광석 6 · 생체 4'); expect(siegeNote({ t: 0, type: 'hit' })).toBeUndefined();
  expect(baseLabels(p).map((l) => l.text)).toEqual(['연구실', '숙소', '작업장 · 고장']);
});
