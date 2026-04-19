"use server";

import { and, asc, eq, inArray } from "drizzle-orm";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireUserId } from "@/lib/auth";
import { db } from "@/lib/db/client";
import {
  formations,
  matchPlayers,
  matches,
  players,
  positions,
  teamPlayers as teamPlayersTable,
  teams,
} from "@/lib/db/schema";
import { generateSchedule } from "@/lib/schedule/generate";
import type { ScheduleInput } from "@/lib/schedule/types";
import { capitalizeName } from "@/lib/utils";
import {
  assertMatchAccessible,
  assertOrgAccessible,
  assertTeamAccessible,
  currentOrgId,
} from "@/lib/auth";
import { fairScore, optimalMinutes } from "@/lib/stats";

/**
 * For each player in the team, compute the average fair score across prior
 * finished matches (excluding the match being generated). Used by the
 * generator to nudge underplayed kids to more time.
 */
async function computeSeasonFairScoresForTeam(
  teamId: number | null,
  excludeMatchId: number
): Promise<Map<number, number>> {
  if (teamId === null) return new Map();
  const finished = await db
    .select()
    .from(matches)
    .where(and(eq(matches.teamId, teamId), eq(matches.status, "finished")));
  const priorMatches = finished.filter((m) => m.id !== excludeMatchId);
  if (priorMatches.length === 0) return new Map();

  const formIds = Array.from(new Set(priorMatches.map((m) => m.formationId)));
  const formRows = await db
    .select()
    .from(formations)
    .where(inArray(formations.id, formIds));
  const formMap = new Map(formRows.map((f) => [f.id, f]));

  const mpRows = await db
    .select()
    .from(matchPlayers)
    .where(
      inArray(
        matchPlayers.matchId,
        priorMatches.map((m) => m.id)
      )
    );
  const mpByMatch = new Map<number, typeof mpRows>();
  for (const mp of mpRows) {
    const arr = mpByMatch.get(mp.matchId) ?? [];
    arr.push(mp);
    mpByMatch.set(mp.matchId, arr);
  }

  const agg = new Map<number, { sum: number; n: number }>();
  for (const m of priorMatches) {
    const form = formMap.get(m.formationId);
    if (!form) continue;
    const roster = mpByMatch.get(m.id) ?? [];
    if (roster.length === 0) continue;
    const optimal = optimalMinutes({
      minutesPerPeriod: form.minutesPerPeriod,
      numPeriods: form.numPeriods,
      playersOnField: form.playersOnField,
      troupSize: roster.length,
    });
    for (const mp of roster) {
      if (mp.playerId === null) continue;
      const s = fairScore(mp.actualMinutesPlayed, optimal);
      const cur = agg.get(mp.playerId) ?? { sum: 0, n: 0 };
      cur.sum += s;
      cur.n += 1;
      agg.set(mp.playerId, cur);
    }
  }

  const avg = new Map<number, number>();
  for (const [pid, { sum, n }] of agg.entries()) {
    if (n > 0) avg.set(pid, sum / n);
  }
  return avg;
}

const MatchInput = z
  .object({
    mode: z.enum(["team", "adhoc"]).default("team"),
    opponent: z.string().trim().min(1).max(80),
    teamId: z
      .string()
      .optional()
      .transform((v) => (v && v.length > 0 ? Number(v) : null))
      .pipe(
        z.number().int().positive().nullable()
      ),
    adHocName: z
      .string()
      .trim()
      .max(80)
      .optional()
      .transform((v) => (v && v.length > 0 ? v : null)),
    formationId: z.coerce.number().int().positive(),
    homeAway: z.enum(["home", "away"]).default("home"),
    reason: z
      .string()
      .trim()
      .max(80)
      .optional()
      .transform((v) => (v && v.length > 0 ? v : null)),
    playedAt: z
      .string()
      .optional()
      .transform((v) => (v && v.length > 0 ? new Date(v) : null)),
    location: z
      .string()
      .trim()
      .max(120)
      .optional()
      .transform((v) => (v && v.length > 0 ? v : null)),
  })
  .refine(
    (v) => (v.mode === "team" ? v.teamId !== null : v.adHocName !== null),
    { message: "Välj ett lag eller namnge en tillfällig trupp" }
  );

