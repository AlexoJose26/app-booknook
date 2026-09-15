
import React, { useEffect, useState } from "react";
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  SafeAreaView,
  Image,
  Modal,
  ActivityIndicator,
  StyleSheet,
  Alert,
} from "react-native";
import { WebView } from "react-native-webview";
import { useThemeCustom } from "@/contexts/ThemeContext";
import { useUsuario } from "@/contexts/UsuarioContext";
import { db } from "@/database/db";
import { estantes, livros } from "@/database/schema";
import { eq } from "drizzle-orm";
import { useLivros } from "@/contexts/LivrosContext";

type StatusLivro = "queroLer" | "lendo" | "lido";

type LivroEstante = {
  estanteId: number;
  livroId: string;
  titulo: string;
  autor: string | null;
  imagem: string | null;
  googleReaderLink: string | null;
  status: StatusLivro;
};

export default function Estantes({ route }: any) {
  const { colors } = useThemeCustom();
  const { usuario } = useUsuario();
  const { livroAbrirAutomatico } = useLivros();

  const [aba, setAba] = useState<StatusLivro>("queroLer");
  const [livrosEstante, setLivrosEstante] = useState<LivroEstante[]>([]);
  const [livroAberto, setLivroAberto] = useState<LivroEstante | null>(null);
  const [loading, setLoading] = useState(false);

  const carregarEstantes = async () => {
    if (!usuario) return;
    setLoading(true);

    try {
      const dados = await db
        .select({
          estanteId: estantes.id,
          status: estantes.status,
          livroId: livros.id,
          titulo: livros.titulo,
          autor: livros.autor,
          imagem: livros.imagem,
          googleReaderLink: livros.googleReaderLink,
        })
        .from(estantes)
        .innerJoin(livros, eq(estantes.livro_id, livros.id))
        .where(eq(estantes.usuario_id, usuario.id));

      setLivrosEstante(
        dados.map((l) => ({
          estanteId: l.estanteId,
          livroId: l.livroId,
          titulo: l.titulo,
          autor: l.autor || "Autor desconhecido",
          imagem: l.imagem || null,
          googleReaderLink: l.googleReaderLink || null,
          status: l.status as StatusLivro,
        }))
      );

      if (livroAbrirAutomatico) {
        const livro = dados.find((l) => l.livroId === livroAbrirAutomatico);
        if (livro) abrirLivro(livro);
      }
    } catch (e) {
      console.error("Erro ao carregar estantes:", e);
      setLivrosEstante([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    carregarEstantes();
  }, [usuario]);

  const abrirLivro = async (livro: LivroEstante) => {
    if (!livro.googleReaderLink) {
      Alert.alert("Livro sem link", "Este livro não possui link para leitura.");
      return;
    }

    setLivroAberto(livro);
  };

  const atualizarStatus = async (estanteId: number, status: StatusLivro) => {
    await db.update(estantes).set({ status }).where(eq(estantes.id, estanteId));
    carregarEstantes();
  };

  const concluirLeitura = async () => {
    if (!livroAberto) return;
    await atualizarStatus(livroAberto.estanteId, "lido");
    setLivroAberto(null);
    setAba("lido");
  };

  const livrosFiltrados = livrosEstante.filter((l) => l.status === aba);

  const renderLivro = ({ item }: { item: LivroEstante }) => (
    <TouchableOpacity
      style={[styles.card, { backgroundColor: colors.card }]}
      onPress={() => abrirLivro(item)}
    >
      {item.imagem && <Image source={{ uri: item.imagem }} style={styles.thumb} />}
      <View style={{ flex: 1, marginLeft: 12 }}>
        <Text style={[styles.tituloLivro, { color: colors.text }]}>{item.titulo}</Text>
        <Text style={{ color: colors.secondary }}>{item.autor}</Text>
        <Text style={{ marginTop: 4 }}>
          {item.status === "queroLer"
            ? "📖 Quero ler"
            : item.status === "lendo"
            ? "📖 Lendo"
            : "✅ Lido"}
        </Text>
      </View>
    </TouchableOpacity>
  );

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      <Text style={[styles.titulo, { color: colors.text }]}>Minhas Estantes</Text>

      <View style={styles.tabs}>
        {(["queroLer", "lendo", "lido"] as StatusLivro[]).map((s) => (
          <TouchableOpacity
            key={s}
            style={[styles.tab, aba === s && { backgroundColor: colors.primary }]}
            onPress={() => setAba(s)}
          >
            <Text style={{ color: aba === s ? "#FFF" : colors.text }}>
              {s === "queroLer" ? "Quero ler" : s === "lendo" ? "Lendo" : "Lido"}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {loading ? (
        <View style={{ flex: 1, justifyContent: "center", alignItems: "center" }}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      ) : (
        <FlatList
          data={livrosFiltrados}
          keyExtractor={(item) => item.estanteId.toString()}
          renderItem={renderLivro}
          ListEmptyComponent={
            <Text style={{ textAlign: "center", marginTop: 40, color: colors.secondary }}>
              Nenhum livro nesta estante
            </Text>
          }
        />
      )}

      {livroAberto && (
        <Modal visible animationType="slide">
          <SafeAreaView style={{ flex: 1 }}>
            <WebView source={{ uri: livroAberto.googleReaderLink! }} />
            <TouchableOpacity
              style={[styles.concluir, { backgroundColor: colors.primary }]}
              onPress={concluirLeitura}
            >
              <Text style={{ color: "#FFF", fontWeight: "700" }}>Concluir leitura</Text>
            </TouchableOpacity>
          </SafeAreaView>
        </Modal>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 16 },
  titulo: { fontSize: 26, fontWeight: "700", marginBottom: 12 },
  tabs: { flexDirection: "row", gap: 8, marginBottom: 16 },
  tab: { paddingVertical: 8, paddingHorizontal: 16, borderRadius: 20 },
  card: { flexDirection: "row", padding: 14, borderRadius: 16, marginBottom: 12 },
  thumb: { width: 60, height: 90, borderRadius: 8 },
  tituloLivro: { fontWeight: "700" },
  concluir: { padding: 16, alignItems: "center" },
});
