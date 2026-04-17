export type SchedulePlayer = {
  id: number;
  name: string;
  playablePositionIds: number[];
  preferredPositionIds: number[];
};

export type SchedulePosition = {
  id: number;
  name: string;
  abbreviation: string;
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
