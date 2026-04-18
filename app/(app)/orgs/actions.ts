"use server";

import { and, eq, inArray } from "drizzle-orm";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import {
  assertOrgAccessible,
  currentOrgId,
  requireUser,
  requireUserId,
  setCurrentOrgId,
} from "@/lib/auth";
import { db } from "@/lib/db/client";
import {
  orgInvites,
  orgMembers,
  orgTeams,
  players,
  teamPlayers,
  teams,
  users,
} from "@/lib/db/schema";
import { sendTeamInviteEmail } from "@/lib/email";
import { capitalizeName } from "@/lib/utils";

const OrgInput = z.object({
  name: z.string().trim().min(1, "Namn krävs").max(80),
  sport: z.enum(["fotboll"]).default("fotboll"),
});

export async function createOrg(formData: FormData) {
  const userId = await requireUserId();
  const parsed = OrgInput.parse({
    name: formData.get("name"),
    sport: formData.get("sport") ?? "fotboll",
  });
  const [inserted] = await db
    .insert(orgTeams)
    .values({
      name: parsed.name,
      sport: parsed.sport,
      createdByUserId: userId,
    })
    .returning();
  await db
    .insert(orgMembers)
    .values({ orgTeamId: inserted.id, userId })
    .onConflictDoNothing();
  await setCurrentOrgId(inserted.id);
  revalidatePath("/orgs");
  redirect("/dashboard");
}

export async function switchOrg(orgTeamId: number): Promise<void> {
  await setCurrentOrgId(orgTeamId);
  revalidatePath("/");
}

export async function renameOrg(
  orgTeamId: number,
  name: string
): Promise<void> {
  const userId = await requireUserId();
  await assertOrgAccessible(orgTeamId, userId);
  const clean = OrgInput.shape.name.parse(name);
  await db
    .update(orgTeams)
    .set({ name: clean })
    .where(eq(orgTeams.id, orgTeamId));
  revalidatePath("/orgs");
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

export async function inviteToOrg(
  orgTeamId: number,
  emailsRaw: string
): Promise<{ invited: number; alreadyMember: number; alreadyInvited: number }> {
  const user = await requireUser();
  await assertOrgAccessible(orgTeamId, user.id);
  const emails = EmailsInput.parse(emailsRaw);
  if (emails.length === 0)
    return { invited: 0, alreadyMember: 0, alreadyInvited: 0 };

  const [org] = await db
    .select()
    .from(orgTeams)
    .where(eq(orgTeams.id, orgTeamId))
    .limit(1);
  if (!org) throw new Error("Org saknas");

  const existingUsers = await db
    .select()
    .from(users)
    .where(inArray(users.email, emails));
  const userIdByEmail = new Map(existingUsers.map((u) => [u.email, u.id]));

  const memberUserIds = existingUsers.length
    ? await db
        .select()
        .from(orgMembers)
        .where(
          and(
            eq(orgMembers.orgTeamId, orgTeamId),
            inArray(
              orgMembers.userId,
              existingUsers.map((u) => u.id)
            )
          )
        )
    : [];
  const memberUserIdSet = new Set(memberUserIds.map((m) => m.userId));

  const existingInvites = await db
    .select()
    .from(orgInvites)
    .where(
      and(eq(orgInvites.orgTeamId, orgTeamId), inArray(orgInvites.email, emails))
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
      await db
        .insert(orgMembers)
        .values({ orgTeamId, userId: existingUserId })
        .onConflictDoNothing();
    } else {
      await db
        .insert(orgInvites)
        .values({ orgTeamId, email, invitedByUserId: user.id })
        .onConflictDoNothing();
    }
    await sendTeamInviteEmail({
      to: email,
      teamName: org.name,
      inviterEmail: user.email,
    }).catch(() => {});
    invited++;
  }

  revalidatePath("/orgs");
  return { invited, alreadyMember, alreadyInvited };
}

export async function removeOrgInvite(
  orgTeamId: number,
  inviteId: number
): Promise<void> {
  const userId = await requireUserId();
  await assertOrgAccessible(orgTeamId, userId);
  await db
    .delete(orgInvites)
    .where(and(eq(orgInvites.id, inviteId), eq(orgInvites.orgTeamId, orgTeamId)));
  revalidatePath("/orgs");
}

export async function removeOrgMember(
  orgTeamId: number,
  memberUserId: number
): Promise<void> {
  const userId = await requireUserId();
  await assertOrgAccessible(orgTeamId, userId);
  await db
    .delete(orgMembers)
    .where(
      and(
        eq(orgMembers.orgTeamId, orgTeamId),
        eq(orgMembers.userId, memberUserId)
      )
    );
  // If no members left, delete the org (cascades teams + players).
  const remaining = await db
    .select()
    .from(orgMembers)
    .where(eq(orgMembers.orgTeamId, orgTeamId));
  if (remaining.length === 0) {
    await db.delete(orgTeams).where(eq(orgTeams.id, orgTeamId));
  }
  revalidatePath("/orgs");
}

export type OrgListItem = {
  id: number;
  name: string;
  sport: string;
  memberCount: number;
  teamCount: number;
  isCurrent: boolean;
};

