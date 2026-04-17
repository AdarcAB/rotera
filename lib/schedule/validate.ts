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

    const totalChanges = period.subPoints.reduce(
      (n, sp) => n + sp.changes.length,
      0
    );
    if (
      totalChanges < formation.minSubs ||
      totalChanges > formation.maxSubs
    ) {
      issues.push({
        kind: "sub_count",
        detail: `Period ${period.index}: ${totalChanges} byten, måste vara [${formation.minSubs}, ${formation.maxSubs}]`,
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
