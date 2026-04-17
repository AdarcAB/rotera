"use client";

import { useCallback, useEffect, useMemo, useRef, useState, useTransition } from "react";
import type { Schedule } from "@/lib/schedule/types";
import { Button } from "@/components/ui/Button";
import { formatTime } from "@/lib/utils";
import { persistLiveState, finishMatch } from "./actions";
import type { AdHocSub, LiveState } from "./page";

const PRE_SUB_WARN_SECONDS = 10;

function playBeep(frequency = 880, durationMs = 200, volume = 0.35) {
  try {
    const AC = (window.AudioContext ||
      (window as unknown as { webkitAudioContext: typeof AudioContext })
        .webkitAudioContext) as typeof AudioContext;
    const ctx = new AC();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = "sine";
    osc.frequency.value = frequency;
    gain.gain.value = volume;
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start();
    setTimeout(() => {
      osc.stop();
      ctx.close();
    }, durationMs);
  } catch {
    // silent fail — audio not allowed until user interaction
  }
}

function defaultLiveState(): LiveState {
  return {
    status: "pre_period",
    currentPeriodIndex: 0,
    resumedAt: null,
    elapsedBeforePause: 0,
    completedSubPoints: [],
    adHocSubs: [],
  };
}

type LineupState = Map<number, number>;

function applyAdHocSubsForPeriod(
  lineup: LineupState,
  adHocSubs: AdHocSub[] | undefined,
  periodIndex: number,
  uptoMinute: number
): LineupState {
  if (!adHocSubs || adHocSubs.length === 0) return lineup;
  const sorted = [...adHocSubs]
    .filter((s) => s.periodIndex === periodIndex && s.minuteInPeriod <= uptoMinute)
    .sort((a, b) => a.minuteInPeriod - b.minuteInPeriod);
  for (const sub of sorted) lineup.set(sub.positionId, sub.inPlayerId);
  return lineup;
}

function buildCurrentLineup(
  schedule: Schedule,
  live: LiveState,
  elapsedSec: number
): LineupState {
  const minuteInPeriod = Math.floor(elapsedSec / 60);
  const period = schedule.periods[live.currentPeriodIndex];
  const lineup: LineupState = new Map();

  // start from period start lineup
  for (const slot of period.startLineup) lineup.set(slot.positionId, slot.playerId);

  // apply completed scheduled sub points
  const sortedSubs = [...period.subPoints].sort(
    (a, b) => a.minuteInPeriod - b.minuteInPeriod
  );
  const completedInPeriod = (live.completedSubPoints ?? [])
    .filter((c) => c.periodIndex === live.currentPeriodIndex)
    .map((c) => c.subPointIndex);
  for (let i = 0; i < sortedSubs.length; i++) {
    if (completedInPeriod.includes(i)) {
      for (const c of sortedSubs[i].changes) lineup.set(c.positionId, c.inPlayerId);
    }
  }

  applyAdHocSubsForPeriod(lineup, live.adHocSubs, live.currentPeriodIndex, minuteInPeriod);
  return lineup;
}

