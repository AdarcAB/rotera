import Link from "next/link";
import type { Metadata } from "next";
import { requireUser } from "@/lib/auth";
import { Card, CardTitle } from "@/components/ui/Card";
import { Field, Input, Label } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { deleteAccount } from "./actions";
import { ThemeToggle } from "@/components/ThemeToggle";

export const metadata: Metadata = {
  title: "Konto",
};

export default async function KontoPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const user = await requireUser();
  const sp = await searchParams;

  return (
    <div className="max-w-2xl">
      <h1 className="text-2xl font-bold mb-6">Konto</h1>

      <Card>
        <CardTitle>E-post</CardTitle>
        <p className="text-neutral-800 mt-2 font-mono text-sm break-all">
          {user.email}
        </p>
        <p className="text-sm text-neutral-600 mt-2">
          Du loggar in med denna e-post. Kontakta{" "}
          <a
            href="mailto:hej@adarc.se"
            className="text-emerald-700 hover:underline"
          >
            hej@adarc.se
          </a>{" "}
          om du behöver byta adress.
        </p>
      </Card>

      <Card className="mt-6">
        <CardTitle>Utseende</CardTitle>
        <p className="text-sm text-neutral-600 mt-2 mb-3">
          "System" följer din enhets inställning.
        </p>
        <ThemeToggle />
      </Card>

      <Card className="mt-6">
        <CardTitle>Logga ut</CardTitle>
        <p className="text-sm text-neutral-600 mt-2 mb-3">
          Avslutar sessionen i den här webbläsaren. Ditt konto finns kvar.
        </p>
        <form action="/logout" method="post">
          <Button type="submit" variant="secondary">
            Logga ut
          </Button>
        </form>
      </Card>

      <Card className="mt-10 border-red-200 bg-red-50/30">
        <CardTitle className="text-red-900">Radera konto</CardTitle>
        <p className="text-sm text-neutral-800 mt-2">
          Raderar <strong>ditt konto och all data du lagt upp</strong> permanent:
        </p>
        <ul className="list-disc ml-5 text-sm text-neutral-700 mt-2 space-y-0.5">
          <li>Lag och spelare</li>
          <li>Spelformer och positioner</li>
          <li>Matcher, scheman och faktisk speltid</li>
          <li>Din e-postadress</li>
        </ul>
        <p className="text-sm text-neutral-700 mt-3">
          Kan inte ångras. Ny registrering på samma e-post börjar med blankt
          innehåll.
        </p>

        {sp.error ? (
          <div className="mt-4 rounded-md bg-red-100 border border-red-200 p-3 text-sm text-red-900">
            {sp.error}
          </div>
        ) : null}

        <form action={deleteAccount} className="mt-5">
          <Field>
            <Label htmlFor="confirmation">
              Skriv din e-post för att bekräfta:{" "}
              <span className="font-mono text-neutral-600">{user.email}</span>
            </Label>
            <Input
              id="confirmation"
              name="confirmation"
              type="email"
              autoComplete="off"
              placeholder={user.email}
              required
            />
          </Field>
          <Button variant="danger" type="submit">
            Radera mitt konto permanent
          </Button>
        </form>
      </Card>

      <div className="mt-6 text-sm">
        <Link href="/dashboard" className="text-neutral-600 hover:underline">
          ← Tillbaka till översikten
        </Link>
      </div>
    </div>
  );
}
