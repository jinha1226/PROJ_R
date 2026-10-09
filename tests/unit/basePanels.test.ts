import { expect, it } from 'vitest';
import { newSurface } from '../../src/sim/overworld/worldSim';
import { labPanelHtml, quartersPanelHtml, workshopPanelHtml, panelAt } from '../../src/ui/overworld/basePanels';
import { entOf, unitOf } from '../../src/sim/party/partyCore';
import { moduleOf, repairModule } from '../../src/sim/base/modules';
import { hitDome } from '../../src/sim/base/siege';
import { BODY_COST, print } from '../../src/sim/roam/roam';

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
  expect(quartersPanelHtml(p)).toContain('클론 1/2'); expect(quartersPanelHtml(p)).toContain('data-up="beds"'); expect(quartersPanelHtml(p)).toContain('data-up="gather"');
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

it('the clones\' row: a tile each with its health and ultimates — a cooldown counts down, the aimed one is lit, a fallen clone is dimmed and tells when it rises; Auto at its end', async () => {
  const { cloneRowHtml, rowKeysHtml } = await import('../../src/ui/overworld/abilityBar');
  const p = newSurface(4), other = print(p, undefined, [], p.s.map.start)!;
  let row = cloneRowHtml(p, { id: 'hero', slot: 0 });
  expect(row).toMatch(/data-clone="hero"/); expect(row).toMatch(/data-ult="hero:0" class="on"/); expect(row).toContain('중력탄');
  expect(rowKeysHtml(p)).toMatch(/data-auto class="ub-auto">자동/); expect(rowKeysHtml(p)).toMatch(/data-tree class="ub-auto ub-tree">강화/);
  p.shards = 50; expect(rowKeysHtml(p)).toContain('ub-tree can'); p.shards = 0;
  unitOf(p, 'hero')!.ultReady = p.time + 7; entOf(p, other.id)!.alive = false; unitOf(p, other.id)!.downAt = p.time; p.siege!.auto = true;
  row = cloneRowHtml(p, null);
  expect(row).toMatch(/data-ult="hero:0" class="" disabled/); expect(row).toContain('<em>7</em>');
  expect(row).toContain('ub-clone down'); expect(row).toContain('쓰러짐 12초'); expect(rowKeysHtml(p)).toMatch(/data-auto class="ub-auto on"/);
});