export function LiveMatch({
  matchId,
  schedule,
  minutesPerPeriod,
  numPeriods,
  positionMap,
  playerMap,
  initialLiveState,
}: {
  matchId: number;
  schedule: Schedule;
  minutesPerPeriod: number;
  numPeriods: number;
  positionMap: Record<number, { name: string; abbreviation: string }>;
  playerMap: Record<number, string>;
  initialLiveState: LiveState | null;
}) {
  const [live, setLive] = useState<LiveState>(initialLiveState ?? defaultLiveState());
  const [now, setNow] = useState<number>(() => Date.now());
  const beepedRef = useRef<Set<string>>(new Set());
  const [, startSave] = useTransition();
  const [adHocOpenFor, setAdHocOpenFor] = useState<number | null>(null);

  useEffect(() => {
    if (live.status !== "running") return;
    const id = window.setInterval(() => setNow(Date.now()), 250);
    return () => window.clearInterval(id);
  }, [live.status]);

  const saveLive = useCallback(
    (state: LiveState) => {
      startSave(() => {
        persistLiveState(matchId, state).catch(() => {});
      });
    },
    [matchId]
  );

  useEffect(() => {
    if (live.status !== "running") return;
    const id = window.setInterval(() => saveLive(live), 5000);
    return () => window.clearInterval(id);
  }, [live, saveLive]);

  const periodMs = minutesPerPeriod * 60 * 1000;

  const elapsedMs = useMemo(() => {
    if (live.status === "running" && live.resumedAt) {
      return live.elapsedBeforePause + (now - new Date(live.resumedAt).getTime());
    }
    return live.elapsedBeforePause;
  }, [live, now]);

  const remainingSec = Math.max(0, Math.round((periodMs - elapsedMs) / 1000));
  const elapsedSec = Math.round(elapsedMs / 1000);
  const minuteInPeriod = Math.floor(elapsedSec / 60);

  const currentPeriod = schedule.periods[live.currentPeriodIndex];
  const sortedSubPoints = useMemo(
    () =>
      currentPeriod
        ? [...currentPeriod.subPoints].sort(
            (a, b) => a.minuteInPeriod - b.minuteInPeriod
          )
        : [],
    [currentPeriod]
  );

  const nextSub = useMemo(() => {
    for (let i = 0; i < sortedSubPoints.length; i++) {
      const sp = sortedSubPoints[i];
      const key = `${live.currentPeriodIndex}:${i}`;
      if (
        live.completedSubPoints.some(
          (c) =>
            c.periodIndex === live.currentPeriodIndex && c.subPointIndex === i
        )
      ) {
        continue;
      }
      return { subPoint: sp, index: i, key };
    }
    return null;
  }, [sortedSubPoints, live.currentPeriodIndex, live.completedSubPoints]);

  const nextSubAtSec = nextSub ? nextSub.subPoint.minuteInPeriod * 60 : null;
  const secondsUntilNextSub =
    nextSubAtSec !== null ? nextSubAtSec - elapsedSec : null;

  const showSubModal =
    live.status === "running" &&
    nextSub !== null &&
    secondsUntilNextSub !== null &&
    secondsUntilNextSub <= 0 &&
    nextSub.subPoint.changes.length > 0;

  const showPreSubWarning =
    live.status === "running" &&
    nextSub !== null &&
    secondsUntilNextSub !== null &&
    secondsUntilNextSub > 0 &&
    secondsUntilNextSub <= PRE_SUB_WARN_SECONDS;

  useEffect(() => {
    if (
      live.status === "running" &&
      nextSub !== null &&
      secondsUntilNextSub !== null &&
      secondsUntilNextSub <= 0
    ) {
      const key = nextSub.key;
      if (!beepedRef.current.has(key) && nextSub.subPoint.changes.length > 0) {
        beepedRef.current.add(key);
        playBeep(880, 220, 0.4);
        setTimeout(() => playBeep(660, 220, 0.4), 260);
      }
    }
  }, [live.status, nextSub, secondsUntilNextSub]);

  useEffect(() => {
    if (
      live.status === "running" &&
      elapsedMs >= periodMs &&
      live.currentPeriodIndex < numPeriods
    ) {
      const next: LiveState = {
        ...live,
        status: "pre_period",
        resumedAt: null,
        elapsedBeforePause: 0,
        currentPeriodIndex: Math.min(numPeriods - 1, live.currentPeriodIndex + 1),
      };
      const isLast = live.currentPeriodIndex >= numPeriods - 1;
      if (isLast) next.status = "finished";
      setLive(next);
      saveLive(next);
    }
  }, [elapsedMs, live, periodMs, numPeriods, saveLive]);

  const handleStartPeriod = () => {
    const next: LiveState = {
      ...live,
      status: "running",
      resumedAt: new Date().toISOString(),
      elapsedBeforePause: 0,
    };
    setLive(next);
    saveLive(next);
    playBeep(660, 150, 0.3);
  };

  const handlePause = () => {
    if (live.status !== "running" || !live.resumedAt) return;
    const elapsed =
      live.elapsedBeforePause + (Date.now() - new Date(live.resumedAt).getTime());
    const next: LiveState = {
      ...live,
      status: "paused",
      elapsedBeforePause: elapsed,
      resumedAt: null,
    };
    setLive(next);
    saveLive(next);
  };

  const handleResume = () => {
    const next: LiveState = {
      ...live,
      status: "running",
      resumedAt: new Date().toISOString(),
    };
    setLive(next);
    saveLive(next);
  };

  const handleJumpToBreak = () => {
    const isLast = live.currentPeriodIndex >= numPeriods - 1;
    const next: LiveState = {
      ...live,
      status: isLast ? "finished" : "pre_period",
      resumedAt: null,
      elapsedBeforePause: 0,
      currentPeriodIndex: isLast
        ? live.currentPeriodIndex
        : live.currentPeriodIndex + 1,
    };
    setLive(next);
    saveLive(next);
  };

  const handleCompleteSub = () => {
    if (!nextSub) return;
    const key = { periodIndex: live.currentPeriodIndex, subPointIndex: nextSub.index };
    const next: LiveState = {
      ...live,
      completedSubPoints: [...live.completedSubPoints, key],
    };
    setLive(next);
    saveLive(next);
  };

  const currentLineup = useMemo<LineupState>(() => {
    if (live.status === "pre_period" || live.status === "finished") {
      const map: LineupState = new Map();
      const period = schedule.periods[live.currentPeriodIndex];
      if (!period) return map;
      for (const slot of period.startLineup) map.set(slot.positionId, slot.playerId);
      return map;
    }
    return buildCurrentLineup(schedule, live, elapsedSec);
  }, [live, schedule, elapsedSec]);

  const allPlayerIds = Object.keys(playerMap).map((k) => Number(k));
  const onFieldIds = new Set(currentLineup.values());
  const benchIds = allPlayerIds.filter((id) => !onFieldIds.has(id));

  const performAdHocSub = (positionId: number, inPlayerId: number) => {
    const outPlayerId = currentLineup.get(positionId);
    if (outPlayerId === undefined || outPlayerId === inPlayerId) return;
    const sub: AdHocSub = {
      periodIndex: live.currentPeriodIndex,
      minuteInPeriod,
      positionId,
      outPlayerId,
      inPlayerId,
    };
    const next: LiveState = {
      ...live,
      adHocSubs: [...(live.adHocSubs ?? []), sub],
    };
    setLive(next);
    saveLive(next);
    setAdHocOpenFor(null);
  };

  if (live.status === "finished") {
    return <FinishedView matchId={matchId} />;
  }

  return (
    <div className="max-w-2xl mx-auto">
      <div className="mb-2 text-sm text-neutral-600 flex items-center gap-3">
        <a href={`/matches/${matchId}`} className="hover:underline">
          ← Match
        </a>
        <span>·</span>
        <span>
          Period {live.currentPeriodIndex + 1} av {numPeriods}
        </span>
      </div>

      {live.status === "pre_period" ? (
        <PrePeriodView
          periodIndex={live.currentPeriodIndex}
          numPeriods={numPeriods}
          schedule={schedule}
          positionMap={positionMap}
          playerMap={playerMap}
          onStart={handleStartPeriod}
        />
      ) : (
        <RunningView
          live={live}
          elapsedSec={elapsedSec}
          remainingSec={remainingSec}
          secondsUntilNextSub={secondsUntilNextSub}
          showPreSubWarning={showPreSubWarning}
          nextSubMinute={nextSub?.subPoint.minuteInPeriod ?? null}
          currentLineup={currentLineup}
          benchIds={benchIds}
          positionMap={positionMap}
          playerMap={playerMap}
          schedule={schedule}
          onPause={handlePause}
          onResume={handleResume}
          onJumpToBreak={handleJumpToBreak}
          onTapFieldPlayer={(posId) => setAdHocOpenFor(posId)}
        />
      )}

      {showSubModal && nextSub ? (
        <SubModal
          changes={nextSub.subPoint.changes}
          positionMap={positionMap}
          playerMap={playerMap}
          onComplete={handleCompleteSub}
        />
      ) : null}

      {adHocOpenFor !== null ? (
        <AdHocBenchModal
          positionId={adHocOpenFor}
          outPlayerId={currentLineup.get(adHocOpenFor) ?? 0}
          positionMap={positionMap}
          playerMap={playerMap}
          benchIds={benchIds}
          schedule={schedule}
          onClose={() => setAdHocOpenFor(null)}
          onPick={(inPlayerId) => performAdHocSub(adHocOpenFor, inPlayerId)}
        />
      ) : null}
    </div>
  );
}

