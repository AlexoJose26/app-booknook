import React, { useCallback, useEffect, useState, useRef } from "react";
import {
  Alert,
  FlatList,
  Image,
  RefreshControl,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
  Animated,
  Pressable,
  LayoutAnimation,
  UIManager,
  Platform,
} from "react-native";
import { db } from "@/database/db";
import { comentarios, criticas, curtidas, estantes, livros, usuarios } from "@/database/schema";
import { desc, eq } from "drizzle-orm";
import { useUsuario } from "@/contexts/UsuarioContext";
import { useThemeCustom } from "@/contexts/ThemeContext";

// Habilita animação no Android
if (Platform.OS === "android" && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

type ComentarioType = {
  id: number;
  usuario_id: string;
  usuario_nome: string;
  texto: string;
  editando?: boolean;
};

type PostType = {
  id: string;
  tipo: "critica" | "lido";
  usuario_id: string;
  usuario_nome: string;
  usuario_foto?: string | null;
  livro_id?: string;
  livro_titulo: string;
  texto?: string;
  nota?: number;
  curtidasCount?: number;
  curtidoPorMim?: boolean;
  comentarios?: ComentarioType[];
  data: string;
  meuPost?: boolean;
  editando?: boolean;
};

export default function Feed() {
  const { usuario } = useUsuario();
  const { colors, theme } = useThemeCustom();
  const [posts, setPosts] = useState<PostType[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [comentarioAberto, setComentarioAberto] = useState<string | null>(null);
  const [comentarioTexto, setComentarioTexto] = useState<string>("");

  const animationRefs = useRef<{ [key: string]: Animated.Value }>({}).current;

  // Carrega posts
  const carregarPosts = useCallback(async () => {
    if (!usuario) return;

    try {
      // Criticas
      const criticasDB = await db
        .select({
          id: criticas.id,
          texto: criticas.texto,
          nota: criticas.nota,
          createdAt: criticas.createdAt,
          livro_titulo: livros.titulo,
          usuario_nome: usuarios.nome,
          usuario_foto: usuarios.foto_perfil,
          usuario_id: usuarios.id,
          livro_id: livros.id,
        })
        .from(criticas)
        .leftJoin(livros, eq(criticas.livro_id, livros.id))
        .leftJoin(usuarios, eq(criticas.usuario_id, usuarios.id))
        .orderBy(desc(criticas.createdAt));

      const postsCriticas: PostType[] = await Promise.all(
        criticasDB.map(async (c) => {
          const curtidasRaw = await db.select().from(curtidas).where(eq(curtidas.critica_id, c.id));
          const comentariosRaw = await db.select().from(comentarios).where(eq(comentarios.critica_id, c.id));

          const comentariosFormat: ComentarioType[] = comentariosRaw.map((com) => ({
            id: com.id,
            usuario_id: com.usuario_id,
            usuario_nome: com.usuario_id === usuario.id ? usuario.nome : String(com.usuario_id),
            texto: com.texto || "",
            editando: false,
          }));

          const meuPost = c.usuario_id === usuario.id;
          animationRefs[`card-${c.id}`] = new Animated.Value(1);

          return {
            id: `critica-${c.id}`,
            tipo: "critica",
            usuario_id: c.usuario_id,
            usuario_nome: meuPost ? usuario.nome : c.usuario_nome,
            usuario_foto: meuPost ? usuario.foto_perfil : c.usuario_foto,
            livro_id: c.livro_id,
            livro_titulo: c.livro_titulo || "Livro",
            texto: c.texto,
            nota: c.nota,
            curtidasCount: curtidasRaw.length,
            curtidoPorMim: curtidasRaw.some((cur) => cur.usuario_id === usuario.id),
            comentarios: comentariosFormat,
            data: c.createdAt,
            meuPost,
            editando: false,
          };
        })
      );

      // Livros lidos
      const lidosDB = await db
        .select({
          id: estantes.id,
          createdAt: estantes.createdAt,
          livro_titulo: livros.titulo,
          usuario_nome: usuarios.nome,
          usuario_foto: usuarios.foto_perfil,
          usuario_id: usuarios.id,
        })
        .from(estantes)
        .leftJoin(livros, eq(estantes.livro_id, livros.id))
        .leftJoin(usuarios, eq(estantes.usuario_id, usuarios.id))
        .where(eq(estantes.status, "lido"))
        .orderBy(desc(estantes.createdAt));

      const postsLidos: PostType[] = lidosDB.map((l) => {
        const meuPost = l.usuario_id === usuario.id;
        animationRefs[`card-lido-${l.id}`] = new Animated.Value(1);
        return {
          id: `lido-${l.id}`,
          tipo: "lido",
          usuario_id: l.usuario_id,
          usuario_nome: meuPost ? usuario.nome : l.usuario_nome,
          usuario_foto: meuPost ? usuario.foto_perfil : l.usuario_foto,
          livro_titulo: l.livro_titulo,
          data: l.createdAt,
          meuPost,
          editando: false,
        };
      });

      setPosts([...postsCriticas, ...postsLidos].sort(
        (a, b) => new Date(b.data).getTime() - new Date(a.data).getTime()
      ));
    } catch (err) {
      console.error(err);
      Alert.alert("Erro", "Falha ao carregar feed");
    }
  }, [usuario]);

  useEffect(() => { carregarPosts(); }, [usuario]);

  const onRefresh = async () => {
    setRefreshing(true);
    await carregarPosts();
    setRefreshing(false);
  };

  // Curtir / descurtir
  const toggleCurtir = async (post: PostType) => {
    if (!usuario || post.tipo !== "critica") return;
    const criticaId = parseInt(post.id.replace("critica-", ""));
    const curtidaExiste = await db.select().from(curtidas)
      .where(eq(curtidas.usuario_id, usuario.id))
      .where(eq(curtidas.critica_id, criticaId));

    if (curtidaExiste.length > 0) {
      await db.delete(curtidas).where(eq(curtidas.usuario_id, usuario.id)).where(eq(curtidas.critica_id, criticaId));
    } else {
      await db.insert(curtidas).values({ usuario_id: usuario.id, critica_id: criticaId, createdAt: new Date().toISOString() });
    }
    carregarPosts();
  };

  // Toggle comentário
  const toggleComentario = (postId: string) => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    if (comentarioAberto === postId) {
      setComentarioAberto(null);
      setComentarioTexto("");
    } else {
      setComentarioAberto(postId);
      setComentarioTexto("");
    }
  };

  // Enviar comentário
  const enviarComentario = async () => {
    if (!usuario || !comentarioAberto) return;
    if (!comentarioTexto.trim()) return;

    const criticaId = parseInt(comentarioAberto.replace("critica-", ""));
    await db.insert(comentarios).values({
      usuario_id: usuario.id,
      critica_id: criticaId,
      texto: comentarioTexto,
      createdAt: new Date().toISOString(),
    });
    setComentarioAberto(null);
    setComentarioTexto("");
    carregarPosts();
  };

  // Editar comentário
  const editarComentario = async (comentario: ComentarioType, novoTexto: string) => {
    await db.update(comentarios).set({ texto: novoTexto }).where(eq(comentarios.id, comentario.id));
  };

  // Excluir comentário
  const excluirComentario = async (comentario: ComentarioType) => {
    Alert.alert("Excluir comentário", "Deseja realmente excluir este comentário?", [
      { text: "Cancelar", style: "cancel" },
      {
        text: "Excluir",
        style: "destructive",
        onPress: async () => {
          await db.delete(comentarios).where(eq(comentarios.id, comentario.id));
          carregarPosts();
        },
      },
    ]);
  };

  // Editar post (crítica com nota e texto)
  const editarPost = async (post: PostType, novoTexto: string, novaNota?: number) => {
    if (post.tipo === "critica") {
      const criticaId = parseInt(post.id.replace("critica-", ""));
      await db.update(criticas).set({ texto: novoTexto, nota: novaNota }).where(eq(criticas.id, criticaId));
    } else if (post.tipo === "lido") {
      const estanteId = parseInt(post.id.replace("lido-", ""));
      await db.update(estantes).set({ livro_titulo: novoTexto }).where(eq(estantes.id, estanteId));
    }
    carregarPosts();
  };

  // Excluir post
  const excluirPost = async (post: PostType) => {
    Alert.alert("Excluir publicação", "Deseja realmente excluir esta publicação?", [
      { text: "Cancelar", style: "cancel" },
      {
        text: "Excluir",
        style: "destructive",
        onPress: async () => {
          if (post.tipo === "critica") {
            const criticaId = parseInt(post.id.replace("critica-", ""));
            await db.delete(criticas).where(eq(criticas.id, criticaId));
            await db.delete(curtidas).where(eq(curtidas.critica_id, criticaId));
            await db.delete(comentarios).where(eq(comentarios.critica_id, criticaId));
          } else if (post.tipo === "lido") {
            const estanteId = parseInt(post.id.replace("lido-", ""));
            await db.delete(estantes).where(eq(estantes.id, estanteId));
          }
          carregarPosts();
        },
      },
    ]);
  };

  const corCard = theme === "dark" ? "#1F2937" : "#F9FAFB";
  const corCurtir = "#3B82F6";
  const corComentar = "#60A5FA";
  const corEditarPost = "#FBBF24";
  const corExcluirPost = "#EF4444";
  const corBotaoTexto = "#FFF";

  return (
    <FlatList
      data={posts}
      keyExtractor={(item) => item.id}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      contentContainerStyle={{ padding: 15, backgroundColor: colors.background }}
      renderItem={({ item }) => {
        const scaleAnim = animationRefs[item.id] || new Animated.Value(1);
        const onPressIn = () => Animated.spring(scaleAnim, { toValue: 0.97, useNativeDriver: true }).start();
        const onPressOut = () => Animated.spring(scaleAnim, { toValue: 1, friction: 5, useNativeDriver: true }).start();

        return (
          <Pressable onPressIn={onPressIn} onPressOut={onPressOut} style={{ marginBottom: 15 }}>
            <Animated.View style={{ transform: [{ scale: scaleAnim }] }}>
              <View style={[styles.post, { backgroundColor: corCard }]}>

                {/* HEADER */}
                <View style={styles.header}>
                  {item.usuario_foto ? <Image source={{ uri: item.usuario_foto }} style={styles.avatar} /> : <View style={[styles.avatarPlaceholder, { backgroundColor: corCurtir }]} />}
                  <Text style={[styles.nomeUsuario, { color: colors.text }]}>{item.usuario_nome}</Text>
                  <Text style={[styles.data, { color: colors.secondary }]}>{new Date(item.data).toLocaleString()}</Text>

                  {item.meuPost && (
                    <View style={{ flexDirection: "row", gap: 6, marginLeft: "auto" }}>
                      <TouchableOpacity onPress={() => {
                        setPosts(prev => prev.map(p => p.id === item.id ? { ...p, editando: true } : p));
                        LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
                      }}>
                        <Text style={{ color: corEditarPost }}>Editar</Text>
                      </TouchableOpacity>
                      <TouchableOpacity onPress={() => excluirPost(item)}>
                        <Text style={{ color: corExcluirPost }}>Excluir</Text>
                      </TouchableOpacity>
                    </View>
                  )}
                </View>

                {/* Edição de crítica (texto + nota) */}
                {item.editando && item.tipo === "critica" && (
                  <View style={{ marginTop: 6 }}>
                    <TextInput
                      value={item.texto}
                      onChangeText={txt => setPosts(prev => prev.map(p => p.id === item.id ? { ...p, texto: txt } : p))}
                      style={[styles.inputComentario, { borderColor: colors.secondary, color: colors.text }]}
                      placeholder="Editar texto da crítica"
                      placeholderTextColor={colors.placeholder}
                    />
                    <TextInput
                      value={item.nota?.toString() || ""}
                      onChangeText={txt => setPosts(prev => prev.map(p => p.id === item.id ? { ...p, nota: Number(txt) } : p))}
                      style={[styles.inputComentario, { borderColor: colors.secondary, color: colors.text, marginTop: 6 }]}
                      placeholder="Editar nota (0-5)"
                      keyboardType="numeric"
                      placeholderTextColor={colors.placeholder}
                    />
                    <TouchableOpacity onPress={() => {
                      editarPost(item, item.texto || "", item.nota);
                      setPosts(prev => prev.map(p => p.id === item.id ? { ...p, editando: false } : p));
                    }} style={[styles.botaoSalvarPost, { backgroundColor: corEditarPost }]}>
                      <Text style={{ color: "#FFF", textAlign: "center" }}>Salvar Crítica</Text>
                    </TouchableOpacity>
                  </View>
                )}

                {/* Restante do post (não editando) */}
                {!item.editando && (
                  <>
                    {item.tipo === "critica" && (
                      <>
                        <Text style={[styles.tipoPost, { color: colors.secondary }]}>{item.meuPost ? "Minha crítica" : "Crítica"}</Text>
                        <Text style={[styles.tituloLivro, { color: colors.text }]}>{item.livro_titulo}</Text>
                        {item.texto && <Text style={[styles.textoCritica, { color: colors.text }]}>{item.texto}</Text>}
                        <Text style={[styles.nota, { color: corCurtir }]}>⭐ {item.nota || 0} | ❤️ {item.curtidasCount || 0} | 💬 {item.comentarios?.length || 0}</Text>

                        {/* Botões de curtir/comentar */}
                        <View style={styles.botoes}>
                          <TouchableOpacity style={[styles.botao, { backgroundColor: corCurtir }]} onPress={() => toggleCurtir(item)}>
                            <Text style={{ color: corBotaoTexto, textAlign: "center", fontWeight: "bold" }}>
                              {item.curtidoPorMim ? "Descurtir ❤️" : "Curtir 🤍"}
                            </Text>
                          </TouchableOpacity>
                          <TouchableOpacity style={[styles.botao, { backgroundColor: corComentar }]} onPress={() => toggleComentario(item.id)}>
                            <Text style={{ color: corBotaoTexto, textAlign: "center", fontWeight: "bold" }}>💬 Comentar</Text>
                          </TouchableOpacity>
                        </View>

                        {/* Comentários */}
                        {item.comentarios?.map(c => {
                          const handleEditar = () => {
                            setPosts(prev => prev.map(p =>
                              p.id === item.id ? {
                                ...p,
                                comentarios: p.comentarios?.map(com => com.id === c.id ? { ...com, editando: true } : com)
                              } : p
                            ));
                          };
                          const handleSalvar = async () => {
                            if (!c.texto.trim()) return;
                            await editarComentario(c, c.texto);
                            setPosts(prev => prev.map(p =>
                              p.id === item.id ? {
                                ...p,
                                comentarios: p.comentarios?.map(com => com.id === c.id ? { ...com, editando: false } : com)
                              } : p
                            ));
                          };

                          return (
                            <View key={c.id} style={{ marginTop: 4 }}>
                              {c.editando ? (
                                <View style={{ flexDirection: "row", gap: 8 }}>
                                  <TextInput
                                    value={c.texto}
                                    onChangeText={txt => setPosts(prev => prev.map(p =>
                                      p.id === item.id ? {
                                        ...p,
                                        comentarios: p.comentarios?.map(com => com.id === c.id ? { ...com, texto: txt } : com)
                                      } : p
                                    ))}
                                    style={[styles.inputComentario, { borderColor: colors.secondary, color: colors.text, flex: 1 }]}
                                  />
                                  <TouchableOpacity onPress={handleSalvar} style={[styles.botaoSalvarComentario, { backgroundColor: corCurtir }]}>
                                    <Text style={{ color: "#FFF", textAlign: "center" }}>Salvar Comentário</Text>
                                  </TouchableOpacity>
                                </View>
                              ) : (
                                <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
                                  <Text style={{ color: c.usuario_id === usuario.id ? corCurtir : colors.text }}>
                                    <Text style={{ fontWeight: "bold" }}>{c.usuario_nome}: </Text>{c.texto}
                                  </Text>
                                  {c.usuario_id === usuario.id && (
                                    <View style={{ flexDirection: "row", gap: 6 }}>
                                      <TouchableOpacity onPress={handleEditar}><Text style={{ color: corEditarPost }}>Editar</Text></TouchableOpacity>
                                      <TouchableOpacity onPress={() => excluirComentario(c)}><Text style={{ color: corExcluirPost }}>Excluir</Text></TouchableOpacity>
                                    </View>
                                  )}
                                </View>
                              )}
                            </View>
                          );
                        })}

                        {comentarioAberto === item.id && (
                          <View style={{ marginTop: 8 }}>
                            <TextInput
                              placeholder="Escreva um comentário..."
                              placeholderTextColor={colors.placeholder}
                              value={comentarioTexto}
                              onChangeText={setComentarioTexto}
                              style={[styles.inputComentario, { borderColor: colors.secondary, color: colors.text }]}
                            />
                            <TouchableOpacity onPress={enviarComentario} style={[styles.botaoEnviarComentario, { backgroundColor: corCurtir }]}>
                              <Text style={{ color: "#FFF", textAlign: "center" }}>Enviar</Text>
                            </TouchableOpacity>
                          </View>
                        )}
                      </>
                    )}

                    {/* LIVROS LIDOS */}
                    {item.tipo === "lido" && (
                      <Text style={[styles.textoLido, { color: colors.text }]}>{item.usuario_nome} adicionou "{item.livro_titulo}" à estante</Text>
                    )}
                  </>
                )}
              </View>
            </Animated.View>
          </Pressable>
        );
      }}
    />
  );
}

const styles = StyleSheet.create({
  post: { padding: 15, borderRadius: 12 },
  header: { flexDirection: "row", alignItems: "center", marginBottom: 8, gap: 8 },
  avatar: { width: 40, height: 40, borderRadius: 20 },
  avatarPlaceholder: { width: 40, height: 40, borderRadius: 20 },
  nomeUsuario: { fontWeight: "bold" },
  data: { marginLeft: "auto", fontSize: 12 },
  tipoPost: { fontStyle: "italic", marginBottom: 4 },
  tituloLivro: { fontWeight: "bold", marginBottom: 6, marginTop: 6 },
  textoCritica: { marginBottom: 6 },
  nota: { fontSize: 14, marginBottom: 6 },
  botoes: { flexDirection: "row", gap: 12, marginTop: 6 },
  botao: { flex: 1, paddingVertical: 8, borderRadius: 8 },
  inputComentario: { borderWidth: 1, borderRadius: 8, padding: 8 },
  botaoEnviarComentario: { marginTop: 6, padding: 10, borderRadius: 8 },
  botaoSalvarPost: { marginTop: 6, padding: 10, borderRadius: 8 },
  botaoSalvarComentario: { padding: 10, borderRadius: 8 },
  textoLido: { fontStyle: "italic" },
});
