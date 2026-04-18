"use server";

import { and, eq, sql } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireUserId } from "@/lib/auth";
import { db } from "@/lib/db/client";
import { features, featureVotes } from "@/lib/db/schema";
import type { FeatureRow } from "./types";

export async function listFeatures(): Promise<FeatureRow[]> {
  const userId = await requireUserId();
  const rows = await db.execute(sql`
    SELECT
      f.id,
      f.title,
      f.description,
      f.status,
      f.created_by_user_id AS "createdByUserId",
      f.created_at AS "createdAt",
      COALESCE(COUNT(v.id), 0)::int AS votes,
      BOOL_OR(v.user_id = ${userId}) AS "myVote"
    FROM features f
    LEFT JOIN feature_votes v ON v.feature_id = f.id
    GROUP BY f.id
    ORDER BY votes DESC, f.created_at DESC
  `);
  type Row = {
    id: number;
    title: string;
    description: string | null;
    status: string;
    createdByUserId: number | null;
    createdAt: Date;
    votes: number;
    myVote: boolean | null;
  };
  return (rows.rows as unknown as Row[]).map((r) => ({
    id: r.id,
    title: r.title,
    description: r.description,
    status: r.status,
    votes: r.votes,
    myVote: !!r.myVote,
    createdByUserId: r.createdByUserId,
    createdAt: r.createdAt.toISOString(),
  }));
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

/** For the dashboard banner: count of features the user hasn't voted on yet. */
export async function unvotedFeatureCount(): Promise<number> {
  const userId = await requireUserId();
  const rows = await db.execute(sql`
    SELECT COUNT(*)::int AS c
    FROM features f
    WHERE f.status = 'open'
      AND NOT EXISTS (
        SELECT 1 FROM feature_votes v
        WHERE v.feature_id = f.id AND v.user_id = ${userId}
      )
  `);
  const first = rows.rows[0] as unknown as { c: number };
  return first?.c ?? 0;
}

