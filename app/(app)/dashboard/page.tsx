import Link from "next/link";
import { desc, eq, inArray, or } from "drizzle-orm";
import { requireUserId, userOrgIds, userTeamIds } from "@/lib/auth";
import { db } from "@/lib/db/client";
import { matches, teams, players } from "@/lib/db/schema";
import { Card, CardTitle } from "@/components/ui/Card";
import { InstallAppHint } from "@/components/InstallAppHint";
import { unvotedFeatureCount } from "../forslag/actions";
import { matchTitle } from "@/lib/match-title";

export default async function Dashboard() {
  const userId = await requireUserId();
  const [teamIds, orgIds] = await Promise.all([
    userTeamIds(userId),
    userOrgIds(userId),
  ]);
  const [teamRows, matchRows] = await Promise.all([
    teamIds.length === 0
      ? Promise.resolve([])
      : db.select().from(teams).where(inArray(teams.id, teamIds)),
    teamIds.length === 0 && orgIds.length === 0
      ? Promise.resolve([])
      : db
          .select()
          .from(matches)
          .where(
            or(
              teamIds.length > 0 ? inArray(matches.teamId, teamIds) : undefined,
              orgIds.length > 0 ? inArray(matches.orgTeamId, orgIds) : undefined
            )
          )
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

  const unvotedCount = await unvotedFeatureCount();

  return (
    <div>
      <h1 className="text-2xl font-bold mb-6">Översikt</h1>

      <InstallAppHint />

      {unvotedCount > 0 ? (
        <Link
          href="/forslag"
          className="block rounded-lg border border-sky-200 bg-sky-50/70 p-4 mb-6 hover:bg-sky-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-400"
        >
          <div className="flex items-center gap-3">
            <span className="shrink-0 w-8 h-8 rounded-full bg-sky-500 text-white flex items-center justify-center text-sm font-bold">
              {unvotedCount}
            </span>
            <div>
              <div className="font-semibold text-sky-900">
                Vilka features vill du se härnäst?
              </div>
              <div className="text-sm text-sky-900">
                Rösta på förslag eller lämna ett eget →
              </div>
            </div>
          </div>
        </Link>
      ) : null}

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
            {matchRows.map((m) => {
              const teamName = m.teamId
                ? teamRows.find((t) => t.id === m.teamId)?.name ?? null
                : null;
              return (
              <li key={m.id} className="py-3 flex items-center justify-between">
                <div>
                  <div className="font-medium">
                    {matchTitle({
                      opponent: m.opponent,
                      homeAway: m.homeAway,
                      teamName,
                      adHocName: m.adHocName,
                    })}
                    {m.reason ? (
                      <span className="text-sm text-neutral-500 font-normal">
                        {" "}
                        ({m.reason})
                      </span>
                    ) : null}
                  </div>
                  <div className="text-sm text-neutral-600">
                    {m.playedAt
                      ? new Date(m.playedAt).toLocaleDateString("sv-SE")
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
              );
            })}
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
