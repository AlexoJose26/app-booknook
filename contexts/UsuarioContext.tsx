import React, { createContext, useContext, useEffect, useState, ReactNode } from "react";
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

const UsuarioContext = createContext<UsuarioContextType | undefined>(undefined);

export const UsuarioProvider = ({ children }: { children: ReactNode }) => {
  const [usuario, setUsuario] = useState<Usuario | null>(null);

  const carregarUsuario = async () => {
    try {
      const json = await AsyncStorage.getItem("usuarioLogado");
      if (json) {
        setUsuario(JSON.parse(json));
      } else {
        setUsuario(null);
      }
    } catch (e) {
      console.error("Erro ao carregar usuário:", e);
      setUsuario(null);
    }
  };

  useEffect(() => {
    carregarUsuario();
  }, []);

  return (
    <UsuarioContext.Provider value={{ usuario, setUsuario, carregarUsuario }}>
      {children}
    </UsuarioContext.Provider>
  );
};

export const useUsuario = () => {
  const ctx = useContext(UsuarioContext);
  if (!ctx) throw new Error("useUsuario deve ser usado dentro de UsuarioProvider");
  return ctx;
};
