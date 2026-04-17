import Link from "next/link";
import { desc, eq } from "drizzle-orm";
import { requireUserId } from "@/lib/auth";
import { db } from "@/lib/db/client";
import { formations, matches, teams } from "@/lib/db/schema";
import { Card, CardTitle } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Field, Input, Label } from "@/components/ui/Input";
import { createMatch } from "./actions";

export default async function MatchesPage() {
  const userId = await requireUserId();
  const [teamList, formationList, matchList] = await Promise.all([
    db.select().from(teams).where(eq(teams.userId, userId)),
    db.select().from(formations).where(eq(formations.userId, userId)),
    db
      .select()
      .from(matches)
      .where(eq(matches.userId, userId))
      .orderBy(desc(matches.createdAt)),
  ]);

  const canCreate = teamList.length > 0 && formationList.length > 0;

  return (
    <div>
      <h1 className="text-2xl font-bold mb-6">Matcher</h1>

      <div className="grid md:grid-cols-2 gap-4">
        <Card>
          <CardTitle>Nytt matchtillfälle</CardTitle>
          {!canCreate ? (
            <p className="text-sm text-neutral-600 mt-2">
              {teamList.length === 0 ? (
                <>
                  Skapa ett <Link href="/teams" className="text-primary hover:underline">lag</Link> först.
                </>
              ) : (
                <>
                  Skapa en{" "}
                  <Link href="/formations" className="text-primary hover:underline">
                    spelform
                  </Link>{" "}
                  först.
                </>
              )}
            </p>
          ) : (
            <form action={createMatch} className="mt-3">
              <Field>
                <Label htmlFor="opponent">Motståndare</Label>
                <Input
                  id="opponent"
                  name="opponent"
                  required
                  placeholder="AIK P12"
                />
              </Field>
              <div className="grid grid-cols-2 gap-3">
                <Field>
                  <Label htmlFor="teamId">Lag</Label>
                  <select
                    id="teamId"
                    name="teamId"
                    required
                    className="h-10 w-full rounded-md border border-border bg-white px-3 text-sm"
                  >
                    {teamList.map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.name}
                      </option>
                    ))}
                  </select>
                </Field>
                <Field>
                  <Label htmlFor="formationId">Spelform</Label>
                  <select
                    id="formationId"
                    name="formationId"
                    required
                    className="h-10 w-full rounded-md border border-border bg-white px-3 text-sm"
                  >
                    {formationList.map((f) => (
                      <option key={f.id} value={f.id}>
                        {f.name}
                      </option>
                    ))}
                  </select>
                </Field>
                <Field>
                  <Label htmlFor="playedAt">Datum/tid</Label>
                  <Input
                    id="playedAt"
                    name="playedAt"
                    type="datetime-local"
                  />
                </Field>
                <Field>
                  <Label htmlFor="location">Plats</Label>
                  <Input id="location" name="location" placeholder="Hemmaplan" />
                </Field>
              </div>
              <Button type="submit">Skapa match</Button>
            </form>
          )}
        </Card>

        <Card>
          <CardTitle>Alla matcher</CardTitle>
          {matchList.length === 0 ? (
            <p className="text-sm text-neutral-600 mt-2">Inga matcher ännu.</p>
          ) : (
            <ul className="mt-3 divide-y divide-border">
              {matchList.map((m) => (
                <li
                  key={m.id}
                  className="py-3 flex items-center justify-between"
                >
                  <div>
                    <div className="font-medium">vs {m.opponent}</div>
                    <div className="text-xs text-neutral-600">
                      {m.playedAt
                        ? new Date(m.playedAt).toLocaleString("sv-SE")
                        : "Utan datum"}{" "}
                      · {m.status}
                    </div>
                  </div>
                  <Link
                    href={`/matches/${m.id}`}
                    className="text-sm text-primary hover:underline"
                  >
                    Öppna →
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>
    </div>
  );
}
