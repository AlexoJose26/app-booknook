import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useRouter } from "expo-router";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

import {
  ActivityIndicator,
  Alert,
  FlatList,
  Image,
  Modal,
  RefreshControl,
  SafeAreaView,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  useColorScheme,
} from "react-native";

import { WebView } from "react-native-webview";

import { useLivros } from "@/contexts/LivrosContext";
import { useThemeCustom } from "@/contexts/ThemeContext";
import { useUsuario } from "@/contexts/UsuarioContext";

import { db } from "@/database/db";
import { estantes, livros } from "@/database/schema";

import { eq } from "drizzle-orm";

type StatusLivro = "queroLer" | "lendo" | "lido";

type LivroEstante = {
  estanteId: number;
  livroId: string;
  titulo: string;
  autor: string | null;
  imagem: string | null;
  googleReaderLink: string | null;
  status: StatusLivro;
};

const FACEBOOK_BLUE = "#1877F2";
const FACEBOOK_BLUE_DARK = "#166FE5";
const FACEBOOK_BLUE_DEEP = "#0D65D9";

const STATUS_CONFIG: Record<
  StatusLivro,
  {
    label: string;
    shortLabel: string;
    icon: keyof typeof MaterialCommunityIcons.glyphMap;
    colorLight: string;
    colorDark: string;
    softLight: string;
    softDark: string;
  }
> = {
  queroLer: {
    label: "Quero ler",
    shortLabel: "Quero ler",
    icon: "bookmark-outline",
    colorLight: "#4B78B8",
    colorDark: "#8DB7EA",
    softLight: "#EAF2FC",
    softDark: "#1B2B3D",
  },

  lendo: {
    label: "Lendo",
    shortLabel: "Lendo",
    icon: "book-open-page-variant-outline",
    colorLight: FACEBOOK_BLUE,
    colorDark: "#6DADE3",
    softLight: "#E7F3FF",
    softDark: "#172C3C",
  },

  lido: {
    label: "Lido",
    shortLabel: "Lidos",
    icon: "check-circle-outline",
    colorLight: "#2878C7",
    colorDark: "#78B9F0",
    softLight: "#E8F4FF",
    softDark: "#183047",
  },
};

