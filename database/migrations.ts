import { sqlite } from "./db";

export function runMigrations() {
  try {
    sqlite.execSync(`
      DROP TABLE IF EXISTS usuarios;
      DROP TABLE IF EXISTS livros;
      DROP TABLE IF EXISTS estantes;
      DROP TABLE IF EXISTS criticas;
    `);

    sqlite.execSync(`
      CREATE TABLE usuarios (
        id TEXT PRIMARY KEY,
        nome TEXT NOT NULL,
        senha TEXT NOT NULL,
        foto_perfil TEXT
      );
    `);

    sqlite.execSync(`
      CREATE TABLE livros (
        id TEXT PRIMARY KEY,
        titulo TEXT NOT NULL,
        autor TEXT,
        descricao TEXT,
        imagem TEXT,
        googleReaderLink TEXT
      );
    `);

    sqlite.execSync(`
      CREATE TABLE estantes (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        usuario_id TEXT NOT NULL,
        livro_id TEXT NOT NULL,
        status TEXT NOT NULL,
        createdAt TEXT NOT NULL
      );
    `);

    sqlite.execSync(`
      CREATE TABLE criticas (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        usuario_id TEXT NOT NULL,
        livro_id TEXT NOT NULL,
        texto TEXT NOT NULL,
        nota INTEGER,
        createdAt TEXT NOT NULL
      );
    `);

    console.log("Migrations executadas com sucesso");
  } catch (e) {
    console.error("Erro nas migrations:", e);
  }
}
