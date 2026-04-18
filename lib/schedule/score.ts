import type { PeriodPlan, ScheduleInput, ScoreBreakdown } from "./types";
import { computePlayerMinutes, computePlayerMinutesByPosition } from "./validate";

const W1 = 200;
const W2 = 40;
const W3 = 10;
const W4 = 5;

export function scoreSchedule(
  periods: PeriodPlan[],
  input: ScheduleInput
): { total: number; breakdown: ScoreBreakdown; perPlayerMinutes: Record<number, number> } {
  const minutes = computePlayerMinutes(periods, input);
  const minutesByPosition = computePlayerMinutesByPosition(periods, input);

  const values = input.players.map((p) => minutes[p.id] ?? 0);
  const mean = values.reduce((a, b) => a + b, 0) / Math.max(1, values.length);
  const variance =
    values.reduce((sum, v) => sum + (v - mean) ** 2, 0) / Math.max(1, values.length);
  const stddev = Math.sqrt(variance);
  const minutesFairness = mean === 0 ? 0 : Math.max(0, 1 - stddev / mean);

  let prefNumerator = 0;
  let prefDenominator = 0;
  let varietyCount = 0;
  for (const p of input.players) {
    const byPos = minutesByPosition[p.id] ?? {};
    const total = Object.values(byPos).reduce((a, b) => a + b, 0);
    prefDenominator += total;
    for (const [posIdStr, mins] of Object.entries(byPos)) {
      const posId = Number(posIdStr);
      if (p.preferredPositionIds.includes(posId)) prefNumerator += mins;
    }
    const distinct = Object.keys(byPos).filter((k) => (byPos[Number(k)] ?? 0) > 0).length;
    if (distinct > 1) varietyCount += 1;
  }
  const preferencesMet = prefDenominator === 0 ? 0 : prefNumerator / prefDenominator;

  let chainSubPenalty = 0;
  for (const period of periods) {
    for (const sp of period.subPoints) {
      const involved = new Set<number>();
      for (const ch of sp.changes) {
        involved.add(ch.outPlayerId);
        involved.add(ch.inPlayerId);
      }
      if (involved.size >= 3 && sp.changes.length >= 2) chainSubPenalty += 1;
    }
  }

  const breakdown: ScoreBreakdown = {
    minutesFairness,
    preferencesMet,
    positionVariety: varietyCount,
    chainSubPenalty,
  };

  const total =
    W1 * minutesFairness +
    W2 * preferencesMet +
    W3 * varietyCount -
    W4 * chainSubPenalty;

  return { total, breakdown, perPlayerMinutes: minutes };
}
