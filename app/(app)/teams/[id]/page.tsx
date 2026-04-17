import { and, eq } from "drizzle-orm";
import { notFound } from "next/navigation";
import Link from "next/link";
import { requireUserId } from "@/lib/auth";
import { db } from "@/lib/db/client";
import { players, teams } from "@/lib/db/schema";
import { Button } from "@/components/ui/Button";
import { Card, CardTitle } from "@/components/ui/Card";
import { TeamNameEdit } from "@/components/TeamNameEdit";
import { PlayersTable } from "@/components/PlayersTable";
import { deleteTeam } from "../actions";

export default async function TeamPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const teamId = Number(id);
  const userId = await requireUserId();

  const [team] = await db
    .select()
    .from(teams)
    .where(and(eq(teams.id, teamId), eq(teams.userId, userId)))
    .limit(1);
  if (!team) notFound();

  const playerList = await db
    .select({ id: players.id, name: players.name })
    .from(players)
    .where(eq(players.teamId, teamId))
    .orderBy(players.name);

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
        <p className="text-xs text-neutral-600 mt-1 mb-3">
          Skriv ett namn och tryck Enter eller lämna fältet för att lägga till.
          Klicka på ett namn för att byta. Rader sparas automatiskt.
        </p>
        <PlayersTable teamId={team.id} initialPlayers={playerList} />
      </Card>

      <Card className="mt-10 border-red-100">
        <CardTitle>Radera lag</CardTitle>
        <p className="text-xs text-neutral-600 mt-1 mb-3">
          Raderar laget, alla spelare och kopplade matcher permanent. Kan inte
          ångras.
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
