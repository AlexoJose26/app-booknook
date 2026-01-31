import { db } from "../db";
import { curtidas } from "../schema";
import { and, eq } from "drizzle-orm";

export async function toggleCurtida(usuarioId: string, criticaId: number) {
  const existe = await db
    .select()
    .from(curtidas)
    .where(
      and(
        eq(curtidas.usuario_id, usuarioId),
        eq(curtidas.critica_id, criticaId)
      )
    );

  if (existe.length) {
    await db.delete(curtidas).where(eq(curtidas.id, existe[0].id));
    return false;
  }

  await db.insert(curtidas).values({
    usuario_id: usuarioId,
    critica_id: criticaId,
  });

  return true;
}

export async function contarCurtidas(criticaId: number) {
  const res = await db
    .select()
    .from(curtidas)
    .where(eq(curtidas.critica_id, criticaId));

  return res.length;
}
