import { and, asc, eq, inArray } from "drizzle-orm";
import { notFound } from "next/navigation";
import Link from "next/link";
import { assertMatchAccessible, requireUserId } from "@/lib/auth";
import { db } from "@/lib/db/client";
import {
  formations,
  matchPlayers,
  matches,
  players,
  positions,
  teamPlayers as teamPlayersTable,
  teams,
} from "@/lib/db/schema";
import { Card, CardTitle } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import {
  computeSchedulePrereqs,
  deleteMatch,
  generateScheduleAction,
  startLive,
} from "../actions";
import type { Schedule } from "@/lib/schedule/types";
import { PlayersSection } from "@/components/PlayersSection";
import { AdHocPlayersSection } from "@/components/AdHocPlayersSection";
import { EditStartLineupButton } from "@/components/EditStartLineupButton";
import { matchTitle } from "@/lib/match-title";

export default async function MatchPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ genError?: string; genOk?: string }>;
}) {
  const { id } = await params;
  const sp = await searchParams;
  const matchId = Number(id);
  const userId = await requireUserId();

  let match;
  try {
    match = await assertMatchAccessible(matchId, userId);
  } catch {
    notFound();
  }

  const [team, formation, rosterPlayers, posList, mps] = await Promise.all([
    match.teamId
      ? db
          .select()
          .from(teams)
          .where(eq(teams.id, match.teamId))
          .limit(1)
          .then((r) => r[0] ?? null)
      : Promise.resolve(null),
    db
      .select()
      .from(formations)
      .where(eq(formations.id, match.formationId))
      .limit(1)
      .then((r) => r[0]),
    match.teamId
      ? db
          .select({ id: players.id, name: players.name })
          .from(players)
          .innerJoin(teamPlayersTable, eq(teamPlayersTable.playerId, players.id))
          .where(eq(teamPlayersTable.teamId, match.teamId))
          .orderBy(players.name)
      : match.orgTeamId
      ? db
          .select({ id: players.id, name: players.name })
          .from(players)
          .where(eq(players.orgTeamId, match.orgTeamId))
          .orderBy(players.name)
      : Promise.resolve(
          [] as { id: number; name: string }[]
        ),
    db
      .select()
      .from(positions)
      .where(eq(positions.formationId, match.formationId))
      .orderBy(asc(positions.sortOrder)),
    db
      .select()
      .from(matchPlayers)
      .where(eq(matchPlayers.matchId, matchId)),
  ]);

  const prereqs = await computeSchedulePrereqs(matchId);

  const schedule = match.generatedScheduleJson as Schedule | null;

  const nameOf = (mp: {
    isGuest: boolean;
    guestName: string | null;
    playerId: number | null;
  }) => {
    if (mp.isGuest) return mp.guestName ?? "Gäst";
    const p = rosterPlayers.find((p) => p.id === mp.playerId);
    return p?.name ?? "Okänd";
  };

  const initialMatchPlayers = mps.map((mp) => ({
    id: mp.id,
    playerId: mp.playerId,
    isGuest: mp.isGuest,
    guestName: mp.guestName,
    playablePositionIds: mp.playablePositionIds ?? [],
    preferredPositionIds: mp.preferredPositionIds ?? [],
  }));

  return (
    <div>
      <Link href="/matches" className="text-sm text-neutral-600 hover:underline">
        ← Matcher
      </Link>

      <div className="flex flex-wrap gap-3 items-start justify-between mt-2 mb-6">
        <div>
          <h1 className="text-2xl font-bold">
            {matchTitle({
              opponent: match.opponent,
              homeAway: match.homeAway,
              teamName: team?.name ?? null,
              adHocName: match.adHocName,
            })}
            {match.reason ? (
              <span className="text-base text-neutral-500 font-normal">
                {" "}
                ({match.reason})
              </span>
            ) : null}
          </h1>
          <div className="text-sm text-neutral-600 mt-1">
            {formation.name} ·{" "}
            {match.playedAt
              ? new Date(match.playedAt).toLocaleDateString("sv-SE")
              : "Utan datum"}
          </div>
        </div>

        <div className="flex gap-2">
          {match.status === "live" ? (
            <Link
              href={`/matches/${match.id}/live`}
              className="inline-flex h-12 px-6 items-center justify-center rounded-md bg-red-600 text-white font-medium"
            >
              🔴 Gå till live
            </Link>
          ) : match.status === "finished" ? (
            <Link
              href={`/matches/${match.id}/summary`}
              className="inline-flex h-12 px-6 items-center justify-center rounded-md bg-neutral-900 text-white font-medium"
            >
              Visa sammanställning
            </Link>
          ) : schedule ? (
            <form action={startLive}>
              <input type="hidden" name="matchId" value={match.id} />
              <Button type="submit" size="lg">
                ▶ Starta live-läge
              </Button>
            </form>
          ) : null}
        </div>
      </div>

      <Card>
        <details open={!schedule}>
          <summary className="clean cursor-pointer flex items-center gap-2 select-none">
            <svg
              viewBox="0 0 24 24"
              width="16"
              height="16"
              fill="currentColor"
              className="chevron-toggle transition-transform text-neutral-500"
              aria-hidden="true"
            >
              <path d="M8 5l8 7-8 7V5z" />
            </svg>
            <CardTitle>Spelare</CardTitle>
            {schedule ? (
              <span className="text-sm text-neutral-500 ml-2">
                ({initialMatchPlayers.length} i truppen)
              </span>
            ) : null}
          </summary>
          <div className="mt-3">
            {match.teamId !== null ? (
              <PlayersSection
                matchId={match.id}
                teamPlayers={rosterPlayers}
                positions={posList.map((p) => ({
                  id: p.id,
                  name: p.name,
                  abbreviation: p.abbreviation,
                }))}
                initialMatchPlayers={initialMatchPlayers}
              />
            ) : (
              <AdHocPlayersSection
                matchId={match.id}
                orgPlayers={rosterPlayers}
                positions={posList.map((p) => ({
                  id: p.id,
                  name: p.name,
                  abbreviation: p.abbreviation,
                }))}
                initialMatchPlayers={initialMatchPlayers}
              />
            )}
          </div>
        </details>
      </Card>

      <Card className="mt-6">
        <div className="flex flex-wrap gap-3 items-center justify-between">
          <CardTitle>Schema</CardTitle>
          {prereqs.ok ? (
            <form action={generateScheduleAction}>
              <input type="hidden" name="matchId" value={match.id} />
              <Button type="submit" variant={schedule ? "secondary" : "primary"}>
                {schedule ? "Regenerera" : "Generera schema"}
              </Button>
            </form>
          ) : (
            <Button type="button" disabled variant="secondary">
              Generera schema
            </Button>
          )}
        </div>

        {sp.genError ? (
          <div className="mt-3 rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-900 whitespace-pre-wrap">
            {sp.genError}
          </div>
        ) : null}

        {sp.genOk && schedule ? (
          <div className="mt-3 rounded-md border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-900">
            Schema genererat.
          </div>
        ) : null}

        {!prereqs.ok ? (
          <div className="mt-3 rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
            <div className="font-medium mb-1">
              Det saknas något innan vi kan generera ett schema:
            </div>
            <ul className="list-disc ml-5 space-y-0.5">
              {prereqs.reasons.map((r, i) => (
                <li key={i}>{r}</li>
              ))}
            </ul>
          </div>
        ) : null}

        {!schedule ? (
          <p className="text-sm text-neutral-600 mt-3">
            Inget schema genererat ännu. Välj spelare och tryck på knappen.
          </p>
        ) : (
          <ScheduleView
            schedule={schedule}
            positions={posList}
            mps={mps}
            nameOf={nameOf}
            editStartButton={
              <EditStartLineupButton
                matchId={match.id}
                positions={posList.map((p) => ({
                  id: p.id,
                  name: p.name,
                  abbreviation: p.abbreviation,
                  isGoalkeeper: p.isGoalkeeper,
                }))}
                players={mps.map((mp) => ({
                  id: mp.id,
                  name: nameOf(mp),
                  playablePositionIds: mp.playablePositionIds ?? [],
                  preferredPositionIds: mp.preferredPositionIds ?? [],
                }))}
                initialLineup={schedule.periods[0]?.startLineup ?? []}
              />
            }
          />
        )}
      </Card>

      <Card className="mt-10 border-red-100">
        <CardTitle>Radera match</CardTitle>
        <p className="text-xs text-neutral-600 mt-1 mb-3">
          Raderar matchen och genererat schema permanent.
        </p>
        <form action={deleteMatch}>
          <input type="hidden" name="id" value={match.id} />
          <Button variant="danger" size="sm" type="submit">
            Radera match permanent
          </Button>
        </form>
      </Card>
    </div>
  );
}

