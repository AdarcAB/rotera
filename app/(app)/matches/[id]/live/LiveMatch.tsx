"use client";

import { useCallback, useEffect, useMemo, useRef, useState, useTransition } from "react";
import type { Schedule } from "@/lib/schedule/types";
import { Button } from "@/components/ui/Button";
import { SubmitButton } from "@/components/SubmitButton";
import { formatTime } from "@/lib/utils";
import { persistLiveState, finishMatch } from "./actions";
import { stopLiveMatch } from "../../actions";
import type { AdHocSub, LiveState, PlayerMeta } from "./page";

const PRE_SUB_WARN_SECONDS = 10;

let sharedAudioCtx: AudioContext | null = null;

function getAudioCtx(): AudioContext | null {
  if (typeof window === "undefined") return null;
  if (sharedAudioCtx) return sharedAudioCtx;
  try {
    const AC = (window.AudioContext ||
      (window as unknown as { webkitAudioContext: typeof AudioContext })
        .webkitAudioContext) as typeof AudioContext;
    sharedAudioCtx = new AC();
    return sharedAudioCtx;
  } catch {
    return null;
  }
}

function playBeep(frequency = 880, durationMs = 200, volume = 0.35) {
  const ctx = getAudioCtx();
  if (!ctx) return;
  try {
    if (ctx.state === "suspended") ctx.resume().catch(() => {});
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = "sine";
    osc.frequency.value = frequency;
    const now = ctx.currentTime;
    const attack = 0.008;
    const release = Math.min(0.08, durationMs / 1000 / 2);
    gain.gain.setValueAtTime(0, now);
    gain.gain.linearRampToValueAtTime(volume, now + attack);
    gain.gain.setValueAtTime(volume, now + durationMs / 1000 - release);
    gain.gain.exponentialRampToValueAtTime(
      0.0001,
      now + durationMs / 1000
    );
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(now);
    osc.stop(now + durationMs / 1000 + 0.02);
  } catch {
    // silent fail
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

function computeMinutesPlayed(
  schedule: Schedule,
  live: LiveState,
  minutesPerPeriod: number,
  elapsedSecInCurrent: number
): Record<number, number> {
  const result: Record<number, number> = {};
  const curIdx = live.currentPeriodIndex;

  for (let pi = 0; pi <= curIdx; pi++) {
    const period = schedule.periods[pi];
    if (!period) continue;

    const isCurrent = pi === curIdx;
    const isPre = isCurrent && live.status === "pre_period";
    const periodEndMin = isCurrent
      ? isPre
        ? 0
        : Math.min(minutesPerPeriod, elapsedSecInCurrent / 60)
      : minutesPerPeriod;
    if (periodEndMin <= 0) continue;

    type Ev = {
      minute: number;
      positionId: number;
      outPlayerId: number;
      inPlayerId: number;
    };
    const events: Ev[] = [];

    const completedInPeriod = (live.completedSubPoints ?? []).filter(
      (c) => c.periodIndex === pi
    );
    const sortedSubs = [...period.subPoints].sort(
      (a, b) => a.minuteInPeriod - b.minuteInPeriod
    );
    for (let i = 0; i < sortedSubs.length; i++) {
      const sp = sortedSubs[i];
      const completion = completedInPeriod.find((c) => c.subPointIndex === i);
      if (!completion) continue;
      const applied = completion.appliedPositionIds;
      for (const c of sp.changes) {
        if (applied !== undefined && !applied.includes(c.positionId)) continue;
        events.push({
          minute: sp.minuteInPeriod,
          positionId: c.positionId,
          outPlayerId: c.outPlayerId,
          inPlayerId: c.inPlayerId,
        });
      }
    }
    for (const sub of live.adHocSubs ?? []) {
      if (sub.periodIndex !== pi) continue;
      events.push({
        minute: sub.minuteInPeriod,
        positionId: sub.positionId,
        outPlayerId: sub.outPlayerId,
        inPlayerId: sub.inPlayerId,
      });
    }
    events.sort((a, b) => a.minute - b.minute);

    const onFieldSince = new Map<number, number>();
    for (const slot of period.startLineup) onFieldSince.set(slot.playerId, 0);

    for (const ev of events) {
      if (ev.minute > periodEndMin) break;
      const outStart = onFieldSince.get(ev.outPlayerId);
      if (outStart !== undefined) {
        result[ev.outPlayerId] =
          (result[ev.outPlayerId] ?? 0) + (ev.minute - outStart);
        onFieldSince.delete(ev.outPlayerId);
      }
      onFieldSince.set(ev.inPlayerId, ev.minute);
    }

    for (const [pid, since] of onFieldSince.entries()) {
      result[pid] = (result[pid] ?? 0) + Math.max(0, periodEndMin - since);
    }
  }

  return result;
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

  const sortedSubs = [...period.subPoints].sort(
    (a, b) => a.minuteInPeriod - b.minuteInPeriod
  );
  const completedInPeriod = (live.completedSubPoints ?? []).filter(
    (c) => c.periodIndex === live.currentPeriodIndex
  );
  for (let i = 0; i < sortedSubs.length; i++) {
    const completion = completedInPeriod.find((c) => c.subPointIndex === i);
    if (!completion) continue;
    for (const c of sortedSubs[i].changes) {
      if (
        completion.appliedPositionIds !== undefined &&
        !completion.appliedPositionIds.includes(c.positionId)
      ) {
        continue;
      }
      lineup.set(c.positionId, c.inPlayerId);
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
  playerMeta,
  initialLiveState,
}: {
  matchId: number;
  schedule: Schedule;
  minutesPerPeriod: number;
  numPeriods: number;
  positionMap: Record<number, { name: string; abbreviation: string }>;
  playerMap: Record<number, string>;
  playerMeta: Record<number, PlayerMeta>;
  initialLiveState: LiveState | null;
}) {
  const [live, setLive] = useState<LiveState>(initialLiveState ?? defaultLiveState());
  const [now, setNow] = useState<number>(() => Date.now());
  const beepedRef = useRef<Set<string>>(new Set());
  const countdownBeepedRef = useRef<Set<string>>(new Set());
  const [, startSave] = useTransition();
  const [adHocOpenFor, setAdHocOpenFor] = useState<number | null>(null);
  const [forceOpenSub, setForceOpenSub] = useState(false);
  const [dismissedSubKey, setDismissedSubKey] = useState<string | null>(null);

  useEffect(() => {
    if (live.status !== "running") return;
    const id = window.setInterval(() => setNow(Date.now()), 250);
    return () => window.clearInterval(id);
  }, [live.status]);

  // Wake Lock — keep the screen on during a running period (iOS 16.4+, most
  // modern Android browsers). Silently no-op elsewhere. Re-acquire if the
  // sentinel is released (e.g. after the page was backgrounded).
  useEffect(() => {
    if (live.status !== "running") return;
    type Sentinel = { released: boolean; release: () => Promise<void> };
    let sentinel: Sentinel | null = null;
    let cancelled = false;

    const acquire = async () => {
      try {
        const nav = navigator as unknown as {
          wakeLock?: { request: (type: "screen") => Promise<Sentinel> };
        };
        if (!nav.wakeLock) return;
        const s = await nav.wakeLock.request("screen");
        if (cancelled) {
          s.release().catch(() => {});
          return;
        }
        sentinel = s;
      } catch {
        // permission denied / not supported
      }
    };

    acquire();
    const onVisibility = () => {
      if (document.visibilityState === "visible" && !sentinel) acquire();
    };
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      cancelled = true;
      document.removeEventListener("visibilitychange", onVisibility);
      if (sentinel) sentinel.release().catch(() => {});
      sentinel = null;
    };
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

  const remainingSec = Math.max(0, Math.ceil((periodMs - elapsedMs) / 1000));
  const elapsedSec = Math.floor(elapsedMs / 1000);
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

  type EffectiveChange = {
    positionId: number;
    outPlayerId: number;
    inPlayerId: number;
    rewired: boolean;
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

  const effectiveNextChanges = useMemo<EffectiveChange[]>(() => {
    if (!nextSub) return [];
    const onField = new Set(currentLineup.values());
    const out: EffectiveChange[] = [];
    for (const c of nextSub.subPoint.changes) {
      if (onField.has(c.inPlayerId)) continue;
      const actualOut = currentLineup.get(c.positionId) ?? c.outPlayerId;
      if (actualOut === c.inPlayerId) continue;
      out.push({
        positionId: c.positionId,
        outPlayerId: actualOut,
        inPlayerId: c.inPlayerId,
        rewired: actualOut !== c.outPlayerId,
      });
    }
    return out;
  }, [nextSub, currentLineup]);

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
      if (effectiveNextChanges.length === 0) {
        // Scheduled sub has nothing to do (all changes redundant after ad hoc
        // subs). Auto-complete so we move on.
        const key = {
          periodIndex: live.currentPeriodIndex,
          subPointIndex: nextSub.index,
          appliedPositionIds: [] as number[],
        };
        if (
          !live.completedSubPoints.some(
            (c) =>
              c.periodIndex === key.periodIndex &&
              c.subPointIndex === key.subPointIndex
          )
        ) {
          const nextState: LiveState = {
            ...live,
            completedSubPoints: [...live.completedSubPoints, key],
          };
          setLive(nextState);
          saveLive(nextState);
        }
        return;
      }
      const beepKey = nextSub.key;
      if (!beepedRef.current.has(beepKey)) {
        beepedRef.current.add(beepKey);
        playBeep(880, 220, 0.4);
        setTimeout(() => playBeep(660, 220, 0.4), 260);
      }
    }
  }, [
    live,
    nextSub,
    secondsUntilNextSub,
    effectiveNextChanges.length,
    saveLive,
  ]);

  // Pre-sub countdown beeps: one soft beep at 10s warning, short high-pitch
  // beep each second for 3, 2, 1.
  useEffect(() => {
    if (
      live.status !== "running" ||
      !nextSub ||
      secondsUntilNextSub === null ||
      effectiveNextChanges.length === 0
    ) {
      return;
    }
    const key = nextSub.key;
    const s = secondsUntilNextSub;
    if (s === 10 && !countdownBeepedRef.current.has(`${key}:warn`)) {
      countdownBeepedRef.current.add(`${key}:warn`);
      playBeep(520, 120, 0.3);
    }
    for (const mark of [3, 2, 1]) {
      if (s === mark && !countdownBeepedRef.current.has(`${key}:cnt${mark}`)) {
        countdownBeepedRef.current.add(`${key}:cnt${mark}`);
        playBeep(1040, 90, 0.35);
      }
    }
  }, [live.status, nextSub, secondsUntilNextSub, effectiveNextChanges.length]);

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

  const handleCompleteSub = (appliedPositionIds: number[]) => {
    if (!nextSub) return;
    const key = {
      periodIndex: live.currentPeriodIndex,
      subPointIndex: nextSub.index,
      appliedPositionIds,
    };
    const next: LiveState = {
      ...live,
      completedSubPoints: [...live.completedSubPoints, key],
    };
    setLive(next);
    saveLive(next);
    setForceOpenSub(false);
    setDismissedSubKey(null);
  };

  const handleCancelSub = () => {
    if (!nextSub) return;
    setForceOpenSub(false);
    setDismissedSubKey(nextSub.key);
  };

  const allPlayerIds = Object.keys(playerMap).map((k) => Number(k));
  const onFieldIds = new Set(currentLineup.values());
  const benchIds = allPlayerIds.filter((id) => !onFieldIds.has(id));

  const minutesByPlayer = useMemo(
    () => computeMinutesPlayed(schedule, live, minutesPerPeriod, elapsedSec),
    [schedule, live, minutesPerPeriod, elapsedSec]
  );

  const showSubModal =
    live.status === "running" &&
    nextSub !== null &&
    effectiveNextChanges.length > 0 &&
    (forceOpenSub ||
      (secondsUntilNextSub !== null &&
        secondsUntilNextSub <= 0 &&
        dismissedSubKey !== nextSub.key));

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
          minutesByPlayer={minutesByPlayer}
          minutesPerPeriod={minutesPerPeriod}
          canForceNextSub={effectiveNextChanges.length > 0 && !forceOpenSub}
          onPause={handlePause}
          onResume={handleResume}
          onJumpToBreak={handleJumpToBreak}
          onTapFieldPlayer={(posId) => setAdHocOpenFor(posId)}
          onDoSubNow={() => setForceOpenSub(true)}
        />
      )}

      <div className="mt-6 flex justify-center">
        <form
          action={stopLiveMatch}
          onSubmit={(e) => {
            if (
              !confirm(
                "Avbryt matchen? Liveläget avslutas och matchen går tillbaka till 'schemalagt' läge. Inga minuter sparas på spelarna."
              )
            ) {
              e.preventDefault();
            }
          }}
        >
          <input type="hidden" name="matchId" value={matchId} />
          <button
            type="submit"
            className="inline-flex items-center gap-2 h-11 px-4 rounded-md border border-border bg-white text-sm text-red-700 hover:bg-red-50 focus:outline-none focus:ring-2 focus:ring-red-300"
          >
            <StopIcon className="w-4 h-4" />
            Avbryt matchen
          </button>
        </form>
      </div>

      {showSubModal && nextSub ? (
        <SubModal
          changes={effectiveNextChanges}
          positionMap={positionMap}
          playerMap={playerMap}
          onComplete={handleCompleteSub}
          onCancel={handleCancelSub}
        />
      ) : null}

      {adHocOpenFor !== null ? (
        <AdHocBenchModal
          positionId={adHocOpenFor}
          outPlayerId={currentLineup.get(adHocOpenFor) ?? 0}
          positionMap={positionMap}
          playerMap={playerMap}
          playerMeta={playerMeta}
          benchIds={benchIds}
          schedule={schedule}
          plannedInForOutPlayerIds={
            nextSub
              ? nextSub.subPoint.changes
                  .filter(
                    (c) =>
                      c.outPlayerId === (currentLineup.get(adHocOpenFor) ?? -1)
                  )
                  .map((c) => c.inPlayerId)
                  .filter((id) => !onFieldIds.has(id))
              : []
          }
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
      <h1 className="text-2xl md:text-3xl font-bold tracking-tight mb-3">
        Period {periodIndex + 1} av {numPeriods}
      </h1>

      <Button size="xl" className="w-full bg-primary mb-2" onClick={onStart}>
        <PlayIcon className="w-6 h-6 mr-2" />
        Starta period {periodIndex + 1}
      </Button>
      <p className="text-sm text-neutral-700 mb-5 text-center">
        Tryck när domaren blåser igång.
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
          <ul className="space-y-2">
            {sortedSubs.map((sp, i) => (
              <li key={i} className="text-sm">
                <div className="flex items-baseline gap-2">
                  <span className="font-mono text-xs bg-neutral-100 px-1.5 py-0.5 rounded">
                    {sp.minuteInPeriod}&apos;
                  </span>
                  {sp.changes.length === 0 ? (
                    <span className="text-neutral-500">(inget byte)</span>
                  ) : (
                    <span className="text-neutral-700">
                      {sp.changes
                        .map(
                          (c) =>
                            `${
                              positionMap[c.positionId]?.abbreviation ?? "?"
                            }: ${playerMap[c.outPlayerId] ?? "?"} → ${
                              playerMap[c.inPlayerId] ?? "?"
                            }`
                        )
                        .join(" · ")}
                    </span>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
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
  minutesByPlayer,
  minutesPerPeriod,
  canForceNextSub,
  onPause,
  onResume,
  onJumpToBreak,
  onTapFieldPlayer,
  onDoSubNow,
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
  minutesByPlayer: Record<number, number>;
  minutesPerPeriod: number;
  canForceNextSub: boolean;
  onPause: () => void;
  onResume: () => void;
  onJumpToBreak: () => void;
  onTapFieldPlayer: (positionId: number) => void;
  onDoSubNow: () => void;
}) {
  const periodTotalSec = minutesPerPeriod * 60;
  const periodProgressPct = periodTotalSec
    ? Math.min(100, (elapsedSec / periodTotalSec) * 100)
    : 0;

  return (
    <div>
      {showPreSubWarning ? (
        <div className="mb-3 rounded-md bg-red-600 text-white px-4 py-2 font-semibold text-center animate-pulse">
          Byte om {secondsUntilNextSub}s
        </div>
      ) : null}

      <div className="sticky top-[136px] md:top-[96px] z-10 rounded-lg border border-border bg-white py-2 px-3 mb-3 text-center shadow-sm relative">
        <button
          type="button"
          onClick={live.status === "running" ? onPause : onResume}
          aria-label={live.status === "running" ? "Pausa" : "Återuppta"}
          className={`absolute top-2 right-2 w-10 h-10 rounded-full flex items-center justify-center shadow focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-emerald-500 ${
            live.status === "running"
              ? "bg-neutral-100 text-neutral-800 hover:bg-neutral-200"
              : "bg-primary text-primary-foreground hover:opacity-90"
          }`}
        >
          {live.status === "running" ? (
            <PauseIcon className="w-5 h-5" />
          ) : (
            <PlayIcon className="w-5 h-5" />
          )}
        </button>
        <div className="text-4xl md:text-5xl font-mono font-bold tracking-tight leading-none">
          {formatTime(remainingSec)}
        </div>
        <div className="text-xs md:text-sm text-neutral-800 mt-1 font-medium">
          {live.status === "paused" ? (
            <span className="text-amber-700 font-semibold">⏸ Pausad</span>
          ) : nextSubMinute !== null && secondsUntilNextSub !== null ? (
            `Nästa byte: ${nextSubMinute}′ (om ${Math.max(
              0,
              secondsUntilNextSub
            )}s)`
          ) : (
            "Inga fler byten denna period"
          )}
          {" · "}
          <span className="text-neutral-600 font-normal">
            Spelat: {formatTime(elapsedSec)}
          </span>
        </div>
        <div
          className="mt-2 h-1.5 w-full rounded-full bg-neutral-100 overflow-hidden"
          role="progressbar"
          aria-valuenow={Math.round(periodProgressPct)}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-label="Periodens progress"
        >
          <div
            className="h-full bg-primary transition-[width] duration-500"
            style={{ width: `${periodProgressPct}%` }}
          />
        </div>
      </div>

      <div className="rounded-lg border border-border bg-white p-4 mb-3">
        <div className="flex items-center justify-between mb-2 gap-2 flex-wrap">
          <div className="font-semibold">På plan</div>
          <div className="text-sm text-neutral-700">
            Tryck på en spelare för ad hoc-byte
          </div>
        </div>
        <Pitch
          lineup={Array.from(currentLineup.entries()).map(([positionId, playerId]) => ({
            positionId,
            playerId,
          }))}
          positionMap={positionMap}
          playerMap={playerMap}
          minutesByPlayer={minutesByPlayer}
          onTap={onTapFieldPlayer}
        />
      </div>

      <UpcomingSubsPreview
        live={live}
        schedule={schedule}
        positionMap={positionMap}
        playerMap={playerMap}
        currentLineup={currentLineup}
        canForceNext={canForceNextSub}
        onDoSubNow={onDoSubNow}
      />

      <div className="rounded-lg border border-border bg-white p-3 mb-4">
        <div className="font-semibold mb-2">Bänk</div>
        <div className="flex flex-wrap gap-2">
          {benchIds.length === 0 ? (
            <span className="text-sm text-neutral-600">Tom</span>
          ) : (
            benchIds.map((id) => (
              <span
                key={id}
                className="px-2.5 py-1.5 rounded-md border border-border text-base bg-neutral-50"
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
            <PauseIcon className="w-5 h-5 mr-2" />
            Pausa
          </Button>
        ) : (
          <Button size="lg" onClick={onResume}>
            <PlayIcon className="w-5 h-5 mr-2" />
            Återuppta
          </Button>
        )}
        <Button variant="secondary" size="lg" onClick={onJumpToBreak}>
          <SkipEndIcon className="w-5 h-5 mr-2" />
          Hoppa till paus
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
  currentLineup,
  canForceNext,
  onDoSubNow,
}: {
  live: LiveState;
  schedule: Schedule;
  positionMap: Record<number, { name: string; abbreviation: string }>;
  playerMap: Record<number, string>;
  currentLineup: LineupState;
  canForceNext: boolean;
  onDoSubNow: () => void;
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
  const onFieldNow = new Set(currentLineup.values());
  const effectiveNext = next.sp.changes
    .filter((c) => !onFieldNow.has(c.inPlayerId))
    .map((c) => {
      const actualOut = currentLineup.get(c.positionId) ?? c.outPlayerId;
      return {
        ...c,
        outPlayerId: actualOut,
        rewired: actualOut !== c.outPlayerId,
        skippedIdentity: actualOut === c.inPlayerId,
      };
    })
    .filter((c) => !c.skippedIdentity);
  const skippedCount = next.sp.changes.length - effectiveNext.length;

  return (
    <div className="rounded-lg border border-border bg-white p-3 mb-3">
      <div className="flex items-center justify-between gap-2 mb-1">
        <div className="text-sm text-neutral-700 uppercase tracking-wide font-medium">
          Nästa byte
        </div>
        {canForceNext ? (
          <button
            type="button"
            onClick={onDoSubNow}
            className="inline-flex items-center h-9 px-3 rounded-md bg-emerald-600 text-white text-sm font-medium hover:bg-emerald-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 focus-visible:ring-offset-2"
            title="Öppna byte-modalen nu — t.ex. om bollen är avblåst eller målvakten har bollen"
          >
            Gör nu
          </button>
        ) : null}
      </div>
      <div className="mb-1 font-semibold text-base">
        {next.sp.minuteInPeriod}&apos;
        {effectiveNext.length > 1
          ? ` · ${effectiveNext.length} spelarbyten`
          : ""}
      </div>
      <ul className="space-y-0.5 text-sm mb-2">
        {effectiveNext.length === 0 ? (
          <li className="text-neutral-500">
            (inget att byta — tidigare ad hoc-byte har ersatt detta)
          </li>
        ) : (
          effectiveNext.map((c, i) => (
            <li key={i}>
              <span className="inline-block font-semibold bg-neutral-100 px-1.5 py-0.5 rounded mr-2">
                {positionMap[c.positionId]?.abbreviation ?? "?"}
              </span>
              <span className="text-red-700">UT:</span>{" "}
              {playerMap[c.outPlayerId] ?? "?"}{" "}
              <span className="text-neutral-400">→</span>{" "}
              <span className="text-emerald-700">IN:</span>{" "}
              {playerMap[c.inPlayerId] ?? "?"}
              {c.rewired ? (
                <span className="ml-2 text-[10px] uppercase tracking-wide text-amber-700">
                  justerat
                </span>
              ) : null}
            </li>
          ))
        )}
        {skippedCount > 0 ? (
          <li className="text-xs text-neutral-500">
            ({skippedCount} planerad{skippedCount > 1 ? "e" : ""} byte hoppas över — spelare redan på plan)
          </li>
        ) : null}
      </ul>

      {later.length > 0 ? (
        <div>
          <button
            type="button"
            onClick={() => setExpanded((v) => !v)}
            className="text-sm text-neutral-700 hover:underline focus:outline-none focus:underline"
          >
            {expanded
              ? "▾ Dölj senare byten"
              : `▸ Visa ${later.length} senare byten`}
          </button>
          {expanded ? (
            <ul className="mt-2 space-y-1 text-sm text-neutral-700">
              {later.map(({ sp, i }) => (
                <li key={i}>
                  <span className="font-mono bg-neutral-50 px-1.5 py-0.5 rounded">
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
  onCancel,
}: {
  changes: {
    positionId: number;
    outPlayerId: number;
    inPlayerId: number;
    rewired?: boolean;
  }[];
  positionMap: Record<number, { name: string; abbreviation: string }>;
  playerMap: Record<number, string>;
  onComplete: (appliedPositionIds: number[]) => void;
  onCancel: () => void;
}) {
  const anyRewired = changes.some((c) => c.rewired);
  const [checkedPositionIds, setCheckedPositionIds] = useState<Set<number>>(
    () => new Set(changes.map((c) => c.positionId))
  );

  const toggle = (posId: number) => {
    setCheckedPositionIds((prev) => {
      const next = new Set(prev);
      if (next.has(posId)) next.delete(posId);
      else next.add(posId);
      return next;
    });
  };

  const applyLabel =
    checkedPositionIds.size === changes.length
      ? "✅ Byte genomfört"
      : checkedPositionIds.size === 0
        ? "Hoppa över alla"
        : `✅ Genomför ${checkedPositionIds.size} av ${changes.length}`;

  return (
    <div className="fixed inset-0 z-50 bg-black/95 flex flex-col text-white p-6 overflow-auto">
      <div className="flex justify-end max-w-2xl mx-auto w-full">
        <button
          type="button"
          onClick={onCancel}
          className="text-sm text-white/70 hover:text-white underline underline-offset-2 py-2 px-1 focus:outline-none focus-visible:text-white"
        >
          Avbryt — gör bytet senare
        </button>
      </div>
      <div className="flex-1 flex flex-col justify-center max-w-2xl mx-auto w-full">
        <div className="text-center mb-6">
          <div className="text-3xl font-bold">BYTE!</div>
          {anyRewired ? (
            <div className="text-xs text-amber-300 mt-1">
              Justerat efter tidigare ad hoc-byte
            </div>
          ) : null}
        </div>

        <div className="space-y-4 mb-8">
          {changes.map((c) => {
            const checked = checkedPositionIds.has(c.positionId);
            return (
              <label
                key={c.positionId}
                className={`block rounded-lg border p-4 cursor-pointer transition ${
                  checked
                    ? "bg-neutral-900 border-neutral-700"
                    : "bg-neutral-950 border-neutral-800 opacity-60"
                }`}
              >
                <div className="flex items-center justify-center text-2xl md:text-3xl font-bold text-amber-300 mb-2 text-center">
                  {positionMap[c.positionId]?.abbreviation ?? "?"}{" "}
                  <span className="text-neutral-400 font-normal text-lg ml-2">
                    {positionMap[c.positionId]?.name}
                  </span>
                  {c.rewired ? (
                    <span className="ml-2 text-xs align-middle text-amber-400 font-normal">
                      · justerat
                    </span>
                  ) : null}
                </div>
                <div className="flex items-center gap-4">
                  <div className="flex-1 flex items-center justify-between text-xl md:text-2xl font-semibold">
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
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={() => toggle(c.positionId)}
                    onClick={(e) => e.stopPropagation()}
                    className="w-8 h-8 shrink-0 accent-emerald-500"
                    aria-label={`Genomför byte på ${positionMap[c.positionId]?.abbreviation}`}
                  />
                </div>
              </label>
            );
          })}
        </div>
      </div>

      <button
        onClick={() => onComplete(Array.from(checkedPositionIds))}
        className="sticky bottom-0 h-20 w-full bg-primary text-primary-foreground text-2xl font-semibold rounded-lg"
      >
        {applyLabel}
      </button>
    </div>
  );
}

function AdHocBenchModal({
  positionId,
  outPlayerId,
  positionMap,
  playerMap,
  playerMeta,
  benchIds,
  schedule,
  plannedInForOutPlayerIds,
  onClose,
  onPick,
}: {
  positionId: number;
  outPlayerId: number;
  positionMap: Record<number, { name: string; abbreviation: string }>;
  playerMap: Record<number, string>;
  playerMeta: Record<number, PlayerMeta>;
  benchIds: number[];
  schedule: Schedule;
  plannedInForOutPlayerIds: number[];
  onClose: () => void;
  onPick: (inPlayerId: number) => void;
}) {
  const canPlay = (pid: number): boolean =>
    playerMeta[pid]?.playablePositionIds.includes(positionId) ?? false;
  const prefers = (pid: number): boolean =>
    playerMeta[pid]?.preferredPositionIds.includes(positionId) ?? false;
  const scheduledMins = (pid: number): number =>
    schedule.perPlayerMinutes?.[pid] ?? 0;
  const plannedSet = new Set(plannedInForOutPlayerIds);
  // Only count "planned" if the player is also spelbar on this position —
  // otherwise it's a false match (planned for a different position).
  const isPlannedForOut = (pid: number): boolean =>
    plannedSet.has(pid) && canPlay(pid);

  const sorted = benchIds.slice().sort((a, b) => {
    // 1. Planned replacement for the same out-player → top
    const na = isPlannedForOut(a) ? 1 : 0;
    const nb = isPlannedForOut(b) ? 1 : 0;
    if (na !== nb) return nb - na;
    // 2. Prefers position → next
    const pa = prefers(a) ? 1 : 0;
    const pb = prefers(b) ? 1 : 0;
    if (pa !== pb) return pb - pa;
    // 3. Playable → before unplayable
    const ca = canPlay(a) ? 1 : 0;
    const cb = canPlay(b) ? 1 : 0;
    if (ca !== cb) return cb - ca;
    // 4. Least scheduled minutes → first
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
                const isPreferred = prefers(id);
                const isPlayable = canPlay(id);
                const isPlanned = isPlannedForOut(id);
                const mins = scheduledMins(id);
                const labels: React.ReactNode[] = [];
                if (isPlanned) {
                  labels.push(
                    <span
                      key="planned"
                      className="text-xs text-sky-700 ml-1 font-medium"
                    >
                      · planerad ersättare
                    </span>
                  );
                }
                if (isPreferred) {
                  labels.push(
                    <span key="pref" className="text-xs text-emerald-700 ml-1">
                      · önskar denna
                    </span>
                  );
                } else if (isPlayable) {
                  if (!isPlanned) {
                    labels.push(
                      <span
                        key="play"
                        className="text-xs text-neutral-600 ml-1"
                      >
                        · spelbar
                      </span>
                    );
                  }
                } else {
                  labels.push(
                    <span
                      key="nop"
                      className="text-xs text-amber-700 ml-1"
                    >
                      · ej markerad som spelbar
                    </span>
                  );
                }
                return (
                  <li key={id}>
                    <button
                      type="button"
                      onClick={() => onPick(id)}
                      className="w-full flex items-center justify-between px-3 py-3 rounded-md hover:bg-neutral-50 text-left"
                    >
                      <div>
                        <div className="font-medium">
                          {playerMap[id] ?? "?"} {labels}
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
  minutesByPlayer,
  onTap,
}: {
  lineup: { positionId: number; playerId: number }[];
  positionMap: Record<number, { name: string; abbreviation: string }>;
  playerMap: Record<number, string>;
  minutesByPlayer?: Record<number, number>;
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
        const mins =
          minutesByPlayer !== undefined
            ? Math.floor(minutesByPlayer[slot.playerId] ?? 0)
            : null;
        const content = (
          <>
            <div className="w-12 h-12 rounded-full bg-white text-emerald-900 font-bold text-sm flex items-center justify-center shadow">
              {positionMap[slot.positionId]?.abbreviation ?? "?"}
            </div>
            <div className="text-sm text-white font-semibold mt-1 max-w-[112px] px-1.5 py-0.5 bg-black/50 rounded flex items-center gap-1 min-w-0">
              <span className="truncate">
                {shortPlayerName(playerMap[slot.playerId] ?? "?")}
              </span>
              {mins !== null ? (
                <span className="shrink-0 text-xs font-mono text-white/80">
                  {mins}′
                </span>
              ) : null}
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

function shortPlayerName(full: string): string {
  const parts = full.trim().split(/\s+/);
  if (parts.length === 1) return parts[0];
  // Keep first name + first letter of surname; preserves already-compact
  // names like "Finn W" untouched.
  return `${parts[0]} ${parts[1][0]}`;
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

function PauseIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="currentColor"
      className={className}
      aria-hidden="true"
    >
      <rect x="6" y="5" width="4" height="14" rx="1" />
      <rect x="14" y="5" width="4" height="14" rx="1" />
    </svg>
  );
}

function PlayIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="currentColor"
      className={className}
      aria-hidden="true"
    >
      <path d="M8 5.5v13a.75.75 0 0 0 1.16.63l10-6.5a.75.75 0 0 0 0-1.26l-10-6.5A.75.75 0 0 0 8 5.5Z" />
    </svg>
  );
}

function SkipEndIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="currentColor"
      className={className}
      aria-hidden="true"
    >
      <path d="M5 5.5v13a.75.75 0 0 0 1.16.63l8-5.2V18.5a.75.75 0 0 0 1.5 0v-13a.75.75 0 0 0-1.5 0v4.57l-8-5.2A.75.75 0 0 0 5 5.5Z" />
      <rect x="17.5" y="5" width="2" height="14" rx="0.8" />
    </svg>
  );
}

function StopIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="currentColor"
      className={className}
      aria-hidden="true"
    >
      <rect x="6" y="6" width="12" height="12" rx="1.5" />
    </svg>
  );
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
        <SubmitButton size="xl" className="w-full" pendingLabel="Avslutar…">
          Avsluta match och se summering
        </SubmitButton>
      </form>
    </div>
  );
}