export async function createMatch(formData: FormData) {
  const userId = await requireUserId();
  const parsed = MatchInput.parse(Object.fromEntries(formData.entries()));

  let teamId: number | null = null;
  let orgTeamId: number;
  let adHocName: string | null = null;

  if (parsed.mode === "team") {
    if (!parsed.teamId) throw new Error("Lag saknas");
    await assertTeamAccessible(parsed.teamId, userId);
    const [team] = await db
      .select()
      .from(teams)
      .where(eq(teams.id, parsed.teamId))
      .limit(1);
    if (!team || team.orgTeamId === null) throw new Error("Lag saknas");
    teamId = team.id;
    orgTeamId = team.orgTeamId;
  } else {
    orgTeamId = await currentOrgId();
    await assertOrgAccessible(orgTeamId, userId);
    adHocName = parsed.adHocName;
  }

  const [formation] = await db
    .select()
    .from(formations)
    .where(
      and(eq(formations.id, parsed.formationId), eq(formations.userId, userId))
    )
    .limit(1);
  if (!formation) throw new Error("Spelform saknas");

  const [inserted] = await db
    .insert(matches)
    .values({
      userId,
      orgTeamId,
      teamId,
      adHocName,
      formationId: parsed.formationId,
      opponent: parsed.opponent,
      homeAway: parsed.homeAway,
      reason: parsed.reason,
      playedAt: parsed.playedAt,
      location: parsed.location,
      status: "draft",
    })
    .returning();

  // Pre-fill the roster with every player on the team. Coach unchecks
  // the ones not attending. (Ad-hoc trupper start empty — coach picks via
  // typeahead.)
  if (teamId !== null) {
    const rosterPlayers = await db
      .select({ id: players.id })
      .from(players)
      .innerJoin(teamPlayersTable, eq(teamPlayersTable.playerId, players.id))
      .where(eq(teamPlayersTable.teamId, teamId));
    if (rosterPlayers.length > 0) {
      const posIds = await allPositionIds(parsed.formationId);
      await db.insert(matchPlayers).values(
        rosterPlayers.map((p) => ({
          matchId: inserted.id,
          playerId: p.id,
          isGuest: false,
          playablePositionIds: posIds,
          preferredPositionIds: [],
        }))
      );
    }
  }

  revalidatePath("/matches");
  redirect(`/matches/${inserted.id}`);
}

export async function deleteMatch(formData: FormData) {
  const userId = await requireUserId();
  const id = Number(formData.get("id"));
  await assertMatchAccessible(id, userId);
  await db.delete(matches).where(eq(matches.id, id));
  revalidatePath("/matches");
  redirect("/matches");
}

async function allPositionIds(formationId: number): Promise<number[]> {
  const list = await db
    .select({ id: positions.id })
    .from(positions)
    .where(eq(positions.formationId, formationId));
  return list.map((r) => r.id);
}

export type MatchPlayerDTO = {
  id: number;
  playerId: number | null;
  isGuest: boolean;
  guestName: string | null;
  playablePositionIds: number[];
  preferredPositionIds: number[];
};

