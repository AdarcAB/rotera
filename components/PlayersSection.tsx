"use client";

import { useState, useTransition } from "react";
import {
  addGuestAction,
  removeMatchPlayerAction,
  togglePlayerCalledAction,
  updateMatchPlayerPositionsAction,
} from "@/app/(app)/matches/actions";
import { capitalizeName } from "@/lib/utils";

export type Position = {
  id: number;
  name: string;
  abbreviation: string;
};

export type TeamPlayer = {
  id: number;
  name: string;
};

export type MatchPlayerRow = {
  id: number;
  playerId: number | null;
  isGuest: boolean;
  guestName: string | null;
  playablePositionIds: number[];
  preferredPositionIds: number[];
};

export function PlayersSection({
  matchId,
  teamPlayers,
  positions,
  initialMatchPlayers,
}: {
  matchId: number;
  teamPlayers: TeamPlayer[];
  positions: Position[];
  initialMatchPlayers: MatchPlayerRow[];
}) {
  const [mps, setMps] = useState<MatchPlayerRow[]>(initialMatchPlayers);
  const [openMpId, setOpenMpId] = useState<number | null>(null);
  const [guestDraft, setGuestDraft] = useState("");
  const [, startTransition] = useTransition();

  const mpByPlayer = new Map<number, MatchPlayerRow>();
  for (const mp of mps) {
    if (mp.playerId !== null) mpByPlayer.set(mp.playerId, mp);
  }
  const guests = mps.filter((mp) => mp.isGuest);

  const allPositionIds = positions.map((p) => p.id);

  const setCalled = (playerId: number, called: boolean) => {
    if (called) {
      startTransition(async () => {
        try {
          const created = await togglePlayerCalledAction(matchId, playerId, true);
          if (created) setMps((prev) => [...prev, created]);
        } catch {
          /* ignore */
        }
      });
    } else {
      const existing = mpByPlayer.get(playerId);
      if (!existing) return;
      setMps((prev) => prev.filter((mp) => mp.id !== existing.id));
      startTransition(() => {
        togglePlayerCalledAction(matchId, playerId, false).catch(() => {});
      });
    }
  };

  const calledCount = teamPlayers.reduce(
    (n, p) => (mpByPlayer.has(p.id) ? n + 1 : n),
    0
  );
  const allCalled = teamPlayers.length > 0 && calledCount === teamPlayers.length;

  const selectAll = () => {
    if (teamPlayers.length === 0) return;
    if (allCalled) {
      // Uncheck all
      const toRemove = teamPlayers
        .map((p) => mpByPlayer.get(p.id))
        .filter((mp): mp is MatchPlayerRow => !!mp);
      setMps((prev) =>
        prev.filter((mp) => !toRemove.some((r) => r.id === mp.id))
      );
      startTransition(() => {
        Promise.all(
          teamPlayers.map((p) =>
            togglePlayerCalledAction(matchId, p.id, false).catch(() => null)
          )
        );
      });
      return;
    }
    const toAdd = teamPlayers.filter((p) => !mpByPlayer.has(p.id));
    startTransition(async () => {
      const created = await Promise.all(
        toAdd.map((p) =>
          togglePlayerCalledAction(matchId, p.id, true).catch(() => null)
        )
      );
      const ok = created.filter((c): c is MatchPlayerRow => !!c);
      if (ok.length > 0) setMps((prev) => [...prev, ...ok]);
    });
  };

  const updatePositions = (
    mpId: number,
    playable: number[],
    preferred: number[]
  ) => {
    setMps((prev) =>
      prev.map((mp) =>
        mp.id === mpId
          ? {
              ...mp,
              playablePositionIds: [...playable].sort((a, b) => a - b),
              preferredPositionIds: [...preferred].sort((a, b) => a - b),
            }
          : mp
      )
    );
    startTransition(() => {
      updateMatchPlayerPositionsAction(matchId, mpId, playable, preferred).catch(
        () => {}
      );
    });
  };

  const addGuest = () => {
    const name = capitalizeName(guestDraft);
    if (!name) return;
    setGuestDraft("");
    startTransition(async () => {
      try {
        const created = await addGuestAction(matchId, name);
        if (created) setMps((prev) => [...prev, created]);
      } catch {
        /* ignore */
      }
    });
  };

  const removeGuest = (mpId: number) => {
    setMps((prev) => prev.filter((mp) => mp.id !== mpId));
    startTransition(() => {
      removeMatchPlayerAction(matchId, mpId).catch(() => {});
    });
  };

  const openMp = openMpId != null ? mps.find((mp) => mp.id === openMpId) : null;
  const openPlayerName = openMp
    ? openMp.isGuest
      ? openMp.guestName ?? "Gäst"
      : teamPlayers.find((p) => p.id === openMp.playerId)?.name ?? "Okänd"
    : "";

  return (
    <>
      <div className="flex items-center justify-between mb-3 gap-2 flex-wrap">
        <div className="text-xs text-neutral-600">
          Bocka i spelarna som deltar. Klicka på "Positioner" för att finjustera
          spelbara och önskade positioner. Ändringar sparas automatiskt.
        </div>
        {teamPlayers.length > 0 ? (
          <button
            type="button"
            onClick={selectAll}
            className="text-xs h-7 px-2 rounded-md border border-border bg-white hover:bg-neutral-50 whitespace-nowrap"
          >
            {allCalled ? "Avmarkera alla" : `Välj alla (${teamPlayers.length})`}
          </button>
        ) : null}
      </div>

      <table className="w-full text-sm">
        <thead>
          <tr className="text-left text-xs text-neutral-500 uppercase">
            <th className="py-2 w-8"></th>
            <th className="py-2 font-medium">Namn</th>
            <th className="py-2 font-medium w-32 text-right"></th>
          </tr>
        </thead>
        <tbody>
          {teamPlayers.length === 0 ? (
            <tr>
              <td colSpan={3} className="py-2 text-neutral-600 text-sm">
                Laget har inga spelare än.
              </td>
            </tr>
          ) : (
            teamPlayers.map((p) => {
              const mp = mpByPlayer.get(p.id);
              const called = !!mp;
              return (
                <tr key={p.id} className="border-t border-border">
                  <td className="py-2">
                    <input
                      type="checkbox"
                      checked={called}
                      onChange={(e) => setCalled(p.id, e.target.checked)}
                      className="w-4 h-4 align-middle"
                      aria-label={`Kalla ${p.name}`}
                    />
                  </td>
                  <td className="py-2">
                    <span
                      className={called ? "" : "text-neutral-500"}
                    >
                      {p.name}
                    </span>
                    {mp && mp.playablePositionIds.length < allPositionIds.length ? (
                      <span className="ml-2 text-xs text-neutral-500">
                        · begränsad
                      </span>
                    ) : null}
                    {mp && mp.preferredPositionIds.length > 0 ? (
                      <span className="ml-2 text-xs text-emerald-700">
                        · önskar {mp.preferredPositionIds.length}
                      </span>
                    ) : null}
                  </td>
                  <td className="py-2 text-right">
                    {called && mp ? (
                      <button
                        type="button"
                        onClick={() => setOpenMpId(mp.id)}
                        className="text-xs h-7 px-2 rounded-md border border-border hover:bg-neutral-50"
                      >
                        Positioner
                      </button>
                    ) : null}
                  </td>
                </tr>
              );
            })
          )}

          {guests.map((g) => (
            <tr key={g.id} className="border-t border-border bg-amber-50/30">
              <td className="py-2">
                <span
                  className="inline-block w-4 h-4 rounded bg-amber-500 text-white text-[10px] text-center leading-4"
                  title="Gäst"
                >
                  G
                </span>
              </td>
              <td className="py-2">
                {g.guestName ?? "Gäst"}{" "}
                <span className="text-xs text-neutral-500">(gäst)</span>
                {g.playablePositionIds.length < allPositionIds.length ? (
                  <span className="ml-2 text-xs text-neutral-500">· begränsad</span>
                ) : null}
                {g.preferredPositionIds.length > 0 ? (
                  <span className="ml-2 text-xs text-emerald-700">
                    · önskar {g.preferredPositionIds.length}
                  </span>
                ) : null}
              </td>
              <td className="py-2 text-right">
                <div className="flex gap-2 justify-end">
                  <button
                    type="button"
                    onClick={() => setOpenMpId(g.id)}
                    className="text-xs h-7 px-2 rounded-md border border-border hover:bg-neutral-50"
                  >
                    Positioner
                  </button>
                  <button
                    type="button"
                    onClick={() => removeGuest(g.id)}
                    className="text-xs h-7 px-2 rounded-md text-red-600 hover:bg-red-50"
                  >
                    Ta bort
                  </button>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      <div className="mt-4 border-t border-border pt-3">
        <div className="text-xs text-neutral-500 mb-1 uppercase tracking-wide">
          Lägg till gästspelare
        </div>
        <div className="flex gap-2">
          <input
            value={guestDraft}
            onChange={(e) => setGuestDraft(e.target.value)}
            onBlur={addGuest}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                addGuest();
              }
            }}
            placeholder="Gästens namn"
            maxLength={60}
            className="flex-1 h-9 px-3 rounded-md border border-border bg-white text-sm outline-none"
          />
          <button
            type="button"
            onClick={addGuest}
            className="h-9 px-3 rounded-md border border-border text-sm bg-white"
          >
            Lägg till
          </button>
        </div>
      </div>

      {openMp ? (
        <PositionsModal
          playerName={openPlayerName}
          positions={positions}
          playable={openMp.playablePositionIds}
          preferred={openMp.preferredPositionIds}
          onClose={() => setOpenMpId(null)}
          onChange={(playable, preferred) =>
            updatePositions(openMp.id, playable, preferred)
          }
        />
      ) : null}
    </>
  );
}

