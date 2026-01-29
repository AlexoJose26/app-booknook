import React, { useEffect, useState, useRef } from "react";
import {
  View,
  Text,
  FlatList,
  StyleSheet,
  Image,
  ActivityIndicator,
  Animated,
  Pressable,
  TextInput,
  TouchableOpacity,
  Alert,
} from "react-native";
import { useRouter } from "expo-router";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { db } from "@/database/db";
import { criticas, estantes, livros, usuarios, likes, comentarios } from "@/database/schema";
import { eq, desc, inArray } from "drizzle-orm";

export default function Feed({ atualizarTrigger }: { atualizarTrigger?: number }) {
  const router = useRouter();
  const [feed, setFeed] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [usuarioLogado, setUsuarioLogado] = useState<{ id: string; nome: string; foto?: string } | null>(null);
  const animValues = useRef<Animated.Value[]>([]);
  const [comentarioTemp, setComentarioTemp] = useState<{ [key: string]: string }>({}); // texto temporário por item

  const carregarFeed = async () => {
    setLoading(true);
    try {
      // ✅ Usuário logado
      const userStr = await AsyncStorage.getItem("usuarioLogado");
      const user = userStr ? JSON.parse(userStr) : null;
      setUsuarioLogado(user);

      // ✅ Usuários e map
      const usuariosRaw = await db
        .select({ id: usuarios.id, nome: usuarios.nome, foto: usuarios.foto_perfil })
        .from(usuarios);
      const usuariosMap = Object.fromEntries(usuariosRaw.map(u => [u.id, u]));

      // ✅ Livros
      const livrosRaw = await db
        .select({ id: livros.id, titulo: livros.titulo, capa: livros.imagem })
        .from(livros);
      const livrosMap = Object.fromEntries(livrosRaw.map(l => [l.id, l]));

      // ✅ Criticas
      const criticasRaw = await db
        .select({
          id: criticas.id,
          texto: criticas.texto,
          nota: criticas.nota,
          data: criticas.createdAt,
          livroId: criticas.livro_id,
          usuarioId: criticas.usuario_id,
        })
        .from(criticas)
        .orderBy(desc(criticas.createdAt));

      // ✅ Likes
      const likesRaw = await db.select().from(likes);
      const likesMap: Record<string, any[]> = {};
      likesRaw.forEach(l => {
        if (!likesMap[l.item_id]) likesMap[l.item_id] = [];
        likesMap[l.item_id].push(l.usuario_id);
      });

      // ✅ Comentários
      const comentariosRaw = await db.select().from(comentarios);
      const comentariosMap: Record<string, any[]> = {};
      comentariosRaw.forEach(c => {
        if (!comentariosMap[c.item_id]) comentariosMap[c.item_id] = [];
        comentariosMap[c.item_id].push(c);
      });

      // ✅ Criticas com extras
      const criticasComExtras = criticasRaw.map(c => {
        const usuario = usuariosMap[c.usuarioId];
        const livro = livrosMap[c.livroId];
        return {
          id: c.id,
          tipo: "critica",
          tituloLivro: livro?.titulo || "Livro",
          capaLivro: livro?.capa || "",
          usuarioNome: usuario?.nome || (user?.id === c.usuarioId ? user.nome : "Usuário"),
          usuarioFoto: usuario?.foto || (user?.id === c.usuarioId ? user.foto : ""),
          texto: c.texto,
          nota: c.nota,
          data: c.data,
          likes: likesMap[c.id]?.length || 0,
          likedByMe: user ? likesMap[c.id]?.includes(user.id) : false,
          comentarios: comentariosMap[c.id]?.length || 0,
          comentariosLista: comentariosMap[c.id] || [],
        };
      });

      // ✅ Livros adicionados à estante
      const estantesRaw = await db.select().from(estantes).orderBy(desc(estantes.createdAt));
      const estantesComExtras = estantesRaw.map(e => {
        const usuario = usuariosMap[e.usuario_id];
        const livro = livrosMap[e.livro_id];
        return {
          id: e.id,
          tipo: "estante",
          tituloLivro: livro?.titulo || "Livro",
          capaLivro: livro?.capa || "",
          usuarioNome: usuario?.nome || (user?.id === e.usuario_id ? user.nome : "Usuário"),
          usuarioFoto: usuario?.foto || (user?.id === e.usuario_id ? user.foto : ""),
          data: e.createdAt,
          likes: likesMap[e.id]?.length || 0,
          likedByMe: user ? likesMap[e.id]?.includes(user.id) : false,
          comentarios: comentariosMap[e.id]?.length || 0,
          comentariosLista: comentariosMap[e.id] || [],
        };
      });

      // ✅ Combinar feed
      const combined = [...criticasComExtras, ...estantesComExtras].sort(
        (a, b) => new Date(b.data).getTime() - new Date(a.data).getTime()
      );

      animValues.current = combined.map(() => new Animated.Value(0));
      setFeed(combined);

      Animated.stagger(
        80,
        animValues.current.map(anim =>
          Animated.timing(anim, { toValue: 1, duration: 400, useNativeDriver: true })
        )
      ).start();
    } catch (e) {
      console.error("Erro ao carregar feed:", e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    carregarFeed();
  }, [atualizarTrigger]);

  const toggleLike = async (itemId: string) => {
    if (!usuarioLogado) return;
    try {
      const liked = feed.find(f => f.id === itemId)?.likedByMe;
      if (liked) {
        await db.delete(likes).where(eq(likes.item_id, itemId)).where(eq(likes.usuario_id, usuarioLogado.id));
      } else {
        await db.insert(likes).values({ item_id: itemId, usuario_id: usuarioLogado.id, createdAt: new Date().toISOString() });
      }
      carregarFeed();
    } catch (e) {
      console.error(e);
    }
  };

  const postarComentario = async (itemId: string) => {
    if (!usuarioLogado || !comentarioTemp[itemId]?.trim()) return;
    try {
      await db.insert(comentarios).values({
        item_id: itemId,
        usuario_id: usuarioLogado.id,
        texto: comentarioTemp[itemId],
        createdAt: new Date().toISOString(),
      });
      setComentarioTemp(prev => ({ ...prev, [itemId]: "" }));
      carregarFeed();
    } catch (e) {
      console.error(e);
    }
  };

  if (loading) {
    return (
      <View style={styles.loading}>
        <ActivityIndicator size="large" />
        <Text>Carregando feed…</Text>
      </View>
    );
  }

  const renderItem = ({ item, index }: { item: any; index: number }) => {
    const animStyle = {
      opacity: animValues.current[index],
      transform: [{ translateY: animValues.current[index].interpolate({ inputRange: [0, 1], outputRange: [20, 0] }) }],
    };

    return (
      <Animated.View style={[styles.card, animStyle]}>
        {/* Header */}
        <View style={styles.header}>
          {item.usuarioFoto ? (
            <Image source={{ uri: item.usuarioFoto }} style={styles.avatar} />
          ) : (
            <View style={styles.avatarPlaceholder}><Text>👤</Text></View>
          )}
          <View style={styles.userInfo}>
            <Text style={styles.nome}>{item.usuarioNome}</Text>
            <Text style={styles.acao}>
              {item.tipo === "critica" ? "publicou uma crítica" : "adicionou um livro à estante"}
            </Text>
          </View>
        </View>

        {/* Livro */}
        <Pressable
          style={styles.livroContainer}
          onPress={() => router.push({ pathname: "/livro", params: { livroId: item.livroId || item.livro_id } })}
        >
          {item.capaLivro && <Image source={{ uri: item.capaLivro }} style={styles.capa} />}
          <View style={{ flex: 1 }}>
            <Text style={styles.titulo}>{item.tituloLivro}</Text>
            {item.tipo === "critica" && (
              <>
                <Text style={styles.critica}>“{item.texto}”</Text>
                {item.nota != null && <Text style={styles.nota}>⭐ {item.nota}/10</Text>}
              </>
            )}
          </View>
        </Pressable>

        {/* Interações */}
        <View style={styles.interacoes}>
          <Pressable onPress={() => toggleLike(item.id)}>
            <Text style={{ color: item.likedByMe ? "#EF4444" : "#6B7280" }}>❤️ {item.likes}</Text>
          </Pressable>
          <Text>💬 {item.comentarios}</Text>
        </View>

        {/* Comentário rápido */}
        <View style={styles.comentarioContainer}>
          <TextInput
            placeholder="Escreva um comentário…"
            value={comentarioTemp[item.id] || ""}
            onChangeText={text => setComentarioTemp(prev => ({ ...prev, [item.id]: text }))}
            style={styles.inputComentario}
          />
          <TouchableOpacity onPress={() => postarComentario(item.id)} style={styles.botaoComentario}>
            <Text style={{ color: "#FFF" }}>Postar</Text>
          </TouchableOpacity>
        </View>

        <Text style={styles.data}>{new Date(item.data).toLocaleString()}</Text>
      </Animated.View>
    );
  };

  return (
    <FlatList
      data={feed}
      keyExtractor={i => `${i.tipo}-${i.id}`}
      renderItem={renderItem}
      contentContainerStyle={styles.container}
    />
  );
}

const styles = StyleSheet.create({
  container: { padding: 12, paddingBottom: 24, backgroundColor: "#F3F4F6" },
  loading: { flex: 1, justifyContent: "center", alignItems: "center" },
  card: {
    padding: 16,
    borderRadius: 16,
    marginBottom: 16,
    backgroundColor: "#FFF",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 6,
    elevation: 3,
  },
  header: { flexDirection: "row", alignItems: "center" },
  avatar: { width: 50, height: 50, borderRadius: 25, marginRight: 12 },
  avatarPlaceholder: { width: 50, height: 50, borderRadius: 25, backgroundColor: "#E5E7EB", justifyContent: "center", alignItems: "center", marginRight: 12 },
  userInfo: { flex: 1, justifyContent: "center" },
  nome: { fontWeight: "bold", fontSize: 16 },
  acao: { fontSize: 13, color: "#6B7280", marginTop: 2 },
  livroContainer: { flexDirection: "row", marginTop: 10, gap: 12, alignItems: "center" },
  capa: { width: 70, height: 100, borderRadius: 8 },
  titulo: { fontSize: 16, fontWeight: "bold" },
  critica: { marginTop: 6, fontStyle: "italic", color: "#374151" },
  nota: { marginTop: 4, fontWeight: "bold", color: "#F59E0B" },
  interacoes: { flexDirection: "row", gap: 16, marginTop: 8, alignItems: "center" },
  comentarioContainer: { flexDirection: "row", marginTop: 8, alignItems: "center", gap: 8 },
  inputComentario: { flex: 1, borderWidth: 1, borderColor: "#D1D5DB", borderRadius: 12, padding: 8 },
  botaoComentario: { backgroundColor: "#3B82F6", paddingHorizontal: 12, paddingVertical: 8, borderRadius: 12 },
  data: { fontSize: 12, opacity: 0.5, marginTop: 8 },
});
