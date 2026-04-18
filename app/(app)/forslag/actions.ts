"use server";

import { and, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireUserId } from "@/lib/auth";
import { db } from "@/lib/db/client";
import { features, featureVotes } from "@/lib/db/schema";
import type { FeatureRow } from "./types";

export async function listFeatures(): Promise<FeatureRow[]> {
  const userId = await requireUserId();
  const featureRows = await db.select().from(features);
  const voteRows = await db.select().from(featureVotes);

  const countByFeature = new Map<number, number>();
  const myVotedSet = new Set<number>();
  for (const v of voteRows) {
    countByFeature.set(
      v.featureId,
      (countByFeature.get(v.featureId) ?? 0) + 1
    );
    if (v.userId === userId) myVotedSet.add(v.featureId);
  }

  return featureRows
    .map((f) => ({
      id: f.id,
      title: f.title,
      description: f.description,
      status: f.status,
      votes: countByFeature.get(f.id) ?? 0,
      myVote: myVotedSet.has(f.id),
      createdByUserId: f.createdByUserId,
      createdAt: f.createdAt.toISOString(),
    }))
    .sort((a, b) => {
      if (b.votes !== a.votes) return b.votes - a.votes;
      return b.createdAt.localeCompare(a.createdAt);
    });
}

const FeatureInput = z.object({
  title: z.string().trim().min(3, "Minst 3 tecken").max(120),
  description: z
    .string()
    .trim()
    .max(800)
    .optional()
    .transform((v) => (v && v.length > 0 ? v : null)),
});

export async function submitFeature(
  formData: FormData
): Promise<{ ok: boolean; error?: string }> {
  const userId = await requireUserId();
  const parsed = FeatureInput.safeParse({
    title: formData.get("title"),
    description: formData.get("description"),
  });
  if (!parsed.success) {
    return {
      ok: false,
      error: parsed.error.issues.map((i) => i.message).join(", "),
    };
  }
  const [inserted] = await db
    .insert(features)
    .values({
      title: parsed.data.title,
      description: parsed.data.description,
      createdByUserId: userId,
    })
    .returning();
  // Auto-vote for your own suggestion
  await db
    .insert(featureVotes)
    .values({ featureId: inserted.id, userId })
    .onConflictDoNothing();
  revalidatePath("/forslag");
  return { ok: true };
}

export async function toggleVote(
  featureId: number
): Promise<{ voted: boolean }> {
  const userId = await requireUserId();
  const existing = await db
    .select()
    .from(featureVotes)
    .where(
      and(eq(featureVotes.featureId, featureId), eq(featureVotes.userId, userId))
    )
    .limit(1);
  if (existing.length > 0) {
    await db.delete(featureVotes).where(eq(featureVotes.id, existing[0].id));
    revalidatePath("/forslag");
    return { voted: false };
  }
  await db
    .insert(featureVotes)
    .values({ featureId, userId })
    .onConflictDoNothing();
  revalidatePath("/forslag");
  return { voted: true };
}

/** For the dashboard banner: count of open features the user hasn't voted on. */
export async function unvotedFeatureCount(): Promise<number> {
  const userId = await requireUserId();
  const open = await db
    .select()
    .from(features)
    .where(eq(features.status, "open"));
  if (open.length === 0) return 0;
  const myVotes = await db
    .select()
    .from(featureVotes)
    .where(eq(featureVotes.userId, userId));
  const votedOn = new Set(myVotes.map((v) => v.featureId));
  return open.filter((f) => !votedOn.has(f.id)).length;
}

