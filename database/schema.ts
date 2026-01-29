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
  pdfUri: text("pdfUri"),
});

/* ================= ESTANTES ================= */
export const estantes = sqliteTable("estantes", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  usuario_id: text("usuario_id").notNull(),
  livro_id: text("livro_id").notNull(),
  status: text("status").notNull(), // lendo | queroLer | lido
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

/* ================= LIKES ================= */
export const likes = sqliteTable("likes", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  usuario_id: text("usuario_id").notNull(),
  critica_id: integer("critica_id").notNull(),
  createdAt: text("createdAt").notNull(),
});

/* ================= COMENTÁRIOS ================= */
export const comentarios = sqliteTable("comentarios", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  usuario_id: text("usuario_id").notNull(),
  critica_id: integer("critica_id").notNull(),
  texto: text("texto").notNull(),
  createdAt: text("createdAt").notNull(),
});

/* ================= FEED ================= */
export const feed = sqliteTable("feed", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  usuario_id: text("usuario_id").notNull(),
  acao: text("acao").notNull(),
  livro_titulo: text("livro_titulo").notNull(),
  data: text("data").notNull(),
});
