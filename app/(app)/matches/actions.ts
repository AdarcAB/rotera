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
  teams,
} from "@/lib/db/schema";
import { generateSchedule } from "@/lib/schedule/generate";
import type { ScheduleInput } from "@/lib/schedule/types";

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

export async function saveCalledPlayers(formData: FormData) {
  const userId = await requireUserId();
  const matchId = Number(formData.get("matchId"));
  const match = await assertOwned(matchId, userId);

  const teamPlayers = await db
    .select()
    .from(players)
    .where(eq(players.teamId, match.teamId));

  const calledIds = formData
    .getAll("called")
    .map((v) => Number(v))
    .filter((n) => Number.isFinite(n));

  const existing = await db
    .select()
    .from(matchPlayers)
    .where(eq(matchPlayers.matchId, matchId));
  const existingByPlayer = new Map<number | null, typeof existing[number]>();
  for (const mp of existing) existingByPlayer.set(mp.playerId, mp);

  const teamPlayerIds = new Set(teamPlayers.map((p) => p.id));
  const validCalled = calledIds.filter((id) => teamPlayerIds.has(id));

  for (const id of validCalled) {
    if (!existingByPlayer.has(id)) {
      await db.insert(matchPlayers).values({
        matchId,
        playerId: id,
        isGuest: false,
      });
    }
  }
  const toRemove = existing.filter(
    (mp) =>
      mp.playerId !== null && !validCalled.includes(mp.playerId) && !mp.isGuest
  );
  if (toRemove.length > 0) {
    await db
      .delete(matchPlayers)
      .where(
        inArray(
          matchPlayers.id,
          toRemove.map((mp) => mp.id)
        )
      );
  }
  revalidatePath(`/matches/${matchId}`);
}

export async function addGuest(formData: FormData) {
  const userId = await requireUserId();
  const matchId = Number(formData.get("matchId"));
  await assertOwned(matchId, userId);
  const name = String(formData.get("guestName") ?? "").trim();
  if (!name) return;
  await db.insert(matchPlayers).values({
    matchId,
    isGuest: true,
    guestName: name,
  });
  revalidatePath(`/matches/${matchId}`);
}

export async function removeMatchPlayer(formData: FormData) {
  const userId = await requireUserId();
  const matchId = Number(formData.get("matchId"));
  const id = Number(formData.get("id"));
  await assertOwned(matchId, userId);
  await db
    .delete(matchPlayers)
    .where(and(eq(matchPlayers.id, id), eq(matchPlayers.matchId, matchId)));
  revalidatePath(`/matches/${matchId}`);
}

export async function savePositionSelections(formData: FormData) {
  const userId = await requireUserId();
  const matchId = Number(formData.get("matchId"));
  await assertOwned(matchId, userId);

  const mps = await db
    .select()
    .from(matchPlayers)
    .where(eq(matchPlayers.matchId, matchId));

  for (const mp of mps) {
    const playable = formData
      .getAll(`playable_${mp.id}`)
      .map((v) => Number(v))
      .filter((n) => Number.isFinite(n));
    const preferred = formData
      .getAll(`preferred_${mp.id}`)
      .map((v) => Number(v))
      .filter((n) => Number.isFinite(n) && playable.includes(n));
    await db
      .update(matchPlayers)
      .set({
        playablePositionIds: playable,
        preferredPositionIds: preferred,
      })
      .where(eq(matchPlayers.id, mp.id));
  }
  revalidatePath(`/matches/${matchId}`);
}

export async function generateScheduleAction(formData: FormData) {
  const userId = await requireUserId();
  const matchId = Number(formData.get("matchId"));
  const match = await assertOwned(matchId, userId);

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
    throw new Error(
      "Kunde inte generera schema. Se till att alla kallade spelare har minst en spelbar position, och att du har minst så många spelare som positioner."
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
