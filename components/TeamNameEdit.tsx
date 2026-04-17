"use client";

import { useState, useTransition } from "react";
import { renameTeam } from "@/app/(app)/teams/actions";

export function TeamNameEdit({
  teamId,
  initialName,
}: {
  teamId: number;
  initialName: string;
}) {
  const [name, setName] = useState(initialName);
  const [saved, setSaved] = useState<null | "ok" | "err">(null);
  const [, startTransition] = useTransition();

  const commit = () => {
    const trimmed = name.trim();
    if (!trimmed || trimmed === initialName) {
      if (!trimmed) setName(initialName);
      setSaved(null);
      return;
    }
    startTransition(async () => {
      try {
        await renameTeam(teamId, trimmed);
        setSaved("ok");
        setTimeout(() => setSaved(null), 1600);
      } catch {
        setSaved("err");
      }
    });
  };

  return (
    <div className="flex items-center gap-2">
      <input
        value={name}
        onChange={(e) => setName(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            (e.target as HTMLInputElement).blur();
          }
          if (e.key === "Escape") {
            setName(initialName);
            (e.target as HTMLInputElement).blur();
          }
        }}
        className="flex-1 h-10 bg-transparent px-2 text-2xl font-bold rounded-md border border-transparent hover:border-border focus:border-border focus:bg-white outline-none"
        maxLength={80}
        aria-label="Lagets namn"
      />
      {saved === "ok" ? (
        <span className="text-xs text-emerald-700">✓ sparat</span>
      ) : null}
      {saved === "err" ? (
        <span className="text-xs text-red-700">✗ fel</span>
      ) : null}
    </div>
  );
}
