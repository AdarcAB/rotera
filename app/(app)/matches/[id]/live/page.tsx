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

  const [formation, posList, mps, teamPlayers] = await Promise.all([
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
    db.select().from(players).where(eq(players.teamId, match.teamId)),
  ]);

  const nameOf = (mp: (typeof mps)[number]) => {
    if (mp.isGuest) return mp.guestName ?? "Gäst";
    const p = teamPlayers.find((p) => p.id === mp.playerId);
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