export async function listMyOrgs(): Promise<OrgListItem[]> {
  const userId = await requireUserId();
  const current = await currentOrgId();
  const mine = await db
    .select()
    .from(orgMembers)
    .where(eq(orgMembers.userId, userId));
  const ids = mine.map((m) => m.orgTeamId);
  if (ids.length === 0) return [];
  const rows = await db
    .select()
    .from(orgTeams)
    .where(inArray(orgTeams.id, ids));
  const allMembers = await db
    .select()
    .from(orgMembers)
    .where(inArray(orgMembers.orgTeamId, ids));
  const countMembers = new Map<number, number>();
  for (const m of allMembers)
    countMembers.set(m.orgTeamId, (countMembers.get(m.orgTeamId) ?? 0) + 1);
  const allTeams = await db
    .select()
    .from(teams)
    .where(inArray(teams.orgTeamId, ids));
  const countTeams = new Map<number, number>();
  for (const t of allTeams)
    if (t.orgTeamId !== null)
      countTeams.set(t.orgTeamId, (countTeams.get(t.orgTeamId) ?? 0) + 1);
  return rows.map((o) => ({
    id: o.id,
    name: o.name,
    sport: o.sport,
    memberCount: countMembers.get(o.id) ?? 0,
    teamCount: countTeams.get(o.id) ?? 0,
    isCurrent: o.id === current,
  }));
}

export type OrgDetail = {
  id: number;
  name: string;
  sport: string;
  members: { userId: number; email: string; joinedAt: string }[];
  invites: {
    id: number;
    email: string;
    invitedByEmail: string | null;
    createdAt: string;
  }[];
};

export type OrgPlayerRow = {
  id: number;
  name: string;
  teams: { id: number; name: string }[];
};

export async function listOrgPlayers(
  orgTeamId: number
): Promise<OrgPlayerRow[]> {
  const userId = await requireUserId();
  await assertOrgAccessible(orgTeamId, userId);

  const rows = await db
    .select()
    .from(players)
    .where(eq(players.orgTeamId, orgTeamId));
  if (rows.length === 0) return [];

  const teamAssignments = await db
    .select({
      playerId: teamPlayers.playerId,
      teamId: teams.id,
      teamName: teams.name,
    })
    .from(teamPlayers)
    .innerJoin(teams, eq(teams.id, teamPlayers.teamId))
    .where(
      inArray(
        teamPlayers.playerId,
        rows.map((p) => p.id)
      )
    );

  const byPlayer = new Map<number, { id: number; name: string }[]>();
  for (const a of teamAssignments) {
    const arr = byPlayer.get(a.playerId) ?? [];
    arr.push({ id: a.teamId, name: a.teamName });
    byPlayer.set(a.playerId, arr);
  }

  return rows
    .map((p) => ({
      id: p.id,
      name: p.name,
      teams: byPlayer.get(p.id) ?? [],
    }))
    .sort((a, b) => a.name.localeCompare(b.name, "sv"));
}

export async function renameOrgPlayer(
  playerId: number,
  name: string
): Promise<void> {
  const userId = await requireUserId();
  const [p] = await db
    .select()
    .from(players)
    .where(eq(players.id, playerId))
    .limit(1);
  if (!p?.orgTeamId) throw new Error("Spelare saknar org");
  await assertOrgAccessible(p.orgTeamId, userId);
  const clean = capitalizeName(name.trim().slice(0, 80));
  if (!clean) return;
  await db.update(players).set({ name: clean }).where(eq(players.id, playerId));
  revalidatePath("/orgs");
}

export async function deleteOrgPlayer(playerId: number): Promise<void> {
  const userId = await requireUserId();
  const [p] = await db
    .select()
    .from(players)
    .where(eq(players.id, playerId))
    .limit(1);
  if (!p?.orgTeamId) return;
  await assertOrgAccessible(p.orgTeamId, userId);
  await db.delete(players).where(eq(players.id, playerId));
  revalidatePath("/orgs");
}

export async function getOrgDetail(orgTeamId: number): Promise<OrgDetail | null> {
  const userId = await requireUserId();
  await assertOrgAccessible(orgTeamId, userId);
  const [org] = await db
    .select()
    .from(orgTeams)
    .where(eq(orgTeams.id, orgTeamId))
    .limit(1);
  if (!org) return null;
  const memberRows = await db
    .select({
      userId: orgMembers.userId,
      email: users.email,
      joinedAt: orgMembers.joinedAt,
    })
    .from(orgMembers)
    .leftJoin(users, eq(users.id, orgMembers.userId))
    .where(eq(orgMembers.orgTeamId, orgTeamId));
  const inviteRows = await db
    .select({
      id: orgInvites.id,
      email: orgInvites.email,
      invitedByEmail: users.email,
      createdAt: orgInvites.createdAt,
    })
    .from(orgInvites)
    .leftJoin(users, eq(users.id, orgInvites.invitedByUserId))
    .where(eq(orgInvites.orgTeamId, orgTeamId));
  return {
    id: org.id,
    name: org.name,
    sport: org.sport,
    members: memberRows.map((m) => ({
      userId: m.userId,
      email: m.email ?? "",
      joinedAt: m.joinedAt.toISOString(),
    })),
    invites: inviteRows.map((i) => ({
      id: i.id,
      email: i.email,
      invitedByEmail: i.invitedByEmail,
      createdAt: i.createdAt.toISOString(),
    })),
  };
}
