// app/(tabs)/procurar.tsx
import React, { useState, useEffect, useRef } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  FlatList,
  Image,
  StyleSheet,
  Keyboard,
  ActivityIndicator,
  Animated,
  KeyboardAvoidingView,
  Platform,
  SafeAreaView,
} from "react-native";
import { useThemeCustom } from "@/contexts/ThemeContext";
import { useLivros, Livro } from "@/contexts/LivrosContext";

export default function Procurar() {
  const { theme, colors } = useThemeCustom();
  const { adicionarLivro, estantes } = useLivros();
  const isDark = theme === "dark";

  const [searchTerm, setSearchTerm] = useState("");
  const [resultados, setResultados] = useState<Livro[]>([]);
  const [loading, setLoading] = useState(false);

  const fadeAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(fadeAnim, {
      toValue: 1,
      duration: 250,
      useNativeDriver: true,
    }).start();
  }, []);

  const buscarLivros = async () => {
    Keyboard.dismiss();
    if (!searchTerm.trim()) return;

    setLoading(true);

    try {
      const res = await fetch(
        `https://www.googleapis.com/books/v1/volumes?q=${encodeURIComponent(
          searchTerm
        )}`
      );
      const data = await res.json();

      const livrosAPI: Livro[] = (data.items ?? [])
        .map((item: any) => {
          const info = item.volumeInfo;
          if (!info?.title) return null;

          const reader =
            item.accessInfo?.webReaderLink || info.previewLink;

          if (!reader) return null;

          return {
            id: item.id,
            titulo: info.title,
            autor: info.authors?.join(", ") ?? "Desconhecido",
            imagem: info.imageLinks?.thumbnail,
            googleReaderLink: reader,
          };
        })
        .filter(Boolean);

      const livrosComStatus = livrosAPI.map((livro) => {
        const status = (["queroLer", "lendo", "lido"] as const).find(
          (s) => estantes[s]?.some((l) => l.id === livro.id)
        );
        return { ...livro, status };
      });

      setResultados(livrosComStatus);
    } catch (e) {
      console.error(e);
      setResultados([]);
    } finally {
      setLoading(false);
    }
  };

  const adicionar = async (livro: Livro) => {
    if (livro.status) return;
    await adicionarLivro(livro, "queroLer");

    setResultados((prev) =>
      prev.map((l) =>
        l.id === livro.id ? { ...l, status: "queroLer" } : l
      )
    );
  };

  const renderLivro = ({ item }: { item: Livro }) => (
    <Animated.View
      style={[
        styles.card,
        {
          opacity: fadeAnim,
          backgroundColor: colors.card,
        },
      ]}
    >
      {item.imagem && (
        <Image source={{ uri: item.imagem }} style={styles.thumb} />
      )}

      <View style={styles.info}>
        <Text style={[styles.titulo, { color: colors.text }]}>
          {item.titulo}
        </Text>
        <Text style={{ color: colors.secondary }}>{item.autor}</Text>

        {!item.status ? (
          <TouchableOpacity
            style={[styles.btn, { backgroundColor: colors.primary }]}
            onPress={() => adicionar(item)}
          >
            <Text style={{ color: "#FFF" }}>Quero ler</Text>
          </TouchableOpacity>
        ) : (
          <Text style={{ marginTop: 6, color: colors.success }}>
            Já está na estante
          </Text>
        )}
      </View>
    </Animated.View>
  );

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        style={{ flex: 1 }}
      >
        <View style={styles.searchRow}>
          <TextInput
            placeholder="Buscar livro"
            placeholderTextColor={colors.secondary}
            value={searchTerm}
            onChangeText={setSearchTerm}
            style={[
              styles.input,
              { backgroundColor: colors.input, color: colors.text },
            ]}
          />

          <TouchableOpacity
            style={[styles.btnBuscar, { backgroundColor: colors.primary }]}
            onPress={buscarLivros}
          >
            <Text style={{ color: "#FFF", fontWeight: "600" }}>Buscar</Text>
          </TouchableOpacity>
        </View>

        {loading && <ActivityIndicator size="large" color={colors.primary} />}

        <FlatList
          data={resultados}
          keyExtractor={(item) => item.id}
          renderItem={renderLivro}
          showsVerticalScrollIndicator={false}
        />
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 16 },
  searchRow: { flexDirection: "row", gap: 8, marginBottom: 14 },
  input: { flex: 1, padding: 14, borderRadius: 14 },
  btnBuscar: { paddingHorizontal: 18, borderRadius: 14, justifyContent: "center" },
  card: { flexDirection: "row", padding: 14, borderRadius: 18, marginBottom: 12 },
  thumb: { width: 72, height: 108, borderRadius: 10, marginRight: 12 },
  info: { flex: 1, justifyContent: "space-between" },
  titulo: { fontSize: 16, fontWeight: "700" },
  btn: { marginTop: 8, padding: 8, borderRadius: 20, alignSelf: "flex-start" },
});
