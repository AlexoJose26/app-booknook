import {
  createContext,
  ReactNode,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";

import AsyncStorage from "@react-native-async-storage/async-storage";

import {
  obterUsuarioAtual,
  UsuarioAPI,
} from "@/database/services/api";

export type Usuario = {
  id: string;
  nome: string;
  foto_perfil?: string | null;
  createdAt?: string;
};

type UsuarioContextType = {
  usuario: Usuario | null;
  setUsuario: (u: Usuario | null) => void;
  carregarUsuario: () => Promise<void>;
};

const UsuarioContext =
  createContext<UsuarioContextType | undefined>(
    undefined,
  );

export const UsuarioProvider = ({
  children,
}: {
  children: ReactNode;
}) => {
  const [usuario, setUsuarioInterno] =
    useState<Usuario | null>(null);

  /**
   * Evita duas validações simultâneas da sessão.
   */
  const validandoSessaoRef = useRef(false);

  /**
   * Evita atualizar estado depois de o Provider
   * ter sido desmontado.
   */
  const montadoRef = useRef(false);

  /**
   * =========================================================
   * NORMALIZAR UTILIZADOR
   * =========================================================
   */
  const normalizarUsuario = useCallback(
    (usuarioApi: UsuarioAPI): Usuario => {
      return {
        id: String(usuarioApi.id),
        nome: String(usuarioApi.nome),
        foto_perfil:
          usuarioApi.foto_perfil ?? null,
        createdAt: usuarioApi.createdAt,
      };
    },
    [],
  );

  /**
   * =========================================================
   * UTILIZADOR LOCAL
   * =========================================================
   *
   * É usado apenas como fallback visual quando a API
   * estiver temporariamente indisponível.
   */
  const carregarUsuarioLocal = useCallback(
    async (): Promise<Usuario | null> => {
      try {
        const usuarioLocal =
          await AsyncStorage.getItem(
            "usuarioLogado",
          );

        if (!usuarioLocal) {
          return null;
        }

        const usuarioParseado =
          JSON.parse(usuarioLocal) as Partial<Usuario>;

        if (
          !usuarioParseado?.id ||
          !usuarioParseado?.nome
        ) {
          return null;
        }

        return {
          id: String(usuarioParseado.id),
          nome: String(usuarioParseado.nome),
          foto_perfil:
            usuarioParseado.foto_perfil ?? null,
          createdAt:
            usuarioParseado.createdAt,
        };
      } catch {
        return null;
      }
    },
    [],
  );

  /**
   * =========================================================
   * IDENTIFICAR ERRO DE AUTENTICAÇÃO
   * =========================================================
   *
   * A API pode devolver mensagens diferentes dependendo
   * da situação. Só removemos o token quando temos indícios
   * de que a sessão realmente deixou de ser válida.
   */
  const sessaoInvalida = useCallback(
    (error: unknown): boolean => {
      const mensagem =
        error instanceof Error
          ? error.message
          : String(error ?? "");

      const texto = mensagem.toLowerCase();

      return (
        texto.includes("401") ||
        texto.includes("não autorizado") ||
        texto.includes("nao autorizado") ||
        texto.includes("unauthorized") ||
        texto.includes("token inválido") ||
        texto.includes("token invalido") ||
        texto.includes("token expirado") ||
        texto.includes("sessão inválida") ||
        texto.includes("sessao invalida") ||
        texto.includes("sessão expirada") ||
        texto.includes("sessao expirada")
      );
    },
    [],
  );

  /**
   * =========================================================
   * CARREGAR UTILIZADOR
   * =========================================================
   */
  const carregarUsuario = useCallback(async () => {
    if (validandoSessaoRef.current) {
      return;
    }

    validandoSessaoRef.current = true;

    try {
      const token =
        await AsyncStorage.getItem(
          "authToken",
        );

      /**
       * Não existe sessão autenticada.
       */
      if (!token?.trim()) {
        if (montadoRef.current) {
          setUsuarioInterno(null);
        }

        return;
      }

      /**
       * Primeiro tentamos validar a sessão na API.
       */
      try {
        const resposta =
          await obterUsuarioAtual(token);

        /**
         * A API respondeu, mas não forneceu
         * um utilizador válido.
         */
        if (
          !resposta?.success ||
          !resposta?.user
        ) {
          if (montadoRef.current) {
            setUsuarioInterno(null);
          }

          return;
        }

        const usuarioNormalizado =
          normalizarUsuario(
            resposta.user,
          );

        /**
         * Guardamos os dados mais recentes
         * localmente.
         */
        await AsyncStorage.setItem(
          "usuarioLogado",
          JSON.stringify({
            ...usuarioNormalizado,
            perfilAtualizadoEm:
              Date.now(),
          }),
        );

        if (montadoRef.current) {
          setUsuarioInterno(
            (anterior) => {
              if (
                anterior?.id ===
                usuarioNormalizado.id &&
                anterior.nome ===
                usuarioNormalizado.nome &&
                anterior.foto_perfil ===
                usuarioNormalizado.foto_perfil &&
                anterior.createdAt ===
                usuarioNormalizado.createdAt
              ) {
                return anterior;
              }

              return usuarioNormalizado;
            },
          );
        }

        return;
      } catch (error) {
        /**
         * =====================================================
         * SESSÃO REALMENTE INVÁLIDA
         * =====================================================
         */
        if (sessaoInvalida(error)) {
          await AsyncStorage.removeItem(
            "authToken",
          );

          await AsyncStorage.removeItem(
            "usuarioLogado",
          );

          if (montadoRef.current) {
            setUsuarioInterno(null);
          }

          /**
           * Não usamos console.error aqui.
           * Uma sessão expirada é uma situação normal
           * que pode acontecer numa aplicação autenticada.
           */
          return;
        }

        /**
         * =====================================================
         * ERRO TEMPORÁRIO DA API
         * =====================================================
         *
         * Não apagamos o token.
         *
         * Tentamos usar os dados locais para que o aplicativo
         * continue a apresentar o utilizador enquanto a API
         * estiver temporariamente indisponível.
         */
        const usuarioLocal =
          await carregarUsuarioLocal();

        if (
          usuarioLocal &&
          montadoRef.current
        ) {
          setUsuarioInterno(
            usuarioLocal,
          );
        }

        /**
         * Não usamos console.error.
         *
         * Também evitamos imprimir o objeto Error inteiro,
         * que era responsável pela mensagem:
         *
         * ERROR UsuarioContext:
         * erro ao validar sessão: [Error: NOT_FOUND]
         */
        return;
      }
    } catch {
      /**
       * Falha inesperada ao carregar a sessão.
       *
       * Não eliminamos automaticamente o token porque
       * uma falha local/temporária não significa que a
       * sessão tenha expirado.
       */
      const usuarioLocal =
        await carregarUsuarioLocal();

      if (
        usuarioLocal &&
        montadoRef.current
      ) {
        setUsuarioInterno(
          usuarioLocal,
        );
      }
    } finally {
      validandoSessaoRef.current = false;
    }
  }, [
    carregarUsuarioLocal,
    normalizarUsuario,
    sessaoInvalida,
  ]);

  /**
   * =========================================================
   * INICIALIZAÇÃO
   * =========================================================
   */
  useEffect(() => {
    montadoRef.current = true;

    carregarUsuario();

    return () => {
      montadoRef.current = false;
    };
  }, [carregarUsuario]);

  /**
   * =========================================================
   * ATUALIZAR UTILIZADOR
   * =========================================================
   */
  const atualizarUsuario = useCallback(
    (novoUsuario: Usuario | null) => {
      /**
       * Atualiza imediatamente a memória.
       */
      setUsuarioInterno(novoUsuario);

      /**
       * Se o utilizador foi removido, limpa a
       * cópia local.
       */
      if (!novoUsuario) {
        AsyncStorage.removeItem(
          "usuarioLogado",
        ).catch(() => {
          /**
           * Não mostramos ERROR aqui.
           *
           * A remoção do cache local não deve
           * interromper o funcionamento do app.
           */
        });

        return;
      }

      /**
       * Normaliza os dados antes de guardar.
       */
      const usuarioNormalizado: Usuario = {
        id: String(novoUsuario.id),
        nome: String(novoUsuario.nome),
        foto_perfil:
          novoUsuario.foto_perfil ?? null,
        createdAt:
          novoUsuario.createdAt,
      };

      AsyncStorage.setItem(
        "usuarioLogado",
        JSON.stringify({
          ...usuarioNormalizado,
          perfilAtualizadoEm:
            Date.now(),
        }),
      ).catch(() => {
        /**
         * Falha no cache local não deve gerar
         * ERROR no console nem quebrar a aplicação.
         */
      });
    },
    [],
  );

  return (
    <UsuarioContext.Provider
      value={{
        usuario,
        setUsuario: atualizarUsuario,
        carregarUsuario,
      }}
    >
      {children}
    </UsuarioContext.Provider>
  );
};

/**
 * ===========================================================
 * HOOK
 * ===========================================================
 */
export const useUsuario = () => {
  const ctx = useContext(
    UsuarioContext,
  );

  if (!ctx) {
    throw new Error(
      "useUsuario deve ser usado dentro de UsuarioProvider",
    );
  }

  return ctx;
};
