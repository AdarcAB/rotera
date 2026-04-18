import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import crypto from "node:crypto";
import { and, eq, inArray } from "drizzle-orm";
import { db } from "./db/client";
import {
  users,
  authTokens,
  teamMembers,
  teamInvites,
  teams,
  matches,
  orgTeams,
  orgMembers,
  orgInvites,
} from "./db/schema";

const COOKIE_NAME = "rotera_session";
const ORG_COOKIE_NAME = "rotera_org";
// Rotera är en låg-känslighets-tjänst. Långlivade sessioner så coacher slipper
// logga in varje match.
const SESSION_DAYS = 365;

function secret(): string {
  const s = process.env.AUTH_SECRET;
  if (!s || s.length < 16) throw new Error("AUTH_SECRET env var must be set (>= 16 chars)");
  return s;
}

function sign(value: string): string {
  return crypto.createHmac("sha256", secret()).update(value).digest("base64url");
}

function encodeSession(userId: number): string {
  const payload = `${userId}.${Date.now()}`;
  const sig = sign(payload);
  return `${payload}.${sig}`;
}

function decodeSession(raw: string): { userId: number } | null {
  const parts = raw.split(".");
  if (parts.length !== 3) return null;
  const [userIdStr, tsStr, sig] = parts;
  const expected = sign(`${userIdStr}.${tsStr}`);
  if (sig !== expected) return null;
  const userId = Number(userIdStr);
  const ts = Number(tsStr);
  if (!Number.isFinite(userId) || !Number.isFinite(ts)) return null;
  const ageMs = Date.now() - ts;
  if (ageMs > SESSION_DAYS * 24 * 60 * 60 * 1000) return null;
  return { userId };
}

export async function setSession(userId: number) {
  const c = await cookies();
  c.set(COOKIE_NAME, encodeSession(userId), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: SESSION_DAYS * 24 * 60 * 60,
  });
}

export async function clearSession() {
  const c = await cookies();
  c.delete(COOKIE_NAME);
}

export async function getSession(): Promise<{ userId: number } | null> {
  const c = await cookies();
  const raw = c.get(COOKIE_NAME)?.value;
  if (!raw) return null;
  return decodeSession(raw);
}

export async function requireUser(): Promise<{ id: number; email: string }> {
  const session = await getSession();
  if (!session) redirect("/login");
  const rows = await db.select().from(users).where(eq(users.id, session.userId)).limit(1);
  if (rows.length === 0) redirect("/login");
  return rows[0];
}

export async function requireUserId(): Promise<number> {
  const u = await requireUser();
  return u.id;
}

export function generateToken(): string {
  return crypto.randomBytes(32).toString("base64url");
}

export function generateOtp(): string {
  // 6-digit numeric. Pad with zeros; avoid bias by rejecting high range.
  const n = crypto.randomInt(0, 1_000_000);
  return n.toString().padStart(6, "0");
}

export async function findOrCreateUserByEmail(
  email: string
): Promise<{ userId: number; normalizedEmail: string }> {
  const normalized = email.trim().toLowerCase();
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(normalized)) {
    throw new Error("Ogiltig e-postadress");
  }
  const existing = await db
    .select()
    .from(users)
    .where(eq(users.email, normalized))
    .limit(1);
  let userId: number;
  if (existing.length > 0) {
    userId = existing[0].id;
  } else {
    const [inserted] = await db
      .insert(users)
      .values({ email: normalized })
      .returning();
    userId = inserted.id;
    // Create default org for new user (football as default sport; this
    // seeds SvFF formations). Picking a different sport is a future
    // onboarding question.
    const [org] = await db
      .insert(orgTeams)
      .values({
        name: `${normalized.split("@")[0]}s organisation`,
        sport: "fotboll",
        createdByUserId: userId,
      })
      .returning();
    await db
      .insert(orgMembers)
      .values({ orgTeamId: org.id, userId })
      .onConflictDoNothing();
    await seedFormationsForUser(userId);
  }
  // Resolve any pending invites to this email into actual memberships.
  await resolveInvitesForEmail(userId, normalized);
  return { userId, normalizedEmail: normalized };
}

