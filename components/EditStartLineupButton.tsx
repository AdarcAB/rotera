"use client";

import { useState } from "react";
import { EditStartLineupModal } from "./EditStartLineupModal";

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

export function EditStartLineupButton({
  matchId,
  positions,
  players,
  initialLineup,
}: {
  matchId: number;
  positions: Position[];
  players: Player[];
  initialLineup: { positionId: number; playerId: number }[];
}) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="h-9 px-3 text-sm rounded-md border border-border bg-white hover:bg-neutral-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500"
      >
        Ändra startuppställning
      </button>
      {open ? (
        <EditStartLineupModal
          matchId={matchId}
          positions={positions}
          players={players}
          initialLineup={initialLineup}
          onClose={() => setOpen(false)}
        />
      ) : null}
    </>
  );
}
