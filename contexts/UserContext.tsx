
import React, {
  createContext,
  useContext,
  useState,
  ReactNode,
  useEffect,
} from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";

export type Usuario = {
  id: string;
  nome: string;
  email?: string;
  foto_perfil?: string;
};

type UserContextType = {
  usuario: Usuario | null;
  setUsuario: (u: Usuario | null) => Promise<void>;
  atualizarFotoPerfilLocal: (fotoUri: string) => Promise<void>;
  logout: () => Promise<void>;
};

const UserContext = createContext<UserContextType | undefined>(undefined);

export const UserProvider = ({ children }: { children: ReactNode }) => {
  const [usuario, setUsuarioState] = useState<Usuario | null>(null);


  useEffect(() => {
    const carregarUsuario = async () => {
      try {
        const uStr = await AsyncStorage.getItem("usuarioLogado");
        if (uStr) {
          setUsuarioState(JSON.parse(uStr));
        }
      } catch (err) {
        console.error("Erro ao carregar usuário:", err);
      }
    };
    carregarUsuario();
  }, []);


  const setUsuario = async (u: Usuario | null) => {
    try {
      if (u) {
        await AsyncStorage.setItem("usuarioLogado", JSON.stringify(u));
      } else {
        await AsyncStorage.removeItem("usuarioLogado");
      }
      setUsuarioState(u);
    } catch (err) {
      console.error("Erro ao salvar usuário:", err);
    }
  };


  const atualizarFotoPerfilLocal = async (fotoUri: string) => {
    if (!usuario) return;

    const usuarioAtualizado = {
      ...usuario,
      foto_perfil: fotoUri,
    };

    await AsyncStorage.setItem(
      "usuarioLogado",
      JSON.stringify(usuarioAtualizado)
    );

    setUsuarioState(usuarioAtualizado);
  };

  const logout = async () => {
    await AsyncStorage.removeItem("usuarioLogado");
    setUsuarioState(null);
  };

  return (
    <UserContext.Provider
      value={{
        usuario,
        setUsuario,
        atualizarFotoPerfilLocal,
        logout,
      }}
    >
      {children}
    </UserContext.Provider>
  );
};

export const useUsuario = () => {
  const context = useContext(UserContext);
  if (!context) {
    throw new Error("useUsuario deve ser usado dentro de UserProvider");
  }
  return context;
};
