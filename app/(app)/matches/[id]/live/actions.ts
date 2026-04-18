"use server";

import { eq } from "drizzle-orm";
import { assertTeamAccessible, requireUserId } from "@/lib/auth";
import { db } from "@/lib/db/client";
import { matches } from "@/lib/db/schema";
import { finishMatch } from "../../actions";

export async function persistLiveState(matchId: number, state: unknown) {
  const userId = await requireUserId();
  const [row] = await db
    .select()
    .from(matches)
    .where(eq(matches.id, matchId))
    .limit(1);
  if (!row) throw new Error("Match saknas");
  await assertTeamAccessible(row.teamId, userId);
  await db
    .update(matches)
    .set({ liveStateJson: state as object })
    .where(eq(matches.id, matchId));
  return { ok: true };
}

export { finishMatch };
