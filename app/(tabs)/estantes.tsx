// app/(tabs)/estantes.tsx
import React, { useState } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  SafeAreaView,
  FlatList,
  Image,
  StyleSheet,
  Modal,
  ActivityIndicator,
} from "react-native";
import { WebView } from "react-native-webview";
import { useThemeCustom } from "@/contexts/ThemeContext";
import { useLivros, Livro, StatusLivro } from "@/contexts/LivrosContext";
import { useRouter } from "expo-router";

export default function Estantes() {
  const { colors } = useThemeCustom();
  const { estantes, atualizarStatus } = useLivros();
  const router = useRouter();

  const [aba, setAba] = useState<StatusLivro>("queroLer");
  const [livroAberto, setLivroAberto] = useState<Livro | null>(null);
  const [loading, setLoading] = useState(false);

  const abrirLivro = async (livro: Livro) => {
    if (!livro.googleReaderLink) return;

    if (livro.status === "queroLer") {
      await atualizarStatus(livro.id, "lendo");
    }

    setLivroAberto(livro);
  };

  const concluir = async () => {
    if (!livroAberto) return;

    await atualizarStatus(livroAberto.id, "lido");
    setLivroAberto(null);

    router.push({
      pathname: "/criticas",
      params: { livroId: livroAberto.id },
    });
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      <Text style={[styles.titulo, { color: colors.text }]}>Minhas Estantes</Text>

      <View style={styles.tabs}>
        {[
          { key: "queroLer", label: "Quero ler" },
          { key: "lendo", label: "Lendo" },
          { key: "lido", label: "Lido" },
        ].map((t) => (
          <TouchableOpacity
            key={t.key}
            style={[
              styles.tab,
              aba === t.key && { backgroundColor: colors.primary },
            ]}
            onPress={() => setAba(t.key as StatusLivro)}
          >
            <Text style={{ color: aba === t.key ? "#FFF" : colors.text }}>
              {t.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      <FlatList
        data={estantes[aba]}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <TouchableOpacity
            style={[styles.card, { backgroundColor: colors.card }]}
            onPress={() => abrirLivro(item)}
          >
            {item.imagem && (
              <Image source={{ uri: item.imagem }} style={styles.thumb} />
            )}
            <View>
              <Text style={{ color: colors.text, fontWeight: "700" }}>
                {item.titulo}
              </Text>
              <Text style={{ color: colors.secondary }}>{item.autor}</Text>
            </View>
          </TouchableOpacity>
        )}
        ListEmptyComponent={
          <Text style={{ color: colors.secondary, textAlign: "center" }}>
            Nenhum livro nesta estante
          </Text>
        }
      />

      {livroAberto && (
        <Modal visible animationType="slide">
          <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }}>
            <TouchableOpacity
              style={[styles.concluir, { backgroundColor: colors.primary }]}
              onPress={concluir}
            >
              <Text style={{ color: "#FFF" }}>Concluir leitura</Text>
            </TouchableOpacity>

            <WebView
              source={{ uri: livroAberto.googleReaderLink! }}
              onLoadStart={() => setLoading(true)}
              onLoadEnd={() => setLoading(false)}
            />

            {loading && (
              <ActivityIndicator size="large" color={colors.primary} />
            )}
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
  thumb: { width: 60, height: 90, borderRadius: 8, marginRight: 12 },
  concluir: { padding: 14, alignItems: "center" },
});
