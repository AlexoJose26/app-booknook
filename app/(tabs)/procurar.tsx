import React, { useState } from "react";
import {
  View,
  Text,
  FlatList,
  TextInput,
  StyleSheet,
  TouchableOpacity,
  Image,
  ActivityIndicator,
  Alert,
} from "react-native";
import { useThemeCustom } from "@/contexts/ThemeContext";
import { useLivros, Livro } from "@/contexts/LivrosContext";
import { useUsuario } from "@/contexts/UsuarioContext";
import { useRouter } from "expo-router";

export default function Procurar() {
  const { colors } = useThemeCustom();
  const { livrosProcurar, setLivrosProcurar, adicionarLivroNaEstante } = useLivros();
  const { usuario } = useUsuario();
  const router = useRouter();

  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(false);
  const [livrosAdicionados, setLivrosAdicionados] = useState<string[]>([]);

  // Buscar livros via Google Books API
  const buscarLivros = async () => {
    if (!query.trim()) return;
    setLoading(true);

    try {
      const response = await fetch(
        `https://www.googleapis.com/books/v1/volumes?q=${encodeURIComponent(query)}`
      );
      const data = await response.json();

      if (!data.items || data.items.length === 0) {
        Alert.alert("Nenhum livro encontrado", "Tente outro termo de busca.");
        setLivrosProcurar([]);
        setLoading(false);
        return;
      }

      const resultados: Livro[] = data.items.map((item: any) => ({
        id: item.id,
        titulo: item.volumeInfo.title,
        autor: item.volumeInfo.authors?.join(", ") || "Autor desconhecido",
        imagem: item.volumeInfo.imageLinks?.thumbnail || null,
        googleReaderLink: item.volumeInfo.previewLink || null,
      }));

      setLivrosProcurar(resultados);
    } catch (e) {
      console.error("Erro ao buscar livros:", e);
      Alert.alert("Erro", "Não foi possível buscar os livros.");
    } finally {
      setLoading(false);
    }
  };

  // Adicionar livro à estante
  const handleQueroLer = async (livro: Livro) => {
    if (!usuario) {
      Alert.alert("Não logado", "Você precisa estar logado para adicionar um livro!");
      return;
    }

    try {
      await adicionarLivroNaEstante(livro, usuario.id);
      setLivrosAdicionados((prev) => [...prev, livro.id]);

      // Redireciona para Estantes na aba "queroLer" e abre o livro automaticamente
      router.push({
        pathname: "/estantes",
        params: { aba: "queroLer", livroId: livro.id },
      });
    } catch (e) {
      console.error("Erro ao adicionar livro:", e);
      Alert.alert("Erro", "Não foi possível adicionar o livro.");
    }
  };

  const renderLivro = ({ item }: { item: Livro }) => {
    const desabilitado = livrosAdicionados.includes(item.id);

    return (
      <View style={[styles.card, { backgroundColor: colors.card }]}>
        {item.imagem && <Image source={{ uri: item.imagem }} style={styles.thumb} />}
        <View style={{ flex: 1, justifyContent: "center", marginLeft: 12 }}>
          <Text style={{ color: colors.text, fontWeight: "700" }}>{item.titulo}</Text>
          <Text style={{ color: colors.secondary }}>{item.autor}</Text>
          <TouchableOpacity
            style={[styles.botao, { backgroundColor: desabilitado ? "#888" : colors.primary }]}
            onPress={() => handleQueroLer(item)}
            disabled={desabilitado}
          >
            <Text style={{ color: "#FFF", fontWeight: "700" }}>
              {desabilitado ? "Adicionado" : "Quero ler"}
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  };

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <View style={styles.searchContainer}>
        <TextInput
          style={[styles.input, { borderColor: colors.primary, color: colors.text }]}
          placeholder="Buscar livro"
          placeholderTextColor={colors.secondary}
          value={query}
          onChangeText={setQuery}
        />
        <TouchableOpacity style={[styles.buscarBtn, { backgroundColor: colors.primary }]} onPress={buscarLivros}>
          <Text style={{ color: "#FFF", fontWeight: "700" }}>Buscar</Text>
        </TouchableOpacity>
      </View>

      {loading ? (
        <View style={[styles.loading, { backgroundColor: colors.background }]}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={{ color: colors.secondary, marginTop: 12 }}>Buscando livros...</Text>
        </View>
      ) : (
        <FlatList
          data={livrosProcurar}
          keyExtractor={(item) => item.id}
          renderItem={renderLivro}
          contentContainerStyle={{ padding: 16 }}
          ListEmptyComponent={
            <Text style={{ color: colors.secondary, textAlign: "center", marginTop: 40 }}>
              Nenhum livro encontrado
            </Text>
          }
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  searchContainer: { flexDirection: "row", padding: 16, gap: 8 },
  input: { flex: 1, borderWidth: 1, borderRadius: 12, paddingHorizontal: 12, height: 44 },
  buscarBtn: { paddingHorizontal: 16, justifyContent: "center", borderRadius: 12 },
  card: { flexDirection: "row", padding: 14, borderRadius: 16, marginBottom: 12 },
  thumb: { width: 60, height: 90, borderRadius: 8 },
  botao: { marginTop: 8, padding: 8, borderRadius: 12, alignItems: "center" },
  loading: { flex: 1, justifyContent: "center", alignItems: "center" },
});
