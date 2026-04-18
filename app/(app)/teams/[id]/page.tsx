import { eq } from "drizzle-orm";
import { notFound } from "next/navigation";
import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db/client";
import { players, teamMembers, teams } from "@/lib/db/schema";
import { Button } from "@/components/ui/Button";
import { Card, CardTitle } from "@/components/ui/Card";
import { TeamNameEdit } from "@/components/TeamNameEdit";
import { PlayersTable } from "@/components/PlayersTable";
import { TeamMembersSection } from "@/components/TeamMembersSection";
import { deleteTeam, listTeamMembersAndInvites } from "../actions";

export default async function TeamPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const teamId = Number(id);
  const user = await requireUser();

  // Access check via team_members
  const [member] = await db
    .select()
    .from(teamMembers)
    .where(eq(teamMembers.teamId, teamId))
    .limit(1);
  if (!member) notFound();

  const [team] = await db
    .select()
    .from(teams)
    .where(eq(teams.id, teamId))
    .limit(1);
  if (!team) notFound();

  // Verify current user is actually a member
  const userMembership = await db
    .select()
    .from(teamMembers)
    .where(eq(teamMembers.teamId, teamId))
    .then((rows) => rows.find((r) => r.userId === user.id));
  if (!userMembership) notFound();

  const playerList = await db
    .select({ id: players.id, name: players.name })
    .from(players)
    .where(eq(players.teamId, teamId))
    .orderBy(players.name);

  const { members, invites } = await listTeamMembersAndInvites(teamId);

  return (
    <div>
      <Link href="/teams" className="text-sm text-neutral-600 hover:underline">
        ← Lag
      </Link>

      <div className="mt-2 mb-6">
        <TeamNameEdit teamId={team.id} initialName={team.name} />
      </div>

      <Card>
        <CardTitle>Spelare ({playerList.length})</CardTitle>
        <p className="text-sm text-neutral-700 mt-1 mb-3">
          Skriv ett namn och tryck Enter eller lämna fältet för att lägga till.
          Klicka på ett namn för att byta. Rader sparas automatiskt.
        </p>
        <PlayersTable teamId={team.id} initialPlayers={playerList} />
      </Card>

      <Card className="mt-6">
        <CardTitle>Medlemmar</CardTitle>
        <p className="text-sm text-neutral-700 mt-1 mb-3">
          Andra tränare eller föräldrar kan bjudas in för att komma åt laget —
          med samma rättigheter som du.
        </p>
        <TeamMembersSection
          teamId={team.id}
          currentUserId={user.id}
          initialMembers={members.map((m) => ({
            ...m,
            joinedAt: m.joinedAt.toISOString(),
          }))}
          initialInvites={invites.map((i) => ({
            ...i,
            createdAt: i.createdAt.toISOString(),
          }))}
        />
      </Card>

      <Card className="mt-10 border-red-100">
        <CardTitle>Radera lag</CardTitle>
        <p className="text-sm text-neutral-700 mt-1 mb-3">
          Raderar laget, alla spelare, medlemskap och kopplade matcher
          permanent. Kan inte ångras. Påverkar alla medlemmar i laget.
        </p>
        <form action={deleteTeam}>
          <input type="hidden" name="id" value={team.id} />
          <Button variant="danger" size="sm" type="submit">
            Radera lag permanent
          </Button>
        </form>
      </Card>
    </div>
  );
}
