"use server";

import { and, eq, inArray } from "drizzle-orm";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import {
  assertTeamAccessible,
  currentOrgId,
  requireUser,
  requireUserId,
} from "@/lib/auth";
import { db } from "@/lib/db/client";
import {
  players,
  teamInvites,
  teamMembers,
  teamPlayers,
  teams,
  users,
} from "@/lib/db/schema";
import { capitalizeName } from "@/lib/utils";
import { sendTeamInviteEmail } from "@/lib/email";

const TeamInput = z.object({
  name: z.string().trim().min(1, "Namn krävs").max(80),
});

export async function createTeam(formData: FormData) {
  const userId = await requireUserId();
  const orgId = await currentOrgId();
  const parsed = TeamInput.parse({ name: formData.get("name") });
  const [inserted] = await db
    .insert(teams)
    .values({ userId, orgTeamId: orgId, name: parsed.name })
    .returning();
  // Legacy team_members kept for continuity; org_members is the primary access
  await db
    .insert(teamMembers)
    .values({ teamId: inserted.id, userId })
    .onConflictDoNothing();
  revalidatePath("/teams");
  redirect(`/teams/${inserted.id}`);
}

export async function renameTeam(teamId: number, name: string) {
  const userId = await requireUserId();
  await assertTeamAccessible(teamId, userId);
  const parsed = TeamInput.parse({ name });
  await db.update(teams).set({ name: parsed.name }).where(eq(teams.id, teamId));
  revalidatePath(`/teams/${teamId}`);
  revalidatePath("/teams");
}

export async function deleteTeam(formData: FormData) {
  const userId = await requireUserId();
  const id = Number(formData.get("id"));
  await assertTeamAccessible(id, userId);
  await db.delete(teams).where(eq(teams.id, id));
  revalidatePath("/teams");
  redirect("/teams");
}

const PlayerName = z.string().trim().min(1, "Namn krävs").max(80);

export async function createPlayer(
  teamId: number,
  name: string
): Promise<{ id: number; name: string }> {
  const userId = await requireUserId();
  await assertTeamAccessible(teamId, userId);
  const parsed = capitalizeName(PlayerName.parse(name));
  // Find the org that owns this team — new players live at the org level.
  const [team] = await db
    .select()
    .from(teams)
    .where(eq(teams.id, teamId))
    .limit(1);
  const [inserted] = await db
    .insert(players)
    .values({
      orgTeamId: team?.orgTeamId ?? null,
      teamId, // legacy — keep populated for now
      name: parsed,
    })
    .returning();
  await db
    .insert(teamPlayers)
    .values({ teamId, playerId: inserted.id })
    .onConflictDoNothing();
  revalidatePath(`/teams/${teamId}`);
  return { id: inserted.id, name: inserted.name };
}

export async function assignExistingPlayerToTeam(
  teamId: number,
  playerId: number
): Promise<{ id: number; name: string } | null> {
  const userId = await requireUserId();
  await assertTeamAccessible(teamId, userId);
  const [team] = await db
    .select()
    .from(teams)
    .where(eq(teams.id, teamId))
    .limit(1);
  if (!team?.orgTeamId) return null;
  const [player] = await db
    .select()
    .from(players)
    .where(and(eq(players.id, playerId), eq(players.orgTeamId, team.orgTeamId)))
    .limit(1);
  if (!player) return null;
  await db
    .insert(teamPlayers)
    .values({ teamId, playerId })
    .onConflictDoNothing();
  revalidatePath(`/teams/${teamId}`);
  return { id: player.id, name: player.name };
}

export async function searchOrgPlayers(
  query: string
): Promise<{ id: number; name: string; inTeamIds: number[] }[]> {
  const userId = await requireUserId();
  const orgId = await currentOrgId();
  void userId;
  const cleaned = query.trim().toLowerCase();
  if (cleaned.length < 1) return [];
  const rows = await db
    .select()
    .from(players)
    .where(eq(players.orgTeamId, orgId));
  const match = rows
    .filter((p) => p.name.toLowerCase().includes(cleaned))
    .slice(0, 8);
  if (match.length === 0) return [];
  const tps = await db
    .select()
    .from(teamPlayers)
    .where(
      inArray(
        teamPlayers.playerId,
        match.map((p) => p.id)
      )
    );
  const byPlayer = new Map<number, number[]>();
  for (const tp of tps) {
    const arr = byPlayer.get(tp.playerId) ?? [];
    arr.push(tp.teamId);
    byPlayer.set(tp.playerId, arr);
  }
  return match.map((p) => ({
    id: p.id,
    name: p.name,
    inTeamIds: byPlayer.get(p.id) ?? [],
  }));
}

export async function renamePlayer(
  playerId: number,
  teamId: number,
  name: string
): Promise<void> {
  const userId = await requireUserId();
  await assertTeamAccessible(teamId, userId);
  const parsed = capitalizeName(PlayerName.parse(name));
  // Players are org-owned. Verify the player belongs to this team's org
  // (the legacy players.team_id column is no longer a reliable filter).
  const [team] = await db
    .select()
    .from(teams)
    .where(eq(teams.id, teamId))
    .limit(1);
  if (!team?.orgTeamId) throw new Error("Laget saknar organisation");
  const [player] = await db
    .select()
    .from(players)
    .where(and(eq(players.id, playerId), eq(players.orgTeamId, team.orgTeamId)))
    .limit(1);
  if (!player) throw new Error("Spelare saknas");
  await db.update(players).set({ name: parsed }).where(eq(players.id, playerId));
  revalidatePath(`/teams/${teamId}`);
}

