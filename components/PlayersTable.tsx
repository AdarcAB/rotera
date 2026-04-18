"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import {
  assignExistingPlayerToTeam,
  createPlayer,
  deletePlayer,
  renamePlayer,
  searchOrgPlayers,
} from "@/app/(app)/teams/actions";
import { capitalizeName } from "@/lib/utils";

type Row = {
  id: number;
  name: string;
};

type Suggestion = {
  id: number;
  name: string;
  inTeamIds: number[];
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
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [, startTransition] = useTransition();
  const draftRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const q = draft.trim();
    if (q.length < 1) {
      setSuggestions([]);
      return;
    }
    const t = setTimeout(async () => {
      try {
        const res = await searchOrgPlayers(q);
        setSuggestions(res);
      } catch {
        setSuggestions([]);
      }
    }, 150);
    return () => clearTimeout(t);
  }, [draft]);

  const addFromDraft = () => {
    const name = capitalizeName(draft);
    if (!name) return;
    setDraft("");
    setSuggestions([]);
    startTransition(async () => {
      try {
        const created = await createPlayer(teamId, name);
        setRows((prev) => [...prev, created]);
        draftRef.current?.focus();
      } catch {
        /* leave draft empty */
      }
    });
  };

  const addExisting = (s: Suggestion) => {
    setDraft("");
    setSuggestions([]);
    // Optimistic add
    if (!rows.some((r) => r.id === s.id)) {
      setRows((prev) => [...prev, { id: s.id, name: s.name }]);
    }
    startTransition(async () => {
      await assignExistingPlayerToTeam(teamId, s.id).catch(() => {});
      draftRef.current?.focus();
    });
  };

  const rowIds = new Set(rows.map((r) => r.id));
  const filteredSuggestions = suggestions.filter((s) => !rowIds.has(s.id));

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
                  className="text-sm text-red-700 hover:underline px-3 py-2 min-h-[40px] focus:outline-none focus:ring-2 focus:ring-red-300 rounded-md"
                  aria-label={`Ta bort ${r.name}`}
                >
                  Ta bort
                </button>
              </td>
            </tr>
          ))}
          <tr className="border-t border-border">
            <td className="py-1 pr-2 relative">
              <input
                ref={draftRef}
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                onBlur={() => {
                  // Delay blur so suggestion clicks fire first
                  setTimeout(() => {
                    if (document.activeElement !== draftRef.current)
                      addFromDraft();
                  }, 120);
                }}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    addFromDraft();
                  }
                }}
                placeholder="+ Lägg till spelare"
                className="w-full h-9 px-2 bg-transparent border border-transparent hover:border-border focus:border-border focus:bg-white rounded-md outline-none text-sm"
              />
              {filteredSuggestions.length > 0 ? (
                <div className="absolute left-0 right-0 top-full mt-1 z-10 bg-white border border-border rounded-md shadow-sm max-h-64 overflow-auto">
                  {filteredSuggestions.map((s) => (
                    <button
                      key={s.id}
                      type="button"
                      onMouseDown={(e) => {
                        e.preventDefault();
                        addExisting(s);
                      }}
                      className="w-full text-left px-3 py-2 hover:bg-neutral-50 text-sm flex items-center justify-between border-b border-border last:border-b-0"
                    >
                      <span>{s.name}</span>
                      <span className="text-xs text-neutral-500">
                        {s.inTeamIds.length > 0
                          ? `finns i ${s.inTeamIds.length} lag`
                          : "inte i något lag än"}
                      </span>
                    </button>
                  ))}
                  <div className="px-3 py-2 text-xs text-neutral-500 bg-neutral-50">
                    Tryck Enter för att lägga till som ny.
                  </div>
                </div>
              ) : null}
            </td>
            <td />
          </tr>
        </tbody>
      </table>
      <button
        type="button"
        onClick={() => draftRef.current?.focus()}
        className="mt-2 text-sm text-neutral-700 hover:underline focus:outline-none focus:underline"
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