function PrePeriodView({
  periodIndex,
  numPeriods,
  schedule,
  positionMap,
  playerMap,
  onStart,
}: {
  periodIndex: number;
  numPeriods: number;
  schedule: Schedule;
  positionMap: Record<number, { name: string; abbreviation: string }>;
  playerMap: Record<number, string>;
  onStart: () => void;
}) {
  const period = schedule.periods[periodIndex];
  const sortedPositions = [...period.startLineup].sort(
    (a, b) => a.positionId - b.positionId
  );

  const allIds = Object.keys(playerMap).map((k) => Number(k));
  const onFieldIds = new Set(sortedPositions.map((s) => s.playerId));
  const benchIds = allIds.filter((id) => !onFieldIds.has(id));

  const sortedSubs = [...period.subPoints].sort(
    (a, b) => a.minuteInPeriod - b.minuteInPeriod
  );

  return (
    <div>
      <h1 className="text-3xl md:text-4xl font-bold tracking-tight">
        Period {periodIndex + 1} av {numPeriods}
      </h1>
      <p className="text-neutral-600 mb-4">
        Tryck på knappen när domaren blåser igång.
      </p>

      <div className="rounded-lg border border-border bg-white p-4 mb-4">
        <div className="font-semibold mb-3">Uppställning</div>
        <Pitch
          lineup={sortedPositions}
          positionMap={positionMap}
          playerMap={playerMap}
        />
      </div>

      <div className="rounded-lg border border-border bg-white p-4 mb-4">
        <div className="font-semibold mb-2">Bänk</div>
        {benchIds.length === 0 ? (
          <div className="text-sm text-neutral-600">Inga bänkspelare.</div>
        ) : (
          <div className="flex flex-wrap gap-2">
            {benchIds.map((id) => (
              <span
                key={id}
                className="px-2 py-1 rounded-md border border-border text-sm bg-neutral-50"
              >
                {playerMap[id] ?? "?"}
              </span>
            ))}
          </div>
        )}
      </div>

      <div className="rounded-lg border border-border bg-white p-4 mb-6">
        <div className="font-semibold mb-2">
          Byten i perioden
          {sortedSubs.length > 0 ? (
            <span className="text-neutral-500 font-normal">
              {" "}
              · {sortedSubs.length} st
            </span>
          ) : null}
        </div>
        {sortedSubs.length === 0 ? (
          <div className="text-sm text-neutral-600">Inga planerade byten.</div>
        ) : (
          <div className="flex flex-wrap gap-2 text-sm">
            {sortedSubs.map((sp, i) => (
              <span
                key={i}
                className="px-2 py-1 rounded-md bg-neutral-100"
                title={
                  sp.changes.length > 1
                    ? `${sp.changes.length} spelarbyten samtidigt`
                    : undefined
                }
              >
                {sp.minuteInPeriod}&apos;
                {sp.changes.length > 1 ? ` (${sp.changes.length} spelare)` : ""}
              </span>
            ))}
          </div>
        )}
      </div>

      <Button size="xl" className="w-full bg-primary" onClick={onStart}>
        ▶ Starta period {periodIndex + 1}
      </Button>
    </div>
  );
}

