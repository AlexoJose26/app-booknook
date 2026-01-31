import React, {
  createContext,
  useContext,
  useState,
  ReactNode,
  useEffect,
} from "react";
import { Alert } from "react-native";
import { db } from "@/database/db";
import { livros, estantes } from "@/database/schema";
import { eq, and } from "drizzle-orm";
import { useUsuario } from "./UserContext";

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
  adicionarLivro: (
    livro: Livro,
    status: Livro["status"]
  ) => Promise<void>;
  atualizarStatus: (
    livroId: string,
    novoStatus: Livro["status"]
  ) => Promise<void>;
  carregarEstantes: () => Promise<void>;
};

const LivrosContext = createContext<LivrosContextType | undefined>(
  undefined
);

export const LivrosProvider = ({ children }: { children: ReactNode }) => {
  const { usuario } = useUsuario();

  const [estantesState, setEstantesState] = useState<EstantesState>({
    lendo: [],
    queroLer: [],
    lido: [],
  });

  // 🔄 carregar estantes do usuário
  const carregarEstantes = async () => {
    if (!usuario) return;

    try {
      const resultado = await db
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
        .where(eq(estantes.usuario_id, usuario.id));

      const novoState: EstantesState = {
        lendo: [],
        queroLer: [],
        lido: [],
      };

      resultado.forEach((item) => {
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
  }, [usuario]);

  // ➕ adicionar livro
  const adicionarLivro = async (
    livro: Livro,
    status: Livro["status"]
  ) => {
    if (!usuario || !status) return;

    const livroId = livro.id ?? String(Date.now());
    const createdAt = new Date().toISOString();

    try {
      const existente = await db
        .select()
        .from(livros)
        .where(eq(livros.id, livroId));

      if (existente.length === 0) {
        await db.insert(livros).values({
          id: livroId,
          titulo: livro.titulo,
          autor: livro.autor ?? "",
          descricao: livro.descricao ?? "",
          imagem: livro.imagem ?? "",
          pdfUri: livro.pdfUri ?? "",
        });
      }

      await db.insert(estantes).values({
        usuario_id: usuario.id,
        livro_id: livroId,
        status,
        createdAt,
      });

      setEstantesState((prev) => ({
        ...prev,
        [status]: [
          ...prev[status],
          { ...livro, id: livroId, status, createdAt },
        ],
      }));
    } catch (err) {
      console.error("Erro ao adicionar livro:", err);
      Alert.alert("Erro", "Não foi possível adicionar o livro.");
    }
  };

  // 🔁 atualizar status
  const atualizarStatus = async (
    livroId: string,
    novoStatus: Livro["status"]
  ) => {
    if (!usuario || !novoStatus) return;

    try {
      await db
        .update(estantes)
        .set({ status: novoStatus })
        .where(
          and(
            eq(estantes.usuario_id, usuario.id),
            eq(estantes.livro_id, livroId)
          )
        );

      setEstantesState((prev) => {
        const novoState: EstantesState = {
          lendo: [],
          queroLer: [],
          lido: [],
        };

        let livroMovido: Livro | null = null;

        (Object.keys(prev) as (keyof EstantesState)[]).forEach(
          (cat) => {
            prev[cat].forEach((livro) => {
              if (livro.id === livroId) {
                livroMovido = {
                  ...livro,
                  status: novoStatus,
                };
              } else {
                novoState[cat].push(livro);
              }
            });
          }
        );

        if (livroMovido) {
          novoState[novoStatus].push(livroMovido);
        }

        return novoState;
      });
    } catch (err) {
      console.error("Erro ao atualizar status:", err);
      Alert.alert("Erro", "Não foi possível atualizar o status.");
    }
  };

  return (
    <LivrosContext.Provider
      value={{
        estantes: estantesState,
        adicionarLivro,
        atualizarStatus,
        carregarEstantes,
      }}
    >
      {children}
    </LivrosContext.Provider>
  );
};

export const useLivros = () => {
  const context = useContext(LivrosContext);
  if (!context) {
    throw new Error("useLivros deve ser usado dentro de LivrosProvider");
  }
  return context;
};
