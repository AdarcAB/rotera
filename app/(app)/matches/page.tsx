import Link from "next/link";
import { desc, eq, inArray } from "drizzle-orm";
import { requireUserId, userTeamIds } from "@/lib/auth";
import { db } from "@/lib/db/client";
import { formations, matches, teams } from "@/lib/db/schema";
import { Card, CardTitle } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Field, Input, Label } from "@/components/ui/Input";
import { createMatch } from "./actions";

function todayIso(): string {
  const d = new Date();
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

export default async function MatchesPage() {
  const userId = await requireUserId();
  const teamIds = await userTeamIds(userId);
  const [teamList, formationList, matchList] = await Promise.all([
    teamIds.length === 0
      ? Promise.resolve([])
      : db.select().from(teams).where(inArray(teams.id, teamIds)),
    db.select().from(formations).where(eq(formations.userId, userId)),
    teamIds.length === 0
      ? Promise.resolve([])
      : db
          .select()
          .from(matches)
          .where(inArray(matches.teamId, teamIds))
          .orderBy(desc(matches.createdAt)),
  ]);

  const canCreate = teamList.length > 0 && formationList.length > 0;
  const teamNameById = new Map(teamList.map((t) => [t.id, t.name]));
  const teamNameFor = (id: number) => teamNameById.get(id) ?? "Lag";
  const defaultFormationId = formationList.find((f) => f.isDefault)?.id;

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
                    defaultValue={defaultFormationId ?? undefined}
                    className="h-10 w-full rounded-md border border-border bg-white px-3 text-sm"
                  >
                    {formationList.map((f) => (
                      <option key={f.id} value={f.id}>
                        {f.name}
                        {f.isDefault ? " (förvald)" : ""}
                      </option>
                    ))}
                  </select>
                </Field>
                <Field>
                  <Label htmlFor="playedAt">Datum</Label>
                  <Input
                    id="playedAt"
                    name="playedAt"
                    type="date"
                    defaultValue={todayIso()}
                  />
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
                  className="py-3 flex items-center justify-between gap-3"
                >
                  <div className="min-w-0 flex-1">
                    <div className="font-medium flex items-center gap-2 flex-wrap">
                      <span>
                        {teamNameFor(m.teamId)} vs {m.opponent}
                      </span>
                      {m.goalsFor !== null && m.goalsAgainst !== null ? (
                        <span
                          className={`font-mono text-xs px-1.5 py-0.5 rounded border ${
                            m.goalsFor > m.goalsAgainst
                              ? "bg-emerald-50 text-emerald-900 border-emerald-200"
                              : m.goalsFor < m.goalsAgainst
                                ? "bg-red-50 text-red-900 border-red-200"
                                : "bg-neutral-100 text-neutral-800 border-border"
                          }`}
                        >
                          {m.goalsFor}–{m.goalsAgainst}
                        </span>
                      ) : null}
                    </div>
                    <div className="text-xs text-neutral-600">
                      {m.playedAt
                        ? new Date(m.playedAt).toLocaleDateString("sv-SE")
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