export async function togglePlayerCalledAction(
  matchId: number,
  playerId: number,
  called: boolean
): Promise<MatchPlayerDTO | null> {
  const userId = await requireUserId();
  const match = await assertMatchAccessible(matchId, userId);

  let teamPlayer;
  if (match.teamId !== null) {
    // Team match: player must be on this team's roster.
    const rows = await db
      .select({ id: players.id })
      .from(players)
      .innerJoin(teamPlayersTable, eq(teamPlayersTable.playerId, players.id))
      .where(
        and(eq(players.id, playerId), eq(teamPlayersTable.teamId, match.teamId))
      )
      .limit(1);
    teamPlayer = rows[0];
  } else if (match.orgTeamId !== null) {
    // Ad-hoc trupp: player must belong to the match's org.
    const rows = await db
      .select({ id: players.id })
      .from(players)
      .where(
        and(eq(players.id, playerId), eq(players.orgTeamId, match.orgTeamId))
      )
      .limit(1);
    teamPlayer = rows[0];
  }
  if (!teamPlayer) throw new Error("Spelare saknas i laget");

  const existing = await db
    .select()
    .from(matchPlayers)
    .where(
      and(eq(matchPlayers.matchId, matchId), eq(matchPlayers.playerId, playerId))
    )
    .limit(1);

  if (called) {
    if (existing.length > 0) {
      const row = existing[0];
      revalidatePath(`/matches/${matchId}`);
      return {
        id: row.id,
        playerId: row.playerId,
        isGuest: row.isGuest,
        guestName: row.guestName,
        playablePositionIds: row.playablePositionIds ?? [],
        preferredPositionIds: row.preferredPositionIds ?? [],
      };
    }
    const posIds = await allPositionIds(match.formationId);
    const [inserted] = await db
      .insert(matchPlayers)
      .values({
        matchId,
        playerId,
        isGuest: false,
        playablePositionIds: posIds,
        preferredPositionIds: [],
      })
      .returning();
    revalidatePath(`/matches/${matchId}`);
    return {
      id: inserted.id,
      playerId: inserted.playerId,
      isGuest: inserted.isGuest,
      guestName: inserted.guestName,
      playablePositionIds: inserted.playablePositionIds ?? [],
      preferredPositionIds: inserted.preferredPositionIds ?? [],
    };
  }

  if (existing.length > 0) {
    await db.delete(matchPlayers).where(eq(matchPlayers.id, existing[0].id));
    revalidatePath(`/matches/${matchId}`);
  }
  return null;
}

export async function addGuestAction(
  matchId: number,
  name: string
): Promise<MatchPlayerDTO | null> {
  const userId = await requireUserId();
  const match = await assertMatchAccessible(matchId, userId);
  const cleaned = capitalizeName(name.trim().slice(0, 60));
  if (!cleaned) return null;
  const posIds = await allPositionIds(match.formationId);
  const [inserted] = await db
    .insert(matchPlayers)
    .values({
      matchId,
      isGuest: true,
      guestName: cleaned,
      playablePositionIds: posIds,
      preferredPositionIds: [],
    })
    .returning();
  revalidatePath(`/matches/${matchId}`);
  return {
    id: inserted.id,
    playerId: inserted.playerId,
    isGuest: inserted.isGuest,
    guestName: inserted.guestName,
    playablePositionIds: inserted.playablePositionIds ?? [],
    preferredPositionIds: inserted.preferredPositionIds ?? [],
  };
}

export async function removeMatchPlayerAction(
  matchId: number,
  mpId: number
): Promise<void> {
  const userId = await requireUserId();
  await assertMatchAccessible(matchId, userId);
  await db
    .delete(matchPlayers)
    .where(and(eq(matchPlayers.id, mpId), eq(matchPlayers.matchId, matchId)));
  revalidatePath(`/matches/${matchId}`);
}

export async function updateMatchPlayerPositionsAction(
  matchId: number,
  mpId: number,
  playable: number[],
  preferred: number[]
): Promise<void> {
  const userId = await requireUserId();
  const match = await assertMatchAccessible(matchId, userId);
  const validIds = new Set(await allPositionIds(match.formationId));
  const cleanPlayable = Array.from(new Set(playable.filter((id) => validIds.has(id)))).sort(
    (a, b) => a - b
  );
  const cleanPreferred = Array.from(
    new Set(preferred.filter((id) => cleanPlayable.includes(id)))
  ).sort((a, b) => a - b);
  await db
    .update(matchPlayers)
    .set({
      playablePositionIds: cleanPlayable,
      preferredPositionIds: cleanPreferred,
    })
    .where(and(eq(matchPlayers.id, mpId), eq(matchPlayers.matchId, matchId)));
  revalidatePath(`/matches/${matchId}`);
}

export type SchedulePrereqs = {
  ok: boolean;
  reasons: string[];
};