export async function createLoginToken(
  email: string
): Promise<{ token: string; otp: string; normalizedEmail: string }> {
  const { userId, normalizedEmail } = await findOrCreateUserByEmail(email);
  const token = generateToken();
  const otp = generateOtp();
  const expires = new Date(Date.now() + 30 * 60 * 1000);
  await db.insert(authTokens).values({ userId, token, otp, expiresAt: expires });
  return { token, otp, normalizedEmail };
}

export async function consumeLoginToken(token: string): Promise<number | null> {
  const rows = await db.select().from(authTokens).where(eq(authTokens.token, token)).limit(1);
  if (rows.length === 0) return null;
  const row = rows[0];
  if (row.usedAt) return null;
  if (row.expiresAt.getTime() < Date.now()) return null;
  await db.update(authTokens).set({ usedAt: new Date() }).where(eq(authTokens.id, row.id));
  return row.userId;
}

export async function consumeOtp(
  email: string,
  otp: string
): Promise<number | null> {
  const normalized = email.trim().toLowerCase();
  const cleanOtp = otp.replace(/\D/g, "");
  if (cleanOtp.length !== 6) return null;
  const userRows = await db
    .select()
    .from(users)
    .where(eq(users.email, normalized))
    .limit(1);
  if (userRows.length === 0) return null;
  const user = userRows[0];
  const rows = await db
    .select()
    .from(authTokens)
    .where(
      and(eq(authTokens.userId, user.id), eq(authTokens.otp, cleanOtp))
    )
    .limit(1);
  if (rows.length === 0) return null;
  const row = rows[0];
  if (row.usedAt) return null;
  if (row.expiresAt.getTime() < Date.now()) return null;
  await db
    .update(authTokens)
    .set({ usedAt: new Date() })
    .where(eq(authTokens.id, row.id));
  return row.userId;
}

export async function userOrgIds(userId: number): Promise<number[]> {
  const rows = await db
    .select({ orgTeamId: orgMembers.orgTeamId })
    .from(orgMembers)
    .where(eq(orgMembers.userId, userId));
  return rows.map((r) => r.orgTeamId);
}

export async function assertOrgAccessible(
  orgTeamId: number,
  userId: number
): Promise<void> {
  const rows = await db
    .select()
    .from(orgMembers)
    .where(
      and(eq(orgMembers.orgTeamId, orgTeamId), eq(orgMembers.userId, userId))
    )
    .limit(1);
  if (rows.length === 0) throw new Error("Ingen åtkomst till organisationen");
}

/** Returns the currently-active org ID. Preference order:
 *   1. cookie (valid + accessible)
 *   2. users.preferred_org_team_id (if accessible)
 *   3. first org from membership list
 *   4. auto-create a default org if none exist
 */
export async function currentOrgId(): Promise<number> {
  const user = await requireUser();
  const c = await cookies();
  const raw = c.get(ORG_COOKIE_NAME)?.value;
  const orgs = await userOrgIds(user.id);
  const accessibleSet = new Set(orgs);

  let targetId: number | null = null;
  if (raw) {
    const parsed = Number(raw);
    if (Number.isFinite(parsed) && accessibleSet.has(parsed)) targetId = parsed;
  }
  if (targetId === null) {
    const [userRow] = await db
      .select()
      .from(users)
      .where(eq(users.id, user.id))
      .limit(1);
    const preferred = userRow?.preferredOrgTeamId ?? null;
    if (preferred !== null && accessibleSet.has(preferred)) {
      targetId = preferred;
    }
  }
  if (targetId === null) {
    if (orgs.length === 0) {
      const [inserted] = await db
        .insert(orgTeams)
        .values({
          name: `${user.email.split("@")[0]}s organisation`,
          createdByUserId: user.id,
        })
        .returning();
      await db
        .insert(orgMembers)
        .values({ orgTeamId: inserted.id, userId: user.id })
        .onConflictDoNothing();
      targetId = inserted.id;
    } else {
      targetId = orgs[0];
    }
  }
  c.set(ORG_COOKIE_NAME, String(targetId), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: SESSION_DAYS * 24 * 60 * 60,
  });
  return targetId;
}

