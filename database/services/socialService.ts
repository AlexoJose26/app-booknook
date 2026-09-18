import { and, count, desc, eq } from "drizzle-orm";

import { getDb } from "@/database/db";

import {
  comentarios,
  criticas,
  curtidas,
  feed,
  livros,
  usuarios,
} from "@/database/schema";

export type Comentario = {
  id: number;
  usuario_id: string;
  critica_id: number;
  texto: string;
  createdAt: string;
  usuario?: {
    id: string;
    nome: string;
    foto_perfil: string | null;
  } | null;
};

export type Curtida = {
  usuario_id: string;
  critica_id: number;
  createdAt: string;
};

export type FeedItem = {
  id: number;
  usuario_id: string;
  tipo: string;
  livro_id: string | null;
  critica_id: number | null;
  createdAt: string;
  usuario?: {
    id: string;
    nome: string;
    foto_perfil: string | null;
  } | null;
  livro?: {
    id: string;
    titulo: string;
    autor: string | null;
    imagem: string | null;
  } | null;
};

export type Usuario = {
  id: string;
  nome: string;
  foto_perfil: string | null;
};

export type EstatisticasCritica = {
  curtidas: number;
  comentarios: number;
  curtiu: boolean;
};

export async function criarComentario(
  usuarioId: string,
  criticaId: number,
  texto: string,
): Promise<Comentario> {
  const database = await getDb();

  const textoLimpo = texto.trim();

  if (!textoLimpo) {
    throw new Error("O comentário não pode estar vazio.");
  }

  const critica = await database
    .select({
      id: criticas.id,
    })
    .from(criticas)
    .where(eq(criticas.id, criticaId))
    .limit(1);

  if (!critica.length) {
    throw new Error("A crítica não existe.");
  }

  const usuario = await database
    .select({
      id: usuarios.id,
      nome: usuarios.nome,
      foto_perfil: usuarios.foto_perfil,
    })
    .from(usuarios)
    .where(eq(usuarios.id, usuarioId))
    .limit(1);

  if (!usuario.length) {
    throw new Error("Usuário não encontrado.");
  }

  const createdAt = new Date().toISOString();

  const resultado = await database
    .insert(comentarios)
    .values({
      usuario_id: usuarioId,
      critica_id: criticaId,
      texto: textoLimpo,
      createdAt,
    })
    .returning();

  const novo = resultado[0];

  if (!novo) {
    throw new Error("Não foi possível criar o comentário.");
  }

  return {
    ...novo,
    usuario: usuario[0],
  };
}

export async function listarComentarios(
  criticaId: number,
): Promise<Comentario[]> {
  const database = await getDb();

  const resultado = await database
    .select({
      id: comentarios.id,
      usuario_id: comentarios.usuario_id,
      critica_id: comentarios.critica_id,
      texto: comentarios.texto,
      createdAt: comentarios.createdAt,
      usuario: {
        id: usuarios.id,
        nome: usuarios.nome,
        foto_perfil: usuarios.foto_perfil,
      },
    })
    .from(comentarios)
    .leftJoin(
      usuarios,
      eq(comentarios.usuario_id, usuarios.id),
    )
    .where(eq(comentarios.critica_id, criticaId))
    .orderBy(desc(comentarios.createdAt));

  return resultado;
}

export async function contarComentarios(
  criticaId: number,
): Promise<number> {
  const database = await getDb();

  const resultado = await database
    .select({
      total: count(),
    })
    .from(comentarios)
    .where(eq(comentarios.critica_id, criticaId));

  return Number(resultado[0]?.total ?? 0);
}

export async function toggleCurtida(
  usuarioId: string,
  criticaId: number,
): Promise<boolean> {
  const database = await getDb();

  const existente = await database
    .select({
      usuario_id: curtidas.usuario_id,
      critica_id: curtidas.critica_id,
    })
    .from(curtidas)
    .where(
      and(
        eq(curtidas.usuario_id, usuarioId),
        eq(curtidas.critica_id, criticaId),
      ),
    )
    .limit(1);

  if (existente.length > 0) {
    await database
      .delete(curtidas)
      .where(
        and(
          eq(curtidas.usuario_id, usuarioId),
          eq(curtidas.critica_id, criticaId),
        ),
      );

    return false;
  }

  await database.insert(curtidas).values({
    usuario_id: usuarioId,
    critica_id: criticaId,
    createdAt: new Date().toISOString(),
  });

  return true;
}

export async function curtiuCritica(
  usuarioId: string,
  criticaId: number,
): Promise<boolean> {
  const database = await getDb();

  const resultado = await database
    .select({
      usuario_id: curtidas.usuario_id,
    })
    .from(curtidas)
    .where(
      and(
        eq(curtidas.usuario_id, usuarioId),
        eq(curtidas.critica_id, criticaId),
      ),
    )
    .limit(1);

  return resultado.length > 0;
}

export async function contarCurtidas(
  criticaId: number,
): Promise<number> {
  const database = await getDb();

  const resultado = await database
    .select({
      total: count(),
    })
    .from(curtidas)
    .where(eq(curtidas.critica_id, criticaId));

  return Number(resultado[0]?.total ?? 0);
}

