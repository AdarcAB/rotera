import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import crypto from "node:crypto";
import { eq } from "drizzle-orm";
import { db } from "./db/client";
import { users, authTokens } from "./db/schema";

const COOKIE_NAME = "rotera_session";
const SESSION_DAYS = 30;

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

export async function createLoginToken(email: string): Promise<string> {
  const normalized = email.trim().toLowerCase();
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(normalized)) {
    throw new Error("Ogiltig e-postadress");
  }

  const existing = await db.select().from(users).where(eq(users.email, normalized)).limit(1);
  let userId: number;
  if (existing.length === 0) {
    const [inserted] = await db.insert(users).values({ email: normalized }).returning();
    userId = inserted.id;
    await seedFormationsForUser(userId);
  } else {
    userId = existing[0].id;
  }

  const token = generateToken();
  const expires = new Date(Date.now() + 30 * 60 * 1000);
  await db.insert(authTokens).values({ userId, token, expiresAt: expires });

  return token;
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
    }));
    await db.insert(positions).values(posRows);
  }
}
