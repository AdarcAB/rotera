"use server";

import { redirect } from "next/navigation";
import { consumeOtp, createLoginToken, setSession } from "@/lib/auth";
import { sendMagicLinkEmail } from "@/lib/email";

export async function requestLoginLink(formData: FormData) {
  const email = String(formData.get("email") ?? "").trim();
  let sent: "resend" | "console";
  let normalized: string;
  try {
    const { token, otp, normalizedEmail } = await createLoginToken(email);
    normalized = normalizedEmail;
    const base = process.env.APP_URL ?? "http://localhost:3000";
    const url = `${base}/login/verify?token=${token}`;
    const result = await sendMagicLinkEmail({ to: normalizedEmail, url, otp });
    if (!result.ok) {
      redirect(
        `/login?error=${encodeURIComponent("Kunde inte skicka mejl: " + result.error)}`
      );
    }
    sent = result.via;
  } catch (e) {
    if (e && typeof e === "object" && "digest" in e) throw e;
    const msg = e instanceof Error ? e.message : "Kunde inte logga in";
    redirect(`/login?error=${encodeURIComponent(msg)}`);
  }
  redirect(`/login?sent=${sent}&email=${encodeURIComponent(normalized)}`);
}

export async function verifyOtp(formData: FormData) {
  const email = String(formData.get("email") ?? "").trim();
  const otp = String(formData.get("otp") ?? "").trim();
  const userId = await consumeOtp(email, otp);
  if (!userId) {
    redirect(
      `/login?sent=resend&email=${encodeURIComponent(email)}&otpError=${encodeURIComponent(
        "Ogiltig eller förbrukad kod."
      )}`
    );
  }
  await setSession(userId);
  redirect("/dashboard");
}
