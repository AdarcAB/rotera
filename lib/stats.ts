/**
 * Computes how "fair" a player's time-on-field was for a given match.
 *
 * - 100 = exactly the optimal share (matchlängd × positioner / spelareITruppen)
 * - >100 = played more than their fair share
 * - <100 = played less
 *
 * Implementation: linear ratio, same scale as percentage of fair time.
 */
export function fairScore(
  actualMinutes: number,
  optimalMinutes: number
): number {
  if (optimalMinutes <= 0) return 0;
  return (actualMinutes / optimalMinutes) * 100;
}

export function optimalMinutes(params: {
  minutesPerPeriod: number;
  numPeriods: number;
  playersOnField: number;
  troupSize: number;
}): number {
  const { minutesPerPeriod, numPeriods, playersOnField, troupSize } = params;
  if (troupSize <= 0) return 0;
  return (minutesPerPeriod * numPeriods * playersOnField) / troupSize;
}

export type FairVerdict = "perfect" | "close" | "light" | "heavy";

export function verdictFor(score: number): FairVerdict {
  if (score >= 95 && score <= 105) return "perfect";
  if (score >= 85 && score <= 115) return "close";
  return score < 85 ? "light" : "heavy";
}

export function deltaMinutes(
  actualMinutes: number,
  optimalMinutes: number
): number {
  return Math.round(actualMinutes - optimalMinutes);
}
