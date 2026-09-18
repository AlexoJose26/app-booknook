import * as SQLite from "expo-sqlite";

export async function runMigrations(
  database: SQLite.SQLiteDatabase
): Promise<void> {
  if (!database) {
    throw new Error(
      "Banco de dados não foi fornecido para executar as migrations."
    );
  }

  try {
    await database.execAsync(`
      PRAGMA foreign_keys = ON;

      CREATE TABLE IF NOT EXISTS usuarios (
        id TEXT PRIMARY KEY,
        nome TEXT NOT NULL,
        senha TEXT NOT NULL,
        foto_perfil TEXT
      );

      CREATE TABLE IF NOT EXISTS livros (
        id TEXT PRIMARY KEY,
        titulo TEXT NOT NULL,
        autor TEXT,
        descricao TEXT,
        imagem TEXT,
        googleReaderLink TEXT
      );

      CREATE TABLE IF NOT EXISTS estantes (
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

      CREATE TABLE IF NOT EXISTS criticas (
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

      CREATE TABLE IF NOT EXISTS feed (
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

      CREATE TABLE IF NOT EXISTS comentarios (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        usuario_id TEXT NOT NULL,
        critica_id INTEGER NOT NULL,
        texto TEXT NOT NULL,
        createdAt TEXT NOT NULL,
        FOREIGN KEY (usuario_id)
          REFERENCES usuarios(id)
          ON DELETE CASCADE,
        FOREIGN KEY (critica_id)
          REFERENCES criticas(id)
          ON DELETE CASCADE
      );

      CREATE TABLE IF NOT EXISTS curtidas (
        usuario_id TEXT NOT NULL,
        critica_id INTEGER NOT NULL,
        createdAt TEXT NOT NULL,
        PRIMARY KEY (usuario_id, critica_id),
        FOREIGN KEY (usuario_id)
          REFERENCES usuarios(id)
          ON DELETE CASCADE,
        FOREIGN KEY (critica_id)
          REFERENCES criticas(id)
          ON DELETE CASCADE
      );

      CREATE INDEX IF NOT EXISTS idx_estantes_usuario
        ON estantes(usuario_id);

      CREATE INDEX IF NOT EXISTS idx_estantes_livro
        ON estantes(livro_id);

      CREATE INDEX IF NOT EXISTS idx_criticas_usuario
        ON criticas(usuario_id);

      CREATE INDEX IF NOT EXISTS idx_criticas_livro
        ON criticas(livro_id);

      CREATE INDEX IF NOT EXISTS idx_feed_usuario
        ON feed(usuario_id);

      CREATE INDEX IF NOT EXISTS idx_feed_critica
        ON feed(critica_id);

      CREATE INDEX IF NOT EXISTS idx_feed_livro
        ON feed(livro_id);

      CREATE INDEX IF NOT EXISTS idx_comentarios_critica
        ON comentarios(critica_id);

      CREATE INDEX IF NOT EXISTS idx_comentarios_usuario
        ON comentarios(usuario_id);

      CREATE INDEX IF NOT EXISTS idx_curtidas_critica
        ON curtidas(critica_id);

      CREATE INDEX IF NOT EXISTS idx_curtidas_usuario
        ON curtidas(usuario_id);
    `);

    console.log("Banco de dados inicializado com sucesso.");
  } catch (error) {
    console.error("Erro nas migrations:", error);
    throw error;
  }
}