export default function Estantes() {
  const router = useRouter();

  const { theme } = useThemeCustom();
  const { usuario } = useUsuario();
  const { livroAbrirAutomatico } = useLivros();

  const colorScheme = useColorScheme();

  const isDark = theme === "dark" || colorScheme === "dark";

  const colors = useMemo(
    () =>
      isDark
        ? {
          background: "#0E1114",
          card: "#15191D",
          cardSecondary: "#1B2025",

          text: "#F5F6F7",
          secondary: "#AAB3BC",

          primary: "#4B9BFF",
          primaryDark: FACEBOOK_BLUE_DARK,
          primaryDeep: FACEBOOK_BLUE_DEEP,

          border: "#2A3036",

          soft: "#17283B",
          muted: "#1C2732",
          input: "#12171B",

          white: "#FFFFFF",

          success: "#78B9F0",
          successSoft: "#183047",

          danger: "#EF6B6B",
        }
        : {
          background: "#F0F2F5",
          card: "#FFFFFF",
          cardSecondary: "#F7F8FA",

          text: "#1C1E21",
          secondary: "#65676B",

          primary: FACEBOOK_BLUE,
          primaryDark: FACEBOOK_BLUE_DARK,
          primaryDeep: FACEBOOK_BLUE_DEEP,

          border: "#DADDE1",

          soft: "#E7F3FF",
          muted: "#EAF2FB",
          input: "#F0F2F5",

          white: "#FFFFFF",

          success: "#2878C7",
          successSoft: "#E8F4FF",

          danger: "#D94B4B",
        },
    [isDark]
  );

  const [aba, setAba] = useState<StatusLivro>("lido");

  const [livrosEstante, setLivrosEstante] = useState<LivroEstante[]>(
    []
  );

  const [livroAberto, setLivroAberto] =
    useState<LivroEstante | null>(null);

  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const [webViewLoading, setWebViewLoading] =
    useState(true);

  const [concluindoLeitura, setConcluindoLeitura] =
    useState(false);

  const [
    mostrarControlesLeitor,
    setMostrarControlesLeitor,
  ] = useState(true);

  const livroAutomaticoProcessado =
    useRef<string | null>(null);

  const webViewRef = useRef<WebView>(null);

  const abrirLivro = useCallback(
    async (livro: LivroEstante) => {
      if (!livro.googleReaderLink) {
        Alert.alert(
          "Leitura indisponível",
          "Este livro ainda não possui um conteúdo ou link disponível para leitura."
        );
        return;
      }

      try {
        if (livro.status === "queroLer") {
          await db
            .update(estantes)
            .set({
              status: "lendo",
            })
            .where(eq(estantes.id, livro.estanteId));

          setLivrosEstante((atual) =>
            atual.map((item) =>
              item.estanteId === livro.estanteId
                ? {
                  ...item,
                  status: "lendo",
                }
                : item
            )
          );

          livro = {
            ...livro,
            status: "lendo",
          };
        }

        setWebViewLoading(true);
        setMostrarControlesLeitor(true);
        setLivroAberto(livro);
      } catch (error) {
        console.error(
          "Erro ao iniciar leitura:",
          error
        );

        Alert.alert(
          "Erro",
          "Não foi possível iniciar a leitura deste livro."
        );
      }
    },
    []
  );

  const carregarEstantes = useCallback(
    async (mostrarLoading = true) => {
      if (!usuario) {
        setLivrosEstante([]);
        return;
      }

      if (mostrarLoading) {
        setLoading(true);
      }

      try {
        const dados = await db
          .select({
            estanteId: estantes.id,
            status: estantes.status,
            livroId: livros.id,
            titulo: livros.titulo,
            autor: livros.autor,
            imagem: livros.imagem,
            googleReaderLink: livros.googleReaderLink,
          })
          .from(estantes)
          .innerJoin(
            livros,
            eq(estantes.livro_id, livros.id)
          )
          .where(eq(estantes.usuario_id, usuario.id));

        const livrosFormatados: LivroEstante[] =
          dados.map((livro) => ({
            estanteId: livro.estanteId,
            livroId: livro.livroId,
            titulo: livro.titulo,
            autor: livro.autor || "Autor desconhecido",
            imagem: livro.imagem || null,
            googleReaderLink:
              livro.googleReaderLink || null,
            status:
              livro.status in STATUS_CONFIG
                ? (livro.status as StatusLivro)
                : "queroLer",
          }));

        setLivrosEstante(livrosFormatados);

        if (
          livroAbrirAutomatico &&
          livroAutomaticoProcessado.current !==
          livroAbrirAutomatico
        ) {
          const livroAutomatico =
            livrosFormatados.find(
              (livro) =>
                livro.livroId === livroAbrirAutomatico
            );

          if (livroAutomatico) {
            livroAutomaticoProcessado.current =
              livroAbrirAutomatico;

            abrirLivro(livroAutomatico);
          }
        }
      } catch (error) {
        console.error(
          "Erro ao carregar estantes:",
          error
        );

        Alert.alert(
          "Erro",
          "Não foi possível carregar suas estantes."
        );
      } finally {
        if (mostrarLoading) {
          setLoading(false);
        }
      }
    },
    [
      usuario,
      livroAbrirAutomatico,
      abrirLivro,
    ]
  );

  useEffect(() => {
    carregarEstantes();
  }, [carregarEstantes]);

  const atualizar = useCallback(async () => {
    setRefreshing(true);

    try {
      await carregarEstantes(false);
    } finally {
      setRefreshing(false);
    }
  }, [carregarEstantes]);

  const atualizarStatus = useCallback(
    async (
      estanteId: number,
      status: StatusLivro
    ) => {
      try {
        await db
          .update(estantes)
          .set({
            status,
          })
          .where(eq(estantes.id, estanteId));

        setLivrosEstante((atual) =>
          atual.map((livro) =>
            livro.estanteId === estanteId
              ? {
                ...livro,
                status,
              }
              : livro
          )
        );

        setLivroAberto((atual) =>
          atual?.estanteId === estanteId
            ? {
              ...atual,
              status,
            }
            : atual
        );
      } catch (error) {
        console.error(
          "Erro ao atualizar status:",
          error
        );

        throw error;
      }
    },
    []
  );

  const concluirLeitura = useCallback(async () => {
    if (!livroAberto || concluindoLeitura) {
      return;
    }

    setConcluindoLeitura(true);

    try {
      await atualizarStatus(
        livroAberto.estanteId,
        "lido"
      );

      const livroConcluido = livroAberto;

      setLivroAberto(null);
      setAba("lido");

      setTimeout(() => {
        router.push({
          pathname: "/(tabs)/criticas",
          params: {
            livroId: livroConcluido.livroId,
            titulo: livroConcluido.titulo,
          },
        });
      }, 250);
    } catch (error) {
      console.error(
        "Erro ao concluir leitura:",
        error
      );

      Alert.alert(
        "Não foi possível concluir",
        "O estado da leitura não pôde ser atualizado. Tente novamente."
      );
    } finally {
      setConcluindoLeitura(false);
    }
  }, [
    livroAberto,
    concluindoLeitura,
    atualizarStatus,
    router,
  ]);

  const contadores = useMemo(
    () => ({
      queroLer: livrosEstante.filter(
        (livro) => livro.status === "queroLer"
      ).length,

      lendo: livrosEstante.filter(
        (livro) => livro.status === "lendo"
      ).length,

      lido: livrosEstante.filter(
        (livro) => livro.status === "lido"
      ).length,
    }),
    [livrosEstante]
  );

  const livrosFiltrados = useMemo(
    () =>
      livrosEstante.filter(
        (livro) => livro.status === aba
      ),
    [livrosEstante, aba]
  );

  const totalLivros = livrosEstante.length;

  const renderCapa = useCallback(
    (item: LivroEstante) => {
      if (item.imagem) {
        return (
          <Image
            source={{
              uri: item.imagem,
            }}
            style={styles.thumb}
            resizeMode="cover"
          />
        );
      }

      return (
        <View
          style={[
            styles.thumb,
            styles.thumbFallback,
            {
              backgroundColor: colors.soft,
            },
          ]}
        >
          <MaterialCommunityIcons
            name="book-open-page-variant-outline"
            size={38}
            color={colors.primary}
          />
        </View>
      );
    },
    [colors.soft, colors.primary]
  );

  const renderLivro = useCallback(
    ({
      item,
    }: {
      item: LivroEstante;
    }) => {
      const config = STATUS_CONFIG[item.status];

      const statusBackground = isDark
        ? config.softDark
        : config.softLight;

      const statusColor = isDark
        ? config.colorDark
        : config.colorLight;

      const mensagem =
        item.status === "lido"
          ? "Terminei de ler este livro."
          : item.status === "lendo"
            ? "Estou a ler este livro."
            : "Quero ler este livro.";

      return (
        <View
          style={[
            styles.feedPost,
            {
              backgroundColor: colors.card,
              borderColor: colors.border,
            },
          ]}
        >
          <View style={styles.postHeader}>
            <View
              style={[
                styles.postAvatar,
                {
                  backgroundColor: colors.primary,
                },
              ]}
            >
              <MaterialCommunityIcons
                name={
                  item.status === "lido"
                    ? "book-check"
                    : "book-open-page-variant"
                }
                size={21}
                color="#FFFFFF"
              />
            </View>

            <View style={styles.postHeaderInfo}>
              <Text
                style={[
                  styles.postAuthor,
                  {
                    color: colors.text,
                  },
                ]}
              >
                Minha estante
              </Text>

              <View style={styles.postMeta}>
                <Text
                  style={[
                    styles.postMetaText,
                    {
                      color: colors.secondary,
                    },
                  ]}
                >
                  {item.status === "lido"
                    ? "Livro concluído"
                    : "Atualização da estante"}
                </Text>

                <Text
                  style={[
                    styles.postMetaDot,
                    {
                      color: colors.secondary,
                    },
                  ]}
                >
                  •
                </Text>

                <MaterialCommunityIcons
                  name="earth"
                  size={11}
                  color={colors.secondary}
                />

                <Text
                  style={[
                    styles.postMetaText,
                    {
                      color: colors.secondary,
                    },
                  ]}
                >
                  Público
                </Text>
              </View>
            </View>
          </View>

          <Text
            style={[
              styles.postMessage,
              {
                color: colors.text,
              },
            ]}
          >
            {mensagem}
          </Text>

          <TouchableOpacity
            activeOpacity={0.94}
            onPress={() => abrirLivro(item)}
            style={[
              styles.bookPublication,
              {
                backgroundColor: colors.cardSecondary,
                borderColor: colors.border,
              },
            ]}
          >
            <View style={styles.bookCoverContainer}>
              {renderCapa(item)}
            </View>

            <View style={styles.bookPublicationContent}>
              <View style={styles.bookPublicationTop}>
                <View
                  style={[
                    styles.statusBadge,
                    {
                      backgroundColor:
                        statusBackground,
                    },
                  ]}
                >
                  <MaterialCommunityIcons
                    name={config.icon}
                    size={12}
                    color={statusColor}
                  />

                  <Text
                    style={[
                      styles.statusBadgeText,
                      {
                        color: statusColor,
                      },
                    ]}
                  >
                    {config.label}
                  </Text>
                </View>

                {item.googleReaderLink && (
                  <MaterialCommunityIcons
                    name="chevron-right"
                    size={21}
                    color={colors.secondary}
                  />
                )}
              </View>

              <Text
                style={[
                  styles.bookTitle,
                  {
                    color: colors.text,
                  },
                ]}
                numberOfLines={3}
              >
                {item.titulo}
              </Text>

              <Text
                style={[
                  styles.bookAuthor,
                  {
                    color: colors.secondary,
                  },
                ]}
                numberOfLines={1}
              >
                {item.autor}
              </Text>

              {item.googleReaderLink && (
                <View style={styles.bookOpenHint}>
                  <MaterialCommunityIcons
                    name={
                      item.status === "lido"
                        ? "book-check-outline"
                        : "book-open-outline"
                    }
                    size={14}
                    color={colors.primary}
                  />

                  <Text
                    style={[
                      styles.bookOpenHintText,
                      {
                        color: colors.primary,
                      },
                    ]}
                  >
                    {item.status === "lido"
                      ? "Abrir novamente"
                      : "Abrir conteúdo"}
                  </Text>
                </View>
              )}
            </View>
          </TouchableOpacity>

          {item.status === "lido" && (
            <View
              style={[
                styles.readingNotice,
                {
                  backgroundColor:
                    isDark
                      ? config.softDark
                      : config.softLight,
                },
              ]}
            >
              <MaterialCommunityIcons
                name="check-circle-outline"
                size={17}
                color={statusColor}
              />

              <Text
                style={[
                  styles.readingNoticeText,
                  {
                    color: statusColor,
                  },
                ]}
              >
                Este livro já foi concluído
              </Text>
            </View>
          )}

          {item.status === "lendo" && (
            <View
              style={[
                styles.readingNotice,
                {
                  backgroundColor: colors.soft,
                },
              ]}
            >
              <MaterialCommunityIcons
                name="book-open-page-variant"
                size={16}
                color={colors.primary}
              />

              <Text
                style={[
                  styles.readingNoticeText,
                  {
                    color: colors.primary,
                  },
                ]}
              >
                Você está a ler este livro
              </Text>
            </View>
          )}

          <View
            style={[
              styles.postDivider,
              {
                backgroundColor: colors.border,
              },
            ]}
          />

          <View style={styles.statusActionsHeader}>
            <Text
              style={[
                styles.statusActionsTitle,
                {
                  color: colors.secondary,
                },
              ]}
            >
              Estado da leitura
            </Text>
          </View>

          <View style={styles.statusSelector}>
            {(
              [
                "queroLer",
                "lendo",
                "lido",
              ] as StatusLivro[]
            ).map((status) => {
              const statusConfig =
                STATUS_CONFIG[status];

              const ativo =
                item.status === status;

              const activeColor = isDark
                ? statusConfig.colorDark
                : statusConfig.colorLight;

              const activeBackground = isDark
                ? statusConfig.softDark
                : statusConfig.softLight;

              return (
                <TouchableOpacity
                  key={status}
                  activeOpacity={0.8}
                  onPress={async () => {
                    try {
                      await atualizarStatus(
                        item.estanteId,
                        status
                      );
                    } catch {
                      Alert.alert(
                        "Erro",
                        "Não foi possível atualizar o estado do livro."
                      );
                    }
                  }}
                  style={[
                    styles.statusAction,
                    {
                      borderColor: ativo
                        ? activeColor
                        : colors.border,

                      backgroundColor: ativo
                        ? activeBackground
                        : colors.card,
                    },
                  ]}
                >
                  <MaterialCommunityIcons
                    name={statusConfig.icon}
                    size={15}
                    color={
                      ativo
                        ? activeColor
                        : colors.secondary
                    }
                  />

                  <Text
                    style={[
                      styles.statusActionText,
                      {
                        color: ativo
                          ? activeColor
                          : colors.secondary,
                      },
                    ]}
                  >
                    {statusConfig.shortLabel}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>
      );
    },
    [
      colors,
      isDark,
      abrirLivro,
      renderCapa,
      atualizarStatus,
    ]
  );

  const renderEmpty = useCallback(() => {
    const config = STATUS_CONFIG[aba];

    const titulo =
      aba === "lido"
        ? "Ainda não há livros lidos"
        : aba === "lendo"
          ? "Nenhum livro em leitura"
          : "Nenhum livro para ler";

    const descricao =
      aba === "lido"
        ? "Quando você concluir uma leitura, o livro aparecerá aqui."
        : aba === "lendo"
          ? "Os livros que estiver lendo aparecerão nesta seção."
          : "Os livros que adicionar à sua lista aparecerão aqui.";

    return (
      <View style={styles.emptyWrapper}>
        <View
          style={[
            styles.emptyCard,
            {
              backgroundColor: colors.card,
              borderColor: colors.border,
            },
          ]}
        >
          <View
            style={[
              styles.emptyIcon,
              {
                backgroundColor: colors.soft,
              },
            ]}
          >
            <MaterialCommunityIcons
              name={config.icon}
              size={36}
              color={colors.primary}
            />
          </View>

          <Text
            style={[
              styles.emptyTitle,
              {
                color: colors.text,
              },
            ]}
          >
            {titulo}
          </Text>

          <Text
            style={[
              styles.emptyText,
              {
                color: colors.secondary,
              },
            ]}
          >
            {descricao}
          </Text>
        </View>
      </View>
    );
  }, [aba, colors]);

  return (
    <SafeAreaView
      style={[
        styles.container,
        {
          backgroundColor: colors.background,
        },
      ]}
    >
      <StatusBar
        barStyle={
          isDark
            ? "light-content"
            : "dark-content"
        }
        backgroundColor={colors.background}
      />

      <FlatList
        data={livrosFiltrados}
        keyExtractor={(item) =>
          item.estanteId.toString()
        }
        renderItem={renderLivro}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[
          styles.listContent,
          livrosFiltrados.length === 0 && {
            flexGrow: 1,
          },
        ]}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={atualizar}
            tintColor={colors.primary}
            colors={[colors.primary]}
          />
        }
        ListHeaderComponent={
          <>
            <View style={styles.pageHeader}>
              <View style={styles.pageHeaderTop}>
                <View
                  style={[
                    styles.pageAvatar,
                    {
                      backgroundColor:
                        colors.primary,
                    },
                  ]}
                >
                  <MaterialCommunityIcons
                    name="bookshelf"
                    size={24}
                    color="#FFFFFF"
                  />
                </View>

                <View
                  style={styles.pageHeaderText}
                >
                  <Text
                    style={[
                      styles.pageTitle,
                      {
                        color: colors.text,
                      },
                    ]}
                  >
                    Minhas Estantes
                  </Text>

                  <Text
                    style={[
                      styles.pageSubtitle,
                      {
                        color:
                          colors.secondary,
                      },
                    ]}
                  >
                    Sua biblioteca e suas
                    leituras
                  </Text>
                </View>
              </View>

              <View
                style={[
                  styles.libraryInfo,
                  {
                    backgroundColor:
                      colors.card,
                    borderColor:
                      colors.border,
                  },
                ]}
              >
                <View
                  style={[
                    styles.libraryInfoIcon,
                    {
                      backgroundColor:
                        colors.soft,
                    },
                  ]}
                >
                  <MaterialCommunityIcons
                    name="bookshelf"
                    size={18}
                    color={colors.primary}
                  />
                </View>

                <View
                  style={styles.libraryInfoText}
                >
                  <Text
                    style={[
                      styles.libraryInfoTitle,
                      {
                        color: colors.text,
                      },
                    ]}
                  >
                    Sua biblioteca
                  </Text>

                  <Text
                    style={[
                      styles.libraryInfoSubtitle,
                      {
                        color:
                          colors.secondary,
                      },
                    ]}
                  >
                    {totalLivros === 1
                      ? "1 livro na sua estante"
                      : `${totalLivros} livros na sua estante`}
                  </Text>
                </View>

                <View
                  style={[
                    styles.totalBadge,
                    {
                      backgroundColor:
                        colors.soft,
                    },
                  ]}
                >
                  <Text
                    style={[
                      styles.totalBadgeText,
                      {
                        color:
                          colors.primary,
                      },
                    ]}
                  >
                    {totalLivros}
                  </Text>
                </View>
              </View>
            </View>

            <View
              style={[
                styles.tabsContainer,
                {
                  backgroundColor:
                    colors.card,
                  borderColor:
                    colors.border,
                },
              ]}
            >
              {(
                [
                  "queroLer",
                  "lendo",
                  "lido",
                ] as StatusLivro[]
              ).map((status) => {
                const ativo = aba === status;

                const config =
                  STATUS_CONFIG[status];

                const contador =
                  contadores[status];

                const statusColor = isDark
                  ? config.colorDark
                  : config.colorLight;

                return (
                  <TouchableOpacity
                    key={status}
                    activeOpacity={0.85}
                    onPress={() =>
                      setAba(status)
                    }
                    style={[
                      styles.tab,
                      ativo && {
                        backgroundColor:
                          colors.primary,
                      },
                    ]}
                  >
                    <MaterialCommunityIcons
                      name={config.icon}
                      size={16}
                      color={
                        ativo
                          ? "#FFFFFF"
                          : statusColor
                      }
                    />

                    <Text
                      style={[
                        styles.tabText,
                        {
                          color: ativo
                            ? "#FFFFFF"
                            : colors.secondary,
                        },
                      ]}
                    >
                      {config.shortLabel}
                    </Text>

                    <View
                      style={[
                        styles.tabCount,
                        {
                          backgroundColor:
                            ativo
                              ? "rgba(255,255,255,0.18)"
                              : colors.soft,
                        },
                      ]}
                    >
                      <Text
                        style={[
                          styles.tabCountText,
                          {
                            color: ativo
                              ? "#FFFFFF"
                              : colors.primary,
                          },
                        ]}
                      >
                        {contador}
                      </Text>
                    </View>
                  </TouchableOpacity>
                );
              })}
            </View>

            {livrosFiltrados.length > 0 && (
              <View
                style={
                  styles.feedSectionHeader
                }
              >
                <View>
                  <Text
                    style={[
                      styles.feedSectionTitle,
                      {
                        color: colors.text,
                      },
                    ]}
                  >
                    {aba === "lido"
                      ? "Livros lidos"
                      : STATUS_CONFIG[aba].label}
                  </Text>

                  <Text
                    style={[
                      styles.feedSectionSubtitle,
                      {
                        color:
                          colors.secondary,
                      },
                    ]}
                  >
                    {livrosFiltrados.length === 1
                      ? "1 livro na sua estante"
                      : `${livrosFiltrados.length} livros na sua estante`}
                  </Text>
                </View>

                <View
                  style={[
                    styles.feedCount,
                    {
                      backgroundColor:
                        colors.soft,
                    },
                  ]}
                >
                  <Text
                    style={[
                      styles.feedCountText,
                      {
                        color:
                          colors.primary,
                      },
                    ]}
                  >
                    {livrosFiltrados.length}
                  </Text>
                </View>
              </View>
            )}
          </>
        }
        ListEmptyComponent={
          loading ? null : renderEmpty
        }
        initialNumToRender={6}
        maxToRenderPerBatch={6}
        windowSize={7}
        removeClippedSubviews
      />

      {loading && (
        <View
          style={[
            styles.loadingOverlay,
            {
              backgroundColor:
                colors.background,
            },
          ]}
        >
          <View
            style={[
              styles.loadingIcon,
              {
                backgroundColor:
                  colors.soft,
              },
            ]}
          >
            <MaterialCommunityIcons
              name="bookshelf"
              size={31}
              color={colors.primary}
            />
          </View>

          <ActivityIndicator
            size="small"
            color={colors.primary}
            style={{
              marginBottom: 12,
            }}
          />

          <Text
            style={[
              styles.loadingText,
              {
                color:
                  colors.secondary,
              },
            ]}
          >
            Organizando sua
            biblioteca...
          </Text>
        </View>
      )}

      <Modal
        visible={!!livroAberto}
        animationType="slide"
        presentationStyle="fullScreen"
        statusBarTranslucent
        onRequestClose={() =>
          setLivroAberto(null)
        }
      >
        <View
          style={[
            styles.readerContainer,
            {
              backgroundColor:
                colors.background,
            },
          ]}
        >
          <StatusBar hidden animated />

          {mostrarControlesLeitor && (
            <View
              style={[
                styles.readerHeader,
                {
                  backgroundColor:
                    colors.card,
                  borderBottomColor:
                    colors.border,
                },
              ]}
            >
              <TouchableOpacity
                onPress={() =>
                  setLivroAberto(null)
                }
                activeOpacity={0.8}
                style={[
                  styles.readerCloseButton,
                  {
                    backgroundColor:
                      colors.soft,
                  },
                ]}
              >
                <MaterialCommunityIcons
                  name="arrow-left"
                  size={21}
                  color={colors.text}
                />
              </TouchableOpacity>

              <View
                style={
                  styles.readerTitleArea
                }
              >
                <Text
                  style={[
                    styles.readerTitle,
                    {
                      color: colors.text,
                    },
                  ]}
                  numberOfLines={1}
                >
                  {livroAberto?.titulo}
                </Text>

                <Text
                  style={[
                    styles.readerAuthor,
                    {
                      color:
                        colors.secondary,
                    },
                  ]}
                  numberOfLines={1}
                >
                  {livroAberto?.autor}
                </Text>
              </View>

              <TouchableOpacity
                activeOpacity={0.8}
                onPress={() =>
                  setMostrarControlesLeitor(
                    false
                  )
                }
                style={[
                  styles.readerBookIcon,
                  {
                    backgroundColor:
                      colors.soft,
                  },
                ]}
              >
                <MaterialCommunityIcons
                  name="fullscreen"
                  size={20}
                  color={colors.primary}
                />
              </TouchableOpacity>
            </View>
          )}

          <View
            style={styles.webViewWrapper}
          >
            {livroAberto?.googleReaderLink && (
              <WebView
                ref={webViewRef}
                source={{
                  uri: livroAberto.googleReaderLink,
                }}
                style={styles.webView}
                originWhitelist={["*"]}
                javaScriptEnabled
                domStorageEnabled
                sharedCookiesEnabled
                thirdPartyCookiesEnabled
                allowsInlineMediaPlayback
                mediaPlaybackRequiresUserAction={
                  false
                }
                allowsBackForwardNavigationGestures
                setSupportMultipleWindows={false}
                startInLoadingState
                cacheEnabled
                cacheMode="LOAD_DEFAULT"
                textZoom={100}
                onLoadStart={() =>
                  setWebViewLoading(true)
                }
                onLoadEnd={() => {
                  setWebViewLoading(false);

                  webViewRef.current?.injectJavaScript(`
                    (function() {
                      try {
                        var style = document.getElementById(
                          'medeasocial-reader-style'
                        );

                        if (!style) {
                          style = document.createElement('style');
                          style.id =
                            'medeasocial-reader-style';

                          style.innerHTML = \`
                            html {
                              background: #ffffff !important;
                            }

                            body {
                              max-width: 100% !important;
                              margin: 0 auto !important;
                              padding: 18px !important;
                              line-height: 1.65 !important;
                              font-size: 17px !important;
                              overflow-x: hidden !important;
                              -webkit-text-size-adjust: 100% !important;
                            }

                            img {
                              max-width: 100% !important;
                              height: auto !important;
                            }

                            iframe {
                              max-width: 100% !important;
                            }

                            table {
                              max-width: 100% !important;
                              overflow-x: auto !important;
                            }

                            p {
                              margin-top: 0.7em !important;
                              margin-bottom: 0.7em !important;
                            }
                          \`;

                          document.head.appendChild(
                            style
                          );
                        }
                      } catch(e) {}

                      true;
                    })();
                  `);
                }}
                onError={() => {
                  setWebViewLoading(false);

                  Alert.alert(
                    "Erro ao abrir o livro",
                    "A fonte não conseguiu disponibilizar o conteúdo desta leitura. Verifique sua ligação à internet ou tente novamente."
                  );
                }}
                onHttpError={(event) => {
                  const status =
                    event.nativeEvent.statusCode;

                  console.warn(
                    "Erro HTTP no leitor:",
                    status
                  );

                  setWebViewLoading(false);
                }}
                onShouldStartLoadWithRequest={() =>
                  true
                }
              />
            )}

            {webViewLoading && (
              <View
                style={[
                  styles.webViewLoading,
                  {
                    backgroundColor:
                      colors.background,
                  },
                ]}
              >
                <View
                  style={[
                    styles.readerLoadingIcon,
                    {
                      backgroundColor:
                        colors.soft,
                    },
                  ]}
                >
                  <MaterialCommunityIcons
                    name="book-open-variant"
                    size={30}
                    color={colors.primary}
                  />
                </View>

                <ActivityIndicator
                  size="small"
                  color={colors.primary}
                />

                <Text
                  style={[
                    styles.readerLoadingText,
                    {
                      color:
                        colors.secondary,
                    },
                  ]}
                >
                  Preparando sua leitura...
                </Text>
              </View>
            )}

            {!mostrarControlesLeitor && (
              <TouchableOpacity
                activeOpacity={1}
                onPress={() =>
                  setMostrarControlesLeitor(
                    true
                  )
                }
                style={styles.readerTapArea}
              />
            )}
          </View>

          {mostrarControlesLeitor && (
            <View
              style={[
                styles.readerFooter,
                {
                  backgroundColor:
                    colors.card,
                  borderTopColor:
                    colors.border,
                },
              ]}
            >
              <View
                style={
                  styles.readerProgressInfo
                }
              >
                <View
                  style={[
                    styles.readerProgressIcon,
                    {
                      backgroundColor:
                        colors.successSoft,
                    },
                  ]}
                >
                  <MaterialCommunityIcons
                    name="book-check-outline"
                    size={19}
                    color={colors.success}
                  />
                </View>

                <View
                  style={{
                    flex: 1,
                  }}
                >
                  <Text
                    style={[
                      styles.readerProgressTitle,
                      {
                        color: colors.text,
                      },
                    ]}
                  >
                    Está gostando da leitura?
                  </Text>

                  <Text
                    style={[
                      styles.readerProgressSubtitle,
                      {
                        color:
                          colors.secondary,
                      },
                    ]}
                  >
                    Ao terminar, marque o
                    livro como concluído.
                  </Text>
                </View>
              </View>

              <TouchableOpacity
                activeOpacity={0.85}
                onPress={concluirLeitura}
                disabled={concluindoLeitura}
                style={[
                  styles.concluir,
                  {
                    backgroundColor:
                      concluindoLeitura
                        ? colors.primaryDark
                        : colors.primary,

                    opacity:
                      concluindoLeitura
                        ? 0.85
                        : 1,
                  },
                ]}
              >
                {concluindoLeitura ? (
                  <ActivityIndicator
                    size="small"
                    color="#FFFFFF"
                  />
                ) : (
                  <MaterialCommunityIcons
                    name="check"
                    size={17}
                    color="#FFFFFF"
                  />
                )}

                <Text
                  style={styles.concluirText}
                >
                  {concluindoLeitura
                    ? "Concluindo..."
                    : "Concluir leitura"}
                </Text>
              </TouchableOpacity>
            </View>
          )}
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },

  listContent: {
    paddingTop: 0,
    paddingBottom: 30,
  },

  pageHeader: {
    paddingHorizontal: 16,
    paddingTop: 10,
    paddingBottom: 12,
  },

  pageHeaderTop: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 14,
  },

  pageAvatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 11,
  },

  pageHeaderText: {
    flex: 1,
  },

  pageTitle: {
    fontSize: 23,
    lineHeight: 28,
    fontWeight: "900",
    letterSpacing: -0.4,
  },

  pageSubtitle: {
    fontSize: 12,
    marginTop: 2,
  },

  libraryInfo: {
    minHeight: 61,
    borderRadius: 10,
    borderWidth: 1,
    paddingHorizontal: 12,
    flexDirection: "row",
    alignItems: "center",
  },

  libraryInfoIcon: {
    width: 37,
    height: 37,
    borderRadius: 19,
    alignItems: "center",
    justifyContent: "center",
  },

  libraryInfoText: {
    flex: 1,
    marginLeft: 10,
  },

  libraryInfoTitle: {
    fontSize: 13,
    fontWeight: "800",
  },

  libraryInfoSubtitle: {
    fontSize: 10,
    marginTop: 2,
  },

  totalBadge: {
    minWidth: 34,
    height: 34,
    borderRadius: 17,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 8,
  },

  totalBadgeText: {
    fontSize: 13,
    fontWeight: "900",
  },

  tabsContainer: {
    marginHorizontal: 12,
    marginBottom: 10,
    borderRadius: 9,
    borderWidth: 1,
    padding: 4,
    flexDirection: "row",
  },

  tab: {
    flex: 1,
    minHeight: 43,
    borderRadius: 7,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 3,
  },

  tabText: {
    fontSize: 10,
    fontWeight: "800",
    marginLeft: 4,
  },

  tabCount: {
    minWidth: 20,
    height: 19,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
    marginLeft: 4,
    paddingHorizontal: 4,
  },

  tabCountText: {
    fontSize: 9,
    fontWeight: "900",
  },

  feedSectionHeader: {
    minHeight: 52,
    paddingHorizontal: 16,
    paddingTop: 7,
    paddingBottom: 9,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },

  feedSectionTitle: {
    fontSize: 17,
    fontWeight: "900",
  },

  feedSectionSubtitle: {
    fontSize: 10,
    marginTop: 2,
  },

  feedCount: {
    minWidth: 32,
    height: 30,
    borderRadius: 15,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 8,
  },

  feedCountText: {
    fontSize: 11,
    fontWeight: "900",
  },

  feedPost: {
    borderTopWidth: 1,
    borderBottomWidth: 1,
    paddingTop: 13,
    paddingBottom: 12,
    marginBottom: 9,
  },

  postHeader: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 14,
  },

  postAvatar: {
    width: 43,
    height: 43,
    borderRadius: 22,
    alignItems: "center",
    justifyContent: "center",
  },

  postHeaderInfo: {
    flex: 1,
    marginLeft: 10,
  },

  postAuthor: {
    fontSize: 13,
    fontWeight: "900",
  },

  postMeta: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 3,
  },

  postMetaText: {
    fontSize: 9.5,
  },

  postMetaDot: {
    fontSize: 10,
    marginHorizontal: 4,
  },

  postMessage: {
    fontSize: 14,
    lineHeight: 20,
    paddingHorizontal: 14,
    marginTop: 13,
    marginBottom: 11,
  },

  bookPublication: {
    marginHorizontal: 12,
    borderRadius: 10,
    borderWidth: 1,
    minHeight: 142,
    padding: 10,
    flexDirection: "row",
    overflow: "hidden",
  },

  bookCoverContainer: {
    width: 92,
    height: 120,
  },

  thumb: {
    width: 92,
    height: 120,
    borderRadius: 7,
    backgroundColor: "#E4E6EB",
  },

  thumbFallback: {
    alignItems: "center",
    justifyContent: "center",
  },

  bookPublicationContent: {
    flex: 1,
    marginLeft: 11,
    paddingVertical: 1,
    justifyContent: "space-between",
  },

  bookPublicationTop: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },

  statusBadge: {
    alignSelf: "flex-start",
    borderRadius: 6,
    paddingHorizontal: 7,
    paddingVertical: 4,
    flexDirection: "row",
    alignItems: "center",
  },

  statusBadgeText: {
    fontSize: 8.5,
    fontWeight: "900",
    marginLeft: 4,
  },

  bookTitle: {
    fontSize: 16,
    lineHeight: 21,
    fontWeight: "900",
    marginTop: 7,
  },

  bookAuthor: {
    fontSize: 11,
    marginTop: 3,
  },

  bookOpenHint: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 8,
  },

  bookOpenHintText: {
    fontSize: 10,
    fontWeight: "800",
    marginLeft: 5,
  },

  readingNotice: {
    marginHorizontal: 12,
    marginTop: 9,
    minHeight: 36,
    borderRadius: 8,
    paddingHorizontal: 10,
    flexDirection: "row",
    alignItems: "center",
  },

  readingNoticeText: {
    fontSize: 10,
    fontWeight: "800",
    marginLeft: 7,
  },

  postDivider: {
    height: 1,
    marginHorizontal: 14,
    marginTop: 12,
    marginBottom: 9,
  },

  statusActionsHeader: {
    paddingHorizontal: 14,
    marginBottom: 7,
  },

  statusActionsTitle: {
    fontSize: 10,
    fontWeight: "800",
  },

  statusSelector: {
    flexDirection: "row",
    paddingHorizontal: 10,
    gap: 6,
  },

  statusAction: {
    flex: 1,
    minHeight: 38,
    borderRadius: 8,
    borderWidth: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 4,
  },

  statusActionText: {
    fontSize: 9,
    fontWeight: "800",
    marginLeft: 4,
  },

  emptyWrapper: {
    flex: 1,
    justifyContent: "center",
    paddingHorizontal: 16,
    paddingVertical: 35,
  },

  emptyCard: {
    borderRadius: 12,
    borderWidth: 1,
    alignItems: "center",
    paddingHorizontal: 28,
    paddingVertical: 34,
  },

  emptyIcon: {
    width: 68,
    height: 68,
    borderRadius: 34,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 15,
  },

  emptyTitle: {
    fontSize: 18,
    fontWeight: "900",
    marginBottom: 7,
  },

  emptyText: {
    fontSize: 12,
    lineHeight: 19,
    textAlign: "center",
    maxWidth: 290,
  },

  loadingOverlay: {
    ...StyleSheet.absoluteFill,
    alignItems: "center",
    justifyContent: "center",
    zIndex: 20,
  },

  loadingIcon: {
    width: 64,
    height: 64,
    borderRadius: 32,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 14,
  },

  loadingText: {
    fontSize: 12,
    fontWeight: "700",
  },

  readerContainer: {
    flex: 1,
  },

  readerHeader: {
    minHeight: 67,
    borderBottomWidth: 1,
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 12,
  },

  readerCloseButton: {
    width: 42,
    height: 42,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
  },

  readerTitleArea: {
    flex: 1,
    marginHorizontal: 10,
  },

  readerTitle: {
    fontSize: 14,
    fontWeight: "900",
  },

  readerAuthor: {
    fontSize: 10,
    marginTop: 2,
  },

  readerBookIcon: {
    width: 40,
    height: 40,
    borderRadius: 13,
    alignItems: "center",
    justifyContent: "center",
  },

  webViewWrapper: {
    flex: 1,
    position: "relative",
    overflow: "hidden",
  },

  webView: {
    flex: 1,
    backgroundColor: "#FFFFFF",
  },

  webViewLoading: {
    ...StyleSheet.absoluteFill,
    alignItems: "center",
    justifyContent: "center",
    zIndex: 10,
  },

  readerLoadingIcon: {
    width: 64,
    height: 64,
    borderRadius: 21,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 15,
  },

  readerLoadingText: {
    fontSize: 12,
    fontWeight: "700",
    marginTop: 10,
  },

  readerTapArea: {
    ...StyleSheet.absoluteFill,
    zIndex: 5,
  },

  readerFooter: {
    borderTopWidth: 1,
    paddingHorizontal: 12,
    paddingTop: 10,
    paddingBottom: 12,
  },

  readerProgressInfo: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 10,
  },

  readerProgressIcon: {
    width: 38,
    height: 38,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 9,
  },

  readerProgressTitle: {
    fontSize: 12,
    fontWeight: "900",
    marginBottom: 2,
  },

  readerProgressSubtitle: {
    fontSize: 10,
  },

  concluir: {
    minHeight: 49,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
  },

  concluirText: {
    color: "#FFFFFF",
    fontSize: 13,
    fontWeight: "900",
    marginLeft: 7,
  },
});
