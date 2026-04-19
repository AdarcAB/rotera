"use server";

import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { assertMatchAccessible, requireUserId } from "@/lib/auth";
import { db } from "@/lib/db/client";
import { matches } from "@/lib/db/schema";
import { finishMatch } from "../../actions";

export async function persistLiveState(matchId: number, state: unknown) {
  const userId = await requireUserId();
  const match = await assertMatchAccessible(matchId, userId);
  const s = state as { status?: string };
  const isActive = s.status === "running" || s.status === "paused";
  const shouldFlipToLive = isActive && match.status !== "live";
  await db
    .update(matches)
    .set(
      shouldFlipToLive
        ? { liveStateJson: state as object, status: "live" }
        : { liveStateJson: state as object }
    )
    .where(eq(matches.id, matchId));
  // Refresh the app layout so the sticky live banner appears the moment
  // the coach actually starts play.
  if (shouldFlipToLive) revalidatePath("/", "layout");
  return { ok: true };
}

export { finishMatch };
