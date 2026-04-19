"use server";

import { eq } from "drizzle-orm";
import { assertMatchAccessible, requireUserId } from "@/lib/auth";
import { db } from "@/lib/db/client";
import { matches } from "@/lib/db/schema";
import { finishMatch } from "../../actions";

export async function persistLiveState(matchId: number, state: unknown) {
  const userId = await requireUserId();
  await assertMatchAccessible(matchId, userId);
  await db
    .update(matches)
    .set({ liveStateJson: state as object })
    .where(eq(matches.id, matchId));
  return { ok: true };
}

export { finishMatch };
