"use client";

import { useState, useTransition } from "react";
import {
  addGuestAction,
  removeMatchPlayerAction,
  togglePlayerCalledAction,
  updateMatchPlayerPositionsAction,
} from "@/app/(app)/matches/actions";
import { capitalizeName } from "@/lib/utils";

type Position = { id: number; name: string; abbreviation: string };
type OrgPlayer = { id: number; name: string };
type MatchPlayerRow = {
  id: number;
  playerId: number | null;
  isGuest: boolean;
  guestName: string | null;
  playablePositionIds: number[];
  preferredPositionIds: number[];
};

export function AdHocPlayersSection({
  matchId,
  orgPlayers,
  positions,
  initialMatchPlayers,
}: {
  matchId: number;
  orgPlayers: OrgPlayer[];
  positions: Position[];
  initialMatchPlayers: MatchPlayerRow[];
}) {
  const [mps, setMps] = useState<MatchPlayerRow[]>(initialMatchPlayers);
  const [query, setQuery] = useState("");
  const [openMpId, setOpenMpId] = useState<number | null>(null);
  const [, startTransition] = useTransition();

  const playerById = new Map(orgPlayers.map((p) => [p.id, p]));
  const calledPlayerIds = new Set(
    mps.map((mp) => mp.playerId).filter((id): id is number => id !== null)
  );

  const allPositionIds = positions.map((p) => p.id);

  const cleaned = query.trim().toLowerCase();
  const suggestions = cleaned
    ? orgPlayers
        .filter(
          (p) =>
            !calledPlayerIds.has(p.id) &&
            p.name.toLowerCase().includes(cleaned)
        )
        .slice(0, 8)
    : [];

  const exactOrgMatch = cleaned
    ? orgPlayers.find(
        (p) =>
          !calledPlayerIds.has(p.id) && p.name.toLowerCase() === cleaned
      ) ?? null
    : null;

  const addOrgPlayer = (playerId: number) => {
    const p = playerById.get(playerId);
    if (!p) return;
    const temp: MatchPlayerRow = {
      id: -Date.now() - Math.floor(Math.random() * 1000),
      playerId,
      isGuest: false,
      guestName: null,
      playablePositionIds: allPositionIds,
      preferredPositionIds: [],
    };
    setMps((prev) => [...prev, temp]);
    setQuery("");
    startTransition(async () => {
      const created = await togglePlayerCalledAction(
        matchId,
        playerId,
        true
      ).catch(() => null);
      setMps((prev) => {
        const idx = prev.findIndex((mp) => mp.id === temp.id);
        if (idx === -1) return prev;
        if (!created) return prev.filter((mp) => mp.id !== temp.id);
        const next = [...prev];
        next[idx] = created;
        return next;
      });
    });
  };

  const addGuest = (rawName: string) => {
    const name = capitalizeName(rawName.trim());
    if (!name) return;
    const temp: MatchPlayerRow = {
      id: -Date.now() - Math.floor(Math.random() * 1000),
      playerId: null,
      isGuest: true,
      guestName: name,
      playablePositionIds: allPositionIds,
      preferredPositionIds: [],
    };
    setMps((prev) => [...prev, temp]);
    setQuery("");
    startTransition(async () => {
      const created = await addGuestAction(matchId, name).catch(() => null);
      setMps((prev) => {
        const idx = prev.findIndex((mp) => mp.id === temp.id);
        if (idx === -1) return prev;
        if (!created) return prev.filter((mp) => mp.id !== temp.id);
        const next = [...prev];
        next[idx] = created;
        return next;
      });
    });
  };

  const commitQuery = () => {
    if (!cleaned) return;
    if (exactOrgMatch) {
      addOrgPlayer(exactOrgMatch.id);
      return;
    }
    if (suggestions.length === 1) {
      addOrgPlayer(suggestions[0].id);
      return;
    }
    // No org match — treat as guest.
    addGuest(query);
  };

  const removeMp = (mpId: number) => {
    const mp = mps.find((m) => m.id === mpId);
    if (!mp) return;
    setMps((prev) => prev.filter((m) => m.id !== mpId));
    startTransition(() => {
      if (mp.playerId !== null) {
        togglePlayerCalledAction(matchId, mp.playerId, false).catch(() => {});
      } else {
        removeMatchPlayerAction(matchId, mpId).catch(() => {});
      }
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

  const nameOf = (mp: MatchPlayerRow): string => {
    if (mp.isGuest) return mp.guestName ?? "Gäst";
    const p = playerById.get(mp.playerId!);
    return p?.name ?? "Okänd";
  };

  const openMp = openMpId != null ? mps.find((mp) => mp.id === openMpId) : null;

  return (
    <>
      <p className="text-sm text-neutral-700 mb-3">
        Sök och lägg till spelare från organisationen. Skriv ett namn som inte
        finns för att lägga till som gäst.
      </p>

      <div className="mb-3 relative">
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              commitQuery();
            }
            if (e.key === "Escape") setQuery("");
          }}
          placeholder="Sök eller skriv nytt namn..."
          className="w-full h-10 px-3 rounded-md border border-border bg-white text-sm outline-none focus:ring-2 focus:ring-emerald-500"
        />
        {cleaned && suggestions.length > 0 ? (
          <div className="absolute left-0 right-0 top-full mt-1 z-10 bg-white border border-border rounded-md shadow-sm max-h-64 overflow-auto">
            {suggestions.map((p) => (
              <button
                key={p.id}
                type="button"
                onClick={() => addOrgPlayer(p.id)}
                className="w-full text-left px-3 py-2 text-sm hover:bg-neutral-50 border-b border-border last:border-b-0"
              >
                {p.name}
              </button>
            ))}
            {!exactOrgMatch ? (
              <button
                type="button"
                onClick={() => addGuest(query)}
                className="w-full text-left px-3 py-2 text-sm hover:bg-amber-50 bg-amber-50/30 border-t border-border"
              >
                Lägg till "{capitalizeName(query.trim())}" som gäst
              </button>
            ) : null}
          </div>
        ) : cleaned && suggestions.length === 0 ? (
          <div className="absolute left-0 right-0 top-full mt-1 z-10 bg-white border border-border rounded-md shadow-sm">
            <button
              type="button"
              onClick={() => addGuest(query)}
              className="w-full text-left px-3 py-2 text-sm hover:bg-amber-50 bg-amber-50/30"
            >
              Ingen spelare matchar. Lägg till "
              {capitalizeName(query.trim())}" som gäst.
            </button>
          </div>
        ) : null}
      </div>

      {mps.length === 0 ? (
        <p className="text-sm text-neutral-500 italic">
          Inga spelare tillagda än.
        </p>
      ) : (
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-xs text-neutral-500 uppercase">
              <th className="py-2 font-medium">Namn</th>
              <th className="py-2 font-medium w-44 text-right"></th>
            </tr>
          </thead>
          <tbody>
            {mps.map((mp) => (
              <tr
                key={mp.id}
                className={`border-t border-border ${mp.isGuest ? "bg-amber-50/30" : ""}`}
              >
                <td className="py-2">
                  {mp.isGuest ? (
                    <>
                      <span
                        className="inline-block w-4 h-4 rounded bg-amber-500 text-white text-[10px] text-center leading-4 mr-2"
                        title="Gäst"
                      >
                        G
                      </span>
                      {nameOf(mp)}{" "}
                      <span className="text-sm text-neutral-600">(gäst)</span>
                    </>
                  ) : (
                    nameOf(mp)
                  )}
                  {mp.playablePositionIds.length < allPositionIds.length ? (
                    <span className="ml-2 text-sm text-neutral-600">
                      · begränsad
                    </span>
                  ) : null}
                  {mp.preferredPositionIds.length > 0 ? (
                    <span className="ml-2 text-sm text-emerald-700">
                      · önskar {mp.preferredPositionIds.length}
                    </span>
                  ) : null}
                </td>
                <td className="py-2 text-right">
                  <div className="flex gap-2 justify-end">
                    <button
                      type="button"
                      onClick={() => setOpenMpId(mp.id)}
                      className="text-sm h-9 px-3 rounded-md border border-border hover:bg-neutral-50"
                    >
                      Positioner
                    </button>
                    <button
                      type="button"
                      onClick={() => removeMp(mp.id)}
                      className="text-sm h-9 px-3 rounded-md text-red-700 hover:bg-red-50"
                    >
                      Ta bort
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {openMp ? (
        <AdHocPositionsModal
          playerName={nameOf(openMp)}
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

function AdHocPositionsModal({
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

  const handlePlayable = (posId: number) => {
    const nextPlayable = new Set(playableSet);
    if (nextPlayable.has(posId)) nextPlayable.delete(posId);
    else nextPlayable.add(posId);
    const nextPreferred = new Set(preferredSet);
    if (!nextPlayable.has(posId)) nextPreferred.delete(posId);
    onChange(
      Array.from(nextPlayable).sort((a, b) => a - b),
      Array.from(nextPreferred).sort((a, b) => a - b)
    );
  };

  const handlePreferred = (posId: number) => {
    if (!playableSet.has(posId)) return;
    const nextPreferred = new Set(preferredSet);
    if (nextPreferred.has(posId)) nextPreferred.delete(posId);
    else nextPreferred.add(posId);
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
                        className="w-5 h-5 accent-emerald-600"
                      />
                    </td>
                    <td className="py-2 text-center">
                      <input
                        type="checkbox"
                        checked={wants}
                        onChange={() => handlePreferred(p.id)}
                        disabled={!can}
                        className="w-5 h-5 accent-emerald-600 disabled:opacity-40"
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
