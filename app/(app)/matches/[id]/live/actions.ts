"use server";

import { and, eq } from "drizzle-orm";
import { requireUserId } from "@/lib/auth";
import { db } from "@/lib/db/client";
import { matches } from "@/lib/db/schema";
import { finishMatch } from "../../actions";

export async function persistLiveState(matchId: number, state: unknown) {
  const userId = await requireUserId();
  const [row] = await db
    .select()
    .from(matches)
    .where(and(eq(matches.id, matchId), eq(matches.userId, userId)))
    .limit(1);
  if (!row) throw new Error("Match saknas");
  await db
    .update(matches)
    .set({ liveStateJson: state as object })
    .where(eq(matches.id, matchId));
  return { ok: true };
}

export { finishMatch };
