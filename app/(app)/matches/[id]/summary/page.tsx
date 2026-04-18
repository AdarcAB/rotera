import { asc, eq } from "drizzle-orm";
import { notFound } from "next/navigation";
import Link from "next/link";
import { requireUserId } from "@/lib/auth";
import { db } from "@/lib/db/client";
import {
  formations,
  matchPlayers,
  matches,
  players,
  positions,
} from "@/lib/db/schema";
import { Card, CardTitle } from "@/components/ui/Card";
import type { Schedule } from "@/lib/schedule/types";
import { computePlayerMinutesByPosition } from "@/lib/schedule/validate";
import {
  fairScore,
  optimalMinutes,
  verdictFor,
  deltaMinutes,
} from "@/lib/stats";

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

  const [mps, teamPlayers, posList, formation] = await Promise.all([
    db.select().from(matchPlayers).where(eq(matchPlayers.matchId, matchId)),
    db.select().from(players).where(eq(players.teamId, match.teamId)),
    db
      .select()
      .from(positions)
      .where(eq(positions.formationId, match.formationId))
      .orderBy(asc(positions.sortOrder)),
    db
      .select()
      .from(formations)
      .where(eq(formations.id, match.formationId))
      .limit(1)
      .then((r) => r[0]),
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

  const optimal = optimalMinutes({
    minutesPerPeriod: formation.minutesPerPeriod,
    numPeriods: formation.numPeriods,
    playersOnField: formation.playersOnField,
    troupSize: mps.length,
  });

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
        Status: <strong>{match.status}</strong> · optimal speltid:{" "}
        <span className="font-mono">{Math.round(optimal)}′</span> per spelare
      </p>

      <Card>
        <CardTitle>Speltid per spelare</CardTitle>
        <p className="text-sm text-neutral-600 mt-1 mb-3">
          <strong>Fair score</strong>: 100 = optimalt. Över 100 = mer än sin
          andel. Under = mindre. ±5 är grönt.
        </p>
        <ul className="mt-3 divide-y divide-border">
          {mps.map((mp) => {
            const byPos = minutesByPosition[mp.id] ?? {};
            const total = mp.actualMinutesPlayed;
            const score = fairScore(total, optimal);
            const delta = deltaMinutes(total, optimal);
            const v = verdictFor(score);
            const color =
              v === "perfect"
                ? "text-emerald-700 bg-emerald-50 border-emerald-200"
                : v === "close"
                  ? "text-neutral-700 bg-neutral-50 border-border"
                  : v === "heavy"
                    ? "text-amber-800 bg-amber-50 border-amber-200"
                    : "text-sky-800 bg-sky-50 border-sky-200";
            const posSummary = Object.entries(byPos)
              .filter(([, m]) => Number(m) > 0)
              .map(([pid, m]) => `${posAbbr.get(Number(pid)) ?? "?"}: ${m}′`)
              .join(" · ");
            return (
              <li
                key={mp.id}
                className="py-3 flex items-center justify-between gap-3"
              >
                <div className="flex-1 min-w-0">
                  <div className="font-medium">{nameOf(mp)}</div>
                  {posSummary ? (
                    <div className="text-xs text-neutral-600 mt-0.5">
                      {posSummary}
                    </div>
                  ) : null}
                </div>
                <div className="text-right flex items-center gap-3">
                  <div>
                    <div className="font-mono text-lg leading-none">
                      {total}′
                    </div>
                    <div className="text-xs text-neutral-600 mt-1">
                      {delta >= 0 ? `+${delta}` : delta}′ mot optimal
                    </div>
                  </div>
                  <div
                    className={`w-16 shrink-0 text-center py-1 rounded-md border font-mono text-sm font-semibold ${color}`}
                    title="Fair score — 100 är optimalt"
                  >
                    {Math.round(score)}
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      </Card>
    </div>
  );
}
