/** Camera turn for a sortie frame: on a pad RB is both "rotate" and "ultimate" — in sorties it is the ultimate. */
export function cameraTurn(s: { rotateL: boolean; rotateR: boolean; ult: boolean }): -1 | 0 | 1 {
  if (s.rotateR && !s.ult) return 1;
  if (s.rotateL) return -1;
  return 0;
}
