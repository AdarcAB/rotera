import { and, asc, eq } from "drizzle-orm";
import { notFound } from "next/navigation";
import Link from "next/link";
import { requireUserId } from "@/lib/auth";
import { db } from "@/lib/db/client";
import { formations, positions } from "@/lib/db/schema";
import { Card, CardTitle } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Field, Input, Label } from "@/components/ui/Input";
import {
  deleteFormation,
  updateFormation,
  updatePositions,
} from "../actions";

export default async function FormationPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const fid = Number(id);
  const userId = await requireUserId();
  const [f] = await db
    .select()
    .from(formations)
    .where(and(eq(formations.id, fid), eq(formations.userId, userId)))
    .limit(1);
  if (!f) notFound();

  const posList = await db
    .select()
    .from(positions)
    .where(eq(positions.formationId, fid))
    .orderBy(asc(positions.sortOrder));

  return (
    <div>
      <Link href="/formations" className="text-sm text-neutral-600 hover:underline">
        ← Spelformer
      </Link>
      <h1 className="text-2xl font-bold mt-2 mb-6">{f.name}</h1>

      <div className="grid md:grid-cols-2 gap-4">
        <Card>
          <CardTitle>Inställningar</CardTitle>
          <form action={updateFormation} className="mt-3">
            <input type="hidden" name="id" value={f.id} />
            <Field>
              <Label htmlFor="name">Namn</Label>
              <Input id="name" name="name" defaultValue={f.name} required />
            </Field>
            <div className="grid grid-cols-2 gap-3">
              <Field>
                <Label htmlFor="pof">Spelare på plan</Label>
                <Input
                  id="pof"
                  name="playersOnField"
                  type="number"
                  min={3}
                  max={11}
                  defaultValue={f.playersOnField}
                  required
                />
              </Field>
              <Field>
                <Label htmlFor="np">Perioder</Label>
                <Input
                  id="np"
                  name="numPeriods"
                  type="number"
                  min={1}
                  max={8}
                  defaultValue={f.numPeriods}
                  required
                />
              </Field>
              <Field>
                <Label htmlFor="mpp">Min/period</Label>
                <Input
                  id="mpp"
                  name="minutesPerPeriod"
                  type="number"
                  min={1}
                  max={90}
                  defaultValue={f.minutesPerPeriod}
                  required
                />
              </Field>
              <Field>
                <Label htmlFor="minsub">Min byten</Label>
                <Input
                  id="minsub"
                  name="minSubsPerPeriod"
                  type="number"
                  min={0}
                  max={10}
                  defaultValue={f.minSubsPerPeriod}
                  required
                />
              </Field>
              <Field>
                <Label htmlFor="maxsub">Max byten</Label>
                <Input
                  id="maxsub"
                  name="maxSubsPerPeriod"
                  type="number"
                  min={0}
                  max={10}
                  defaultValue={f.maxSubsPerPeriod}
                  required
                />
              </Field>
            </div>
            <Button type="submit">Spara</Button>
          </form>

          <form action={deleteFormation} className="mt-4">
            <input type="hidden" name="id" value={f.id} />
            <Button variant="danger" size="sm" type="submit">
              Radera spelform
            </Button>
          </form>
        </Card>

        <Card>
          <CardTitle>Positioner</CardTitle>
          <p className="text-xs text-neutral-600 mb-2">
            Det finns {posList.length} positioner. Du kan byta namn och förkortning.
            {posList.length !== f.playersOnField
              ? ` Observera: antal positioner (${posList.length}) matchar inte spelare på plan (${f.playersOnField}). Positioner skapas automatiskt när du skapar en ny spelform.`
              : null}
          </p>
          <form action={updatePositions} className="mt-3">
            <input type="hidden" name="formationId" value={f.id} />
            <div className="space-y-2">
              {posList.map((p) => (
                <div key={p.id} className="grid grid-cols-[1fr_80px] gap-2">
                  <Input
                    name={`name_${p.id}`}
                    defaultValue={p.name}
                    placeholder="Namn"
                    required
                  />
                  <Input
                    name={`abbr_${p.id}`}
                    defaultValue={p.abbreviation}
                    placeholder="Fk"
                    maxLength={6}
                    required
                  />
                </div>
              ))}
            </div>
            <Button type="submit" className="mt-3">
              Spara positioner
            </Button>
          </form>
        </Card>
      </div>
    </div>
  );
}
