import { and, asc, eq } from "drizzle-orm";
import { notFound } from "next/navigation";
import Link from "next/link";
import { requireUserId } from "@/lib/auth";
import { db } from "@/lib/db/client";
import {
  matchPlayers,
  matches,
  players,
  positions,
} from "@/lib/db/schema";
import { Card, CardTitle } from "@/components/ui/Card";
import type { Schedule } from "@/lib/schedule/types";
import { computePlayerMinutesByPosition } from "@/lib/schedule/validate";

export default async function SummaryPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const matchId = Number(id);
  const userId = await requireUserId();

  const [match] = await db
    .select()
    .from(matches)
    .where(eq(matches.id, matchId))
    .limit(1);
  if (!match) notFound();
  try {
    const { assertTeamAccessible } = await import("@/lib/auth");
    await assertTeamAccessible(match.teamId, userId);
  } catch {
    notFound();
  }

  const [mps, teamPlayers, posList] = await Promise.all([
    db.select().from(matchPlayers).where(eq(matchPlayers.matchId, matchId)),
    db.select().from(players).where(eq(players.teamId, match.teamId)),
    db
      .select()
      .from(positions)
      .where(eq(positions.formationId, match.formationId))
      .orderBy(asc(positions.sortOrder)),
  ]);

  const nameOf = (mp: (typeof mps)[number]) => {
    if (mp.isGuest) return mp.guestName ?? "Gäst";
    const p = teamPlayers.find((p) => p.id === mp.playerId);
    return p?.name ?? "Okänd";
  };
  const posAbbr = new Map(posList.map((p) => [p.id, p.abbreviation]));

  const schedule = match.generatedScheduleJson as Schedule | null;
  const minutesByPosition = schedule
    ? computePlayerMinutesByPosition(schedule.periods, {
        formation: {
          numPeriods: 0,
          minutesPerPeriod: 0,
          minSubs: 0,
          maxSubs: 0,
          positions: posList.map((p) => ({
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
      })
    : {};

  return (
    <div>
      <Link
        href={`/matches/${matchId}`}
        className="text-sm text-neutral-600 hover:underline"
      >
        ← Match
      </Link>

      <h1 className="text-2xl font-bold mt-2 mb-1">
        Summering — vs {match.opponent}
      </h1>
      <p className="text-neutral-600 mb-6">
        Status: <strong>{match.status}</strong>
      </p>

      <Card>
        <CardTitle>Speltid per spelare</CardTitle>
        <ul className="mt-3 divide-y divide-border">
          {mps.map((mp) => {
            const byPos = minutesByPosition[mp.id] ?? {};
            const total = mp.actualMinutesPlayed;
            const posSummary = Object.entries(byPos)
              .filter(([, m]) => Number(m) > 0)
              .map(
                ([pid, m]) =>
                  `${posAbbr.get(Number(pid)) ?? "?"}: ${m}′`
              )
              .join(" · ");
            return (
              <li key={mp.id} className="py-2 flex items-center justify-between gap-2">
                <div>
                  <div className="font-medium">{nameOf(mp)}</div>
                  {posSummary ? (
                    <div className="text-xs text-neutral-600">{posSummary}</div>
                  ) : null}
                </div>
                <div className="font-mono text-lg">{total}′</div>
              </li>
            );
          })}
        </ul>
      </Card>
    </div>
  );
}
