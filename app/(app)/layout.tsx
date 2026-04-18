import Link from "next/link";
import { and, eq, desc, inArray } from "drizzle-orm";
import { requireUser, userTeamIds } from "@/lib/auth";
import { db } from "@/lib/db/client";
import { matches, teams } from "@/lib/db/schema";
import { Logo } from "@/components/Logo";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await requireUser();
  const teamIds = await userTeamIds(user.id);

  const liveMatch =
    teamIds.length === 0
      ? null
      : await db
          .select({
            id: matches.id,
            opponent: matches.opponent,
            teamName: teams.name,
          })
          .from(matches)
          .leftJoin(teams, eq(teams.id, matches.teamId))
          .where(
            and(
              inArray(matches.teamId, teamIds),
              eq(matches.status, "live")
            )
          )
          .orderBy(desc(matches.createdAt))
          .limit(1)
          .then((r) => r[0] ?? null);

  return (
    <div className="flex-1 flex flex-col">
      <a
        href="#huvudinnehall"
        className="sr-only focus:not-sr-only focus:absolute focus:top-2 focus:left-2 focus:z-50 focus:bg-primary focus:text-white focus:px-4 focus:py-2 focus:rounded-md focus:ring-2 focus:ring-offset-2 focus:ring-emerald-500"
      >
        Hoppa till innehåll
      </a>
      <div className="sticky top-0 z-20 bg-white">
        {liveMatch ? (
          <Link
            href={`/matches/${liveMatch.id}/live`}
            className="block bg-orange-500 hover:bg-orange-600 text-white px-4 py-2 text-sm font-medium text-center"
          >
            🔴 Live-match pågår — {liveMatch.teamName ?? "Lag"} vs {liveMatch.opponent}
            <span className="ml-2 underline">Gå till live →</span>
          </Link>
        ) : null}
        <header className="px-4 md:px-6 py-3 border-b border-border bg-white flex items-center justify-between">
          <div className="flex items-center gap-4 md:gap-6">
            <Link href="/dashboard" className="flex items-center gap-2">
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
          <div className="flex items-center gap-3">
            <Link
              href="/konto"
              className="hidden sm:inline text-sm text-neutral-700 hover:underline"
            >
              {user.email}
            </Link>
            <form action="/logout" method="post">
              <button
                type="submit"
                className="text-sm text-neutral-700 hover:underline"
              >
                Logga ut
              </button>
            </form>
          </div>
        </header>

        <nav className="md:hidden px-4 py-2 border-b border-border bg-white flex gap-4 text-sm overflow-x-auto">
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
