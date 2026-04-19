import { asc, eq } from "drizzle-orm";
import { notFound } from "next/navigation";
import Link from "next/link";
import { assertMatchAccessible, requireUserId } from "@/lib/auth";
import { db } from "@/lib/db/client";
import {
  formations,
  matchPlayers,
  players,
  positions,
  teamPlayers as teamPlayersTable,
} from "@/lib/db/schema";
import type { Schedule } from "@/lib/schedule/types";
import { LiveMatch } from "./LiveMatch";

export default async function LivePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const matchId = Number(id);
  const userId = await requireUserId();

  let match;
  try {
    match = await assertMatchAccessible(matchId, userId);
  } catch {
    notFound();
  }

  const schedule = match.generatedScheduleJson as Schedule | null;
  if (!schedule) {
    return (
      <div>
        <Link
          href={`/matches/${matchId}`}
          className="text-sm text-neutral-600 hover:underline"
        >
          ← Tillbaka
        </Link>
        <p className="mt-4">
          Inget schema genererat än. Gå tillbaka och klicka "Generera schema".
        </p>
      </div>
    );
  }

  const [formation, posList, mps, rosterPlayers] = await Promise.all([
    db
      .select()
      .from(formations)
      .where(eq(formations.id, match.formationId))
      .limit(1)
      .then((r) => r[0]),
    db
      .select()
      .from(positions)
      .where(eq(positions.formationId, match.formationId))
      .orderBy(asc(positions.sortOrder)),
    db.select().from(matchPlayers).where(eq(matchPlayers.matchId, matchId)),
    match.teamId
      ? db
          .select({ id: players.id, name: players.name })
          .from(players)
          .innerJoin(teamPlayersTable, eq(teamPlayersTable.playerId, players.id))
          .where(eq(teamPlayersTable.teamId, match.teamId))
      : match.orgTeamId
      ? db
          .select({ id: players.id, name: players.name })
          .from(players)
          .where(eq(players.orgTeamId, match.orgTeamId))
      : Promise.resolve([] as { id: number; name: string }[]),
  ]);

  const nameOf = (mp: (typeof mps)[number]) => {
    if (mp.isGuest) return mp.guestName ?? "Gäst";
    const p = rosterPlayers.find((p) => p.id === mp.playerId);
    return p?.name ?? "Okänd";
  };

  const positionMap = Object.fromEntries(
    posList.map((p) => [p.id, { name: p.name, abbreviation: p.abbreviation }])
  );
  const playerMap = Object.fromEntries(
    mps.map((mp) => [mp.id, nameOf(mp)])
  );
  const playerMeta = Object.fromEntries(
    mps.map((mp) => [
      mp.id,
      {
        playablePositionIds: mp.playablePositionIds ?? [],
        preferredPositionIds: mp.preferredPositionIds ?? [],
      },
    ])
  );

  return (
    <LiveMatch
      matchId={matchId}
      schedule={schedule}
      minutesPerPeriod={formation.minutesPerPeriod}
      numPeriods={formation.numPeriods}
      positionMap={positionMap}
      playerMap={playerMap}
      playerMeta={playerMeta}
      initialLiveState={(match.liveStateJson as LiveState | null) ?? null}
    />
  );
}

export type PlayerMeta = {
  playablePositionIds: number[];
  preferredPositionIds: number[];
};

export type AdHocSub = {
  periodIndex: number;
  minuteInPeriod: number;
  positionId: number;
  outPlayerId: number;
  inPlayerId: number;
};

export type CompletedSubPoint = {
  periodIndex: number;
  subPointIndex: number;
  /**
   * Subset of position IDs from the subPoint whose changes were actually
   * applied. Omit to mean "all changes applied" (backwards compat).
   */
  appliedPositionIds?: number[];
};

export type LiveState = {
  status: "pre_period" | "running" | "paused" | "finished";
  currentPeriodIndex: number;
  resumedAt: string | null;
  elapsedBeforePause: number;
  completedSubPoints: CompletedSubPoint[];
  adHocSubs?: AdHocSub[];
};
