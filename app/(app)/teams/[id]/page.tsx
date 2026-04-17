import { and, eq } from "drizzle-orm";
import { notFound } from "next/navigation";
import Link from "next/link";
import { requireUserId } from "@/lib/auth";
import { db } from "@/lib/db/client";
import { players, teams } from "@/lib/db/schema";
import { Button } from "@/components/ui/Button";
import { Field, Input, Label } from "@/components/ui/Input";
import { Card, CardTitle } from "@/components/ui/Card";
import {
  addPlayer,
  deletePlayer,
  deleteTeam,
  renameTeam,
} from "../actions";

export default async function TeamPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const teamId = Number(id);
  const userId = await requireUserId();

  const [team] = await db
    .select()
    .from(teams)
    .where(and(eq(teams.id, teamId), eq(teams.userId, userId)))
    .limit(1);
  if (!team) notFound();

  const playerList = await db
    .select()
    .from(players)
    .where(eq(players.teamId, teamId))
    .orderBy(players.name);

  return (
    <div>
      <Link href="/teams" className="text-sm text-neutral-600 hover:underline">
        ← Lag
      </Link>

      <div className="flex items-center justify-between mt-2 mb-6">
        <h1 className="text-2xl font-bold">{team.name}</h1>
      </div>

      <div className="grid md:grid-cols-2 gap-4">
        <Card>
          <CardTitle>Lagets namn</CardTitle>
          <form action={renameTeam} className="mt-3 flex gap-2 items-end">
            <input type="hidden" name="id" value={team.id} />
            <div className="flex-1">
              <Label htmlFor="name">Namn</Label>
              <Input
                id="name"
                name="name"
                defaultValue={team.name}
                required
                maxLength={80}
              />
            </div>
            <Button variant="secondary" type="submit">
              Spara
            </Button>
          </form>

          <form action={deleteTeam} className="mt-4">
            <input type="hidden" name="id" value={team.id} />
            <Button variant="danger" type="submit" size="sm">
              Radera lag
            </Button>
          </form>
        </Card>

        <Card>
          <CardTitle>Lägg till spelare</CardTitle>
          <form action={addPlayer} className="mt-3">
            <input type="hidden" name="teamId" value={team.id} />
            <Field>
              <Label htmlFor="pname">Namn</Label>
              <Input id="pname" name="name" required maxLength={80} />
            </Field>
            <div className="grid grid-cols-2 gap-3">
              <Field>
                <Label htmlFor="nickname">Smeknamn</Label>
                <Input id="nickname" name="nickname" maxLength={40} />
              </Field>
              <Field>
                <Label htmlFor="shirt">Tröja</Label>
                <Input
                  id="shirt"
                  name="shirtNumber"
                  type="number"
                  min={0}
                  max={999}
                />
              </Field>
            </div>
            <Button type="submit">Lägg till</Button>
          </form>
        </Card>
      </div>

      <Card className="mt-6">
        <CardTitle>Spelare ({playerList.length})</CardTitle>
        {playerList.length === 0 ? (
          <p className="text-sm text-neutral-600 mt-2">Inga spelare ännu.</p>
        ) : (
          <ul className="mt-3 divide-y divide-border">
            {playerList.map((p) => (
              <li
                key={p.id}
                className="py-2 flex items-center justify-between gap-2"
              >
                <div>
                  <span className="font-medium">{p.name}</span>
                  {p.nickname ? (
                    <span className="text-neutral-600 ml-2">"{p.nickname}"</span>
                  ) : null}
                  {p.shirtNumber !== null ? (
                    <span className="text-neutral-600 ml-2">
                      #{p.shirtNumber}
                    </span>
                  ) : null}
                </div>
                <form action={deletePlayer}>
                  <input type="hidden" name="playerId" value={p.id} />
                  <input type="hidden" name="teamId" value={team.id} />
                  <button
                    type="submit"
                    className="text-sm text-red-600 hover:underline"
                  >
                    Ta bort
                  </button>
                </form>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}
