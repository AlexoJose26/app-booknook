import {
  createContext,
  ReactNode,
  useCallback,
  useContext,
  useEffect,
  useState,
} from "react";

import AsyncStorage from "@react-native-async-storage/async-storage";

import { getDb } from "@/database/db";

import { usuarios } from "@/database/schema";

import { eq } from "drizzle-orm";

export type Usuario = {
  id: string;
  nome: string;
  foto_perfil?: string | null;
};

type UsuarioContextType = {
  usuario: Usuario | null;
  setUsuario: (u: Usuario | null) => void;
  carregarUsuario: () => Promise<void>;
};

const UsuarioContext = createContext<UsuarioContextType | undefined>(
  undefined
);

export const UsuarioProvider = ({
  children,
}: {
  children: ReactNode;
}) => {
  const [usuario, setUsuario] = useState<Usuario | null>(null);

  /**
   * Garante que o usuário existente no AsyncStorage
   * também exista na tabela SQLite "usuarios".
   *
   * Isso é necessário porque estantes, criticas e feed
   * possuem uma chave estrangeira para usuarios.id.
   */
  const garantirUsuarioNoBanco = useCallback(
    async (usuarioAtual: Usuario): Promise<void> => {
      if (!usuarioAtual?.id) {
        throw new Error("O usuário não possui um ID válido.");
      }

      if (!usuarioAtual?.nome?.trim()) {
        throw new Error("O usuário não possui um nome válido.");
      }

      const database = await getDb();

      const usuarioExistente = await database
        .select({
          id: usuarios.id,
        })
        .from(usuarios)
        .where(eq(usuarios.id, usuarioAtual.id))
        .limit(1);

      if (usuarioExistente.length === 0) {
        await database.insert(usuarios).values({
          id: usuarioAtual.id,
          nome: usuarioAtual.nome.trim(),
          senha: "",
          foto_perfil: usuarioAtual.foto_perfil || null,
        });

        console.log(
          "Usuário sincronizado com o SQLite:",
          usuarioAtual.id
        );

        return;
      }

      /**
       * Mantém os dados básicos sincronizados.
       */
      await database
        .update(usuarios)
        .set({
          nome: usuarioAtual.nome.trim(),
          foto_perfil: usuarioAtual.foto_perfil || null,
        })
        .where(eq(usuarios.id, usuarioAtual.id));
    },
    []
  );

  /**
   * Carrega o usuário salvo no AsyncStorage
   * e garante sua existência no SQLite.
   */
  const carregarUsuario = useCallback(async () => {
    try {
      const json = await AsyncStorage.getItem("usuarioLogado");

      if (!json) {
        setUsuario(null);
        return;
      }

      let usuarioSalvo: Usuario;

      try {
        usuarioSalvo = JSON.parse(json);
      } catch (parseError) {
        console.error(
          "Erro ao interpretar usuário salvo:",
          parseError
        );

        await AsyncStorage.removeItem("usuarioLogado");
        setUsuario(null);

        return;
      }

      if (!usuarioSalvo?.id || !usuarioSalvo?.nome) {
        console.error(
          "Dados do usuário salvos no AsyncStorage são inválidos."
        );

        await AsyncStorage.removeItem("usuarioLogado");
        setUsuario(null);

        return;
      }

      const usuarioNormalizado: Usuario = {
        id: String(usuarioSalvo.id),
        nome: String(usuarioSalvo.nome),
        foto_perfil: usuarioSalvo.foto_perfil || null,
      };

      /**
       * Primeiro sincronizamos com SQLite.
       *
       * Só depois disponibilizamos o usuário
       * para os outros contextos.
       */
      await garantirUsuarioNoBanco(usuarioNormalizado);

      setUsuario(usuarioNormalizado);
    } catch (error) {
      console.error(
        "Erro ao carregar/sincronizar usuário:",
        error
      );

      setUsuario(null);
    }
  }, [garantirUsuarioNoBanco]);

  useEffect(() => {
    carregarUsuario();
  }, [carregarUsuario]);

  /**
   * Permite alterar o usuário em memória e mantém
   * o AsyncStorage sincronizado quando necessário.
   */
  const atualizarUsuario = useCallback(
    (novoUsuario: Usuario | null) => {
      setUsuario(novoUsuario);

      if (!novoUsuario) {
        AsyncStorage.removeItem("usuarioLogado").catch((error) => {
          console.error(
            "Erro ao remover usuário do AsyncStorage:",
            error
          );
        });

        return;
      }

      const usuarioNormalizado: Usuario = {
        id: String(novoUsuario.id),
        nome: String(novoUsuario.nome),
        foto_perfil: novoUsuario.foto_perfil || null,
      };

      AsyncStorage.setItem(
        "usuarioLogado",
        JSON.stringify(usuarioNormalizado)
      ).catch((error) => {
        console.error(
          "Erro ao salvar usuário no AsyncStorage:",
          error
        );
      });

      garantirUsuarioNoBanco(usuarioNormalizado).catch((error) => {
        console.error(
          "Erro ao sincronizar usuário com SQLite:",
          error
        );
      });
    },
    [garantirUsuarioNoBanco]
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

export const useUsuario = () => {
  const ctx = useContext(UsuarioContext);

  if (!ctx) {
    throw new Error(
      "useUsuario deve ser usado dentro de UsuarioProvider"
    );
  }

  return ctx;
};

