import Link from "next/link";
import { desc, eq } from "drizzle-orm";
import { requireUserId } from "@/lib/auth";
import { db } from "@/lib/db/client";
import { matches, teams, players } from "@/lib/db/schema";
import { Card, CardTitle } from "@/components/ui/Card";

export default async function Dashboard() {
  const userId = await requireUserId();
  const [teamRows, matchRows] = await Promise.all([
    db.select().from(teams).where(eq(teams.userId, userId)),
    db
      .select()
      .from(matches)
      .where(eq(matches.userId, userId))
      .orderBy(desc(matches.createdAt))
      .limit(5),
  ]);

  const playerCount = teamRows.length
    ? (
        await db
          .select()
          .from(players)
          .where(eq(players.teamId, teamRows[0].id))
      ).length
    : 0;

  return (
    <div>
      <h1 className="text-2xl font-bold mb-6">Översikt</h1>

      {teamRows.length === 0 ? (
        <Card className="mb-6">
          <CardTitle>Kom igång</CardTitle>
          <p className="text-sm text-neutral-700 mt-2 mb-4">
            Skapa ditt första lag för att börja lägga till spelare, spelformer och
            matcher.
          </p>
          <Link
            href="/teams"
            className="inline-flex h-10 px-4 items-center justify-center rounded-md bg-primary text-primary-foreground text-sm font-medium"
          >
            Skapa lag
          </Link>
        </Card>
      ) : (
        <div className="grid md:grid-cols-3 gap-4 mb-6">
          <Card>
            <div className="text-sm text-neutral-600">Lag</div>
            <div className="text-2xl font-bold">{teamRows.length}</div>
          </Card>
          <Card>
            <div className="text-sm text-neutral-600">Spelare (första laget)</div>
            <div className="text-2xl font-bold">{playerCount}</div>
          </Card>
          <Card>
            <div className="text-sm text-neutral-600">Senaste matcher</div>
            <div className="text-2xl font-bold">{matchRows.length}</div>
          </Card>
        </div>
      )}

      <Card>
        <CardTitle>Senaste matcher</CardTitle>
        {matchRows.length === 0 ? (
          <p className="text-sm text-neutral-600 mt-2">Inga matcher ännu.</p>
        ) : (
          <ul className="mt-3 divide-y divide-border">
            {matchRows.map((m) => (
              <li key={m.id} className="py-3 flex items-center justify-between">
                <div>
                  <div className="font-medium">vs {m.opponent}</div>
                  <div className="text-sm text-neutral-600">
                    {m.playedAt
                      ? new Date(m.playedAt).toLocaleString("sv-SE")
                      : "Utan datum"}
                    {" · "}
                    <span className="uppercase">{m.status}</span>
                  </div>
                </div>
                <Link
                  href={`/matches/${m.id}`}
                  className="text-sm text-primary hover:underline"
                >
                  Öppna →
                </Link>
              </li>
            ))}
          </ul>
        )}
        <div className="mt-4">
          <Link
            href="/matches"
            className="text-sm text-primary hover:underline"
          >
            Alla matcher →
          </Link>
        </div>
      </Card>
    </div>
  );
}
