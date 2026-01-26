import { db } from "./db";
import {
  criticas,
  feed,
  livros,
  estantes,
  likes,
  comentarios,
  usuarios,
} from "./schema";
import { eq, desc, and } from "drizzle-orm";

/* =======================
   CRIAR CRÍTICA
======================= */
export async function criarCritica(
  usuario_id: string,
  livro_id: string,
  texto: string,
  nota?: number
) {
  const data = new Date().toISOString();

  const [nova] = await db
    .insert(criticas)
    .values({ usuario_id, livro_id, texto, nota, createdAt: data })
    .returning({ id: criticas.id });

  const livro = await db
    .select({ titulo: livros.titulo })
    .from(livros)
    .where(eq(livros.id, livro_id));

  await db.insert(feed).values({
    usuario_id,
    acao: "publicou uma crítica",
    livro_titulo: livro[0]?.titulo ?? "Livro",
    data,
  });

  return nova;
}

/* =======================
   LISTAR CRÍTICAS
======================= */
export async function listarCriticas(livro_id: string) {
  return db
    .select({
      id: criticas.id,
      texto: criticas.texto,
      nota: criticas.nota,
      createdAt: criticas.createdAt,
      nome: usuarios.nome,
    })
    .from(criticas)
    .innerJoin(usuarios, eq(criticas.usuario_id, usuarios.id))
    .where(eq(criticas.livro_id, livro_id))
    .orderBy(desc(criticas.createdAt));
}

/* =======================
   TOGGLE LIKE
======================= */
export async function toggleLike(usuario_id: string, critica_id: number) {
  const existente = await db
    .select()
    .from(likes)
    .where(
      and(
        eq(likes.usuario_id, usuario_id),
        eq(likes.critica_id, critica_id)
      )
    );

  if (existente.length) {
    await db.delete(likes).where(eq(likes.id, existente[0].id));
    return false;
  }

  await db.insert(likes).values({
    usuario_id,
    critica_id,
    createdAt: new Date().toISOString(),
  });

  return true;
}

/* =======================
   CONTAR LIKES
======================= */
export async function contarLikes(critica_id: number) {
  const res = await db
    .select()
    .from(likes)
    .where(eq(likes.critica_id, critica_id));

  return res.length;
}

/* =======================
   COMENTÁRIOS
======================= */
export async function criarComentario(
  usuario_id: string,
  critica_id: number,
  texto: string
) {
  return db.insert(comentarios).values({
    usuario_id,
    critica_id,
    texto,
    createdAt: new Date().toISOString(),
  });
}

export async function listarComentarios(critica_id: number) {
  return db
    .select({
      id: comentarios.id,
      texto: comentarios.texto,
      createdAt: comentarios.createdAt,
      nome: usuarios.nome,
    })
    .from(comentarios)
    .innerJoin(usuarios, eq(comentarios.usuario_id, usuarios.id))
    .where(eq(comentarios.critica_id, critica_id))
    .orderBy(desc(comentarios.createdAt));
}
