import Link from "next/link";
import { desc, inArray } from "drizzle-orm";
import { requireUserId, userTeamIds } from "@/lib/auth";
import { db } from "@/lib/db/client";
import { teams } from "@/lib/db/schema";
import { Button } from "@/components/ui/Button";
import { Field, Input, Label } from "@/components/ui/Input";
import { createTeam } from "./actions";
import { Card, CardTitle } from "@/components/ui/Card";

export default async function TeamsPage() {
  const userId = await requireUserId();
  const teamIds = await userTeamIds(userId);
  const list =
    teamIds.length === 0
      ? []
      : await db
          .select()
          .from(teams)
          .where(inArray(teams.id, teamIds))
          .orderBy(desc(teams.createdAt));

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-2xl font-bold">Lag</h1>
      </div>

      <div className="grid md:grid-cols-2 gap-4">
        <Card>
          <CardTitle>Nytt lag</CardTitle>
          <form action={createTeam} className="mt-3">
            <Field>
              <Label htmlFor="name">Namn</Label>
              <Input id="name" name="name" required maxLength={80} placeholder="Lag gul" />
            </Field>
            <Button type="submit">Skapa lag</Button>
          </form>
        </Card>

        <Card>
          <CardTitle>Lag du har access till</CardTitle>
          {list.length === 0 ? (
            <p className="text-sm text-neutral-600 mt-2">Inga lag ännu.</p>
          ) : (
            <ul className="mt-3 divide-y divide-border">
              {list.map((t) => (
                <li key={t.id} className="py-2 flex items-center justify-between">
                  <span className="font-medium">{t.name}</span>
                  <Link
                    href={`/teams/${t.id}`}
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
