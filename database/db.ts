import { drizzle } from "drizzle-orm/expo-sqlite";
import * as SQLite from "expo-sqlite";
import { runMigrations } from "./migrations";
import * as schema from "./schema";

export const sqlite = SQLite.openDatabaseSync("medeasocial.db");

sqlite.execSync(`
  PRAGMA foreign_keys = ON;
`);

runMigrations(sqlite);

export const db = drizzle(sqlite, {
  schema,
});

