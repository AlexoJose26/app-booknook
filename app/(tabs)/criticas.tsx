// app/(tabs)/criticas.tsx
import React, { useEffect, useState, useRef } from "react";
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  Alert,
  Image,
  ActivityIndicator,
  ScrollView,
  Animated,
} from "react-native";
import { useRouter, useLocalSearchParams } from "expo-router";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { eq, desc, inArray } from "drizzle-orm";

import { db } from "@/database/db";
import { criticas, livros, estantes } from "@/database/schema";

type CriticaType = {
  id: number;
  usuario_id: string;
  livro_id: string;
  texto: string;
  nota: number;
  createdAt: string;
};

type LivroType = {
  id: string;
  titulo?: string;
  autor?: string;
  imagem?: string;
};

type LivroComCritica = LivroType & {
  critica?: CriticaType;
  texto: string;
  nota: number | null;
  editando: boolean;
  salvando: boolean;
};

export default function Criticas({ onAtualizarFeed }: { onAtualizarFeed?: () => void }) {
  const router = useRouter();
  const params = useLocalSearchParams();
  const livroIdParam = typeof params.livroId === "string" ? params.livroId : null;
  const vemDaEstante = params.vemDaEstante === "true";

  const [usuario, setUsuario] = useState<{ id: string; nome: string } | null>(null);
  const [livrosData, setLivrosData] = useState<LivroComCritica[]>([]);
  const [loading, setLoading] = useState(true);

  const animValues = useRef<Animated.Value[]>([]);

  useEffect(() => {
    const carregarLivros = async () => {
      setLoading(true);
      try {
        const userStr = await AsyncStorage.getItem("usuarioLogado");
        if (!userStr) {
          router.replace("/login");
          return;
        }
        const user = JSON.parse(userStr);
        setUsuario(user);

        let livrosRes: LivroType[] = [];

        if (vemDaEstante && user.id) {
          const estanteLivros = await db
            .select({ livro_id: estantes.livro_id })
            .from(estantes)
            .where(eq(estantes.usuario_id, user.id));

          const livroIds = estanteLivros.map((e) => e.livro_id);
          if (livroIds.length === 0) {
            setLivrosData([]);
            return;
          }

          livrosRes = await db.select().from(livros).where(inArray(livros.id, livroIds));
        } else if (livroIdParam) {
          const res = await db.select().from(livros).where(eq(livros.id, livroIdParam));
          if (!res.length) {
            Alert.alert("Livro não encontrado");
            router.back();
            return;
          }
          livrosRes = res;
        }

        const livroIds = livrosRes.map((l) => l.id);

        const criticasRes: CriticaType[] = await db
          .select()
          .from(criticas)
          .where(eq(criticas.usuario_id, user.id))
          .where(inArray(criticas.livro_id, livroIds))
          .orderBy(desc(criticas.createdAt));

        const livrosComCritica: LivroComCritica[] = livrosRes.map((livro) => {
          const crit = criticasRes.find((c) => c.livro_id === livro.id);
          return {
            ...livro,
            critica: crit,
            texto: crit?.texto ?? "",
            nota: crit?.nota ?? null,
            editando: !crit,
            salvando: false,
          };
        });

        animValues.current = livrosComCritica.map(() => new Animated.Value(0));
        setLivrosData(livrosComCritica);

        Animated.stagger(
          100,
          animValues.current.map((anim) =>
            Animated.timing(anim, {
              toValue: 1,
              duration: 400,
              useNativeDriver: true,
            })
          )
        ).start();
      } finally {
        setLoading(false);
      }
    };

    setLivrosData([]);
    carregarLivros();
  }, [livroIdParam, vemDaEstante, router]);

  const salvarCritica = async (index: number) => {
    const livroAtual = livrosData[index];
    if (!usuario || !livroAtual.texto.trim() || livroAtual.nota === null) {
      Alert.alert("Erro", "Preencha a nota e o comentário antes de salvar.");
      return;
    }

    const updatedLivros = [...livrosData];
    updatedLivros[index] = { ...livroAtual, salvando: true };
    setLivrosData(updatedLivros);

    const data = new Date().toISOString();

    try {
      let criticaSalva: CriticaType;

      if (livroAtual.critica) {
        // ✅ Atualiza crítica existente
        await db
          .update(criticas)
          .set({
            texto: livroAtual.texto || "",
            nota: livroAtual.nota ?? 0,
            createdAt: data,
          })
          .where(eq(criticas.id, livroAtual.critica.id));

        criticaSalva = { ...livroAtual.critica, texto: livroAtual.texto, nota: livroAtual.nota!, createdAt: data };
      } else {
        // ✅ Insere nova crítica garantindo campos válidos
        const insertId = await db.insert(criticas).values({
          usuario_id: usuario.id,
          livro_id: livroAtual.id,
          texto: livroAtual.texto || "",
          nota: livroAtual.nota ?? 0,
          createdAt: data,
        });

        criticaSalva = {
          id: insertId,
          usuario_id: usuario.id,
          livro_id: livroAtual.id,
          texto: livroAtual.texto,
          nota: livroAtual.nota!,
          createdAt: data,
        };
      }

      const updated = [...livrosData];
      updated[index] = {
        ...updated[index],
        critica: criticaSalva,
        editando: false,
        salvando: false,
      };
      setLivrosData(updated);

      // Atualiza feed global após publicar
      if (onAtualizarFeed) onAtualizarFeed();
    } catch (e: any) {
      console.error(e);
      Alert.alert("Erro", e?.message ? String(e.message) : "Erro ao salvar crítica");
      const updated = [...livrosData];
      updated[index] = { ...livroAtual, salvando: false };
      setLivrosData(updated);
    }
  };

  const deletarCritica = async (index: number) => {
    const livroAtual = livrosData[index];
    if (!livroAtual.critica) return;

    Alert.alert("Confirmar", "Deseja realmente deletar sua crítica?", [
      { text: "Cancelar", style: "cancel" },
      {
        text: "Deletar",
        style: "destructive",
        onPress: async () => {
          try {
            await db.delete(criticas).where(eq(criticas.id, livroAtual.critica!.id));

            const updatedLivros = [...livrosData];
            updatedLivros[index] = {
              ...livroAtual,
              critica: undefined,
              texto: "",
              nota: null,
              editando: true,
            };
            setLivrosData(updatedLivros);

            if (onAtualizarFeed) onAtualizarFeed();
          } catch (e: any) {
            console.error(e);
            Alert.alert("Erro", "Falha ao deletar crítica");
          }
        },
      },
    ]);
  };

  const renderEstrelas = (nota: number | null, onPress?: (i: number) => void) => (
    <View style={{ flexDirection: "row" }}>
      {Array.from({ length: 5 }, (_, i) => (
        <TouchableOpacity
          key={i}
          onPress={() => onPress && onPress(i + 1)}
          activeOpacity={onPress ? 0.7 : 1}
          style={{ marginRight: 4 }}
        >
          <Text style={{ fontSize: 24, color: i < (nota ?? 0) ? "#FFD700" : "#D1D5DB" }}>★</Text>
        </TouchableOpacity>
      ))}
    </View>
  );

  if (loading) {
    return (
      <View style={styles.loading}>
        <ActivityIndicator size="large" />
        <Text>A carregar livros…</Text>
      </View>
    );
  }

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <TouchableOpacity onPress={() => router.back()}>
        <Text style={styles.voltar}>← Voltar</Text>
      </TouchableOpacity>

      {livrosData.map((livro, index) => {
        const animStyle = {
          opacity: animValues.current[index],
          transform: [
            {
              translateY: animValues.current[index].interpolate({
                inputRange: [0, 1],
                outputRange: [20, 0],
              }),
            },
          ],
        };

        return (
          <Animated.View key={livro.id} style={[{ marginBottom: 24 }, animStyle]}>
            <View style={styles.cardLivro}>
              {livro.imagem ? (
                <Image source={{ uri: livro.imagem }} style={styles.capa} />
              ) : (
                <View
                  style={[styles.capa, { backgroundColor: "#E5E7EB", justifyContent: "center", alignItems: "center" }]}
                >
                  <Text>Sem imagem</Text>
                </View>
              )}
              <View style={{ flex: 1 }}>
                <Text style={styles.titulo}>{livro.titulo ?? ""}</Text>
                <Text style={styles.autor}>{livro.autor ?? ""}</Text>
              </View>
            </View>

            {livro.editando && (
              <View style={styles.form}>
                <TextInput
                  placeholder="Escreva sua crítica…"
                  value={livro.texto}
                  onChangeText={(text) => {
                    const updated = [...livrosData];
                    updated[index] = { ...updated[index], texto: text };
                    setLivrosData(updated);
                  }}
                  multiline
                  style={styles.textarea}
                />

                <View style={{ marginBottom: 16 }}>
                  <Text style={{ fontWeight: "600", marginBottom: 4 }}>Nota:</Text>
                  {renderEstrelas(livro.nota, (i) => {
                    const updated = [...livrosData];
                    updated[index] = { ...updated[index], nota: i };
                    setLivrosData(updated);
                  })}
                </View>

                <TouchableOpacity
                  style={[styles.botao, { backgroundColor: "#10B981" }]}
                  onPress={() => salvarCritica(index)}
                  disabled={livro.salvando}
                >
                  <Text style={styles.botaoTexto}>
                    {livro.critica ? "Atualizar crítica" : "Publicar crítica"}
                  </Text>
                </TouchableOpacity>
              </View>
            )}

            {!livro.editando && livro.critica && (
              <View style={styles.cardCritica}>
                {renderEstrelas(livro.critica.nota)}
                <Text style={[styles.mensagemCritica, { marginTop: 6 }]}>
                  {usuario?.nome ?? "Usuário"} comentou: "{livro.critica?.texto ?? ""}"
                </Text>

                <View style={styles.botaoContainer}>
                  <TouchableOpacity
                    style={[styles.botao, { backgroundColor: "#3B82F6" }]}
                    onPress={() => {
                      const updated = [...livrosData];
                      updated[index] = {
                        ...updated[index],
                        editando: true,
                        texto: updated[index].critica?.texto ?? "",
                        nota: updated[index].critica?.nota ?? null,
                      };
                      setLivrosData(updated);
                    }}
                  >
                    <Text style={styles.botaoTexto}>Atualizar</Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={[styles.botao, { backgroundColor: "#EF4444" }]}
                    onPress={() => deletarCritica(index)}
                  >
                    <Text style={styles.botaoTexto}>Deletar</Text>
                  </TouchableOpacity>
                </View>
              </View>
            )}
          </Animated.View>
        );
      })}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { padding: 16, paddingBottom: 40 },
  loading: { flex: 1, justifyContent: "center", alignItems: "center" },
  voltar: { color: "#1877F2", marginBottom: 10, fontWeight: "600" },
  cardLivro: {
    flexDirection: "row",
    backgroundColor: "#FFF",
    padding: 12,
    borderRadius: 12,
    marginBottom: 12,
    alignItems: "center",
  },
  capa: { width: 80, height: 120, marginRight: 12, borderRadius: 8 },
  titulo: { fontSize: 18, fontWeight: "bold", marginBottom: 2 },
  autor: { color: "#6B7280", fontSize: 14 },
  form: {
    backgroundColor: "#FFF",
    padding: 16,
    borderRadius: 14,
    marginBottom: 12,
    shadowColor: "#000",
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 3,
  },
  textarea: {
    borderWidth: 1,
    borderRadius: 12,
    padding: 14,
    minHeight: 100,
    marginBottom: 12,
    borderColor: "#E5E7EB",
    fontSize: 15,
  },
  botaoContainer: { flexDirection: "row", gap: 12, marginTop: 12 },
  botao: {
    flex: 1,
    padding: 14,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  botaoTexto: { color: "#FFF", fontWeight: "bold", fontSize: 15 },
  cardCritica: {
    backgroundColor: "#FFF",
    padding: 16,
    borderRadius: 12,
    marginBottom: 12,
    shadowColor: "#000",
    shadowOpacity: 0.03,
    shadowRadius: 6,
    elevation: 2,
  },
  mensagemCritica: { fontSize: 15, fontStyle: "italic", color: "#374151" },
});
