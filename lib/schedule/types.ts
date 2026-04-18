export type SchedulePlayer = {
  id: number;
  name: string;
  playablePositionIds: number[];
  preferredPositionIds: number[];
  /**
   * Optional: average "fair score" from prior finished matches this season.
   * 100 = on target. <100 = underplayed, >100 = overplayed. Used to nudge
   * the generator toward giving underplayed kids slightly more time.
   */
  seasonFairScore?: number;
};

export type SchedulePosition = {
  id: number;
  name: string;
  abbreviation: string;
  isGoalkeeper?: boolean;
};

export type ScheduleInput = {
  formation: {
    numPeriods: number;
    minutesPerPeriod: number;
    minSubs: number;
    maxSubs: number;
    positions: SchedulePosition[];
  };
  players: SchedulePlayer[];
  seed?: number;
  /**
   * Optional: if provided, period 0's start lineup is fixed to these
   * assignments instead of being picked by the algorithm. The rest of the
   * match (period 0 subs, periods 1..N) is generated freely around it.
   */
  fixedStartLineup?: { positionId: number; playerId: number }[];
};

export type ScheduleChange = {
  positionId: number;
  outPlayerId: number;
  inPlayerId: number;
};

export type SubPoint = {
  minuteInPeriod: number;
  changes: ScheduleChange[];
};

export type PeriodPlan = {
  index: number;
  startLineup: { positionId: number; playerId: number }[];
  subPoints: SubPoint[];
};

export type ScoreBreakdown = {
  minutesFairness: number;
  preferencesMet: number;
  positionVariety: number;
  chainSubPenalty: number;
};

export type Schedule = {
  periods: PeriodPlan[];
  score: number;
  scoreBreakdown: ScoreBreakdown;
  perPlayerMinutes: Record<number, number>;
};
