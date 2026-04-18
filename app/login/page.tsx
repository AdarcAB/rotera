import Link from "next/link";
import { requestLoginLink, verifyOtp } from "./actions";
import { Button } from "@/components/ui/Button";
import { Field, Input, Label } from "@/components/ui/Input";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{
    sent?: "resend" | "console";
    email?: string;
    error?: string;
    otpError?: string;
  }>;
}) {
  const sp = await searchParams;
  return (
    <div className="flex-1 flex items-center justify-center p-6">
      <div className="w-full max-w-md rounded-lg border border-border bg-white p-6 shadow-sm">
        <Link href="/" className="text-sm text-neutral-500 hover:underline">
          ← Startsida
        </Link>
        <h1 className="text-2xl font-semibold mt-3 mb-1">Logga in</h1>
        <p className="text-sm text-neutral-700 mb-4">
          Ange din e-post så mejlar vi en länk för att logga in. Länken gäller i
          30 minuter och kan bara användas en gång.
        </p>

        {sp.sent === "resend" ? (
          <div className="rounded-md bg-emerald-50 border border-emerald-200 p-3 text-sm text-emerald-900 mb-4">
            Mejl skickat till <strong>{sp.email}</strong>. Klicka länken i
            mejlet — <em>eller</em> fyll i koden nedan.
          </div>
        ) : null}

        {sp.sent === "console" ? (
          <div className="rounded-md bg-amber-50 border border-amber-200 p-3 text-sm text-amber-900 mb-4">
            Magic-link genererad i serverkonsolen (dev-läge — ingen{" "}
            <code className="font-mono">RESEND_API_KEY</code> satt).
          </div>
        ) : null}

        {sp.error ? (
          <div className="rounded-md bg-red-50 border border-red-200 p-3 text-sm text-red-900 mb-4">
            {sp.error}
          </div>
        ) : null}

        <form action={requestLoginLink}>
          <Field>
            <Label htmlFor="email">E-post</Label>
            <Input
              id="email"
              name="email"
              type="email"
              required
              autoComplete="email"
              placeholder="du@exempel.se"
              defaultValue={sp.email}
            />
          </Field>
          <Button type="submit" size="lg" className="w-full">
            {sp.sent ? "Skicka ny länk och kod" : "Skicka länk + kod"}
          </Button>
        </form>

        {sp.sent && sp.email ? (
          <div className="mt-6 pt-6 border-t border-border">
            <div className="text-xs uppercase tracking-wide text-neutral-500 mb-2">
              Eller fyll i koden
            </div>

            {sp.otpError ? (
              <div className="rounded-md bg-red-50 border border-red-200 p-3 text-sm text-red-900 mb-3">
                {sp.otpError}
              </div>
            ) : null}

            <form action={verifyOtp}>
              <input type="hidden" name="email" value={sp.email} />
              <Field>
                <Label htmlFor="otp">Kod från mejlet</Label>
                <Input
                  id="otp"
                  name="otp"
                  inputMode="numeric"
                  pattern="[0-9 ]{6,7}"
                  maxLength={7}
                  autoComplete="one-time-code"
                  placeholder="123 456"
                  className="font-mono text-lg tracking-widest text-center"
                  required
                  autoFocus
                />
              </Field>
              <Button type="submit" size="lg" className="w-full">
                Logga in
              </Button>
            </form>
            <p className="text-xs text-neutral-500 mt-3">
              Säkrare än att klicka en länk — du ser att du är på rätt sida.
            </p>
          </div>
        ) : null}
      </div>
    </div>
  );
}
