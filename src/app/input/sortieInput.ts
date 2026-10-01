/** Camera turn for a sortie frame: on a pad RB is both "rotate" and an order (regroup) — in sorties it is the order. */
export function cameraTurn(s: { rotateL: boolean; rotateR: boolean; ult?: boolean; regroup?: boolean }): -1 | 0 | 1 {
  if (s.rotateR && !s.ult && !s.regroup) return 1;
  if (s.rotateL) return -1;
  return 0;
}
