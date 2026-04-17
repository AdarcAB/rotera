import { and, asc, eq } from "drizzle-orm";
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
  teams,
} from "@/lib/db/schema";
import { Card, CardTitle } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Field, Input, Label } from "@/components/ui/Input";
import {
  addGuest,
  deleteMatch,
  generateScheduleAction,
  removeMatchPlayer,
  saveCalledPlayers,
  savePositionSelections,
  startLive,
} from "../actions";
import type { Schedule } from "@/lib/schedule/types";

export default async function MatchPage({
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
    .where(and(eq(matches.id, matchId), eq(matches.userId, userId)))
    .limit(1);
  if (!match) notFound();

  const [team, formation, teamPlayers, posList, mps] = await Promise.all([
    db.select().from(teams).where(eq(teams.id, match.teamId)).limit(1).then((r) => r[0]),
    db.select().from(formations).where(eq(formations.id, match.formationId)).limit(1).then((r) => r[0]),
    db.select().from(players).where(eq(players.teamId, match.teamId)).orderBy(players.name),
    db.select().from(positions).where(eq(positions.formationId, match.formationId)).orderBy(asc(positions.sortOrder)),
    db.select().from(matchPlayers).where(eq(matchPlayers.matchId, matchId)),
  ]);

  const calledByPlayerId = new Set(mps.map((mp) => mp.playerId).filter((v): v is number => v !== null));
  const guestMps = mps.filter((mp) => mp.isGuest);
  const playerMps = mps.filter((mp) => !mp.isGuest);
  const nameOf = (mp: {
    isGuest: boolean;
    guestName: string | null;
    playerId: number | null;
  }) => {
    if (mp.isGuest) return mp.guestName ?? "Gäst";
    const p = teamPlayers.find((p) => p.id === mp.playerId);
    return p?.name ?? "Okänd";
  };

  const schedule = match.generatedScheduleJson as Schedule | null;

  return (
    <div>
      <Link href="/matches" className="text-sm text-neutral-600 hover:underline">
        ← Matcher
      </Link>

      <div className="flex flex-wrap gap-3 items-start justify-between mt-2 mb-6">
        <div>
          <h1 className="text-2xl font-bold">vs {match.opponent}</h1>
          <div className="text-sm text-neutral-600 mt-1">
            {team.name} · {formation.name} ·{" "}
            {match.playedAt
              ? new Date(match.playedAt).toLocaleString("sv-SE")
              : "Utan datum"}
            {match.location ? ` · ${match.location}` : ""}
          </div>
        </div>

        <div className="flex gap-2">
          {schedule ? (
            <form action={startLive}>
              <input type="hidden" name="matchId" value={match.id} />
              <Button type="submit" size="lg">
                ▶ Starta live-läge
              </Button>
            </form>
          ) : null}
          {match.status === "live" ? (
            <Link
              href={`/matches/${match.id}/live`}
              className="inline-flex h-12 px-6 items-center justify-center rounded-md bg-red-600 text-white font-medium"
            >
              🔴 Gå till live
            </Link>
          ) : null}
        </div>
      </div>

      <div className="grid md:grid-cols-2 gap-4">
        <Card>
          <CardTitle>Kallade spelare</CardTitle>
          <p className="text-xs text-neutral-600 mt-1 mb-3">
            Välj vilka från laget som spelar den här matchen.
          </p>
          <form action={saveCalledPlayers} className="mt-2">
            <input type="hidden" name="matchId" value={match.id} />
            <div className="max-h-64 overflow-auto border border-border rounded-md p-2">
              {teamPlayers.length === 0 ? (
                <p className="text-sm text-neutral-600">
                  Inga spelare i laget.{" "}
                  <Link href={`/teams/${team.id}`} className="text-primary hover:underline">
                    Lägg till här
                  </Link>
                  .
                </p>
              ) : (
                teamPlayers.map((p) => (
                  <label key={p.id} className="flex items-center gap-2 py-1">
                    <input
                      type="checkbox"
                      name="called"
                      value={p.id}
                      defaultChecked={calledByPlayerId.has(p.id)}
                      className="w-4 h-4"
                    />
                    <span className="text-sm">
                      {p.name}
                      {p.nickname ? (
                        <span className="text-neutral-500"> ({p.nickname})</span>
                      ) : null}
                    </span>
                  </label>
                ))
              )}
            </div>
            <Button type="submit" className="mt-3" variant="secondary">
              Spara kallade
            </Button>
          </form>

          <div className="mt-6 border-t border-border pt-4">
            <div className="font-medium mb-2">Gästspelare</div>
            <form action={addGuest} className="flex gap-2">
              <input type="hidden" name="matchId" value={match.id} />
              <Input name="guestName" placeholder="Gästens namn" maxLength={60} />
              <Button type="submit" variant="secondary">
                Lägg till
              </Button>
            </form>
            {guestMps.length > 0 ? (
              <ul className="mt-2 text-sm">
                {guestMps.map((mp) => (
                  <li key={mp.id} className="flex items-center justify-between py-1">
                    <span>{mp.guestName}</span>
                    <form action={removeMatchPlayer}>
                      <input type="hidden" name="matchId" value={match.id} />
                      <input type="hidden" name="id" value={mp.id} />
                      <button className="text-red-600 hover:underline">Ta bort</button>
                    </form>
                  </li>
                ))}
              </ul>
            ) : null}
          </div>
        </Card>

        <Card>
          <CardTitle>Positioner per spelare</CardTitle>
          <p className="text-xs text-neutral-600 mt-1 mb-3">
            Markera vilka positioner varje spelare <em>kan</em> spela (spelbara) och
            vilka hen föredrar (önskade, delmängd).
          </p>
          {mps.length === 0 ? (
            <p className="text-sm text-neutral-600">
              Kalla spelare till matchen först.
            </p>
          ) : (
            <form action={savePositionSelections}>
              <input type="hidden" name="matchId" value={match.id} />
              <div className="space-y-4 max-h-96 overflow-auto">
                {mps.map((mp) => (
                  <div
                    key={mp.id}
                    className="border border-border rounded-md p-3"
                  >
                    <div className="font-medium mb-2">{nameOf(mp)}</div>
                    <div className="text-xs text-neutral-600 mb-1">Spelbara</div>
                    <div className="grid grid-cols-2 gap-1 mb-2">
                      {posList.map((pos) => (
                        <label
                          key={pos.id}
                          className="flex items-center gap-1 text-sm"
                        >
                          <input
                            type="checkbox"
                            name={`playable_${mp.id}`}
                            value={pos.id}
                            defaultChecked={(mp.playablePositionIds ?? []).includes(pos.id)}
                          />
                          <span>
                            {pos.abbreviation}{" "}
                            <span className="text-neutral-500">({pos.name})</span>
                          </span>
                        </label>
                      ))}
                    </div>
                    <div className="text-xs text-neutral-600 mb-1">Önskade</div>
                    <div className="grid grid-cols-2 gap-1">
                      {posList.map((pos) => (
                        <label
                          key={pos.id}
                          className="flex items-center gap-1 text-sm"
                        >
                          <input
                            type="checkbox"
                            name={`preferred_${mp.id}`}
                            value={pos.id}
                            defaultChecked={(mp.preferredPositionIds ?? []).includes(pos.id)}
                          />
                          <span>{pos.abbreviation}</span>
                        </label>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
              <Button type="submit" className="mt-3">
                Spara positioner
              </Button>
            </form>
          )}
        </Card>
      </div>

      <Card className="mt-6">
        <div className="flex flex-wrap gap-3 items-center justify-between">
          <CardTitle>Schema</CardTitle>
          <form action={generateScheduleAction}>
            <input type="hidden" name="matchId" value={match.id} />
            <Button type="submit" variant={schedule ? "secondary" : "primary"}>
              {schedule ? "Regenerera" : "Generera schema"}
            </Button>
          </form>
        </div>

        {!schedule ? (
          <p className="text-sm text-neutral-600 mt-3">
            Inget schema genererat ännu. Kalla spelare, ange positioner, och klicka
            "Generera schema".
          </p>
        ) : (
          <ScheduleView schedule={schedule} positions={posList} mps={mps} nameOf={nameOf} />
        )}
      </Card>

      <Card className="mt-6 border-red-100">
        <CardTitle>Radera match</CardTitle>
        <form action={deleteMatch} className="mt-2">
          <input type="hidden" name="id" value={match.id} />
          <Button variant="danger" size="sm" type="submit">
            Radera permanent
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
}: {
  schedule: Schedule;
  positions: { id: number; name: string; abbreviation: string; sortOrder: number }[];
  mps: MpLike[];
  nameOf: (mp: MpLike) => string;
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
          <div className="font-semibold mb-2">Period {period.index + 1}</div>
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
