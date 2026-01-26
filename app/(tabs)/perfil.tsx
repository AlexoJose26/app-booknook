import React, { useEffect, useState } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  Image,
  StyleSheet,
  ScrollView,
  Alert,
  Modal,
} from "react-native";
import * as ImagePicker from "expo-image-picker";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useThemeCustom } from "@/contexts/ThemeContext";
import { useUsuario } from "@/contexts/UserContext";
import { useRouter } from "expo-router";
import { Entypo, Ionicons } from "@expo/vector-icons";
import { db } from "@/database/db";
import { usuarios } from "@/database/schema";
import { eq } from "drizzle-orm";

export default function Perfil() {
  const { theme } = useThemeCustom();
  const isDark = theme === "dark";
  const router = useRouter();
  const { usuario, setUsuario } = useUsuario();

  const [foto, setFoto] = useState<string | null>(null);
  const [menuVisivel, setMenuVisivel] = useState(false);

  /* ===============================
     CARREGAR USUÁRIO
  =============================== */
  useEffect(() => {
    if (usuario?.foto_perfil) {
      setFoto(usuario.foto_perfil);
    }
  }, [usuario]);

  /* ===============================
     ESCOLHER FOTO
  =============================== */
  const escolherFoto = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== "granted") {
      Alert.alert("Permissão necessária", "Ative o acesso à galeria.");
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.8,
    });

    if (!result.canceled) {
      const uri = result.assets[0].uri;
      await salvarPerfil(uri);
      setMenuVisivel(false);
    }
  };

  /* ===============================
     SALVAR PERFIL (DB + STORAGE)
  =============================== */
  const salvarPerfil = async (novaFoto?: string) => {
    if (!usuario) return;

    try {
      const fotoFinal = novaFoto ?? foto ?? null;

      // 🔥 Atualiza no SQLite
      await db
        .update(usuarios)
        .set({ foto_perfil: fotoFinal })
        .where(eq(usuarios.id, usuario.id));

      const usuarioAtualizado = {
        ...usuario,
        foto_perfil: fotoFinal,
      };

      // 🔄 Atualiza sessão
      await AsyncStorage.setItem(
        "usuarioLogado",
        JSON.stringify(usuarioAtualizado)
      );

      setUsuario(usuarioAtualizado);
      setFoto(fotoFinal);

      Alert.alert("Sucesso", "Perfil atualizado com sucesso!");
    } catch (e) {
      console.log(e);
      Alert.alert("Erro", "Não foi possível salvar o perfil.");
    }
  };

  /* ===============================
     LOGOUT
  =============================== */
  const terminarSessao = () => {
    Alert.alert("Sair", "Deseja terminar a sessão?", [
      { text: "Cancelar", style: "cancel" },
      {
        text: "Sair",
        style: "destructive",
        onPress: async () => {
          await AsyncStorage.removeItem("usuarioLogado");
          setUsuario(null);
          router.replace("/login");
        },
      },
    ]);
    setMenuVisivel(false);
  };

  return (
    <View
      style={[
        styles.container,
        { backgroundColor: isDark ? "#111827" : "#E5E7EB" },
      ]}
    >
      {/* Menu */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => setMenuVisivel(true)}>
          <Entypo
            name="dots-three-vertical"
            size={22}
            color={isDark ? "#F9FAFB" : "#111827"}
          />
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={styles.scroll}>
        {foto ? (
          <Image source={{ uri: foto }} style={styles.foto} />
        ) : (
          <View
            style={[
              styles.placeholder,
              { backgroundColor: isDark ? "#1F2937" : "#D1D5DB" },
            ]}
          >
            <Ionicons
              name="person"
              size={32}
              color={isDark ? "#9CA3AF" : "#6B7280"}
            />
          </View>
        )}

        <Text
          style={[
            styles.nome,
            { color: isDark ? "#F9FAFB" : "#111827" },
          ]}
        >
          {usuario?.nome}
        </Text>
      </ScrollView>

      {/* MENU MODAL */}
      <Modal transparent visible={menuVisivel} animationType="fade">
        <TouchableOpacity
          style={styles.modalOverlay}
          onPress={() => setMenuVisivel(false)}
        >
          <View
            style={[
              styles.menu,
              { backgroundColor: isDark ? "#1F2937" : "#FFF" },
            ]}
          >
            <TouchableOpacity style={styles.menuItem} onPress={escolherFoto}>
              <Text style={styles.menuText}>Escolher foto</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.menuItem} onPress={terminarSessao}>
              <Text style={[styles.menuText, { color: "#EF4444" }]}>
                Terminar sessão
              </Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>
    </View>
  );
}

/* ===============================
   ESTILOS
=============================== */
const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    width: "100%",
    padding: 16,
    alignItems: "flex-end",
  },
  scroll: {
    alignItems: "center",
    paddingVertical: 20,
  },
  foto: {
    width: 120,
    height: 120,
    borderRadius: 60,
  },
  placeholder: {
    width: 120,
    height: 120,
    borderRadius: 60,
    justifyContent: "center",
    alignItems: "center",
  },
  nome: {
    fontSize: 22,
    fontWeight: "600",
    marginTop: 12,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.3)",
    justifyContent: "flex-start",
    alignItems: "flex-end",
  },
  menu: {
    marginTop: 60,
    marginRight: 16,
    borderRadius: 8,
    paddingVertical: 8,
    width: 160,
    shadowColor: "#000",
    shadowOpacity: 0.2,
    shadowOffset: { width: 0, height: 2 },
    shadowRadius: 4,
    elevation: 5,
  },
  menuItem: {
    paddingVertical: 12,
    paddingHorizontal: 16,
  },
  menuText: {
    fontSize: 16,
  },
});
