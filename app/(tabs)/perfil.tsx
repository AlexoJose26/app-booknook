import { MaterialCommunityIcons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { eq } from "drizzle-orm";
import * as ImagePicker from "expo-image-picker";
import { useFocusEffect, useRouter } from "expo-router";
import {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Image,
  Modal,
  Platform,
  RefreshControl,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
  useColorScheme
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { getDb } from "@/database/db";
import {
  estantes,
  livros,
  usuarios
} from "@/database/schema";

import {
  criarComentario,
  listarComentarios,
  listarFeed,
  obterEstatisticasCritica,
  toggleCurtida,
} from "@/database/services/socialService";

const FACEBOOK_BLUE = "#1877F2";

type Usuario = {
  id: string;
  nome: string;
  foto_perfil: string | null;
};

type Livro = {
  id: string;
  titulo: string;
  autor: string | null;
  imagem: string | null;
};

type LivroEstante = {
  id?: string | number;
  livro_id: string;
  usuario_id: string;
  status: string;
  livro: Livro | null;
};

type Estatisticas = {
  curtidas: number;
  comentarios: number;
  curtiu: boolean;
};

type Publicacao = {
  id: number;
  usuario_id: string;
  tipo: string;
  livro_id: string | null;
  critica_id: number | null;
  createdAt: string;
  usuario?: {
    id: string;
    nome: string;
    foto_perfil: string | null;
  } | null;
  livro?: {
    id: string;
    titulo: string;
    autor: string | null;
    imagem: string | null;
  } | null;
};

type Comentario = {
  id: number;
  usuario_id: string;
  critica_id: number;
  texto: string;
  createdAt: string;
  usuario?: {
    id: string;
    nome: string;
    foto_perfil: string | null;
  } | null;
};

export default function Perfil() {
  const router = useRouter();
  const systemScheme = useColorScheme();

  const isDark = systemScheme === "dark";

  const theme = useMemo(
    () => ({
      background: isDark ? "#0F1115" : "#F0F2F5",
      surface: isDark ? "#181A1F" : "#FFFFFF",
      surfaceSecondary: isDark ? "#20232A" : "#F7F8FA",
      border: isDark ? "#30343B" : "#E4E6EB",
      text: isDark ? "#F5F6F7" : "#1C1E21",
      textSecondary: isDark ? "#B7BBC2" : "#65676B",
      muted: isDark ? "#8D929A" : "#8A8D91",
      input: isDark ? "#24272E" : "#F0F2F5",
      overlay: isDark ? "rgba(0,0,0,0.75)" : "rgba(0,0,0,0.45)",
      blue: FACEBOOK_BLUE,
      blueSoft: isDark ? "#172A44" : "#E7F3FF",
      danger: "#E53935",
    }),
    [isDark]
  );

  const [usuario, setUsuario] = useState<Usuario | null>(null);
  const [livrosLidos, setLivrosLidos] = useState<LivroEstante[]>([]);
  const [publicacoes, setPublicacoes] = useState<Publicacao[]>([]);
  const [estatisticas, setEstatisticas] = useState<
    Record<number, Estatisticas>
  >({});

  const [carregando, setCarregando] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const [modalEditar, setModalEditar] = useState(false);
  const [modalComentarios, setModalComentarios] = useState(false);

  const [nomeEditado, setNomeEditado] = useState("");
  const [fotoEditada, setFotoEditada] = useState<string | null>(null);

  const [criticaSelecionada, setCriticaSelecionada] = useState<number | null>(
    null
  );

  const [comentarios, setComentarios] = useState<Comentario[]>([]);
  const [novoComentario, setNovoComentario] = useState("");
  const [carregandoComentarios, setCarregandoComentarios] = useState(false);
  const [enviandoComentario, setEnviandoComentario] = useState(false);

  const [aba, setAba] = useState<"publicacoes" | "livros">("publicacoes");

  const carregarPerfil = useCallback(async () => {
    try {
      const sessao = await AsyncStorage.getItem("usuarioLogado");

      if (!sessao) {
        router.replace("/login");
        return;
      }

      let dadosSessao: any = null;

      try {
        dadosSessao = JSON.parse(sessao);
      } catch {
        dadosSessao = null;
      }

      const usuarioId =
        typeof dadosSessao === "string"
          ? dadosSessao
          : dadosSessao?.id ??
          dadosSessao?.usuario_id ??
          dadosSessao?.userId ??
          dadosSessao?.usuarioId ??
          null;

      if (!usuarioId) {
        router.replace("/login");
        return;
      }

      const database = await getDb();

      const resultadoUsuario = await database
        .select()
        .from(usuarios)
        .where(eq(usuarios.id, String(usuarioId)))
        .limit(1);

      const usuarioAtual = resultadoUsuario[0];

      if (!usuarioAtual) {
        router.replace("/login");
        return;
      }

      const usuarioFormatado: Usuario = {
        id: String(usuarioAtual.id),
        nome: usuarioAtual.nome ?? "Utilizador",
        foto_perfil: usuarioAtual.foto_perfil ?? null,
      };

      setUsuario(usuarioFormatado);
      setNomeEditado(usuarioFormatado.nome);
      setFotoEditada(usuarioFormatado.foto_perfil);

      /*
       * Livros marcados como lidos pelo utilizador.
       */
      const resultadoLivros = await database
        .select({
          id: estantes.id,
          livro_id: estantes.livro_id,
          usuario_id: estantes.usuario_id,
          status: estantes.status,
          livro: livros,
        })
        .from(estantes)
        .leftJoin(livros, eq(estantes.livro_id, livros.id))
        .where(eq(estantes.usuario_id, String(usuarioId)));

      const somenteLidos: LivroEstante[] = resultadoLivros
        .filter((item) => item.status === "lido")
        .map((item) => ({
          id: item.id as string | number | undefined,
          livro_id: String(item.livro_id),
          usuario_id: String(item.usuario_id),
          status: String(item.status),
          livro: item.livro
            ? {
              id: String(item.livro.id),
              titulo: item.livro.titulo,
              autor: item.livro.autor ?? null,
              imagem: item.livro.imagem ?? null,
            }
            : null,
        }));

      setLivrosLidos(somenteLidos);

      /*
       * Carrega o feed e mostra apenas publicações
       * relacionadas ao próprio perfil.
       */
      const feed = await listarFeed();

      const minhasPublicacoes = feed.filter(
        (item) => String(item.usuario_id) === String(usuarioId)
      ) as Publicacao[];

      setPublicacoes(minhasPublicacoes);

      /*
       * Estatísticas de cada crítica.
       */
      const novasEstatisticas: Record<number, Estatisticas> = {};

      for (const publicacao of minhasPublicacoes) {
        if (publicacao.critica_id != null) {
          try {
            novasEstatisticas[publicacao.critica_id] =
              await obterEstatisticasCritica(
                publicacao.critica_id,
                String(usuarioId)
              );
          } catch (erro) {
            console.log(
              "Erro ao carregar estatísticas:",
              erro
            );
          }
        }
      }

      setEstatisticas(novasEstatisticas);
    } catch (erro) {
      console.error("Erro ao carregar perfil:", erro);

      Alert.alert(
        "Erro",
        "Não foi possível carregar os dados do perfil."
      );
    } finally {
      setCarregando(false);
      setRefreshing(false);
    }
  }, [router]);

  useFocusEffect(
    useCallback(() => {
      carregarPerfil();
    }, [carregarPerfil])
  );

  useEffect(() => {
    StatusBar.setBarStyle(
      isDark ? "light-content" : "dark-content"
    );
  }, [isDark]);

  const atualizar = useCallback(async () => {
    setRefreshing(true);
    await carregarPerfil();
  }, [carregarPerfil]);

  const abrirEdicao = () => {
    if (!usuario) return;

    setNomeEditado(usuario.nome);
    setFotoEditada(usuario.foto_perfil);
    setModalEditar(true);
  };

  const escolherFoto = async () => {
    try {
      const permissao =
        await ImagePicker.requestMediaLibraryPermissionsAsync();

      if (!permissao.granted) {
        Alert.alert(
          "Permissão necessária",
          "É necessário permitir o acesso às fotografias para escolher uma foto de perfil."
        );
        return;
      }

      const resultado =
        await ImagePicker.launchImageLibraryAsync({
          mediaTypes: ["images"],
          allowsEditing: true,
          aspect: [1, 1],
          quality: 0.85,
        });

      if (resultado.canceled) {
        return;
      }

      const uri = resultado.assets?.[0]?.uri;

      if (uri) {
        setFotoEditada(uri);
      }
    } catch (erro) {
      console.error("Erro ao escolher foto:", erro);

      Alert.alert(
        "Erro",
        "Não foi possível selecionar a fotografia."
      );
    }
  };

  const salvarPerfil = async () => {
    if (!usuario) return;

    const nome = nomeEditado.trim();

    if (!nome) {
      Alert.alert(
        "Nome obrigatório",
        "Digite um nome para o perfil."
      );
      return;
    }

    try {
      const database = await getDb();

      await database
        .update(usuarios)
        .set({
          nome,
          foto_perfil: fotoEditada ?? "",
        })
        .where(eq(usuarios.id, usuario.id));

      const usuarioAtualizado: Usuario = {
        ...usuario,
        nome,
        foto_perfil: fotoEditada,
      };

      setUsuario(usuarioAtualizado);

      /*
       * Mantém a sessão sincronizada.
       */
      const sessao = await AsyncStorage.getItem("usuarioLogado");

      if (sessao) {
        try {
          const dadosSessao = JSON.parse(sessao);

          const novaSessao =
            typeof dadosSessao === "object" && dadosSessao !== null
              ? {
                ...dadosSessao,
                nome,
                foto_perfil: fotoEditada,
              }
              : dadosSessao;

          await AsyncStorage.setItem(
            "usuarioLogado",
            JSON.stringify(novaSessao)
          );
        } catch {
          // A sessão continua válida mesmo se não puder ser atualizada.
        }
      }

      setModalEditar(false);

      Alert.alert(
        "Perfil atualizado",
        "As informações do teu perfil foram atualizadas com sucesso."
      );
    } catch (erro) {
      console.error("Erro ao salvar perfil:", erro);

      Alert.alert(
        "Erro",
        "Não foi possível atualizar o perfil."
      );
    }
  };

  const fazerLogout = async () => {
    try {
      await AsyncStorage.removeItem("usuarioLogado");

      router.replace("/login");
    } catch (erro) {
      console.error("Erro ao terminar sessão:", erro);
    }
  };

  const confirmarLogout = () => {
    Alert.alert(
      "Terminar sessão",
      "Tens a certeza que queres terminar a sessão?",
      [
        {
          text: "Cancelar",
          style: "cancel",
        },
        {
          text: "Sair",
          style: "destructive",
          onPress: fazerLogout,
        },
      ]
    );
  };

  const abrirComentarios = async (criticaId: number) => {
    setCriticaSelecionada(criticaId);
    setModalComentarios(true);
    setCarregandoComentarios(true);

    try {
      const resultado = await listarComentarios(criticaId);

      setComentarios(resultado as Comentario[]);
    } catch (erro) {
      console.error(
        "Erro ao carregar comentários:",
        erro
      );

      setComentarios([]);

      Alert.alert(
        "Erro",
        "Não foi possível carregar os comentários."
      );
    } finally {
      setCarregandoComentarios(false);
    }
  };

  const enviarComentario = async () => {
    if (
      !usuario ||
      criticaSelecionada == null ||
      !novoComentario.trim()
    ) {
      return;
    }

    try {
      setEnviandoComentario(true);

      const comentario = await criarComentario(
        usuario.id,
        criticaSelecionada,
        novoComentario.trim()
      );

      setComentarios((atual) => [
        ...atual,
        comentario as Comentario,
      ]);

      setNovoComentario("");

      setEstatisticas((atual) => ({
        ...atual,
        [criticaSelecionada]: {
          ...(atual[criticaSelecionada] ?? {
            curtidas: 0,
            comentarios: 0,
            curtiu: false,
          }),
          comentarios:
            (atual[criticaSelecionada]?.comentarios ?? 0) + 1,
        },
      }));
    } catch (erro) {
      console.error(
        "Erro ao enviar comentário:",
        erro
      );

      Alert.alert(
        "Erro",
        "Não foi possível publicar o comentário."
      );
    } finally {
      setEnviandoComentario(false);
    }
  };

  const curtirPublicacao = async (
    criticaId: number
  ) => {
    if (!usuario) return;

    try {
      const novaCurtida = await toggleCurtida(
        usuario.id,
        criticaId
      );

      setEstatisticas((atual) => {
        const anterior = atual[criticaId] ?? {
          curtidas: 0,
          comentarios: 0,
          curtiu: false,
        };

        return {
          ...atual,
          [criticaId]: {
            ...anterior,
            curtiu: novaCurtida,
            curtidas: Math.max(
              0,
              anterior.curtidas +
              (novaCurtida ? 1 : -1)
            ),
          },
        };
      });
    } catch (erro) {
      console.error(
        "Erro ao alterar curtida:",
        erro
      );

      Alert.alert(
        "Erro",
        "Não foi possível atualizar a curtida."
      );
    }
  };

  const formatarData = (data: string) => {
    try {
      const dataAtual = new Date(data);

      return dataAtual.toLocaleDateString("pt-PT", {
        day: "2-digit",
        month: "short",
        year: "numeric",
      });
    } catch {
      return "";
    }
  };

  const inicialNome = useMemo(() => {
    if (!usuario?.nome) return "?";

    return usuario.nome
      .trim()
      .charAt(0)
      .toUpperCase();
  }, [usuario?.nome]);

  const renderAvatar = (
    tamanho: number = 92,
    uri?: string | null
  ) => {
    if (uri) {
      return (
        <Image
          source={{ uri }}
          style={{
            width: tamanho,
            height: tamanho,
            borderRadius: tamanho / 2,
          }}
        />
      );
    }

    return (
      <View
        style={[
          styles.avatarPlaceholder,
          {
            width: tamanho,
            height: tamanho,
            borderRadius: tamanho / 2,
            backgroundColor: theme.blue,
          },
        ]}
      >
        <Text
          style={[
            styles.avatarInitial,
            {
              fontSize: tamanho * 0.4,
            },
          ]}
        >
          {inicialNome}
        </Text>
      </View>
    );
  };

  const publicacoesVisiveis = publicacoes.filter(
    (item) =>
      item.tipo !== "curtida" &&
      (item.livro != null || item.critica_id != null)
  );

  const renderPublicacao = ({
    item,
  }: {
    item: Publicacao;
  }) => {
    const criticaId = item.critica_id;

    const stats =
      criticaId != null
        ? estatisticas[criticaId] ?? {
          curtidas: 0,
          comentarios: 0,
          curtiu: false,
        }
        : null;

    return (
      <View
        style={[
          styles.card,
          {
            backgroundColor: theme.surface,
            borderColor: theme.border,
          },
        ]}
      >
        <View style={styles.postHeader}>
          {renderAvatar(
            46,
            item.usuario?.foto_perfil ?? usuario?.foto_perfil
          )}

          <View style={styles.postHeaderInfo}>
            <Text
              style={[
                styles.postUserName,
                { color: theme.text },
              ]}
              numberOfLines={1}
            >
              {item.usuario?.nome ?? usuario?.nome}
            </Text>

            <Text
              style={[
                styles.postDate,
                { color: theme.textSecondary },
              ]}
            >
              {formatarData(item.createdAt)}
            </Text>
          </View>

          <MaterialCommunityIcons
            name="dots-horizontal"
            size={22}
            color={theme.textSecondary}
          />
        </View>

        {item.livro && (
          <View
            style={[
              styles.bookPost,
              {
                backgroundColor:
                  theme.surfaceSecondary,
                borderColor: theme.border,
              },
            ]}
          >
            {item.livro.imagem ? (
              <Image
                source={{
                  uri: item.livro.imagem,
                }}
                style={styles.bookCover}
              />
            ) : (
              <View
                style={[
                  styles.bookCoverPlaceholder,
                  {
                    backgroundColor: theme.blueSoft,
                  },
                ]}
              >
                <MaterialCommunityIcons
                  name="book-open-page-variant"
                  size={32}
                  color={theme.blue}
                />
              </View>
            )}

            <View style={styles.bookPostInfo}>
              <Text
                style={[
                  styles.bookPostLabel,
                  { color: theme.blue },
                ]}
              >
                LIVRO LIDO
              </Text>

              <Text
                style={[
                  styles.bookPostTitle,
                  { color: theme.text },
                ]}
                numberOfLines={2}
              >
                {item.livro.titulo}
              </Text>

              {item.livro.autor && (
                <Text
                  style={[
                    styles.bookPostAuthor,
                    {
                      color:
                        theme.textSecondary,
                    },
                  ]}
                  numberOfLines={1}
                >
                  {item.livro.autor}
                </Text>
              )}
            </View>
          </View>
        )}

        {criticaId != null && (
          <>
            <View
              style={[
                styles.reviewBox,
                {
                  backgroundColor:
                    theme.surfaceSecondary,
                },
              ]}
            >
              <MaterialCommunityIcons
                name="format-quote-open"
                size={24}
                color={theme.blue}
              />

              <Text
                style={[
                  styles.reviewText,
                  { color: theme.text },
                ]}
              >
                A tua crítica está disponível na publicação.
              </Text>
            </View>

            <View
              style={[
                styles.postStats,
                {
                  borderBottomColor:
                    theme.border,
                },
              ]}
            >
              <View style={styles.likeCount}>
                {stats && stats.curtidas > 0 && (
                  <>
                    <View
                      style={[
                        styles.likeCircle,
                        {
                          backgroundColor:
                            theme.blue,
                        },
                      ]}
                    >
                      <MaterialCommunityIcons
                        name="thumb-up"
                        size={11}
                        color="#FFFFFF"
                      />
                    </View>

                    <Text
                      style={[
                        styles.statText,
                        {
                          color:
                            theme.textSecondary,
                        },
                      ]}
                    >
                      {stats.curtidas}
                    </Text>
                  </>
                )}
              </View>

              <TouchableOpacity
                onPress={() =>
                  abrirComentarios(criticaId)
                }
              >
                <Text
                  style={[
                    styles.statText,
                    {
                      color:
                        theme.textSecondary,
                    },
                  ]}
                >
                  {stats?.comentarios ?? 0}{" "}
                  {stats?.comentarios === 1
                    ? "comentário"
                    : "comentários"}
                </Text>
              </TouchableOpacity>
            </View>

            <View style={styles.postActions}>
              <TouchableOpacity
                style={styles.postAction}
                onPress={() =>
                  curtirPublicacao(criticaId)
                }
              >
                <MaterialCommunityIcons
                  name={
                    stats?.curtiu
                      ? "thumb-up"
                      : "thumb-up-outline"
                  }
                  size={22}
                  color={
                    stats?.curtiu
                      ? theme.blue
                      : theme.textSecondary
                  }
                />

                <Text
                  style={[
                    styles.postActionText,
                    {
                      color: stats?.curtiu
                        ? theme.blue
                        : theme.textSecondary,
                    },
                  ]}
                >
                  Gosto
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.postAction}
                onPress={() =>
                  abrirComentarios(criticaId)
                }
              >
                <MaterialCommunityIcons
                  name="comment-outline"
                  size={22}
                  color={theme.textSecondary}
                />

                <Text
                  style={[
                    styles.postActionText,
                    {
                      color:
                        theme.textSecondary,
                    },
                  ]}
                >
                  Comentar
                </Text>
              </TouchableOpacity>
            </View>
          </>
        )}
      </View>
    );
  };

  const renderLivro = ({
    item,
  }: {
    item: LivroEstante;
  }) => {
    if (!item.livro) return null;

    return (
      <View
        style={[
          styles.bookCard,
          {
            backgroundColor: theme.surface,
            borderColor: theme.border,
          },
        ]}
      >
        {item.livro.imagem ? (
          <Image
            source={{
              uri: item.livro.imagem,
            }}
            style={styles.libraryCover}
          />
        ) : (
          <View
            style={[
              styles.libraryCoverPlaceholder,
              {
                backgroundColor:
                  theme.blueSoft,
              },
            ]}
          >
            <MaterialCommunityIcons
              name="book-open-page-variant"
              size={34}
              color={theme.blue}
            />
          </View>
        )}

        <View style={styles.libraryInfo}>
          <Text
            style={[
              styles.libraryTitle,
              { color: theme.text },
            ]}
            numberOfLines={2}
          >
            {item.livro.titulo}
          </Text>

          {item.livro.autor && (
            <Text
              style={[
                styles.libraryAuthor,
                {
                  color:
                    theme.textSecondary,
                },
              ]}
              numberOfLines={2}
            >
              {item.livro.autor}
            </Text>
          )}

          <View
            style={[
              styles.readBadge,
              {
                backgroundColor:
                  theme.blueSoft,
              },
            ]}
          >
            <MaterialCommunityIcons
              name="check-circle"
              size={15}
              color={theme.blue}
            />

            <Text
              style={[
                styles.readBadgeText,
                { color: theme.blue },
              ]}
            >
              Lido
            </Text>
          </View>
        </View>
      </View>
    );
  };

  if (carregando && !usuario) {
    return (
      <SafeAreaView
        style={[
          styles.safeArea,
          { backgroundColor: theme.background },
        ]}
        edges={["top"]}
      >
        <StatusBar
          barStyle={
            isDark
              ? "light-content"
              : "dark-content"
          }
          backgroundColor={theme.background}
        />

        <View style={styles.loadingContainer}>
          <ActivityIndicator
            size="large"
            color={theme.blue}
          />

          <Text
            style={[
              styles.loadingText,
              { color: theme.textSecondary },
            ]}
          >
            A carregar perfil...
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView
      style={[
        styles.safeArea,
        {
          backgroundColor: theme.background,
        },
      ]}
      edges={["top"]}
    >
      <StatusBar
        barStyle={
          isDark
            ? "light-content"
            : "dark-content"
        }
        backgroundColor={theme.background}
      />

      <View
        style={[
          styles.header,
          {
            backgroundColor: theme.surface,
            borderBottomColor: theme.border,
          },
        ]}
      >
        <Text
          style={[
            styles.headerTitle,
            { color: theme.text },
          ]}
        >
          Perfil
        </Text>

        <View style={styles.headerActions}>
          <TouchableOpacity
            style={[
              styles.headerButton,
              {
                backgroundColor:
                  theme.surfaceSecondary,
              },
            ]}
            onPress={abrirEdicao}
          >
            <MaterialCommunityIcons
              name="pencil-outline"
              size={22}
              color={theme.text}
            />
          </TouchableOpacity>

          <TouchableOpacity
            style={[
              styles.headerButton,
              {
                backgroundColor:
                  theme.surfaceSecondary,
              },
            ]}
            onPress={confirmarLogout}
          >
            <MaterialCommunityIcons
              name="logout"
              size={22}
              color={theme.text}
            />
          </TouchableOpacity>
        </View>
      </View>

      <FlatList
        data={
          aba === "publicacoes"
            ? publicacoesVisiveis
            : livrosLidos
        }
        keyExtractor={(item, index) =>
          String(
            "id" in item && item.id != null
              ? item.id
              : index
          )
        }
        renderItem={
          aba === "publicacoes"
            ? (renderPublicacao as any)
            : (renderLivro as any)
        }
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={atualizar}
            tintColor={theme.blue}
            colors={[theme.blue]}
          />
        }
        ListHeaderComponent={
          <View>
            <View
              style={[
                styles.profileCard,
                {
                  backgroundColor:
                    theme.surface,
                  borderColor:
                    theme.border,
                },
              ]}
            >
              <View
                style={[
                  styles.coverHeader,
                  {
                    backgroundColor:
                      theme.blue,
                  },
                ]}
              />

              <View style={styles.profileMain}>
                <View
                  style={[
                    styles.profileAvatarWrapper,
                    {
                      backgroundColor:
                        theme.surface,
                    },
                  ]}
                >
                  {renderAvatar(
                    104,
                    usuario?.foto_perfil
                  )}
                </View>

                <Text
                  style={[
                    styles.profileName,
                    { color: theme.text },
                  ]}
                  numberOfLines={2}
                >
                  {usuario?.nome ?? "Utilizador"}
                </Text>

                <Text
                  style={[
                    styles.profileSubtitle,
                    {
                      color:
                        theme.textSecondary,
                    },
                  ]}
                >
                  Leitor e membro da comunidade
                </Text>

                <View
                  style={[
                    styles.profileStats,
                    {
                      borderTopColor:
                        theme.border,
                    },
                  ]}
                >
                  <View style={styles.profileStat}>
                    <Text
                      style={[
                        styles.profileStatNumber,
                        {
                          color:
                            theme.text,
                        },
                      ]}
                    >
                      {publicacoesVisiveis.length}
                    </Text>

                    <Text
                      style={[
                        styles.profileStatLabel,
                        {
                          color:
                            theme.textSecondary,
                        },
                      ]}
                    >
                      Publicações
                    </Text>
                  </View>

                  <View
                    style={[
                      styles.profileStatDivider,
                      {
                        backgroundColor:
                          theme.border,
                      },
                    ]}
                  />

                  <View style={styles.profileStat}>
                    <Text
                      style={[
                        styles.profileStatNumber,
                        {
                          color:
                            theme.text,
                        },
                      ]}
                    >
                      {livrosLidos.length}
                    </Text>

                    <Text
                      style={[
                        styles.profileStatLabel,
                        {
                          color:
                            theme.textSecondary,
                        },
                      ]}
                    >
                      Livros lidos
                    </Text>
                  </View>
                </View>
              </View>
            </View>

            <View
              style={[
                styles.tabs,
                {
                  backgroundColor:
                    theme.surface,
                  borderColor:
                    theme.border,
                },
              ]}
            >
              <TouchableOpacity
                style={[
                  styles.tab,
                  aba === "publicacoes" &&
                  styles.tabActive,
                  aba === "publicacoes" && {
                    borderBottomColor:
                      theme.blue,
                  },
                ]}
                onPress={() =>
                  setAba("publicacoes")
                }
              >
                <MaterialCommunityIcons
                  name="newspaper-variant-outline"
                  size={20}
                  color={
                    aba === "publicacoes"
                      ? theme.blue
                      : theme.textSecondary
                  }
                />

                <Text
                  style={[
                    styles.tabText,
                    {
                      color:
                        aba === "publicacoes"
                          ? theme.blue
                          : theme.textSecondary,
                    },
                  ]}
                >
                  Publicações
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[
                  styles.tab,
                  aba === "livros" &&
                  styles.tabActive,
                  aba === "livros" && {
                    borderBottomColor:
                      theme.blue,
                  },
                ]}
                onPress={() =>
                  setAba("livros")
                }
              >
                <MaterialCommunityIcons
                  name="bookshelf"
                  size={20}
                  color={
                    aba === "livros"
                      ? theme.blue
                      : theme.textSecondary
                  }
                />

                <Text
                  style={[
                    styles.tabText,
                    {
                      color:
                        aba === "livros"
                          ? theme.blue
                          : theme.textSecondary,
                    },
                  ]}
                >
                  Livros lidos
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        }
        ListEmptyComponent={
          <View
            style={[
              styles.emptyCard,
              {
                backgroundColor:
                  theme.surface,
                borderColor:
                  theme.border,
              },
            ]}
          >
            <View
              style={[
                styles.emptyIcon,
                {
                  backgroundColor:
                    theme.blueSoft,
                },
              ]}
            >
              <MaterialCommunityIcons
                name={
                  aba === "livros"
                    ? "book-open-page-variant"
                    : "newspaper-variant-outline"
                }
                size={34}
                color={theme.blue}
              />
            </View>

            <Text
              style={[
                styles.emptyTitle,
                { color: theme.text },
              ]}
            >
              {aba === "livros"
                ? "Ainda não tens livros lidos"
                : "Ainda não tens publicações"}
            </Text>

            <Text
              style={[
                styles.emptyText,
                {
                  color:
                    theme.textSecondary,
                },
              ]}
            >
              {aba === "livros"
                ? "Os livros que marcares como lidos aparecerão aqui."
                : "As tuas atividades e críticas aparecerão aqui."}
            </Text>
          </View>
        }
      />

      {/* MODAL EDITAR PERFIL */}

      <Modal
        visible={modalEditar}
        transparent
        animationType="slide"
        onRequestClose={() =>
          setModalEditar(false)
        }
      >
        <View
          style={[
            styles.modalOverlay,
            {
              backgroundColor:
                theme.overlay,
            },
          ]}
        >
          <View
            style={[
              styles.editModal,
              {
                backgroundColor:
                  theme.surface,
              },
            ]}
          >
            <View style={styles.modalHeader}>
              <Text
                style={[
                  styles.modalTitle,
                  { color: theme.text },
                ]}
              >
                Editar perfil
              </Text>

              <TouchableOpacity
                onPress={() =>
                  setModalEditar(false)
                }
              >
                <MaterialCommunityIcons
                  name="close"
                  size={25}
                  color={theme.textSecondary}
                />
              </TouchableOpacity>
            </View>

            <ScrollView
              showsVerticalScrollIndicator={false}
              keyboardShouldPersistTaps="handled"
            >
              <View style={styles.editPhotoArea}>
                <View
                  style={[
                    styles.editPhoto,
                    {
                      backgroundColor:
                        theme.surfaceSecondary,
                    },
                  ]}
                >
                  {renderAvatar(
                    112,
                    fotoEditada
                  )}
                </View>

                <TouchableOpacity
                  style={[
                    styles.changePhotoButton,
                    {
                      backgroundColor:
                        theme.blueSoft,
                    },
                  ]}
                  onPress={escolherFoto}
                >
                  <MaterialCommunityIcons
                    name="camera-outline"
                    size={19}
                    color={theme.blue}
                  />

                  <Text
                    style={[
                      styles.changePhotoText,
                      {
                        color:
                          theme.blue,
                      },
                    ]}
                  >
                    Alterar fotografia
                  </Text>
                </TouchableOpacity>
              </View>

              <Text
                style={[
                  styles.inputLabel,
                  { color: theme.text },
                ]}
              >
                Nome
              </Text>

              <TextInput
                value={nomeEditado}
                onChangeText={setNomeEditado}
                placeholder="O teu nome"
                placeholderTextColor={
                  theme.muted
                }
                style={[
                  styles.input,
                  {
                    color: theme.text,
                    backgroundColor:
                      theme.input,
                    borderColor:
                      theme.border,
                  },
                ]}
                autoCapitalize="words"
              />

              <TouchableOpacity
                style={[
                  styles.saveButton,
                  {
                    backgroundColor:
                      theme.blue,
                  },
                ]}
                onPress={salvarPerfil}
              >
                <MaterialCommunityIcons
                  name="content-save-outline"
                  size={20}
                  color="#FFFFFF"
                />

                <Text
                  style={
                    styles.saveButtonText
                  }
                >
                  Guardar alterações
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[
                  styles.cancelButton,
                  {
                    borderColor:
                      theme.border,
                  },
                ]}
                onPress={() =>
                  setModalEditar(false)
                }
              >
                <Text
                  style={[
                    styles.cancelButtonText,
                    {
                      color:
                        theme.text,
                    },
                  ]}
                >
                  Cancelar
                </Text>
              </TouchableOpacity>
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* MODAL COMENTÁRIOS */}

      <Modal
        visible={modalComentarios}
        transparent
        animationType="slide"
        onRequestClose={() =>
          setModalComentarios(false)
        }
      >
        <View
          style={[
            styles.modalOverlay,
            {
              backgroundColor:
                theme.overlay,
            },
          ]}
        >
          <View
            style={[
              styles.commentsModal,
              {
                backgroundColor:
                  theme.surface,
              },
            ]}
          >
            <View style={styles.modalHeader}>
              <Text
                style={[
                  styles.modalTitle,
                  { color: theme.text },
                ]}
              >
                Comentários
              </Text>

              <TouchableOpacity
                onPress={() =>
                  setModalComentarios(false)
                }
              >
                <MaterialCommunityIcons
                  name="close"
                  size={25}
                  color={theme.textSecondary}
                />
              </TouchableOpacity>
            </View>

            {carregandoComentarios ? (
              <View
                style={
                  styles.commentsLoading
                }
              >
                <ActivityIndicator
                  size="large"
                  color={theme.blue}
                />

                <Text
                  style={[
                    styles.loadingText,
                    {
                      color:
                        theme.textSecondary,
                    },
                  ]}
                >
                  A carregar comentários...
                </Text>
              </View>
            ) : (
              <>
                <FlatList
                  data={comentarios}
                  keyExtractor={(item) =>
                    String(item.id)
                  }
                  showsVerticalScrollIndicator={
                    false
                  }
                  contentContainerStyle={
                    comentarios.length === 0
                      ? styles.emptyComments
                      : styles.commentsList
                  }
                  renderItem={({
                    item,
                  }) => (
                    <View
                      style={
                        styles.commentRow
                      }
                    >
                      {renderAvatar(
                        40,
                        item.usuario
                          ?.foto_perfil
                      )}

                      <View
                        style={[
                          styles.commentBubble,
                          {
                            backgroundColor:
                              theme.input,
                          },
                        ]}
                      >
                        <Text
                          style={[
                            styles.commentName,
                            {
                              color:
                                theme.text,
                            },
                          ]}
                        >
                          {item.usuario
                            ?.nome ??
                            "Utilizador"}
                        </Text>

                        <Text
                          style={[
                            styles.commentText,
                            {
                              color:
                                theme.text,
                            },
                          ]}
                        >
                          {item.texto}
                        </Text>
                      </View>
                    </View>
                  )}
                  ListEmptyComponent={
                    <View
                      style={
                        styles.emptyCommentsInner
                      }
                    >
                      <MaterialCommunityIcons
                        name="comment-outline"
                        size={42}
                        color={theme.muted}
                      />

                      <Text
                        style={[
                          styles.emptyCommentsTitle,
                          {
                            color:
                              theme.text,
                          },
                        ]}
                      >
                        Ainda não existem comentários
                      </Text>

                      <Text
                        style={[
                          styles.emptyCommentsText,
                          {
                            color:
                              theme.textSecondary,
                          },
                        ]}
                      >
                        Sê o primeiro a comentar esta publicação.
                      </Text>
                    </View>
                  }
                />
              </>
            )}

            <View
              style={[
                styles.commentComposer,
                {
                  borderTopColor:
                    theme.border,
                  backgroundColor:
                    theme.surface,
                },
              ]}
            >
              <TextInput
                value={novoComentario}
                onChangeText={
                  setNovoComentario
                }
                placeholder="Escreve um comentário..."
                placeholderTextColor={
                  theme.muted
                }
                style={[
                  styles.commentInput,
                  {
                    color: theme.text,
                    backgroundColor:
                      theme.input,
                    borderColor:
                      theme.border,
                  },
                ]}
                multiline
              />

              <TouchableOpacity
                style={[
                  styles.sendCommentButton,
                  {
                    backgroundColor:
                      novoComentario.trim()
                        ? theme.blue
                        : theme.border,
                  },
                ]}
                disabled={
                  enviandoComentario ||
                  !novoComentario.trim()
                }
                onPress={
                  enviarComentario
                }
              >
                {enviandoComentario ? (
                  <ActivityIndicator
                    size="small"
                    color="#FFFFFF"
                  />
                ) : (
                  <MaterialCommunityIcons
                    name="send"
                    size={20}
                    color="#FFFFFF"
                  />
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
  },

  header: {
    minHeight: 58,
    paddingHorizontal: 16,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    borderBottomWidth: StyleSheet.hairlineWidth,
  },

  headerTitle: {
    fontSize: 22,
    fontWeight: "800",
  },

  headerActions: {
    flexDirection: "row",
    gap: 9,
  },

  headerButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
  },

  listContent: {
    paddingBottom: 35,
  },

  profileCard: {
    marginBottom: 10,
    borderWidth: 1,
    overflow: "hidden",
  },

  coverHeader: {
    height: 105,
  },

  profileMain: {
    alignItems: "center",
    paddingHorizontal: 18,
    paddingBottom: 20,
  },

  profileAvatarWrapper: {
    padding: 4,
    borderRadius: 60,
    marginTop: -56,
  },

  avatarPlaceholder: {
    alignItems: "center",
    justifyContent: "center",
  },

  avatarInitial: {
    color: "#FFFFFF",
    fontWeight: "800",
  },

  profileName: {
    marginTop: 10,
    fontSize: 24,
    fontWeight: "800",
    textAlign: "center",
  },

  profileSubtitle: {
    marginTop: 4,
    fontSize: 14,
    textAlign: "center",
  },

  profileStats: {
    width: "100%",
    marginTop: 20,
    paddingTop: 17,
    borderTopWidth: StyleSheet.hairlineWidth,
    flexDirection: "row",
    justifyContent: "center",
  },

  profileStat: {
    minWidth: 125,
    alignItems: "center",
  },

  profileStatNumber: {
    fontSize: 20,
    fontWeight: "800",
  },

  profileStatLabel: {
    marginTop: 3,
    fontSize: 13,
  },

  profileStatDivider: {
    width: 1,
    height: 35,
  },

  tabs: {
    flexDirection: "row",
    borderWidth: 1,
    marginBottom: 10,
  },

  tab: {
    flex: 1,
    minHeight: 53,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: 8,
    borderBottomWidth: 3,
    borderBottomColor: "transparent",
  },

  tabActive: {
    fontWeight: "700",
  },

  tabText: {
    fontSize: 14,
    fontWeight: "700",
  },

  card: {
    marginBottom: 10,
    borderWidth: 1,
    paddingTop: 14,
    paddingHorizontal: 15,
    paddingBottom: 4,
  },

  postHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 13,
  },

  postHeaderInfo: {
    flex: 1,
    marginLeft: 10,
  },

  postUserName: {
    fontSize: 15,
    fontWeight: "800",
  },

  postDate: {
    marginTop: 2,
    fontSize: 12,
  },

  bookPost: {
    flexDirection: "row",
    borderWidth: 1,
    padding: 11,
    borderRadius: 10,
    marginBottom: 12,
  },

  bookCover: {
    width: 67,
    height: 96,
    borderRadius: 6,
  },

  bookCoverPlaceholder: {
    width: 67,
    height: 96,
    borderRadius: 6,
    alignItems: "center",
    justifyContent: "center",
  },

  bookPostInfo: {
    flex: 1,
    paddingLeft: 12,
    justifyContent: "center",
  },

  bookPostLabel: {
    fontSize: 11,
    fontWeight: "800",
    letterSpacing: 0.6,
    marginBottom: 5,
  },

  bookPostTitle: {
    fontSize: 17,
    fontWeight: "800",
    lineHeight: 22,
  },

  bookPostAuthor: {
    marginTop: 5,
    fontSize: 13,
  },

  reviewBox: {
    padding: 14,
    borderRadius: 10,
    flexDirection: "row",
    gap: 8,
    marginBottom: 10,
  },

  reviewText: {
    flex: 1,
    fontSize: 14,
    lineHeight: 21,
  },

  postStats: {
    minHeight: 38,
    alignItems: "center",
    justifyContent: "space-between",
    flexDirection: "row",
    borderBottomWidth: StyleSheet.hairlineWidth,
  },

  likeCount: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
  },

  likeCircle: {
    width: 20,
    height: 20,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
  },

  statText: {
    fontSize: 12,
  },

  postActions: {
    flexDirection: "row",
    minHeight: 44,
  },

  postAction: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 7,
  },

  postActionText: {
    fontSize: 13,
    fontWeight: "700",
  },

  bookCard: {
    marginBottom: 10,
    padding: 12,
    borderWidth: 1,
    flexDirection: "row",
  },

  libraryCover: {
    width: 84,
    height: 120,
    borderRadius: 7,
  },

  libraryCoverPlaceholder: {
    width: 84,
    height: 120,
    borderRadius: 7,
    alignItems: "center",
    justifyContent: "center",
  },

  libraryInfo: {
    flex: 1,
    paddingLeft: 13,
    justifyContent: "center",
  },

  libraryTitle: {
    fontSize: 16,
    fontWeight: "800",
    lineHeight: 21,
  },

  libraryAuthor: {
    marginTop: 5,
    fontSize: 13,
    lineHeight: 18,
  },

  readBadge: {
    alignSelf: "flex-start",
    marginTop: 11,
    paddingHorizontal: 9,
    paddingVertical: 5,
    borderRadius: 14,
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },

  readBadgeText: {
    fontSize: 12,
    fontWeight: "800",
  },

  emptyCard: {
    margin: 10,
    padding: 30,
    borderWidth: 1,
    alignItems: "center",
  },

  emptyIcon: {
    width: 70,
    height: 70,
    borderRadius: 35,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 15,
  },

  emptyTitle: {
    fontSize: 17,
    fontWeight: "800",
    textAlign: "center",
  },

  emptyText: {
    marginTop: 7,
    fontSize: 13,
    lineHeight: 20,
    textAlign: "center",
    maxWidth: 300,
  },

  loadingContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },

  loadingText: {
    marginTop: 12,
    fontSize: 14,
  },

  modalOverlay: {
    flex: 1,
    justifyContent: "flex-end",
  },

  editModal: {
    maxHeight: "88%",
    paddingHorizontal: 18,
    paddingTop: 17,
    paddingBottom:
      Platform.OS === "ios" ? 28 : 18,
    borderTopLeftRadius: 22,
    borderTopRightRadius: 22,
  },

  commentsModal: {
    height: "88%",
    paddingTop: 17,
    borderTopLeftRadius: 22,
    borderTopRightRadius: 22,
  },

  modalHeader: {
    paddingHorizontal: 18,
    paddingBottom: 15,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },

  modalTitle: {
    fontSize: 20,
    fontWeight: "800",
  },

  editPhotoArea: {
    alignItems: "center",
    paddingVertical: 12,
  },

  editPhoto: {
    padding: 4,
    borderRadius: 60,
  },

  changePhotoButton: {
    marginTop: 12,
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: 20,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },

  changePhotoText: {
    fontSize: 13,
    fontWeight: "800",
  },

  inputLabel: {
    marginTop: 8,
    marginBottom: 7,
    fontSize: 14,
    fontWeight: "700",
  },

  input: {
    minHeight: 48,
    paddingHorizontal: 14,
    borderRadius: 9,
    borderWidth: 1,
    fontSize: 15,
  },

  saveButton: {
    minHeight: 49,
    marginTop: 20,
    borderRadius: 9,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: 8,
  },

  saveButtonText: {
    color: "#FFFFFF",
    fontSize: 15,
    fontWeight: "800",
  },

  cancelButton: {
    minHeight: 48,
    marginTop: 10,
    borderRadius: 9,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },

  cancelButtonText: {
    fontSize: 15,
    fontWeight: "700",
  },

  commentsLoading: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },

  commentsList: {
    paddingHorizontal: 16,
    paddingBottom: 10,
  },

  emptyComments: {
    flexGrow: 1,
    paddingHorizontal: 25,
  },

  emptyCommentsInner: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },

  emptyCommentsTitle: {
    marginTop: 12,
    fontSize: 16,
    fontWeight: "800",
    textAlign: "center",
  },

  emptyCommentsText: {
    marginTop: 5,
    fontSize: 13,
    textAlign: "center",
  },

  commentRow: {
    flexDirection: "row",
    marginBottom: 13,
    alignItems: "flex-start",
  },

  commentBubble: {
    flex: 1,
    marginLeft: 9,
    paddingHorizontal: 12,
    paddingVertical: 9,
    borderRadius: 13,
  },

  commentName: {
    fontSize: 13,
    fontWeight: "800",
    marginBottom: 3,
  },

  commentText: {
    fontSize: 14,
    lineHeight: 19,
  },

  commentComposer: {
    padding: 12,
    borderTopWidth: StyleSheet.hairlineWidth,
    flexDirection: "row",
    alignItems: "flex-end",
    gap: 8,
  },

  commentInput: {
    flex: 1,
    minHeight: 43,
    maxHeight: 100,
    paddingHorizontal: 13,
    paddingVertical: 10,
    borderRadius: 21,
    borderWidth: 1,
    fontSize: 14,
  },

  sendCommentButton: {
    width: 43,
    height: 43,
    borderRadius: 22,
    alignItems: "center",
    justifyContent: "center",
  },
});
