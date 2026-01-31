import { db } from "../db";
import { comentarios } from "../schema";
import { eq, desc } from "drizzle-orm";

export async function criarComentario(
  usuarioId: string,
  criticaId: number,
  texto: string
) {
  const createdAt = new Date().toISOString();

  const [novo] = await db
    .insert(comentarios)
    .values({
      usuario_id: usuarioId,
      critica_id: criticaId,
      texto,
      createdAt,
    })
    .returning();

  return novo;
}

export async function listarComentarios(criticaId: number) {
  return db
    .select()
    .from(comentarios)
    .where(eq(comentarios.critica_id, criticaId))
    .orderBy(desc(comentarios.createdAt));
}
