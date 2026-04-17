import Link from "next/link";
import { requestLoginLink } from "./actions";
import { Button } from "@/components/ui/Button";
import { Field, Input, Label } from "@/components/ui/Input";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ sent?: string; error?: string }>;
}) {
  const sp = await searchParams;
  return (
    <div className="flex-1 flex items-center justify-center p-6">
      <div className="w-full max-w-md rounded-lg border border-border bg-white p-6 shadow-sm">
        <Link href="/" className="text-sm text-neutral-500 hover:underline">
          ← Startsida
        </Link>
        <h1 className="text-2xl font-semibold mt-3 mb-1">Logga in</h1>
        <p className="text-sm text-neutral-600 mb-4">
          Ange din e-post. En magic-link visas i serverkonsolen (dev-läge).
        </p>

        {sp.sent ? (
          <div className="rounded-md bg-emerald-50 border border-emerald-200 p-3 text-sm text-emerald-900 mb-4">
            Magic-link genererad! Kolla serverkonsolen (terminalen där{" "}
            <code className="font-mono">npm run dev</code> körs) och klicka på länken.
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
            />
          </Field>
          <Button type="submit" size="lg" className="w-full">
            Skicka magic-link
          </Button>
        </form>
      </div>
    </div>
  );
}
