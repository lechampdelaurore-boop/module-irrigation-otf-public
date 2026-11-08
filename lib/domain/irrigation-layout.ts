export const MAX_BEDS_PER_ROW = 33;

export function bedColumns(bedCount: number): number {
  return Math.min(Math.max(Math.trunc(bedCount), 1), MAX_BEDS_PER_ROW);
}

export function bedRowCount(bedCount: number): number {
  if (bedCount <= 0) return 0;
  return Math.ceil(bedCount / MAX_BEDS_PER_ROW);
}
