"use server";

import { eq } from "drizzle-orm";
import { redirect } from "next/navigation";
import { clearSession, requireUser } from "@/lib/auth";
import { db } from "@/lib/db/client";
import { users } from "@/lib/db/schema";

export async function deleteAccount(formData: FormData) {
  const user = await requireUser();
  const confirmation = String(formData.get("confirmation") ?? "")
    .trim()
    .toLowerCase();

  if (confirmation !== user.email.toLowerCase()) {
    redirect(
      `/konto?error=${encodeURIComponent(
        "Bekräftelsen måste vara exakt din e-postadress."
      )}`
    );
  }

  // Cascade-deletes all user data via FK onDelete: cascade on teams, formations,
  // matches and auth_tokens (matchPlayers, players, positions transitively).
  await db.delete(users).where(eq(users.id, user.id));
  await clearSession();
  redirect("/?deleted=1");
}
