"use server";

import { and, asc, eq, ne } from "drizzle-orm";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireUserId } from "@/lib/auth";
import { db } from "@/lib/db/client";
import { formations, positions } from "@/lib/db/schema";

const FormationInput = z.object({
  name: z.string().trim().min(1).max(80),
  playersOnField: z.coerce.number().int().min(3).max(11),
  numPeriods: z.coerce.number().int().min(1).max(8),
  minutesPerPeriod: z.coerce.number().int().min(1).max(90),
  minSubsPerPeriod: z.coerce.number().int().min(0).max(10),
  maxSubsPerPeriod: z.coerce.number().int().min(0).max(10),
  isDefault: z
    .union([z.literal("on"), z.literal("true"), z.literal("false"), z.literal("")])
    .optional()
    .transform((v) => v === "on" || v === "true"),
});

export async function createFormation(formData: FormData) {
  const userId = await requireUserId();
  const parsed = FormationInput.parse(Object.fromEntries(formData.entries()));
  if (parsed.maxSubsPerPeriod < parsed.minSubsPerPeriod) {
    throw new Error("Max byten måste vara ≥ min byten");
  }

  const [inserted] = await db
    .insert(formations)
    .values({ userId, ...parsed })
    .returning();

  if (parsed.isDefault) {
    await db
      .update(formations)
      .set({ isDefault: false })
      .where(
        and(eq(formations.userId, userId), ne(formations.id, inserted.id))
      );
  }

  const seed: { name: string; abbreviation: string }[] = [];
  for (let i = 0; i < parsed.playersOnField; i++) {
    seed.push({
      name: `Position ${i + 1}`,
      abbreviation: `P${i + 1}`,
    });
  }
  await db.insert(positions).values(
    seed.map((p, i) => ({
      formationId: inserted.id,
      name: p.name,
      abbreviation: p.abbreviation,
      sortOrder: i,
    }))
  );

  revalidatePath("/formations");
  redirect(`/formations/${inserted.id}`);
}

async function assertFormationOwned(formationId: number, userId: number) {
  const rows = await db
    .select()
    .from(formations)
    .where(and(eq(formations.id, formationId), eq(formations.userId, userId)))
    .limit(1);
  if (rows.length === 0) throw new Error("Spelform saknas eller fel ägare");
  return rows[0];
}

export async function updateFormation(formData: FormData) {
  const userId = await requireUserId();
  const id = Number(formData.get("id"));
  await assertFormationOwned(id, userId);
  const parsed = FormationInput.parse(Object.fromEntries(formData.entries()));
  if (parsed.maxSubsPerPeriod < parsed.minSubsPerPeriod) {
    throw new Error("Max byten måste vara ≥ min byten");
  }
  await db
    .update(formations)
    .set({
      name: parsed.name,
      playersOnField: parsed.playersOnField,
      numPeriods: parsed.numPeriods,
      minutesPerPeriod: parsed.minutesPerPeriod,
      minSubsPerPeriod: parsed.minSubsPerPeriod,
      maxSubsPerPeriod: parsed.maxSubsPerPeriod,
      isDefault: parsed.isDefault,
    })
    .where(eq(formations.id, id));

  if (parsed.isDefault) {
    await db
      .update(formations)
      .set({ isDefault: false })
      .where(and(eq(formations.userId, userId), ne(formations.id, id)));
  }

  revalidatePath(`/formations/${id}`);
  revalidatePath("/formations");
  revalidatePath("/matches");
}

export async function deleteFormation(formData: FormData) {
  const userId = await requireUserId();
  const id = Number(formData.get("id"));
  await assertFormationOwned(id, userId);
  await db.delete(formations).where(eq(formations.id, id));
  revalidatePath("/formations");
  redirect("/formations");
}

const PositionInput = z.object({
  name: z.string().trim().min(1).max(60),
  abbreviation: z.string().trim().min(1).max(6),
});

export async function updatePositions(formData: FormData) {
  const userId = await requireUserId();
  const formationId = Number(formData.get("formationId"));
  await assertFormationOwned(formationId, userId);

  const existing = await db
    .select()
    .from(positions)
    .where(eq(positions.formationId, formationId))
    .orderBy(asc(positions.sortOrder));

  for (let i = 0; i < existing.length; i++) {
    const row = existing[i];
    const name = String(formData.get(`name_${row.id}`) ?? "");
    const abbr = String(formData.get(`abbr_${row.id}`) ?? "");
    const parsed = PositionInput.parse({ name, abbreviation: abbr });
    await db
      .update(positions)
      .set({ name: parsed.name, abbreviation: parsed.abbreviation, sortOrder: i })
      .where(eq(positions.id, row.id));
  }
  revalidatePath(`/formations/${formationId}`);
}
