"use server";

import { redirect } from "next/navigation";
import { createLoginToken } from "@/lib/auth";
import { sendMagicLinkEmail } from "@/lib/email";

export async function requestLoginLink(formData: FormData) {
  const email = String(formData.get("email") ?? "").trim();
  let sent: "resend" | "console";
  try {
    const token = await createLoginToken(email);
    const base = process.env.APP_URL ?? "http://localhost:3000";
    const url = `${base}/login/verify?token=${token}`;

    const result = await sendMagicLinkEmail({ to: email, url });
    if (!result.ok) {
      redirect(
        `/login?error=${encodeURIComponent("Kunde inte skicka mejl: " + result.error)}`
      );
    }
    sent = result.via;
  } catch (e) {
    if (e && typeof e === "object" && "digest" in e) throw e;
    const msg = e instanceof Error ? e.message : "Kunde inte skapa login-länk";
    redirect(`/login?error=${encodeURIComponent(msg)}`);
  }
  redirect(`/login?sent=${sent}`);
}
