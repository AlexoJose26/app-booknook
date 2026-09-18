import { drizzle } from "drizzle-orm/expo-sqlite";
import * as SQLite from "expo-sqlite";

import { runMigrations } from "./migrations";
import * as schema from "./schema";

type DrizzleDatabase = ReturnType<typeof drizzle>;

let sqlite: SQLite.SQLiteDatabase | null = null;
let db: DrizzleDatabase | null = null;

let initializationPromise: Promise<DrizzleDatabase> | null = null;

async function initializeDatabase(): Promise<DrizzleDatabase> {
  if (db) {
    return db;
  }

  if (initializationPromise) {
    return initializationPromise;
  }

  initializationPromise = (async () => {
    try {
      const database = await SQLite.openDatabaseAsync("medeasocial.db");

      await database.execAsync(`
        PRAGMA foreign_keys = ON;
      `);

      await runMigrations(database);

      sqlite = database;

      db = drizzle(database, {
        schema,
      });

      console.log("Banco de dados pronto.");

      return db;
    } catch (error) {
      initializationPromise = null;

      console.error(
        "Erro ao inicializar o banco de dados:",
        error
      );

      throw error;
    }
  })();

  return initializationPromise;
}

async function getDb(): Promise<DrizzleDatabase> {
  return initializeDatabase();
}

export {
  db, getDb,
  initializeDatabase, sqlite
};
