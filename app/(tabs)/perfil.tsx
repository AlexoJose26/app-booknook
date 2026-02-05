import React, { useEffect, useState, useRef } from "react";
import {
  View,
  Text,
  Image,
  TouchableOpacity,
  StyleSheet,
  FlatList,
  Modal,
  Pressable,
  TextInput,
  RefreshControl,
  ActivityIndicator,
  Alert,
  Animated,
} from "react-native";
import * as ImagePicker from "expo-image-picker";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useUsuario } from "../../contexts/UsuarioContext";
import { useThemeCustom } from "@/contexts/ThemeContext";
import { db } from "@/database/db";
import { criticas, estantes, livros, curtidas, comentarios } from "@/database/schema";
import { eq, desc } from "drizzle-orm";

export default function Perfil() {
  const router = useRouter();
  const { usuario, setUsuario, carregarUsuario } = useUsuario();
  const { colors, theme } = useThemeCustom();

  const [loading, setLoading] = useState(false);
  const [fotoLoading, setFotoLoading] = useState(false);
  const [editModalVisible, setEditModalVisible] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [novoNome, setNovoNome] = useState("");
  const [criticasUsuario, setCriticasUsuario] = useState<any[]>([]);
  const [lidosUsuario, setLidosUsuario] = useState<any[]>([]);
  const [abaSelecionada, setAbaSelecionada] = useState<"criticas" | "lidos">("criticas");
  const [comentarioAberto, setComentarioAberto] = useState<{ postId: string; texto: string } | null>(null);

  const animationRefs = useRef<{ [key: string]: Animated.Value }>({}).current;

  // Aguarda o usuário estar carregado
  useEffect(() => {
    if (usuario) {
      setNovoNome(usuario.nome || "");
      carregarPostsUsuario();
    }
  }, [usuario]);

  const onRefresh = async () => {
    setRefreshing(true);
    await carregarUsuario();
    await carregarPostsUsuario();
    setRefreshing(false);
  };

  const carregarPostsUsuario = async () => {
    if (!usuario) return;
    setLoading(true);
    try {
      // Criticas do usuário com curtidas e comentários
      const criticasDB = await db
        .select({
          id: criticas.id,
          texto: criticas.texto,
          nota: criticas.nota,
          createdAt: criticas.createdAt,
          livro_titulo: livros.titulo,
        })
        .from(criticas)
        .leftJoin(livros, eq(criticas.livro_id, livros.id))
        .where(eq(criticas.usuario_id, usuario.id))
        .orderBy(desc(criticas.createdAt));

      const criticasComInteracoes = await Promise.all(
        criticasDB.map(async (c) => {
          const curtidasRaw = await db.select().from(curtidas).where(eq(curtidas.critica_id, c.id));
          const comentariosRaw = await db.select().from(comentarios).where(eq(comentarios.critica_id, c.id));

          animationRefs[`card-${c.id}`] = new Animated.Value(1);

          return {
            ...c,
            curtidasCount: curtidasRaw.length,
            curtidoPorMim: curtidasRaw.some((cur) => cur.usuario_id === usuario.id),
            comentarios: comentariosRaw.map((com) => ({
              id: com.id,
              usuario_id: com.usuario_id,
              usuario_nome: com.usuario_id === usuario.id ? usuario.nome : String(com.usuario_id),
              texto: com.texto,
            })),
          };
        })
      );

      setCriticasUsuario(criticasComInteracoes);

      // Livros lidos do usuário
      const lidosDB = await db
        .select({
          id: estantes.id,
          livro_titulo: livros.titulo,
          createdAt: estantes.createdAt,
        })
        .from(estantes)
        .leftJoin(livros, eq(estantes.livro_id, livros.id))
        .where(eq(estantes.usuario_id, usuario.id))
        .where(eq(estantes.status, "lido"))
        .orderBy(desc(estantes.createdAt));

      setLidosUsuario(lidosDB);
    } catch (err) {
      console.error(err);
      Alert.alert("Erro", "Falha ao carregar posts do usuário");
    } finally {
      setLoading(false);
    }
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

      const atualizado = { ...usuario, foto_perfil: uri };
      setUsuario(atualizado);
      await AsyncStorage.setItem("usuarioLogado", JSON.stringify(atualizado));
    } catch (err) {
      console.error(err);
      Alert.alert("Erro", "Falha ao atualizar foto");
    } finally {
      setFotoLoading(false);
    }
  };

  const salvarAlteracoes = async () => {
    if (!usuario) return;
    try {
      const atualizado = { ...usuario, nome: novoNome };
      setUsuario(atualizado);
      await AsyncStorage.setItem("usuarioLogado", JSON.stringify(atualizado));
      Alert.alert("Sucesso", "Perfil atualizado!");
      setEditModalVisible(false);
    } catch (err) {
      console.error(err);
      Alert.alert("Erro", "Falha ao atualizar perfil");
    }
  };

  const terminarSessao = async () => {
    await AsyncStorage.removeItem("usuarioLogado");
    setUsuario(null);
    router.replace("/login");
  };

  if (!usuario) {
    return (
      <View style={styles.loading}>
        <ActivityIndicator size="large" color="#3B82F6" />
        <Text>Carregando perfil…</Text>
      </View>
    );
  }

  return (
    <>
      <FlatList
        style={[styles.container, { backgroundColor: colors.background }]}
        data={[]}
        keyExtractor={() => Math.random().toString()}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        ListHeaderComponent={
          <>
            {/* Capa azul */}
            <View style={[styles.capa, { backgroundColor: "#3b5998" }]}>
              <TouchableOpacity
                style={styles.menuIcon}
                onPress={() => setEditModalVisible(true)}
              >
                <Ionicons name="ellipsis-vertical" size={28} color="#fff" />
              </TouchableOpacity>
            </View>

            {/* Foto e nome à esquerda */}
            <View style={styles.perfilContainerLinha}>
              <TouchableOpacity onPress={alterarFotoPerfil}>
                {usuario?.foto_perfil ? (
                  <Image source={{ uri: usuario.foto_perfil }} style={styles.avatar} />
                ) : (
                  <View style={[styles.avatarPlaceholder, { backgroundColor: colors.primary }]}>
                    <Text style={{ color: "#fff", fontSize: 30 }}>+</Text>
                  </View>
                )}
              </TouchableOpacity>
              <Text style={[styles.nomeLinha, { color: colors.text }]}>{usuario?.nome || "Usuário"}</Text>
            </View>

            {/* Abas */}
            <View style={styles.abasContainer}>
              <TouchableOpacity
                style={[styles.aba, abaSelecionada === "criticas" && { borderBottomColor: colors.primary, borderBottomWidth: 2 }]}
                onPress={() => setAbaSelecionada("criticas")}
              >
                <Text style={{ color: colors.text }}>Publicações</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.aba, abaSelecionada === "lidos" && { borderBottomColor: colors.primary, borderBottomWidth: 2 }]}
                onPress={() => setAbaSelecionada("lidos")}
              >
                <Text style={{ color: colors.text }}>Livros Lidos</Text>
              </TouchableOpacity>
            </View>

            {/* Posts */}
            <View style={{ marginTop: 12 }}>{/* RenderPosts aqui */}</View>
          </>
        }
      />

      {/* Modal editar perfil */}
      <Modal visible={editModalVisible} transparent animationType="fade">
        <Pressable style={styles.modalBg} onPress={() => setEditModalVisible(false)}>
          <View style={[styles.editModal, { backgroundColor: colors.card }]}>
            <Text style={{ fontWeight: "bold", fontSize: 18, marginBottom: 12, color: colors.text }}>Editar Perfil</Text>
            <TouchableOpacity onPress={alterarFotoPerfil}>
              {usuario?.foto_perfil ? (
                <Image source={{ uri: usuario.foto_perfil }} style={styles.avatarEdit} />
              ) : (
                <View style={[styles.avatarPlaceholder, { backgroundColor: colors.primary }]}>
                  <Text style={{ color: "#fff", fontSize: 30 }}>+</Text>
                </View>
              )}
            </TouchableOpacity>
            <TextInput
              style={[styles.inputNome, { borderColor: colors.secondary, color: colors.text }]}
              value={novoNome}
              onChangeText={setNovoNome}
              placeholder="Novo nome"
              placeholderTextColor={colors.secondary}
            />
            <TouchableOpacity style={[styles.botaoEditar, { backgroundColor: colors.primary }]} onPress={salvarAlteracoes}>
              <Text style={styles.botaoTexto}>Salvar Alterações</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.botaoSair, { backgroundColor: "#EF4444" }]} onPress={terminarSessao}>
              <Text style={styles.botaoTexto}>Terminar Sessão</Text>
            </TouchableOpacity>
          </View>
        </Pressable>
      </Modal>

      {fotoLoading && (
        <View style={styles.loading}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      )}
    </>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  capa: { height: 160, borderBottomLeftRadius: 12, borderBottomRightRadius: 12 },
  menuIcon: { position: "absolute", top: 12, right: 12, padding: 6 },
  perfilContainerLinha: { flexDirection: "row", alignItems: "center", marginTop: -50, paddingHorizontal: 16 },
  avatar: { width: 100, height: 100, borderRadius: 50, borderWidth: 3, borderColor: "#fff" },
  avatarPlaceholder: { width: 100, height: 100, borderRadius: 50, justifyContent: "center", alignItems: "center", borderWidth: 3, borderColor: "#fff" },
  nomeLinha: { fontSize: 22, fontWeight: "bold", marginLeft: 16 },
  abasContainer: { flexDirection: "row", justifyContent: "space-around", marginTop: 16, borderBottomWidth: 1, borderBottomColor: "#ccc" },
  aba: { paddingVertical: 8 },
  card: { padding: 12, borderRadius: 12, marginBottom: 8 },
  livroTitulo: { fontWeight: "bold", marginBottom: 4 },
  inputComentario: { borderWidth: 1, borderRadius: 8, padding: 8, marginBottom: 4 },
  botaoEnviarComentario: { padding: 8, borderRadius: 8 },
  editModal: { width: 300, borderRadius: 12, padding: 20, alignItems: "center" },
  avatarEdit: { width: 100, height: 100, borderRadius: 50, marginBottom: 12 },
  inputNome: { width: "100%", borderWidth: 1, borderRadius: 12, padding: 10, marginBottom: 12 },
  botaoEditar: { paddingVertical: 10, paddingHorizontal: 16, borderRadius: 8, width: "100%", alignItems: "center" },
  botaoSair: { paddingVertical: 10, paddingHorizontal: 16, borderRadius: 8, width: "100%", alignItems: "center", marginTop: 8 },
  botaoTexto: { color: "#fff", fontWeight: "bold", fontSize: 14 },
  loading: { flex: 1, justifyContent: "center", alignItems: "center", position: "absolute", top: 0, left: 0, right: 0, bottom: 0, backgroundColor: "rgba(0,0,0,0.2)" },
  modalBg: { flex: 1, backgroundColor: "rgba(0,0,0,0.3)", justifyContent: "center", alignItems: "center" },
});
