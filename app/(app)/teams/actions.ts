"use server";

import { and, eq } from "drizzle-orm";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireUserId } from "@/lib/auth";
import { db } from "@/lib/db/client";
import { players, teams } from "@/lib/db/schema";

const TeamInput = z.object({
  name: z.string().trim().min(1, "Namn krävs").max(80),
});

export async function createTeam(formData: FormData) {
  const userId = await requireUserId();
  const parsed = TeamInput.parse({ name: formData.get("name") });
  const [inserted] = await db
    .insert(teams)
    .values({ userId, name: parsed.name })
    .returning();
  revalidatePath("/teams");
  redirect(`/teams/${inserted.id}`);
}

export async function renameTeam(formData: FormData) {
  const userId = await requireUserId();
  const id = Number(formData.get("id"));
  const parsed = TeamInput.parse({ name: formData.get("name") });
  await db
    .update(teams)
    .set({ name: parsed.name })
    .where(and(eq(teams.id, id), eq(teams.userId, userId)));
  revalidatePath(`/teams/${id}`);
}

export async function deleteTeam(formData: FormData) {
  const userId = await requireUserId();
  const id = Number(formData.get("id"));
  await db.delete(teams).where(and(eq(teams.id, id), eq(teams.userId, userId)));
  revalidatePath("/teams");
  redirect("/teams");
}

const PlayerInput = z.object({
  name: z.string().trim().min(1, "Namn krävs").max(80),
  nickname: z
    .string()
    .trim()
    .max(40)
    .optional()
    .transform((v) => (v && v.length > 0 ? v : null)),
  shirtNumber: z
    .string()
    .optional()
    .transform((v) => (v && v.length > 0 ? Number(v) : null))
    .refine((v) => v === null || (Number.isFinite(v) && v! >= 0 && v! < 1000), {
      message: "Ogiltigt tröjnummer",
    }),
});

async function assertTeamOwned(teamId: number, userId: number) {
  const rows = await db
    .select()
    .from(teams)
    .where(and(eq(teams.id, teamId), eq(teams.userId, userId)))
    .limit(1);
  if (rows.length === 0) throw new Error("Lag saknas eller fel ägare");
}

export async function addPlayer(formData: FormData) {
  const userId = await requireUserId();
  const teamId = Number(formData.get("teamId"));
  await assertTeamOwned(teamId, userId);
  const parsed = PlayerInput.parse({
    name: formData.get("name"),
    nickname: formData.get("nickname"),
    shirtNumber: formData.get("shirtNumber"),
  });
  await db.insert(players).values({
    teamId,
    name: parsed.name,
    nickname: parsed.nickname,
    shirtNumber: parsed.shirtNumber,
  });
  revalidatePath(`/teams/${teamId}`);
}

export async function deletePlayer(formData: FormData) {
  const userId = await requireUserId();
  const playerId = Number(formData.get("playerId"));
  const teamId = Number(formData.get("teamId"));
  await assertTeamOwned(teamId, userId);
  await db
    .delete(players)
    .where(and(eq(players.id, playerId), eq(players.teamId, teamId)));
  revalidatePath(`/teams/${teamId}`);
}
