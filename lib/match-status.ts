export type MatchStatus = "draft" | "scheduled" | "live" | "finished";

export function statusLabel(status: MatchStatus): string {
  switch (status) {
    case "draft":
      return "Utkast";
    case "scheduled":
      return "Schema klart";
    case "live":
      return "Live";
    case "finished":
      return "Klar";
  }
}

export function statusBadgeClass(status: MatchStatus): string {
  switch (status) {
    case "draft":
      return "bg-neutral-100 text-neutral-700 border-neutral-200";
    case "scheduled":
      return "bg-sky-50 text-sky-800 border-sky-200";
    case "live":
      return "bg-orange-100 text-orange-800 border-orange-200";
    case "finished":
      return "bg-emerald-50 text-emerald-800 border-emerald-200";
  }
}
