import { db } from "./db";
import { usuarios } from "./schema";
import { eq } from "drizzle-orm";

export async function atualizarFotoPerfil(
  usuarioId: string,
  fotoUri: string
) {
  await db
    .update(usuarios)
    .set({ foto_perfil: fotoUri })
    .where(eq(usuarios.id, usuarioId));
}
