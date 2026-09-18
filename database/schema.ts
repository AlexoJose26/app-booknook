import {
  integer,
  primaryKey,
  sqliteTable,
  text,
} from "drizzle-orm/sqlite-core";

export const usuarios = sqliteTable("usuarios", {
  id: text("id").primaryKey(),

  nome: text("nome").notNull(),

  senha: text("senha").notNull(),

  foto_perfil: text("foto_perfil"),
});

export const livros = sqliteTable("livros", {
  id: text("id").primaryKey(),

  titulo: text("titulo").notNull(),

  autor: text("autor"),

  descricao: text("descricao"),

  imagem: text("imagem"),

  googleReaderLink: text("googleReaderLink"),
});


export const estantes = sqliteTable("estantes", {
  id: integer("id").primaryKey({ autoIncrement: true }),

  usuario_id: text("usuario_id")
    .notNull()
    .references(() => usuarios.id, {
      onDelete: "cascade",
    }),

  livro_id: text("livro_id")
    .notNull()
    .references(() => livros.id, {
      onDelete: "cascade",
    }),

  status: text("status").notNull(),

  createdAt: text("createdAt").notNull(),
});


export const criticas = sqliteTable("criticas", {
  id: integer("id").primaryKey({ autoIncrement: true }),

  usuario_id: text("usuario_id")
    .notNull()
    .references(() => usuarios.id, {
      onDelete: "cascade",
    }),

  livro_id: text("livro_id")
    .notNull()
    .references(() => livros.id, {
      onDelete: "cascade",
    }),

  texto: text("texto").notNull(),

  nota: integer("nota"),

  createdAt: text("createdAt").notNull(),
});


export const feed = sqliteTable("feed", {
  id: integer("id").primaryKey({ autoIncrement: true }),

  usuario_id: text("usuario_id")
    .notNull()
    .references(() => usuarios.id, {
      onDelete: "cascade",
    }),

  tipo: text("tipo").notNull(),

  livro_id: text("livro_id").references(() => livros.id, {
    onDelete: "cascade",
  }),

  critica_id: integer("critica_id").references(() => criticas.id, {
    onDelete: "cascade",
  }),

  createdAt: text("createdAt").notNull(),
});


export const comentarios = sqliteTable("comentarios", {
  id: integer("id").primaryKey({ autoIncrement: true }),

  usuario_id: text("usuario_id")
    .notNull()
    .references(() => usuarios.id, {
      onDelete: "cascade",
    }),

  critica_id: integer("critica_id")
    .notNull()
    .references(() => criticas.id, {
      onDelete: "cascade",
    }),

  texto: text("texto").notNull(),

  createdAt: text("createdAt").notNull(),
});



export const curtidas = sqliteTable(
  "curtidas",
  {
    usuario_id: text("usuario_id")
      .notNull()
      .references(() => usuarios.id, {
        onDelete: "cascade",
      }),

    critica_id: integer("critica_id")
      .notNull()
      .references(() => criticas.id, {
        onDelete: "cascade",
      }),

    createdAt: text("createdAt").notNull(),
  },
  (table) => ({
    pk: primaryKey({
      columns: [table.usuario_id, table.critica_id],
    }),
  })
);