type MpLike = {
  id: number;
  playerId: number | null;
  isGuest: boolean;
  guestName: string | null;
};

function ScheduleView({
  schedule,
  positions,
  mps,
  nameOf,
  editStartButton,
}: {
  schedule: Schedule;
  positions: {
    id: number;
    name: string;
    abbreviation: string;
    sortOrder: number;
    isGoalkeeper: boolean;
  }[];
  mps: MpLike[];
  nameOf: (mp: MpLike) => string;
  editStartButton?: React.ReactNode;
}) {
  const posNameMap = new Map(positions.map((p) => [p.id, p.abbreviation]));
  const nameByMpId = new Map(mps.map((mp) => [mp.id, nameOf(mp)]));

  return (
    <div className="mt-4 space-y-4">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-sm">
        <div className="p-3 rounded-md bg-neutral-50 border border-border">
          <div className="text-xs text-neutral-600">Score</div>
          <div className="text-lg font-semibold">
            {schedule.score.toFixed(1)}
          </div>
        </div>
        <div className="p-3 rounded-md bg-neutral-50 border border-border">
          <div className="text-xs text-neutral-600">Jämnhet</div>
          <div className="text-lg font-semibold">
            {(schedule.scoreBreakdown.minutesFairness * 100).toFixed(0)}%
          </div>
        </div>
        <div className="p-3 rounded-md bg-neutral-50 border border-border">
          <div className="text-xs text-neutral-600">Önskemål</div>
          <div className="text-lg font-semibold">
            {(schedule.scoreBreakdown.preferencesMet * 100).toFixed(0)}%
          </div>
        </div>
        <div className="p-3 rounded-md bg-neutral-50 border border-border">
          <div className="text-xs text-neutral-600">Variation</div>
          <div className="text-lg font-semibold">
            {schedule.scoreBreakdown.positionVariety}
          </div>
        </div>
      </div>

      {schedule.periods.map((period) => (
        <div
          key={period.index}
          className="border border-border rounded-md p-3"
        >
          <div className="flex items-center justify-between gap-2 mb-2">
            <div className="font-semibold">Period {period.index + 1}</div>
            {period.index === 0 && editStartButton ? editStartButton : null}
          </div>
          <div className="text-sm text-neutral-700 mb-2">
            <strong>Start:</strong>{" "}
            {period.startLineup
              .map(
                (s) =>
                  `${posNameMap.get(s.positionId) ?? "?"}: ${
                    nameByMpId.get(s.playerId) ?? "?"
                  }`
              )
              .join(" · ")}
          </div>
          {period.subPoints.length === 0 ? (
            <div className="text-xs text-neutral-500">Inga byten denna period.</div>
          ) : (
            <div className="space-y-1">
              {period.subPoints.map((sp, i) => (
                <div key={i} className="text-sm">
                  <span className="font-mono text-xs bg-neutral-100 px-1 rounded">
                    {sp.minuteInPeriod}&apos;
                  </span>{" "}
                  {sp.changes.length === 0 ? (
                    <span className="text-neutral-500">(inget byte)</span>
                  ) : (
                    sp.changes
                      .map(
                        (c) =>
                          `${posNameMap.get(c.positionId) ?? "?"}: ${
                            nameByMpId.get(c.outPlayerId) ?? "?"
                          } → ${nameByMpId.get(c.inPlayerId) ?? "?"}`
                      )
                      .join(" · ")
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      ))}

      <div className="border border-border rounded-md p-3">
        <div className="font-semibold mb-2">Speltid per spelare (prognos)</div>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-2 text-sm">
          {Object.entries(schedule.perPlayerMinutes).map(([mpIdStr, mins]) => (
            <div
              key={mpIdStr}
              className="flex justify-between py-1 border-b border-border/50"
            >
              <span>{nameByMpId.get(Number(mpIdStr)) ?? "?"}</span>
              <span className="font-mono">{mins} min</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
