import { MaterialCommunityIcons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { desc, eq } from "drizzle-orm";
import * as Notifications from "expo-notifications";
import { useFocusEffect } from "expo-router";
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
  KeyboardAvoidingView,
  Modal,
  Platform,
  RefreshControl,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  useColorScheme,
  View,
} from "react-native";

import { useUsuario } from "@/contexts/UsuarioContext";
import { getDb } from "@/database/db";
import {
  criticas,
  estantes,
  livros,
  usuarios,
} from "@/database/schema";

import {
  criarComentario,
  listarComentarios,
  obterEstatisticasCritica,
  toggleCurtida,
} from "@/database/services/socialService";

type PerfilAtual = {
  nome: string;
  foto_perfil: string | null;
};

type LivroLidoPost = {
  id: number | string;
  usuarioId: number | string;
  usuarioNome: string;
  usuarioFoto: string | null;
  livroId: number | string;
  livroTitulo: string;
  livroAutor: string;
  livroImagem: string | null;
  createdAt: string;
};

type CriticaPost = {
  id: number | string;
  usuarioId: number | string;
  usuarioNome: string;
  usuarioFoto: string | null;
  livroId: number | string;
  livroTitulo: string;
  livroAutor: string;
  livroImagem: string | null;
  texto: string;
  nota: number;
  createdAt: string;
  curtidas: number;
  comentarios: number;
};

type FeedItem =
  | {
    type: "livro";
    data: LivroLidoPost;
  }
  | {
    type: "critica";
    data: CriticaPost;
  };

type EstatisticaLocal = {
  curtidas: number;
  comentarios: number;
  curtiu: boolean;
};

type NotificacaoLocal = {
  id: string;
  tipo: "livro" | "critica";
  titulo: string;
  mensagem: string;
  data: string;
  lida: boolean;
};

type Comentario = {
  id: number | string;
  texto: string;
  createdAt: string;
  usuario?: {
    nome?: string;
    foto_perfil?: string | null;
  };
};

type ComentarioLocal = Comentario & {
  postId: string;
};

type PublicacaoSelecionada = {
  type: "livro" | "critica";
  id: number | string;
  livroTitulo: string;
};

type EstatisticasDashboard = {
  livrosLidos: number;
  publicacoes: number;
  usuarios: number;
  livros: number;
  curtidas: number;
  comentarios: number;
};

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
  }),
});

const LIVROS_SOCIAL_STATS_KEY =
  "feedLivrosLidosEstatisticas";

const LIVROS_SOCIAL_COMENTARIOS_KEY =
  "feedLivrosLidosComentarios";

const NOTIFICACOES_KEY =
  "feedNotificacoes";

const ULTIMOS_ITENS_NOTIFICADOS_KEY =
  "feedUltimosItensNotificados";

const NOTIFICACAO_CHANNEL_ID =
  "booknook-atividade";

