import { sqlite } from "./db";

export function runMigrations() {
  sqlite.execSync(`
    PRAGMA journal_mode = WAL;

    CREATE TABLE IF NOT EXISTS migrations (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      version INTEGER NOT NULL UNIQUE,
      createdAt TEXT NOT NULL
    );
  `);

  const result = sqlite.getAllSync<{ version: number }>(
    "SELECT version FROM migrations ORDER BY version DESC LIMIT 1"
  );

  const currentVersion = result[0]?.version ?? 0;


  if (currentVersion < 1) {
    sqlite.execSync(`
      CREATE TABLE IF NOT EXISTS usuarios (
        id TEXT PRIMARY KEY,
        nome TEXT NOT NULL UNIQUE,
        senha TEXT NOT NULL,
        foto_perfil TEXT
      );

      CREATE TABLE IF NOT EXISTS livros (
        id TEXT PRIMARY KEY,
        titulo TEXT NOT NULL,
        autor TEXT,
        descricao TEXT,
        imagem TEXT,
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

    sqlite.execSync(`
      INSERT INTO migrations (version, createdAt)
      VALUES (1, '${new Date().toISOString()}');
    `);

    console.log("Migration v1 aplicada");
  }
}
