import React, { createContext, useContext, useEffect, useState } from "react";
import { db } from "@/database/db";
import { livros, estantes } from "@/database/schema";
import { eq } from "drizzle-orm";
import { useUsuario } from "./UsuarioContext";

export type Livro = {
  id: string;
  titulo: string;
  autor?: string;
  descricao?: string;
  imagem?: string;
  googleReaderLink?: string;
  status?: "queroLer" | "lendo" | "lido";
};

type EstantesMap = {
  queroLer: Livro[];
  lendo: Livro[];
  lido: Livro[];
};

type LivrosContextData = {
  estantes: EstantesMap;
  adicionarLivro: (livro: Livro, status: Livro["status"]) => Promise<void>;
  marcarComoLido: (livroId: string) => Promise<void>;
};

const LivrosContext = createContext({} as LivrosContextData);

export function LivrosProvider({ children }: { children: React.ReactNode }) {
  const { usuario } = useUsuario();
  const [estantesState, setEstantesState] = useState<EstantesMap>({
    queroLer: [],
    lendo: [],
    lido: [],
  });

  async function carregarEstantes() {
    if (!usuario) return;

    const rows = await db
      .select()
      .from(estantes)
      .where(eq(estantes.usuario_id, usuario.id));

    const livrosDB = await db.select().from(livros);

    const map: EstantesMap = { queroLer: [], lendo: [], lido: [] };

    rows.forEach((e) => {
      const livro = livrosDB.find((l) => l.id === e.livro_id);
      if (livro) map[e.status as keyof EstantesMap].push({ ...livro, status: e.status as any });
    });

    setEstantesState(map);
  }

  async function adicionarLivro(livro: Livro, status: Livro["status"]) {
    if (!usuario || !status) return;

    await db.insert(livros).values({
      id: livro.id,
      titulo: livro.titulo,
      autor: livro.autor,
      descricao: livro.descricao,
      imagem: livro.imagem,
      googleReaderLink: livro.googleReaderLink,
    }).onConflictDoNothing();

    await db.insert(estantes).values({
      usuario_id: usuario.id,
      livro_id: livro.id,
      status,
      createdAt: new Date().toISOString(),
    });

    carregarEstantes();
  }

  async function marcarComoLido(livroId: string) {
    await db
      .update(estantes)
      .set({ status: "lido" })
      .where(eq(estantes.livro_id, livroId));

    carregarEstantes();
  }

  useEffect(() => {
    carregarEstantes();
  }, [usuario]);

  return (
    <LivrosContext.Provider value={{ estantes: estantesState, adicionarLivro, marcarComoLido }}>
      {children}
    </LivrosContext.Provider>
  );
}

export const useLivros = () => useContext(LivrosContext);
