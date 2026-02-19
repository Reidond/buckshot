import { drizzle } from "drizzle-orm/d1";
import * as schema from "./schema";

export type Env = {
  DB: D1Database;
};

export function getDB(env: Env) {
  return drizzle(env.DB, { schema });
}

export * from "./schema";
export { schema };
