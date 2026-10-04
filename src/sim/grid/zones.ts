export type ZoneId = 'cave' | 'crypt' | 'ruins';
export interface Zone { id: ZoneId; name: string; first: number; last: number }
export const ZONES: Zone[] = [
  { id: 'cave', name: '동굴', first: 1, last: 5 },
  { id: 'crypt', name: '지하 묘지', first: 6, last: 10 },
  { id: 'ruins', name: '고대 유적', first: 11, last: 15 },
];

/** The zone at this depth, clamped to the run's outer zones. */
export function zoneOf(floor: number): Zone {
  return ZONES.find((z) => floor <= z.last) ?? ZONES[2]!;
}

/** Only the last floor of each zone holds a guardian. */
export const isBossFloor = (floor: number): boolean => floor === 5 || floor === 10 || floor === 15;
export const BOSS_POWER: Record<5 | 10 | 15, number> = { 5: 1, 10: 1.6, 15: 1.8 };
