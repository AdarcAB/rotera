"use server";

import { eq, inArray } from "drizzle-orm";
import { redirect } from "next/navigation";
import { clearSession, requireUser } from "@/lib/auth";
import { db } from "@/lib/db/client";
import { teamMembers, teams, users } from "@/lib/db/schema";

export async function deleteAccount(formData: FormData) {
  const user = await requireUser();
  const confirmation = String(formData.get("confirmation") ?? "")
    .trim()
    .toLowerCase();

  if (confirmation !== user.email.toLowerCase()) {
    redirect(
      `/konto?error=${encodeURIComponent(
        "Bekräftelsen måste vara exakt din e-postadress."
      )}`
    );
  }

  // Find all teams the user is member of, and drop any where they were the
  // sole member.
  const myMemberships = await db
    .select({ teamId: teamMembers.teamId })
    .from(teamMembers)
    .where(eq(teamMembers.userId, user.id));
  const myTeamIds = myMemberships.map((m) => m.teamId);

  if (myTeamIds.length > 0) {
    const allMemberships = await db
      .select()
      .from(teamMembers)
      .where(inArray(teamMembers.teamId, myTeamIds));
    const otherMembersByTeam = new Map<number, number>();
    for (const m of allMemberships) {
      if (m.userId === user.id) continue;
      otherMembersByTeam.set(m.teamId, (otherMembersByTeam.get(m.teamId) ?? 0) + 1);
    }
    const soleMemberTeams = myTeamIds.filter(
      (tid) => !otherMembersByTeam.has(tid)
    );
    if (soleMemberTeams.length > 0) {
      await db.delete(teams).where(inArray(teams.id, soleMemberTeams));
    }
  }

  // Deleting the user cascade-deletes authTokens, formations, and any
  // remaining memberships. Shared teams survive because teams.user_id is now
  // "set null" on user delete.
  await db.delete(users).where(eq(users.id, user.id));
  await clearSession();
  redirect("/?deleted=1");
}
