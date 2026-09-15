import React, { createContext, useContext, useState, ReactNode } from "react";
import { db } from "@/database/db";
import { estantes, livros as livrosTable } from "@/database/schema";
import { eq } from "drizzle-orm";

export type Livro = {
  id: string;
  titulo: string;
  autor?: string;
  imagem?: string | null;
  googleReaderLink?: string | null;
};

type LivrosContextType = {
  livrosProcurar: Livro[];
  setLivrosProcurar: React.Dispatch<React.SetStateAction<Livro[]>>;
  adicionarLivroNaEstante: (livro: Livro, usuarioId: string) => Promise<void>;
};

const LivrosContext = createContext<LivrosContextType | undefined>(undefined);

export const LivrosProvider = ({ children }: { children: ReactNode }) => {
  const [livrosProcurar, setLivrosProcurar] = useState<Livro[]>([]);

  const adicionarLivroNaEstante = async (livro: Livro, usuarioId: string) => {

    const livroExistente = await db
      .select()
      .from(livrosTable)
      .where(eq(livrosTable.id, livro.id));

    if (!livroExistente.length) {
      await db.insert(livrosTable).values({
        id: livro.id,
        titulo: livro.titulo,
        autor: livro.autor,
        imagem: livro.imagem,
        googleReaderLink: livro.googleReaderLink,
      });
    }

    await db.insert(estantes).values({
      usuario_id: usuarioId,
      livro_id: livro.id,
      status: "queroLer",
      createdAt: new Date().toISOString(),
    });
  };

  return (
    <LivrosContext.Provider
      value={{ livrosProcurar, setLivrosProcurar, adicionarLivroNaEstante }}
    >
      {children}
    </LivrosContext.Provider>
  );
};

export const useLivros = () => {
  const context = useContext(LivrosContext);
  if (!context) throw new Error("useLivros must be used within LivrosProvider");
  return context;
};
