export type MatchTitleInput = {
  opponent: string;
  homeAway: "home" | "away";
  teamName: string | null;
  adHocName: string | null;
};

export function ownName(m: MatchTitleInput): string {
  return m.teamName ?? m.adHocName ?? "Eget lag";
}

export function matchTitle(m: MatchTitleInput): string {
  const own = ownName(m);
  return m.homeAway === "away"
    ? `${m.opponent} vs ${own}`
    : `${own} vs ${m.opponent}`;
}
