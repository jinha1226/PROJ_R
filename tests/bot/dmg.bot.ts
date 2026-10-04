import { it } from 'vitest';
import { runBot } from './runBot';
it('damage per floor (god)', () => {
  const rs = Array.from({ length: 15 }, (_, i) => runBot(1000 + i * 7, true));
  for (let f = 0; f < 15; f++) {
    const d = rs.map((r) => r.floorDmg[f] ?? 0), hp = rs.map((r) => r.floorHp[f] ?? 0), a = rs.map((r) => r.floorActions[f] ?? 0);
    const avg = (x: number[]) => x.reduce((p, q) => p + q, 0) / x.length;
    console.log(`f${f + 1}: maxHp ${avg(hp).toFixed(0)} dmg ${avg(d).toFixed(0)} (${(avg(d) / avg(hp)).toFixed(1)}x hp) acts ${avg(a).toFixed(0)}`);
  }
});
