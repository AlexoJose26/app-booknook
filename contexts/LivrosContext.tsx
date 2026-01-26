import React, { createContext, useContext, useState, ReactNode, useEffect } from "react";
import { Alert } from "react-native";
import { db } from "@/database/db";
import { estantes, livros } from "@/database/schema";
import { eq } from "drizzle-orm";

export type Livro = {
  id: string;
  titulo: string;
  autor: string;
  descricao: string;
  imagem: string | null;
  status?: "Lidos" | "A Ler" | "Quero Ler";
  createdAt?: string; // timestamp
};

type EstantesMap = {
  [key in "Lidos" | "A Ler" | "Quero Ler"]: Livro[];
};

type LivrosContextType = {
  estantes: EstantesMap;
  adicionarLivro: (livro: Livro, status: Livro["status"]) => Promise<void>;
  carregarEstantes: () => Promise<void>;
};

const LivrosContext = createContext<LivrosContextType | undefined>(undefined);

export const LivrosProvider = ({ children }: { children: ReactNode }) => {
  const [estantesState, setEstantesState] = useState<EstantesMap>({
    "Lidos": [],
    "A Ler": [],
    "Quero Ler": [],
  });

  // Carrega livros das estantes do banco
  const carregarEstantes = async () => {
    const resultados: EstantesMap = {
      "Lidos": [],
      "A Ler": [],
      "Quero Ler": [],
    };

    for (const status of ["Lidos", "A Ler", "Quero Ler"] as Livro["status"][]) {
      const livrosStatus = await db
        .select({
          id: estantes.livro_id,
          titulo: livros.titulo,
          autor: livros.autor,
          descricao: livros.descricao,
          imagem: livros.imagem,
          createdAt: estantes.createdAt,
        })
        .from(estantes)
        .innerJoin(livros, eq(estantes.livro_id, livros.id))
        .where(eq(estantes.status, status));

      resultados[status] = livrosStatus.map((l: any) => ({ ...l, status, createdAt: l.createdAt }));
    }

    setEstantesState(resultados);
  };

  // Adiciona livro em uma estante, garantindo createdAt
  const adicionarLivro = async (livro: Livro, status: Livro["status"]) => {
    if (!status) return;

    const idReal = livro.id.split("-")[0]; // remove sufixo se houver
    const createdAt = new Date().toISOString();

    try {
      // 1️⃣ Salva livro na tabela livros se não existir
      const livroExistente = await db.select().from(livros).where(eq(livros.id, idReal));
      if (livroExistente.length === 0) {
        await db.insert(livros).values({
          id: idReal,
          titulo: livro.titulo,
          autor: livro.autor,
          descricao: livro.descricao,
          imagem: livro.imagem,
        });
      }

      // 2️⃣ Adiciona na estante com createdAt
      await db.insert(estantes).values({
        usuario_id: "usuario_logado", // substitua conforme seu fluxo de usuário
        livro_id: idReal,
        status,
        createdAt,
      });

      // 3️⃣ Atualiza o estado local
      setEstantesState((prev) => ({
        ...prev,
        [status]: [...prev[status], { ...livro, id: idReal, status, createdAt }],
      }));
    } catch (err) {
      console.error("Erro ao adicionar livro:", err);
      Alert.alert("Erro", "Não foi possível adicionar o livro.");
    }
  };

  useEffect(() => {
    carregarEstantes();
  }, []);

  return (
    <LivrosContext.Provider value={{ estantes: estantesState, adicionarLivro, carregarEstantes }}>
      {children}
    </LivrosContext.Provider>
  );
};

export const useLivros = () => {
  const context = useContext(LivrosContext);
  if (!context) throw new Error("useLivros deve ser usado dentro de LivrosProvider");
  return context;
};
