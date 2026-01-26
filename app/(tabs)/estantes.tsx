import React, { useCallback, useState } from "react";
import {
  View,
  Text,
  SectionList,
  StyleSheet,
  Image,
  TouchableOpacity,
  Alert,
  SafeAreaView,
  ActivityIndicator,
} from "react-native";
import { useRouter, useFocusEffect } from "expo-router";
import { db } from "@/database/db";
import { estantes, livros } from "@/database/schema";
import { eq } from "drizzle-orm";
import { Ionicons } from "@expo/vector-icons";

export type StatusLivro = "Lidos" | "A Ler" | "Quero Ler";

export type LivroEstante = {
  id: string;
  livroId: string;
  titulo: string;
  autor: string;
  descricao?: string;
  imagem?: string;
  status: StatusLivro;
  pdfUri?: string;
};

const STATUS_META = {
  Lidos: { cor: "#DCFCE7", icon: "checkmark-circle", texto: "#166534" },
  "A Ler": { cor: "#DBEAFE", icon: "book", texto: "#1E40AF" },
  "Quero Ler": { cor: "#EDE9FE", icon: "star", texto: "#5B21B6" },
};

export default function Estantes() {
  const router = useRouter();
  const [secoes, setSecoes] = useState<{ title: StatusLivro; data: LivroEstante[] }[]>([
    { title: "Lidos", data: [] },
    { title: "A Ler", data: [] },
    { title: "Quero Ler", data: [] },
  ]);
  const [carregando, setCarregando] = useState(true);

  const carregarEstantes = async () => {
    try {
      setCarregando(true);
      const rows = await db
        .select({
          estanteId: estantes.id,
          livroId: livros.id,
          titulo: livros.titulo,
          autor: livros.autor,
          descricao: livros.descricao,
          imagem: livros.imagem,
          pdfUri: livros.pdfUri,
          status: estantes.status,
        })
        .from(estantes)
        .innerJoin(livros, eq(estantes.livro_id, livros.id));

      const agrupado: Record<StatusLivro, LivroEstante[]> = {
        Lidos: [],
        "A Ler": [],
        "Quero Ler": [],
      };

      rows.forEach((r) => {
        agrupado[r.status as StatusLivro].push({
          id: r.estanteId.toString(),
          livroId: r.livroId,
          titulo: r.titulo,
          autor: r.autor ?? "Desconhecido",
          descricao: r.descricao ?? undefined,
          imagem: r.imagem ?? undefined,
          pdfUri: r.pdfUri ?? undefined,
          status: r.status as StatusLivro,
        });
      });

      // Ordena Lidos por mais recente
      agrupado["Lidos"].sort((a, b) => parseInt(b.id) - parseInt(a.id));

      setSecoes([
        { title: "Lidos", data: agrupado.Lidos },
        { title: "A Ler", data: agrupado["A Ler"] },
        { title: "Quero Ler", data: agrupado["Quero Ler"] },
      ]);
    } catch (err) {
      console.error(err);
      Alert.alert("Erro", "Não foi possível carregar as estantes");
    } finally {
      setCarregando(false);
    }
  };

  useFocusEffect(
    useCallback(() => {
      carregarEstantes();
    }, [])
  );

  const abrirLivro = async (livro: LivroEstante) => {
    if (livro.status === "Lidos") {
      router.push(`/criticas?livroId=${livro.livroId}`);
      return;
    }

    if (!livro.pdfUri) {
      Alert.alert("PDF não disponível para este livro");
      return;
    }

    try {
      await db.update(estantes).set({ status: "Lidos" }).where(eq(estantes.id, parseInt(livro.id)));
      carregarEstantes();

      router.push(
        `/pdfReader?pdfUri=${encodeURIComponent(livro.pdfUri)}&titulo=${encodeURIComponent(livro.titulo)}`
      );
    } catch (err) {
      console.error(err);
      Alert.alert("Erro ao abrir livro");
    }
  };

  const renderLivro = ({ item }: { item: LivroEstante }) => {
    const meta = STATUS_META[item.status];
    return (
      <TouchableOpacity style={styles.card} onPress={() => abrirLivro(item)}>
        <View style={styles.headerCard}>
          <View style={styles.avatar}>
            {item.imagem ? (
              <Image source={{ uri: item.imagem }} style={styles.avatarImg} />
            ) : (
              <Ionicons name="book-outline" size={26} color="#6B7280" />
            )}
          </View>

          <View style={{ flex: 1 }}>
            <Text style={styles.titulo}>{item.titulo}</Text>
            <Text style={styles.autor}>{item.autor}</Text>
          </View>

          <View style={[styles.badge, { backgroundColor: meta.cor }]}>
            <Ionicons name={meta.icon as any} size={14} color={meta.texto} />
            <Text style={[styles.badgeText, { color: meta.texto }]}>{item.status}</Text>
          </View>
        </View>

        {item.descricao && (
          <Text style={styles.descricao} numberOfLines={3}>
            {item.descricao}
          </Text>
        )}
      </TouchableOpacity>
    );
  };

  if (carregando) {
    return (
      <View style={styles.loading}>
        <ActivityIndicator size="large" />
        <Text>Carregando estantes…</Text>
      </View>
    );
  }

  return (
    <SafeAreaView style={{ flex: 1 }}>
      <SectionList
        sections={secoes}
        keyExtractor={(item) => item.id}
        renderItem={renderLivro}
        renderSectionHeader={({ section }) =>
          section.data.length > 0 && <Text style={styles.section}>{section.title}</Text>
        }
        stickySectionHeadersEnabled
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  loading: { flex: 1, justifyContent: "center", alignItems: "center" },
  section: { fontSize: 18, fontWeight: "bold", marginHorizontal: 16, marginTop: 20, color: "#111827" },
  card: { backgroundColor: "#FFF", marginHorizontal: 16, marginTop: 12, padding: 14, borderRadius: 16, elevation: 3 },
  headerCard: { flexDirection: "row", alignItems: "center" },
  avatar: { width: 48, height: 48, borderRadius: 24, backgroundColor: "#F3F4F6", justifyContent: "center", alignItems: "center", marginRight: 12 },
  avatarImg: { width: 48, height: 48, borderRadius: 24 },
  titulo: { fontSize: 15, fontWeight: "bold", color: "#111827" },
  autor: { fontSize: 12, color: "#6B7280" },
  badge: { flexDirection: "row", alignItems: "center", paddingHorizontal: 8, paddingVertical: 4, borderRadius: 999 },
  badgeText: { fontSize: 11, marginLeft: 4, fontWeight: "600" },
  descricao: { fontSize: 13, color: "#374151", marginTop: 8 },
});
