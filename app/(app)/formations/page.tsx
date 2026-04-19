import Link from "next/link";
import { desc, eq } from "drizzle-orm";
import { requireUserId } from "@/lib/auth";
import { db } from "@/lib/db/client";
import { formations } from "@/lib/db/schema";
import { Card, CardTitle } from "@/components/ui/Card";
import { Field, Input, Label } from "@/components/ui/Input";
import { createFormation } from "./actions";
import { SubmitButton } from "@/components/SubmitButton";

export default async function FormationsPage() {
  const userId = await requireUserId();
  const list = await db
    .select()
    .from(formations)
    .where(eq(formations.userId, userId))
    .orderBy(desc(formations.createdAt));

  return (
    <div>
      <h1 className="text-2xl font-bold mb-6">Spelformer</h1>

      <div className="grid md:grid-cols-2 gap-4">
        <Card>
          <CardTitle>Ny spelform</CardTitle>
          <form action={createFormation} className="mt-3">
            <div className="grid grid-cols-2 gap-3">
              <Field>
                <Label htmlFor="name">Namn</Label>
                <Input id="name" name="name" required placeholder="Egen 7-manna" />
              </Field>
              <Field>
                <Label htmlFor="pof">Spelare på plan</Label>
                <Input
                  id="pof"
                  name="playersOnField"
                  type="number"
                  min={3}
                  max={11}
                  defaultValue={7}
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
                  defaultValue={3}
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
                  defaultValue={20}
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
                  defaultValue={1}
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
                  defaultValue={3}
                  required
                />
              </Field>
            </div>
            <label className="flex items-center gap-2 text-sm mb-3">
              <input type="checkbox" name="isDefault" className="w-4 h-4" />
              <span>Förvald (visas förifyllt när du skapar en match)</span>
            </label>
            <SubmitButton>Skapa</SubmitButton>
          </form>
        </Card>

        <Card>
          <CardTitle>Dina spelformer</CardTitle>
          {list.length === 0 ? (
            <p className="text-sm text-neutral-600 mt-2">Inga spelformer ännu.</p>
          ) : (
            <ul className="mt-3 divide-y divide-border">
              {list.map((f) => (
                <li
                  key={f.id}
                  className="py-2 flex items-center justify-between"
                >
                  <div>
                    <div className="font-medium flex items-center gap-2">
                      {f.name}
                      {f.isDefault ? (
                        <span className="text-[10px] uppercase tracking-wide bg-emerald-100 text-emerald-900 px-1.5 py-0.5 rounded">
                          Förvald
                        </span>
                      ) : null}
                    </div>
                    <div className="text-xs text-neutral-600">
                      {f.playersOnField} spelare · {f.numPeriods}×
                      {f.minutesPerPeriod} min · {f.minSubsPerPeriod}-
                      {f.maxSubsPerPeriod} byten/period
                    </div>
                  </div>
                  <Link
                    href={`/formations/${f.id}`}
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
