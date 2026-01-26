import { drizzle } from "drizzle-orm/expo-sqlite";
import * as SQLite from "expo-sqlite";
import * as schema from "./schema";

// Abrir banco
export const sqlite = SQLite.openDatabaseSync("medeasocial.db");

// Drizzle
export const db = drizzle(sqlite, { schema });

// Inicialização do banco
export function initDB() {
  sqlite.execSync(`
    PRAGMA journal_mode = WAL;

    -- Tabelas existentes
    CREATE TABLE IF NOT EXISTS usuarios (
      id TEXT PRIMARY KEY,
      nome TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS livros (
      id TEXT PRIMARY KEY,
      titulo TEXT NOT NULL,
      autor TEXT,
      imagem TEXT,
      descricao TEXT,
      pdfUri TEXT
    );

    CREATE TABLE IF NOT EXISTS estantes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      usuario_id TEXT NOT NULL,
      livro_id TEXT NOT NULL,
      status TEXT NOT NULL,
      createdAt TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS criticas (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      usuario_id TEXT NOT NULL,
      livro_id TEXT NOT NULL,
      texto TEXT NOT NULL,
      nota INTEGER,
      createdAt TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS likes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      usuario_id TEXT NOT NULL,
      critica_id INTEGER NOT NULL,
      createdAt TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS comentarios (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      usuario_id TEXT NOT NULL,
      critica_id INTEGER NOT NULL,
      texto TEXT NOT NULL,
      createdAt TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS feed (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      usuario_id TEXT NOT NULL,
      acao TEXT NOT NULL,
      livro_titulo TEXT NOT NULL,
      data TEXT NOT NULL
    );
  `);

  // ✅ Adiciona coluna foto_perfil se não existir
  try {
    sqlite.execSync(`
      ALTER TABLE usuarios ADD COLUMN foto_perfil TEXT;
    `);
  } catch (e) {
    // Se a coluna já existe, ignora
    if (!e.message.includes("duplicate column name")) {
      console.error("Erro ao adicionar foto_perfil:", e);
    }
  }
}