export default function Feed() {
  const colorScheme = useColorScheme();
  const isDark = colorScheme === "dark";

  const { usuario } = useUsuario();

  const autoRefreshRef = useRef(false);
  const operacoesCurtidaRef =
    useRef<Record<string, boolean>>({});
  const comentarioEnviandoRef =
    useRef(false);
  const sincronizandoRef =
    useRef(false);

  const [perfilAtual, setPerfilAtual] =
    useState<PerfilAtual | null>(null);

  const [feed, setFeed] =
    useState<FeedItem[]>([]);

  const [refreshing, setRefreshing] =
    useState(false);

  const [carregando, setCarregando] =
    useState(true);

  const [avatarVersion, setAvatarVersion] =
    useState(Date.now());

  const [estatisticas, setEstatisticas] =
    useState<Record<
      string,
      EstatisticaLocal
    >>({});

  const [comentariosAbertos, setComentariosAbertos] =
    useState(false);

  const [publicacaoSelecionada, setPublicacaoSelecionada] =
    useState<PublicacaoSelecionada | null>(
      null,
    );

  const [comentarios, setComentarios] =
    useState<Comentario[]>([]);

  const [carregandoComentarios, setCarregandoComentarios] =
    useState(false);

  const [novoComentario, setNovoComentario] =
    useState("");

  const [enviandoComentario, setEnviandoComentario] =
    useState(false);

  const [curtidasProcessando, setCurtidasProcessando] =
    useState<Record<string, boolean>>({});

  const [pesquisaAberta, setPesquisaAberta] =
    useState(false);

  const [textoPesquisa, setTextoPesquisa] =
    useState("");

  const [notificacoesAbertas, setNotificacoesAbertas] =
    useState(false);

  const [notificacoes, setNotificacoes] =
    useState<NotificacaoLocal[]>([]);

  const [menuAberto, setMenuAberto] =
    useState(false);

  const [dashboardAberto, setDashboardAberto] =
    useState(false);

  const [estatisticasDashboard, setEstatisticasDashboard] =
    useState<EstatisticasDashboard>({
      livrosLidos: 0,
      publicacoes: 0,
      usuarios: 0,
      livros: 0,
      curtidas: 0,
      comentarios: 0,
    });

  const [carregandoDashboard, setCarregandoDashboard] =
    useState(false);

  const colors = useMemo(
    () => ({
      background: isDark
        ? "#111827"
        : "#F0F2F5",

      card: isDark
        ? "#172033"
        : "#FFFFFF",

      cardSecondary: isDark
        ? "#202B3D"
        : "#F7F8FA",

      text: isDark
        ? "#F5F7FA"
        : "#1C1E21",

      secondary: isDark
        ? "#A8B3C2"
        : "#65676B",

      primary: "#1877F2",

      primaryDark: "#0D65D9",

      primaryLight: isDark
        ? "#17345D"
        : "#E7F3FF",

      border: isDark
        ? "#29384D"
        : "#DADDE1",

      softBorder: isDark
        ? "#26364A"
        : "#E4E6EB",

      muted: isDark
        ? "#273449"
        : "#E4E6EB",

      mutedText: isDark
        ? "#8997A9"
        : "#65676B",

      white: "#FFFFFF",

      gold: "#F7B928",

      goldSoft: isDark
        ? "#403719"
        : "#FFF4D6",

      liked: "#E41E3F",

      avatarBackground: isDark
        ? "#243752"
        : "#DCE7F7",

      avatarText: isDark
        ? "#BBD6FF"
        : "#1877F2",

      actionBackground: isDark
        ? "#202B3D"
        : "#F0F2F5",

      actionText: isDark
        ? "#C7D0DC"
        : "#65676B",

      modalOverlay:
        "rgba(0,0,0,0.55)",
    }),
    [isDark],
  );

  const encontrarColuna =
    useCallback(
      (
        tabela: Record<string, any>,
        nomes: string[],
      ) => {
        for (const nome of nomes) {
          if (tabela?.[nome]) {
            return tabela[nome];
          }
        }

        return null;
      },
      [],
    );

  const obterValor =
    useCallback(
      (
        objeto: Record<string, any>,
        nomes: string[],
        valorPadrao: any = null,
      ) => {
        for (const nome of nomes) {
          if (
            objeto &&
            objeto[nome] !== undefined &&
            objeto[nome] !== null
          ) {
            return objeto[nome];
          }
        }

        return valorPadrao;
      },
      [],
    );

  const obterSessao =
    useCallback(async () => {
      try {
        const sessao =
          await AsyncStorage.getItem(
            "usuarioLogado",
          );

        if (!sessao) {
          return null;
        }

        return JSON.parse(sessao);
      } catch (error) {
        console.error(
          "Erro ao ler sessão:",
          error,
        );

        return null;
      }
    }, []);

  const obterUsuarioAtualId =
    useCallback(async () => {
      const sessao =
        await obterSessao();

      const id =
        sessao?.id ??
        usuario?.id;

      if (
        id === undefined ||
        id === null ||
        String(id).trim() === ""
      ) {
        return null;
      }

      return String(id);
    }, [
      obterSessao,
      usuario?.id,
    ]);

  const carregarPerfilAtual =
    useCallback(async () => {
      try {
        const sessao =
          await obterSessao();

        const usuarioId =
          sessao?.id ??
          usuario?.id;

        if (
          usuarioId === undefined ||
          usuarioId === null ||
          String(usuarioId).trim() === ""
        ) {
          setPerfilAtual(null);
          return;
        }

        const idColumn =
          encontrarColuna(
            usuarios as any,
            ["id"],
          );

        if (!idColumn) {
          throw new Error(
            "A coluna usuarios.id não foi encontrada.",
          );
        }

        const database =
          await getDb();

        const resultado =
          await database
            .select()
            .from(usuarios)
            .where(
              eq(
                idColumn,
                String(usuarioId),
              ),
            )
            .limit(1);

        const usuarioBanco =
          resultado[0] as any;

        if (usuarioBanco) {
          const nome =
            String(
              usuarioBanco.nome ??
              sessao?.nome ??
              usuario?.nome ??
              "Leitor",
            );

          const foto =
            usuarioBanco.foto_perfil ??
            null;

          setPerfilAtual({
            nome,
            foto_perfil: foto,
          });

          await AsyncStorage.setItem(
            "usuarioLogado",
            JSON.stringify({
              id:
                usuarioBanco.id ??
                usuarioId,
              nome,
              foto_perfil: foto,
            }),
          );

          setAvatarVersion(
            Date.now(),
          );

          return;
        }

        setPerfilAtual({
          nome:
            sessao?.nome ??
            usuario?.nome ??
            "Leitor",

          foto_perfil:
            sessao?.foto_perfil ??
            usuario?.foto_perfil ??
            null,
        });

        setAvatarVersion(
          Date.now(),
        );
      } catch (error) {
        console.error(
          "Erro ao carregar perfil atual:",
          error,
        );

        const sessao =
          await obterSessao();

        if (sessao || usuario) {
          setPerfilAtual({
            nome:
              sessao?.nome ??
              usuario?.nome ??
              "Leitor",

            foto_perfil:
              sessao?.foto_perfil ??
              usuario?.foto_perfil ??
              null,
          });

          setAvatarVersion(
            Date.now(),
          );
        }
      }
    }, [
      encontrarColuna,
      obterSessao,
      usuario,
    ]);

  const prepararUriFoto =
    useCallback(
      (
        foto:
          | string
          | null
          | undefined,
      ) => {
        if (!foto) {
          return null;
        }

        if (
          foto.startsWith(
            "file://",
          ) ||
          foto.startsWith(
            "content://",
          ) ||
          foto.startsWith("ph://")
        ) {
          return foto;
        }

        if (
          foto.startsWith(
            "http://",
          ) ||
          foto.startsWith(
            "https://",
          )
        ) {
          const separador =
            foto.includes("?")
              ? "&"
              : "?";

          return `${foto}${separador}v=${avatarVersion}`;
        }

        return foto;
      },
      [avatarVersion],
    );

  const renderAvatar =
    useCallback(
      (
        foto:
          | string
          | null
          | undefined,
        nome: string,
        tamanho: number,
      ) => {
        const uri =
          prepararUriFoto(foto);

        if (uri) {
          return (
            <Image
              key={`${uri}-${avatarVersion}`}
              source={{ uri }}
              style={[
                styles.avatarImage,
                {
                  width: tamanho,
                  height: tamanho,
                  borderRadius:
                    tamanho / 2,
                },
              ]}
              resizeMode="cover"
            />
          );
        }

        const inicial =
          nome?.trim()?.charAt(0) ||
          "L";

        return (
          <View
            style={[
              styles.avatarFallback,
              {
                width: tamanho,
                height: tamanho,
                borderRadius:
                  tamanho / 2,
                backgroundColor:
                  colors.avatarBackground,
              },
            ]}
          >
            <Text
              style={[
                styles.avatarLetter,
                {
                  color:
                    colors.avatarText,
                  fontSize:
                    tamanho * 0.38,
                },
              ]}
            >
              {inicial.toUpperCase()}
            </Text>
          </View>
        );
      },
      [
        prepararUriFoto,
        avatarVersion,
        colors,
      ],
    );

  const carregarEstatisticasLivros =
    useCallback(async () => {
      try {
        const raw =
          await AsyncStorage.getItem(
            LIVROS_SOCIAL_STATS_KEY,
          );

        if (!raw) {
          return {};
        }

        const dados =
          JSON.parse(raw);

        if (
          !dados ||
          typeof dados !== "object"
        ) {
          return {};
        }

        return dados as Record<
          string,
          EstatisticaLocal
        >;
      } catch (error) {
        console.error(
          "Erro ao carregar estatísticas dos livros:",
          error,
        );

        return {};
      }
    }, []);

  const salvarEstatisticasLivros =
    useCallback(
      async (
        dados: Record<
          string,
          EstatisticaLocal
        >,
      ) => {
        try {
          await AsyncStorage.setItem(
            LIVROS_SOCIAL_STATS_KEY,
            JSON.stringify(dados),
          );
        } catch (error) {
          console.error(
            "Erro ao salvar estatísticas dos livros:",
            error,
          );
        }
      },
      [],
    );

  const carregarComentariosLivros =
    useCallback(async () => {
      try {
        const raw =
          await AsyncStorage.getItem(
            LIVROS_SOCIAL_COMENTARIOS_KEY,
          );

        if (!raw) {
          return {};
        }

        const dados =
          JSON.parse(raw);

        if (
          !dados ||
          typeof dados !== "object"
        ) {
          return {};
        }

        return dados as Record<
          string,
          ComentarioLocal[]
        >;
      } catch (error) {
        console.error(
          "Erro ao carregar comentários dos livros:",
          error,
        );

        return {};
      }
    }, []);

  const salvarComentariosLivros =
    useCallback(
      async (
        dados: Record<
          string,
          ComentarioLocal[]
        >,
      ) => {
        try {
          await AsyncStorage.setItem(
            LIVROS_SOCIAL_COMENTARIOS_KEY,
            JSON.stringify(dados),
          );
        } catch (error) {
          console.error(
            "Erro ao salvar comentários dos livros:",
            error,
          );
        }
      },
      [],
    );

  const carregarEstatisticas =
    useCallback(
      async (
        itens: FeedItem[],
      ) => {
        const usuarioId =
          await obterUsuarioAtualId();

        const criticasDoFeed =
          itens.filter(
            (
              item,
            ): item is {
              type: "critica";
              data: CriticaPost;
            } =>
              item.type ===
              "critica",
          );

        const livrosDoFeed =
          itens.filter(
            (
              item,
            ): item is {
              type: "livro";
              data: LivroLidoPost;
            } =>
              item.type ===
              "livro",
          );

        const estatisticasLivros =
          await carregarEstatisticasLivros();

        const mapa: Record<
          string,
          EstatisticaLocal
        > = {
          ...estatisticasLivros,
        };

        for (
          const item of livrosDoFeed
        ) {
          const chave =
            `livro-${item.data.id}`;

          if (!mapa[chave]) {
            mapa[chave] = {
              curtidas: 0,
              comentarios: 0,
              curtiu: false,
            };
          }
        }

        if (
          criticasDoFeed.length
        ) {
          const resultados =
            await Promise.all(
              criticasDoFeed.map(
                async ({
                  data,
                }) => {
                  try {
                    const estatistica =
                      await obterEstatisticasCritica(
                        Number(data.id),
                        usuarioId ??
                        undefined,
                      );

                    return [
                      `critica-${data.id}`,
                      estatistica,
                    ] as const;
                  } catch {
                    return [
                      `critica-${data.id}`,
                      {
                        curtidas:
                          Number(
                            data.curtidas ??
                            0,
                          ),
                        comentarios:
                          Number(
                            data.comentarios ??
                            0,
                          ),
                        curtiu: false,
                      },
                    ] as const;
                  }
                },
              ),
            );

          for (
            const [
              chave,
              estatistica,
            ] of resultados
          ) {
            mapa[chave] =
              estatistica;
          }
        }

        setEstatisticas(mapa);
      },
      [
        obterUsuarioAtualId,
        carregarEstatisticasLivros,
      ],
    );

  const configurarCanalNotificacoes =
    useCallback(async () => {
      if (
        Platform.OS !==
        "android"
      ) {
        return;
      }

      try {
        await Notifications.setNotificationChannelAsync(
          NOTIFICACAO_CHANNEL_ID,
          {
            name: "Atividade do BookNook",
            description:
              "Notificações sobre livros lidos e novas publicações.",
            importance:
              Notifications.AndroidImportance.HIGH,
            vibrationPattern: [
              0,
              250,
              150,
              250,
            ],
            sound: "default",
            lockscreenVisibility:
              Notifications.AndroidNotificationVisibility.PUBLIC,
          },
        );
      } catch (error) {
        console.warn(
          "Erro ao configurar canal:",
          error,
        );
      }
    }, []);

  const solicitarPermissaoNotificacoes =
    useCallback(async () => {
      if (
        Platform.OS ===
        "web"
      ) {
        return false;
      }

      try {
        await configurarCanalNotificacoes();

        const {
          status:
          existingStatus,
        } =
          await Notifications.getPermissionsAsync();

        let finalStatus =
          existingStatus;

        if (
          existingStatus !==
          "granted"
        ) {
          const {
            status,
          } =
            await Notifications.requestPermissionsAsync();

          finalStatus = status;
        }

        return (
          finalStatus ===
          "granted"
        );
      } catch (error) {
        console.warn(
          "Não foi possível configurar notificações:",
          error,
        );

        return false;
      }
    }, [
      configurarCanalNotificacoes,
    ]);

  const carregarNotificacoes =
    useCallback(async () => {
      try {
        const armazenadas =
          await AsyncStorage.getItem(
            NOTIFICACOES_KEY,
          );

        if (!armazenadas) {
          setNotificacoes([]);
          return;
        }

        const lista =
          JSON.parse(
            armazenadas,
          );

        if (
          Array.isArray(lista)
        ) {
          setNotificacoes(
            lista,
          );
        }
      } catch (error) {
        console.error(
          "Erro ao carregar notificações:",
          error,
        );
      }
    }, []);

  const salvarNotificacoes =
    useCallback(
      async (
        lista: NotificacaoLocal[],
      ) => {
        try {
          const limitada =
            lista.slice(0, 50);

          await AsyncStorage.setItem(
            NOTIFICACOES_KEY,
            JSON.stringify(
              limitada,
            ),
          );

          setNotificacoes(
            limitada,
          );
        } catch (error) {
          console.error(
            "Erro ao salvar notificações:",
            error,
          );
        }
      },
      [],
    );

  const atualizarBadge =
    useCallback(
      async (
        quantidade: number,
      ) => {
        if (
          Platform.OS ===
          "web"
        ) {
          return;
        }

        try {
          await Notifications.setBadgeCountAsync(
            Math.max(
              0,
              quantidade,
            ),
          );
        } catch { }
      },
      [],
    );

  const verificarNovasPublicacoes =
    useCallback(
      async (
        itens: FeedItem[],
      ) => {
        try {
          const usuarioId =
            await obterUsuarioAtualId();

          if (!usuarioId) {
            return;
          }

          const anteriorRaw =
            await AsyncStorage.getItem(
              ULTIMOS_ITENS_NOTIFICADOS_KEY,
            );

          const anteriores: string[] =
            anteriorRaw
              ? JSON.parse(
                anteriorRaw,
              )
              : [];

          const idsAtuais =
            itens.map(
              (item) =>
                `${item.type}-${item.data.id}`,
            );

          if (
            anteriores.length ===
            0
          ) {
            await AsyncStorage.setItem(
              ULTIMOS_ITENS_NOTIFICADOS_KEY,
              JSON.stringify(
                idsAtuais,
              ),
            );

            return;
          }

          const novos =
            itens.filter(
              (item) =>
                !anteriores.includes(
                  `${item.type}-${item.data.id}`,
                ) &&
                String(
                  item.data.usuarioId,
                ) !==
                String(
                  usuarioId,
                ),
            );

          await AsyncStorage.setItem(
            ULTIMOS_ITENS_NOTIFICADOS_KEY,
            JSON.stringify(
              idsAtuais,
            ),
          );

          if (!novos.length) {
            return;
          }

          const permitido =
            await solicitarPermissaoNotificacoes();

          const novasNotificacoes =
            novos.map(
              (item) => {
                if (
                  item.type ===
                  "livro"
                ) {
                  return {
                    id: `livro-${item.data.id}-${Date.now()}`,
                    tipo: "livro" as const,
                    titulo:
                      "Novo livro lido",
                    mensagem:
                      `${item.data.usuarioNome} terminou de ler "${item.data.livroTitulo}".`,
                    data:
                      item.data
                        .createdAt ||
                      new Date().toISOString(),
                    lida: false,
                  };
                }

                return {
                  id: `critica-${item.data.id}-${Date.now()}`,
                  tipo: "critica" as const,
                  titulo:
                    "Nova publicação",
                  mensagem:
                    `${item.data.usuarioNome} publicou uma crítica sobre "${item.data.livroTitulo}".`,
                  data:
                    item.data
                      .createdAt ||
                    new Date().toISOString(),
                  lida: false,
                };
              },
            );

          const atuais =
            await AsyncStorage.getItem(
              NOTIFICACOES_KEY,
            );

          const listaAnterior: NotificacaoLocal[] =
            atuais
              ? JSON.parse(
                atuais,
              )
              : [];

          const listaFinal = [
            ...novasNotificacoes,
            ...listaAnterior,
          ].slice(0, 50);

          await salvarNotificacoes(
            listaFinal,
          );

          const quantidade =
            listaFinal.filter(
              (item) =>
                !item.lida,
            ).length;

          await atualizarBadge(
            quantidade,
          );

          if (permitido) {
            for (
              const notificacao of
              novasNotificacoes
            ) {
              await Notifications.scheduleNotificationAsync(
                {
                  content: {
                    title:
                      `BookNook · ${notificacao.titulo}`,
                    body:
                      notificacao.mensagem,
                    sound:
                      "default",
                    ...(Platform.OS ===
                      "android"
                      ? {
                        channelId:
                          NOTIFICACAO_CHANNEL_ID,
                      }
                      : {}),
                  },
                  trigger: null,
                },
              );
            }
          }
        } catch (error) {
          console.warn(
            "Erro ao verificar novas publicações:",
            error,
          );
        }
      },
      [
        obterUsuarioAtualId,
        solicitarPermissaoNotificacoes,
        salvarNotificacoes,
        atualizarBadge,
      ],
    );

  const carregarFeed =
    useCallback(async () => {
      try {
        const database =
          await getDb();

        const livrosResultado =
          await database
            .select()
            .from(estantes)
            .innerJoin(
              livros,
              eq(
                estantes.livro_id,
                livros.id,
              ),
            )
            .innerJoin(
              usuarios,
              eq(
                estantes.usuario_id,
                usuarios.id,
              ),
            )
            .where(
              eq(
                estantes.status,
                "lido",
              ),
            )
            .orderBy(
              desc(estantes.id),
            );

        const livrosPosts:
          LivroLidoPost[] =
          livrosResultado.map(
            (item: any) => {
              const estante =
                item.estantes;

              const livro =
                item.livros;

              const usuarioBanco =
                item.usuarios;

              return {
                id: estante.id,

                usuarioId:
                  usuarioBanco.id,

                usuarioNome:
                  String(
                    usuarioBanco.nome ??
                    "Leitor",
                  ),

                usuarioFoto:
                  usuarioBanco.foto_perfil ??
                  null,

                livroId:
                  livro.id,

                livroTitulo:
                  String(
                    livro.titulo ??
                    "Livro sem título",
                  ),

                livroAutor:
                  String(
                    livro.autor ??
                    "Autor desconhecido",
                  ),

                livroImagem:
                  livro.imagem ??
                  null,

                createdAt:
                  String(
                    obterValor(
                      estante,
                      [
                        "created_at",
                        "createdAt",
                        "criado_em",
                        "criadoEm",
                      ],
                      "",
                    ),
                  ),
              };
            },
          );

        let criticasPosts:
          CriticaPost[] = [];

        try {
          const criticasResultado =
            await database
              .select()
              .from(criticas)
              .innerJoin(
                livros,
                eq(
                  criticas.livro_id,
                  livros.id,
                ),
              )
              .innerJoin(
                usuarios,
                eq(
                  criticas.usuario_id,
                  usuarios.id,
                ),
              )
              .orderBy(
                desc(criticas.id),
              );

          criticasPosts =
            criticasResultado.map(
              (item: any) => {
                const critica =
                  item.criticas;

                const livro =
                  item.livros;

                const usuarioBanco =
                  item.usuarios;

                return {
                  id: critica.id,

                  usuarioId:
                    usuarioBanco.id,

                  usuarioNome:
                    String(
                      usuarioBanco.nome ??
                      "Leitor",
                    ),

                  usuarioFoto:
                    usuarioBanco.foto_perfil ??
                    null,

                  livroId:
                    livro.id,

                  livroTitulo:
                    String(
                      livro.titulo ??
                      "Livro sem título",
                    ),

                  livroAutor:
                    String(
                      livro.autor ??
                      "Autor desconhecido",
                    ),

                  livroImagem:
                    livro.imagem ??
                    null,

                  texto:
                    String(
                      critica.texto ??
                      "",
                    ),

                  nota:
                    Number(
                      critica.nota ??
                      0,
                    ),

                  createdAt:
                    String(
                      obterValor(
                        critica,
                        [
                          "created_at",
                          "createdAt",
                          "criado_em",
                          "criadoEm",
                        ],
                        "",
                      ),
                    ),

                  curtidas: 0,
                  comentarios: 0,
                };
              },
            );
        } catch (error) {
          console.warn(
            "Não foi possível carregar críticas:",
            error,
          );

          criticasPosts = [];
        }

        const itens: FeedItem[] = [
          ...livrosPosts.map(
            (item) => ({
              type:
                "livro" as const,
              data: item,
            }),
          ),

          ...criticasPosts.map(
            (item) => ({
              type:
                "critica" as const,
              data: item,
            }),
          ),
        ];

        itens.sort(
          (a, b) => {
            const dataA =
              new Date(
                a.data.createdAt,
              ).getTime() || 0;

            const dataB =
              new Date(
                b.data.createdAt,
              ).getTime() || 0;

            return (
              dataB - dataA
            );
          },
        );

        setFeed(itens);

        await carregarEstatisticas(
          itens,
        );

        await verificarNovasPublicacoes(
          itens,
        );
      } catch (error) {
        console.error(
          "Erro ao carregar Feed:",
          error,
        );

        setFeed([]);
        setEstatisticas({});
      }
    }, [
      obterValor,
      carregarEstatisticas,
      verificarNovasPublicacoes,
    ]);

  const carregarDashboard =
    useCallback(async () => {
      if (carregandoDashboard) {
        return;
      }

      try {
        setCarregandoDashboard(
          true,
        );

        const database =
          await getDb();

        const [
          livrosLidosResultado,
          publicacoesResultado,
          usuariosResultado,
          livrosResultado,
        ] = await Promise.all([
          database
            .select()
            .from(estantes)
            .where(
              eq(
                estantes.status,
                "lido",
              ),
            ),

          database
            .select()
            .from(criticas),

          database
            .select()
            .from(usuarios),

          database
            .select()
            .from(livros),
        ]);

        const statsLivros =
          await carregarEstatisticasLivros();

        let curtidas = 0;
        let comentarios =
          0;

        Object.values(
          statsLivros,
        ).forEach(
          (estatistica) => {
            curtidas += Number(
              estatistica.curtidas ??
              0,
            );

            comentarios += Number(
              estatistica.comentarios ??
              0,
            );
          },
        );

        for (
          const item of feed
        ) {
          if (
            item.type ===
            "critica"
          ) {
            const chave =
              `critica-${item.data.id}`;

            const estatistica =
              estatisticas[chave];

            if (estatistica) {
              curtidas += Number(
                estatistica.curtidas ??
                0,
              );

              comentarios += Number(
                estatistica.comentarios ??
                0,
              );
            }
          }
        }

        setEstatisticasDashboard({
          livrosLidos:
            livrosLidosResultado.length,

          publicacoes:
            publicacoesResultado.length,

          usuarios:
            usuariosResultado.length,

          livros:
            livrosResultado.length,

          curtidas,

          comentarios,
        });
      } catch (error) {
        console.error(
          "Erro ao carregar dashboard:",
          error,
        );
      } finally {
        setCarregandoDashboard(
          false,
        );
      }
    }, [
      carregandoDashboard,
      carregarEstatisticasLivros,
      feed,
      estatisticas,
    ]);

  const sincronizarTudo =
    useCallback(
      async (
        mostrarLoading = false,
      ) => {
        if (
          sincronizandoRef.current
        ) {
          return;
        }

        sincronizandoRef.current =
          true;

        try {
          if (
            mostrarLoading
          ) {
            setCarregando(
              true,
            );
          }

          await carregarPerfilAtual();
          await carregarNotificacoes();
          await carregarFeed();
        } catch (error) {
          console.error(
            "Erro ao sincronizar Feed:",
            error,
          );
        } finally {
          setCarregando(
            false,
          );

          setRefreshing(
            false,
          );

          sincronizandoRef.current =
            false;
        }
      },
      [
        carregarPerfilAtual,
        carregarNotificacoes,
        carregarFeed,
      ],
    );

  useEffect(() => {
    sincronizarTudo(
      true,
    );
  }, [
    sincronizarTudo,
  ]);

  useFocusEffect(
    useCallback(() => {
      if (
        !autoRefreshRef.current
      ) {
        autoRefreshRef.current =
          true;

        return;
      }

      sincronizarTudo(
        false,
      );
    }, [
      sincronizarTudo,
    ]),
  );

  useEffect(() => {
    solicitarPermissaoNotificacoes();
  }, [
    solicitarPermissaoNotificacoes,
  ]);

  /*
   * Mantém o Feed sincronizado enquanto
   * o usuário está na tela.
   *
   * Assim, se outro usuário marcar um livro
   * como lido ou publicar uma crítica,
   * o BookNook poderá detectar a nova atividade
   * e gerar a notificação local.
   */
  useEffect(() => {
    const intervalo =
      setInterval(() => {
        sincronizarTudo(
          false,
        );
      }, 15000);

    return () =>
      clearInterval(
        intervalo,
      );
  }, [
    sincronizarTudo,
  ]);

  const onRefresh =
    useCallback(async () => {
      setRefreshing(
        true,
      );

      await carregarPerfilAtual();
      await carregarFeed();
      await carregarNotificacoes();

      setRefreshing(
        false,
      );
    }, [
      carregarPerfilAtual,
      carregarFeed,
      carregarNotificacoes,
    ]);

  const nomeAtual =
    perfilAtual?.nome ||
    usuario?.nome ||
    "Leitor";

  const fotoAtual =
    perfilAtual?.foto_perfil ??
    usuario?.foto_perfil ??
    null;

  const alternarCurtida =
    useCallback(
      async (
        id:
          | number
          | string,
        tipo:
          | "livro"
          | "critica",
      ) => {
        const chave =
          `${tipo}-${id}`;

        if (
          operacoesCurtidaRef
            .current[chave]
        ) {
          return;
        }

        const usuarioId =
          await obterUsuarioAtualId();

        if (!usuarioId) {
          Alert.alert(
            "Sessão necessária",
            "Inicie sessão para poder curtir esta publicação.",
          );

          return;
        }

        operacoesCurtidaRef.current[
          chave
        ] = true;

        setCurtidasProcessando(
          (atual) => ({
            ...atual,
            [chave]: true,
          }),
        );

        const estadoAnterior =
          estatisticas[chave] ?? {
            curtidas: 0,
            comentarios: 0,
            curtiu: false,
          };

        const novoEstadoOtimista =
        {
          ...estadoAnterior,

          curtiu:
            !estadoAnterior.curtiu,

          curtidas:
            Math.max(
              0,
              estadoAnterior.curtidas +
              (estadoAnterior.curtiu
                ? -1
                : 1),
            ),
        };

        setEstatisticas(
          (atual) => ({
            ...atual,
            [chave]:
              novoEstadoOtimista,
          }),
        );

        try {
          if (
            tipo ===
            "critica"
          ) {
            const novoEstado =
              await toggleCurtida(
                usuarioId,
                Number(id),
              );

            const estatisticaAtual =
              await obterEstatisticasCritica(
                Number(id),
                usuarioId,
              );

            setEstatisticas(
              (atual) => ({
                ...atual,
                [chave]: {
                  ...estatisticaAtual,
                  curtiu:
                    novoEstado,
                },
              }),
            );
          } else {
            const todas =
              await carregarEstatisticasLivros();

            todas[chave] =
              novoEstadoOtimista;

            await salvarEstatisticasLivros(
              todas,
            );

            setEstatisticas(
              (atual) => ({
                ...atual,
                [chave]:
                  novoEstadoOtimista,
              }),
            );
          }
        } catch (error) {
          console.error(
            "Erro ao alternar curtida:",
            error,
          );

          setEstatisticas(
            (atual) => ({
              ...atual,
              [chave]:
                estadoAnterior,
            }),
          );

          Alert.alert(
            "Não foi possível curtir",
            "Ocorreu um erro ao atualizar a curtida. Tente novamente.",
          );
        } finally {
          delete operacoesCurtidaRef
            .current[chave];

          setCurtidasProcessando(
            (atual) => ({
              ...atual,
              [chave]: false,
            }),
          );
        }
      },
      [
        obterUsuarioAtualId,
        estatisticas,
        carregarEstatisticasLivros,
        salvarEstatisticasLivros,
      ],
    );

  const abrirComentarios =
    useCallback(
      async (
        publicacao: PublicacaoSelecionada,
      ) => {
        setPublicacaoSelecionada(
          publicacao,
        );

        setNovoComentario("");
        setComentarios([]);

        setComentariosAbertos(
          true,
        );

        setCarregandoComentarios(
          true,
        );

        try {
          if (
            publicacao.type ===
            "critica"
          ) {
            const resultado =
              await listarComentarios(
                Number(
                  publicacao.id,
                ),
              );

            setComentarios(
              resultado,
            );
          } else {
            const todos =
              await carregarComentariosLivros();

            const chave =
              `livro-${publicacao.id}`;

            setComentarios(
              todos[chave] ?? [],
            );
          }
        } catch (error) {
          console.error(
            "Erro ao carregar comentários:",
            error,
          );

          Alert.alert(
            "Erro",
            "Não foi possível carregar os comentários.",
          );
        } finally {
          setCarregandoComentarios(
            false,
          );
        }
      },
      [
        carregarComentariosLivros,
      ],
    );

  const fecharComentarios =
    useCallback(() => {
      setComentariosAbertos(
        false,
      );

      setPublicacaoSelecionada(
        null,
      );

      setComentarios([]);

      setNovoComentario("");
    }, []);

  const enviarComentario =
    useCallback(async () => {
      if (
        comentarioEnviandoRef
          .current
      ) {
        return;
      }

      const texto =
        novoComentario.trim();

      if (!texto) {
        return;
      }

      if (
        !publicacaoSelecionada
      ) {
        return;
      }

      const usuarioId =
        await obterUsuarioAtualId();

      if (!usuarioId) {
        Alert.alert(
          "Sessão necessária",
          "Inicie sessão para poder comentar.",
        );

        return;
      }

      comentarioEnviandoRef.current =
        true;

      setEnviandoComentario(
        true,
      );

      try {
        if (
          publicacaoSelecionada.type ===
          "critica"
        ) {
          const comentario =
            await criarComentario(
              usuarioId,
              Number(
                publicacaoSelecionada.id,
              ),
              texto,
            );

          setComentarios(
            (atual) => [
              comentario,
              ...atual,
            ],
          );
        } else {
          const chave =
            `livro-${publicacaoSelecionada.id}`;

          const comentarioLocal:
            ComentarioLocal = {
            id:
              `${chave}-${Date.now()}`,

            postId: chave,

            texto,

            createdAt:
              new Date().toISOString(),

            usuario: {
              nome:
                nomeAtual,

              foto_perfil:
                fotoAtual,
            },
          };

          const todos =
            await carregarComentariosLivros();

          const comentariosAtuais =
            todos[chave] ?? [];

          todos[chave] = [
            comentarioLocal,
            ...comentariosAtuais,
          ];

          await salvarComentariosLivros(
            todos,
          );

          setComentarios(
            (atual) => [
              comentarioLocal,
              ...atual,
            ],
          );
        }

        const chaveEstatistica =
          `${publicacaoSelecionada.type}-${publicacaoSelecionada.id}`;

        setEstatisticas(
          (atual) => {
            const anterior =
              atual[
              chaveEstatistica
              ] ?? {
                curtidas: 0,
                comentarios: 0,
                curtiu: false,
              };

            return {
              ...atual,

              [chaveEstatistica]: {
                ...anterior,

                comentarios:
                  anterior.comentarios +
                  1,
              },
            };
          },
        );

        if (
          publicacaoSelecionada.type ===
          "livro"
        ) {
          const todos =
            await carregarEstatisticasLivros();

          const chave =
            `livro-${publicacaoSelecionada.id}`;

          const anterior =
            todos[chave] ?? {
              curtidas: 0,
              comentarios: 0,
              curtiu: false,
            };

          todos[chave] = {
            ...anterior,

            comentarios:
              anterior.comentarios +
              1,
          };

          await salvarEstatisticasLivros(
            todos,
          );
        }

        setNovoComentario("");
      } catch (error) {
        console.error(
          "Erro ao criar comentário:",
          error,
        );

        Alert.alert(
          "Não foi possível comentar",
          error instanceof Error
            ? error.message
            : "Ocorreu um erro ao publicar o comentário.",
        );
      } finally {
        comentarioEnviandoRef.current =
          false;

        setEnviandoComentario(
          false,
        );
      }
    }, [
      novoComentario,
      publicacaoSelecionada,
      obterUsuarioAtualId,
      nomeAtual,
      fotoAtual,
      carregarComentariosLivros,
      salvarComentariosLivros,
      carregarEstatisticasLivros,
      salvarEstatisticasLivros,
    ]);

  const formatarData =
    useCallback(
      (data: string) => {
        if (!data) {
          return "";
        }

        const dataObj =
          new Date(data);

        if (
          Number.isNaN(
            dataObj.getTime(),
          )
        ) {
          return "";
        }

        return dataObj.toLocaleDateString(
          "pt-PT",
          {
            day: "2-digit",
            month: "short",
            year: "numeric",
          },
        );
      },
      [],
    );

  const feedFiltrado =
    useMemo(() => {
      const termo =
        textoPesquisa
          .trim()
          .toLocaleLowerCase(
            "pt-PT",
          );

      if (!termo) {
        return feed;
      }

      return feed.filter(
        (item) => {
          const dados =
            item.data;

          const campos: string[] =
            [
              dados.livroTitulo,
              dados.livroAutor,
              dados.usuarioNome,
            ];

          if (
            item.type ===
            "critica"
          ) {
            campos.push(
              dados.texto,
            );
          }

          return campos.some(
            (campo) =>
              String(
                campo ?? "",
              )
                .toLocaleLowerCase(
                  "pt-PT",
                )
                .includes(
                  termo,
                ),
          );
        },
      );
    }, [
      feed,
      textoPesquisa,
    ]);

  const quantidadeNaoLidas =
    notificacoes.filter(
      (item) =>
        !item.lida,
    ).length;

  const abrirPesquisa =
    useCallback(() => {
      setPesquisaAberta(
        (atual) => {
          if (atual) {
            setTextoPesquisa("");
          }

          return !atual;
        },
      );
    }, []);

  const abrirNotificacoes =
    useCallback(async () => {
      await carregarNotificacoes();

      setNotificacoesAbertas(
        true,
      );
    }, [
      carregarNotificacoes,
    ]);

  const abrirMenu =
    useCallback(() => {
      setMenuAberto(true);
    }, []);

  const abrirDashboard =
    useCallback(async () => {
      setMenuAberto(false);
      setDashboardAberto(true);

      await carregarDashboard();
    }, [
      carregarDashboard,
    ]);

  const marcarTodasNotificacoesComoLidas =
    useCallback(async () => {
      const atualizadas =
        notificacoes.map(
          (item) => ({
            ...item,
            lida: true,
          }),
        );

      await salvarNotificacoes(
        atualizadas,
      );

      await atualizarBadge(0);
    }, [
      notificacoes,
      salvarNotificacoes,
      atualizarBadge,
    ]);

  const renderLivro =
    useCallback(
      ({
        item,
      }: {
        item: LivroLidoPost;
      }) => {
        const chave =
          `livro-${item.id}`;

        const estatistica =
          estatisticas[chave] ?? {
            curtidas: 0,
            comentarios: 0,
            curtiu: false,
          };

        const foiCurtida =
          estatistica.curtiu;

        const quantidadeCurtidas =
          estatistica.curtidas;

        const quantidadeComentarios =
          estatistica.comentarios;

        const processando =
          !!curtidasProcessando[
          chave
          ];

        return (
          <View
            style={[
              styles.facebookPost,
              {
                backgroundColor:
                  colors.card,
              },
            ]}
          >
            <View
              style={
                styles.postHeader
              }
            >
              {renderAvatar(
                item.usuarioFoto,
                item.usuarioNome,
                42,
              )}

              <View
                style={
                  styles.postUserInfo
                }
              >
                <Text
                  style={[
                    styles.userName,
                    {
                      color:
                        colors.text,
                    },
                  ]}
                  numberOfLines={1}
                >
                  {item.usuarioNome}
                </Text>

                <View
                  style={
                    styles.metaRow
                  }
                >
                  <Text
                    style={[
                      styles.postMeta,
                      {
                        color:
                          colors.secondary,
                      },
                    ]}
                  >
                    terminou de ler um livro
                  </Text>

                  <Text
                    style={[
                      styles.metaDot,
                      {
                        color:
                          colors.secondary,
                      },
                    ]}
                  >
                    •
                  </Text>

                  <MaterialCommunityIcons
                    name="earth"
                    size={12}
                    color={
                      colors.secondary
                    }
                  />
                </View>

                {!!item.createdAt && (
                  <Text
                    style={[
                      styles.dateText,
                      {
                        color:
                          colors.secondary,
                      },
                    ]}
                  >
                    {formatarData(
                      item.createdAt,
                    )}
                  </Text>
                )}
              </View>

              <TouchableOpacity
                style={
                  styles.moreButton
                }
                activeOpacity={0.7}
              >
                <MaterialCommunityIcons
                  name="dots-horizontal"
                  size={22}
                  color={
                    colors.secondary
                  }
                />
              </TouchableOpacity>
            </View>

            <Text
              style={[
                styles.postDescription,
                {
                  color:
                    colors.text,
                },
              ]}
            >
              {item.usuarioNome} terminou de ler{" "}
              <Text
                style={
                  styles.inlineStrong
                }
              >
                {item.livroTitulo}
              </Text>
              .
            </Text>

            <View
              style={[
                styles.bookPost,
                {
                  backgroundColor:
                    colors.cardSecondary,
                  borderColor:
                    colors.border,
                },
              ]}
            >
              {item.livroImagem ? (
                <Image
                  source={{
                    uri: item.livroImagem,
                  }}
                  style={
                    styles.bookPostCover
                  }
                  resizeMode="cover"
                />
              ) : (
                <View
                  style={[
                    styles.bookPostCoverFallback,
                    {
                      backgroundColor:
                        colors.primaryLight,
                    },
                  ]}
                >
                  <MaterialCommunityIcons
                    name="book-open-page-variant"
                    size={31}
                    color={
                      colors.primary
                    }
                  />
                </View>
              )}

              <View
                style={
                  styles.bookPostInfo
                }
              >
                <Text
                  style={[
                    styles.bookPostTitle,
                    {
                      color:
                        colors.text,
                    },
                  ]}
                  numberOfLines={2}
                >
                  {item.livroTitulo}
                </Text>

                <Text
                  style={[
                    styles.bookPostAuthor,
                    {
                      color:
                        colors.secondary,
                    },
                  ]}
                  numberOfLines={1}
                >
                  {item.livroAutor}
                </Text>

                <View
                  style={
                    styles.readIndicator
                  }
                >
                  <MaterialCommunityIcons
                    name="check-circle"
                    size={15}
                    color={
                      colors.primary
                    }
                  />

                  <Text
                    style={[
                      styles.readIndicatorText,
                      {
                        color:
                          colors.primary,
                      },
                    ]}
                  >
                    Livro lido
                  </Text>
                </View>
              </View>
            </View>

            <View
              style={[
                styles.socialSummary,
                {
                  borderBottomColor:
                    colors.border,
                },
              ]}
            >
              <View
                style={
                  styles.summaryLeft
                }
              >
                {quantidadeCurtidas >
                  0 && (
                    <>
                      <View
                        style={[
                          styles.likeCircle,
                          {
                            backgroundColor:
                              colors.liked,
                          },
                        ]}
                      >
                        <MaterialCommunityIcons
                          name="heart"
                          size={9}
                          color={
                            colors.white
                          }
                        />
                      </View>

                      <Text
                        style={[
                          styles.summaryNumber,
                          {
                            color:
                              colors.secondary,
                          },
                        ]}
                      >
                        {
                          quantidadeCurtidas
                        }
                      </Text>
                    </>
                  )}
              </View>

              <TouchableOpacity
                activeOpacity={0.7}
                onPress={() =>
                  abrirComentarios({
                    type: "livro",
                    id: item.id,
                    livroTitulo:
                      item.livroTitulo,
                  })
                }
              >
                <Text
                  style={[
                    styles.summaryText,
                    {
                      color:
                        colors.secondary,
                    },
                  ]}
                >
                  {
                    quantidadeComentarios
                  }{" "}
                  {quantidadeComentarios ===
                    1
                    ? "comentário"
                    : "comentários"}
                </Text>
              </TouchableOpacity>
            </View>

            <View
              style={
                styles.socialActions
              }
            >
              <TouchableOpacity
                style={
                  styles.socialAction
                }
                activeOpacity={0.7}
                disabled={
                  processando
                }
                onPress={() =>
                  alternarCurtida(
                    item.id,
                    "livro",
                  )
                }
              >
                {processando ? (
                  <ActivityIndicator
                    size="small"
                    color={
                      foiCurtida
                        ? colors.primary
                        : colors.actionText
                    }
                  />
                ) : (
                  <MaterialCommunityIcons
                    name={
                      foiCurtida
                        ? "thumb-up"
                        : "thumb-up-outline"
                    }
                    size={20}
                    color={
                      foiCurtida
                        ? colors.primary
                        : colors.actionText
                    }
                  />
                )}

                <Text
                  style={[
                    styles.socialActionText,
                    {
                      color:
                        foiCurtida
                          ? colors.primary
                          : colors.actionText,
                    },
                  ]}
                >
                  Gosto
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={
                  styles.socialAction
                }
                activeOpacity={0.7}
                onPress={() =>
                  abrirComentarios({
                    type: "livro",
                    id: item.id,
                    livroTitulo:
                      item.livroTitulo,
                  })
                }
              >
                <MaterialCommunityIcons
                  name="comment-outline"
                  size={20}
                  color={
                    colors.actionText
                  }
                />

                <Text
                  style={[
                    styles.socialActionText,
                    {
                      color:
                        colors.actionText,
                    },
                  ]}
                >
                  Comentar
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        );
      },
      [
        colors,
        renderAvatar,
        formatarData,
        estatisticas,
        curtidasProcessando,
        alternarCurtida,
        abrirComentarios,
      ],
    );

  const renderCritica =
    useCallback(
      ({
        item,
      }: {
        item: CriticaPost;
      }) => {
        const nota =
          Math.max(
            0,
            Math.min(
              5,
              Number(item.nota) ||
              0,
            ),
          );

        const chave =
          `critica-${item.id}`;

        const estatistica =
          estatisticas[chave] ?? {
            curtidas: 0,
            comentarios: 0,
            curtiu: false,
          };

        const foiCurtida =
          estatistica.curtiu;

        const quantidadeCurtidas =
          estatistica.curtidas;

        const quantidadeComentarios =
          estatistica.comentarios;

        const processando =
          !!curtidasProcessando[
          chave
          ];

        return (
          <View
            style={[
              styles.facebookPost,
              {
                backgroundColor:
                  colors.card,
              },
            ]}
          >
            <View
              style={
                styles.postHeader
              }
            >
              {renderAvatar(
                item.usuarioFoto,
                item.usuarioNome,
                42,
              )}

              <View
                style={
                  styles.postUserInfo
                }
              >
                <Text
                  style={[
                    styles.userName,
                    {
                      color:
                        colors.text,
                    },
                  ]}
                  numberOfLines={1}
                >
                  {item.usuarioNome}
                </Text>

                <View
                  style={
                    styles.metaRow
                  }
                >
                  <Text
                    style={[
                      styles.postMeta,
                      {
                        color:
                          colors.secondary,
                      },
                    ]}
                  >
                    publicou uma crítica
                  </Text>

                  <Text
                    style={[
                      styles.metaDot,
                      {
                        color:
                          colors.secondary,
                      },
                    ]}
                  >
                    •
                  </Text>

                  <MaterialCommunityIcons
                    name="earth"
                    size={12}
                    color={
                      colors.secondary
                    }
                  />
                </View>

                {!!item.createdAt && (
                  <Text
                    style={[
                      styles.dateText,
                      {
                        color:
                          colors.secondary,
                      },
                    ]}
                  >
                    {formatarData(
                      item.createdAt,
                    )}
                  </Text>
                )}
              </View>

              <TouchableOpacity
                style={
                  styles.moreButton
                }
                activeOpacity={0.7}
              >
                <MaterialCommunityIcons
                  name="dots-horizontal"
                  size={22}
                  color={
                    colors.secondary
                  }
                />
              </TouchableOpacity>
            </View>

            <Text
              style={[
                styles.postDescription,
                {
                  color:
                    colors.text,
                },
              ]}
            >
              {item.texto ||
                "Partilhou uma opinião sobre um livro."}
            </Text>

            <View
              style={[
                styles.reviewPost,
                {
                  backgroundColor:
                    colors.cardSecondary,
                  borderColor:
                    colors.border,
                },
              ]}
            >
              {item.livroImagem ? (
                <Image
                  source={{
                    uri: item.livroImagem,
                  }}
                  style={
                    styles.reviewPostCover
                  }
                  resizeMode="cover"
                />
              ) : (
                <View
                  style={[
                    styles.reviewPostCoverFallback,
                    {
                      backgroundColor:
                        colors.primaryLight,
                    },
                  ]}
                >
                  <MaterialCommunityIcons
                    name="book-open-variant"
                    size={29}
                    color={
                      colors.primary
                    }
                  />
                </View>
              )}

              <View
                style={
                  styles.reviewPostInfo
                }
              >
                <Text
                  style={[
                    styles.reviewPostTitle,
                    {
                      color:
                        colors.text,
                    },
                  ]}
                  numberOfLines={2}
                >
                  {item.livroTitulo}
                </Text>

                <Text
                  style={[
                    styles.reviewPostAuthor,
                    {
                      color:
                        colors.secondary,
                    },
                  ]}
                  numberOfLines={1}
                >
                  {item.livroAutor}
                </Text>

                <View
                  style={
                    styles.ratingRow
                  }
                >
                  <View
                    style={
                      styles.starsRow
                    }
                  >
                    {Array.from({
                      length: 5,
                    }).map(
                      (_, index) => (
                        <MaterialCommunityIcons
                          key={index}
                          name={
                            index <
                              Math.round(
                                nota,
                              )
                              ? "star"
                              : "star-outline"
                          }
                          size={16}
                          color={
                            colors.gold
                          }
                          style={
                            styles.starIcon
                          }
                        />
                      ),
                    )}
                  </View>

                  <Text
                    style={[
                      styles.ratingText,
                      {
                        color:
                          colors.text,
                      },
                    ]}
                  >
                    {nota.toFixed(
                      1,
                    )}
                  </Text>
                </View>
              </View>
            </View>

            <View
              style={[
                styles.socialSummary,
                {
                  borderBottomColor:
                    colors.border,
                },
              ]}
            >
              <View
                style={
                  styles.summaryLeft
                }
              >
                {quantidadeCurtidas >
                  0 && (
                    <>
                      <View
                        style={[
                          styles.likeCircle,
                          {
                            backgroundColor:
                              colors.liked,
                          },
                        ]}
                      >
                        <MaterialCommunityIcons
                          name="heart"
                          size={9}
                          color={
                            colors.white
                          }
                        />
                      </View>

                      <Text
                        style={[
                          styles.summaryNumber,
                          {
                            color:
                              colors.secondary,
                          },
                        ]}
                      >
                        {
                          quantidadeCurtidas
                        }
                      </Text>
                    </>
                  )}
              </View>

              <TouchableOpacity
                activeOpacity={0.7}
                onPress={() =>
                  abrirComentarios({
                    type: "critica",
                    id: item.id,
                    livroTitulo:
                      item.livroTitulo,
                  })
                }
              >
                <Text
                  style={[
                    styles.summaryText,
                    {
                      color:
                        colors.secondary,
                    },
                  ]}
                >
                  {
                    quantidadeComentarios
                  }{" "}
                  {quantidadeComentarios ===
                    1
                    ? "comentário"
                    : "comentários"}
                </Text>
              </TouchableOpacity>
            </View>

            <View
              style={
                styles.socialActions
              }
            >
              <TouchableOpacity
                activeOpacity={0.7}
                disabled={
                  processando
                }
                onPress={() =>
                  alternarCurtida(
                    item.id,
                    "critica",
                  )
                }
                style={
                  styles.socialAction
                }
              >
                {processando ? (
                  <ActivityIndicator
                    size="small"
                    color={
                      foiCurtida
                        ? colors.primary
                        : colors.actionText
                    }
                  />
                ) : (
                  <MaterialCommunityIcons
                    name={
                      foiCurtida
                        ? "thumb-up"
                        : "thumb-up-outline"
                    }
                    size={20}
                    color={
                      foiCurtida
                        ? colors.primary
                        : colors.actionText
                    }
                  />
                )}

                <Text
                  style={[
                    styles.socialActionText,
                    {
                      color:
                        foiCurtida
                          ? colors.primary
                          : colors.actionText,
                    },
                  ]}
                >
                  Gosto
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                activeOpacity={0.7}
                onPress={() =>
                  abrirComentarios({
                    type: "critica",
                    id: item.id,
                    livroTitulo:
                      item.livroTitulo,
                  })
                }
                style={
                  styles.socialAction
                }
              >
                <MaterialCommunityIcons
                  name="comment-outline"
                  size={20}
                  color={
                    colors.actionText
                  }
                />

                <Text
                  style={[
                    styles.socialActionText,
                    {
                      color:
                        colors.actionText,
                    },
                  ]}
                >
                  Comentar
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        );
      },
      [
        colors,
        renderAvatar,
        formatarData,
        estatisticas,
        curtidasProcessando,
        alternarCurtida,
        abrirComentarios,
      ],
    );

  const renderItem =
    useCallback(
      ({
        item,
      }: {
        item: FeedItem;
      }) => {
        if (
          item.type ===
          "livro"
        ) {
          return renderLivro({
            item: item.data,
          });
        }

        return renderCritica({
          item: item.data,
        });
      },
      [
        renderLivro,
        renderCritica,
      ],
    );

  useEffect(() => {
    if (!usuario?.id) {
      return;
    }

    setPerfilAtual(
      (anterior) => {
        if (!anterior) {
          return {
            nome:
              usuario.nome ??
              "Leitor",

            foto_perfil:
              usuario.foto_perfil ??
              null,
          };
        }

        return anterior;
      },
    );
  }, [
    usuario?.id,
    usuario?.nome,
    usuario?.foto_perfil,
  ]);

  const ListHeader =
    useMemo(
      () => (
        <View>
          <View
            style={[
              styles.feedTop,
              {
                backgroundColor:
                  colors.card,
                borderBottomColor:
                  colors.border,
              },
            ]}
          >
            <View
              style={
                styles.brandArea
              }
            >
              <TouchableOpacity
                activeOpacity={0.75}
                onPress={
                  abrirMenu
                }
                style={[
                  styles.menuButton,
                  {
                    backgroundColor:
                      colors.actionBackground,
                  },
                ]}
              >
                <MaterialCommunityIcons
                  name="menu"
                  size={23}
                  color={
                    colors.text
                  }
                />
              </TouchableOpacity>

              {pesquisaAberta ? (
                <View
                  style={[
                    styles.searchContainer,
                    {
                      backgroundColor:
                        colors.actionBackground,
                      borderColor:
                        colors.border,
                    },
                  ]}
                >
                  <MaterialCommunityIcons
                    name="magnify"
                    size={21}
                    color={
                      colors.secondary
                    }
                  />

                  <TextInput
                    value={
                      textoPesquisa
                    }
                    onChangeText={
                      setTextoPesquisa
                    }
                    autoFocus
                    placeholder="Pesquisar livros..."
                    placeholderTextColor={
                      colors.mutedText
                    }
                    style={[
                      styles.searchInput,
                      {
                        color:
                          colors.text,
                      },
                    ]}
                  />

                  {!!textoPesquisa && (
                    <TouchableOpacity
                      onPress={() =>
                        setTextoPesquisa(
                          "",
                        )
                      }
                    >
                      <MaterialCommunityIcons
                        name="close-circle"
                        size={19}
                        color={
                          colors.secondary
                        }
                      />
                    </TouchableOpacity>
                  )}
                </View>
              ) : (
                <Text
                  style={[
                    styles.bookNookTitle,
                    {
                      color:
                        colors.primary,
                    },
                  ]}
                >
                  BookNook
                </Text>
              )}
            </View>

            <View
              style={
                styles.feedTopActions
              }
            >
              <TouchableOpacity
                onPress={
                  abrirPesquisa
                }
                style={[
                  styles.topAction,
                  {
                    backgroundColor:
                      pesquisaAberta
                        ? colors.primaryLight
                        : colors.actionBackground,
                  },
                ]}
              >
                <MaterialCommunityIcons
                  name={
                    pesquisaAberta
                      ? "close"
                      : "magnify"
                  }
                  size={21}
                  color={
                    pesquisaAberta
                      ? colors.primary
                      : colors.text
                  }
                />
              </TouchableOpacity>

              <TouchableOpacity
                onPress={
                  abrirNotificacoes
                }
                style={[
                  styles.topAction,
                  {
                    backgroundColor:
                      colors.actionBackground,
                  },
                ]}
              >
                <MaterialCommunityIcons
                  name={
                    quantidadeNaoLidas >
                      0
                      ? "bell"
                      : "bell-outline"
                  }
                  size={21}
                  color={
                    quantidadeNaoLidas >
                      0
                      ? colors.primary
                      : colors.text
                  }
                />

                {quantidadeNaoLidas >
                  0 && (
                    <View
                      style={
                        styles.notificationBadge
                      }
                    >
                      <Text
                        style={
                          styles.notificationBadgeText
                        }
                      >
                        {quantidadeNaoLidas >
                          9
                          ? "9+"
                          : quantidadeNaoLidas}
                      </Text>
                    </View>
                  )}
              </TouchableOpacity>
            </View>
          </View>

          {!!textoPesquisa.trim() && (
            <View
              style={[
                styles.searchResultBar,
                {
                  backgroundColor:
                    colors.background,
                },
              ]}
            >
              <MaterialCommunityIcons
                name="filter-variant"
                size={17}
                color={
                  colors.primary
                }
              />

              <Text
                style={[
                  styles.searchResultText,
                  {
                    color:
                      colors.secondary,
                  },
                ]}
              >
                {feedFiltrado.length}{" "}
                {feedFiltrado.length ===
                  1
                  ? "resultado encontrado"
                  : "resultados encontrados"}
              </Text>
            </View>
          )}

          {feedFiltrado.length >
            0 && (
              <View
                style={[
                  styles.feedSectionTitle,
                  {
                    backgroundColor:
                      colors.background,
                  },
                ]}
              >
                <Text
                  style={[
                    styles.sectionTitle,
                    {
                      color:
                        colors.text,
                    },
                  ]}
                >
                  {textoPesquisa.trim()
                    ? "Resultados da pesquisa"
                    : "Publicações recentes"}
                </Text>
              </View>
            )}
        </View>
      ),
      [
        colors,
        pesquisaAberta,
        textoPesquisa,
        abrirPesquisa,
        abrirNotificacoes,
        abrirMenu,
        quantidadeNaoLidas,
        feedFiltrado.length,
      ],
    );

  const ListEmpty =
    useMemo(
      () => (
        <View
          style={[
            styles.emptyState,
            {
              backgroundColor:
                colors.card,
            },
          ]}
        >
          <View
            style={[
              styles.emptyIcon,
              {
                backgroundColor:
                  colors.primaryLight,
              },
            ]}
          >
            <MaterialCommunityIcons
              name={
                textoPesquisa.trim()
                  ? "magnify-close"
                  : "book-open-page-variant-outline"
              }
              size={34}
              color={
                colors.primary
              }
            />
          </View>

          <Text
            style={[
              styles.emptyTitle,
              {
                color:
                  colors.text,
              },
            ]}
          >
            {textoPesquisa.trim()
              ? "Nenhum resultado"
              : "Ainda não há publicações"}
          </Text>

          <Text
            style={[
              styles.emptyText,
              {
                color:
                  colors.secondary,
              },
            ]}
          >
            {textoPesquisa.trim()
              ? "Não encontramos livros ou publicações correspondentes à tua pesquisa."
              : "Quando os leitores terminarem livros ou publicarem críticas, as publicações aparecerão aqui."}
          </Text>
        </View>
      ),
      [
        colors,
        textoPesquisa,
      ],
    );

  const renderComentario =
    useCallback(
      ({
        item,
      }: {
        item: Comentario;
      }) => {
        const nome =
          item.usuario?.nome ??
          "Leitor";

        const foto =
          item.usuario
            ?.foto_perfil ??
          null;

        return (
          <View
            style={[
              styles.commentItem,
              {
                borderBottomColor:
                  colors.softBorder,
              },
            ]}
          >
            {renderAvatar(
              foto,
              nome,
              36,
            )}

            <View
              style={
                styles.commentBody
              }
            >
              <View
                style={[
                  styles.commentBubble,
                  {
                    backgroundColor:
                      colors.actionBackground,
                  },
                ]}
              >
                <Text
                  style={[
                    styles.commentName,
                    {
                      color:
                        colors.text,
                    },
                  ]}
                  numberOfLines={1}
                >
                  {nome}
                </Text>

                <Text
                  style={[
                    styles.commentText,
                    {
                      color:
                        colors.text,
                    },
                  ]}
                >
                  {item.texto}
                </Text>
              </View>

              <Text
                style={[
                  styles.commentDate,
                  {
                    color:
                      colors.mutedText,
                  },
                ]}
              >
                {formatarData(
                  item.createdAt,
                )}
              </Text>
            </View>
          </View>
        );
      },
      [
        colors,
        renderAvatar,
        formatarData,
      ],
    );

  if (
    carregando &&
    !perfilAtual
  ) {
    return (
      <View
        style={[
          styles.loadingPage,
          {
            backgroundColor:
              colors.background,
          },
        ]}
      >
        <StatusBar
          barStyle={
            isDark
              ? "light-content"
              : "dark-content"
          }
          backgroundColor={
            colors.background
          }
        />

        <View
          style={[
            styles.loadingIcon,
            {
              backgroundColor:
                colors.primary,
            },
          ]}
        >
          <MaterialCommunityIcons
            name="book-open-page-variant"
            size={36}
            color={
              colors.white
            }
          />
        </View>

        <ActivityIndicator
          size="small"
          color={
            colors.primary
          }
        />

        <Text
          style={[
            styles.loadingTitle,
            {
              color:
                colors.text,
            },
          ]}
        >
          A carregar o BookNook
        </Text>

        <Text
          style={[
            styles.loadingSubtitle,
            {
              color:
                colors.secondary,
            },
          ]}
        >
          A sincronizar as publicações...
        </Text>
      </View>
    );
  }

  return (
    <View
      style={[
        styles.container,
        {
          backgroundColor:
            colors.background,
        },
      ]}
    >
      <StatusBar
        barStyle={
          isDark
            ? "light-content"
            : "dark-content"
        }
        backgroundColor={
          colors.card
        }
      />

      <FlatList
        data={
          feedFiltrado
        }
        keyExtractor={(
          item,
          index,
        ) =>
          `${item.type}-${item.data.id}-${index}`
        }
        renderItem={
          renderItem
        }
        ListHeaderComponent={
          ListHeader
        }
        ListEmptyComponent={
          ListEmpty
        }
        showsVerticalScrollIndicator={
          false
        }
        contentContainerStyle={[
          styles.listContent,
          feedFiltrado.length ===
          0 &&
          styles.listEmptyContent,
        ]}
        refreshControl={
          <RefreshControl
            refreshing={
              refreshing
            }
            onRefresh={
              onRefresh
            }
            tintColor={
              colors.primary
            }
            colors={[
              colors.primary,
            ]}
          />
        }
        ListFooterComponent={
          <View
            style={
              styles.listFooter
            }
          />
        }
      />

      {/* =====================================================
          MENU LATERAL / DASHBOARD
          ===================================================== */}

      <Modal
        visible={
          menuAberto
        }
        animationType="fade"
        transparent
        onRequestClose={() =>
          setMenuAberto(false)
        }
      >
        <View
          style={[
            styles.menuOverlay,
            {
              backgroundColor:
                colors.modalOverlay,
            },
          ]}
        >
          <View
            style={[
              styles.sideMenu,
              {
                backgroundColor:
                  colors.card,
              },
            ]}
          >
            <View
              style={[
                styles.sideMenuHeader,
                {
                  borderBottomColor:
                    colors.border,
                },
              ]}
            >
              {renderAvatar(
                fotoAtual,
                nomeAtual,
                48,
              )}

              <View
                style={
                  styles.sideMenuUser
                }
              >
                <Text
                  style={[
                    styles.sideMenuUserName,
                    {
                      color:
                        colors.text,
                    },
                  ]}
                  numberOfLines={1}
                >
                  {nomeAtual}
                </Text>

                <Text
                  style={[
                    styles.sideMenuUserSubtitle,
                    {
                      color:
                        colors.secondary,
                    },
                  ]}
                >
                  Comunidade BookNook
                </Text>
              </View>

              <TouchableOpacity
                onPress={() =>
                  setMenuAberto(
                    false,
                  )
                }
                style={[
                  styles.closeButton,
                  {
                    backgroundColor:
                      colors.actionBackground,
                  },
                ]}
              >
                <MaterialCommunityIcons
                  name="close"
                  size={21}
                  color={
                    colors.actionText
                  }
                />
              </TouchableOpacity>
            </View>

            <View
              style={
                styles.sideMenuContent
              }
            >
              <TouchableOpacity
                activeOpacity={0.75}
                onPress={
                  abrirDashboard
                }
                style={[
                  styles.menuItem,
                  {
                    backgroundColor:
                      colors.primaryLight,
                  },
                ]}
              >
                <View
                  style={[
                    styles.menuItemIcon,
                    {
                      backgroundColor:
                        colors.primary,
                    },
                  ]}
                >
                  <MaterialCommunityIcons
                    name="view-dashboard-outline"
                    size={22}
                    color={
                      colors.white
                    }
                  />
                </View>

                <View
                  style={
                    styles.menuItemInfo
                  }
                >
                  <Text
                    style={[
                      styles.menuItemTitle,
                      {
                        color:
                          colors.text,
                      },
                    ]}
                  >
                    Dashboard
                  </Text>

                  <Text
                    style={[
                      styles.menuItemSubtitle,
                      {
                        color:
                          colors.secondary,
                      },
                    ]}
                  >
                    Estatísticas do BookNook
                  </Text>
                </View>

                <MaterialCommunityIcons
                  name="chevron-right"
                  size={22}
                  color={
                    colors.primary
                  }
                />
              </TouchableOpacity>

              <TouchableOpacity
                activeOpacity={0.75}
                onPress={() => {
                  setMenuAberto(
                    false,
                  );

                  abrirPesquisa();
                }}
                style={[
                  styles.menuItem,
                  {
                    backgroundColor:
                      colors.actionBackground,
                  },
                ]}
              >
                <View
                  style={[
                    styles.menuItemIcon,
                    {
                      backgroundColor:
                        colors.cardSecondary,
                    },
                  ]}
                >
                  <MaterialCommunityIcons
                    name="magnify"
                    size={22}
                    color={
                      colors.primary
                    }
                  />
                </View>

                <View
                  style={
                    styles.menuItemInfo
                  }
                >
                  <Text
                    style={[
                      styles.menuItemTitle,
                      {
                        color:
                          colors.text,
                      },
                    ]}
                  >
                    Pesquisar
                  </Text>

                  <Text
                    style={[
                      styles.menuItemSubtitle,
                      {
                        color:
                          colors.secondary,
                      },
                    ]}
                  >
                    Encontrar livros e publicações
                  </Text>
                </View>
              </TouchableOpacity>

              <TouchableOpacity
                activeOpacity={0.75}
                onPress={() => {
                  setMenuAberto(
                    false,
                  );

                  abrirNotificacoes();
                }}
                style={[
                  styles.menuItem,
                  {
                    backgroundColor:
                      colors.actionBackground,
                  },
                ]}
              >
                <View
                  style={[
                    styles.menuItemIcon,
                    {
                      backgroundColor:
                        colors.cardSecondary,
                    },
                  ]}
                >
                  <MaterialCommunityIcons
                    name="bell-outline"
                    size={22}
                    color={
                      colors.primary
                    }
                  />
                </View>

                <View
                  style={
                    styles.menuItemInfo
                  }
                >
                  <Text
                    style={[
                      styles.menuItemTitle,
                      {
                        color:
                          colors.text,
                      },
                    ]}
                  >
                    Notificações
                  </Text>

                  <Text
                    style={[
                      styles.menuItemSubtitle,
                      {
                        color:
                          colors.secondary,
                      },
                    ]}
                  >
                    Atividade recente
                  </Text>
                </View>

                {quantidadeNaoLidas >
                  0 && (
                    <View
                      style={
                        styles.menuNotificationCount
                      }
                    >
                      <Text
                        style={
                          styles.menuNotificationCountText
                        }
                      >
                        {quantidadeNaoLidas >
                          9
                          ? "9+"
                          : quantidadeNaoLidas}
                      </Text>
                    </View>
                  )}
              </TouchableOpacity>
            </View>

            <View
              style={[
                styles.sideMenuFooter,
                {
                  borderTopColor:
                    colors.border,
                },
              ]}
            >
              <MaterialCommunityIcons
                name="book-open-page-variant"
                size={18}
                color={
                  colors.primary
                }
              />

              <Text
                style={[
                  styles.sideMenuFooterText,
                  {
                    color:
                      colors.secondary,
                  },
                ]}
              >
                BookNook · Comunidade de leitores
              </Text>
            </View>
          </View>

          <TouchableOpacity
            style={
              styles.menuOutside
            }
            activeOpacity={1}
            onPress={() =>
              setMenuAberto(
                false,
              )
            }
          />
        </View>
      </Modal>

      {/* =====================================================
          DASHBOARD
          ===================================================== */}

      <Modal
        visible={
          dashboardAberto
        }
        animationType="slide"
        transparent
        onRequestClose={() =>
          setDashboardAberto(
            false,
          )
        }
      >
        <View
          style={[
            styles.modalContainer,
            {
              backgroundColor:
                colors.modalOverlay,
            },
          ]}
        >
          <View
            style={[
              styles.dashboardModal,
              {
                backgroundColor:
                  colors.background,
              },
            ]}
          >
            <View
              style={[
                styles.dashboardHeader,
                {
                  backgroundColor:
                    colors.card,
                  borderBottomColor:
                    colors.border,
                },
              ]}
            >
              <View
                style={
                  styles.dashboardHeaderInfo
                }
              >
                <Text
                  style={[
                    styles.dashboardTitle,
                    {
                      color:
                        colors.text,
                    },
                  ]}
                >
                  Dashboard
                </Text>

                <Text
                  style={[
                    styles.dashboardSubtitle,
                    {
                      color:
                        colors.secondary,
                    },
                  ]}
                >
                  Visão geral da comunidade BookNook
                </Text>
              </View>

              <TouchableOpacity
                activeOpacity={0.75}
                onPress={() =>
                  setDashboardAberto(
                    false,
                  )
                }
                style={[
                  styles.closeButton,
                  {
                    backgroundColor:
                      colors.actionBackground,
                  },
                ]}
              >
                <MaterialCommunityIcons
                  name="close"
                  size={21}
                  color={
                    colors.actionText
                  }
                />
              </TouchableOpacity>
            </View>

            {carregandoDashboard ? (
              <View
                style={
                  styles.dashboardLoading
                }
              >
                <ActivityIndicator
                  size="large"
                  color={
                    colors.primary
                  }
                />

                <Text
                  style={[
                    styles.dashboardLoadingText,
                    {
                      color:
                        colors.secondary,
                    },
                  ]}
                >
                  A calcular estatísticas...
                </Text>
              </View>
            ) : (
              <FlatList
                data={[
                  {
                    key: "livrosLidos",
                    title: "Livros lidos",
                    value:
                      estatisticasDashboard.livrosLidos,
                    icon: "book-check-outline",
                    color:
                      colors.primary,
                  },

                  {
                    key: "publicacoes",
                    title: "Publicações",
                    value:
                      estatisticasDashboard.publicacoes,
                    icon: "post-outline",
                    color:
                      colors.gold,
                  },

                  {
                    key: "usuarios",
                    title: "Leitores",
                    value:
                      estatisticasDashboard.usuarios,
                    icon: "account-group-outline",
                    color:
                      "#42B72A",
                  },

                  {
                    key: "livros",
                    title: "Livros",
                    value:
                      estatisticasDashboard.livros,
                    icon: "bookshelf",
                    color:
                      "#8B5CF6",
                  },

                  {
                    key: "curtidas",
                    title: "Gostos",
                    value:
                      estatisticasDashboard.curtidas,
                    icon: "thumb-up-outline",
                    color:
                      "#E41E3F",
                  },

                  {
                    key: "comentarios",
                    title: "Comentários",
                    value:
                      estatisticasDashboard.comentarios,
                    icon: "comment-outline",
                    color:
                      "#00A884",
                  },
                ]}
                numColumns={2}
                keyExtractor={(
                  item,
                ) => item.key}
                contentContainerStyle={
                  styles.dashboardContent
                }
                columnWrapperStyle={
                  styles.dashboardRow
                }
                showsVerticalScrollIndicator={
                  false
                }
                renderItem={({
                  item,
                }) => (
                  <View
                    style={[
                      styles.dashboardCard,
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
                        styles.dashboardCardIcon,
                        {
                          backgroundColor:
                            isDark
                              ? `${item.color}25`
                              : `${item.color}15`,
                        },
                      ]}
                    >
                      <MaterialCommunityIcons
                        name={
                          item.icon as any
                        }
                        size={24}
                        color={
                          item.color
                        }
                      />
                    </View>

                    <Text
                      style={[
                        styles.dashboardCardValue,
                        {
                          color:
                            colors.text,
                        },
                      ]}
                    >
                      {item.value}
                    </Text>

                    <Text
                      style={[
                        styles.dashboardCardTitle,
                        {
                          color:
                            colors.secondary,
                        },
                      ]}
                    >
                      {item.title}
                    </Text>
                  </View>
                )}
                ListHeaderComponent={
                  <View>
                    <View
                      style={[
                        styles.dashboardWelcome,
                        {
                          backgroundColor:
                            colors.primary,
                        },
                      ]}
                    >
                      <View
                        style={
                          styles.dashboardWelcomeText
                        }
                      >
                        <Text
                          style={
                            styles.dashboardWelcomeTitle
                          }
                        >
                          A tua comunidade
                        </Text>

                        <Text
                          style={
                            styles.dashboardWelcomeDescription
                          }
                        >
                          Acompanha a atividade dos leitores e o crescimento do BookNook.
                        </Text>
                      </View>

                      <MaterialCommunityIcons
                        name="chart-line"
                        size={48}
                        color={
                          colors.white
                        }
                      />
                    </View>

                    <Text
                      style={[
                        styles.dashboardSectionTitle,
                        {
                          color:
                            colors.text,
                        },
                      ]}
                    >
                      Estatísticas
                    </Text>
                  </View>
                }
              />
            )}
          </View>
        </View>
      </Modal>

      {/* =====================================================
          NOTIFICAÇÕES
          ===================================================== */}

      <Modal
        visible={
          notificacoesAbertas
        }
        animationType="slide"
        transparent
        onRequestClose={() =>
          setNotificacoesAbertas(
            false,
          )
        }
      >
        <View
          style={[
            styles.modalContainer,
            {
              backgroundColor:
                colors.modalOverlay,
            },
          ]}
        >
          <View
            style={[
              styles.notificationsModal,
              {
                backgroundColor:
                  colors.card,
              },
            ]}
          >
            <View
              style={[
                styles.notificationsHeader,
                {
                  borderBottomColor:
                    colors.border,
                },
              ]}
            >
              <View
                style={
                  styles.notificationsHeaderInfo
                }
              >
                <Text
                  style={[
                    styles.notificationsTitle,
                    {
                      color:
                        colors.text,
                    },
                  ]}
                >
                  Notificações
                </Text>

                <Text
                  style={[
                    styles.notificationsSubtitle,
                    {
                      color:
                        colors.secondary,
                    },
                  ]}
                >
                  Atividade dos leitores
                </Text>
              </View>

              {quantidadeNaoLidas >
                0 && (
                  <TouchableOpacity
                    onPress={
                      marcarTodasNotificacoesComoLidas
                    }
                  >
                    <Text
                      style={[
                        styles.markAllText,
                        {
                          color:
                            colors.primary,
                        },
                      ]}
                    >
                      Marcar lidas
                    </Text>
                  </TouchableOpacity>
                )}

              <TouchableOpacity
                activeOpacity={0.75}
                onPress={() =>
                  setNotificacoesAbertas(
                    false,
                  )
                }
                style={[
                  styles.closeButton,
                  {
                    backgroundColor:
                      colors.actionBackground,
                  },
                ]}
              >
                <MaterialCommunityIcons
                  name="close"
                  size={21}
                  color={
                    colors.actionText
                  }
                />
              </TouchableOpacity>
            </View>

            <FlatList
              data={
                notificacoes
              }
              keyExtractor={(
                item,
              ) =>
                item.id
              }
              showsVerticalScrollIndicator={
                false
              }
              contentContainerStyle={[
                styles.notificationsList,
                notificacoes.length ===
                0 &&
                styles.notificationsListEmpty,
              ]}
              renderItem={({
                item,
              }) => (
                <View
                  style={[
                    styles.notificationItem,
                    {
                      backgroundColor:
                        item.lida
                          ? colors.card
                          : colors.primaryLight,

                      borderBottomColor:
                        colors.softBorder,
                    },
                  ]}
                >
                  <View
                    style={[
                      styles.notificationIcon,
                      {
                        backgroundColor:
                          item.tipo ===
                            "livro"
                            ? colors.primary
                            : colors.gold,
                      },
                    ]}
                  >
                    <MaterialCommunityIcons
                      name={
                        item.tipo ===
                          "livro"
                          ? "book-check"
                          : "message-text-outline"
                      }
                      size={20}
                      color={
                        colors.white
                      }
                    />
                  </View>

                  <View
                    style={
                      styles.notificationContent
                    }
                  >
                    <Text
                      style={[
                        styles.notificationTitle,
                        {
                          color:
                            colors.text,
                        },
                      ]}
                    >
                      {
                        item.titulo
                      }
                    </Text>

                    <Text
                      style={[
                        styles.notificationMessage,
                        {
                          color:
                            colors.secondary,
                        },
                      ]}
                    >
                      {
                        item.mensagem
                      }
                    </Text>

                    <Text
                      style={[
                        styles.notificationDate,
                        {
                          color:
                            colors.mutedText,
                        },
                      ]}
                    >
                      {formatarData(
                        item.data,
                      )}
                    </Text>
                  </View>

                  {!item.lida && (
                    <View
                      style={[
                        styles.unreadDot,
                        {
                          backgroundColor:
                            colors.primary,
                        },
                      ]}
                    />
                  )}
                </View>
              )}
              ListEmptyComponent={
                <View
                  style={
                    styles.noNotifications
                  }
                >
                  <View
                    style={[
                      styles.noNotificationsIcon,
                      {
                        backgroundColor:
                          colors.primaryLight,
                      },
                    ]}
                  >
                    <MaterialCommunityIcons
                      name="bell-outline"
                      size={30}
                      color={
                        colors.primary
                      }
                    />
                  </View>

                  <Text
                    style={[
                      styles.noNotificationsTitle,
                      {
                        color:
                          colors.text,
                      },
                    ]}
                  >
                    Sem notificações
                  </Text>

                  <Text
                    style={[
                      styles.noNotificationsText,
                      {
                        color:
                          colors.secondary,
                      },
                    ]}
                  >
                    Quando houver nova atividade de leitura ou publicação, ela aparecerá aqui.
                  </Text>
                </View>
              }
            />
          </View>
        </View>
      </Modal>

      {/* =====================================================
          COMENTÁRIOS
          ===================================================== */}

      <Modal
        visible={
          comentariosAbertos
        }
        animationType="slide"
        transparent
        onRequestClose={
          fecharComentarios
        }
      >
        <KeyboardAvoidingView
          style={[
            styles.modalContainer,
            {
              backgroundColor:
                colors.modalOverlay,
            },
          ]}
          behavior={
            Platform.OS === "ios"
              ? "padding"
              : undefined
          }
        >
          <View
            style={[
              styles.commentsModal,
              {
                backgroundColor:
                  colors.card,
              },
            ]}
          >
            <View
              style={[
                styles.commentsHeader,
                {
                  borderBottomColor:
                    colors.border,
                },
              ]}
            >
              <View
                style={
                  styles.commentsHeaderInfo
                }
              >
                <Text
                  style={[
                    styles.commentsTitle,
                    {
                      color:
                        colors.text,
                    },
                  ]}
                >
                  Comentários
                </Text>

                <Text
                  style={[
                    styles.commentsSubtitle,
                    {
                      color:
                        colors.secondary,
                    },
                  ]}
                  numberOfLines={1}
                >
                  {publicacaoSelecionada?.livroTitulo ??
                    "Publicação"}
                </Text>
              </View>

              <TouchableOpacity
                activeOpacity={0.75}
                onPress={
                  fecharComentarios
                }
                style={[
                  styles.closeButton,
                  {
                    backgroundColor:
                      colors.actionBackground,
                  },
                ]}
              >
                <MaterialCommunityIcons
                  name="close"
                  size={21}
                  color={
                    colors.actionText
                  }
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
                  size="small"
                  color={
                    colors.primary
                  }
                />

                <Text
                  style={[
                    styles.commentsLoadingText,
                    {
                      color:
                        colors.secondary,
                    },
                  ]}
                >
                  A carregar comentários...
                </Text>
              </View>
            ) : (
              <FlatList
                data={
                  comentarios
                }
                keyExtractor={(
                  item,
                ) =>
                  String(
                    item.id,
                  )
                }
                renderItem={
                  renderComentario
                }
                keyboardShouldPersistTaps="handled"
                showsVerticalScrollIndicator={
                  false
                }
                contentContainerStyle={[
                  styles.commentsList,
                  comentarios.length ===
                  0 &&
                  styles.commentsListEmpty,
                ]}
                ListEmptyComponent={
                  <View
                    style={
                      styles.noComments
                    }
                  >
                    <View
                      style={[
                        styles.noCommentsIcon,
                        {
                          backgroundColor:
                            colors.primaryLight,
                        },
                      ]}
                    >
                      <MaterialCommunityIcons
                        name="comment-outline"
                        size={27}
                        color={
                          colors.primary
                        }
                      />
                    </View>

                    <Text
                      style={[
                        styles.noCommentsTitle,
                        {
                          color:
                            colors.text,
                        },
                      ]}
                    >
                      Ainda não há comentários
                    </Text>

                    <Text
                      style={[
                        styles.noCommentsText,
                        {
                          color:
                            colors.secondary,
                        },
                      ]}
                    >
                      Seja o primeiro a comentar esta publicação.
                    </Text>
                  </View>
                }
              />
            )}

            <View
              style={[
                styles.commentComposer,
                {
                  borderTopColor:
                    colors.border,
                  backgroundColor:
                    colors.card,
                },
              ]}
            >
              {renderAvatar(
                fotoAtual,
                nomeAtual,
                36,
              )}

              <TextInput
                value={
                  novoComentario
                }
                onChangeText={
                  setNovoComentario
                }
                placeholder="Escreva um comentário..."
                placeholderTextColor={
                  colors.mutedText
                }
                multiline
                maxLength={1000}
                editable={
                  !enviandoComentario
                }
                style={[
                  styles.commentInput,
                  {
                    color:
                      colors.text,
                    backgroundColor:
                      colors.actionBackground,
                    borderColor:
                      colors.border,
                  },
                ]}
              />

              <TouchableOpacity
                activeOpacity={0.8}
                disabled={
                  enviandoComentario ||
                  !novoComentario.trim()
                }
                onPress={
                  enviarComentario
                }
                style={[
                  styles.sendCommentButton,
                  {
                    backgroundColor:
                      novoComentario.trim()
                        ? colors.primary
                        : colors.muted,
                  },
                ]}
              >
                {enviandoComentario ? (
                  <ActivityIndicator
                    size="small"
                    color={
                      colors.white
                    }
                  />
                ) : (
                  <MaterialCommunityIcons
                    name="send"
                    size={18}
                    color={
                      novoComentario.trim()
                        ? colors.white
                        : colors.mutedText
                    }
                  />
                )}
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },

  listContent: {
    paddingBottom: 100,
  },

  listEmptyContent: {
    paddingBottom: 100,
  },

  /* =====================================================
     TOPO BOOKNOOK / FACEBOOK
     ===================================================== */

  feedTop: {
    minHeight: 66,
    paddingHorizontal: 14,
    flexDirection: "row",
    alignItems: "center",
    justifyContent:
      "space-between",
    borderBottomWidth: 1,
  },

  brandArea: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    minWidth: 0,
  },

  menuButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent:
      "center",
    marginRight: 10,
  },

  bookNookTitle: {
    fontSize: 25,
    fontWeight: "900",
    letterSpacing: -0.8,
  },

  feedTitle: {
    fontSize: 25,
    fontWeight: "900",
    letterSpacing: -0.5,
  },

  feedTopActions: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginLeft: 8,
  },

  topAction: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent:
      "center",
    position: "relative",
  },

  notificationBadge: {
    position: "absolute",
    right: -2,
    top: -3,
    minWidth: 17,
    height: 17,
    borderRadius: 9,
    paddingHorizontal: 4,
    alignItems: "center",
    justifyContent:
      "center",
    backgroundColor:
      "#E41E3F",
    borderWidth: 2,
    borderColor:
      "#FFFFFF",
  },

  notificationBadgeText: {
    color: "#FFFFFF",
    fontSize: 8,
    fontWeight: "900",
  },

  searchContainer: {
    flex: 1,
    height: 42,
    borderRadius: 21,
    borderWidth: 1,
    paddingHorizontal: 13,
    flexDirection: "row",
    alignItems: "center",
    marginRight: 8,
  },

  searchInput: {
    flex: 1,
    height: 42,
    paddingHorizontal: 9,
    fontSize: 14,
  },

  searchResultBar: {
    minHeight: 38,
    paddingHorizontal: 16,
    flexDirection: "row",
    alignItems: "center",
    gap: 7,
  },

  searchResultText: {
    fontSize: 12,
    fontWeight: "600",
  },

  feedSectionTitle: {
    paddingHorizontal: 15,
    paddingTop: 17,
    paddingBottom: 9,
  },

  sectionTitle: {
    fontSize: 17,
    fontWeight: "900",
  },

  /* =====================================================
     POSTS
     ===================================================== */

  facebookPost: {
    marginBottom: 9,
    paddingTop: 14,
    paddingBottom: 2,
  },

  postHeader: {
    paddingHorizontal: 15,
    flexDirection: "row",
    alignItems: "center",
  },

  avatarImage: {
    backgroundColor:
      "#E7EEF8",
  },

  avatarFallback: {
    alignItems: "center",
    justifyContent:
      "center",
  },

  avatarLetter: {
    fontWeight: "900",
  },

  postUserInfo: {
    flex: 1,
    marginLeft: 10,
  },

  userName: {
    fontSize: 14,
    fontWeight: "800",
  },

  metaRow: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 2,
    gap: 4,
  },

  postMeta: {
    fontSize: 11,
  },

  metaDot: {
    fontSize: 10,
  },

  dateText: {
    fontSize: 10,
    marginTop: 1,
  },

  moreButton: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: "center",
    justifyContent:
      "center",
  },

  postDescription: {
    paddingHorizontal: 15,
    marginTop: 13,
    marginBottom: 13,
    fontSize: 14,
    lineHeight: 20,
  },

  inlineStrong: {
    fontWeight: "800",
  },

  bookPost: {
    marginHorizontal: 15,
    borderWidth: 1,
    flexDirection: "row",
    minHeight: 108,
    borderRadius: 2,
    overflow: "hidden",
  },

  bookPostCover: {
    width: 82,
    height: 108,
  },

  bookPostCoverFallback: {
    width: 82,
    height: 108,
    alignItems: "center",
    justifyContent:
      "center",
  },

  bookPostInfo: {
    flex: 1,
    paddingHorizontal: 13,
    paddingVertical: 13,
    justifyContent:
      "center",
  },

  bookPostTitle: {
    fontSize: 15,
    lineHeight: 20,
    fontWeight: "800",
  },

  bookPostAuthor: {
    fontSize: 12,
    marginTop: 5,
  },

  readIndicator: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 10,
    gap: 5,
  },

  readIndicatorText: {
    fontSize: 11,
    fontWeight: "700",
  },

  reviewPost: {
    marginHorizontal: 15,
    borderWidth: 1,
    flexDirection: "row",
    minHeight: 108,
    borderRadius: 2,
    overflow: "hidden",
  },

  reviewPostCover: {
    width: 82,
    height: 108,
  },

  reviewPostCoverFallback: {
    width: 82,
    height: 108,
    alignItems: "center",
    justifyContent:
      "center",
  },

  reviewPostInfo: {
    flex: 1,
    paddingHorizontal: 13,
    paddingVertical: 13,
    justifyContent:
      "center",
  },

  reviewPostTitle: {
    fontSize: 15,
    lineHeight: 20,
    fontWeight: "800",
  },

  reviewPostAuthor: {
    fontSize: 12,
    marginTop: 5,
  },

  ratingRow: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 9,
  },

  starsRow: {
    flexDirection: "row",
    alignItems: "center",
  },

  starIcon: {
    marginRight: 1,
  },

  ratingText: {
    fontSize: 11,
    fontWeight: "800",
    marginLeft: 7,
  },

  socialSummary: {
    minHeight: 37,
    marginTop: 9,
    marginHorizontal: 15,
    borderBottomWidth: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent:
      "space-between",
  },

  summaryLeft: {
    flexDirection: "row",
    alignItems: "center",
  },

  likeCircle: {
    width: 19,
    height: 19,
    borderRadius: 10,
    alignItems: "center",
    justifyContent:
      "center",
  },

  summaryText: {
    fontSize: 11,
    marginLeft: 6,
  },

  summaryNumber: {
    fontSize: 11,
    marginLeft: 5,
  },

  socialActions: {
    minHeight: 46,
    marginHorizontal: 10,
    flexDirection: "row",
    alignItems: "center",
  },

  socialAction: {
    flex: 1,
    height: 42,
    flexDirection: "row",
    alignItems: "center",
    justifyContent:
      "center",
    gap: 7,
    borderRadius: 7,
  },

  socialActionText: {
    fontSize: 12,
    fontWeight: "700",
  },

  /* =====================================================
     EMPTY / LOADING
     ===================================================== */

  emptyState: {
    marginHorizontal: 15,
    marginTop: 15,
    paddingHorizontal: 25,
    paddingVertical: 34,
    alignItems: "center",
  },

  emptyIcon: {
    width: 72,
    height: 72,
    borderRadius: 36,
    alignItems: "center",
    justifyContent:
      "center",
    marginBottom: 15,
  },

  emptyTitle: {
    fontSize: 17,
    fontWeight: "900",
    textAlign: "center",
  },

  emptyText: {
    fontSize: 13,
    lineHeight: 20,
    textAlign: "center",
    marginTop: 7,
    maxWidth: 310,
  },

  listFooter: {
    height: 25,
  },

  loadingPage: {
    flex: 1,
    alignItems: "center",
    justifyContent:
      "center",
    paddingHorizontal: 30,
  },

  loadingIcon: {
    width: 82,
    height: 82,
    borderRadius: 27,
    alignItems: "center",
    justifyContent:
      "center",
    marginBottom: 22,
  },

  loadingTitle: {
    fontSize: 17,
    fontWeight: "900",
    marginTop: 15,
  },

  loadingSubtitle: {
    fontSize: 13,
    marginTop: 6,
    textAlign: "center",
  },

  /* =====================================================
     MENU
     ===================================================== */

  menuOverlay: {
    flex: 1,
    flexDirection: "row",
  },

  sideMenu: {
    width: "86%",
    maxWidth: 380,
    height: "100%",
    shadowOpacity: 0.25,
    shadowRadius: 18,
    elevation: 15,
  },

  menuOutside: {
    flex: 1,
  },

  sideMenuHeader: {
    minHeight: 100,
    paddingHorizontal: 16,
    paddingVertical: 16,
    flexDirection: "row",
    alignItems: "center",
    borderBottomWidth: 1,
  },

  sideMenuUser: {
    flex: 1,
    marginLeft: 11,
    marginRight: 10,
  },

  sideMenuUserName: {
    fontSize: 15,
    fontWeight: "900",
  },

  sideMenuUserSubtitle: {
    fontSize: 11,
    marginTop: 3,
  },

  sideMenuContent: {
    flex: 1,
    padding: 14,
  },

  menuItem: {
    minHeight: 70,
    borderRadius: 12,
    paddingHorizontal: 11,
    paddingVertical: 10,
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 9,
  },

  menuItemIcon: {
    width: 43,
    height: 43,
    borderRadius: 22,
    alignItems: "center",
    justifyContent:
      "center",
  },

  menuItemInfo: {
    flex: 1,
    marginLeft: 11,
  },

  menuItemTitle: {
    fontSize: 14,
    fontWeight: "900",
  },

  menuItemSubtitle: {
    fontSize: 10,
    marginTop: 3,
  },

  menuNotificationCount: {
    minWidth: 22,
    height: 22,
    paddingHorizontal: 5,
    borderRadius: 11,
    alignItems: "center",
    justifyContent:
      "center",
    backgroundColor:
      "#E41E3F",
  },

  menuNotificationCountText: {
    color: "#FFFFFF",
    fontSize: 9,
    fontWeight: "900",
  },

  sideMenuFooter: {
    minHeight: 58,
    paddingHorizontal: 16,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    borderTopWidth: 1,
  },

  sideMenuFooterText: {
    fontSize: 10,
    flex: 1,
  },

  /* =====================================================
     DASHBOARD
     ===================================================== */

  dashboardModal: {
    height: "91%",
    borderTopLeftRadius: 22,
    borderTopRightRadius: 22,
    overflow: "hidden",
  },

  dashboardHeader: {
    minHeight: 78,
    paddingHorizontal: 17,
    paddingVertical: 12,
    borderBottomWidth: 1,
    flexDirection: "row",
    alignItems: "center",
  },

  dashboardHeaderInfo: {
    flex: 1,
    paddingRight: 10,
  },

  dashboardTitle: {
    fontSize: 20,
    fontWeight: "900",
  },

  dashboardSubtitle: {
    fontSize: 11,
    marginTop: 3,
  },

  dashboardContent: {
    padding: 15,
    paddingBottom: 30,
  },

  dashboardWelcome: {
    minHeight: 118,
    borderRadius: 16,
    paddingHorizontal: 17,
    paddingVertical: 17,
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 20,
  },

  dashboardWelcomeText: {
    flex: 1,
    paddingRight: 12,
  },

  dashboardWelcomeTitle: {
    color: "#FFFFFF",
    fontSize: 18,
    fontWeight: "900",
  },

  dashboardWelcomeDescription: {
    color: "#FFFFFF",
    opacity: 0.9,
    fontSize: 11,
    lineHeight: 17,
    marginTop: 5,
  },

  dashboardSectionTitle: {
    fontSize: 17,
    fontWeight: "900",
    marginBottom: 11,
  },

  dashboardRow: {
    justifyContent:
      "space-between",
  },

  dashboardCard: {
    width: "48.5%",
    minHeight: 145,
    borderRadius: 14,
    borderWidth: 1,
    padding: 14,
    marginBottom: 12,
  },

  dashboardCardIcon: {
    width: 45,
    height: 45,
    borderRadius: 14,
    alignItems: "center",
    justifyContent:
      "center",
  },

  dashboardCardValue: {
    fontSize: 25,
    fontWeight: "900",
    marginTop: 13,
  },

  dashboardCardTitle: {
    fontSize: 11,
    fontWeight: "600",
    marginTop: 2,
  },

  dashboardLoading: {
    flex: 1,
    alignItems: "center",
    justifyContent:
      "center",
  },

  dashboardLoadingText: {
    fontSize: 12,
    marginTop: 10,
  },

  /* =====================================================
     MODAIS
     ===================================================== */

  modalContainer: {
    flex: 1,
    justifyContent:
      "flex-end",
  },

  notificationsModal: {
    height: "82%",
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    overflow: "hidden",
  },

  notificationsHeader: {
    minHeight: 70,
    paddingHorizontal: 17,
    paddingVertical: 12,
    borderBottomWidth: 1,
    flexDirection: "row",
    alignItems: "center",
  },

  notificationsHeaderInfo: {
    flex: 1,
    paddingRight: 10,
  },

  notificationsTitle: {
    fontSize: 19,
    fontWeight: "900",
  },

  notificationsSubtitle: {
    fontSize: 11,
    marginTop: 3,
  },

  markAllText: {
    fontSize: 11,
    fontWeight: "800",
    marginRight: 12,
  },

  notificationsList: {
    paddingVertical: 4,
  },

  notificationsListEmpty: {
    flexGrow: 1,
    justifyContent:
      "center",
  },

  notificationItem: {
    minHeight: 82,
    paddingHorizontal: 15,
    paddingVertical: 12,
    borderBottomWidth: 1,
    flexDirection: "row",
    alignItems: "center",
  },

  notificationIcon: {
    width: 43,
    height: 43,
    borderRadius: 22,
    alignItems: "center",
    justifyContent:
      "center",
    marginRight: 11,
  },

  notificationContent: {
    flex: 1,
  },

  notificationTitle: {
    fontSize: 13,
    fontWeight: "900",
  },

  notificationMessage: {
    fontSize: 12,
    lineHeight: 17,
    marginTop: 2,
  },

  notificationDate: {
    fontSize: 9,
    marginTop: 4,
  },

  unreadDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginLeft: 7,
  },

  noNotifications: {
    alignItems: "center",
    justifyContent:
      "center",
    paddingHorizontal: 30,
  },

  noNotificationsIcon: {
    width: 68,
    height: 68,
    borderRadius: 34,
    alignItems: "center",
    justifyContent:
      "center",
    marginBottom: 14,
  },

  noNotificationsTitle: {
    fontSize: 16,
    fontWeight: "900",
    textAlign: "center",
  },

  noNotificationsText: {
    fontSize: 12,
    lineHeight: 18,
    textAlign: "center",
    marginTop: 6,
  },

  closeButton: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: "center",
    justifyContent:
      "center",
  },

  /* =====================================================
     COMENTÁRIOS
     ===================================================== */

  commentsModal: {
    height: "80%",
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    overflow: "hidden",
  },

  commentsHeader: {
    minHeight: 68,
    paddingHorizontal: 17,
    paddingVertical: 12,
    borderBottomWidth: 1,
    flexDirection: "row",
    alignItems: "center",
  },

  commentsHeaderInfo: {
    flex: 1,
    paddingRight: 12,
  },

  commentsTitle: {
    fontSize: 18,
    fontWeight: "900",
  },

  commentsSubtitle: {
    fontSize: 11,
    marginTop: 3,
  },

  commentsList: {
    paddingHorizontal: 15,
    paddingVertical: 8,
  },

  commentsListEmpty: {
    flexGrow: 1,
    justifyContent:
      "center",
  },

  commentItem: {
    flexDirection: "row",
    paddingVertical: 10,
    borderBottomWidth: 1,
  },

  commentBody: {
    flex: 1,
    marginLeft: 9,
  },

  commentBubble: {
    borderRadius: 17,
    paddingHorizontal: 12,
    paddingVertical: 9,
  },

  commentName: {
    fontSize: 12,
    fontWeight: "900",
    marginBottom: 3,
  },

  commentText: {
    fontSize: 13,
    lineHeight: 19,
  },

  commentDate: {
    fontSize: 9,
    marginTop: 4,
    marginLeft: 3,
  },

  commentsLoading: {
    flex: 1,
    alignItems: "center",
    justifyContent:
      "center",
  },

  commentsLoadingText: {
    fontSize: 12,
    marginTop: 9,
  },

  noComments: {
    alignItems: "center",
    justifyContent:
      "center",
    paddingHorizontal: 30,
  },

  noCommentsIcon: {
    width: 64,
    height: 64,
    borderRadius: 32,
    alignItems: "center",
    justifyContent:
      "center",
    marginBottom: 13,
  },

  noCommentsTitle: {
    fontSize: 15,
    fontWeight: "900",
    textAlign: "center",
  },

  noCommentsText: {
    fontSize: 12,
    textAlign: "center",
    lineHeight: 18,
    marginTop: 5,
  },

  commentComposer: {
    minHeight: 68,
    paddingHorizontal: 13,
    paddingVertical: 10,
    borderTopWidth: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },

  commentInput: {
    flex: 1,
    minHeight: 42,
    maxHeight: 90,
    borderWidth: 1,
    borderRadius: 21,
    paddingHorizontal: 14,
    paddingVertical: 9,
    fontSize: 12,
  },

  sendCommentButton: {
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: "center",
    justifyContent:
      "center",
  },
});
