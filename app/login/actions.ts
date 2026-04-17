"use server";

import { redirect } from "next/navigation";
import { createLoginToken } from "@/lib/auth";

export async function requestLoginLink(formData: FormData) {
  const email = String(formData.get("email") ?? "").trim();
  try {
    const token = await createLoginToken(email);
    const base = process.env.APP_URL ?? "http://localhost:3000";
    const url = `${base}/login/verify?token=${token}`;
    console.log("\n================ ROTERA MAGIC LINK ================");
    console.log(`  E-post: ${email}`);
    console.log(`  Länk:   ${url}`);
    console.log("===================================================\n");
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Kunde inte skapa login-länk";
    redirect(`/login?error=${encodeURIComponent(msg)}`);
  }
  redirect("/login?sent=1");
}
