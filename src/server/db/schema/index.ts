import { relations, sql } from "drizzle-orm";
import {
  bigint,
  index,
  int,
  mysqlEnum,
  mysqlTableCreator,
  primaryKey,
  text,
  timestamp,
  varchar,
} from "drizzle-orm/mysql-core";
import { type AdapterAccount } from "next-auth/adapters";

/**
 * This is an example of how to use the multi-project schema feature of Drizzle ORM. Use the same
 * database instance for multiple projects.
 *
 * @see https://orm.drizzle.team/docs/goodies#multi-project-schema
 */
export const createTable = mysqlTableCreator((name) => `discord-clone_${name}`);

export const posts = createTable(
  "post",
  {
    id: bigint("id", { mode: "number" }).primaryKey().autoincrement(),
    name: varchar("name", { length: 256 }),
    createdById: varchar("createdById", { length: 255 })
      .notNull()
      .references(() => users.id),
    createdAt: timestamp("created_at")
      .default(sql`CURRENT_TIMESTAMP`)
      .notNull(),
    updatedAt: timestamp("updatedAt").onUpdateNow(),
  },
  (example) => ({
    createdByIdIdx: index("createdById_idx").on(example.createdById),
    nameIndex: index("name_idx").on(example.name),
  }),
);

export const users = createTable("user", {
  id: varchar("id", { length: 255 }).notNull().primaryKey(),
  name: varchar("name", { length: 255 }),
  email: varchar("email", { length: 255 }).notNull(),
  emailVerified: timestamp("emailVerified", {
    mode: "date",
    fsp: 3,
  }).default(sql`CURRENT_TIMESTAMP(3)`),
  image: varchar("image", { length: 255 }),
});

export const usersRelations = relations(users, ({ many }) => ({
  accounts: many(accounts),
  sessions: many(sessions),
  profiles: many(profiles),
}));

export const accounts = createTable(
  "account",
  {
    userId: varchar("userId", { length: 255 })
      .notNull()
      .references(() => users.id),
    type: varchar("type", { length: 255 })
      .$type<AdapterAccount["type"]>()
      .notNull(),
    provider: varchar("provider", { length: 255 }).notNull(),
    providerAccountId: varchar("providerAccountId", { length: 255 }).notNull(),
    refresh_token: text("refresh_token"),
    access_token: text("access_token"),
    expires_at: int("expires_at"),
    token_type: varchar("token_type", { length: 255 }),
    scope: varchar("scope", { length: 255 }),
    id_token: text("id_token"),
    session_state: varchar("session_state", { length: 255 }),
  },
  (account) => ({
    compoundKey: primaryKey({
      columns: [account.provider, account.providerAccountId],
    }),
    userIdIdx: index("account_userId_idx").on(account.userId),
  }),
);

export const accountsRelations = relations(accounts, ({ one }) => ({
  user: one(users, { fields: [accounts.userId], references: [users.id] }),
}));

export const sessions = createTable(
  "session",
  {
    sessionToken: varchar("sessionToken", { length: 255 })
      .notNull()
      .primaryKey(),
    userId: varchar("userId", { length: 255 })
      .notNull()
      .references(() => users.id),
    expires: timestamp("expires", { mode: "date" }).notNull(),
  },
  (session) => ({
    userIdIdx: index("session_userId_idx").on(session.userId),
  }),
);

export const sessionsRelations = relations(sessions, ({ one }) => ({
  user: one(users, { fields: [sessions.userId], references: [users.id] }),
}));

export const verificationTokens = createTable(
  "verificationToken",
  {
    identifier: varchar("identifier", { length: 255 }).notNull(),
    token: varchar("token", { length: 255 }).notNull(),
    expires: timestamp("expires", { mode: "date" }).notNull(),
  },
  (vt) => ({
    compoundKey: primaryKey({ columns: [vt.identifier, vt.token] }),
  }),
);

//
export const profiles = createTable("profile", {
  id: varchar("id", { length: 255 }).notNull().primaryKey(),
  userId: varchar("userId", { length: 255 }).notNull().unique(),
  name: varchar("name", { length: 255 }),
  imageUrl: text("imageUrl"),
  email: text("email"),
  createdAt: timestamp("createdAt")
    .default(sql`CURRENT_TIMESTAMP`)
    .notNull(),
  updatedAt: timestamp("updatedAt").onUpdateNow(),
});
export const profilesRelations = relations(profiles, ({ one, many }) => ({
  user: one(users, {
    fields: [profiles.userId],
    references: [users.id],
  }),
  servers: many(servers),
  members: many(members),
  channels: many(channels),
}));

