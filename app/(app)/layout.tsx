import Link from "next/link";
import { and, eq, desc, inArray, or } from "drizzle-orm";
import { currentOrgId, requireUser, userOrgIds, userTeamIds } from "@/lib/auth";
import { db } from "@/lib/db/client";
import { matches, orgTeams, teams } from "@/lib/db/schema";
import { Logo } from "@/components/Logo";
import { PullToRefresh } from "@/components/PullToRefresh";
import { matchTitle } from "@/lib/match-title";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await requireUser();
  const activeOrgId = await currentOrgId();
  const orgIds = await userOrgIds(user.id);
  const [activeOrg] = await db
    .select()
    .from(orgTeams)
    .where(eq(orgTeams.id, activeOrgId))
    .limit(1);
  const teamIds = await userTeamIds(user.id);

  const liveMatches =
    teamIds.length === 0 && orgIds.length === 0
      ? []
      : await db
          .select({
            id: matches.id,
            opponent: matches.opponent,
            teamName: teams.name,
            adHocName: matches.adHocName,
            homeAway: matches.homeAway,
          })
          .from(matches)
          .leftJoin(teams, eq(teams.id, matches.teamId))
          .where(
            and(
              or(
                teamIds.length > 0
                  ? inArray(matches.teamId, teamIds)
                  : undefined,
                orgIds.length > 0
                  ? inArray(matches.orgTeamId, orgIds)
                  : undefined
              ),
              eq(matches.status, "live")
            )
          )
          .orderBy(desc(matches.createdAt));

  return (
    <div className="flex-1 flex flex-col">
      <PullToRefresh />
      <a
        href="#huvudinnehall"
        className="sr-only focus:not-sr-only focus:absolute focus:top-2 focus:left-2 focus:z-50 focus:bg-primary focus:text-white focus:px-4 focus:py-2 focus:rounded-md focus:ring-2 focus:ring-offset-2 focus:ring-emerald-500"
      >
        Hoppa till innehåll
      </a>
      <div className="sticky top-0 z-20 bg-white">
        {liveMatches.map((lm) => (
          <Link
            key={lm.id}
            href={`/matches/${lm.id}/live`}
            className="block bg-orange-500 hover:bg-orange-600 text-white px-4 py-2 text-sm font-medium text-center"
          >
            🔴 Live — {matchTitle(lm)}
            <span className="ml-2 underline">Gå till live →</span>
          </Link>
        ))}
        <header className="px-4 md:px-6 py-3 border-b border-border bg-white flex items-center justify-between gap-3">
          <div className="flex items-center gap-4 md:gap-6 min-w-0">
            <Link href="/dashboard" className="flex items-center gap-2 shrink-0">
              <Logo size={28} />
              <span className="font-bold">Rotera</span>
            </Link>
            <nav className="hidden md:flex items-center gap-4 text-sm">
              <Link href="/dashboard" className="hover:underline">
                Översikt
              </Link>
              <Link href="/teams" className="hover:underline">
                Lag
              </Link>
              <Link href="/formations" className="hover:underline">
                Spelformer
              </Link>
              <Link href="/matches" className="hover:underline">
                Matcher
              </Link>
            </nav>
          </div>
          <div className="flex items-center gap-2 md:gap-3 shrink-0">
            {activeOrg ? (
              <Link
                href="/orgs"
                className="flex items-center gap-1 text-sm px-2 py-1 rounded-md bg-neutral-100 hover:bg-neutral-200 text-neutral-800 max-w-[140px] md:max-w-[200px]"
                title={
                  orgIds.length > 1
                    ? "Byt organisation eller hantera"
                    : "Organisationsinställningar"
                }
              >
                <span className="truncate">{activeOrg.name}</span>
                {orgIds.length > 1 ? (
                  <svg
                    width="12"
                    height="12"
                    viewBox="0 0 24 24"
                    fill="currentColor"
                    aria-hidden="true"
                  >
                    <path d="M7 10l5 5 5-5H7z" />
                  </svg>
                ) : null}
              </Link>
            ) : null}
            <Link
              href="/konto"
              title={user.email}
              className="text-sm text-neutral-700 hover:underline"
            >
              Konto
            </Link>
          </div>
        </header>

        <nav className="md:hidden px-4 py-2 border-b border-border bg-white flex items-center gap-4 text-sm overflow-x-auto whitespace-nowrap">
          <Link href="/dashboard">Översikt</Link>
          <Link href="/teams">Lag</Link>
          <Link href="/formations">Spelformer</Link>
          <Link href="/matches">Matcher</Link>
        </nav>
      </div>

      <main
        id="huvudinnehall"
        className="flex-1 px-4 md:px-6 py-6 max-w-5xl w-full mx-auto"
      >
        {children}
      </main>
    </div>
  );
}
