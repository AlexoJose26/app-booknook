import React, { useEffect, useState } from "react";
import {
  View,
  Text,
  Image,
  TouchableOpacity,
  StyleSheet,
  Alert,
  ActivityIndicator,
  Modal,
  Pressable,
} from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as ImagePicker from "expo-image-picker";
import { db, initDB } from "../../database/db";
import { usuarios } from "../../database/schema";
import { eq } from "drizzle-orm";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";

export default function Perfil() {
  const [usuario, setUsuario] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [fotoLoading, setFotoLoading] = useState(false);
  const [menuVisible, setMenuVisible] = useState(false);
  const router = useRouter();

  useEffect(() => {
    carregarUsuario();
  }, []);

  async function carregarUsuario() {
    try {
      initDB();

      // ✅ Busca usuário do AsyncStorage
      const usuarioStr = await AsyncStorage.getItem("usuarioLogado");
      if (!usuarioStr) {
        router.replace("/login");
        return;
      }

      const usuarioObj = JSON.parse(usuarioStr);
      setUsuario(usuarioObj);

      // ✅ Atualiza o usuário no banco (caso precise pegar foto)
      const result = await db
        .select()
        .from(usuarios)
        .where(eq(usuarios.id, usuarioObj.id));

      if (result.length) {
        setUsuario(result[0]);
      }
    } catch (e) {
      console.error("Erro ao carregar usuário:", e);
      Alert.alert("Erro", "Não foi possível carregar os dados do usuário.");
    } finally {
      setLoading(false);
    }
  }

  async function alterarFoto() {
    if (!usuario) return;

    try {
      setFotoLoading(true);
      const res = await ImagePicker.launchImageLibraryAsync({ quality: 0.7 });
      if (res.canceled) return;

      const uri = res.assets[0].uri;

      await db
        .update(usuarios)
        .set({ foto_perfil: uri })
        .where(eq(usuarios.id, usuario.id));

      const atualizado = { ...usuario, foto_perfil: uri };
      setUsuario(atualizado);

      await AsyncStorage.setItem("usuarioLogado", JSON.stringify(atualizado));
    } catch (e) {
      console.error("Erro ao alterar foto:", e);
      Alert.alert("Erro", "Falha ao atualizar foto");
    } finally {
      setFotoLoading(false);
    }
  }

  function logout() {
    Alert.alert(
      "Terminar sessão",
      "Deseja mesmo sair?",
      [
        { text: "Cancelar", style: "cancel" },
        {
          text: "Sair",
          style: "destructive",
          onPress: async () => {
            await AsyncStorage.clear();
            router.replace("/login");
          },
        },
      ],
      { cancelable: true }
    );
  }

  if (loading)
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#22c55e" />
      </View>
    );

  return (
    <View style={styles.container}>
      <View style={styles.topBar}>
        <TouchableOpacity
          style={styles.userInfo}
          onPress={alterarFoto}
          disabled={fotoLoading}
        >
          {usuario?.foto_perfil ? (
            <Image source={{ uri: usuario.foto_perfil }} style={styles.avatar} />
          ) : (
            <View style={styles.avatarPlaceholder}>
              {fotoLoading ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={{ color: "#fff", fontSize: 20 }}>+</Text>
              )}
            </View>
          )}
          <Text style={styles.nome}>{usuario?.nome}</Text>
        </TouchableOpacity>

        <TouchableOpacity onPress={() => setMenuVisible(true)}>
          <Ionicons name="ellipsis-vertical" size={28} color="#000" />
        </TouchableOpacity>
      </View>

      <Modal
        visible={menuVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setMenuVisible(false)}
      >
        <Pressable
          style={styles.modalBackground}
          onPress={() => setMenuVisible(false)}
        >
          <View style={styles.menu}>
            <TouchableOpacity style={styles.menuItem} onPress={logout}>
              <Text style={{ color: "red", fontWeight: "bold" }}>Terminar sessão</Text>
            </TouchableOpacity>
          </View>
        </Pressable>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#fff", paddingTop: 40 },
  loadingContainer: { flex: 1, justifyContent: "center", alignItems: "center" },
  topBar: {
    width: "100%",
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 15,
    marginBottom: 20,
  },
  userInfo: { flexDirection: "row", alignItems: "center" },
  avatar: { width: 50, height: 50, borderRadius: 25, marginRight: 10 },
  avatarPlaceholder: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: "#6366F1",
    justifyContent: "center",
    alignItems: "center",
    marginRight: 10,
  },
  nome: { fontSize: 16, fontWeight: "bold" },
  modalBackground: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.2)",
    justifyContent: "flex-start",
    alignItems: "flex-end",
  },
  menu: {
    backgroundColor: "#fff",
    marginTop: 50,
    marginRight: 10,
    borderRadius: 8,
    paddingVertical: 10,
    width: 180,
    shadowColor: "#000",
    shadowOpacity: 0.2,
    shadowRadius: 5,
    elevation: 5,
  },
  menuItem: { paddingVertical: 12, paddingHorizontal: 15 },
});