export async function deletePlayer(
  playerId: number,
  teamId: number
): Promise<void> {
  const userId = await requireUserId();
  await assertTeamAccessible(teamId, userId);
  // Remove from this team's roster only. Player stays in the org.
  await db
    .delete(teamPlayers)
    .where(
      and(eq(teamPlayers.teamId, teamId), eq(teamPlayers.playerId, playerId))
    );
  revalidatePath(`/teams/${teamId}`);
}

// ──────────────── Team members + invites ────────────────

export type TeamMemberRow = {
  userId: number;
  email: string;
  joinedAt: Date;
};

export type TeamInviteRow = {
  id: number;
  email: string;
  invitedByEmail: string | null;
  createdAt: Date;
};

export async function listTeamMembersAndInvites(
  teamId: number
): Promise<{ members: TeamMemberRow[]; invites: TeamInviteRow[] }> {
  const userId = await requireUserId();
  await assertTeamAccessible(teamId, userId);

  const mRows = await db
    .select({
      userId: teamMembers.userId,
      email: users.email,
      joinedAt: teamMembers.joinedAt,
    })
    .from(teamMembers)
    .leftJoin(users, eq(users.id, teamMembers.userId))
    .where(eq(teamMembers.teamId, teamId));
  const members: TeamMemberRow[] = mRows.map((r) => ({
    userId: r.userId,
    email: r.email ?? "",
    joinedAt: r.joinedAt,
  }));

  const iRows = await db
    .select({
      id: teamInvites.id,
      email: teamInvites.email,
      invitedByEmail: users.email,
      createdAt: teamInvites.createdAt,
    })
    .from(teamInvites)
    .leftJoin(users, eq(users.id, teamInvites.invitedByUserId))
    .where(eq(teamInvites.teamId, teamId));

  return { members, invites: iRows };
}

const EmailsInput = z
  .string()
  .min(1)
  .transform((s) =>
    s
      .split(/[\s,;]+/)
      .map((e) => e.trim().toLowerCase())
      .filter((e) => /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(e))
  );

export async function inviteToTeam(
  teamId: number,
  emailsRaw: string
): Promise<{ invited: number; alreadyMember: number; alreadyInvited: number }> {
  const user = await requireUser();
  await assertTeamAccessible(teamId, user.id);
  const emails = EmailsInput.parse(emailsRaw);
  if (emails.length === 0) return { invited: 0, alreadyMember: 0, alreadyInvited: 0 };

  const [team] = await db.select().from(teams).where(eq(teams.id, teamId)).limit(1);
  if (!team) throw new Error("Lag saknas");

  const existingUsers = await db
    .select()
    .from(users)
    .where(inArray(users.email, emails));
  const userIdByEmail = new Map(existingUsers.map((u) => [u.email, u.id]));

  const memberUserIds = existingUsers.length
    ? await db
        .select()
        .from(teamMembers)
        .where(
          and(
            eq(teamMembers.teamId, teamId),
            inArray(
              teamMembers.userId,
              existingUsers.map((u) => u.id)
            )
          )
        )
    : [];
  const memberUserIdSet = new Set(memberUserIds.map((m) => m.userId));

  const existingInvites = await db
    .select()
    .from(teamInvites)
    .where(
      and(eq(teamInvites.teamId, teamId), inArray(teamInvites.email, emails))
    );
  const invitedEmails = new Set(existingInvites.map((i) => i.email));

  let invited = 0;
  let alreadyMember = 0;
  let alreadyInvited = 0;

  for (const email of emails) {
    const existingUserId = userIdByEmail.get(email);
    if (existingUserId !== undefined && memberUserIdSet.has(existingUserId)) {
      alreadyMember++;
      continue;
    }
    if (invitedEmails.has(email)) {
      alreadyInvited++;
      continue;
    }

    if (existingUserId !== undefined) {
      // User exists — add directly as member, no email needed
      await db
        .insert(teamMembers)
        .values({ teamId, userId: existingUserId })
        .onConflictDoNothing();
    } else {
      await db
        .insert(teamInvites)
        .values({ teamId, email, invitedByUserId: user.id })
        .onConflictDoNothing();
    }
    // Send email regardless — they might want the notification
    await sendTeamInviteEmail({
      to: email,
      teamName: team.name,
      inviterEmail: user.email,
    }).catch(() => {});
    invited++;
  }

  revalidatePath(`/teams/${teamId}`);
  return { invited, alreadyMember, alreadyInvited };
}

export async function removeInvite(
  teamId: number,
  inviteId: number
): Promise<void> {
  const userId = await requireUserId();
  await assertTeamAccessible(teamId, userId);
  await db
    .delete(teamInvites)
    .where(and(eq(teamInvites.id, inviteId), eq(teamInvites.teamId, teamId)));
  revalidatePath(`/teams/${teamId}`);
}

export async function removeMember(
  teamId: number,
  memberUserId: number
): Promise<void> {
  const userId = await requireUserId();
  await assertTeamAccessible(teamId, userId);
  await db
    .delete(teamMembers)
    .where(
      and(
        eq(teamMembers.teamId, teamId),
        eq(teamMembers.userId, memberUserId)
      )
    );
  // If the team has no members left, delete it.
  const remaining = await db
    .select()
    .from(teamMembers)
    .where(eq(teamMembers.teamId, teamId));
  if (remaining.length === 0) {
    await db.delete(teams).where(eq(teams.id, teamId));
  }
  revalidatePath(`/teams/${teamId}`);
  revalidatePath("/teams");
}

/** Team IDs accessible to the current user (teams in their current org). */
export async function listAccessibleTeamIds(): Promise<number[]> {
  const orgId = await currentOrgId();
  const rows = await db
    .select({ id: teams.id })
    .from(teams)
    .where(eq(teams.orgTeamId, orgId));
  return rows.map((r) => r.id);
}
