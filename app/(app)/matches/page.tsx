import Link from "next/link";
import { desc, eq, inArray, or } from "drizzle-orm";
import {
  currentOrgId,
  requireUserId,
  userOrgIds,
  userTeamIds,
} from "@/lib/auth";
import { db } from "@/lib/db/client";
import { formations, matches, teams } from "@/lib/db/schema";
import { Card, CardTitle } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Field, Input, Label } from "@/components/ui/Input";
import { createMatch } from "./actions";
import { matchTitle } from "@/lib/match-title";
import { MatchCreateForm } from "@/components/MatchCreateForm";
import { statusBadgeClass, statusLabel } from "@/lib/match-status";

function todayIso(): string {
  const d = new Date();
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

export default async function MatchesPage() {
  const userId = await requireUserId();
  const [teamIds, orgIds, activeOrgId] = await Promise.all([
    userTeamIds(userId),
    userOrgIds(userId),
    currentOrgId(),
  ]);
  const [teamList, formationList, matchList] = await Promise.all([
    activeOrgId
      ? db.select().from(teams).where(eq(teams.orgTeamId, activeOrgId))
      : Promise.resolve([]),
    db.select().from(formations).where(eq(formations.userId, userId)),
    teamIds.length === 0 && orgIds.length === 0
      ? Promise.resolve([])
      : db
          .select()
          .from(matches)
          .where(
            or(
              teamIds.length > 0
                ? inArray(matches.teamId, teamIds)
                : undefined,
              orgIds.length > 0
                ? inArray(matches.orgTeamId, orgIds)
                : undefined
            )
          )
          .orderBy(desc(matches.createdAt)),
  ]);

  const canCreate = formationList.length > 0;
  const teamNameById = new Map(teamList.map((t) => [t.id, t.name]));
  const defaultFormationId = formationList.find((f) => f.isDefault)?.id;

  return (
    <div>
      <h1 className="text-2xl font-bold mb-6">Matcher</h1>

      <div className="grid md:grid-cols-2 gap-4">
        <Card>
          <CardTitle>Nytt matchtillfälle</CardTitle>
          {!canCreate ? (
            <p className="text-sm text-neutral-600 mt-2">
              Skapa en{" "}
              <Link href="/formations" className="text-primary hover:underline">
                spelform
              </Link>{" "}
              först.
            </p>
          ) : (
            <MatchCreateForm
              teams={teamList.map((t) => ({ id: t.id, name: t.name }))}
              formations={formationList.map((f) => ({
                id: f.id,
                name: f.name,
                isDefault: f.isDefault,
              }))}
              defaultFormationId={defaultFormationId ?? null}
              defaultDate={todayIso()}
              action={createMatch}
            />
          )}
        </Card>

        <Card>
          <CardTitle>Alla matcher</CardTitle>
          {matchList.length === 0 ? (
            <p className="text-sm text-neutral-600 mt-2">Inga matcher ännu.</p>
          ) : (
            <ul className="mt-3 divide-y divide-border">
              {matchList.map((m) => {
                const teamName = m.teamId
                  ? teamNameById.get(m.teamId) ?? null
                  : null;
                return (
                  <li
                    key={m.id}
                    className="py-3 flex items-center justify-between"
                  >
                    <div>
                      <div className="font-medium">
                        {matchTitle({
                          opponent: m.opponent,
                          homeAway: m.homeAway,
                          teamName,
                          adHocName: m.adHocName,
                        })}
                        {m.reason ? (
                          <span className="text-sm text-neutral-500 font-normal">
                            {" "}
                            ({m.reason})
                          </span>
                        ) : null}
                      </div>
                      <div className="text-xs text-neutral-600 flex items-center gap-2 mt-0.5">
                        <span>
                          {m.playedAt
                            ? new Date(m.playedAt).toLocaleDateString("sv-SE")
                            : "Utan datum"}
                        </span>
                        <span
                          className={`px-1.5 py-0.5 rounded border ${statusBadgeClass(m.status)}`}
                        >
                          {statusLabel(m.status)}
                        </span>
                      </div>
                    </div>
                    <Link
                      href={`/matches/${m.id}`}
                      className="text-sm text-primary hover:underline"
                    >
                      Öppna →
                    </Link>
                  </li>
                );
              })}
            </ul>
          )}
        </Card>
      </div>
    </div>
  );
}
