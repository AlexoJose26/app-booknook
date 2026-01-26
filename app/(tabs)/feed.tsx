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
  Alert,
} from "react-native";
import { useRouter } from "expo-router";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { db } from "@/database/db";
import { criticas, estantes, livros, usuarios, likes, comentarios } from "@/database/schema";
import { eq, desc } from "drizzle-orm";

export default function Feed({ atualizarTrigger }: { atualizarTrigger?: number }) {
  const router = useRouter();
  const [feed, setFeed] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [usuarioLogado, setUsuarioLogado] = useState<{ id: string; nome: string; foto?: string } | null>(null);
  const animValues = useRef<Animated.Value[]>([]);

  const carregarFeed = async () => {
    setLoading(true);
    try {
      // Pegar usuário logado
      const userStr = await AsyncStorage.getItem("usuarioLogado");
      const user = userStr ? JSON.parse(userStr) : null;
      setUsuarioLogado(user);

      // ===== CRÍTICAS =====
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

      // Mapas de usuários e livros
      const usuariosMap = Object.fromEntries(
        (await db.select({ id: usuarios.id, nome: usuarios.nome, foto: usuarios.foto_perfil }).from(usuarios)).map(u => [u.id, u])
      );
      const livrosMap = Object.fromEntries(
        (await db.select({ id: livros.id, titulo: livros.titulo, capa: livros.imagem }).from(livros)).map(l => [l.id, l])
      );

      const criticasComExtras = criticasRaw.map(c => {
        const likeCount = 0; // Pode puxar likes se quiser
        const commentCount = 0; // Pode puxar comentários se quiser

        // Escolhe a foto do usuário logado se for ele e não tiver foto
        let foto = usuariosMap[c.usuarioId]?.foto || "";
        if (!foto && user && c.usuarioId === user.id) foto = user.foto || "";

        // Nome do usuário
        let nome = usuariosMap[c.usuarioId]?.nome || "Usuário";
        if (user && c.usuarioId === user.id) nome = user.nome;

        return {
          ...c,
          tipo: "critica",
          tituloLivro: livrosMap[c.livroId]?.titulo || "Livro",
          capaLivro: livrosMap[c.livroId]?.capa || "",
          usuarioNome: nome,
          usuarioFoto: foto,
          likes: likeCount,
          comentarios: commentCount,
        };
      });

      // ===== ESTANTES =====
      const estantesRaw = await db.select().from(estantes).orderBy(desc(estantes.createdAt));
      const estantesComExtras = estantesRaw.map(e => {
        let foto = usuariosMap[e.usuario_id]?.foto || "";
        let nome = usuariosMap[e.usuario_id]?.nome || "Usuário";
        if (user && e.usuario_id === user.id) {
          nome = user.nome;
          foto = user.foto || foto;
        }

        return {
          ...e,
          tipo: "estante",
          tituloLivro: livrosMap[e.livro_id]?.titulo || "Livro",
          capaLivro: livrosMap[e.livro_id]?.capa || "",
          usuarioNome: nome,
          usuarioFoto: foto,
          likes: 0,
          comentarios: 0,
          data: e.createdAt,
        };
      });

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
      Alert.alert("Erro", "Não foi possível carregar o feed.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    carregarFeed();
  }, [atualizarTrigger]);

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
      transform: [
        {
          translateY: animValues.current[index].interpolate({
            inputRange: [0, 1],
            outputRange: [20, 0],
          }),
        },
      ],
    };

    return (
      <Animated.View style={[styles.card, animStyle]}>
        <View style={styles.header}>
          {item.usuarioFoto ? (
            <Image source={{ uri: item.usuarioFoto }} style={styles.avatar} />
          ) : (
            <View style={styles.avatarPlaceholder}>
              <Text>👤</Text>
            </View>
          )}
          <View style={styles.userInfo}>
            <Text style={styles.nome}>{item.usuarioNome}</Text>
            <Text style={styles.acao}>
              {item.tipo === "critica" ? "publicou uma crítica" : "adicionou um livro à estante"}
            </Text>
          </View>
        </View>

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

        {item.tipo === "critica" && (
          <View style={styles.interacoes}>
            <Text>❤️ {item.likes}</Text>
            <Text>💬 {item.comentarios}</Text>
          </View>
        )}

        <Text style={styles.data}>{new Date(item.data).toLocaleString()}</Text>
      </Animated.View>
    );
  };

  return <FlatList data={feed} keyExtractor={(i) => `${i.tipo}-${i.id}`} renderItem={renderItem} contentContainerStyle={styles.container} />;
}

const styles = StyleSheet.create({
  container: { padding: 12, paddingBottom: 24 },
  loading: { flex: 1, justifyContent: "center", alignItems: "center" },
  card: {
    padding: 16,
    borderRadius: 16,
    marginBottom: 14,
    backgroundColor: "#FFF",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 3,
  },
  header: { flexDirection: "row", alignItems: "center" },
  avatar: { width: 50, height: 50, borderRadius: 25, marginRight: 12 },
  avatarPlaceholder: { width: 50, height: 50, borderRadius: 25, backgroundColor: "#E5E7EB", justifyContent: "center", alignItems: "center", marginRight: 12 },
  userInfo: { flex: 1, justifyContent: "center" },
  nome: { fontWeight: "bold", fontSize: 17 },
  acao: { fontSize: 13, color: "#6B7280", marginTop: 2 },
  livroContainer: { flexDirection: "row", marginTop: 10, gap: 12, alignItems: "center" },
  capa: { width: 60, height: 90, borderRadius: 8 },
  titulo: { fontSize: 16, fontWeight: "bold" },
  critica: { marginTop: 6, fontStyle: "italic", color: "#374151" },
  nota: { marginTop: 4, fontWeight: "bold" },
  interacoes: { flexDirection: "row", gap: 16, marginTop: 8, alignItems: "center" },
  data: { fontSize: 12, opacity: 0.5, marginTop: 8 },
});
