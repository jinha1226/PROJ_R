const UNITS = ['', 'K', 'M', 'B', 'T'];
/** A count as the screen tells it: whole below a thousand, then 1.2K, 34.5M … (an incremental's numbers outgrow their digits). */
export function big(n: number): string {
  let v = Math.max(0, Math.floor(n)), u = 0;
  if (v < 1000) return String(v);
  let x = v;
  while (x >= 1000 && u < UNITS.length - 1) { x /= 1000; u++; }
  v = Math.floor(x * 10) / 10;
  return `${v >= 100 ? Math.floor(v) : v.toFixed(1)}${UNITS[u]}`;
}
