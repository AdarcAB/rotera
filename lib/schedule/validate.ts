import type { PeriodPlan, ScheduleInput } from "./types";

export type ValidationIssue = { kind: string; detail: string };

export function computeFloorCap(input: ScheduleInput): { floor: number; cap: number } {
  const playersOnField = input.formation.positions.length;
  const totalFieldMinutes =
    input.formation.numPeriods * input.formation.minutesPerPeriod * playersOnField;
  const n = input.players.length;
  if (n === 0) return { floor: 0, cap: 0 };
  const target = totalFieldMinutes / n;
  return { floor: Math.max(0, Math.floor(target) - 2), cap: Math.ceil(target) + 2 };
}

export function computePlayerMinutes(
  periods: PeriodPlan[],
  input: ScheduleInput
): Record<number, number> {
  const minutes: Record<number, number> = {};
  for (const p of input.players) minutes[p.id] = 0;
  const mpp = input.formation.minutesPerPeriod;

  for (const period of periods) {
    const lineup = new Map<number, number>();
    for (const slot of period.startLineup) lineup.set(slot.positionId, slot.playerId);

    let lastMinute = 0;
    const sorted = [...period.subPoints].sort((a, b) => a.minuteInPeriod - b.minuteInPeriod);
    for (const sp of sorted) {
      const delta = sp.minuteInPeriod - lastMinute;
      for (const pid of lineup.values()) minutes[pid] = (minutes[pid] ?? 0) + delta;
      for (const ch of sp.changes) lineup.set(ch.positionId, ch.inPlayerId);
      lastMinute = sp.minuteInPeriod;
    }
    const finalDelta = mpp - lastMinute;
    for (const pid of lineup.values()) minutes[pid] = (minutes[pid] ?? 0) + finalDelta;
  }
  return minutes;
}

export type LiveStateLike = {
  adHocSubs?: {
    periodIndex: number;
    minuteInPeriod: number;
    positionId: number;
    outPlayerId: number;
    inPlayerId: number;
  }[];
  completedSubPoints?: {
    periodIndex: number;
    subPointIndex: number;
    appliedPositionIds?: number[];
  }[];
};

/**
 * Like computePlayerMinutesByPosition but folds in actual live-match events:
 * ad-hoc subs (off-schedule) and scheduled subs that were skipped. Gives the
 * true per-position minutes for a finished match, matching actualMinutesPlayed.
 */
export function computeActualMinutesByPosition(
  periods: PeriodPlan[],
  input: ScheduleInput,
  liveState: LiveStateLike | null
): Record<number, Record<number, number>> {
  const result = computePlayerMinutesByPosition(periods, input);
  if (!liveState) return result;

  const mpp = input.formation.minutesPerPeriod;
  const addMin = (pid: number, posId: number, delta: number) => {
    result[pid] = result[pid] ?? {};
    result[pid][posId] = Math.max(0, (result[pid][posId] ?? 0) + delta);
  };

  // Ad-hoc subs: out loses remaining on that position, in gains it.
  for (const sub of liveState.adHocSubs ?? []) {
    const remaining = Math.max(0, mpp - sub.minuteInPeriod);
    addMin(sub.outPlayerId, sub.positionId, -remaining);
    addMin(sub.inPlayerId, sub.positionId, remaining);
  }

  // Skipped scheduled changes: out stayed on field (gains remaining);
  // in never came in (loses remaining it was credited for in the schedule).
  const completed = liveState.completedSubPoints ?? [];
  for (const period of periods) {
    const sortedSubs = [...period.subPoints].sort(
      (a, b) => a.minuteInPeriod - b.minuteInPeriod
    );
    for (let i = 0; i < sortedSubs.length; i++) {
      const sp = sortedSubs[i];
      const completion = completed.find(
        (c) => c.periodIndex === period.index && c.subPointIndex === i
      );
      if (!completion || completion.appliedPositionIds === undefined) continue;
      const applied = new Set(completion.appliedPositionIds);
      for (const c of sp.changes) {
        if (applied.has(c.positionId)) continue;
        const remaining = Math.max(0, mpp - sp.minuteInPeriod);
        addMin(c.outPlayerId, c.positionId, remaining);
        addMin(c.inPlayerId, c.positionId, -remaining);
      }
    }
  }

  // Strip zero-entries for cleaner UI.
  for (const pidStr of Object.keys(result)) {
    const pid = Number(pidStr);
    const byPos = result[pid];
    for (const posIdStr of Object.keys(byPos)) {
      if ((byPos[Number(posIdStr)] ?? 0) <= 0) delete byPos[Number(posIdStr)];
    }
  }

  return result;
}

