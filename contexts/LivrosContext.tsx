import React, {
  createContext,
  ReactNode,
  useCallback,
  useContext,
  useEffect,
  useState,
} from "react";

import { db } from "@/database/db";

import {
  estantes,
  livros as livrosTable,
  usuarios,
} from "@/database/schema";

import { and, eq } from "drizzle-orm";

import { useUsuario } from "@/contexts/UsuarioContext";

export type Livro = {
  id: string;
  titulo: string;
  autor?: string;
  imagem?: string | null;
  googleReaderLink?: string | null;
  descricao?: string | null;
  ano?: string | null;
  editora?: string | null;
  paginas?: number | null;
  categorias?: string[];
  fonte?: "google" | "openlibrary" | "demo" | string;
  fonteLabel?: string;
  previewLink?: string | null;
};

type LivrosContextType = {
  livrosProcurar: Livro[];

  setLivrosProcurar: React.Dispatch<
    React.SetStateAction<Livro[]>
  >;

  adicionarLivroNaEstante: (
    livro: Livro,
    usuarioId?: string
  ) => Promise<void>;

  adicionarLivro: (livro: Livro) => Promise<void>;

  verificarLivroNaEstante: (
    livroId: string
  ) => Promise<boolean>;

  removerLivroDaEstante: (
    livroId: string
  ) => Promise<void>;
};

const LivrosContext = createContext<
  LivrosContextType | undefined
>(undefined);