export async function computeSchedulePrereqs(
  matchId: number
): Promise<SchedulePrereqs> {
  const userId = await requireUserId();
  const match = await assertMatchAccessible(matchId, userId);
  const formation = await db
    .select()
    .from(formations)
    .where(eq(formations.id, match.formationId))
    .limit(1)
    .then((r) => r[0]);
  const posList = await db
    .select()
    .from(positions)
    .where(eq(positions.formationId, match.formationId));
  const mps = await db
    .select()
    .from(matchPlayers)
    .where(eq(matchPlayers.matchId, matchId));

  const reasons: string[] = [];
  if (posList.length !== formation.playersOnField) {
    reasons.push(
      `Spelformen har ${posList.length} positioner men kräver ${formation.playersOnField} spelare på plan. Öppna spelformen och justera.`
    );
  }
  if (mps.length < formation.playersOnField) {
    reasons.push(
      `Minst ${formation.playersOnField} spelare måste vara kallade (just nu: ${mps.length}).`
    );
  }
  const noPlayable = mps.filter(
    (mp) => (mp.playablePositionIds ?? []).length === 0
  );
  if (noPlayable.length > 0) {
    reasons.push(
      `${noPlayable.length} kallad(e) spelare saknar spelbara positioner.`
    );
  }
  for (const pos of posList) {
    const eligible = mps.filter((mp) =>
      (mp.playablePositionIds ?? []).includes(pos.id)
    );
    if (eligible.length === 0) {
      reasons.push(
        `Ingen kallad spelare kan spela position "${pos.abbreviation}".`
      );
    }
  }
  return { ok: reasons.length === 0, reasons };
}

export async function generateScheduleAction(formData: FormData) {
  const userId = await requireUserId();
  const matchId = Number(formData.get("matchId"));
  const match = await assertMatchAccessible(matchId, userId);

  const pre = await computeSchedulePrereqs(matchId);
  if (!pre.ok) {
    revalidatePath(`/matches/${matchId}`);
    redirect(
      `/matches/${matchId}?genError=${encodeURIComponent(pre.reasons.join("\n"))}`
    );
  }

  const formation = await db
    .select()
    .from(formations)
    .where(eq(formations.id, match.formationId))
    .limit(1)
    .then((r) => r[0]);
  const positionList = await db
    .select()
    .from(positions)
    .where(eq(positions.formationId, match.formationId))
    .orderBy(asc(positions.sortOrder));
  const mps = await db
    .select()
    .from(matchPlayers)
    .where(eq(matchPlayers.matchId, matchId));

  const plist = match.teamId
    ? await db
        .select({ id: players.id, name: players.name })
        .from(players)
        .innerJoin(teamPlayersTable, eq(teamPlayersTable.playerId, players.id))
        .where(eq(teamPlayersTable.teamId, match.teamId))
    : match.orgTeamId
      ? await db
          .select({ id: players.id, name: players.name })
          .from(players)
          .where(eq(players.orgTeamId, match.orgTeamId))
      : [];
  const nameOf = (mp: (typeof mps)[number]) => {
    if (mp.isGuest) return mp.guestName ?? "Gäst";
    const p = plist.find((p) => p.id === mp.playerId);
    return p?.name ?? "Okänd";
  };
  const seasonScores = await computeSeasonFairScoresForTeam(
    match.teamId,
    matchId
  );

  const input: ScheduleInput = {
    formation: {
      numPeriods: formation.numPeriods,
      minutesPerPeriod: formation.minutesPerPeriod,
      minSubs: formation.minSubsPerPeriod,
      maxSubs: formation.maxSubsPerPeriod,
      positions: positionList.map((p) => ({
        id: p.id,
        name: p.name,
        abbreviation: p.abbreviation,
        isGoalkeeper: p.isGoalkeeper,
      })),
    },
    players: mps.map((mp) => ({
      id: mp.id,
      name: nameOf(mp),
      playablePositionIds: mp.playablePositionIds ?? [],
      preferredPositionIds: mp.preferredPositionIds ?? [],
      seasonFairScore:
        mp.playerId !== null ? seasonScores.get(mp.playerId) : undefined,
    })),
    seed: Date.now() & 0x7fffffff,
  };

  const schedule = generateSchedule(input);
  if (!schedule) {
    redirect(
      `/matches/${matchId}?genError=${encodeURIComponent(
        "Optimeraren hittade inget giltigt schema. Prova att kalla fler spelare eller justera spelbara positioner."
      )}`
    );
  }

  await db
    .update(matches)
    .set({
      generatedScheduleJson: schedule,
      status: "scheduled",
    })
    .where(eq(matches.id, matchId));

  revalidatePath(`/matches/${matchId}`);
  redirect(`/matches/${matchId}?genOk=1`);
}

