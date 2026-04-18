import {
  pgTable,
  serial,
  text,
  integer,
  boolean,
  timestamp,
  jsonb,
  pgEnum,
  uniqueIndex,
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
  otp: text("otp"),
  expiresAt: timestamp("expires_at").notNull(),
  usedAt: timestamp("used_at"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const orgTeams = pgTable("org_teams", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  createdByUserId: integer("created_by_user_id").references(() => users.id, {
    onDelete: "set null",
  }),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const orgMembers = pgTable(
  "org_members",
  {
    id: serial("id").primaryKey(),
    orgTeamId: integer("org_team_id")
      .notNull()
      .references(() => orgTeams.id, { onDelete: "cascade" }),
    userId: integer("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    joinedAt: timestamp("joined_at").notNull().defaultNow(),
  },
  (t) => ({
    uniq: uniqueIndex("org_members_org_user_idx").on(t.orgTeamId, t.userId),
  })
);

export const orgInvites = pgTable(
  "org_invites",
  {
    id: serial("id").primaryKey(),
    orgTeamId: integer("org_team_id")
      .notNull()
      .references(() => orgTeams.id, { onDelete: "cascade" }),
    email: text("email").notNull(),
    invitedByUserId: integer("invited_by_user_id").references(() => users.id, {
      onDelete: "set null",
    }),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (t) => ({
    uniq: uniqueIndex("org_invites_org_email_idx").on(t.orgTeamId, t.email),
  })
);

export const teams = pgTable("teams", {
  id: serial("id").primaryKey(),
  // Nullable during migration; will be required after.
  orgTeamId: integer("org_team_id").references(() => orgTeams.id, {
    onDelete: "cascade",
  }),
  userId: integer("user_id").references(() => users.id, { onDelete: "set null" }),
  name: text("name").notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const teamMembers = pgTable(
  "team_members",
  {
    id: serial("id").primaryKey(),
    teamId: integer("team_id")
      .notNull()
      .references(() => teams.id, { onDelete: "cascade" }),
    userId: integer("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    joinedAt: timestamp("joined_at").notNull().defaultNow(),
  },
  (t) => ({
    uniq: uniqueIndex("team_members_team_user_idx").on(t.teamId, t.userId),
  })
);

export const teamInvites = pgTable(
  "team_invites",
  {
    id: serial("id").primaryKey(),
    teamId: integer("team_id")
      .notNull()
      .references(() => teams.id, { onDelete: "cascade" }),
    email: text("email").notNull(),
    invitedByUserId: integer("invited_by_user_id").references(() => users.id, {
      onDelete: "set null",
    }),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (t) => ({
    uniq: uniqueIndex("team_invites_team_email_idx").on(t.teamId, t.email),
  })
);

export const players = pgTable("players", {
  id: serial("id").primaryKey(),
  // Player "lives" at the org level. Nullable during migration.
  orgTeamId: integer("org_team_id").references(() => orgTeams.id, {
    onDelete: "cascade",
  }),
  // Legacy: the original team. Kept for migration continuity; team membership
  // is now tracked via team_players.
  teamId: integer("team_id").references(() => teams.id, { onDelete: "set null" }),
  name: text("name").notNull(),
  nickname: text("nickname"),
  shirtNumber: integer("shirt_number"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const teamPlayers = pgTable(
  "team_players",
  {
    id: serial("id").primaryKey(),
    teamId: integer("team_id")
      .notNull()
      .references(() => teams.id, { onDelete: "cascade" }),
    playerId: integer("player_id")
      .notNull()
      .references(() => players.id, { onDelete: "cascade" }),
    assignedAt: timestamp("assigned_at").notNull().defaultNow(),
  },
  (t) => ({
    uniq: uniqueIndex("team_players_team_player_idx").on(t.teamId, t.playerId),
  })
);

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
  // "Created by" marker. Access is via team membership, not this column.
  userId: integer("user_id").references(() => users.id, { onDelete: "set null" }),
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

export const features = pgTable("features", {
  id: serial("id").primaryKey(),
  title: text("title").notNull(),
  description: text("description"),
  status: text("status").notNull().default("open"),
  createdByUserId: integer("created_by_user_id").references(() => users.id, {
    onDelete: "set null",
  }),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const featureVotes = pgTable(
  "feature_votes",
  {
    id: serial("id").primaryKey(),
    featureId: integer("feature_id")
      .notNull()
      .references(() => features.id, { onDelete: "cascade" }),
    userId: integer("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (t) => ({
    uniq: uniqueIndex("feature_votes_feature_user_idx").on(t.featureId, t.userId),
  })
);

export type User = typeof users.$inferSelect;
export type Team = typeof teams.$inferSelect;
export type OrgTeam = typeof orgTeams.$inferSelect;
export type OrgMember = typeof orgMembers.$inferSelect;
export type OrgInvite = typeof orgInvites.$inferSelect;
export type TeamMember = typeof teamMembers.$inferSelect;
export type TeamInvite = typeof teamInvites.$inferSelect;
export type TeamPlayer = typeof teamPlayers.$inferSelect;
export type Player = typeof players.$inferSelect;
export type Formation = typeof formations.$inferSelect;
export type Position = typeof positions.$inferSelect;
export type Match = typeof matches.$inferSelect;
export type MatchPlayer = typeof matchPlayers.$inferSelect;
