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

export async function renameTeam(teamId: number, name: string) {
  const userId = await requireUserId();
  const parsed = TeamInput.parse({ name });
  await db
    .update(teams)
    .set({ name: parsed.name })
    .where(and(eq(teams.id, teamId), eq(teams.userId, userId)));
  revalidatePath(`/teams/${teamId}`);
  revalidatePath("/teams");
}

export async function deleteTeam(formData: FormData) {
  const userId = await requireUserId();
  const id = Number(formData.get("id"));
  await db.delete(teams).where(and(eq(teams.id, id), eq(teams.userId, userId)));
  revalidatePath("/teams");
  redirect("/teams");
}

async function assertTeamOwned(teamId: number, userId: number) {
  const rows = await db
    .select()
    .from(teams)
    .where(and(eq(teams.id, teamId), eq(teams.userId, userId)))
    .limit(1);
  if (rows.length === 0) throw new Error("Lag saknas eller fel ägare");
}

const PlayerName = z.string().trim().min(1, "Namn krävs").max(80);

export async function createPlayer(
  teamId: number,
  name: string
): Promise<{ id: number; name: string }> {
  const userId = await requireUserId();
  await assertTeamOwned(teamId, userId);
  const parsed = PlayerName.parse(name);
  const [inserted] = await db
    .insert(players)
    .values({ teamId, name: parsed })
    .returning();
  revalidatePath(`/teams/${teamId}`);
  return { id: inserted.id, name: inserted.name };
}

export async function renamePlayer(
  playerId: number,
  teamId: number,
  name: string
): Promise<void> {
  const userId = await requireUserId();
  await assertTeamOwned(teamId, userId);
  const parsed = PlayerName.parse(name);
  await db
    .update(players)
    .set({ name: parsed })
    .where(and(eq(players.id, playerId), eq(players.teamId, teamId)));
  revalidatePath(`/teams/${teamId}`);
}

export async function deletePlayer(
  playerId: number,
  teamId: number
): Promise<void> {
  const userId = await requireUserId();
  await assertTeamOwned(teamId, userId);
  await db
    .delete(players)
    .where(and(eq(players.id, playerId), eq(players.teamId, teamId)));
  revalidatePath(`/teams/${teamId}`);
}
