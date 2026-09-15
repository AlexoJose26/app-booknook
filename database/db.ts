import { drizzle } from "drizzle-orm/expo-sqlite";
import * as SQLite from "expo-sqlite";
import * as schema from "./schema";
import { runMigrations } from "./migrations";


export const sqlite = SQLite.openDatabaseSync("medeasocial.db");

sqlite.execSync(`PRAGMA foreign_keys = ON;`);


runMigrations();


export const db = drizzle(sqlite, {
  schema,
});
