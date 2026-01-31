import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  SectionList,
  StyleSheet,
  Image,
  TouchableOpacity,
  SafeAreaView,
  Modal,
  Button,
  Alert,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { WebView } from "react-native-webview";
import { useLivros, Livro } from "@/contexts/LivrosContext";
import { useRouter } from "expo-router";
import AsyncStorage from "@react-native-async-storage/async-storage";

const STATUS_LABEL = { lendo: "A Ler", queroLer: "Quero Ler", lido: "Lidos" };

const STATUS_META = {
  lendo: { cor: "#DBEAFE", icon: "book", texto: "#1E40AF" },
  queroLer: { cor: "#EDE9FE", icon: "star", texto: "#5B21B6" },
  lido: { cor: "#DCFCE7", icon: "checkmark-circle", texto: "#166534" },
};

export default function Estantes() {
  const { estantes, atualizarStatus } = useLivros();
  const [livroAtivo, setLivroAtivo] = useState<Livro | null>(null);
  const [usuario, setUsuario] = useState<{ id: string; nome: string } | null>(null);
  const router = useRouter();

  useEffect(() => {
    const carregarUsuario = async () => {
      const userStr = await AsyncStorage.getItem("usuarioLogado");
      if (!userStr) return router.replace("/login");
      setUsuario(JSON.parse(userStr));
    };
    carregarUsuario();
  }, [router]);

  const sections = Object.entries(estantes ?? {})
    .map(([key, data]) => ({
      title: STATUS_LABEL[key as keyof typeof STATUS_LABEL],
      key,
      data,
    }))
    .filter((s) => s.data.length > 0);

  const concluirLeitura = async (livro: Livro) => {
    if (!livro) return;
    Alert.alert("Concluir leitura", "Deseja marcar este livro como lido?", [
      { text: "Cancelar", style: "cancel" },
      {
        text: "Sim",
        onPress: async () => {
          await atualizarStatus(livro.id, "lido");
          setLivroAtivo(null);
        },
      },
    ]);
  };

  const abrirLivro = (livro: Livro) => {
    if (livro.status === "lido") {
      router.push({ pathname: "(tabs)/criticas", params: { livroId: livro.id } });
    } else {
      setLivroAtivo(livro);
    }
  };

  return (
    <SafeAreaView style={{ flex: 1 }}>
      <SectionList
        sections={sections}
        keyExtractor={(item) => item.id}
        renderSectionHeader={({ section }) => <Text style={styles.section}>{section.title}</Text>}
        renderItem={({ item }) => {
          const meta = STATUS_META[item.status!];
          return (
            <TouchableOpacity
              style={[styles.card, { backgroundColor: meta.cor }]}
              onPress={() => abrirLivro(item)}
            >
              {item.imagem ? (
                <Image source={{ uri: item.imagem }} style={styles.avatarImg} />
              ) : (
                <View
                  style={[
                    styles.avatarImg,
                    { backgroundColor: "#E5E7EB", justifyContent: "center", alignItems: "center" },
                  ]}
                >
                  <Text>Sem imagem</Text>
                </View>
              )}
              <View style={{ flex: 1 }}>
                <Text style={styles.titulo}>{item.titulo}</Text>
                <Text style={styles.autor}>{item.autor}</Text>
              </View>
              <Ionicons name={meta.icon as any} size={20} color={meta.texto} />
            </TouchableOpacity>
          );
        }}
      />

      {/* Modal de PDF */}
      <Modal visible={!!livroAtivo} animationType="slide">
        <SafeAreaView style={{ flex: 1 }}>
          {livroAtivo?.pdfUri ? (
            <WebView source={{ uri: livroAtivo.pdfUri }} style={{ flex: 1 }} />
          ) : (
            <View style={{ flex: 1, justifyContent: "center", alignItems: "center" }}>
              <Text>PDF não disponível</Text>
            </View>
          )}

          <View style={{ flexDirection: "row", justifyContent: "space-around", padding: 16 }}>
            {livroAtivo?.status !== "lido" && (
              <Button title="Concluir Leitura" onPress={() => concluirLeitura(livroAtivo)} />
            )}
            <Button title="Fechar" onPress={() => setLivroAtivo(null)} color="#888" />
          </View>
        </SafeAreaView>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  section: { fontSize: 18, fontWeight: "bold", margin: 16 },
  card: {
    flexDirection: "row",
    padding: 12,
    marginHorizontal: 12,
    marginVertical: 6,
    borderRadius: 12,
    alignItems: "center",
  },
  avatarImg: { width: 48, height: 48, borderRadius: 8, marginRight: 12 },
  titulo: { fontWeight: "bold" },
  autor: { fontSize: 12, color: "#6B7280" },
});
