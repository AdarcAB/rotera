"use client";

import { useState, useTransition } from "react";
import {
  deleteOrgPlayer,
  renameOrgPlayer,
} from "@/app/(app)/orgs/actions";
import type { OrgPlayerRow } from "@/app/(app)/orgs/actions";
import { capitalizeName } from "@/lib/utils";

export function OrgPlayersSection({
  players: initial,
}: {
  players: OrgPlayerRow[];
}) {
  const [rows, setRows] = useState<OrgPlayerRow[]>(initial);
  const [query, setQuery] = useState("");
  const [, startTransition] = useTransition();

  const rename = (id: number, next: string) => {
    const clean = capitalizeName(next);
    const row = rows.find((r) => r.id === id);
    if (!row) return;
    if (!clean) {
      setRows((prev) =>
        prev.map((r) => (r.id === id ? { ...r, name: row.name } : r))
      );
      return;
    }
    if (clean === row.name) return;
    setRows((prev) =>
      prev.map((r) => (r.id === id ? { ...r, name: clean } : r))
    );
    startTransition(() => {
      renameOrgPlayer(id, clean).catch(() => {});
    });
  };

  const remove = (id: number, name: string) => {
    if (
      !confirm(
        `Radera ${name} från hela organisationen? Spelaren tas bort ur alla lag och matchhistorik påverkas. Kan inte ångras.`
      )
    )
      return;
    setRows((prev) => prev.filter((r) => r.id !== id));
    startTransition(() => {
      deleteOrgPlayer(id).catch(() => {});
    });
  };

  const filtered = rows.filter((r) =>
    r.name.toLowerCase().includes(query.trim().toLowerCase())
  );

  return (
    <div>
      <input
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Sök spelare..."
        className="w-full h-10 px-3 rounded-md border border-border bg-white text-sm outline-none focus:ring-2 focus:ring-emerald-500 mb-3"
      />
      {rows.length === 0 ? (
        <p className="text-sm text-neutral-600">
          Inga spelare i organisationen än. Lägg till via ett lag.
        </p>
      ) : (
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-xs text-neutral-500 uppercase">
              <th className="py-1 font-medium">Namn</th>
              <th className="py-1 font-medium">Lag</th>
              <th className="py-1 font-medium w-20 text-right"></th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((r) => (
              <tr key={r.id} className="border-t border-border">
                <td className="py-1 pr-2">
                  <InlineName
                    initial={r.name}
                    onCommit={(v) => rename(r.id, v)}
                  />
                </td>
                <td className="py-1 pr-2 text-xs text-neutral-700">
                  {r.teams.length === 0 ? (
                    <span className="text-neutral-400">—</span>
                  ) : (
                    r.teams.map((t) => t.name).join(" · ")
                  )}
                </td>
                <td className="py-1 text-right">
                  <button
                    type="button"
                    onClick={() => remove(r.id, r.name)}
                    className="text-sm text-red-700 hover:underline px-2 py-1"
                  >
                    Ta bort
                  </button>
                </td>
              </tr>
            ))}
            {filtered.length === 0 && query ? (
              <tr>
                <td colSpan={3} className="py-3 text-sm text-neutral-600">
                  Inga träffar på "{query}".
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      )}
    </div>
  );
}

function InlineName({
  initial,
  onCommit,
}: {
  initial: string;
  onCommit: (value: string) => void;
}) {
  const [value, setValue] = useState(initial);
  return (
    <input
      value={value}
      onChange={(e) => setValue(e.target.value)}
      onBlur={() => onCommit(value)}
      onKeyDown={(e) => {
        if (e.key === "Enter") (e.target as HTMLInputElement).blur();
        if (e.key === "Escape") {
          setValue(initial);
          (e.target as HTMLInputElement).blur();
        }
      }}
      className="w-full h-9 px-2 bg-transparent border border-transparent hover:border-border focus:border-border focus:bg-white rounded-md outline-none text-sm"
      maxLength={80}
    />
  );
}
