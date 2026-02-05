import React, { createContext, useContext, useState, ReactNode, useEffect } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";

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

const UserContext = createContext<UsuarioContextType | undefined>(undefined);

export const UsuarioProvider = ({ children }: { children: ReactNode }) => {
  const [usuario, setUsuario] = useState<Usuario | null>(null);

  const carregarUsuario = async () => {
    try {
      const json = await AsyncStorage.getItem("usuarioLogado");
      if (json) setUsuario(JSON.parse(json));
    } catch (err) {
      console.error("Erro ao carregar usuário:", err);
    }
  };

  useEffect(() => {
    carregarUsuario();
  }, []);

  return (
    <UserContext.Provider value={{ usuario, setUsuario, carregarUsuario }}>
      {children}
    </UserContext.Provider>
  );
};

export const useUsuario = () => {
  const ctx = useContext(UserContext);
  if (!ctx) throw new Error("useUsuario deve ser usado dentro de UsuarioProvider");
  return ctx;
};