function RunningView({
  live,
  elapsedSec,
  remainingSec,
  secondsUntilNextSub,
  showPreSubWarning,
  nextSubMinute,
  currentLineup,
  benchIds,
  positionMap,
  playerMap,
  schedule,
  onPause,
  onResume,
  onJumpToBreak,
  onTapFieldPlayer,
}: {
  live: LiveState;
  elapsedSec: number;
  remainingSec: number;
  secondsUntilNextSub: number | null;
  showPreSubWarning: boolean;
  nextSubMinute: number | null;
  currentLineup: LineupState;
  benchIds: number[];
  positionMap: Record<number, { name: string; abbreviation: string }>;
  playerMap: Record<number, string>;
  schedule: Schedule;
  onPause: () => void;
  onResume: () => void;
  onJumpToBreak: () => void;
  onTapFieldPlayer: (positionId: number) => void;
}) {
  return (
    <div>
      {showPreSubWarning ? (
        <div className="mb-3 rounded-md bg-red-600 text-white px-4 py-2 font-semibold text-center animate-pulse">
          Byte om {secondsUntilNextSub}s
        </div>
      ) : null}

      <div className="rounded-lg border border-border bg-white p-4 mb-3 text-center">
        <div className="text-6xl md:text-7xl font-mono font-bold tracking-tight">
          {formatTime(remainingSec)}
        </div>
        <div className="text-sm text-neutral-600 mt-2">
          {nextSubMinute !== null && secondsUntilNextSub !== null
            ? `Nästa byte: ${nextSubMinute}′ (om ${Math.max(
                0,
                secondsUntilNextSub
              )}s)`
            : "Inga fler byten denna period"}
          {" · "}
          Spelat: {formatTime(elapsedSec)}
        </div>
      </div>

      <div className="rounded-lg border border-border bg-white p-4 mb-3">
        <div className="flex items-center justify-between mb-2">
          <div className="font-semibold">På plan</div>
          <div className="text-xs text-neutral-500">Tryck på en spelare för byte</div>
        </div>
        <Pitch
          lineup={Array.from(currentLineup.entries()).map(([positionId, playerId]) => ({
            positionId,
            playerId,
          }))}
          positionMap={positionMap}
          playerMap={playerMap}
          onTap={onTapFieldPlayer}
        />
      </div>

      <UpcomingSubsPreview
        live={live}
        schedule={schedule}
        positionMap={positionMap}
        playerMap={playerMap}
      />

      <div className="rounded-lg border border-border bg-white p-3 mb-4">
        <div className="font-semibold mb-2 text-sm">Bänk</div>
        <div className="flex flex-wrap gap-2">
          {benchIds.length === 0 ? (
            <span className="text-xs text-neutral-500">Tom</span>
          ) : (
            benchIds.map((id) => (
              <span
                key={id}
                className="px-2 py-1 rounded-md border border-border text-sm bg-neutral-50"
              >
                {playerMap[id] ?? "?"}
              </span>
            ))
          )}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2">
        {live.status === "running" ? (
          <Button variant="secondary" size="lg" onClick={onPause}>
            ⏸ Pausa
          </Button>
        ) : (
          <Button size="lg" onClick={onResume}>
            ▶ Återuppta
          </Button>
        )}
        <Button variant="secondary" size="lg" onClick={onJumpToBreak}>
          ⏭ Hoppa till paus
        </Button>
      </div>
    </div>
  );
}

