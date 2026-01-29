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
      duration: 400,
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
        )}&maxResults=40`
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
          };
        })
        .filter(Boolean);

      setResultados(livrosAPI);
    } catch (err) {
      Alert.alert("Erro", "Falha ao buscar livros.");
    } finally {
      setLoading(false);
    }
  };

  const handleQueroLer = async (livro: Livro) => {
    try {
      // Garantir todos os campos como string
      const livroSeguro: Livro = {
        id: String(livro.id),
        titulo: livro.titulo ?? "",
        autor: livro.autor ?? "",
        descricao: livro.descricao ?? "",
        imagem: livro.imagem ?? "",
        pdfUri: livro.pdfUri ?? "",
      };

      await adicionarLivro(livroSeguro, "queroLer");

      setResultados((prev) =>
        prev.map((l) =>
          l.id === livro.id ? { ...l, status: "queroLer" } : l
        )
      );

      Alert.alert("Sucesso", `"${livro.titulo}" adicionado à estante`);
    } catch (err) {
      console.error("Erro ao adicionar livro:", err);
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
          <Text>Sem imagem</Text>
        </View>
      )}

      <View style={styles.info}>
        <Text style={[styles.titulo, { color: isDark ? "#FFF" : "#000" }]}>
          {item.titulo}
        </Text>
        <Text style={styles.autor}>{item.autor}</Text>

        {!item.status && (
          <TouchableOpacity
            style={styles.btn}
            onPress={() => handleQueroLer(item)}
          >
            <Text style={styles.btnText}>Quero Ler</Text>
          </TouchableOpacity>
        )}
      </View>
    </Animated.View>
  );

  return (
    <View style={styles.container}>
      <Text style={styles.tituloPagina}>Procurar Livros</Text>

      <View style={styles.searchBox}>
        <TextInput
          placeholder="Pesquisar livro..."
          value={searchTerm}
          onChangeText={setSearchTerm}
          style={styles.input}
        />
        <TouchableOpacity style={styles.btnBuscar} onPress={buscarLivros}>
          <Text style={styles.btnText}>Buscar</Text>
        </TouchableOpacity>
      </View>

      {loading && <ActivityIndicator size="large" />}

      <FlatList
        data={resultados}
        keyExtractor={(item) => item.id}
        renderItem={renderLivro}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 16 },
  tituloPagina: { fontSize: 24, fontWeight: "bold", marginBottom: 12 },
  searchBox: { flexDirection: "row", marginBottom: 12 },
  input: { flex: 1, padding: 12, borderRadius: 8, backgroundColor: "#FFF" },
  btnBuscar: { backgroundColor: "#4F46E5", padding: 12, marginLeft: 8, borderRadius: 8 },
  btnText: { color: "#FFF", fontWeight: "bold" },
  card: { flexDirection: "row", padding: 12, borderRadius: 14, marginBottom: 10 },
  thumb: { width: 80, height: 120, borderRadius: 8, marginRight: 10 },
  thumbPlaceholder: { width: 80, height: 120, justifyContent: "center", alignItems: "center" },
  info: { flex: 1 },
  titulo: { fontSize: 16, fontWeight: "bold" },
  autor: { fontSize: 13, color: "#6B7280" },
  btn: { marginTop: 8, backgroundColor: "#4F46E5", padding: 8, borderRadius: 8 },
});
