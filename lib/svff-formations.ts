export type SvffFormationSeed = {
  name: string;
  numPeriods: number;
  minutesPerPeriod: number;
  minSubsPerPeriod: number;
  maxSubsPerPeriod: number;
  playersOnField: number;
  positions: { name: string; abbreviation: string; isGoalkeeper?: boolean }[];
};

export const SVFF_FORMATIONS: SvffFormationSeed[] = [
  {
    name: "3 mot 3",
    numPeriods: 4,
    minutesPerPeriod: 3,
    minSubsPerPeriod: 0,
    maxSubsPerPeriod: 0,
    playersOnField: 3,
    positions: [
      { name: "Spelare 1", abbreviation: "S1" },
      { name: "Spelare 2", abbreviation: "S2" },
      { name: "Spelare 3", abbreviation: "S3" },
    ],
  },
  {
    name: "5 mot 5",
    numPeriods: 3,
    minutesPerPeriod: 15,
    minSubsPerPeriod: 0,
    maxSubsPerPeriod: 2,
    playersOnField: 5,
    positions: [
      { name: "Målvakt", abbreviation: "MV", isGoalkeeper: true },
      { name: "Vänsterback", abbreviation: "VB" },
      { name: "Högerback", abbreviation: "HB" },
      { name: "Vänsterforward", abbreviation: "VF" },
      { name: "Högerforward", abbreviation: "HF" },
    ],
  },
  {
    name: "7 mot 7",
    numPeriods: 3,
    minutesPerPeriod: 20,
    minSubsPerPeriod: 1,
    maxSubsPerPeriod: 3,
    playersOnField: 7,
    positions: [
      { name: "Målvakt", abbreviation: "MV", isGoalkeeper: true },
      { name: "Vänsterback", abbreviation: "VB" },
      { name: "Högerback", abbreviation: "HB" },
      { name: "Vänster mittfältare", abbreviation: "VM" },
      { name: "Central mittfältare", abbreviation: "CM" },
      { name: "Höger mittfältare", abbreviation: "HM" },
      { name: "Forward", abbreviation: "FW" },
    ],
  },
  {
    name: "9 mot 9",
    numPeriods: 3,
    minutesPerPeriod: 25,
    minSubsPerPeriod: 1,
    maxSubsPerPeriod: 4,
    playersOnField: 9,
    positions: [
      { name: "Målvakt", abbreviation: "MV", isGoalkeeper: true },
      { name: "Vänsterback", abbreviation: "VB" },
      { name: "Mittback", abbreviation: "MB" },
      { name: "Högerback", abbreviation: "HB" },
      { name: "Vänster mittfältare", abbreviation: "VM" },
      { name: "Central mittfältare", abbreviation: "CM" },
      { name: "Höger mittfältare", abbreviation: "HM" },
      { name: "Vänsterforward", abbreviation: "VF" },
      { name: "Högerforward", abbreviation: "HF" },
    ],
  },
];
