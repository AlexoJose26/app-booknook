import React, { createContext, useContext, useState, ReactNode, useEffect } from "react";
import { Alert } from "react-native";
import { db } from "@/database/db";
import { livros, estantes } from "@/database/schema";
import { eq } from "drizzle-orm";

export type Livro = {
  id: string;
  titulo: string;
  autor?: string;
  descricao?: string;
  imagem?: string;
  pdfUri?: string;
  status?: "lendo" | "queroLer" | "lido";
  createdAt?: string;
};

type EstantesState = {
  lendo: Livro[];
  queroLer: Livro[];
  lido: Livro[];
};

type LivrosContextType = {
  estantes: EstantesState;
  adicionarLivro: (livro: Livro, status: Livro["status"]) => Promise<void>;
  atualizarStatus: (livroId: string, novoStatus: Livro["status"]) => Promise<void>;
  carregarEstantes: () => Promise<void>;
};

const LivrosContext = createContext<LivrosContextType | undefined>(undefined);

// Usuário de teste
const USUARIO_ID = "1";

export const LivrosProvider = ({ children }: { children: ReactNode }) => {
  const [estantesState, setEstantesState] = useState<EstantesState>({
    lendo: [],
    queroLer: [],
    lido: [],
  });

  // Carregar livros do banco
  const carregarEstantes = async () => {
    try {
      const todasEstantes = await db
        .select({
          status: estantes.status,
          livroId: estantes.livro_id,
          titulo: livros.titulo,
          autor: livros.autor,
          descricao: livros.descricao,
          imagem: livros.imagem,
          pdfUri: livros.pdfUri,
          createdAt: estantes.createdAt,
        })
        .from(estantes)
        .innerJoin(livros, eq(estantes.livro_id, livros.id))
        .where(eq(estantes.usuario_id, USUARIO_ID));

      const novoState: EstantesState = { lendo: [], queroLer: [], lido: [] };

      todasEstantes.forEach((item) => {
        const livro: Livro = {
          id: item.livroId,
          titulo: item.titulo,
          autor: item.autor,
          descricao: item.descricao,
          imagem: item.imagem,
          pdfUri: item.pdfUri,
          status: item.status as Livro["status"],
          createdAt: item.createdAt,
        };
        if (livro.status) {
          novoState[livro.status].push(livro);
        }
      });

      setEstantesState(novoState);
    } catch (err) {
      console.error("Erro ao carregar estantes:", err);
    }
  };

  useEffect(() => {
    carregarEstantes();
  }, []);

  const adicionarLivro = async (livro: Livro, status: Livro["status"]) => {
    if (!status || !["lendo", "queroLer", "lido"].includes(status)) return;

    const idReal = livro.id ?? String(Date.now());
    const createdAt = new Date().toISOString();

    try {
      const livroExistente = await db.select().from(livros).where(eq(livros.id, idReal));

      if (livroExistente.length === 0) {
        await db.insert(livros).values({
          id: idReal,
          titulo: livro.titulo ?? "",
          autor: livro.autor ?? "",
          descricao: livro.descricao ?? "",
          imagem: livro.imagem ?? "",
          pdfUri: livro.pdfUri ?? "",
        });
      }

      await db.insert(estantes).values({
        usuario_id: USUARIO_ID,
        livro_id: idReal,
        status,
        createdAt,
      });

      setEstantesState((prev) => ({
        ...prev,
        [status]: [...prev[status], { ...livro, id: idReal, status, createdAt }],
      }));
    } catch (err) {
      console.error("Erro ao adicionar livro:", err);
      Alert.alert("Erro", "Não foi possível adicionar o livro à estante.");
    }
  };

  const atualizarStatus = async (livroId: string, novoStatus: Livro["status"]) => {
    if (!novoStatus) return;

    try {
      await db.update(estantes).set({ status: novoStatus }).where(eq(estantes.livro_id, livroId));

      setEstantesState((prev) => {
        const categorias: (keyof EstantesState)[] = ["lendo", "queroLer", "lido"];
        let livroAtual: Livro | undefined;
        const novoState: EstantesState = { lendo: [], queroLer: [], lido: [] };

        categorias.forEach((cat) => {
          const filtrados = prev[cat].filter((l) => {
            if (l.id === livroId) {
              livroAtual = { ...l, status: novoStatus };
              return false;
            }
            return true;
          });
          novoState[cat] = filtrados;
        });

        if (livroAtual) novoState[novoStatus] = [...novoState[novoStatus], livroAtual];

        return novoState;
      });
    } catch (err) {
      console.error("Erro ao atualizar status:", err);
      Alert.alert("Erro", "Não foi possível atualizar o status do livro.");
    }
  };

  return (
    <LivrosContext.Provider
      value={{ estantes: estantesState, adicionarLivro, atualizarStatus, carregarEstantes }}
    >
      {children}
    </LivrosContext.Provider>
  );
};

export const useLivros = () => {
  const context = useContext(LivrosContext);
  if (!context) throw new Error("useLivros deve ser usado dentro de LivrosProvider");
  return context;
};
