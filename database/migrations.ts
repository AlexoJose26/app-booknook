import { sqlite } from "./db";

export function runMigrations() {
  try {
    sqlite.execSync(`
      PRAGMA foreign_keys = OFF;

      DROP TABLE IF EXISTS feed;
      DROP TABLE IF EXISTS criticas;
      DROP TABLE IF EXISTS estantes;
      DROP TABLE IF EXISTS livros;
      DROP TABLE IF EXISTS usuarios;

      PRAGMA foreign_keys = ON;
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
        createdAt TEXT NOT NULL,
        UNIQUE (usuario_id, livro_id),
        FOREIGN KEY (usuario_id)
          REFERENCES usuarios(id)
          ON DELETE CASCADE,
        FOREIGN KEY (livro_id)
          REFERENCES livros(id)
          ON DELETE CASCADE
      );
    `);


    sqlite.execSync(`
      CREATE TABLE criticas (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        usuario_id TEXT NOT NULL,
        livro_id TEXT NOT NULL,
        texto TEXT NOT NULL,
        nota INTEGER,
        createdAt TEXT NOT NULL,
        FOREIGN KEY (usuario_id)
          REFERENCES usuarios(id)
          ON DELETE CASCADE,
        FOREIGN KEY (livro_id)
          REFERENCES livros(id)
          ON DELETE CASCADE
      );
    `);


    sqlite.execSync(`
      CREATE TABLE feed (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        usuario_id TEXT NOT NULL,
        tipo TEXT NOT NULL,
        livro_id TEXT,
        critica_id INTEGER,
        createdAt TEXT NOT NULL,
        FOREIGN KEY (usuario_id)
          REFERENCES usuarios(id)
          ON DELETE CASCADE,
        FOREIGN KEY (livro_id)
          REFERENCES livros(id)
          ON DELETE CASCADE,
        FOREIGN KEY (critica_id)
          REFERENCES criticas(id)
          ON DELETE CASCADE
      );
    `);

    console.log("Migrations executadas com sucesso!");
  } catch (e) {
    console.error("Erro nas migrations:", e);
  }
}
