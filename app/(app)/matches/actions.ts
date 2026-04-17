"use server";

import { and, asc, eq } from "drizzle-orm";
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
  teams,
} from "@/lib/db/schema";
import { generateSchedule } from "@/lib/schedule/generate";
import type { ScheduleInput } from "@/lib/schedule/types";
import { capitalizeName } from "@/lib/utils";

const MatchInput = z.object({
  opponent: z.string().trim().min(1).max(80),
  teamId: z.coerce.number().int().positive(),
  formationId: z.coerce.number().int().positive(),
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
});

async function assertOwned(matchId: number, userId: number) {
  const rows = await db
    .select()
    .from(matches)
    .where(and(eq(matches.id, matchId), eq(matches.userId, userId)))
    .limit(1);
  if (rows.length === 0) throw new Error("Match saknas eller fel ägare");
  return rows[0];
}

export async function createMatch(formData: FormData) {
  const userId = await requireUserId();
  const parsed = MatchInput.parse(Object.fromEntries(formData.entries()));

  const [team] = await db
    .select()
    .from(teams)
    .where(and(eq(teams.id, parsed.teamId), eq(teams.userId, userId)))
    .limit(1);
  if (!team) throw new Error("Lag saknas");

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
      teamId: parsed.teamId,
      formationId: parsed.formationId,
      opponent: parsed.opponent,
      playedAt: parsed.playedAt,
      location: parsed.location,
      status: "draft",
    })
    .returning();

  revalidatePath("/matches");
  redirect(`/matches/${inserted.id}`);
}

export async function deleteMatch(formData: FormData) {
  const userId = await requireUserId();
  const id = Number(formData.get("id"));
  await assertOwned(id, userId);
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
  const match = await assertOwned(matchId, userId);

  const [teamPlayer] = await db
    .select()
    .from(players)
    .where(and(eq(players.id, playerId), eq(players.teamId, match.teamId)))
    .limit(1);
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
  const match = await assertOwned(matchId, userId);
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
  await assertOwned(matchId, userId);
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
  const match = await assertOwned(matchId, userId);
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
  const match = await assertOwned(matchId, userId);
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
  const match = await assertOwned(matchId, userId);

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

  const plist = await db
    .select()
    .from(players)
    .where(eq(players.teamId, match.teamId));
  const nameOf = (mp: (typeof mps)[number]) => {
    if (mp.isGuest) return mp.guestName ?? "Gäst";
    const p = plist.find((p) => p.id === mp.playerId);
    return p?.name ?? "Okänd";
  };

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
      })),
    },
    players: mps.map((mp) => ({
      id: mp.id,
      name: nameOf(mp),
      playablePositionIds: mp.playablePositionIds ?? [],
      preferredPositionIds: mp.preferredPositionIds ?? [],
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

export async function startLive(formData: FormData) {
  const userId = await requireUserId();
  const matchId = Number(formData.get("matchId"));
  await assertOwned(matchId, userId);
  await db
    .update(matches)
    .set({
      status: "live",
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
  revalidatePath(`/matches/${matchId}`);
  redirect(`/matches/${matchId}/live`);
}

export async function saveLiveState(matchId: number, state: unknown) {
  const userId = await requireUserId();
  await assertOwned(matchId, userId);
  await db
    .update(matches)
    .set({ liveStateJson: state as object })
    .where(eq(matches.id, matchId));
}

export async function finishMatch(formData: FormData) {
  const userId = await requireUserId();
  const matchId = Number(formData.get("matchId"));
  const match = await assertOwned(matchId, userId);

  const schedule = match.generatedScheduleJson as
    | {
        perPlayerMinutes: Record<string, number>;
      }
    | null;
  if (schedule) {
    const perPlayer = schedule.perPlayerMinutes ?? {};
    for (const [mpIdStr, mins] of Object.entries(perPlayer)) {
      const mpId = Number(mpIdStr);
      if (!Number.isFinite(mpId)) continue;
      await db
        .update(matchPlayers)
        .set({ actualMinutesPlayed: Number(mins) || 0 })
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
