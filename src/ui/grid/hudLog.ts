export interface HudLine { text: string; at: number; warn: boolean }
export const LOG_SECONDS = 4;

/** Times are in seconds, independent of turn time. Newest comes first. */
export function visibleLog(lines: readonly HudLine[], now: number): HudLine[] {
  return lines.filter((line) => now - line.at < LOG_SECONDS).slice(0, 3);
}

export function pushLog(lines: readonly HudLine[], text: string, now: number, warn = false): HudLine[] {
  return [{ text, at: now, warn }, ...visibleLog(lines, now)].slice(0, 3);
}
