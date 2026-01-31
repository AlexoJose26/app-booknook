import React, { useEffect, useState, useRef } from "react";
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
  Alert,
  KeyboardAvoidingView,
  Platform,
  SafeAreaView,
} from "react-native";
import { useThemeCustom } from "@/contexts/ThemeContext";
import { useLivros, Livro } from "@/contexts/LivrosContext";

export default function Procurar() {
  const { theme } = useThemeCustom();
  const isDark = theme === "dark";
  const { adicionarLivro } = useLivros();

  const [searchTerm, setSearchTerm] = useState("");
  const [resultados, setResultados] = useState<Livro[]>([]);
  const [loading, setLoading] = useState(false);
  const fadeAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(fadeAnim, {
      toValue: 1,
      duration: 300,
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
        )}&maxResults=30`
      );
      const data = await res.json();

      const livrosAPI: Livro[] = (data.items ?? [])
        .map((item: any) => {
          const info = item.volumeInfo ?? {};
          const pdfLink = item.accessInfo?.pdf?.downloadLink;
          if (!pdfLink) return null;

          return {
            id: String(item.id),
            titulo: info.title ?? "Sem título",
            autor: info.authors?.join(", ") ?? "Desconhecido",
            descricao: info.description ?? "",
            imagem: info.imageLinks?.thumbnail ?? "",
            pdfUri: pdfLink,
            status: undefined,
          };
        })
        .filter(Boolean);

      setResultados(livrosAPI);
    } catch (err) {
      console.error(err);
      Alert.alert("Erro", "Falha ao buscar livros.");
    } finally {
      setLoading(false);
    }
  };

  const handleQueroLer = async (livro: Livro) => {
    try {
      await adicionarLivro(livro, "queroLer");

      // Atualiza status localmente para feedback instantâneo
      setResultados((prev) =>
        prev.map((l) => (l.id === livro.id ? { ...l, status: "queroLer" } : l))
      );

      Alert.alert("Sucesso", `"${livro.titulo}" foi adicionado à sua estante.`);
    } catch (err) {
      console.error(err);
      Alert.alert("Erro", "Não foi possível adicionar o livro.");
    }
  };

  const renderLivro = ({ item }: { item: Livro }) => (
    <Animated.View
      style={[
        styles.card,
        { opacity: fadeAnim, backgroundColor: isDark ? "#1F2937" : "#FFF" },
      ]}
    >
      {item.imagem ? (
        <Image source={{ uri: item.imagem }} style={styles.thumb} />
      ) : (
        <View style={styles.thumbPlaceholder}>
          <Text>📘</Text>
        </View>
      )}

      <View style={styles.info}>
        <Text style={[styles.titulo, { color: isDark ? "#FFF" : "#111827" }]}>
          {item.titulo}
        </Text>
        <Text style={styles.autor}>{item.autor}</Text>

        {!item.status ? (
          <TouchableOpacity
            style={styles.btnQuero}
            onPress={() => handleQueroLer(item)}
          >
            <Text style={styles.btnQueroText}>Quero ler</Text>
          </TouchableOpacity>
        ) : (
          <View style={styles.tagAdicionado}>
            <Text style={styles.tagTexto}>Na estante</Text>
          </View>
        )}
      </View>
    </Animated.View>
  );

  return (
    <SafeAreaView style={{ flex: 1 }}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <View style={styles.container}>
          <Text style={[styles.tituloPagina, { color: isDark ? "#FFF" : "#111827" }]}>
            Procurar livros
          </Text>

          <View style={styles.searchBox}>
            <TextInput
              placeholder="Título, autor ou palavra-chave"
              value={searchTerm}
              onChangeText={setSearchTerm}
              style={[styles.input, { backgroundColor: isDark ? "#374151" : "#F3F4F6", color: isDark ? "#FFF" : "#111827" }]}
              placeholderTextColor={isDark ? "#9CA3AF" : "#9CA3AF"}
            />
            <TouchableOpacity style={styles.btnBuscar} onPress={buscarLivros}>
              <Text style={styles.btnBuscarText}>Buscar</Text>
            </TouchableOpacity>
          </View>

          {loading && <ActivityIndicator size="large" style={{ marginTop: 20 }} />}

          <FlatList
            data={resultados}
            keyExtractor={(item) => item.id}
            renderItem={renderLivro}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
          />
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 16 },
  tituloPagina: { fontSize: 26, fontWeight: "700", marginBottom: 14 },
  searchBox: { flexDirection: "row", marginBottom: 14 },
  input: { flex: 1, padding: 14, borderRadius: 14, fontSize: 15 },
  btnBuscar: { marginLeft: 8, backgroundColor: "#4F46E5", paddingHorizontal: 18, borderRadius: 14, justifyContent: "center" },
  btnBuscarText: { color: "#FFF", fontWeight: "600" },
  card: { flexDirection: "row", padding: 14, borderRadius: 18, marginBottom: 12, shadowColor: "#000", shadowOpacity: 0.06, shadowRadius: 6, elevation: 2 },
  thumb: { width: 72, height: 108, borderRadius: 10, marginRight: 12 },
  thumbPlaceholder: { width: 72, height: 108, borderRadius: 10, backgroundColor: "#E5E7EB", justifyContent: "center", alignItems: "center", marginRight: 12 },
  info: { flex: 1, justifyContent: "space-between" },
  titulo: { fontSize: 16, fontWeight: "700" },
  autor: { fontSize: 13, color: "#6B7280", marginTop: 2 },
  btnQuero: { alignSelf: "flex-start", marginTop: 8, paddingHorizontal: 14, paddingVertical: 6, borderRadius: 999, backgroundColor: "#EEF2FF" },
  btnQueroText: { color: "#4338CA", fontSize: 13, fontWeight: "600" },
  tagAdicionado: { alignSelf: "flex-start", marginTop: 8, paddingHorizontal: 12, paddingVertical: 5, borderRadius: 999, backgroundColor: "#DCFCE7" },
  tagTexto: { fontSize: 12, fontWeight: "600", color: "#166534" },
});
