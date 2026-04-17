import {
  pgTable,
  serial,
  text,
  integer,
  boolean,
  timestamp,
  jsonb,
  pgEnum,
} from "drizzle-orm/pg-core";

export const matchStatus = pgEnum("match_status", [
  "draft",
  "scheduled",
  "live",
  "finished",
]);

export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  email: text("email").notNull().unique(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const authTokens = pgTable("auth_tokens", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  token: text("token").notNull().unique(),
  expiresAt: timestamp("expires_at").notNull(),
  usedAt: timestamp("used_at"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const teams = pgTable("teams", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const players = pgTable("players", {
  id: serial("id").primaryKey(),
  teamId: integer("team_id").notNull().references(() => teams.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  nickname: text("nickname"),
  shirtNumber: integer("shirt_number"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const formations = pgTable("formations", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  numPeriods: integer("num_periods").notNull(),
  minutesPerPeriod: integer("minutes_per_period").notNull(),
  minSubsPerPeriod: integer("min_subs_per_period").notNull(),
  maxSubsPerPeriod: integer("max_subs_per_period").notNull(),
  playersOnField: integer("players_on_field").notNull(),
  isDefault: boolean("is_default").notNull().default(false),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const positions = pgTable("positions", {
  id: serial("id").primaryKey(),
  formationId: integer("formation_id").notNull().references(() => formations.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  abbreviation: text("abbreviation").notNull(),
  sortOrder: integer("sort_order").notNull().default(0),
  isGoalkeeper: boolean("is_goalkeeper").notNull().default(false),
});

export const matches = pgTable("matches", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  teamId: integer("team_id").notNull().references(() => teams.id, { onDelete: "cascade" }),
  formationId: integer("formation_id").notNull().references(() => formations.id, { onDelete: "restrict" }),
  opponent: text("opponent").notNull(),
  playedAt: timestamp("played_at"),
  location: text("location"),
  status: matchStatus("status").notNull().default("draft"),
  generatedScheduleJson: jsonb("generated_schedule_json"),
  liveStateJson: jsonb("live_state_json"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const matchPlayers = pgTable("match_players", {
  id: serial("id").primaryKey(),
  matchId: integer("match_id").notNull().references(() => matches.id, { onDelete: "cascade" }),
  playerId: integer("player_id").references(() => players.id, { onDelete: "set null" }),
  isGuest: boolean("is_guest").notNull().default(false),
  guestName: text("guest_name"),
  playablePositionIds: integer("playable_position_ids").array().notNull().default([]),
  preferredPositionIds: integer("preferred_position_ids").array().notNull().default([]),
  actualMinutesPlayed: integer("actual_minutes_played").notNull().default(0),
});

export type User = typeof users.$inferSelect;
export type Team = typeof teams.$inferSelect;
export type Player = typeof players.$inferSelect;
export type Formation = typeof formations.$inferSelect;
export type Position = typeof positions.$inferSelect;
export type Match = typeof matches.$inferSelect;
export type MatchPlayer = typeof matchPlayers.$inferSelect;
