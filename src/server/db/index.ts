import { drizzle } from "drizzle-orm/mysql2";
import mysql from "mysql2/promise";

import { env } from "~/env.js";
export * as dbSchema from "./schema";
import * as schema from "./schema";

export const db = drizzle(
  mysql.createPool({
    uri: env.DATABASE_URL,
  }),
  { schema, mode: "default" },
);
