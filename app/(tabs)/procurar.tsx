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
} from "react-native";
import { useThemeCustom } from "@/contexts/ThemeContext";
import { useRouter } from "expo-router";
import { db } from "@/database/db";
import {
  livros as livrosSchema,
  estantes as estantesSchema,
  feed as feedSchema,
} from "@/database/schema";

export type Livro = {
  id: string;
  titulo: string;
  autor: string;
  descricao?: string;
  imagem?: string;
  status?: "Quero Ler" | "A Ler" | "Lidos";
  pdfUri: string; // agora obrigatoriamente existe
};

export default function Procurar() {
  const { theme } = useThemeCustom();
  const isDark = theme === "dark";
  const router = useRouter();

  const [searchTerm, setSearchTerm] = useState("");
  const [resultados, setResultados] = useState<Livro[]>([]);
  const [loading, setLoading] = useState(false);
  const fadeAnim = useRef(new Animated.Value(0)).current;

  const usuarioLogado = "usuario1"; // Substituir pelo usuário real logado

  useEffect(() => {
    Animated.timing(fadeAnim, {
      toValue: 1,
      duration: 400,
      useNativeDriver: true,
    }).start();
  }, []);

  /* =======================
     BUSCAR LIVROS (APENAS COM PDF)
  ======================== */
  const buscarLivros = async () => {
    Keyboard.dismiss();

    if (!searchTerm.trim()) return;

    setLoading(true);

    try {
      const response = await fetch(
        `https://www.googleapis.com/books/v1/volumes?q=${encodeURIComponent(
          searchTerm
        )}&maxResults=20`
      );

      if (!response.ok) throw new Error("Erro na busca");

      const data = await response.json();

      if (!data.items || data.items.length === 0) {
        setResultados([]);
        return;
      }

      // Filtrar apenas livros com PDF
      const livrosPDF: Livro[] = data.items
        .map((item: any) => {
          const pdfUri = item.accessInfo?.pdf?.downloadLink;
          if (!pdfUri) return null;
          return {
            id: item.id,
            titulo: item.volumeInfo.title ?? "Sem título",
            autor: item.volumeInfo.authors?.join(", ") ?? "Desconhecido",
            descricao: item.volumeInfo.description ?? "",
            imagem: item.volumeInfo.imageLinks?.thumbnail,
            pdfUri,
          };
        })
        .filter((l: Livro | null): l is Livro => l !== null);

      setResultados(livrosPDF);

      // Salvar livros no banco local
      for (const livro of livrosPDF) {
        try {
          await db.insert(livrosSchema).values({
            id: livro.id,
            titulo: livro.titulo,
            autor: livro.autor,
            descricao: livro.descricao,
            imagem: livro.imagem ?? "",
            pdfUri: livro.pdfUri,
          });
        } catch {
          // ignora duplicados
        }
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  /* =======================
     ADICIONAR AO FEED
  ======================== */
  const adicionarAoFeed = async (livro: Livro, acao: string) => {
    try {
      await db.insert(feedSchema).values({
        usuario_id: usuarioLogado,
        acao,
        livro_titulo: livro.titulo,
        data: new Date().toISOString(),
      });
    } catch (err) {
      console.error("Erro ao adicionar livro:", err);
    }
  };

  /* =======================
     ADICIONAR À ESTANTE
  ======================== */
  const adicionarEstante = async (
    livro: Livro,
    status: "Quero Ler" | "A Ler" | "Lidos"
  ) => {
    try {
      await db.insert(estantesSchema).values({
        usuario_id: usuarioLogado,
        livro_id: livro.id,
        status,
        createdAt: new Date().toISOString(),
      });

      setResultados((prev) =>
        prev.map((l) => (l.id === livro.id ? { ...l, status } : l))
      );

      await adicionarAoFeed(livro, `adicionou o livro à estante "${status}"`);

      router.replace("/estantes"); // redireciona automaticamente
    } catch (err) {
      console.error(err);
    }
  };

  /* =======================
     RENDER ITEM
  ======================== */
  const renderLivro = ({ item }: { item: Livro }) => (
    <Animated.View
      style={[
        styles.card,
        {
          opacity: fadeAnim,
          backgroundColor: isDark ? "#1F2937" : "#FFFFFF",
        },
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
        <Text numberOfLines={3} style={styles.desc}>
          {item.descricao}
        </Text>

        {!item.status && (
          <TouchableOpacity
            style={styles.btn}
            onPress={() => adicionarEstante(item, "Quero Ler")}
          >
            <Text style={styles.btnText}>Quero Ler</Text>
          </TouchableOpacity>
        )}
      </View>
    </Animated.View>
  );

  /* =======================
     UI PRINCIPAL
  ======================== */
  return (
    <View style={styles.container}>
      <Text style={styles.tituloPagina}>Procurar Livros</Text>

      <View style={styles.searchBox}>
        <TextInput
          placeholder="Pesquisar livro..."
          value={searchTerm}
          onChangeText={setSearchTerm}
          onSubmitEditing={buscarLivros}
          style={[
            styles.input,
            {
              backgroundColor: isDark ? "#374151" : "#FFF",
              color: isDark ? "#FFF" : "#000",
            },
          ]}
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
        contentContainerStyle={{ paddingBottom: 20 }}
      />
    </View>
  );
}

/* =======================
   STYLES
======================= */
const styles = StyleSheet.create({
  container: { flex: 1, padding: 16 },
  tituloPagina: { fontSize: 24, fontWeight: "bold", marginBottom: 12 },
  searchBox: { flexDirection: "row", marginBottom: 12 },
  input: { flex: 1, padding: 12, borderRadius: 8 },
  btnBuscar: {
    backgroundColor: "#4F46E5",
    padding: 12,
    marginLeft: 8,
    borderRadius: 8,
  },
  btnText: { color: "#FFF", fontWeight: "bold", fontSize: 12 },
  card: {
    flexDirection: "row",
    padding: 12,
    borderRadius: 14,
    marginBottom: 10,
  },
  thumb: { width: 80, height: 120, borderRadius: 8, marginRight: 10 },
  thumbPlaceholder: {
    width: 80,
    height: 120,
    backgroundColor: "#E5E7EB",
    alignItems: "center",
    justifyContent: "center",
    marginRight: 10,
  },
  info: { flex: 1 },
  titulo: { fontSize: 16, fontWeight: "bold" },
  autor: { fontSize: 13, color: "#6B7280" },
  desc: { fontSize: 12, marginTop: 4 },
  btn: {
    backgroundColor: "#4F46E5",
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
    alignSelf: "flex-start",
    marginTop: 8,
  },
});
