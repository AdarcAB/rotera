"use client";

import { useRef, useState, useTransition } from "react";
import {
  createPlayer,
  deletePlayer,
  renamePlayer,
} from "@/app/(app)/teams/actions";
import { capitalizeName } from "@/lib/utils";

type Row = {
  id: number;
  name: string;
};

export function PlayersTable({
  teamId,
  initialPlayers,
}: {
  teamId: number;
  initialPlayers: Row[];
}) {
  const [rows, setRows] = useState<Row[]>(initialPlayers);
  const [draft, setDraft] = useState("");
  const [, startTransition] = useTransition();
  const draftRef = useRef<HTMLInputElement>(null);

  const addFromDraft = () => {
    const name = capitalizeName(draft);
    if (!name) return;
    setDraft("");
    startTransition(async () => {
      try {
        const created = await createPlayer(teamId, name);
        setRows((prev) => [...prev, created]);
        draftRef.current?.focus();
      } catch {
        // leave draft empty; user can retype
      }
    });
  };

  const rename = (id: number, newName: string) => {
    const name = capitalizeName(newName);
    const row = rows.find((r) => r.id === id);
    if (!row) return;
    if (!name) {
      setRows((prev) => prev.map((r) => (r.id === id ? { ...r, name: row.name } : r)));
      return;
    }
    if (name === row.name) return;
    setRows((prev) => prev.map((r) => (r.id === id ? { ...r, name } : r)));
    startTransition(() => {
      renamePlayer(id, teamId, name).catch(() => {});
    });
  };

  const remove = (id: number) => {
    setRows((prev) => prev.filter((r) => r.id !== id));
    startTransition(() => {
      deletePlayer(id, teamId).catch(() => {});
    });
  };

  return (
    <div>
      <table className="w-full text-sm">
        <thead>
          <tr className="text-left text-neutral-500 text-xs uppercase">
            <th className="py-1 font-medium">Namn</th>
            <th className="py-1 font-medium w-20 text-right"></th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr
              key={r.id}
              className="border-t border-border group"
            >
              <td className="py-1 pr-2">
                <InlineName
                  initial={r.name}
                  onCommit={(v) => rename(r.id, v)}
                />
              </td>
              <td className="py-1 text-right">
                <button
                  type="button"
                  onClick={() => {
                    if (
                      confirm(
                        `Ta bort ${r.name}? Spelaren försvinner ur laget permanent.`
                      )
                    )
                      remove(r.id);
                  }}
                  className="text-xs text-red-600 hover:underline px-2 py-1"
                  aria-label={`Ta bort ${r.name}`}
                >
                  Ta bort
                </button>
              </td>
            </tr>
          ))}
          <tr className="border-t border-border">
            <td className="py-1 pr-2">
              <input
                ref={draftRef}
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                onBlur={addFromDraft}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    addFromDraft();
                  }
                }}
                placeholder="+ Lägg till spelare"
                className="w-full h-9 px-2 bg-transparent border border-transparent hover:border-border focus:border-border focus:bg-white rounded-md outline-none text-sm"
              />
            </td>
            <td />
          </tr>
        </tbody>
      </table>
      <button
        type="button"
        onClick={() => draftRef.current?.focus()}
        className="mt-2 text-xs text-neutral-600 hover:underline"
      >
        + Lägg till ny rad
      </button>
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
  const commit = () => {
    const cleaned = capitalizeName(value);
    if (cleaned) setValue(cleaned);
    onCommit(cleaned || initial);
  };
  return (
    <input
      value={value}
      onChange={(e) => setValue(e.target.value)}
      onBlur={commit}
      onKeyDown={(e) => {
        if (e.key === "Enter") {
          e.preventDefault();
          (e.target as HTMLInputElement).blur();
        }
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
