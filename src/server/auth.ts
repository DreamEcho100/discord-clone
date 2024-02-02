// import { DrizzleAdapter } from "@auth/drizzle-adapter";
import { createId } from "@paralleldrive/cuid2";
import { and, eq } from "drizzle-orm";
import {
  getServerSession,
  type DefaultSession,
  type NextAuthOptions,
} from "next-auth";
import { type AdapterSession, type AdapterUser } from "next-auth/adapters";
import { type Adapter } from "next-auth/adapters";
import GitHubProvider from "next-auth/providers/github";

import { env } from "~/env";
import { db, dbSchema } from "~/server/db";

/**
 * Module augmentation for `next-auth` types. Allows us to add custom properties to the `session`
 * object and keep type safety.
 *
 * @see https://next-auth.js.org/getting-started/typescript#module-augmentation
 */
declare module "next-auth" {
  interface Session extends DefaultSession {
    user: {
      id: string;
      // ...other properties
      // role: UserRole;
    } & DefaultSession["user"];
  }

  // interface User {
  //   // ...other properties
  //   // role: UserRole;
  // }
}

/**
 * Options for NextAuth.js used to configure adapters, providers, callbacks, etc.
 *
 * @see https://next-auth.js.org/configuration/options
 */
export const authOptions: NextAuthOptions = {
  callbacks: {
    session: ({ session, user }) => ({
      ...session,
      user: {
        ...session.user,
        id: user.id,
      },
    }),
  },
  adapter: mySqlDrizzleAdapter(), // DrizzleAdapter(db, createTable) as Adapter,
  providers: [
    GitHubProvider({
      clientId: env.AUTH_GITHUB_ID,
      clientSecret: env.AUTH_GITHUB_SECRET,
      // account(account) {
      //   console.log("account", account);
      //   // https://docs.github.com/en/apps/creating-github-apps/authenticating-with-a-github-app/refreshing-user-access-tokens#refreshing-a-user-access-token-with-a-refresh-token
      //   const refresh_token_expires_at =
      //     Math.floor(Date.now() / 1000) +
      //     Number(account.refresh_token_expires_in);
      //   return {
      //     access_token: account.access_token,
      //     expires_at: account.expires_at,
      //     refresh_token: account.refresh_token,
      //     refresh_token_expires_at,
      //   };
      // },
    }),
    /**
     * ...add more providers here.
     *
     * Most other providers require a bit more work than the GitHub provider. For example, the
     * GitHub provider requires you to add the `refresh_token_expires_in` field to the Account
     * model. Refer to the NextAuth.js docs for the provider you want to use. Example:
     *
     * @see https://next-auth.js.org/providers/github
     */
  ],
};

/**
 * Wrapper for `getServerSession` so that you don't need to import the `authOptions` in every file.
 *
 * @see https://next-auth.js.org/configuration/nextjs
 */
export const getServerAuthSession = () => getServerSession(authOptions);

function mySqlDrizzleAdapter(): Adapter {
  const client = db;
  const { users, accounts, sessions, verificationTokens } = dbSchema;

  return {
    async createUser(data) {
      const id = createId();

      await client.insert(users).values({ ...data, id });

      return await client
        .select()
        .from(users)
        .where(eq(users.id, id))
        .then((res) => res[0] as AdapterUser);
    },
    async getUser(data) {
      const thing =
        (await client
          .select()
          .from(users)
          .where(eq(users.id, data))
          .then((res) => res[0])) ?? null;

      return thing;
    },
    async getUserByEmail(data) {
      const user =
        (await client
          .select()
          .from(users)
          .where(eq(users.email, data))
          .then((res) => res[0])) ?? null;

      return user;
    },
    async createSession(data) {
      await client.insert(sessions).values(data);

      return await client
        .select()
        .from(sessions)
        .where(eq(sessions.sessionToken, data.sessionToken))
        .then((res) => res[0] as AdapterSession);
    },
    async getSessionAndUser(data) {
      const sessionAndUser =
        (await client
          .select({
            session: sessions,
            user: users,
          })
          .from(sessions)
          .where(eq(sessions.sessionToken, data))
          .innerJoin(users, eq(users.id, sessions.userId))
          .then((res) => res[0])) ?? null;

      return sessionAndUser;
    },
    async updateUser(data) {
      if (!data.id) {
        throw new Error("No user id.");
      }

      await client.update(users).set(data).where(eq(users.id, data.id));

      return await client
        .select()
        .from(users)
        .where(eq(users.id, data.id))
        .then((res) => res[0] as AdapterUser);
    },
    async updateSession(data) {
      await client
        .update(sessions)
        .set(data)
        .where(eq(sessions.sessionToken, data.sessionToken));

      return await client
        .select()
        .from(sessions)
        .where(eq(sessions.sessionToken, data.sessionToken))
        .then((res) => res[0]);
    },
    async linkAccount(rawAccount) {
      await client.insert(accounts).values(rawAccount);
    },
    async getUserByAccount(account) {
      const dbAccount =
        (await client
          .select()
          .from(accounts)
          .where(
            and(
              eq(accounts.providerAccountId, account.providerAccountId),
              eq(accounts.provider, account.provider),
            ),
          )
          .leftJoin(users, eq(accounts.userId, users.id))
          .then((res) => res[0])) ?? null;

      if (!dbAccount) {
        return null;
      }

      return dbAccount.user;
    },
    async deleteSession(sessionToken) {
      const session =
        (await client
          .select()
          .from(sessions)
          .where(eq(sessions.sessionToken, sessionToken))
          .then((res) => res[0])) ?? null;

      await client
        .delete(sessions)
        .where(eq(sessions.sessionToken, sessionToken));

      return session;
    },
    async createVerificationToken(token) {
      await client.insert(verificationTokens).values(token);

      return await client
        .select()
        .from(verificationTokens)
        .where(eq(verificationTokens.identifier, token.identifier))
        .then((res) => res[0]);
    },
    async useVerificationToken(token) {
      try {
        const deletedToken =
          (await client
            .select()
            .from(verificationTokens)
            .where(
              and(
                eq(verificationTokens.identifier, token.identifier),
                eq(verificationTokens.token, token.token),
              ),
            )
            .then((res) => res[0])) ?? null;

        await client
          .delete(verificationTokens)
          .where(
            and(
              eq(verificationTokens.identifier, token.identifier),
              eq(verificationTokens.token, token.token),
            ),
          );

        return deletedToken;
      } catch (err) {
        throw new Error("No verification token found.");
      }
    },
    async deleteUser(id) {
      const user = await client
        .select()
        .from(users)
        .where(eq(users.id, id))
        .then((res) => res[0] ?? null);

      await client.delete(users).where(eq(users.id, id));

      return user;
    },
    async unlinkAccount(account) {
      await client
        .delete(accounts)
        .where(
          and(
            eq(accounts.providerAccountId, account.providerAccountId),
            eq(accounts.provider, account.provider),
          ),
        );

      return undefined;
    },
  };
}
