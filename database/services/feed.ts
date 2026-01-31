import { db } from "../db";
import { feed } from "../schema";
import { desc } from "drizzle-orm";

export async function listarFeed() {
  return db.select().from(feed).orderBy(desc(feed.createdAt));
}

export async function criarFeedItem({
  usuario_id,
  acao,
  livro_titulo,
  critica_id,
}: {
  usuario_id: string;
  acao: string;
  livro_titulo?: string;
  critica_id?: number;
}) {
  await db.insert(feed).values({
    usuario_id,
    acao,
    livro_titulo,
    critica_id,
    createdAt: new Date().toISOString(),
  });
}