export async function regenerateScheduleWithStart(
  matchId: number,
  fixedStartLineup: { positionId: number; playerId: number }[]
): Promise<{ ok: true } | { ok: false; error: string }> {
  const userId = await requireUserId();
  const match = await assertMatchAccessible(matchId, userId);

  const pre = await computeSchedulePrereqs(matchId);
  if (!pre.ok) {
    return { ok: false, error: pre.reasons.join("\n") };
  }

  const formation = await db
    .select()
    .from(formations)
    .where(eq(formations.id, match.formationId))
    .limit(1)
    .then((r) => r[0]);
  const positionList = await db
    .select()
    .from(positions)
    .where(eq(positions.formationId, match.formationId))
    .orderBy(asc(positions.sortOrder));
  const mps = await db
    .select()
    .from(matchPlayers)
    .where(eq(matchPlayers.matchId, matchId));

  if (fixedStartLineup.length !== positionList.length) {
    return { ok: false, error: "Alla positioner måste vara fyllda." };
  }
  const posIds = new Set(positionList.map((p) => p.id));
  const mpIds = new Set(mps.map((mp) => mp.id));
  const seenPlayers = new Set<number>();
  const seenPositions = new Set<number>();
  for (const slot of fixedStartLineup) {
    if (!posIds.has(slot.positionId))
      return { ok: false, error: "Okänd position i uppställningen." };
    if (seenPositions.has(slot.positionId))
      return { ok: false, error: "Samma position tilldelad två gånger." };
    seenPositions.add(slot.positionId);
    if (!mpIds.has(slot.playerId))
      return { ok: false, error: "Spelare är inte kallad till matchen." };
    if (seenPlayers.has(slot.playerId))
      return { ok: false, error: "Samma spelare på flera positioner." };
    seenPlayers.add(slot.playerId);
  }

  const plist = match.teamId
    ? await db
        .select({ id: players.id, name: players.name })
        .from(players)
        .innerJoin(teamPlayersTable, eq(teamPlayersTable.playerId, players.id))
        .where(eq(teamPlayersTable.teamId, match.teamId))
    : match.orgTeamId
      ? await db
          .select({ id: players.id, name: players.name })
          .from(players)
          .where(eq(players.orgTeamId, match.orgTeamId))
      : [];
  const nameOf = (mp: (typeof mps)[number]) => {
    if (mp.isGuest) return mp.guestName ?? "Gäst";
    const p = plist.find((p) => p.id === mp.playerId);
    return p?.name ?? "Okänd";
  };
  const seasonScores = await computeSeasonFairScoresForTeam(
    match.teamId,
    matchId
  );

  const input: ScheduleInput = {
    formation: {
      numPeriods: formation.numPeriods,
      minutesPerPeriod: formation.minutesPerPeriod,
      minSubs: formation.minSubsPerPeriod,
      maxSubs: formation.maxSubsPerPeriod,
      positions: positionList.map((p) => ({
        id: p.id,
        name: p.name,
        abbreviation: p.abbreviation,
        isGoalkeeper: p.isGoalkeeper,
      })),
    },
    players: mps.map((mp) => ({
      id: mp.id,
      name: nameOf(mp),
      playablePositionIds: mp.playablePositionIds ?? [],
      preferredPositionIds: mp.preferredPositionIds ?? [],
      seasonFairScore:
        mp.playerId !== null ? seasonScores.get(mp.playerId) : undefined,
    })),
    seed: Date.now() & 0x7fffffff,
    fixedStartLineup,
  };

  const schedule = generateSchedule(input);
  if (!schedule) {
    return {
      ok: false,
      error:
        "Optimeraren hittade inget giltigt schema med den uppsättningen. Prova en annan eller klicka Regenerera utan fixering.",
    };
  }

  await db
    .update(matches)
    .set({ generatedScheduleJson: schedule, status: "scheduled" })
    .where(eq(matches.id, matchId));

  revalidatePath(`/matches/${matchId}`);
  return { ok: true };
}