export async function obterEstatisticasCritica(
  criticaId: number,
  usuarioId?: string,
): Promise<EstatisticasCritica> {
  const [totalCurtidas, totalComentarios] =
    await Promise.all([
      contarCurtidas(criticaId),
      contarComentarios(criticaId),
    ]);

  const curtiu = usuarioId
    ? await curtiuCritica(usuarioId, criticaId)
    : false;

  return {
    curtidas: totalCurtidas,
    comentarios: totalComentarios,
    curtiu,
  };
}

export async function listarFeed(): Promise<FeedItem[]> {
  const database = await getDb();

  const resultado = await database
    .select({
      id: feed.id,
      usuario_id: feed.usuario_id,
      tipo: feed.tipo,
      livro_id: feed.livro_id,
      critica_id: feed.critica_id,
      createdAt: feed.createdAt,
      usuario: {
        id: usuarios.id,
        nome: usuarios.nome,
        foto_perfil: usuarios.foto_perfil,
      },
      livro: {
        id: livros.id,
        titulo: livros.titulo,
        autor: livros.autor,
        imagem: livros.imagem,
      },
    })
    .from(feed)
    .leftJoin(
      usuarios,
      eq(feed.usuario_id, usuarios.id),
    )
    .leftJoin(
      livros,
      eq(feed.livro_id, livros.id),
    )
    .orderBy(desc(feed.createdAt));

  return resultado;
}

export async function criarFeedItem({
  usuario_id,
  tipo,
  livro_id,
  critica_id,
}: {
  usuario_id: string;
  tipo: string;
  livro_id?: string;
  critica_id?: number;
}): Promise<FeedItem> {
  const database = await getDb();

  const resultado = await database
    .insert(feed)
    .values({
      usuario_id,
      tipo,
      livro_id: livro_id ?? null,
      critica_id: critica_id ?? null,
      createdAt: new Date().toISOString(),
    })
    .returning();

  const novo = resultado[0];

  if (!novo) {
    throw new Error(
      "Não foi possível criar o item do Feed.",
    );
  }

  const feedCompleto = await database
    .select({
      id: feed.id,
      usuario_id: feed.usuario_id,
      tipo: feed.tipo,
      livro_id: feed.livro_id,
      critica_id: feed.critica_id,
      createdAt: feed.createdAt,
      usuario: {
        id: usuarios.id,
        nome: usuarios.nome,
        foto_perfil: usuarios.foto_perfil,
      },
      livro: {
        id: livros.id,
        titulo: livros.titulo,
        autor: livros.autor,
        imagem: livros.imagem,
      },
    })
    .from(feed)
    .leftJoin(
      usuarios,
      eq(feed.usuario_id, usuarios.id),
    )
    .leftJoin(
      livros,
      eq(feed.livro_id, livros.id),
    )
    .where(eq(feed.id, novo.id))
    .limit(1);

  if (!feedCompleto[0]) {
    throw new Error(
      "Não foi possível carregar o item criado.",
    );
  }

  return feedCompleto[0];
}

export async function atualizarFotoPerfil(
  usuarioId: string,
  fotoUri: string,
): Promise<Usuario | null> {
  const database = await getDb();

  await database
    .update(usuarios)
    .set({
      foto_perfil: fotoUri,
    })
    .where(eq(usuarios.id, usuarioId));

  return buscarUsuarioPorId(usuarioId);
}

export async function buscarUsuarioPorNome(
  nome: string,
): Promise<Usuario | null> {
  const nomeNormalizado = nome.trim();

  if (!nomeNormalizado) {
    return null;
  }

  const database = await getDb();

  const resultado = await database
    .select({
      id: usuarios.id,
      nome: usuarios.nome,
      foto_perfil: usuarios.foto_perfil,
    })
    .from(usuarios)
    .where(eq(usuarios.nome, nomeNormalizado))
    .limit(1);

  return resultado[0] ?? null;
}

export async function buscarUsuarioPorId(
  usuarioId: string,
): Promise<Usuario | null> {
  const database = await getDb();

  const resultado = await database
    .select({
      id: usuarios.id,
      nome: usuarios.nome,
      foto_perfil: usuarios.foto_perfil,
    })
    .from(usuarios)
    .where(eq(usuarios.id, usuarioId))
    .limit(1);

  return resultado[0] ?? null;
}

export async function criarUsuario(
  id: string,
  nome: string,
  senha: string,
): Promise<Usuario> {
  const nomeLimpo = nome.trim();

  if (!nomeLimpo) {
    throw new Error(
      "O nome do usuário é obrigatório.",
    );
  }

  const existente = await buscarUsuarioPorId(id);

  if (existente) {
    return existente;
  }

  const database = await getDb();

  const resultado = await database
    .insert(usuarios)
    .values({
      id,
      nome: nomeLimpo,
      senha,
      foto_perfil: "",
    })
    .returning({
      id: usuarios.id,
      nome: usuarios.nome,
      foto_perfil: usuarios.foto_perfil,
    });

  if (!resultado[0]) {
    throw new Error(
      "Não foi possível criar o usuário.",
    );
  }

  return resultado[0];
}
