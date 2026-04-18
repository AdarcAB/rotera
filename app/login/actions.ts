"use server";

import { redirect } from "next/navigation";
import {
  consumeOtp,
  findOrCreateUserByEmail,
  setSession,
} from "@/lib/auth";

const EMAIL_ONLY_LOGIN = true;

export async function requestLoginLink(formData: FormData) {
  const email = String(formData.get("email") ?? "").trim();
  try {
    if (EMAIL_ONLY_LOGIN) {
      const { userId } = await findOrCreateUserByEmail(email);
      await setSession(userId);
      redirect("/dashboard");
    }
    // Full magic-link + OTP flow is kept for when EMAIL_ONLY_LOGIN is flipped
    // off. The imports are intentionally retained above for that flow.
  } catch (e) {
    if (e && typeof e === "object" && "digest" in e) throw e;
    const msg = e instanceof Error ? e.message : "Kunde inte logga in";
    redirect(`/login?error=${encodeURIComponent(msg)}`);
  }
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