export const servers = createTable("server", {
  id: varchar("id", { length: 255 }).notNull().primaryKey(),
  name: varchar("name", { length: 255 }),
  imageUrl: text("imageUrl"),
  inviteCode: varchar("inviteCode", { length: 255 }).notNull().unique(),
  profileId: varchar("profileId", { length: 255 }).notNull(),
  createdAt: timestamp("createdAt")
    .default(sql`CURRENT_TIMESTAMP`)
    .notNull(),
  updatedAt: timestamp("updatedAt").onUpdateNow(),
});
export const serversRelations = relations(servers, ({ one, many }) => ({
  profile: one(profiles, {
    fields: [servers.profileId],
    references: [profiles.id],
  }),
  members: many(members),
  channels: many(channels),
}));

export const members = createTable("member", {
  id: varchar("id", { length: 255 }).notNull().primaryKey(),
  role: mysqlEnum("MemberRole", ["ADMIN", "MODERATOR", "GUEST"]).default(
    "GUEST",
  ),
  profileId: varchar("profileId", { length: 255 }).notNull(),
  serverId: varchar("serverId", { length: 255 }).notNull(),
  createdAt: timestamp("createdAt")
    .default(sql`CURRENT_TIMESTAMP`)
    .notNull(),
  updatedAt: timestamp("updatedAt").onUpdateNow(),
});
export const membersRelations = relations(members, ({ one, many }) => ({
  profile: one(profiles, {
    fields: [members.profileId],
    references: [profiles.id],
  }),
  server: one(servers, {
    fields: [members.serverId],
    references: [servers.id],
  }),
  messages: many(messages),
  directMessages: many(directMessages),
  conversationsInitiated: many(conversations, { relationName: "MemberOne" }),
  conversationsReceived: many(conversations, { relationName: "MemberTwo" }),
}));

export const channels = createTable("channel", {
  id: varchar("id", { length: 255 }).notNull().primaryKey(),
  name: varchar("name", { length: 255 }),
  type: mysqlEnum("ChannelType", ["TEXT", "AUDIO", "VIDEO"]).default("TEXT"),
  profileId: varchar("profileId", { length: 255 }).notNull(),
  serverId: varchar("serverId", { length: 255 }).notNull(),
  createdAt: timestamp("createdAt")
    .default(sql`CURRENT_TIMESTAMP`)
    .notNull(),
  updatedAt: timestamp("updatedAt").onUpdateNow(),
});
export const channelsRelations = relations(channels, ({ one, many }) => ({
  profile: one(profiles, {
    fields: [channels.profileId],
    references: [profiles.id],
  }),
  server: one(servers, {
    fields: [channels.serverId],
    references: [servers.id],
  }),
  messages: many(messages),
}));

export const messages = createTable("message", {
  id: varchar("id", { length: 255 }).notNull().primaryKey(),
  content: text("content"),
  fileUrl: text("fileUrl"),
  memberId: varchar("memberId", { length: 255 }).notNull(),
  channelId: varchar("channelId", { length: 255 }).notNull(),
  deleted: bigint("deleted", { mode: "number" }).default(0),
  createdAt: timestamp("createdAt")
    .default(sql`CURRENT_TIMESTAMP`)
    .notNull(),
  updatedAt: timestamp("updatedAt").onUpdateNow(),
});
export const messagesRelations = relations(messages, ({ one }) => ({
  member: one(members, {
    fields: [messages.memberId],
    references: [members.id],
  }),
  channel: one(channels, {
    fields: [messages.channelId],
    references: [channels.id],
  }),
}));

export const conversations = createTable("conversation", {
  id: varchar("id", { length: 255 }).notNull().primaryKey(),
  memberOneId: varchar("memberOneId", { length: 255 }).notNull(),
  memberTwoId: varchar("memberTwoId", { length: 255 }).notNull(),
});
export const conversationsRelations = relations(
  conversations,
  ({ one, many }) => ({
    memberOne: one(members, {
      fields: [conversations.memberOneId],
      references: [members.id],
      relationName: "MemberOne",
    }),
    memberTwo: one(members, {
      fields: [conversations.memberTwoId],
      references: [members.id],
      relationName: "MemberTwo",
    }),
    directMessages: many(directMessages),
  }),
);

export const directMessages = createTable("directMessage", {
  id: varchar("id", { length: 255 }).notNull().primaryKey(),
  content: text("content"),
  fileUrl: text("fileUrl"),
  memberId: varchar("memberId", { length: 255 }).notNull(),
  conversationId: varchar("conversationId", { length: 255 }).notNull(),
  deleted: bigint("deleted", { mode: "number" }).default(0),
  createdAt: timestamp("createdAt")
    .default(sql`CURRENT_TIMESTAMP`)
    .notNull(),
  updatedAt: timestamp("updatedAt").onUpdateNow(),
});
export const directMessagesRelations = relations(directMessages, ({ one }) => ({
  member: one(members, {
    fields: [directMessages.memberId],
    references: [members.id],
  }),
  conversation: one(conversations, {
    fields: [directMessages.conversationId],
    references: [conversations.id],
  }),
}));
