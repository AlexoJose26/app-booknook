import React, { createContext, useContext, useState, ReactNode, useEffect } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";

type Usuario = {
  id: string;
  nome: string;
  email?: string;
  foto?: string;
};

type UserContextType = {
  usuario: Usuario | null;
  setUsuario: (u: Usuario | null) => void;
};

const UserContext = createContext<UserContextType | undefined>(undefined);

export const UserProvider = ({ children }: { children: ReactNode }) => {
  const [usuario, setUsuario] = useState<Usuario | null>(null);

  useEffect(() => {
    const carregarUsuario = async () => {
      try {
        const uStr = await AsyncStorage.getItem("usuarioLogado");
        if (uStr) setUsuario(JSON.parse(uStr));
      } catch (e) {
        console.error("Erro ao carregar usuário:", e);
      }
    };
    carregarUsuario();
  }, []);

  return (
    <UserContext.Provider value={{ usuario, setUsuario }}>
      {children}
    </UserContext.Provider>
  );
};

export const useUsuario = () => {
  const context = useContext(UserContext);
  if (!context) throw new Error("useUsuario deve ser usado dentro de um UserProvider");
  return context;
};
