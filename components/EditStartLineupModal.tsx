"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { regenerateScheduleWithStart } from "@/app/(app)/matches/actions";

type Position = {
  id: number;
  name: string;
  abbreviation: string;
  isGoalkeeper?: boolean;
};

type Player = {
  id: number;
  name: string;
  playablePositionIds: number[];
  preferredPositionIds: number[];
};

export function EditStartLineupModal({
  matchId,
  positions,
  players,
  initialLineup,
  onClose,
}: {
  matchId: number;
  positions: Position[];
  players: Player[];
  initialLineup: { positionId: number; playerId: number }[];
  onClose: () => void;
}) {
  const initial = new Map(initialLineup.map((s) => [s.positionId, s.playerId]));
  const [assignment, setAssignment] = useState<Map<number, number>>(initial);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  const setFor = (posId: number, newPlayerId: number) => {
    setAssignment((prev) => {
      const next = new Map(prev);
      const currentPlayer = next.get(posId) ?? null;
      // If the new player is already on another position, swap them so the
      // previously-assigned player doesn't disappear from the lineup.
      let otherPos: number | null = null;
      for (const [p, pid] of next.entries()) {
        if (pid === newPlayerId && p !== posId) {
          otherPos = p;
          break;
        }
      }
      next.set(posId, newPlayerId);
      if (otherPos !== null) {
        if (currentPlayer !== null) next.set(otherPos, currentPlayer);
        else next.delete(otherPos);
      }
      return next;
    });
  };

  const clearPosition = (posId: number) => {
    setAssignment((prev) => {
      const next = new Map(prev);
      next.delete(posId);
      return next;
    });
  };

  const save = () => {
    setError(null);
    if (assignment.size !== positions.length) {
      setError("Alla positioner måste vara fyllda.");
      return;
    }
    const lineup = Array.from(assignment.entries()).map(
      ([positionId, playerId]) => ({ positionId, playerId })
    );
    startTransition(async () => {
      const result = await regenerateScheduleWithStart(matchId, lineup).catch(
        (e) => ({ ok: false as const, error: String(e) })
      );
      if (!result.ok) {
        setError(result.error);
        return;
      }
      onClose();
      router.refresh();
    });
  };

  const sorted = [...positions].sort((a, b) => a.id - b.id);

  return (
    <div
      className="fixed inset-0 z-50 bg-black/60 flex items-end md:items-center justify-center p-0 md:p-4"
      onClick={onClose}
    >
      <div
        className="bg-white w-full md:max-w-lg rounded-t-lg md:rounded-lg shadow-xl max-h-[90vh] overflow-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="px-4 py-3 border-b border-border flex items-center justify-between">
          <div>
            <div className="text-xs uppercase tracking-wide text-neutral-600">
              Ändra startuppställning
            </div>
            <div className="font-semibold">Period 1</div>
          </div>
          <button
            onClick={onClose}
            className="text-neutral-500 hover:text-neutral-900 text-xl leading-none"
            aria-label="Stäng"
          >
            ×
          </button>
        </div>

        <div className="p-4">
          <p className="text-sm text-neutral-700 mb-4">
            Välj vem som startar på varje position. Resten av matchen
            genereras om utifrån ditt val.
          </p>

          <table className="w-full text-sm">
            <tbody>
              {sorted.map((pos) => {
                const currentPid = assignment.get(pos.id) ?? null;
                // Show every called player. Non-eligible ones are still
                // selectable — coach is allowed to override. Bench players
                // appear too so they can be swapped into the start lineup.
                const visible = [...players].sort((a, b) => {
                  const aEl = a.playablePositionIds.includes(pos.id) ? 0 : 1;
                  const bEl = b.playablePositionIds.includes(pos.id) ? 0 : 1;
                  if (aEl !== bEl) return aEl - bEl;
                  return a.name.localeCompare(b.name, "sv");
                });
                const posById = new Map(positions.map((p) => [p.id, p]));
                const playerCurrentPos = (pid: number): Position | null => {
                  for (const [posId, id] of assignment.entries()) {
                    if (id === pid && posId !== pos.id) {
                      return posById.get(posId) ?? null;
                    }
                  }
                  return null;
                };

                return (
                  <tr key={pos.id} className="border-t border-border">
                    <td className="py-2 pr-2">
                      <span className="inline-block font-mono text-xs bg-neutral-100 px-1.5 py-0.5 rounded mr-1">
                        {pos.abbreviation}
                      </span>
                      <span className="text-neutral-700 text-sm">
                        {pos.name}
                      </span>
                    </td>
                    <td className="py-2">
                      <select
                        value={currentPid ?? ""}
                        onChange={(e) =>
                          setFor(pos.id, Number(e.target.value))
                        }
                        className="w-full h-10 rounded-md border border-border bg-white px-2 text-sm"
                      >
                        <option value="">— välj —</option>
                        {visible.map((p) => {
                          const otherPos = playerCurrentPos(p.id);
                          const isCurrent = p.id === currentPid;
                          const tag = isCurrent
                            ? null
                            : otherPos
                              ? otherPos.abbreviation
                              : "bänk";
                          return (
                            <option key={p.id} value={p.id}>
                              {p.name}
                              {tag ? ` (${tag})` : ""}
                              {p.preferredPositionIds.includes(pos.id)
                                ? " · önskar"
                                : ""}
                              {!p.playablePositionIds.includes(pos.id)
                                ? " · ej spelbar"
                                : ""}
                            </option>
                          );
                        })}
                      </select>
                    </td>
                    <td className="py-2 pl-2 text-right">
                      {currentPid !== null ? (
                        <button
                          type="button"
                          onClick={() => clearPosition(pos.id)}
                          className="text-sm text-neutral-500 hover:text-red-700"
                          aria-label="Rensa"
                        >
                          ×
                        </button>
                      ) : null}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>

          {error ? (
            <div className="mt-3 rounded-md bg-red-50 border border-red-200 p-3 text-sm text-red-900 whitespace-pre-wrap">
              {error}
            </div>
          ) : null}
        </div>

        <div className="px-4 py-3 border-t border-border flex justify-between">
          <button
            type="button"
            onClick={onClose}
            className="h-10 px-4 rounded-md text-neutral-700 text-sm hover:bg-neutral-100"
            disabled={isPending}
          >
            Avbryt
          </button>
          <button
            type="button"
            onClick={save}
            className="h-10 px-5 rounded-md bg-primary text-white text-sm font-semibold disabled:opacity-60"
            disabled={isPending}
          >
            {isPending ? "Genererar om..." : "Spara & generera om"}
          </button>
        </div>
      </div>
    </div>
  );
}
