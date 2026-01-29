// db.ts
import { drizzle } from "drizzle-orm/expo-sqlite";
import * as SQLite from "expo-sqlite";
import * as schema from "./schema";

// Abre o banco SQLite
export const sqlite = SQLite.openDatabaseSync("medeasocial.db");

// Cria a instância do Drizzle ORM
export const db = drizzle(sqlite, { schema });

// Função para inicializar o banco de dados (limpando tudo)
export function initDB() {
  sqlite.execSync(`
    PRAGMA journal_mode = WAL;

    /* ================= DROPAR TABELAS ANTIGAS ================= */
    DROP TABLE IF EXISTS usuarios;
    DROP TABLE IF EXISTS livros;
    DROP TABLE IF EXISTS estantes;
    DROP TABLE IF EXISTS criticas;
    DROP TABLE IF EXISTS likes;
    DROP TABLE IF EXISTS comentarios;
    DROP TABLE IF EXISTS feed;

    /* ================= CRIAR TABELAS NOVAS ================= */
    CREATE TABLE usuarios (
      id TEXT PRIMARY KEY,
      nome TEXT NOT NULL UNIQUE,
      senha TEXT NOT NULL,
      foto_perfil TEXT
    );

    CREATE TABLE livros (
      id TEXT PRIMARY KEY,
      titulo TEXT NOT NULL,
      autor TEXT,
      descricao TEXT,
      imagem TEXT,
      pdfUri TEXT
    );

    CREATE TABLE estantes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      usuario_id TEXT NOT NULL,
      livro_id TEXT NOT NULL,
      status TEXT NOT NULL,
      createdAt TEXT NOT NULL
    );

    CREATE TABLE criticas (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      usuario_id TEXT NOT NULL,
      livro_id TEXT NOT NULL,
      texto TEXT NOT NULL,
      nota INTEGER,
      createdAt TEXT NOT NULL
    );

    CREATE TABLE likes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      usuario_id TEXT NOT NULL,
      critica_id INTEGER NOT NULL,
      createdAt TEXT NOT NULL
    );

    CREATE TABLE comentarios (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      usuario_id TEXT NOT NULL,
      critica_id INTEGER NOT NULL,
      texto TEXT NOT NULL,
      createdAt TEXT NOT NULL
    );

    CREATE TABLE feed (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      usuario_id TEXT NOT NULL,
      acao TEXT NOT NULL,
      livro_titulo TEXT NOT NULL,
      data TEXT NOT NULL
    );
  `);

  console.log("Banco inicializado do zero com sucesso!");
}