function PositionsModal({
  playerName,
  positions,
  playable,
  preferred,
  onClose,
  onChange,
}: {
  playerName: string;
  positions: Position[];
  playable: number[];
  preferred: number[];
  onClose: () => void;
  onChange: (playable: number[], preferred: number[]) => void;
}) {
  const playableSet = new Set(playable);
  const preferredSet = new Set(preferred);

  const toggle = (
    set: Set<number>,
    id: number,
    isPlayable: boolean
  ): Set<number> => {
    const next = new Set(set);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    if (isPlayable) {
      // toggling playable off must also remove from preferred
      if (!next.has(id)) preferredSet.delete(id);
    }
    return next;
  };

  const handlePlayable = (posId: number) => {
    const nextPlayable = toggle(playableSet, posId, true);
    let nextPreferred = new Set(preferredSet);
    if (!nextPlayable.has(posId)) nextPreferred.delete(posId);
    onChange(
      Array.from(nextPlayable).sort((a, b) => a - b),
      Array.from(nextPreferred).sort((a, b) => a - b)
    );
  };

  const handlePreferred = (posId: number) => {
    if (!playableSet.has(posId)) return;
    const nextPreferred = toggle(preferredSet, posId, false);
    onChange(
      Array.from(playableSet).sort((a, b) => a - b),
      Array.from(nextPreferred).sort((a, b) => a - b)
    );
  };

  return (
    <div
      className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-3"
      role="dialog"
      aria-modal="true"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-lg shadow-xl max-w-md w-full max-h-[90vh] overflow-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="px-4 py-3 border-b border-border flex items-center justify-between">
          <div>
            <div className="text-xs text-neutral-500 uppercase tracking-wide">
              Positioner för
            </div>
            <div className="font-semibold">{playerName}</div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-neutral-500 hover:text-neutral-900 text-xl leading-none"
            aria-label="Stäng"
          >
            ×
          </button>
        </div>
        <div className="p-4">
          <p className="text-xs text-neutral-600 mb-3">
            <strong>Spelbar</strong>: spelaren kan spela på positionen.
            <br />
            <strong>Önskar</strong>: viktar upp positionen för byten.
          </p>
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs text-neutral-500 uppercase">
                <th className="py-2 font-medium">Position</th>
                <th className="py-2 font-medium text-center w-20">Spelbar</th>
                <th className="py-2 font-medium text-center w-20">Önskar</th>
              </tr>
            </thead>
            <tbody>
              {positions.map((p) => {
                const can = playableSet.has(p.id);
                const wants = preferredSet.has(p.id);
                return (
                  <tr key={p.id} className="border-t border-border">
                    <td className="py-2">
                      <span className="font-mono text-xs bg-neutral-100 px-1 py-0.5 rounded mr-2">
                        {p.abbreviation}
                      </span>
                      <span className="text-neutral-700">{p.name}</span>
                    </td>
                    <td className="py-2 text-center">
                      <input
                        type="checkbox"
                        checked={can}
                        onChange={() => handlePlayable(p.id)}
                        className="w-4 h-4"
                      />
                    </td>
                    <td className="py-2 text-center">
                      <input
                        type="checkbox"
                        checked={wants}
                        onChange={() => handlePreferred(p.id)}
                        disabled={!can}
                        className="w-4 h-4 disabled:opacity-40"
                      />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <div className="px-4 py-3 border-t border-border flex justify-end">
          <button
            type="button"
            onClick={onClose}
            className="h-9 px-4 rounded-md bg-neutral-900 text-white text-sm"
          >
            Klar
          </button>
        </div>
      </div>
    </div>
  );
}
