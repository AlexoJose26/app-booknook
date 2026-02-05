import React, { useEffect, useState, useRef } from "react";
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TextInput,
  Alert,
  Image,
  TouchableOpacity,
  Pressable,
  Animated,
  Easing,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { useLivros } from "../../contexts/LivrosContext";
import { useUsuario } from "../../contexts/UsuarioContext";
import { useThemeCustom } from "@/contexts/ThemeContext";
import { db } from "@/database/db";
import { criticas, usuarios, estantes } from "@/database/schema";
import { eq, desc } from "drizzle-orm";

export default function Criticas({ atualizarFeed }: { atualizarFeed?: () => void }) {
  const { estantes: estantesUsuario } = useLivros();
  const { usuario } = useUsuario();
  const { colors, theme } = useThemeCustom();

  const [criticasPorLivro, setCriticasPorLivro] = useState<any[]>([]);
  const [editando, setEditando] = useState(false);
  const [textoCritica, setTextoCritica] = useState("");
  const [nota, setNota] = useState<number | null>(null);
  const [criticaAtual, setCriticaAtual] = useState<any>(null);
  const [livroSelecionado, setLivroSelecionado] = useState<any>(null);

  const animationForm = useRef(new Animated.Value(0)).current;
  const animationsCards = useRef([]).current;

  const [backupTexto, setBackupTexto] = useState("");
  const [backupNota, setBackupNota] = useState<number | null>(null);

  // Carregar críticas
  const carregarCriticas = async () => {
    if (!usuario || !estantesUsuario) return;
    const livrosLidos = estantesUsuario.lido || [];
    const todasCriticas: any[] = [];

    for (const livro of livrosLidos) {
      try {
        const res = await db
          .select({
            id: criticas.id,
            usuario_id: criticas.usuario_id,
            livro_id: criticas.livro_id,
            texto: criticas.texto,
            nota: criticas.nota,
            createdAt: criticas.createdAt,
            usuario_nome: usuarios.nome,
            usuario_foto: usuarios.foto_perfil,
          })
          .from(criticas)
          .leftJoin(usuarios, eq(usuarios.id, criticas.usuario_id))
          .where(eq(criticas.livro_id, livro.id))
          .orderBy(desc(criticas.createdAt));

        const dadosComFoto = res.map((c) => ({
          ...c,
          usuario_nome: c.usuario_nome ?? "Usuário",
          usuario_foto: c.usuario_foto ?? null,
        }));

        todasCriticas.push({ livro, criticas: dadosComFoto });
      } catch (err) {
        console.error("Erro ao carregar críticas:", err);
      }
    }

    setCriticasPorLivro(todasCriticas);
  };

  useEffect(() => {
    carregarCriticas();
  }, [usuario, estantesUsuario]);

  const animarFormulario = () => {
    animationForm.setValue(0);
    Animated.timing(animationForm, {
      toValue: 1,
      duration: 400,
      easing: Easing.out(Easing.ease),
      useNativeDriver: true,
    }).start();
  };

  const selecionarCritica = (livroId: string) => {
    const livroData = criticasPorLivro.find((c) => c.livro.id === livroId);
    if (!livroData) return;

    setLivroSelecionado(livroData.livro);
    const minhaCritica = livroData.criticas.find((c) => c.usuario_id === usuario?.id);
    setCriticaAtual(minhaCritica ?? null);
    setTextoCritica(minhaCritica?.texto ?? "");
    setNota(minhaCritica?.nota ?? null);

    setBackupTexto(minhaCritica?.texto ?? "");
    setBackupNota(minhaCritica?.nota ?? null);

    setEditando(true);
    animarFormulario();
  };

  // Fechar sem salvar
  const fecharEdicao = () => {
    setTextoCritica(backupTexto);
    setNota(backupNota);
    setCriticaAtual(null);
    setLivroSelecionado(null);
    setEditando(false);
  };

  const salvarCritica = async () => {
    if (!usuario || !livroSelecionado) return;
    if (!textoCritica.trim() || nota === null) {
      Alert.alert("Erro", "Preencha o texto e a nota antes de salvar.");
      return;
    }

    try {
      if (criticaAtual) {
        await db
          .update(criticas)
          .set({ texto: textoCritica, nota, createdAt: new Date().toISOString() })
          .where(eq(criticas.id, criticaAtual.id));
      } else {
        await db.insert(criticas).values({
          usuario_id: usuario.id,
          livro_id: livroSelecionado.id,
          texto: textoCritica,
          nota,
          createdAt: new Date().toISOString(),
        });
      }

      fecharEdicao();
      await carregarCriticas();
      atualizarFeed?.();
    } catch (error) {
      console.error("Erro ao salvar crítica:", error);
    }
  };

  const deletarCritica = async () => {
    if (!criticaAtual) return;

    Alert.alert("Confirmação", "Deseja deletar sua crítica?", [
      { text: "Cancelar", style: "cancel" },
      {
        text: "Deletar",
        style: "destructive",
        onPress: async () => {
          try {
            await db.delete(criticas).where(eq(criticas.id, criticaAtual.id));
            fecharEdicao();
            await carregarCriticas();
            atualizarFeed?.();
          } catch (error) {
            console.error("Erro ao deletar crítica:", error);
          }
        },
      },
    ]);
  };

  const getAvatar = (c) => (c.usuario_id === usuario.id ? usuario.foto_perfil : c.usuario_foto);

  if (!usuario) {
    return (
      <View style={styles.loading}>
        <Text style={{ color: colors.text }}>Carregando críticas…</Text>
      </View>
    );
  }

  const translateYForm = animationForm.interpolate({ inputRange: [0, 1], outputRange: [50, 0] });
  const opacityForm = animationForm.interpolate({ inputRange: [0, 1], outputRange: [0, 1] });

  return (
    <ScrollView contentContainerStyle={[styles.container, { backgroundColor: colors.background }]}>
      {criticasPorLivro.map((livroData, indexLivro) => (
        <View key={livroData.livro.id} style={{ marginBottom: 32 }}>
          <Text style={[styles.titulo, { color: colors.text }]}>{livroData.livro.titulo}</Text>
          <Text style={[styles.autor, { color: colors.secondary }]}>{livroData.livro.autor}</Text>

          {/* Formulário de edição */}
          {livroSelecionado?.id === livroData.livro.id && editando && (
            <Animated.View style={{ transform: [{ translateY: translateYForm }], opacity: opacityForm }}>
              <LinearGradient
                colors={theme === "dark" ? ["#1F2937", "#111827"] : ["#E5E7EB", "#F9FAFB"]}
                style={styles.form}
              >
                <TouchableOpacity onPress={fecharEdicao} style={{ position: "absolute", top: 8, right: 8 }}>
                  <Text style={{ fontSize: 20, color: colors.secondary }}>✕</Text>
                </TouchableOpacity>

                <TextInput
                  placeholder="Escreva sua crítica…"
                  placeholderTextColor={colors.placeholder}
                  value={textoCritica}
                  onChangeText={setTextoCritica}
                  multiline
                  style={[styles.textarea, { color: colors.text, backgroundColor: theme === "dark" ? "#111827" : "#FFF", borderColor: colors.secondary }]}
                />

                <View style={styles.estrelas}>
                  {[1, 2, 3, 4, 5].map((i) => (
                    <TouchableOpacity key={i} onPress={() => setNota(i)} activeOpacity={0.7}>
                      <Text style={[styles.estrela, { color: i <= (nota ?? 0) ? "#FFD700" : colors.secondary }]}>★</Text>
                    </TouchableOpacity>
                  ))}
                </View>

                <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
                  <TouchableOpacity style={[styles.botao, styles.botaoSalvar]} onPress={salvarCritica} activeOpacity={0.8}>
                    <Text style={styles.botaoTexto}>Publicar</Text>
                  </TouchableOpacity>

                  {criticaAtual && (
                    <TouchableOpacity style={[styles.botao, styles.botaoDeletar]} onPress={deletarCritica} activeOpacity={0.8}>
                      <Text style={styles.botaoTexto}>Deletar</Text>
                    </TouchableOpacity>
                  )}
                </View>
              </LinearGradient>
            </Animated.View>
          )}

          <Text style={[styles.subtitulo, { color: colors.text }]}>Críticas</Text>

          {livroData.criticas.map((c) => (
            <Pressable key={c.id} style={[styles.cardCritica, { backgroundColor: theme === "dark" ? "#1F2937" : "#FFF" }]}>
              <View style={styles.usuarioRow}>
                {getAvatar(c) ? <Image source={{ uri: getAvatar(c) }} style={styles.avatar} /> : <View style={[styles.avatar, { backgroundColor: colors.secondary, justifyContent: "center", alignItems: "center" }]}><Text>👤</Text></View>}
                <Text style={[styles.usuarioNome, { color: colors.text }]}>{c.usuario_id === usuario.id ? usuario.nome : c.usuario_nome}</Text>
              </View>

              <Text style={[styles.textoCritica, { color: colors.text }]}>{c.texto}</Text>
              <Text style={[styles.nota, { color: "#F59E0B" }]}>Nota: {c.nota} ★</Text>
              <Text style={[styles.data, { color: colors.secondary }]}>Criado em: {new Date(c.createdAt).toLocaleString()}</Text>

              {c.usuario_id === usuario.id && !editando && (
                <View style={styles.botoesRow}>
                  <TouchableOpacity style={[styles.botao, styles.botaoAtualizar]} onPress={() => selecionarCritica(livroData.livro.id)} activeOpacity={0.8}>
                    <Text style={styles.botaoTexto}>Atualizar</Text>
                  </TouchableOpacity>

                  <TouchableOpacity style={[styles.botao, styles.botaoDeletar]} onPress={() => { setCriticaAtual(c); deletarCritica(); }} activeOpacity={0.8}>
                    <Text style={styles.botaoTexto}>Deletar</Text>
                  </TouchableOpacity>
                </View>
              )}
            </Pressable>
          ))}

          {!livroData.criticas.find((c) => c.usuario_id === usuario.id) && (
            <TouchableOpacity style={[styles.botao, styles.botaoSalvar, { marginTop: 12 }]} onPress={() => selecionarCritica(livroData.livro.id)}>
              <Text style={styles.botaoTexto}>Adicionar Crítica</Text>
            </TouchableOpacity>
          )}
        </View>
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { padding: 16, paddingBottom: 40 },
  loading: { flex: 1, justifyContent: "center", alignItems: "center" },
  titulo: { fontSize: 24, fontWeight: "bold", marginBottom: 4 },
  autor: { fontSize: 16, marginBottom: 12 },
  form: { padding: 20, borderRadius: 16, marginBottom: 16, shadowColor: "#000", shadowOpacity: 0.1, shadowRadius: 10, elevation: 5 },
  textarea: { borderWidth: 1, borderRadius: 12, padding: 14, minHeight: 100, fontSize: 15, marginBottom: 12 },
  estrelas: { flexDirection: "row", marginBottom: 16 },
  estrela: { fontSize: 28, marginRight: 8 },
  botao: { flex: 1, paddingVertical: 14, borderRadius: 12, alignItems: "center", justifyContent: "center", marginHorizontal: 4, shadowColor: "#000", shadowOpacity: 0.15, shadowRadius: 8, elevation: 4 },
  botaoTexto: { color: "#FFF", fontWeight: "bold", fontSize: 16 },
  botaoSalvar: { backgroundColor: "#10B981" },
  botaoAtualizar: { backgroundColor: "#3B82F6" },
  botaoDeletar: { backgroundColor: "#EF4444" },
  subtitulo: { fontSize: 18, fontWeight: "bold", marginTop: 24, marginBottom: 8 },
  cardCritica: { padding: 16, borderRadius: 16, marginVertical: 8, shadowRadius: 6, elevation: 3 },
  usuarioRow: { flexDirection: "row", alignItems: "center", marginBottom: 8 },
  usuarioNome: { fontWeight: "bold", marginLeft: 8 },
  avatar: { width: 36, height: 36, borderRadius: 18 },
  textoCritica: { fontSize: 15, marginBottom: 4 },
  nota: { fontSize: 14, marginBottom: 4 },
  data: { fontSize: 12 },
  botoesRow: { flexDirection: "row", marginTop: 12 },
});