export async function startLive(formData: FormData) {
  const userId = await requireUserId();
  const matchId = Number(formData.get("matchId"));
  const match = await assertMatchAccessible(matchId, userId);
  // Initialize pre-period state but leave matches.status = "scheduled".
  // The match flips to "live" (and the orange banner appears) only when the
  // coach actually starts period 1 — see persistLiveState.
  if (match.liveStateJson === null) {
    await db
      .update(matches)
      .set({
        liveStateJson: {
          status: "pre_period",
          currentPeriodIndex: 0,
          resumedAt: null,
          elapsedBeforePause: 0,
          completedSubPoints: [],
          removedPlayerIds: [],
          startedAt: new Date().toISOString(),
        },
      })
      .where(eq(matches.id, matchId));
  }
  redirect(`/matches/${matchId}/live`);
}

export async function saveLiveState(matchId: number, state: unknown) {
  const userId = await requireUserId();
  await assertMatchAccessible(matchId, userId);
  await db
    .update(matches)
    .set({ liveStateJson: state as object })
    .where(eq(matches.id, matchId));
}

export async function stopLiveMatch(formData: FormData) {
  const userId = await requireUserId();
  const matchId = Number(formData.get("matchId"));
  await assertMatchAccessible(matchId, userId);
  await db
    .update(matches)
    .set({ status: "scheduled", liveStateJson: null })
    .where(eq(matches.id, matchId));
  revalidatePath(`/matches/${matchId}`);
  redirect(`/matches/${matchId}`);
}

export async function finishMatch(formData: FormData) {
  const userId = await requireUserId();
  const matchId = Number(formData.get("matchId"));
  const match = await assertMatchAccessible(matchId, userId);

  const schedule = match.generatedScheduleJson as
    | {
        perPlayerMinutes: Record<string, number>;
        periods: {
          index: number;
          subPoints: {
            minuteInPeriod: number;
            changes: {
              positionId: number;
              outPlayerId: number;
              inPlayerId: number;
            }[];
          }[];
        }[];
      }
    | null;
  if (schedule) {
    const formation = await db
      .select()
      .from(formations)
      .where(eq(formations.id, match.formationId))
      .limit(1)
      .then((r) => r[0]);
    const perPlayer: Record<string, number> = {
      ...(schedule.perPlayerMinutes ?? {}),
    };
    const liveState = match.liveStateJson as
      | {
          adHocSubs?: {
            periodIndex: number;
            minuteInPeriod: number;
            outPlayerId: number;
            inPlayerId: number;
          }[];
          completedSubPoints?: {
            periodIndex: number;
            subPointIndex: number;
            appliedPositionIds?: number[];
          }[];
        }
      | null;
    const adHocs = liveState?.adHocSubs ?? [];
    const completed = liveState?.completedSubPoints ?? [];
    const mpp = formation.minutesPerPeriod;

    // Ad hoc: out loses remaining, in gains remaining.
    for (const sub of adHocs) {
      const remaining = Math.max(0, mpp - sub.minuteInPeriod);
      const outKey = String(sub.outPlayerId);
      const inKey = String(sub.inPlayerId);
      perPlayer[outKey] = (perPlayer[outKey] ?? 0) - remaining;
      perPlayer[inKey] = (perPlayer[inKey] ?? 0) + remaining;
    }

    // Skipped scheduled changes: the schedule assumed they happened, but
    // they didn't. Reverse the assumption → out stays on, in stays off.
    for (const period of schedule.periods) {
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
          const outKey = String(c.outPlayerId);
          const inKey = String(c.inPlayerId);
          // out stayed on field → gains remaining; in stayed off → loses remaining
          perPlayer[outKey] = (perPlayer[outKey] ?? 0) + remaining;
          perPlayer[inKey] = (perPlayer[inKey] ?? 0) - remaining;
        }
      }
    }

    for (const [mpIdStr, mins] of Object.entries(perPlayer)) {
      const mpId = Number(mpIdStr);
      if (!Number.isFinite(mpId)) continue;
      const clamped = Math.max(0, Math.round(Number(mins) || 0));
      await db
        .update(matchPlayers)
        .set({ actualMinutesPlayed: clamped })
        .where(and(eq(matchPlayers.id, mpId), eq(matchPlayers.matchId, matchId)));
    }
  }

  await db
    .update(matches)
    .set({ status: "finished" })
    .where(eq(matches.id, matchId));

  revalidatePath(`/matches/${matchId}`);
  redirect(`/matches/${matchId}/summary`);
}
