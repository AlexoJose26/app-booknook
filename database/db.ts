import { drizzle } from "drizzle-orm/expo-sqlite";
import * as SQLite from "expo-sqlite";
import * as schema from "./schema";
import { runMigrations } from "./migrations";

// Abrir o banco SQLite
export const sqlite = SQLite.openDatabaseSync("medeasocial.db");

// Rodar as migrations antes de criar o Drizzle ORM
runMigrations();


export const db = drizzle(sqlite, {
  schema,
});
