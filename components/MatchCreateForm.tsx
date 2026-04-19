"use client";

import { useState } from "react";
import { Field, Input, Label } from "@/components/ui/Input";
import { SubmitButton } from "@/components/SubmitButton";

type TeamOpt = { id: number; name: string };
type FormationOpt = { id: number; name: string; isDefault: boolean };

export function MatchCreateForm({
  teams,
  formations,
  defaultFormationId,
  defaultDate,
  action,
}: {
  teams: TeamOpt[];
  formations: FormationOpt[];
  defaultFormationId: number | null;
  defaultDate: string;
  action: (fd: FormData) => void | Promise<void>;
}) {
  const hasTeams = teams.length > 0;
  const [mode, setMode] = useState<"team" | "adhoc">(
    hasTeams ? "team" : "adhoc"
  );
  const [adHocName, setAdHocName] = useState("");

  return (
    <form action={action} className="mt-3 space-y-3">
      <input type="hidden" name="mode" value={mode} />

      <div className="flex gap-2 rounded-md bg-neutral-100 p-1 text-sm">
        <button
          type="button"
          onClick={() => setMode("team")}
          disabled={!hasTeams}
          className={`flex-1 px-3 py-1.5 rounded text-center ${
            mode === "team"
              ? "bg-white shadow-sm font-medium"
              : "text-neutral-600"
          } ${!hasTeams ? "opacity-50 cursor-not-allowed" : ""}`}
          title={!hasTeams ? "Skapa ett lag först för att använda detta val" : ""}
        >
          Använd lag
        </button>
        <button
          type="button"
          onClick={() => setMode("adhoc")}
          className={`flex-1 px-3 py-1.5 rounded text-center ${
            mode === "adhoc"
              ? "bg-white shadow-sm font-medium"
              : "text-neutral-600"
          }`}
        >
          Tillfällig trupp
        </button>
      </div>

      {mode === "team" ? (
        <Field>
          <Label htmlFor="teamId">Lag</Label>
          <select
            id="teamId"
            name="teamId"
            required
            className="h-10 w-full rounded-md border border-border bg-white px-3 text-sm"
          >
            {teams.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
              </option>
            ))}
          </select>
        </Field>
      ) : (
        <Field>
          <Label htmlFor="adHocName">Namn på tillfällig trupp</Label>
          <Input
            id="adHocName"
            name="adHocName"
            required
            placeholder="t.ex. Lag 1 19/4"
            maxLength={80}
            value={adHocName}
            onChange={(e) => setAdHocName(e.target.value)}
          />
          <p className="text-xs text-neutral-500 mt-1">
            Välj spelare från organisationen på matchsidan.
          </p>
        </Field>
      )}

      <Field>
        <Label htmlFor="opponent">Motståndare</Label>
        <Input
          id="opponent"
          name="opponent"
          required
          placeholder="Storköping lag gul"
        />
      </Field>

      <div className="grid grid-cols-2 gap-3">
        <Field>
          <Label htmlFor="formationId">Spelform</Label>
          <select
            id="formationId"
            name="formationId"
            required
            defaultValue={defaultFormationId ?? undefined}
            className="h-10 w-full rounded-md border border-border bg-white px-3 text-sm"
          >
            {formations.map((f) => (
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
            defaultValue={defaultDate}
          />
        </Field>
      </div>

      <Field>
        <span className="block text-sm font-medium mb-1">Plats</span>
        <div className="flex gap-2 rounded-md bg-neutral-100 p-1 text-sm">
          <label className="flex-1">
            <input
              type="radio"
              name="homeAway"
              value="home"
              defaultChecked
              className="peer sr-only"
            />
            <span className="block px-3 py-1.5 rounded text-center cursor-pointer text-neutral-600 peer-checked:bg-white peer-checked:shadow-sm peer-checked:font-medium peer-checked:text-neutral-900">
              Hemma
            </span>
          </label>
          <label className="flex-1">
            <input
              type="radio"
              name="homeAway"
              value="away"
              className="peer sr-only"
            />
            <span className="block px-3 py-1.5 rounded text-center cursor-pointer text-neutral-600 peer-checked:bg-white peer-checked:shadow-sm peer-checked:font-medium peer-checked:text-neutral-900">
              Borta
            </span>
          </label>
        </div>
      </Field>

      <Field>
        <Label htmlFor="reason">Anledning (valfritt)</Label>
        <Input
          id="reason"
          name="reason"
          placeholder="seriespel, cup, träningsmatch…"
          maxLength={80}
        />
      </Field>

      <SubmitButton pendingLabel="Skapar…">Skapa match</SubmitButton>
    </form>
  );
}