export const LivrosProvider = ({
  children,
}: {
  children: ReactNode;
}) => {
  const { usuario } = useUsuario();

  const [livrosProcurar, setLivrosProcurar] = useState<
    Livro[]
  >([]);

  const usuarioIdAtual = usuario?.id
    ? String(usuario.id)
    : null;

  /**
   * Garante que o usuário exista na tabela usuarios.
   *
   * A tabela estantes possui:
   *
   * estantes.usuario_id -> usuarios.id
   *
   * Portanto, não podemos inserir uma estante
   * antes de garantir que o usuário pai exista.
   */
  const garantirUsuarioNoBanco = useCallback(
    async (usuarioId: string): Promise<void> => {
      const id = String(usuarioId).trim();

      if (!id) {
        throw new Error(
          "O ID do usuário não é válido."
        );
      }

      const usuarioExistente = await db
        .select({
          id: usuarios.id,
          nome: usuarios.nome,
        })
        .from(usuarios)
        .where(eq(usuarios.id, id))
        .limit(1);

      /**
       * O usuário já existe.
       */
      if (usuarioExistente.length > 0) {
        return;
      }

      /**
       * O usuário existe na sessão, mas ainda não
       * existe no SQLite.
       *
       * Como senha é NOT NULL no schema, usamos
       * uma string vazia para o registro sincronizado.
       *
       * A autenticação continua sendo responsabilidade
       * do UsuarioContext.
       */
      const nomeUsuario =
        usuario?.id && String(usuario.id) === id
          ? usuario.nome?.trim() || "Utilizador"
          : "Utilizador";

      const fotoPerfil =
        usuario?.id && String(usuario.id) === id
          ? usuario.foto_perfil || null
          : null;

      await db
        .insert(usuarios)
        .values({
          id,
          nome: nomeUsuario,
          senha: "",
          foto_perfil: fotoPerfil,
        })
        .onConflictDoNothing({
          target: usuarios.id,
        });

      /**
       * Confirma que o usuário realmente ficou disponível.
       */
      const usuarioConfirmado = await db
        .select({
          id: usuarios.id,
        })
        .from(usuarios)
        .where(eq(usuarios.id, id))
        .limit(1);

      if (usuarioConfirmado.length === 0) {
        throw new Error(
          "Não foi possível sincronizar o usuário com o banco de dados."
        );
      }
    },
    [usuario]
  );

  /**
   * Garante que o livro principal exista na tabela livros.
   *
   * Livros provenientes do Google Books, Open Library
   * ou outras fontes podem ser armazenados usando
   * o mesmo modelo local.
   */
  const garantirLivroNoBanco = useCallback(
    async (livro: Livro): Promise<void> => {
      if (!livro?.id) {
        throw new Error(
          "O livro não possui um ID válido."
        );
      }

      const livroId = String(livro.id).trim();

      if (!livroId) {
        throw new Error(
          "O livro possui um ID vazio."
        );
      }

      if (!livro?.titulo?.trim()) {
        throw new Error(
          "O livro não possui um título válido."
        );
      }

      const livroExistente = await db
        .select({
          id: livrosTable.id,
        })
        .from(livrosTable)
        .where(eq(livrosTable.id, livroId))
        .limit(1);

      /**
       * O livro já existe.
       */
      if (livroExistente.length > 0) {
        return;
      }

      /**
       * Insere o livro principal antes de criar
       * a relação na estante.
       */
      await db
        .insert(livrosTable)
        .values({
          id: livroId,
          titulo: livro.titulo.trim(),
          autor: livro.autor?.trim() || null,
          descricao: livro.descricao?.trim() || null,
          imagem: livro.imagem || null,
          googleReaderLink:
            livro.googleReaderLink ||
            livro.previewLink ||
            null,
        })
        .onConflictDoNothing({
          target: livrosTable.id,
        });

      /**
       * Confirma que o livro realmente existe.
       */
      const livroConfirmado = await db
        .select({
          id: livrosTable.id,
        })
        .from(livrosTable)
        .where(eq(livrosTable.id, livroId))
        .limit(1);

      if (livroConfirmado.length === 0) {
        throw new Error(
          "Não foi possível guardar o livro no banco de dados."
        );
      }
    },
    []
  );

  /**
   * Verifica se um determinado livro já está
   * na estante do usuário atual.
   */
  const verificarLivroNaEstante = useCallback(
    async (
      livroId: string
    ): Promise<boolean> => {
      if (!usuarioIdAtual) {
        return false;
      }

      if (!livroId) {
        return false;
      }

      const idLivro = String(livroId).trim();

      if (!idLivro) {
        return false;
      }

      const existente = await db
        .select({
          id: estantes.id,
        })
        .from(estantes)
        .where(
          and(
            eq(
              estantes.usuario_id,
              usuarioIdAtual
            ),
            eq(
              estantes.livro_id,
              idLivro
            )
          )
        )
        .limit(1);

      return existente.length > 0;
    },
    [usuarioIdAtual]
  );

  /**
   * Adiciona um livro à estante do usuário.
   *
   * A ordem é proposital:
   *
   * 1. valida usuário
   * 2. garante usuário em usuarios
   * 3. garante livro em livros
   * 4. verifica duplicação
   * 5. cria relação em estantes
   */
  const adicionarLivroNaEstante = useCallback(
    async (
      livro: Livro,
      usuarioId?: string
    ): Promise<void> => {
      const idUsuario = (
        usuarioId ||
        usuarioIdAtual ||
        ""
      ).trim();

      if (!idUsuario) {
        throw new Error(
          "Nenhum utilizador autenticado foi encontrado. Faça login novamente."
        );
      }

      if (!livro?.id) {
        throw new Error(
          "Não foi possível identificar o livro."
        );
      }

      if (!livro?.titulo?.trim()) {
        throw new Error(
          "O livro selecionado não possui um título válido."
        );
      }

      const idLivro = String(livro.id).trim();

      if (!idLivro) {
        throw new Error(
          "O ID do livro é inválido."
        );
      }

      try {
        console.log(
          "[Livros] Preparando adição à estante..."
        );

        console.log(
          "[Livros] Usuário:",
          idUsuario
        );

        console.log(
          "[Livros] Livro:",
          idLivro
        );

        /**
         * PRIMEIRO:
         * garante o usuário pai.
         */
        await garantirUsuarioNoBanco(
          idUsuario
        );

        /**
         * SEGUNDO:
         * garante o livro pai.
         */
        await garantirLivroNoBanco(
          livro
        );

        /**
         * TERCEIRO:
         * confirmação adicional das duas chaves
         * antes de tocar na tabela estantes.
         */
        const usuarioConfirmado = await db
          .select({
            id: usuarios.id,
          })
          .from(usuarios)
          .where(eq(usuarios.id, idUsuario))
          .limit(1);

        if (usuarioConfirmado.length === 0) {
          throw new Error(
            "O usuário não foi encontrado no banco local."
          );
        }

        const livroConfirmado = await db
          .select({
            id: livrosTable.id,
          })
          .from(livrosTable)
          .where(eq(livrosTable.id, idLivro))
          .limit(1);

        if (livroConfirmado.length === 0) {
          throw new Error(
            "O livro não foi encontrado no banco local."
          );
        }

        /**
         * QUARTO:
         * verifica se a relação já existe.
         */
        const livroNaEstante = await db
          .select({
            id: estantes.id,
            status: estantes.status,
          })
          .from(estantes)
          .where(
            and(
              eq(
                estantes.usuario_id,
                idUsuario
              ),
              eq(
                estantes.livro_id,
                idLivro
              )
            )
          )
          .limit(1);

        /**
         * Se já estiver na estante, não cria
         * outra relação.
         */
        if (livroNaEstante.length > 0) {
          console.log(
            "[Livros] Livro já está na estante."
          );

          return;
        }

        /**
         * QUINTO:
         * agora podemos criar a relação.
         */
        await db
          .insert(estantes)
          .values({
            usuario_id: idUsuario,
            livro_id: idLivro,
            status: "queroLer",
            createdAt:
              new Date().toISOString(),
          })
          .onConflictDoNothing();

        /**
         * Confirma que a estante realmente recebeu
         * a relação.
         */
        const estanteConfirmada = await db
          .select({
            id: estantes.id,
            status: estantes.status,
          })
          .from(estantes)
          .where(
            and(
              eq(
                estantes.usuario_id,
                idUsuario
              ),
              eq(
                estantes.livro_id,
                idLivro
              )
            )
          )
          .limit(1);

        if (estanteConfirmada.length === 0) {
          throw new Error(
            "O livro não foi confirmado na estante."
          );
        }

        console.log(
          "[Livros] Livro adicionado com sucesso à estante."
        );
      } catch (error: any) {
        console.error(
          "Erro ao adicionar livro à estante:",
          error
        );

        const mensagem =
          error?.cause?.message ||
          error?.message ||
          "Não foi possível adicionar o livro à estante.";

        throw new Error(mensagem);
      }
    },
    [
      garantirLivroNoBanco,
      garantirUsuarioNoBanco,
      usuarioIdAtual,
    ]
  );

  /**
   * Atalho utilizado pela página Procurar.
   *
   * A página não precisa conhecer o ID do usuário.
   */
  const adicionarLivro = useCallback(
    async (livro: Livro): Promise<void> => {
      if (!usuarioIdAtual) {
        throw new Error(
          "Nenhum utilizador autenticado foi encontrado. Faça login novamente."
        );
      }

      await adicionarLivroNaEstante(
        livro,
        usuarioIdAtual
      );
    },
    [
      adicionarLivroNaEstante,
      usuarioIdAtual,
    ]
  );

  /**
   * Remove somente a relação do livro com
   * a estante do usuário atual.
   *
   * O livro principal permanece em livros.
   */
  const removerLivroDaEstante = useCallback(
    async (
      livroId: string
    ): Promise<void> => {
      if (!usuarioIdAtual) {
        throw new Error(
          "Nenhum utilizador autenticado foi encontrado."
        );
      }

      if (!livroId) {
        throw new Error(
          "ID do livro inválido."
        );
      }

      const idLivro = String(livroId).trim();

      if (!idLivro) {
        throw new Error(
          "ID do livro inválido."
        );
      }

      try {
        await db
          .delete(estantes)
          .where(
            and(
              eq(
                estantes.usuario_id,
                usuarioIdAtual
              ),
              eq(
                estantes.livro_id,
                idLivro
              )
            )
          );

        console.log(
          "[Livros] Livro removido da estante:",
          idLivro
        );
      } catch (error: any) {
        console.error(
          "Erro ao remover livro da estante:",
          error
        );

        const mensagem =
          error?.cause?.message ||
          error?.message ||
          "Não foi possível remover o livro da estante.";

        throw new Error(mensagem);
      }
    },
    [usuarioIdAtual]
  );

  /**
   * Limpa os resultados da pesquisa quando
   * o usuário muda.
   */
  useEffect(() => {
    setLivrosProcurar([]);
  }, [usuarioIdAtual]);

  return (
    <LivrosContext.Provider
      value={{
        livrosProcurar,
        setLivrosProcurar,
        adicionarLivroNaEstante,
        adicionarLivro,
        verificarLivroNaEstante,
        removerLivroDaEstante,
      }}
    >
      {children}
    </LivrosContext.Provider>
  );
};

export const useLivros = () => {
  const context = useContext(
    LivrosContext
  );

  if (!context) {
    throw new Error(
      "useLivros deve ser usado dentro de LivrosProvider"
    );
  }

  return context;
};

