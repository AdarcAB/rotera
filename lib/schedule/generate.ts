import { mulberry32, pickOne, randInt, shuffle, weightedPick } from "./rng";
import { scoreSchedule } from "./score";
import type {
  PeriodPlan,
  Schedule,
  ScheduleChange,
  ScheduleInput,
  SubPoint,
} from "./types";
import { computeFloorCap, validateSchedule } from "./validate";

const ATTEMPTS = 500;

function evenlyDistributedMinutes(count: number, total: number): number[] {
  if (count <= 0) return [];
  const minutes: number[] = [];
  for (let i = 1; i <= count; i++) {
    minutes.push(Math.round((i * total) / (count + 1)));
  }
  const seen = new Set<number>();
  const result: number[] = [];
  for (const m of minutes) {
    let v = Math.max(1, Math.min(total - 1, m));
    while (seen.has(v) && v < total - 1) v += 1;
    if (v >= 1 && v < total) {
      seen.add(v);
      result.push(v);
    }
  }
  return result.sort((a, b) => a - b);
}

const PREFERRED_POSITION_BONUS = 25;

function pickLineup(
  players: ScheduleInput["players"],
  positions: ScheduleInput["formation"]["positions"],
  minutesSoFar: Record<number, number>,
  rng: () => number
): { positionId: number; playerId: number }[] | null {
  const order = shuffle(rng, positions.map((p) => p.id));
  const used = new Set<number>();
  const lineup: { positionId: number; playerId: number }[] = [];

  for (const posId of order) {
    const eligible = players.filter(
      (p) => !used.has(p.id) && p.playablePositionIds.includes(posId)
    );
    if (eligible.length === 0) return null;
    const picked = weightedPick(rng, eligible, (p) => {
      const m = minutesSoFar[p.id] ?? 0;
      const base = 10 + Math.max(0, 30 - m);
      const preferBonus = p.preferredPositionIds.includes(posId)
        ? PREFERRED_POSITION_BONUS
        : 0;
      return base + preferBonus;
    });
    if (!picked) return null;
    used.add(picked.id);
    lineup.push({ positionId: posId, playerId: picked.id });
  }
  return lineup.sort((a, b) => a.positionId - b.positionId);
}

function attemptSchedule(input: ScheduleInput, rng: () => number): PeriodPlan[] | null {
  const { formation, players } = input;
  const periods: PeriodPlan[] = [];
  const minutesSoFar: Record<number, number> = {};
  for (const p of players) minutesSoFar[p.id] = 0;

  let currentLineup = new Map<number, number>();

  for (let pi = 0; pi < formation.numPeriods; pi++) {
    let startLineup: { positionId: number; playerId: number }[];

    if (pi === 0) {
      const picked = pickLineup(players, formation.positions, minutesSoFar, rng);
      if (!picked) return null;
      startLineup = picked;
    } else {
      startLineup = Array.from(currentLineup.entries())
        .map(([positionId, playerId]) => ({ positionId, playerId }))
        .sort((a, b) => a.positionId - b.positionId);
    }

    currentLineup = new Map(startLineup.map((s) => [s.positionId, s.playerId]));

    const benchSize = Math.max(0, players.length - formation.positions.length);
    // Target total spelarbyten for the period. Aim to rotate every bench
    // player in at least once; cap at the budget (maxSubs × 3).
    const targetTotalSpelarbyten = Math.min(
      benchSize,
      formation.maxSubs * 3
    );
    // Prefer fewer byten packed with more spelarbyten each (1-3 per byte),
    // but stay within [minSubs, maxSubs]. More bench → more byten.
    const numSubPoints = Math.max(
      formation.minSubs,
      Math.min(formation.maxSubs, Math.ceil(targetTotalSpelarbyten / 3))
    );
    const targetPerPoint = Math.max(
      1,
      Math.min(3, Math.ceil(targetTotalSpelarbyten / Math.max(1, numSubPoints)))
    );
    const subMinutes = evenlyDistributedMinutes(numSubPoints, formation.minutesPerPeriod);

    const subPoints: SubPoint[] = [];
    let lastMinute = 0;

    for (const m of subMinutes) {
      const delta = m - lastMinute;
      for (const pid of currentLineup.values()) {
        minutesSoFar[pid] = (minutesSoFar[pid] ?? 0) + delta;
      }

      const targetChanges = targetPerPoint;
      const changes: ScheduleChange[] = [];
      const usedInPoint = new Set<number>();
      const posOrder = shuffle(rng, formation.positions.map((p) => p.id));

      for (const posId of posOrder) {
        if (changes.length >= targetChanges) break;
        const outPlayerId = currentLineup.get(posId);
        if (outPlayerId === undefined || usedInPoint.has(outPlayerId)) continue;

        const onFieldIds = new Set(currentLineup.values());
        const bench = players.filter(
          (p) => !onFieldIds.has(p.id) && !usedInPoint.has(p.id)
        );
        const fit = bench.filter((p) => p.playablePositionIds.includes(posId));
        if (fit.length === 0) continue;

        const inPlayer = weightedPick(rng, fit, (p) => {
          const mins = minutesSoFar[p.id] ?? 0;
          const base = 5 + Math.max(0, 40 - mins);
          const preferBonus = p.preferredPositionIds.includes(posId)
            ? PREFERRED_POSITION_BONUS
            : 0;
          return base + preferBonus;
        });
        if (!inPlayer) continue;

        changes.push({ positionId: posId, outPlayerId, inPlayerId: inPlayer.id });
        usedInPoint.add(outPlayerId);
        usedInPoint.add(inPlayer.id);
        currentLineup.set(posId, inPlayer.id);
      }

      subPoints.push({ minuteInPeriod: m, changes });
      lastMinute = m;
    }

    const finalDelta = formation.minutesPerPeriod - lastMinute;
    for (const pid of currentLineup.values()) {
      minutesSoFar[pid] = (minutesSoFar[pid] ?? 0) + finalDelta;
    }

    periods.push({ index: pi, startLineup, subPoints });
  }

  return periods;
}

export function generateSchedule(input: ScheduleInput): Schedule | null {
  if (input.players.length < input.formation.positions.length) return null;

  const seed = input.seed ?? Math.floor(Math.random() * 2 ** 31);
  const rng = mulberry32(seed);

  type Candidate = {
    periods: PeriodPlan[];
    total: number;
    breakdown: ReturnType<typeof scoreSchedule>["breakdown"];
    minutes: Record<number, number>;
  };
  let best: Candidate | null = null;
  let bestInvalid: Candidate | null = null;

  for (let i = 0; i < ATTEMPTS; i++) {
    const attempt = attemptSchedule(input, rng);
    if (!attempt) continue;

    const { total, breakdown, perPlayerMinutes } = scoreSchedule(attempt, input);
    const issues = validateSchedule(attempt, input);

    if (issues.length === 0) {
      if (!best || total > best.total) {
        best = { periods: attempt, total, breakdown, minutes: perPlayerMinutes };
      }
    } else if (!best) {
      const softIssues = issues.filter((i) => i.kind === "below_floor" || i.kind === "above_cap");
      if (softIssues.length === issues.length) {
        if (!bestInvalid || total > bestInvalid.total) {
          bestInvalid = { periods: attempt, total, breakdown, minutes: perPlayerMinutes };
        }
      }
    }
  }

  const chosen = best ?? bestInvalid;
  if (!chosen) return null;

  return {
    periods: chosen.periods,
    score: chosen.total,
    scoreBreakdown: chosen.breakdown,
    perPlayerMinutes: chosen.minutes,
  };
}

export { computeFloorCap };
