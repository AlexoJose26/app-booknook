import React, { useEffect, useState } from "react";
import {
  View,
  Text,
  FlatList,
  StyleSheet,
  Image,
  RefreshControl,
  ActivityIndicator,
  StatusBar,
} from "react-native";
import { useThemeCustom } from "@/contexts/ThemeContext";
import { useUsuario } from "@/contexts/UsuarioContext";
import { db } from "@/database/db";
import { usuarios, livros, estantes, criticas } from "@/database/schema";
import { eq, desc } from "drizzle-orm";

/* ================= TIPOS ================= */

type LivroLidoPost = {
  id: number;
  usuarioNome: string;
  usuarioFoto: string | null;
  livroTitulo: string;
  livroAutor: string;
  createdAt: string;
};

type CriticaPost = {
  id: number;
  usuarioNome: string;
  usuarioFoto: string | null;
  livroTitulo: string;
  livroAutor: string;
  texto: string;
  nota: number;
  createdAt: string;
};

/* ================= COMPONENTE ================= */

export default function Feed() {
  const { colors, theme } = useThemeCustom();
  const { usuario } = useUsuario();

  const [livrosLidos, setLivrosLidos] = useState<LivroLidoPost[]>([]);
  const [criticasPublicadas, setCriticasPublicadas] = useState<CriticaPost[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  /* ================= LOAD FEED ================= */

  const carregarFeed = async () => {
    if (!usuario) return;

    try {
      setLoading(true);

      /* ===== LIVROS LIDOS ===== */
      const livrosLidosDB = await db
        .select({
          id: estantes.id,
          createdAt: estantes.createdAt,
          livroTitulo: livros.titulo,
          livroAutor: livros.autor,
          usuarioNome: usuarios.nome,
          usuarioFoto: usuarios.foto_perfil,
        })
        .from(estantes)
        .innerJoin(livros, eq(estantes.livro_id, livros.id))
        .innerJoin(usuarios, eq(estantes.usuario_id, usuarios.id))
        .where(eq(estantes.status, "lido"))
        .orderBy(desc(estantes.createdAt));

      setLivrosLidos(livrosLidosDB);

      /* ===== CRÍTICAS PUBLICADAS ===== */
      const criticasDB = await db
        .select({
          id: criticas.id,
          texto: criticas.texto,
          nota: criticas.nota,
          createdAt: criticas.createdAt,
          livroTitulo: livros.titulo,
          livroAutor: livros.autor,
          usuarioNome: usuarios.nome,
          usuarioFoto: usuarios.foto_perfil,
        })
        .from(criticas)
        .innerJoin(livros, eq(criticas.livro_id, livros.id))
        .innerJoin(usuarios, eq(criticas.usuario_id, usuarios.id))
        .orderBy(desc(criticas.createdAt));

      setCriticasPublicadas(criticasDB);
    } catch (e) {
      console.error("Erro ao carregar feed:", e);
      setLivrosLidos([]);
      setCriticasPublicadas([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    carregarFeed();
  }, [usuario]);

  const onRefresh = async () => {
    setRefreshing(true);
    await carregarFeed();
    setRefreshing(false);
  };

  /* ================= LOADING ================= */

  if (loading) {
    return (
      <View style={[styles.loading, { backgroundColor: colors.background }]}>
        <StatusBar
          barStyle={theme === "dark" ? "light-content" : "dark-content"}
          backgroundColor={colors.background}
        />
        <ActivityIndicator size="large" color={colors.primary} />
        <Text style={{ color: colors.secondary, marginTop: 12 }}>
          Carregando feed...
        </Text>
      </View>
    );
  }

  /* ================= UI ================= */

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <StatusBar
        barStyle={theme === "dark" ? "light-content" : "dark-content"}
        backgroundColor={colors.background}
      />
      <FlatList
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={colors.primary}
          />
        }
        ListHeaderComponent={
          <>
            {/* ===== LIVROS LIDOS ===== */}
            <Text style={[styles.secaoTitulo, { color: colors.text }]}>
              Livros Lidos
            </Text>

            {livrosLidos.length === 0 && (
              <Text style={{ color: colors.secondary, marginBottom: 16 }}>
                Nenhum livro lido ainda
              </Text>
            )}

            {livrosLidos.map((item) => (
              <View
                key={`lido-${item.id}`}
                style={[styles.card, { backgroundColor: colors.card }]}
              >
                <View style={styles.usuarioLinha}>
                  {item.usuarioFoto && (
                    <Image source={{ uri: item.usuarioFoto }} style={styles.avatar} />
                  )}
                  <Text style={{ color: colors.text, fontWeight: "700" }}>
                    {item.usuarioNome}
                  </Text>
                </View>

                <Text style={[styles.livroTitulo, { color: colors.text }]}>{item.livroTitulo}</Text>
                <Text style={{ color: colors.secondary }}>{item.livroAutor}</Text>

                <Text style={[styles.data, { color: colors.secondary }]}>
                  {new Date(item.createdAt).toLocaleString()}
                </Text>
              </View>
            ))}

            {/* ===== CRÍTICAS ===== */}
            <Text
              style={[
                styles.secaoTitulo,
                { color: colors.text, marginTop: 24 },
              ]}
            >
              Críticas Publicadas
            </Text>

            {criticasPublicadas.length === 0 && (
              <Text style={{ color: colors.secondary }}>
                Nenhuma crítica publicada
              </Text>
            )}
          </>
        }
        data={criticasPublicadas}
        keyExtractor={(item) => `critica-${item.id}`}
        contentContainerStyle={{ padding: 16, paddingBottom: 40 }}
        renderItem={({ item }) => (
          <View style={[styles.card, { backgroundColor: colors.card }]}>
            <View style={styles.usuarioLinha}>
              {item.usuarioFoto && (
                <Image source={{ uri: item.usuarioFoto }} style={styles.avatar} />
              )}
              <Text style={{ color: colors.text, fontWeight: "700" }}>
                {item.usuarioNome}
              </Text>
            </View>

            <Text style={[styles.livroTitulo, { color: colors.text }]}>{item.livroTitulo}</Text>
            <Text style={{ color: colors.secondary }}>{item.livroAutor}</Text>

            <Text style={{ color: colors.text, marginVertical: 6 }}>
              {item.texto}
            </Text>

            <Text style={[styles.nota, { color: colors.button }]}>⭐ {item.nota}</Text>

            <Text style={[styles.data, { color: colors.secondary }]}>
              {new Date(item.createdAt).toLocaleString()}
            </Text>
          </View>
        )}
      />
    </View>
  );
}



const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  secaoTitulo: {
    fontSize: 18,
    fontWeight: "700",
    marginBottom: 12,
  },
  card: {
    padding: 14,
    borderRadius: 16,
    marginBottom: 12,
  },
  usuarioLinha: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 6,
    gap: 8,
  },
  avatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
  },
  livroTitulo: {
    fontWeight: "700",
    fontSize: 15,
  },
  nota: {
    fontWeight: "700",
  },
  data: {
    fontSize: 12,
    marginTop: 4,
  },
  loading: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
});