function UpcomingSubsPreview({
  live,
  schedule,
  positionMap,
  playerMap,
}: {
  live: LiveState;
  schedule: Schedule;
  positionMap: Record<number, { name: string; abbreviation: string }>;
  playerMap: Record<number, string>;
}) {
  const [expanded, setExpanded] = useState(false);
  const period = schedule.periods[live.currentPeriodIndex];
  if (!period) return null;
  const sortedSubs = [...period.subPoints].sort(
    (a, b) => a.minuteInPeriod - b.minuteInPeriod
  );
  const remaining = sortedSubs
    .map((sp, i) => ({ sp, i }))
    .filter(
      ({ i }) =>
        !live.completedSubPoints.some(
          (c) => c.periodIndex === live.currentPeriodIndex && c.subPointIndex === i
        )
    );

  if (remaining.length === 0) {
    return (
      <div className="rounded-lg border border-border bg-white p-3 mb-3 text-sm text-neutral-500">
        Inga fler planerade byten i perioden.
      </div>
    );
  }

  const [next, ...later] = remaining;

  return (
    <div className="rounded-lg border border-border bg-white p-3 mb-3">
      <div className="text-xs text-neutral-500 uppercase tracking-wide mb-1">
        Nästa byte
      </div>
      <div className="mb-1 font-semibold text-base">
        {next.sp.minuteInPeriod}&apos;
        {next.sp.changes.length > 1
          ? ` · ${next.sp.changes.length} spelarbyten`
          : ""}
      </div>
      <ul className="space-y-0.5 text-sm mb-2">
        {next.sp.changes.length === 0 ? (
          <li className="text-neutral-500">(inget byte)</li>
        ) : (
          next.sp.changes.map((c, i) => (
            <li key={i}>
              <span className="inline-block font-semibold bg-neutral-100 px-1.5 py-0.5 rounded mr-2">
                {positionMap[c.positionId]?.abbreviation ?? "?"}
              </span>
              <span className="text-red-700">UT:</span>{" "}
              {playerMap[c.outPlayerId] ?? "?"}{" "}
              <span className="text-neutral-400">→</span>{" "}
              <span className="text-emerald-700">IN:</span>{" "}
              {playerMap[c.inPlayerId] ?? "?"}
            </li>
          ))
        )}
      </ul>

      {later.length > 0 ? (
        <div>
          <button
            type="button"
            onClick={() => setExpanded((v) => !v)}
            className="text-xs text-neutral-600 hover:underline"
          >
            {expanded
              ? "▾ Dölj senare byten"
              : `▸ Visa ${later.length} senare byten`}
          </button>
          {expanded ? (
            <ul className="mt-2 space-y-1 text-xs text-neutral-700">
              {later.map(({ sp, i }) => (
                <li key={i}>
                  <span className="font-mono bg-neutral-50 px-1 rounded">
                    {sp.minuteInPeriod}&apos;
                  </span>{" "}
                  {sp.changes
                    .map(
                      (c) =>
                        `${positionMap[c.positionId]?.abbreviation ?? "?"}: ${
                          playerMap[c.outPlayerId] ?? "?"
                        } → ${playerMap[c.inPlayerId] ?? "?"}`
                    )
                    .join(" · ")}
                </li>
              ))}
            </ul>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

function SubModal({
  changes,
  positionMap,
  playerMap,
  onComplete,
}: {
  changes: { positionId: number; outPlayerId: number; inPlayerId: number }[];
  positionMap: Record<number, { name: string; abbreviation: string }>;
  playerMap: Record<number, string>;
  onComplete: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50 bg-black/95 flex flex-col text-white p-6 overflow-auto">
      <div className="flex-1 flex flex-col justify-center max-w-2xl mx-auto w-full">
        <div className="text-center mb-6">
          <div className="text-3xl font-bold">BYTE!</div>
        </div>

        <div className="space-y-4 mb-8">
          {changes.map((c, i) => (
            <div
              key={i}
              className="rounded-lg bg-neutral-900 border border-neutral-700 p-4"
            >
              <div className="text-2xl md:text-3xl font-bold text-amber-300 mb-2">
                {positionMap[c.positionId]?.abbreviation ?? "?"}{" "}
                <span className="text-neutral-400 font-normal text-lg">
                  {positionMap[c.positionId]?.name}
                </span>
              </div>
              <div className="flex items-center justify-between text-xl md:text-2xl font-semibold">
                <div>
                  <span className="text-red-400">UT:</span>{" "}
                  {playerMap[c.outPlayerId] ?? "?"}
                </div>
                <div className="text-neutral-600">→</div>
                <div>
                  <span className="text-emerald-400">IN:</span>{" "}
                  {playerMap[c.inPlayerId] ?? "?"}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      <button
        onClick={onComplete}
        className="sticky bottom-0 h-20 w-full bg-primary text-primary-foreground text-2xl font-semibold rounded-lg"
      >
        ✅ Byte genomfört
      </button>
    </div>
  );
}

function AdHocBenchModal({
  positionId,
  outPlayerId,
  positionMap,
  playerMap,
  benchIds,
  schedule,
  onClose,
  onPick,
}: {
  positionId: number;
  outPlayerId: number;
  positionMap: Record<number, { name: string; abbreviation: string }>;
  playerMap: Record<number, string>;
  benchIds: number[];
  schedule: Schedule;
  onClose: () => void;
  onPick: (inPlayerId: number) => void;
}) {
  // We need to know per bench player: can they play this pos?; prefers?;
  // scheduled minutes. These aren't directly on schedule; infer from the
  // generated schedule's per-player minutes (as a proxy) and from whether
  // they appear with this positionId anywhere.
  const prefersPos = (pid: number): boolean => {
    for (const per of schedule.periods) {
      for (const slot of per.startLineup) {
        if (slot.playerId === pid && slot.positionId === positionId) return true;
      }
      for (const sp of per.subPoints) {
        for (const c of sp.changes) {
          if (c.inPlayerId === pid && c.positionId === positionId) return true;
        }
      }
    }
    return false;
  };

  const scheduledMins = (pid: number): number => schedule.perPlayerMinutes?.[pid] ?? 0;

  const sorted = benchIds
    .slice()
    .sort((a, b) => {
      const pa = prefersPos(a) ? 1 : 0;
      const pb = prefersPos(b) ? 1 : 0;
      if (pa !== pb) return pb - pa;
      return scheduledMins(a) - scheduledMins(b);
    });

  const pos = positionMap[positionId];

  return (
    <div
      className="fixed inset-0 z-50 bg-black/60 flex items-end md:items-center justify-center"
      onClick={onClose}
    >
      <div
        className="bg-white w-full md:max-w-md rounded-t-lg md:rounded-lg shadow-xl max-h-[90vh] overflow-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="px-4 py-3 border-b border-border flex items-center justify-between">
          <div>
            <div className="text-xs text-neutral-500 uppercase tracking-wide">
              Byt in på {pos?.abbreviation} ({pos?.name})
            </div>
            <div className="font-semibold">
              UT: {playerMap[outPlayerId] ?? "?"}
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-neutral-500 hover:text-neutral-900 text-xl leading-none"
            aria-label="Avbryt"
          >
            ×
          </button>
        </div>
        <div className="p-2">
          {sorted.length === 0 ? (
            <div className="p-4 text-sm text-neutral-600 text-center">
              Ingen på bänken.
            </div>
          ) : (
            <ul>
              {sorted.map((id) => {
                const prefers = prefersPos(id);
                const mins = scheduledMins(id);
                return (
                  <li key={id}>
                    <button
                      type="button"
                      onClick={() => onPick(id)}
                      className="w-full flex items-center justify-between px-3 py-3 rounded-md hover:bg-neutral-50 text-left"
                    >
                      <div>
                        <div className="font-medium">
                          {playerMap[id] ?? "?"}{" "}
                          {prefers ? (
                            <span className="text-xs text-emerald-700 ml-1">
                              · kan spela här
                            </span>
                          ) : (
                            <span className="text-xs text-amber-600 ml-1">
                              · ovanlig pos
                            </span>
                          )}
                        </div>
                        <div className="text-xs text-neutral-500">
                          {mins} min i schema
                        </div>
                      </div>
                      <div className="text-primary font-semibold">IN →</div>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
        <div className="px-4 py-3 border-t border-border flex justify-end">
          <button
            type="button"
            onClick={onClose}
            className="h-9 px-4 rounded-md text-neutral-700 text-sm"
          >
            Avbryt
          </button>
        </div>
      </div>
    </div>
  );
}

function Pitch({
  lineup,
  positionMap,
  playerMap,
  onTap,
}: {
  lineup: { positionId: number; playerId: number }[];
  positionMap: Record<number, { name: string; abbreviation: string }>;
  playerMap: Record<number, string>;
  onTap?: (positionId: number) => void;
}) {
  const count = lineup.length;
  const sorted = [...lineup].sort((a, b) => a.positionId - b.positionId);
  const rows = splitIntoRows(count);
  const placed: { row: number; col: number; slot: (typeof sorted)[number] }[] = [];
  let idx = 0;
  for (let r = 0; r < rows.length; r++) {
    for (let c = 0; c < rows[r]; c++) {
      if (idx >= sorted.length) break;
      placed.push({ row: r, col: c, slot: sorted[idx] });
      idx++;
    }
  }

  return (
    <div className="aspect-[3/4] max-h-[60vh] w-full max-w-xs mx-auto rounded-lg bg-emerald-700 relative border-2 border-white/80 overflow-hidden">
      <div className="absolute top-1/2 left-0 right-0 border-t border-white/60" />
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-16 h-16 border border-white/60 rounded-full" />

      {placed.map(({ row, col, slot }) => {
        // Flip vertically so row 0 (MV) lands at the bottom (home side).
        const rowTop = (1 - (row + 0.5) / rows.length) * 100;
        const colCount = rows[row];
        const colLeft = ((col + 0.5) / colCount) * 100;
        const isButton = !!onTap;
        const content = (
          <>
            <div className="w-12 h-12 rounded-full bg-white text-emerald-900 font-bold text-sm flex items-center justify-center shadow">
              {positionMap[slot.positionId]?.abbreviation ?? "?"}
            </div>
            <div className="text-xs text-white font-medium mt-1 max-w-[96px] truncate px-1 bg-black/40 rounded">
              {playerMap[slot.playerId] ?? "?"}
            </div>
          </>
        );
        return (
          <div
            key={slot.positionId}
            className="absolute -translate-x-1/2 -translate-y-1/2 text-center"
            style={{ top: `${rowTop}%`, left: `${colLeft}%` }}
          >
            {isButton ? (
              <button
                type="button"
                onClick={() => onTap!(slot.positionId)}
                className="flex flex-col items-center focus:outline-none focus:ring-2 focus:ring-white rounded"
                aria-label={`Byt spelare på ${positionMap[slot.positionId]?.abbreviation ?? "?"}`}
              >
                {content}
              </button>
            ) : (
              <div className="flex flex-col items-center">{content}</div>
            )}
          </div>
        );
      })}
    </div>
  );
}

function splitIntoRows(count: number): number[] {
  switch (count) {
    case 3:
      return [0, 3, 0];
    case 5:
      return [1, 2, 2];
    case 7:
      return [1, 2, 3, 1];
    case 9:
      return [1, 3, 3, 2];
    case 11:
      return [1, 4, 3, 3];
    default: {
      if (count <= 0) return [];
      const rows = Math.max(2, Math.min(4, Math.ceil(count / 3)));
      const perRow = Math.ceil(count / rows);
      const arr: number[] = [];
      let remaining = count;
      for (let i = 0; i < rows; i++) {
        const take = Math.min(perRow, remaining);
        arr.push(take);
        remaining -= take;
      }
      return arr;
    }
  }
}

function FinishedView({ matchId }: { matchId: number }) {
  return (
    <div className="max-w-lg mx-auto text-center py-10">
      <h1 className="text-3xl font-bold mb-2">Matchen är klar 🎉</h1>
      <p className="text-neutral-600 mb-6">
        Tryck nedan för att avsluta och se speltid per spelare.
      </p>
      <form action={finishMatch}>
        <input type="hidden" name="matchId" value={matchId} />
        <Button size="xl" type="submit" className="w-full">
          Avsluta match och se summering
        </Button>
      </form>
    </div>
  );
}
