export type TextFn = (rank: number) => string;
/** Last-rank bonus clause, shown only at rank 3. */
export const top = (r: number, text: string): string => (r === 3 ? ` · 3단계: ${text}` : '');
/** Value that steps up by `step` per rank beyond the first. */
export const stepped = (base: number, step: number, r: number): number => base + step * (r - 1);
