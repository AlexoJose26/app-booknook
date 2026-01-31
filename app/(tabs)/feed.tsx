import React, { useEffect, useState, useRef, useCallback } from "react";
import {
  View,
  Text,
  FlatList,
  StyleSheet,
  Image,
  ActivityIndicator,
  Animated,
  Pressable,
  RefreshControl,
} from "react-native";
import { useRouter } from "expo-router";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { db } from "@/database/db";
import { criticas, livros, usuarios, estantes, curtidas, comentarios } from "@/database/schema";
import { desc } from "drizzle-orm";
import { useLivros } from "@/contexts/LivrosContext";

type FeedItem = {
  id: string | number;
  tipo: "critica" | "estante";
  data: string;
  livroId: string;
  tituloLivro: string;
  capaLivro?: string;
  usuarioNome: string;
  usuarioFoto?: string | null;
  texto?: string;
  nota?: number;
  curtidasCount?: number;
  curtidoPorMim?: boolean;
  comentarios?: any[];
};

export default function Feed() {
  const router = useRouter();
  const { estantes: estantesContext } = useLivros();
  const [feed, setFeed] = useState<FeedItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const animValues = useRef<Animated.Value[]>([]);
  const [usuarioLogado, setUsuarioLogado] = useState<any>(null);

  const carregarUsuarioLogado = async () => {
    const str = await AsyncStorage.getItem("usuarioLogado");
    if (!str) return null;
    const usuario = JSON.parse(str);
    setUsuarioLogado(usuario);
    return usuario;
  };

  const carregarFeed = useCallback(async () => {
    setLoading(true);
    try {
      const usuario = usuarioLogado || (await carregarUsuarioLogado());

      const usuariosRaw = await db.select().from(usuarios);
      const usuariosMap = Object.fromEntries(usuariosRaw.map(u => [u.id, u]));

      const livrosRaw = await db.select().from(livros);
      const livrosMap = Object.fromEntries(livrosRaw.map(l => [l.id, l]));

      const criticasRaw = await db.select().from(criticas).orderBy(desc(criticas.createdAt));

      const criticasFeed: FeedItem[] = await Promise.all(
        criticasRaw.map(async (c) => {
          const usuarioC = usuariosMap[c.usuario_id] ?? usuario;
          const livro = livrosMap[c.livro_id];

          const curtidasRes = await db.select().from(curtidas).where(curtidas.critica_id.eq(c.id));
          const curtidoPorMim = curtidasRes.some((cu) => cu.usuario_id === usuario?.id);

          const comentariosRes = await db.select().from(comentarios).where(comentarios.critica_id.eq(c.id));

          return {
            id: c.id,
            tipo: "critica",
            data: c.createdAt,
            livroId: c.livro_id,
            tituloLivro: livro?.titulo ?? "Livro",
            capaLivro: livro?.imagem ?? "",
            usuarioNome: usuarioC?.nome ?? "Usuário",
            usuarioFoto: usuarioC?.foto_perfil ?? null,
            texto: c.texto,
            nota: c.nota,
            curtidasCount: curtidasRes.length,
            curtidoPorMim,
            comentarios: comentariosRes,
          };
        })
      );

      const estantesFeed: FeedItem[] = Object.values(estantesContext)
        .flat()
        .map((l: any) => ({
          id: l.id,
          tipo: "estante",
          data: l.createdAt,
          livroId: l.id,
          tituloLivro: l.titulo,
          capaLivro: l.imagem ?? "",
          usuarioNome: usuario?.nome ?? "Você",
          usuarioFoto: usuario?.foto_perfil ?? null,
        }));

      const combinado = [...criticasFeed, ...estantesFeed].sort(
        (a, b) => new Date(b.data).getTime() - new Date(a.data).getTime()
      );

      animValues.current = combinado.map(() => new Animated.Value(0));
      setFeed(combinado);

      Animated.stagger(
        80,
        animValues.current.map(anim =>
          Animated.timing(anim, {
            toValue: 1,
            duration: 400,
            useNativeDriver: true,
          })
        )
      ).start();
    } catch (err) {
      console.error("Erro ao carregar feed:", err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [usuarioLogado, estantesContext]);

  useEffect(() => {
    carregarFeed();

    // Conectar WebSocket para feed em tempo real
    const ws = new WebSocket("wss://seu-servidor.com/feed"); // Substituir URL real

    ws.onmessage = (event) => {
      const data = JSON.parse(event.data);
      // data deve conter nova crítica ou atualização de curtida/comentário
      setFeed((prev) => {
        const existingIndex = prev.findIndex((f) => f.id === data.id && f.tipo === data.tipo);
        if (existingIndex >= 0) {
          const updated = [...prev];
          updated[existingIndex] = { ...updated[existingIndex], ...data };
          return updated;
        } else {
          return [data, ...prev];
        }
      });
    };

    ws.onerror = (err) => console.error("WebSocket erro:", err);

    return () => ws.close();
  }, [carregarFeed]);

  const onRefresh = async () => {
    setRefreshing(true);
    await carregarFeed();
  };

  const renderItem = ({ item, index }: any) => {
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
          <View style={{ flex: 1 }}>
            <Text style={styles.nome}>{item.usuarioNome}</Text>
            <Text style={styles.acao}>
              {item.tipo === "critica" ? "publicou uma crítica" : "adicionou um livro à estante"}
            </Text>
          </View>
        </View>

        <Pressable
          style={styles.livroContainer}
          onPress={() =>
            router.push({ pathname: "/livro", params: { livroId: item.livroId } })
          }
        >
          {item.capaLivro ? (
            <Image source={{ uri: item.capaLivro }} style={styles.capa} />
          ) : (
            <View style={[styles.capa, styles.semCapa]}>
              <Text>Sem capa</Text>
            </View>
          )}

          <View style={{ flex: 1, marginLeft: 12 }}>
            <Text style={styles.titulo}>{item.tituloLivro}</Text>
            {item.tipo === "critica" && (
              <>
                <Text style={styles.critica}>“{item.texto}”</Text>
                <Text style={styles.nota}>⭐ {item.nota}/10</Text>
                <Text style={{ marginTop: 4 }}>
                  ❤️ {item.curtidasCount ?? 0} | 💬 {item.comentarios?.length ?? 0}
                </Text>
              </>
            )}
          </View>
        </Pressable>

        <Text style={styles.data}>{new Date(item.data).toLocaleString()}</Text>
      </Animated.View>
    );
  };

  if (loading && feed.length === 0) {
    return (
      <View style={styles.loading}>
        <ActivityIndicator size="large" color="#3B82F6" />
        <Text style={{ marginTop: 8 }}>Carregando feed...</Text>
      </View>
    );
  }

  return (
    <FlatList
      data={feed}
      keyExtractor={item => `${item.tipo}-${item.id}`}
      renderItem={renderItem}
      contentContainerStyle={styles.container}
      showsVerticalScrollIndicator={false}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
    />
  );
}

const styles = StyleSheet.create({
  container: { padding: 12, paddingBottom: 24 },
  loading: { flex: 1, justifyContent: "center", alignItems: "center" },
  card: { backgroundColor: "#FFF", padding: 16, borderRadius: 16, marginBottom: 16, elevation: 3 },
  header: { flexDirection: "row", alignItems: "center", marginBottom: 12 },
  avatar: { width: 48, height: 48, borderRadius: 24, marginRight: 12 },
  avatarPlaceholder: { width: 48, height: 48, borderRadius: 24, backgroundColor: "#E5E7EB", justifyContent: "center", alignItems: "center", marginRight: 12 },
  nome: { fontWeight: "bold", fontSize: 16 },
  acao: { fontSize: 13, color: "#6B7280" },
  livroContainer: { flexDirection: "row", alignItems: "center" },
  capa: { width: 70, height: 100, borderRadius: 8 },
  semCapa: { backgroundColor: "#E5E7EB", justifyContent: "center", alignItems: "center" },
  titulo: { fontSize: 16, fontWeight: "bold" },
  critica: { marginTop: 6, fontStyle: "italic" },
  nota: { marginTop: 4, fontWeight: "bold", color: "#F59E0B" },
  data: { fontSize: 12, opacity: 0.5, marginTop: 8 },
  curtidas: { marginTop: 4, fontSize: 13 },
});