it('the floors under the base: the lift\'s stops and its next one with its price, how deep anyone has been, a kept floor; a tapped stop offers the clones to send, the next stop the shaft\'s price', async () => {
  const { floorRows, destination } = await import('../../src/sim/base/floors');
  const { floorsHtml, floorPopHtml, floorLine } = await import('../../src/ui/overworld/floorSheet');
  const p = newSurface(4);
  let rows = floorRows(p);
  expect(rows).toHaveLength(15);
  // nobody has gone down yet: nothing reached, the lift stops at the first floor, the third is its next stop
  expect(rows.filter((r) => r.reached)).toHaveLength(0); expect(rows.filter((r) => r.stop).map((r) => r.floor)).toEqual([1]);
  expect(rows[2]!.next).toEqual({ ore: 30, crystal: 0 }); expect(rows.filter((r) => r.boss).map((r) => r.floor)).toEqual([5, 10, 15]);
  expect(floorPopHtml(p, rows[2]!, undefined, true)).toMatch(/data-drill disabled/);
  expect(floorLine(rows[0]!, 1, true)).toEqual({ name: 'B1 · 동굴', tag: '▼ 목적지' }); expect(floorLine(rows[5]!, 1, false).name).toBe('B6 · ???'); expect(floorLine(rows[2]!, 1, true).tag).toBe('연장 가능');
  p.trips = 2; p.deepest = 6; p.drillLevel = 2; p.ore = 500; p.crystal = 50;
  rows = floorRows(p);
  expect(rows.filter((r) => r.reached).map((r) => r.floor)).toEqual([1, 2, 3, 4, 5, 6]); expect(rows.filter((r) => r.passed).map((r) => r.floor)).toEqual([1, 2, 3, 4, 5]);
  expect(rows.filter((r) => r.stop).map((r) => r.floor)).toEqual([1, 3, 5]);
  expect(rows[7]!.next).toEqual({ ore: 100, crystal: 15 }); expect(floorPopHtml(p, rows[7]!, undefined, true)).toMatch(/data-drill >승강기 연장 · 광석 100 · 마정석 15/);
  expect(floorLine(rows[4]!, 5, true).tag).toBe('▼ 목적지'); expect(floorLine(rows[9]!, 5, true).tag).toBe('');
  // the deepest stop unless another is chosen; a kept floor comes before either
  expect(destination(p, undefined, 0)).toBe(5); expect(destination(p, undefined, 3)).toBe(3); expect(destination(p, undefined, 4)).toBe(5); expect(destination(p, 7, 3)).toBe(7);
  expect(floorsHtml(p, undefined, 3, 0, true)).toMatch(/class="fl-row stop sel" data-floor="3"/); expect(floorsHtml(p, undefined, 3, 0, true)).not.toContain('fl-pop');
  expect(floorsHtml(p, undefined, 3, 3, true)).toMatch(/fl-pop"><span>보내기<\/span><button type="button" data-send="hero" >/);
  expect(floorPopHtml(p, rows[2]!, undefined, false)).toMatch(/data-send="hero" disabled/); expect(floorPopHtml(p, rows[1]!, undefined, true)).toBe('');
  const kept = floorRows(p, 7);
  expect(kept[6]!.kept).toBe(true); expect(kept[6]!.reached).toBe(true);
  expect(floorPopHtml(p, kept[6]!, 7, true)).toContain('<span>복귀</span>'); expect(floorPopHtml(p, kept[2]!, 7, true)).toContain('B7부터');
});

it('the siege\'s lines: quiet, the next wave counted down, the wave out and how many are left, stopped at a broken dome; the best; the dome in cells — or how long until it relights; its events read as short lines; the ground names the modules', async () => {
  const { siegeHtml, siegeNote } = await import('../../src/ui/overworld/siegeBar');
  const { baseLabels } = await import('../../src/ui/overworld/baseTools');
  const p = newSurface(4), s = p.siege!;
  expect(siegeHtml(p)).toContain('조용함'); expect(siegeHtml(p)).not.toContain('최고');
  s.phase = 'gap'; s.wave = 6; s.best = 12; s.nextAt = p.time + 18;
  expect(siegeHtml(p)).toContain('파도 <b>7</b> · <b>5초</b>'); expect(siegeHtml(p)).not.toContain('적 <b>');
  s.phase = 'wave'; s.wave = 7;
  expect(siegeHtml(p)).toContain('파도 <b>7</b>'); expect(siegeHtml(p)).toContain('최고 12'); expect(siegeHtml(p)).toContain('적 <b>0</b>'); expect(siegeHtml(p)).toContain('] 200');
  s.phase = 'held'; s.wave = 6;
  expect(siegeHtml(p)).toContain('파도 <b>7</b> 실패');
  s.phase = 'wave'; s.wave = 7;
  hitDome(p, 150, 'x', p.base, []);
  expect(siegeHtml(p)).toContain('sg-dome low'); expect(siegeHtml(p)).toContain('] 50');
  s.downUntil = p.time + 36;
  expect(siegeHtml(p)).toContain('돔 재가동 <b>10초</b>');
  expect(siegeNote({ t: 0, type: 'buff', text: 'domeBreak', amount: 4 })).toContain('파도 4에서 멈춤');
  expect(siegeNote({ t: 0, type: 'buff', text: 'siegeStart' })).toContain('첫 파도'); expect(siegeNote({ t: 0, type: 'buff', text: 'wave', amount: 3 })).toBeUndefined();
  expect(siegeNote({ t: 0, type: 'buff', text: 'wave', amount: 10 })).toBe('파도 10 · 오우거 2'); expect(siegeNote({ t: 0, type: 'buff', text: 'wave', amount: 20 })).toContain('장군'); expect(siegeNote({ t: 0, type: 'buff', text: 'domeUp' })).toBe('돔 재가동');
  expect(siegeNote({ t: 0, type: 'buff', text: 'gather', amount: 6 })).toContain('광석 6 · 생체 4'); expect(siegeNote({ t: 0, type: 'hit' })).toBeUndefined();
  expect(baseLabels(p).map((l) => l.text)).toEqual(['연구실', '숙소', '작업장 · 고장']);
});

it('the tree\'s map: every node at its own place round the core, joined to the one it grows from, told by its state; the chosen node told in full with the key that buys it; the base\'s first line tells the shards and the readings', async () => {
  const { treeMapHtml, treeDetailHtml, nodeSpot, RINGS } = await import('../../src/ui/overworld/treeWindow');
  const { iconRows } = await import('../../src/ui/overworld/treeIcons');
  const { TREE, nodeOf } = await import('../../src/sim/base/tree');
  const { shardLine, siegeNote, startKey } = await import('../../src/ui/overworld/siegeBar');
  const { big } = await import('../../src/ui/overworld/bigNum');
  const p = newSurface(4);
  // no two nodes on one spot, none on the core; each on its ring; every icon twelve rows of twelve
  const spots = TREE.map((n) => nodeSpot(n));
  expect(new Set(spots.map((c) => `${c.x},${c.y}`)).size).toBe(27);
  for (const [i, n] of TREE.entries()) { expect(Math.abs(Math.hypot(spots[i]!.x, spots[i]!.y) - RINGS[n.at[0]]!)).toBeLessThan(1); for (const [j, o] of spots.entries()) if (j > i) expect(Math.hypot(o.x - spots[i]!.x, o.y - spots[i]!.y)).toBeGreaterThan(50); }
  for (const id of [...TREE.map((n) => n.id), 'core' as const]) { expect(iconRows(id)).toHaveLength(12); expect(iconRows(id).every((r) => r.length === 12 && /^[.#]+$/.test(r))).toBe(true); }
  let map = treeMapHtml(p, null);
  expect(map.match(/data-node="/g)).toHaveLength(27); expect(map.match(/class="tr-link /g)).toHaveLength(27); expect(map).toContain('tr-core');
  expect(map).toMatch(/class="tr-node open" data-node="domeHp"/); expect(map.match(/class="tr-branch"/g)).toHaveLength(5); expect(map).toContain('>자동화</span>'); expect(map).toContain('<i>◆ 10</i>'); expect(map).toMatch(/class="tr-node shut" data-node="thorns"/);
  expect(treeDetailHtml(p, null)).toContain('노드를 눌러');
  expect(treeDetailHtml(p, 'domeHp')).toContain('<h3>돔 강도<small>Lv 0</small></h3>'); expect(treeDetailHtml(p, 'domeHp')).toMatch(/data-buy="domeHp" disabled><b>◆ 10<\/b>파편 부족/);
  expect(treeDetailHtml(p, 'thorns')).toContain('<b>잠김</b>돔 강도 3단계 필요'); expect(treeDetailHtml(p, 'thorns')).not.toContain('data-buy');
  p.shards = 2500; p.tree = { domeHp: 3, thorns: 5, grace: 1 };
  map = treeMapHtml(p, 'thorns');
  expect(map).toMatch(/class="tr-node own" data-node="domeHp"[^>]*>.*?<em>▲<\/em><i>Lv 3<\/i>/); expect(map).not.toMatch(/data-node="thorns"[^>]*>(?:(?!<\/button>).)*<em>/); expect(map).toMatch(/class="tr-node own sel" data-node="thorns"/); expect(map).toContain('<i>최대</i>');
  expect(map).toMatch(/class="tr-node can" data-node="gun"/); expect(map).toMatch(new RegExp(`class="tr-link own"[^>]*x2="${nodeSpot(nodeOf('domeHp')).x}"`));
  expect(treeDetailHtml(p, 'domeHp')).toContain('강도 <b>+40%</b> → <b>+57%</b>'); expect(treeDetailHtml(p, 'domeHp')).toMatch(/data-buy="domeHp" ><b>◆ 20<\/b>한 단계 사기/);
  expect(treeDetailHtml(p, 'thorns')).toContain('Lv 5 / 5'); expect(treeDetailHtml(p, 'thorns')).toContain('<b>최대</b>'); expect(treeDetailHtml(p, 'grace')).toContain('<small>보유</small>');
  expect(treeDetailHtml(p, 'gun')).toMatch(/data-buy="gun" ><b>◆ 30<\/b>사기/);
  p.siege!.income = 12 / 3.6; p.siege!.dps = 1500 / 3.6;
  expect(shardLine(p)).toContain('◆ <b>2.5K</b>'); expect(shardLine(p)).toContain('+12/초'); expect(shardLine(p)).toContain('피해 <b>1.5K</b>/초');
  expect([big(0), big(999.9), big(1000), big(12345), big(123456), big(2.5e6), big(7e9)]).toEqual(['0', '999', '1.0K', '12.3K', '123K', '2.5M', '7.0B']);
  expect(siegeNote({ t: 0, type: 'buff', text: 'waveClear:12', amount: 340 })).toBe('파도 12 클리어 · 파편 +340'); expect(siegeNote({ t: 0, type: 'buff', text: 'waveClear:12:clean', amount: 340 })).toBe('파도 12 무피해 클리어 · 파편 +340');
  expect(siegeNote({ t: 0, type: 'buff', text: 'awayShards', amount: 1240 })).toBe('부재 중 파편 +1.2K'); expect(siegeNote({ t: 0, type: 'buff', text: 'domeSurge' })).toBe('돔 긴급 충전');
  // the key in the middle of the field
  const s = p.siege!; p.tree = {};
  expect(startKey(p)).toBe('');
  s.phase = 'held'; s.wave = 6; s.heldAt = p.time; expect(startKey(p)).toBe('▶ 파도 7 시작');
  p.tree = { autoRestart: 1 }; expect(startKey(p)).toBe('▶ 파도 7 시작 · 자동 10초');
  s.phase = 'gap'; s.nextAt = p.time + 18; expect(startKey(p)).toBe('');
  p.tree = { earlyCall: 1 }; expect(startKey(p)).toContain('지금 부르기');
  // the dome's line: an overcharged dome shows what it holds past full
  p.tree = { overcharge: 1 }; s.phase = 'wave'; s.domeHp = 215;
  const { siegeHtml } = await import('../../src/ui/overworld/siegeBar');
  expect(siegeHtml(p)).toContain('] 200<b class="sg-over">+15</b>');
});