export async function setCurrentOrgId(orgTeamId: number): Promise<void> {
  const user = await requireUser();
  await assertOrgAccessible(orgTeamId, user.id);
  const c = await cookies();
  c.set(ORG_COOKIE_NAME, String(orgTeamId), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: SESSION_DAYS * 24 * 60 * 60,
  });
  await db
    .update(users)
    .set({ preferredOrgTeamId: orgTeamId })
    .where(eq(users.id, user.id));
}

/** A team is accessible if the user is a member of its org. */
export async function assertTeamAccessible(
  teamId: number,
  userId: number
): Promise<void> {
  const row = await db
    .select({ orgTeamId: teams.orgTeamId })
    .from(teams)
    .where(eq(teams.id, teamId))
    .limit(1)
    .then((r) => r[0]);
  if (!row || row.orgTeamId === null) {
    throw new Error("Laget saknar organisation");
  }
  await assertOrgAccessible(row.orgTeamId, userId);
}

/** Legacy helper retained for callers; returns teams in current org. */
export async function userTeamIds(userId: number): Promise<number[]> {
  const orgIds = await userOrgIds(userId);
  if (orgIds.length === 0) return [];
  const rows = await db
    .select({ id: teams.id })
    .from(teams)
    .where(inArray(teams.orgTeamId, orgIds));
  return rows.map((r) => r.id);
}

/** Teams in the caller's current active org. */
export async function teamIdsInCurrentOrg(): Promise<number[]> {
  const orgId = await currentOrgId();
  const rows = await db
    .select({ id: teams.id })
    .from(teams)
    .where(eq(teams.orgTeamId, orgId));
  return rows.map((r) => r.id);
}

export async function resolveInvitesForEmail(
  userId: number,
  email: string
): Promise<number> {
  const normalized = email.trim().toLowerCase();
  let count = 0;

  // Legacy team_invites
  const tInvites = await db
    .select()
    .from(teamInvites)
    .where(eq(teamInvites.email, normalized));
  for (const inv of tInvites) {
    await db
      .insert(teamMembers)
      .values({ teamId: inv.teamId, userId })
      .onConflictDoNothing();
    // Also ensure user is an org member of the team's org.
    const t = await db
      .select()
      .from(teams)
      .where(eq(teams.id, inv.teamId))
      .limit(1)
      .then((r) => r[0]);
    if (t?.orgTeamId) {
      await db
        .insert(orgMembers)
        .values({ orgTeamId: t.orgTeamId, userId })
        .onConflictDoNothing();
    }
  }
  if (tInvites.length > 0) {
    await db.delete(teamInvites).where(eq(teamInvites.email, normalized));
    count += tInvites.length;
  }

  // Modern org_invites
  const oInvites = await db
    .select()
    .from(orgInvites)
    .where(eq(orgInvites.email, normalized));
  for (const inv of oInvites) {
    await db
      .insert(orgMembers)
      .values({ orgTeamId: inv.orgTeamId, userId })
      .onConflictDoNothing();
  }
  if (oInvites.length > 0) {
    await db.delete(orgInvites).where(eq(orgInvites.email, normalized));
    count += oInvites.length;
  }

  return count;
}

async function seedFormationsForUser(userId: number) {
  const { SVFF_FORMATIONS } = await import("./svff-formations");
  const { formations, positions } = await import("./db/schema");
  for (const f of SVFF_FORMATIONS) {
    const [ins] = await db
      .insert(formations)
      .values({
        userId,
        name: f.name,
        numPeriods: f.numPeriods,
        minutesPerPeriod: f.minutesPerPeriod,
        minSubsPerPeriod: f.minSubsPerPeriod,
        maxSubsPerPeriod: f.maxSubsPerPeriod,
        playersOnField: f.playersOnField,
        isDefault: f.name === "7 mot 7",
      })
      .returning();
    const posRows = f.positions.map((p, i) => ({
      formationId: ins.id,
      name: p.name,
      abbreviation: p.abbreviation,
      sortOrder: i,
      isGoalkeeper: p.isGoalkeeper ?? false,
    }));
    await db.insert(positions).values(posRows);
  }
}
