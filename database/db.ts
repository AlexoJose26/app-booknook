import { drizzle } from "drizzle-orm/expo-sqlite";
import * as SQLite from "expo-sqlite";

import { runMigrations } from "./migrations";
import * as schema from "./schema";


const sqlite = SQLite.openDatabaseSync("medeasocial.db");


sqlite.execSync(`
  PRAGMA foreign_keys = ON;
`);


runMigrations(sqlite);

const db = drizzle(sqlite, {
  schema,
});


async function initializeDatabase() {
  return db;
}

export {
  db,
  initializeDatabase, sqlite
};

