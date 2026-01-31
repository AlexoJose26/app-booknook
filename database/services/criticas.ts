import { db } from "../db";
import { criticas, livros, usuarios, feed } from "../schema";
import { eq, desc } from "drizzle-orm";

export async function criarCritica(
  usuario_id: string,
  livro_id: string,
  texto: string,
  nota?: number
) {
  const createdAt = new Date().toISOString();

  const [nova] = await db
    .insert(criticas)
    .values({ usuario_id, livro_id, texto, nota: nota ?? null, createdAt })
    .returning({ id: criticas.id });

  const livro = await db
    .select({ titulo: livros.titulo })
    .from(livros)
    .where(eq(livros.id, livro_id));

  await db.insert(feed).values({
    usuario_id,
    acao: "publicou uma crítica",
    livro_titulo: livro[0]?.titulo ?? "Livro",
    data: createdAt,
  });

  return nova;
}

export async function listarCriticas(livro_id: string) {
  return db
    .select({
      id: criticas.id,
      texto: criticas.texto,
      nota: criticas.nota,
      createdAt: criticas.createdAt,
      nome: usuarios.nome,
      foto_perfil: usuarios.foto_perfil,
    })
    .from(criticas)
    .innerJoin(usuarios, eq(criticas.usuario_id, usuarios.id))
    .where(eq(criticas.livro_id, livro_id))
    .orderBy(desc(criticas.createdAt));
}
