// database/schema.ts
import { sqliteTable, text, integer } from "drizzle-orm/sqlite-core";

/* ================= USUÁRIOS ================= */
export const usuarios = sqliteTable("usuarios", {
  id: text("id").primaryKey(),
  nome: text("nome").notNull(),
  senha: text("senha").notNull(),
  foto_perfil: text("foto_perfil"),
});

/* ================= LIVROS ================= */
export const livros = sqliteTable("livros", {
  id: text("id").primaryKey(),
  titulo: text("titulo").notNull(),
  autor: text("autor"),
  descricao: text("descricao"),
  imagem: text("imagem"),

  // 🔑 LINK REAL DE LEITURA (Google Books)
  googleReaderLink: text("googleReaderLink"),
});

/* ================= ESTANTES ================= */
export const estantes = sqliteTable("estantes", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  usuario_id: text("usuario_id").notNull(),
  livro_id: text("livro_id").notNull(),
  status: text("status").notNull(), // queroLer | lendo | lido
  createdAt: text("createdAt").notNull(),
});

/* ================= CRÍTICAS ================= */
export const criticas = sqliteTable("criticas", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  usuario_id: text("usuario_id").notNull(),
  livro_id: text("livro_id").notNull(),
  texto: text("texto").notNull(),
  nota: integer("nota"),
  createdAt: text("createdAt").notNull(),
});
