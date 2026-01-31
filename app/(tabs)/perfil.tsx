import React, { useEffect, useState, useCallback } from "react";
import {
  View,
  Text,
  Image,
  TouchableOpacity,
  StyleSheet,
  Alert,
  ActivityIndicator,
  FlatList,
  Modal,
  Pressable,
  RefreshControl,
} from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as ImagePicker from "expo-image-picker";
import { db } from "@/database/db";
import { usuarios, criticas, estantes, livros } from "@/database/schema";
import { eq, desc } from "drizzle-orm";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";

export default function Perfil() {
  const [usuario, setUsuario] = useState<any>(null);
  const [posts, setPosts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [fotoLoading, setFotoLoading] = useState(false);
  const [menuVisible, setMenuVisible] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const router = useRouter();

  const carregarUsuario = useCallback(async () => {
    setLoading(true);
    try {
      const str = await AsyncStorage.getItem("usuarioLogado");
      if (!str) return router.replace("/login");

      const sessao = JSON.parse(str);
      if (!sessao?.id) return;

      const result = await db.select().from(usuarios).where(eq(usuarios.id, sessao.id));
      if (!result.length) return;

      setUsuario(result[0]);
      await carregarPublicacoes(result[0].id);
    } catch (err) {
      console.error(err);
      Alert.alert("Erro", "Falha ao carregar perfil");
    } finally {
      setLoading(false);
    }
  }, [router]);

  const carregarPublicacoes = useCallback(async (usuarioId: string) => {
    try {
      const criticasDB = await db
        .select({
          id: criticas.id,
          texto: criticas.texto,
          data: criticas.createdAt,
          titulo: livros.titulo,
        })
        .from(criticas)
        .leftJoin(livros, eq(criticas.livro_id, livros.id))
        .where(eq(criticas.usuario_id, usuarioId))
        .orderBy(desc(criticas.createdAt));

      const postsCriticas = criticasDB.map(c => ({
        id: `critica-${c.id}`,
        tipo: "critica",
        texto: c.texto,
        titulo: c.titulo || "Livro",
        data: c.data,
      }));

      const lidosDB = await db
        .select({
          id: estantes.id,
          data: estantes.createdAt,
          titulo: livros.titulo,
        })
        .from(estantes)
        .leftJoin(livros, eq(estantes.livro_id, livros.id))
        .where(eq(estantes.usuario_id, usuarioId))
        .where(eq(estantes.status, "lido"))
        .orderBy(desc(estantes.createdAt));

      const postsLidos = lidosDB.map(l => ({
        id: `lido-${l.id}`,
        tipo: "lido",
        titulo: l.titulo || "Livro",
        data: l.data,
      }));

      setPosts([...postsCriticas, ...postsLidos].sort(
        (a, b) => new Date(b.data).getTime() - new Date(a.data).getTime()
      ));
    } catch (err) {
      console.error(err);
    }
  }, []);

  useEffect(() => {
    carregarUsuario();
  }, [carregarUsuario]);

  const onRefresh = async () => {
    setRefreshing(true);
    await carregarUsuario();
    setRefreshing(false);
  };

  const alterarFotoPerfil = async () => {
    if (!usuario) return;
    try {
      setFotoLoading(true);
      const res = await ImagePicker.launchImageLibraryAsync({
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.8,
      });
      if (res.canceled) return;

      const uri = res.assets[0].uri;
      await db.update(usuarios).set({ foto_perfil: uri }).where(eq(usuarios.id, usuario.id));

      const atualizado = { ...usuario, foto_perfil: uri };
      setUsuario(atualizado);

      await AsyncStorage.setItem(
        "usuarioLogado",
        JSON.stringify({
          id: atualizado.id,
          nome: atualizado.nome,
          foto_perfil: atualizado.foto_perfil || null,
        })
      );
    } catch (err) {
      console.error(err);
      Alert.alert("Erro", "Falha ao atualizar foto");
    } finally {
      setFotoLoading(false);
    }
  };

  const logout = () => {
    Alert.alert("Terminar sessão", "Deseja mesmo sair?", [
      { text: "Cancelar", style: "cancel" },
      {
        text: "Sair",
        style: "destructive",
        onPress: async () => {
          await AsyncStorage.clear();
          router.replace("/login");
        },
      },
    ]);
  };

  if (loading) {
    return (
      <View style={styles.loading}>
        <ActivityIndicator size="large" color="#1877F2" />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Menu */}
      <TouchableOpacity style={styles.menuBtn} onPress={() => setMenuVisible(true)}>
        <Ionicons name="ellipsis-vertical" size={28} color="#000" />
      </TouchableOpacity>

      {/* Avatar */}
      <TouchableOpacity onPress={alterarFotoPerfil}>
        {usuario?.foto_perfil ? (
          <Image source={{ uri: usuario.foto_perfil }} style={styles.avatar} />
        ) : (
          <View style={styles.avatarPlaceholder}>
            <Text style={{ color: "#fff", fontSize: 30 }}>+</Text>
          </View>
        )}
      </TouchableOpacity>

      <Text style={styles.nome}>{usuario?.nome}</Text>

      {/* Posts */}
      <FlatList
        data={posts}
        keyExtractor={item => item.id}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        contentContainerStyle={{ padding: 15 }}
        renderItem={({ item }) => (
          <View style={styles.post}>
            {item.tipo === "critica" ? (
              <>
                <Text style={styles.postTitle}>📖 Crítica sobre {item.titulo}</Text>
                <Text>{item.texto}</Text>
              </>
            ) : (
              <Text style={styles.postTitle}>✅ Concluiu a leitura de {item.titulo}</Text>
            )}
          </View>
        )}
      />

      {/* Menu Modal */}
      <Modal visible={menuVisible} transparent animationType="fade">
        <Pressable style={styles.modalBg} onPress={() => setMenuVisible(false)}>
          <View style={styles.menu}>
            <TouchableOpacity style={styles.menuItem} onPress={logout}>
              <Ionicons name="log-out-outline" size={18} color="red" />
              <Text style={{ color: "red" }}>Terminar sessão</Text>
            </TouchableOpacity>
          </View>
        </Pressable>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, alignItems: "center", paddingTop: 60, backgroundColor: "#f5f6fa" },
  menuBtn: { position: "absolute", top: 40, right: 15 },
  avatar: { width: 120, height: 120, borderRadius: 60 },
  avatarPlaceholder: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: "#6366F1",
    justifyContent: "center",
    alignItems: "center",
  },
  nome: { fontSize: 22, fontWeight: "bold", marginTop: 15, marginBottom: 20 },
  post: { padding: 15, borderBottomWidth: 1, borderColor: "#ddd", width: "100%" },
  postTitle: { fontWeight: "bold", marginBottom: 4 },
  modalBg: { flex: 1, backgroundColor: "rgba(0,0,0,0.3)", justifyContent: "flex-start", alignItems: "flex-end" },
  menu: { backgroundColor: "#fff", width: 180, marginTop: 70, marginRight: 10, borderRadius: 8, paddingVertical: 10 },
  menuItem: { flexDirection: "row", alignItems: "center", gap: 10, padding: 12 },
  loading: { flex: 1, justifyContent: "center", alignItems: "center" },
});