export function computePlayerMinutesByPosition(
  periods: PeriodPlan[],
  input: ScheduleInput
): Record<number, Record<number, number>> {
  const result: Record<number, Record<number, number>> = {};
  for (const p of input.players) result[p.id] = {};
  const mpp = input.formation.minutesPerPeriod;

  for (const period of periods) {
    const lineup = new Map<number, number>();
    for (const slot of period.startLineup) lineup.set(slot.positionId, slot.playerId);
    let lastMinute = 0;
    const sorted = [...period.subPoints].sort((a, b) => a.minuteInPeriod - b.minuteInPeriod);
    for (const sp of sorted) {
      const delta = sp.minuteInPeriod - lastMinute;
      for (const [posId, pid] of lineup.entries()) {
        result[pid] = result[pid] ?? {};
        result[pid][posId] = (result[pid][posId] ?? 0) + delta;
      }
      for (const ch of sp.changes) lineup.set(ch.positionId, ch.inPlayerId);
      lastMinute = sp.minuteInPeriod;
    }
    const finalDelta = mpp - lastMinute;
    for (const [posId, pid] of lineup.entries()) {
      result[pid] = result[pid] ?? {};
      result[pid][posId] = (result[pid][posId] ?? 0) + finalDelta;
    }
  }
  return result;
}

export function validateSchedule(
  periods: PeriodPlan[],
  input: ScheduleInput
): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  const { formation, players } = input;
  const playableMap = new Map<number, Set<number>>();
  for (const p of players) playableMap.set(p.id, new Set(p.playablePositionIds));

  for (const period of periods) {
    if (period.startLineup.length !== formation.positions.length) {
      issues.push({
        kind: "lineup_size",
        detail: `Period ${period.index}: har ${period.startLineup.length} spelare, behöver ${formation.positions.length}`,
      });
    }
    const seen = new Set<number>();
    for (const slot of period.startLineup) {
      if (seen.has(slot.playerId)) {
        issues.push({ kind: "duplicate_player", detail: `Period ${period.index}: spelare ${slot.playerId} dubblerad` });
      }
      seen.add(slot.playerId);
      const can = playableMap.get(slot.playerId);
      if (!can || !can.has(slot.positionId)) {
        issues.push({
          kind: "cannot_play_position",
          detail: `Spelare ${slot.playerId} kan inte spela position ${slot.positionId}`,
        });
      }
    }

    const subCount = period.subPoints.length;
    if (subCount < formation.minSubs || subCount > formation.maxSubs) {
      issues.push({
        kind: "sub_count",
        detail: `Period ${period.index}: ${subCount} byten, måste vara [${formation.minSubs}, ${formation.maxSubs}]`,
      });
    }

    for (const sp of period.subPoints) {
      const inIds = new Set(sp.changes.map((c) => c.inPlayerId));
      const outIds = new Set(sp.changes.map((c) => c.outPlayerId));
      for (const id of inIds) {
        if (outIds.has(id)) {
          issues.push({
            kind: "in_and_out_same_subpoint",
            detail: `Period ${period.index} minut ${sp.minuteInPeriod}: spelare ${id} byts både in och ut`,
          });
        }
      }
      for (const ch of sp.changes) {
        const can = playableMap.get(ch.inPlayerId);
        if (!can || !can.has(ch.positionId)) {
          issues.push({
            kind: "cannot_play_position",
            detail: `Spelare ${ch.inPlayerId} kan inte spela position ${ch.positionId}`,
          });
        }
      }
    }
  }

  const minutes = computePlayerMinutes(periods, input);
  const { floor, cap } = computeFloorCap(input);
  for (const p of players) {
    const m = minutes[p.id] ?? 0;
    if (m < floor) issues.push({ kind: "below_floor", detail: `${p.name}: ${m} min < ${floor}` });
    if (m > cap) issues.push({ kind: "above_cap", detail: `${p.name}: ${m} min > ${cap}` });
  }

  return issues;
}
