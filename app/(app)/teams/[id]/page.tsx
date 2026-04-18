import { and, eq, inArray } from "drizzle-orm";
import { notFound } from "next/navigation";
import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db/client";
import {
  formations,
  matchPlayers,
  matches,
  players,
  teamMembers,
  teams,
} from "@/lib/db/schema";
import { Button } from "@/components/ui/Button";
import { Card, CardTitle } from "@/components/ui/Card";
import { TeamNameEdit } from "@/components/TeamNameEdit";
import { PlayersTable } from "@/components/PlayersTable";
import { TeamMembersSection } from "@/components/TeamMembersSection";
import { deleteTeam, listTeamMembersAndInvites } from "../actions";
import { fairScore, optimalMinutes, verdictFor } from "@/lib/stats";

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

  // ── Season stats: fair score per player across finished matches ──
  const finishedMatches = await db
    .select()
    .from(matches)
    .where(and(eq(matches.teamId, teamId), eq(matches.status, "finished")));

  type PlayerStat = {
    playerId: number;
    name: string;
    matches: number;
    totalMinutes: number;
    avgFairScore: number; // mean across matches player was called to
  };
  const statsByPlayer = new Map<number, { scoreSum: number; matches: number; minutes: number }>();

  if (finishedMatches.length > 0) {
    const formationsById = new Map<number, typeof finishedMatches extends (infer _)[] ? never : never>();
    const formIds = Array.from(
      new Set(finishedMatches.map((m) => m.formationId))
    );
    const formRows = await db
      .select()
      .from(formations)
      .where(inArray(formations.id, formIds));
    const formMap = new Map(formRows.map((f) => [f.id, f]));

    const mpRows = await db
      .select()
      .from(matchPlayers)
      .where(
        inArray(
          matchPlayers.matchId,
          finishedMatches.map((m) => m.id)
        )
      );

    const mpByMatch = new Map<number, typeof mpRows>();
    for (const mp of mpRows) {
      const arr = mpByMatch.get(mp.matchId) ?? [];
      arr.push(mp);
      mpByMatch.set(mp.matchId, arr);
    }

    for (const match of finishedMatches) {
      const form = formMap.get(match.formationId);
      if (!form) continue;
      const roster = mpByMatch.get(match.id) ?? [];
      if (roster.length === 0) continue;
      const optimal = optimalMinutes({
        minutesPerPeriod: form.minutesPerPeriod,
        numPeriods: form.numPeriods,
        playersOnField: form.playersOnField,
        troupSize: roster.length,
      });
      for (const mp of roster) {
        if (mp.playerId === null) continue; // skip guests for now
        const score = fairScore(mp.actualMinutesPlayed, optimal);
        const agg = statsByPlayer.get(mp.playerId) ?? {
          scoreSum: 0,
          matches: 0,
          minutes: 0,
        };
        agg.scoreSum += score;
        agg.matches += 1;
        agg.minutes += mp.actualMinutesPlayed;
        statsByPlayer.set(mp.playerId, agg);
      }
    }
    // Silence unused variable warning
    void formationsById;
  }

  const statsList: PlayerStat[] = Array.from(statsByPlayer.entries()).map(
    ([playerId, agg]) => {
      const p = playerList.find((pp) => pp.id === playerId);
      return {
        playerId,
        name: p?.name ?? "Okänd",
        matches: agg.matches,
        totalMinutes: agg.minutes,
        avgFairScore: agg.matches > 0 ? agg.scoreSum / agg.matches : 0,
      };
    }
  );
  statsList.sort((a, b) => a.avgFairScore - b.avgFairScore);

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

      {statsList.length > 0 ? (
        <Card className="mt-6">
          <CardTitle>Säsongsstatistik</CardTitle>
          <p className="text-sm text-neutral-700 mt-1 mb-3">
            Baserat på {finishedMatches.length} avslutad
            {finishedMatches.length === 1 ? " match" : "a matcher"}.{" "}
            <strong>Fair score</strong>: 100 = rättvis speltid. Under = för
            lite, över = för mycket. Sorterat stigande så underspelade visas
            först — det är där coachen har jobb att göra.
          </p>
          <ul className="mt-3 divide-y divide-border">
            {statsList.map((s) => {
              const v = verdictFor(s.avgFairScore);
              const color =
                v === "perfect"
                  ? "text-emerald-700 bg-emerald-50 border-emerald-200"
                  : v === "close"
                    ? "text-neutral-700 bg-neutral-50 border-border"
                    : v === "heavy"
                      ? "text-amber-800 bg-amber-50 border-amber-200"
                      : "text-sky-800 bg-sky-50 border-sky-200";
              return (
                <li
                  key={s.playerId}
                  className="py-3 flex items-center justify-between gap-3"
                >
                  <div className="flex-1 min-w-0">
                    <div className="font-medium">{s.name}</div>
                    <div className="text-xs text-neutral-600 mt-0.5">
                      {s.matches} {s.matches === 1 ? "match" : "matcher"} ·{" "}
                      {s.totalMinutes}′ totalt
                    </div>
                  </div>
                  <div
                    className={`w-16 shrink-0 text-center py-1 rounded-md border font-mono text-sm font-semibold ${color}`}
                    title="Snittfärg: Grön ±5, Grå ±15, Amber > +15, Blå < -15"
                  >
                    {Math.round(s.avgFairScore)}
                  </div>
                </li>
              );
            })}
          </ul>
        </Card>
      ) : null}

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
