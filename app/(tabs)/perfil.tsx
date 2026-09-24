import {
  memo,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

import {
  ActivityIndicator,
  Alert,
  AppState,
  AppStateStatus,
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
  View,
  useColorScheme,
} from "react-native";

import { SafeAreaView } from "react-native-safe-area-context";

import AsyncStorage from "@react-native-async-storage/async-storage";

import { eq, inArray } from "drizzle-orm";

import * as ImagePicker from "expo-image-picker";
import * as FileSystem from "expo-file-system/legacy";

import { MaterialCommunityIcons } from "@expo/vector-icons";

import {
  useFocusEffect,
  useRouter,
} from "expo-router";

import { getDb } from "@/database/db";

import { useUsuario } from "@/contexts/UsuarioContext";

import {
  atualizarUsuarioAPI,
  logoutUsuario,
  obterUsuarioAtual,
} from "@/database/services/api";

import {
  criticas,
  estantes,
  feed,
  livros,
  usuarios,
} from "@/database/schema";

import {
  criarComentario,
  listarComentarios,
  obterEstatisticasCritica,
  toggleCurtida,
  type Comentario,
} from "@/database/services/socialService";

type Usuario = {
  id: string;
  nome: string;
  foto_perfil?: string | null;
};

type Publicacao = {
  id: string | number;
  tipo?: string | null;
  texto?: string | null;
  titulo?: string | null;
  autor?: string | null;
  imagem?: string | null;
  criado_em?: string | number | Date | null;
  livroId?: string | null;
  criticaId?: string | number | null;
  curtidas?: number;
  comentarios?: number;
  curtiu?: boolean;
};

type LivroLido = {
  id: string;
  titulo?: string | null;
  autor?: string | null;
  imagem?: string | null;
};

type AbaPerfil = "publicacoes" | "lidos";

type EstatisticaPublicacao = {
  curtidas: number;
  comentarios: number;
  curtiu: boolean;
};

function normalizarTexto(valor: unknown): string {
  return String(valor ?? "")
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

function eStatusLido(valor: unknown): boolean {
  const status = normalizarTexto(valor);

  return (
    status === "lido" ||
    status === "lidos" ||
    status === "read" ||
    status === "finished" ||
    status === "finish" ||
    status === "concluido" ||
    status === "concluida" ||
    status === "terminado" ||
    status === "terminada" ||
    status === "finalizado" ||
    status === "finalizada"
  );
}

function converterData(
  valor?: string | number | Date | null,
): Date | null {
  if (
    valor === undefined ||
    valor === null ||
    valor === ""
  ) {
    return null;
  }

  try {
    if (valor instanceof Date) {
      return Number.isNaN(valor.getTime())
        ? null
        : valor;
    }

    if (
      typeof valor === "number" &&
      valor > 0 &&
      valor < 100000000000
    ) {
      const data = new Date(valor);

      return Number.isNaN(data.getTime())
        ? null
        : data;
    }

    const data = new Date(valor);

    return Number.isNaN(data.getTime())
      ? null
      : data;
  } catch {
    return null;
  }
}

function formatarDataPublicacao(
  valor?: string | number | Date | null,
): string {
  const data = converterData(valor);

  if (!data) {
    return "Publicação";
  }

  const agora = new Date();

  const diferenca =
    agora.getTime() - data.getTime();

  if (diferenca < 0) {
    return data.toLocaleDateString("pt-PT", {
      day: "2-digit",
      month: "short",
      year:
        data.getFullYear() !==
        agora.getFullYear()
          ? "numeric"
          : undefined,
    });
  }

  const minutos = Math.floor(
    diferenca / 60000,
  );

  const horas = Math.floor(
    minutos / 60,
  );

  const dias = Math.floor(
    horas / 24,
  );

  if (minutos < 1) {
    return "Agora mesmo";
  }

  if (minutos < 60) {
    return `Há ${minutos} min`;
  }

  if (horas < 24) {
    return `Há ${horas} h`;
  }

  if (dias < 7) {
    return `Há ${dias} ${
      dias === 1 ? "dia" : "dias"
    }`;
  }

  return data.toLocaleDateString("pt-PT", {
    day: "2-digit",
    month: "short",
    year:
      data.getFullYear() !==
      agora.getFullYear()
        ? "numeric"
        : undefined,
  });
}

/* =========================================================
   ÍCONE DE LIVRO
========================================================= */

function LivroIcon({
  size = 42,
  color = "#1877F2",
  pageColor = "#FFFFFF",
}: {
  size?: number;
  color?: string;
  pageColor?: string;
}) {
  const width = size;
  const height = size * 0.82;

  return (
    <View
      style={{
        width,
        height,
        position: "relative",
        justifyContent: "center",
      }}
    >
      <View
        style={{
          position: "absolute",
          left: 3,
          top: 3,
          width: width * 0.46,
          height: height * 0.78,
          borderTopLeftRadius: 5,
          borderBottomLeftRadius: 5,
          backgroundColor: color,
          borderWidth: 1,
          borderColor: color,
        }}
      />

      <View
        style={{
          position: "absolute",
          right: 3,
          top: 3,
          width: width * 0.46,
          height: height * 0.78,
          borderTopRightRadius: 5,
          borderBottomRightRadius: 5,
          backgroundColor: pageColor,
          borderWidth: 1,
          borderColor: color,
        }}
      />

      <View
        style={{
          position: "absolute",
          left: width * 0.48,
          top: 5,
          width: 2,
          height: height * 0.72,
          backgroundColor: color,
          opacity: 0.8,
        }}
      />

      <View
        style={{
          position: "absolute",
          left: width * 0.56,
          top: height * 0.32,
          width: width * 0.25,
          height: 2,
          borderRadius: 2,
          backgroundColor: color,
          opacity: 0.45,
        }}
      />

      <View
        style={{
          position: "absolute",
          left: width * 0.56,
          top: height * 0.45,
          width: width * 0.2,
          height: 2,
          borderRadius: 2,
          backgroundColor: color,
          opacity: 0.45,
        }}
      />
    </View>
  );
}

/* =========================================================
   AVATAR
========================================================= */

type AvatarProps = {
  size?: number;
  foto?: string | null;
  nome?: string | null;
  primaryDeep: string;
  white?: string;
};

const Avatar = memo(
  ({
    size = 96,
    foto = null,
    nome = null,
    primaryDeep,
    white = "#FFFFFF",
  }: AvatarProps) => {
    const [imagemComErro, setImagemComErro] =
      useState(false);

    useEffect(() => {
      setImagemComErro(false);
    }, [foto]);

    const tamanho = Math.max(1, size);

    const primeiraLetra =
      nome?.trim()?.charAt(0)?.toUpperCase() ||
      "U";

    if (!foto || imagemComErro) {
      return (
        <View
          style={[
            styles.avatarFallback,
            {
              width: tamanho,
              height: tamanho,
              borderRadius: tamanho / 2,
              backgroundColor: primaryDeep,
            },
          ]}
        >
          <Text
            style={[
              styles.avatarLetter,
              {
                color: white,
                fontSize: tamanho * 0.38,
              },
            ]}
          >
            {primeiraLetra}
          </Text>
        </View>
      );
    }

    return (
      <View
        style={{
          width: tamanho,
          height: tamanho,
          borderRadius: tamanho / 2,
          overflow: "hidden",
          backgroundColor: "#E7F3FF",
        }}
      >
        <Image
          source={{ uri: foto }}
          style={{
            width: tamanho,
            height: tamanho,
            borderRadius: tamanho / 2,
          }}
          resizeMode="cover"
          fadeDuration={0}
          onError={() => {
            setImagemComErro(true);
          }}
        />
      </View>
    );
  },
);

Avatar.displayName = "Avatar";

/* =========================================================
   PERFIL
========================================================= */

export default function Perfil() {
  const router = useRouter();
  const colorScheme = useColorScheme();
  const isDark = colorScheme === "dark";

  const { setUsuario: setUsuarioContexto } = useUsuario();

  /*
   * PALETA AZUL MODERNA
   */

  const colors = useMemo(
    () => ({
      background: isDark
        ? "#0B1220"
        : "#F0F2F5",

      card: isDark
        ? "#111827"
        : "#FFFFFF",

      cardSecondary: isDark
        ? "#172033"
        : "#F7F8FA",

      text: isDark
        ? "#F9FAFB"
        : "#1C1E21",

      secondary: isDark
        ? "#A8B3C7"
        : "#65676B",

      primary: isDark
        ? "#4599FF"
        : "#1877F2",

      primaryDark: isDark
        ? "#2D7FE3"
        : "#166FE5",

      primaryDeep: isDark
        ? "#1D4ED8"
        : "#145DBF",

      border: isDark
        ? "#273449"
        : "#DADDE1",

      soft: isDark
        ? "#172554"
        : "#E7F3FF",

      muted: isDark
        ? "#1E293B"
        : "#E4E6EB",

      input: isDark
        ? "#0F172A"
        : "#F0F2F5",

      danger: isDark
        ? "#FF6B6B"
        : "#E41E3F",

      dangerSoft: isDark
        ? "#351923"
        : "#FDE7EC",

      white: "#FFFFFF",
    }),
    [isDark],
  );

  const [usuario, setUsuario] =
    useState<Usuario | null>(null);

  const [
    publicacoesUsuario,
    setPublicacoesUsuario,
  ] = useState<Publicacao[]>([]);

  const [livrosLidos, setLivrosLidos] =
    useState<LivroLido[]>([]);

  const [aba, setAba] =
    useState<AbaPerfil>("publicacoes");

  const [menuVisible, setMenuVisible] =
    useState(false);

  const [
    editModalVisible,
    setEditModalVisible,
  ] = useState(false);

  const [novoNome, setNovoNome] =
    useState("");

  const [fotoLocal, setFotoLocal] =
    useState<string | null>(null);

  const [carregando, setCarregando] =
    useState(true);

  const [atualizando, setAtualizando] =
    useState(false);

  const [salvando, setSalvando] =
    useState(false);

  const [
    selecionandoFoto,
    setSelecionandoFoto,
  ] = useState(false);

  const [
    estatisticasPublicacoes,
    setEstatisticasPublicacoes,
  ] = useState<
    Record<string, EstatisticaPublicacao>
  >({});

  const [
    comentariosVisible,
    setComentariosVisible,
  ] = useState(false);

  const [
    publicacaoSelecionada,
    setPublicacaoSelecionada,
  ] = useState<Publicacao | null>(null);

  const [
    comentariosLista,
    setComentariosLista,
  ] = useState<Comentario[]>([]);

  const [
    comentarioTexto,
    setComentarioTexto,
  ] = useState("");

  const [
    carregandoComentarios,
    setCarregandoComentarios,
  ] = useState(false);

  const [
    enviandoComentario,
    setEnviandoComentario,
  ] = useState(false);

  const carregandoRef =
    useRef(false);

  const mountedRef =
    useRef(true);

  const ultimoCarregamentoRef =
    useRef(0);

  const processandoCurtidaRef =
    useRef<Record<string, boolean>>({});

  useEffect(() => {
    mountedRef.current = true;

    return () => {
      mountedRef.current = false;
    };
  }, []);

  /* =========================================================
     ESTATÍSTICAS
  ========================================================= */

  const carregarEstatisticasPublicacoes =
    useCallback(
      async (
        publicacoes: Publicacao[],
        usuarioId: string,
      ) => {
        const criticasValidas =
          publicacoes.filter(
            (publicacao) =>
              publicacao.criticaId !== null &&
              publicacao.criticaId !==
                undefined &&
              Number.isFinite(
                Number(
                  publicacao.criticaId,
                ),
              ),
          );

        if (
          criticasValidas.length === 0
        ) {
          if (mountedRef.current) {
            setEstatisticasPublicacoes(
              {},
            );
          }

          return;
        }

        const resultados =
          await Promise.all(
            criticasValidas.map(
              async (publicacao) => {
                const criticaId =
                  Number(
                    publicacao.criticaId,
                  );

                try {
                  const estatisticas =
                    await obterEstatisticasCritica(
                      criticaId,
                      usuarioId,
                    );

                  return [
                    String(criticaId),
                    estatisticas,
                  ] as const;
                } catch (erro) {
                  console.error(
                    `Erro ao carregar estatísticas da crítica ${criticaId}:`,
                    erro,
                  );

                  return [
                    String(criticaId),
                    {
                      curtidas: 0,
                      comentarios: 0,
                      curtiu: false,
                    },
                  ] as const;
                }
              },
            ),
          );

        const mapa =
          Object.fromEntries(
            resultados,
          );

        if (!mountedRef.current) {
          return;
        }

        setEstatisticasPublicacoes(
          mapa,
        );

        setPublicacoesUsuario(
          (atuais) =>
            atuais.map(
              (publicacao) => {
                const criticaId =
                  publicacao.criticaId;

                if (
                  criticaId === null ||
                  criticaId ===
                    undefined
                ) {
                  return publicacao;
                }

                const estatistica =
                  mapa[
                    String(criticaId)
                  ];

                if (!estatistica) {
                  return publicacao;
                }

                return {
                  ...publicacao,
                  curtidas:
                    estatistica.curtidas,
                  comentarios:
                    estatistica.comentarios,
                  curtiu:
                    estatistica.curtiu,
                };
              },
            ),
        );
      },
      [],
    );

  /* =========================================================
     CARREGAR PERFIL
  ========================================================= */

  const carregarPerfil =
    useCallback(
      async (
        mostrarLoading = true,
        forcar = false,
      ) => {
        if (carregandoRef.current) {
          return;
        }

        const agora = Date.now();

        if (
          !forcar &&
          agora -
              ultimoCarregamentoRef.current <
            2500
        ) {
          return;
        }

        carregandoRef.current = true;
        ultimoCarregamentoRef.current =
          agora;

        try {
          if (
            mostrarLoading &&
            mountedRef.current
          ) {
            setCarregando(true);
          }

          const token =
            await AsyncStorage.getItem(
              "authToken",
            );

          if (!token) {
            if (mountedRef.current) {
              setUsuario(null);
              setPublicacoesUsuario([]);
              setLivrosLidos([]);
            }

            router.replace("/login");
            return;
          }

          const banco = await getDb();

          let respostaUsuario;

          try {
            respostaUsuario =
              await obterUsuarioAtual(token);
          } catch (erro) {
            console.error(
              "Erro ao validar sessão pela API:",
              erro,
            );

            await AsyncStorage.removeItem(
              "authToken",
            );
            await AsyncStorage.removeItem(
              "usuarioLogado",
            );

            if (mountedRef.current) {
              setUsuario(null);
              setPublicacoesUsuario([]);
              setLivrosLidos([]);
            }

            Alert.alert(
              "Sessão expirada",
              "A sua sessão não é mais válida. Entre novamente na sua conta.",
            );

            router.replace("/login");
            return;
          }

          if (
            !respostaUsuario?.success ||
            !respostaUsuario?.user
          ) {
            await AsyncStorage.removeItem(
              "authToken",
            );
            await AsyncStorage.removeItem(
              "usuarioLogado",
            );

            if (mountedRef.current) {
              setUsuario(null);
              setPublicacoesUsuario([]);
              setLivrosLidos([]);
            }

            Alert.alert(
              "Sessão inválida",
              "Não foi possível validar a sua conta.",
            );

            router.replace("/login");
            return;
          }

          const usuarioApi =
            respostaUsuario.user;

          const usuarioAtual: Usuario = {
            id: String(usuarioApi.id),
            nome: String(usuarioApi.nome),
            foto_perfil:
              usuarioApi.foto_perfil ?? null,
          };

          if (mountedRef.current) {
            setUsuario((anterior) => {
              if (
                anterior?.id === usuarioAtual.id &&
                anterior.nome === usuarioAtual.nome &&
                anterior.foto_perfil ===
                  usuarioAtual.foto_perfil
              ) {
                return anterior;
              }

              return usuarioAtual;
            });

            setNovoNome((anterior) =>
              anterior === usuarioAtual.nome
                ? anterior
                : usuarioAtual.nome,
            );

            setFotoLocal((anterior) => {
              const novaFoto =
                usuarioAtual.foto_perfil ?? null;

              return anterior === novaFoto
                ? anterior
                : novaFoto;
            });
          }

          await AsyncStorage.setItem(
            "usuarioLogado",
            JSON.stringify({
              id: usuarioAtual.id,
              nome: usuarioAtual.nome,
              foto_perfil:
                usuarioAtual.foto_perfil ?? null,
              createdAt: usuarioApi.createdAt,
              perfilAtualizadoEm: Date.now(),
            }),
          );

          /*
           * Mantemos uma cópia local mínima do utilizador
           * apenas para compatibilidade com as tabelas
           * locais de publicações/estantes.
           * A autenticação, porém, é feita exclusivamente
           * através do token e da API.
           */
          try {
            const usuarioLocal =
              await banco
                .select({
                  id: usuarios.id,
                })
                .from(usuarios)
                .where(
                  eq(
                    usuarios.id,
                    usuarioAtual.id,
                  ),
                )
                .limit(1);

            if (usuarioLocal.length === 0) {
              await banco.insert(usuarios).values({
                id: usuarioAtual.id,
                nome: usuarioAtual.nome,
                senha: "",
                foto_perfil:
                  usuarioAtual.foto_perfil ?? null,
              });
            } else {
              await banco
                .update(usuarios)
                .set({
                  nome: usuarioAtual.nome,
                  foto_perfil:
                    usuarioAtual.foto_perfil ?? null,
                })
                .where(
                  eq(
                    usuarios.id,
                    usuarioAtual.id,
                  ),
                );
            }
          } catch (erro) {
            console.warn(
              "Não foi possível sincronizar a cópia local do utilizador:",
              erro,
            );
          }

          /* =================================================
             PUBLICAÇÕES
          ================================================= */

          try {
            const registrosFeed =
              await banco
                .select()
                .from(feed)
                .where(
                  eq(
                    feed.usuario_id,
                    usuarioAtual.id,
                  ),
                );

            const criticasUsuario =
              await banco
                .select()
                .from(criticas)
                .where(
                  eq(
                    criticas.usuario_id,
                    usuarioAtual.id,
                  ),
                );

            const idsLivrosFeed =
              registrosFeed
                .map(
                  (item) =>
                    item.livro_id,
                )
                .filter(
                  (
                    id,
                  ): id is string =>
                    Boolean(id),
                );

            const idsLivrosCriticas =
              criticasUsuario
                .map(
                  (item) =>
                    item.livro_id,
                )
                .filter(
                  (
                    id,
                  ): id is string =>
                    Boolean(id),
                );

            const idsLivros =
              Array.from(
                new Set([
                  ...idsLivrosFeed,
                  ...idsLivrosCriticas,
                ]),
              );

            let livrosRelacionados:
              any[] = [];

            if (
              idsLivros.length > 0
            ) {
              livrosRelacionados =
                await banco
                  .select()
                  .from(livros)
                  .where(
                    inArray(
                      livros.id,
                      idsLivros,
                    ),
                  );
            }

            const livrosMap =
              new Map<string, any>();

            livrosRelacionados.forEach(
              (livro) => {
                livrosMap.set(
                  String(livro.id),
                  livro,
                );
              },
            );

            const criticasMap =
              new Map<string, any>();

            criticasUsuario.forEach(
              (critica) => {
                criticasMap.set(
                  String(critica.id),
                  critica,
                );
              },
            );

            const publicacoesFormatadas =
              registrosFeed
                .map(
                  (
                    item,
                  ): Publicacao | null => {
                    const critica =
                      item.critica_id
                        ? criticasMap.get(
                            String(
                              item.critica_id,
                            ),
                          )
                        : null;

                    const livroId =
                      item.livro_id ??
                      critica?.livro_id ??
                      null;

                    const livro =
                      livroId
                        ? livrosMap.get(
                            String(
                              livroId,
                            ),
                          )
                        : null;

                    const tipo =
                      item.tipo ?? null;

                    const texto =
                      critica?.texto ??
                      null;

                    const titulo =
                      livro?.titulo ??
                      null;

                    const autor =
                      livro?.autor ??
                      null;

                    const imagem =
                      livro?.imagem ??
                      null;

                    if (
                      !texto &&
                      !titulo &&
                      !imagem &&
                      !tipo
                    ) {
                      return null;
                    }

                    return {
                      id: item.id,
                      tipo,
                      texto,
                      titulo,
                      autor,
                      imagem,
                      criado_em:
                        item.createdAt,
                      livroId: livroId
                        ? String(
                            livroId,
                          )
                        : null,
                      criticaId:
                        item.critica_id,
                      curtidas: 0,
                      comentarios: 0,
                      curtiu: false,
                    };
                  },
                )
                .filter(
                  (
                    item,
                  ): item is Publicacao =>
                    Boolean(item),
                )
                .sort(
                  (a, b) => {
                    const dataA =
                      converterData(
                        a.criado_em,
                      )?.getTime() ?? 0;

                    const dataB =
                      converterData(
                        b.criado_em,
                      )?.getTime() ?? 0;

                    return (
                      dataB - dataA
                    );
                  },
                );

            const publicacoesUnicas =
              Array.from(
                new Map(
                  publicacoesFormatadas.map(
                    (item) => [
                      String(item.id),
                      item,
                    ],
                  ),
                ).values(),
              );

            if (mountedRef.current) {
              setPublicacoesUsuario(
                publicacoesUnicas,
              );
            }

            await carregarEstatisticasPublicacoes(
              publicacoesUnicas,
              usuarioAtual.id,
            );
          } catch (erro) {
            console.error(
              "Erro ao carregar publicações:",
              erro,
            );

            if (mountedRef.current) {
              setPublicacoesUsuario(
                [],
              );

              setEstatisticasPublicacoes(
                {},
              );
            }
          }

          /* =================================================
             LIVROS LIDOS
          ================================================= */

          try {
            const registrosEstantes =
              await banco
                .select()
                .from(estantes)
                .where(
                  eq(
                    estantes.usuario_id,
                    usuarioAtual.id,
                  ),
                );

            const registrosLidos =
              registrosEstantes.filter(
                (item) =>
                  eStatusLido(
                    item.status,
                  ),
              );

            const idsLivrosLidos =
              Array.from(
                new Set(
                  registrosLidos.map(
                    (item) =>
                      item.livro_id,
                  ),
                ),
              );

            if (
              idsLivrosLidos.length ===
              0
            ) {
              if (mountedRef.current) {
                setLivrosLidos([]);
              }
            } else {
              const livrosEncontrados =
                await banco
                  .select()
                  .from(livros)
                  .where(
                    inArray(
                      livros.id,
                      idsLivrosLidos,
                    ),
                  );

              const livrosMap =
                new Map<string, any>();

              livrosEncontrados.forEach(
                (livro) => {
                  livrosMap.set(
                    String(livro.id),
                    livro,
                  );
                },
              );

              const livrosFormatados =
                idsLivrosLidos
                  .map((id) =>
                    livrosMap.get(
                      String(id),
                    ),
                  )
                  .filter(
                    (
                      livro,
                    ): livro is any =>
                      Boolean(livro),
                  )
                  .map(
                    (
                      livro,
                    ): LivroLido => ({
                      id: String(
                        livro.id,
                      ),
                      titulo:
                        livro.titulo ??
                        null,
                      autor:
                        livro.autor ??
                        null,
                      imagem:
                        livro.imagem ??
                        null,
                    }),
                  );

              const livrosUnicos =
                Array.from(
                  new Map(
                    livrosFormatados.map(
                      (livro) => [
                        String(
                          livro.id,
                        ),
                        livro,
                      ],
                    ),
                  ).values(),
                );

              if (mountedRef.current) {
                setLivrosLidos(
                  livrosUnicos,
                );
              }
            }
          } catch (erro) {
            console.error(
              "Erro ao carregar livros lidos:",
              erro,
            );

            if (mountedRef.current) {
              setLivrosLidos([]);
            }
          }
        } catch (erro) {
          console.error(
            "Erro ao carregar perfil:",
            erro,
          );
        } finally {
          carregandoRef.current =
            false;

          if (mountedRef.current) {
            setCarregando(false);
            setAtualizando(false);
          }
        }
      },
      [
        router,
        carregarEstatisticasPublicacoes,
      ],
    );

  /* =========================================================
     FOCO
  ========================================================= */

  useFocusEffect(
    useCallback(() => {
      void carregarPerfil(
        !usuario,
        true,
      );

      return undefined;
    }, [
      carregarPerfil,
      usuario,
    ]),
  );

  /* =========================================================
     SINCRONIZAÇÃO
  ========================================================= */

  useEffect(() => {
    const intervalo =
      setInterval(() => {
        if (
          AppState.currentState ===
          "active"
        ) {
          void carregarPerfil(
            false,
            false,
          );
        }
      }, 15000);

    return () => {
      clearInterval(intervalo);
    };
  }, [carregarPerfil]);

  useEffect(() => {
    const handleAppStateChange =
      (
        nextState: AppStateStatus,
      ) => {
        if (
          nextState === "active"
        ) {
          void carregarPerfil(
            false,
            true,
          );
        }
      };

    const subscription =
      AppState.addEventListener(
        "change",
        handleAppStateChange,
      );

    return () => {
      subscription.remove();
    };
  }, [carregarPerfil]);

  /* =========================================================
     ATUALIZAR
  ========================================================= */

  const atualizarPerfil =
    useCallback(async () => {
      if (carregandoRef.current) {
        return;
      }

      setAtualizando(true);

      await carregarPerfil(
        false,
        true,
      );
    }, [carregarPerfil]);

  /* =========================================================
     CURTIDA
  ========================================================= */

  const alternarCurtida =
    useCallback(
      async (
        publicacao: Publicacao,
      ) => {
        const criticaId =
          Number(
            publicacao.criticaId,
          );

        if (
          !Number.isInteger(
            criticaId,
          )
        ) {
          return;
        }

        const usuarioId =
          usuario?.id;

        if (!usuarioId) {
          Alert.alert(
            "Sessão necessária",
            "Inicie sessão para poder curtir publicações.",
          );

          return;
        }

        const chave =
          String(criticaId);

        if (
          processandoCurtidaRef
            .current[chave]
        ) {
          return;
        }

        processandoCurtidaRef.current[
          chave
        ] = true;

        try {
          const novaCurtida =
            await toggleCurtida(
              usuarioId,
              criticaId,
            );

          setEstatisticasPublicacoes(
            (atuais) => {
              const anterior =
                atuais[chave] ?? {
                  curtidas:
                    publicacao.curtidas ??
                    0,
                  comentarios:
                    publicacao.comentarios ??
                    0,
                  curtiu: false,
                };

              const quantidade =
                Math.max(
                  0,
                  anterior.curtidas +
                    (novaCurtida
                      ? 1
                      : -1),
                );

              return {
                ...atuais,
                [chave]: {
                  ...anterior,
                  curtidas:
                    quantidade,
                  curtiu:
                    novaCurtida,
                },
              };
            },
          );

          setPublicacoesUsuario(
            (atuais) =>
              atuais.map(
                (item) => {
                  if (
                    String(
                      item.criticaId,
                    ) !== chave
                  ) {
                    return item;
                  }

                  const quantidadeAtual =
                    item.curtidas ?? 0;

                  return {
                    ...item,
                    curtidas:
                      Math.max(
                        0,
                        quantidadeAtual +
                          (novaCurtida
                            ? 1
                            : -1),
                      ),
                    curtiu:
                      novaCurtida,
                  };
                },
              ),
          );
        } catch (erro) {
          console.error(
            "Erro ao alternar curtida:",
            erro,
          );

          Alert.alert(
            "Não foi possível",
            "Não foi possível atualizar a curtida. Tente novamente.",
          );
        } finally {
          delete processandoCurtidaRef
            .current[chave];
        }
      },
      [usuario?.id],
    );

  /* =========================================================
     COMENTÁRIOS
  ========================================================= */

  const abrirComentarios =
    useCallback(
      async (
        publicacao: Publicacao,
      ) => {
        const criticaId =
          Number(
            publicacao.criticaId,
          );

        if (
          !Number.isInteger(
            criticaId,
          )
        ) {
          return;
        }

        setPublicacaoSelecionada(
          publicacao,
        );

        setComentariosVisible(
          true,
        );

        setComentarioTexto("");

        setCarregandoComentarios(
          true,
        );

        try {
          const lista =
            await listarComentarios(
              criticaId,
            );

          if (mountedRef.current) {
            setComentariosLista(
              lista,
            );
          }
        } catch (erro) {
          console.error(
            "Erro ao carregar comentários:",
            erro,
          );

          Alert.alert(
            "Erro",
            "Não foi possível carregar os comentários.",
          );

          setComentariosLista([]);
        } finally {
          if (mountedRef.current) {
            setCarregandoComentarios(
              false,
            );
          }
        }
      },
      [],
    );

  const fecharComentarios =
    useCallback(() => {
      if (enviandoComentario) {
        return;
      }

      setComentariosVisible(
        false,
      );

      setPublicacaoSelecionada(
        null,
      );

      setComentariosLista([]);

      setComentarioTexto("");
    }, [enviandoComentario]);

  const enviarComentario =
    useCallback(async () => {
      const texto =
        comentarioTexto.trim();

      if (!texto) {
        return;
      }

      if (
        !usuario?.id ||
        !publicacaoSelecionada
      ) {
        return;
      }

      const criticaId =
        Number(
          publicacaoSelecionada.criticaId,
        );

      if (
        !Number.isInteger(
          criticaId,
        )
      ) {
        return;
      }

      try {
        setEnviandoComentario(
          true,
        );

        const novoComentario =
          await criarComentario(
            usuario.id,
            criticaId,
            texto,
          );

        setComentariosLista(
          (atuais) => [
            novoComentario,
            ...atuais,
          ],
        );

        setComentarioTexto("");

        const chave =
          String(criticaId);

        setEstatisticasPublicacoes(
          (atuais) => {
            const anterior =
              atuais[chave] ?? {
                curtidas: 0,
                comentarios: 0,
                curtiu: false,
              };

            return {
              ...atuais,
              [chave]: {
                ...anterior,
                comentarios:
                  anterior.comentarios +
                  1,
              },
            };
          },
        );

        setPublicacoesUsuario(
          (atuais) =>
            atuais.map(
              (item) => {
                if (
                  String(
                    item.criticaId,
                  ) !== chave
                ) {
                  return item;
                }

                return {
                  ...item,
                  comentarios:
                    (item.comentarios ??
                      0) + 1,
                };
              },
            ),
        );
      } catch (erro) {
        console.error(
          "Erro ao enviar comentário:",
          erro,
        );

        Alert.alert(
          "Não foi possível",
          "O comentário não pôde ser publicado.",
        );
      } finally {
        if (mountedRef.current) {
          setEnviandoComentario(
            false,
          );
        }
      }
    }, [
      comentarioTexto,
      usuario?.id,
      publicacaoSelecionada,
    ]);

  /* =========================================================
     EDITAR PERFIL
  ========================================================= */

  const abrirEdicao =
    useCallback(() => {
      if (!usuario || salvando) {
        return;
      }

      setNovoNome(usuario.nome);

      setFotoLocal(
        usuario.foto_perfil ?? null,
      );

      setMenuVisible(false);

      requestAnimationFrame(() => {
        setEditModalVisible(
          true,
        );
      });
    }, [usuario, salvando]);

  /* =========================================================
     FOTO
  ========================================================= */

  const selecionarFoto =
    useCallback(async () => {
      if (
        salvando ||
        selecionandoFoto
      ) {
        return;
      }

      try {
        setSelecionandoFoto(true);

        const permissao =
          await ImagePicker.requestMediaLibraryPermissionsAsync();

        if (!permissao.granted) {
          Alert.alert(
            "Permissão necessária",
            "Permita o acesso às fotografias para escolher uma foto de perfil.",
          );

          return;
        }

        const resultado =
          await ImagePicker.launchImageLibraryAsync(
            {
              mediaTypes: ["images"],
              allowsEditing: true,
              aspect: [1, 1],
              quality: 0.6,
              exif: false,
            },
          );

        if (
          !resultado.canceled &&
          resultado.assets?.length
        ) {
          setFotoLocal(
            resultado.assets[0].uri,
          );
        }
      } catch (erro) {
        console.error(
          "Erro ao selecionar foto:",
          erro,
        );

        Alert.alert(
          "Erro",
          "Não foi possível selecionar a foto.",
        );
      } finally {
        setSelecionandoFoto(false);
      }
    }, [
      salvando,
      selecionandoFoto,
    ]);

  /* =========================================================
     SALVAR PERFIL
  ========================================================= */

  const converterFotoParaBase64 = useCallback(
    async (uri: string): Promise<string> => {
      if (uri.startsWith("data:image/")) {
        return uri;
      }

      const base64 = await FileSystem.readAsStringAsync(uri, {
        encoding: FileSystem.EncodingType.Base64,
      });

      if (!base64) {
        throw new Error("Não foi possível ler a fotografia selecionada.");
      }

      return `data:image/jpeg;base64,${base64}`;
    },
    [],
  );

  /* =========================================================
     SALVAR PERFIL
  ========================================================= */

  const salvarPerfil = useCallback(async () => {
    if (!usuario || salvando) {
      return;
    }

    const nomeLimpo = novoNome.trim();

    if (!nomeLimpo) {
      Alert.alert("Atenção", "Digite um nome válido.");
      return;
    }

    try {
      setSalvando(true);

      const banco = await getDb();
      const token = await AsyncStorage.getItem("authToken");

      if (!token) {
        throw new Error("Sessão não encontrada. Entre novamente na sua conta.");
      }

      let fotoParaGuardar: string | null = usuario.foto_perfil ?? null;

      if (fotoLocal && fotoLocal !== usuario.foto_perfil) {
        fotoParaGuardar = await converterFotoParaBase64(fotoLocal);
      }

      const resposta = await atualizarUsuarioAPI(
        token,
        usuario.id,
        nomeLimpo,
        fotoParaGuardar,
      );

      // Algumas versões da API devolvem apenas { message } mesmo
      // quando o PostgreSQL foi atualizado com sucesso. Não podemos
      // tratar a ausência de success/user como erro nesse caso.
      if (resposta?.success === false) {
        throw new Error(
          resposta?.message ||
            "Não foi possível atualizar o perfil no servidor.",
        );
      }

      // Se a API devolver o utilizador, usamos os dados confirmados.
      // Se devolver somente a mensagem de sucesso, consultamos a API
      // novamente usando o token para obter o registo real do PostgreSQL.
      let dadosServidor = resposta?.user ?? null;

      if (!dadosServidor) {
        try {
          const confirmacao = await obterUsuarioAtual(token);
          if (confirmacao?.success && confirmacao?.user) {
            dadosServidor = confirmacao.user;
          }
        } catch (erroConfirmacao) {
          console.warn(
            "Não foi possível confirmar o perfil na API; usando os dados enviados:",
            erroConfirmacao,
          );
        }
      }

      const usuarioAtualizado: Usuario = {
        id: String(dadosServidor?.id ?? usuario.id),
        nome: String(dadosServidor?.nome ?? nomeLimpo),
        foto_perfil:
          dadosServidor?.foto_perfil ?? fotoParaGuardar ?? null,
      };

      /* =====================================================
         SINCRONIZAR CÓPIA LOCAL
      ===================================================== */
      const usuarioLocal = await banco
        .select({ id: usuarios.id })
        .from(usuarios)
        .where(eq(usuarios.id, usuarioAtualizado.id))
        .limit(1);

      if (usuarioLocal.length > 0) {
        await banco
          .update(usuarios)
          .set({
            nome: usuarioAtualizado.nome,
            foto_perfil: usuarioAtualizado.foto_perfil,
          })
          .where(eq(usuarios.id, usuarioAtualizado.id));
      } else {
        // Mantém uma cópia mínima local para o Feed/estantes.
        await banco.insert(usuarios).values({
          id: usuarioAtualizado.id,
          nome: usuarioAtualizado.nome,
          senha: "",
          foto_perfil: usuarioAtualizado.foto_perfil,
        });
      }

      /* =====================================================
         SINCRONIZAR CONTEXTO
      ===================================================== */
      setUsuarioContexto(usuarioAtualizado);

      if (mountedRef.current) {
        setUsuario(usuarioAtualizado);
        setNovoNome(usuarioAtualizado.nome);
        setFotoLocal(usuarioAtualizado.foto_perfil ?? null);
      }

      /* =====================================================
         SINCRONIZAR SESSÃO LOCAL
      ===================================================== */
      const sessaoAtual = await AsyncStorage.getItem("usuarioLogado");
      let sessaoAnterior: Record<string, unknown> = {};

      try {
        sessaoAnterior = sessaoAtual
          ? (JSON.parse(sessaoAtual) as Record<string, unknown>)
          : {};
      } catch {
        sessaoAnterior = {};
      }

      await AsyncStorage.setItem(
        "usuarioLogado",
        JSON.stringify({
          ...sessaoAnterior,
          id: usuarioAtualizado.id,
          nome: usuarioAtualizado.nome,
          foto_perfil: usuarioAtualizado.foto_perfil ?? null,
          perfilAtualizadoEm: Date.now(),
        }),
      );

      if (mountedRef.current) {
        setEditModalVisible(false);
      }

      Alert.alert(
        "Perfil atualizado",
        "A sua foto e os seus dados foram guardados com sucesso.",
      );
    } catch (erro) {
      console.error("Erro ao salvar perfil:", erro);

      const mensagem =
        erro instanceof Error
          ? erro.message
          : "Não foi possível atualizar os dados do perfil.";

      Alert.alert("Erro", mensagem);
    } finally {
      if (mountedRef.current) {
        setSalvando(false);
      }
    }
  }, [
    usuario,
    salvando,
    novoNome,
    fotoLocal,
    converterFotoParaBase64,
    setUsuarioContexto,
  ]);

  /* =========================================================
     LOGOUT
  ========================================================= */

  const terminarSessao =
    useCallback(() => {
      Alert.alert(
        "Terminar sessão",
        "Deseja realmente sair da sua conta?",
        [
          {
            text: "Cancelar",
            style: "cancel",
          },
          {
            text: "Sair",
            style: "destructive",
            onPress: async () => {
              try {
                const token =
                  await AsyncStorage.getItem(
                    "authToken",
                  );

                if (token) {
                  try {
                    await logoutUsuario(token);
                  } catch (erro) {
                    console.warn(
                      "Não foi possível encerrar a sessão na API:",
                      erro,
                    );
                  }
                }

                await AsyncStorage.removeItem(
                  "authToken",
                );
                await AsyncStorage.removeItem(
                  "usuarioLogado",
                );

                setMenuVisible(false);
                setEditModalVisible(
                  false,
                );

                setUsuario(null);
                setNovoNome("");
                setFotoLocal(null);

                setPublicacoesUsuario(
                  [],
                );

                setLivrosLidos([]);

                setEstatisticasPublicacoes(
                  {},
                );

                router.replace(
                  "/login",
                );
              } catch (erro) {
                console.error(
                  "Erro ao terminar sessão:",
                  erro,
                );
              }
            },
          },
        ],
      );
    }, [router]);

  /* =========================================================
     ESTATÍSTICAS
  ========================================================= */

  const estatisticas = useMemo(
    () => [
      {
        label: "Publicações",
        value:
          publicacoesUsuario.length,
      },
      {
        label: "Livros lidos",
        value:
          livrosLidos.length,
      },
    ],
    [
      publicacoesUsuario.length,
      livrosLidos.length,
    ],
  );

  /* =========================================================
     VAZIO
  ========================================================= */

  const renderVazio =
    useCallback(() => {
      const publicacoes =
        aba === "publicacoes";

      return (
        <View
          style={[
            styles.emptyCard,
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
              styles.emptyIcon,
              {
                backgroundColor:
                  colors.soft,
              },
            ]}
          >
            {publicacoes ? (
              <MaterialCommunityIcons
                name="post-outline"
                size={40}
                color={colors.primary}
              />
            ) : (
              <LivroIcon
                size={42}
                color={colors.primary}
                pageColor={
                  colors.card
                }
              />
            )}
          </View>

          <Text
            style={[
              styles.emptyTitle,
              {
                color: colors.text,
              },
            ]}
          >
            {publicacoes
              ? "Ainda não há publicações"
              : "Nenhum livro lido"}
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
            {publicacoes
              ? "As suas publicações aparecerão aqui quando começar a partilhar com a comunidade."
              : "Os livros que marcar como lidos aparecerão nesta seção."}
          </Text>
        </View>
      );
    }, [aba, colors]);

  /* =========================================================
     PUBLICAÇÃO
  ========================================================= */

  const renderPublicacao =
    useCallback(
      ({
        item,
      }: {
        item: Publicacao;
      }) => {
        const texto =
          item.texto?.trim() ?? "";

        const titulo =
          item.titulo?.trim() ?? "";

        const autor =
          item.autor?.trim() ?? "";

        const imagem =
          item.imagem ?? null;

        const criticaId =
          Number(item.criticaId);

        const possuiInteracao =
          Number.isInteger(
            criticaId,
          );

        const estatistica =
          possuiInteracao
            ? estatisticasPublicacoes[
                String(criticaId)
              ]
            : undefined;

        const quantidadeCurtidas =
          estatistica?.curtidas ??
          item.curtidas ??
          0;

        const quantidadeComentarios =
          estatistica?.comentarios ??
          item.comentarios ??
          0;

        const curtiu =
          estatistica?.curtiu ??
          item.curtiu ??
          false;

        const tipoNormalizado =
          normalizarTexto(
            item.tipo,
          );

        let legendaTipo =
          "Partilha";

        if (
          tipoNormalizado.includes(
            "critica",
          ) ||
          tipoNormalizado.includes(
            "review",
          )
        ) {
          legendaTipo =
            "Crítica de livro";
        } else if (
          tipoNormalizado.includes(
            "livro",
          )
        ) {
          legendaTipo =
            "Livro partilhado";
        }

        return (
          <View
            style={[
              styles.publicacaoSocial,
              {
                backgroundColor:
                  colors.card,
                borderBottomColor:
                  colors.background,
              },
            ]}
          >
            {/* CABEÇALHO */}

            <View
              style={
                styles.publicacaoHeader
              }
            >
              <Avatar
                size={46}
                foto={
                  usuario?.foto_perfil ??
                  null
                }
                nome={usuario?.nome}
                primaryDeep={
                  colors.primaryDeep
                }
                white={colors.white}
              />

              <View
                style={
                  styles.publicacaoMeta
                }
              >
                <Text
                  style={[
                    styles.publicacaoNome,
                    {
                      color:
                        colors.text,
                    },
                  ]}
                  numberOfLines={1}
                >
                  {usuario?.nome ||
                    "Utilizador"}
                </Text>

                <View
                  style={
                    styles.publicacaoDataRow
                  }
                >
                  <Text
                    style={[
                      styles.publicacaoLegenda,
                      {
                        color:
                          colors.secondary,
                      },
                    ]}
                  >
                    {legendaTipo}
                  </Text>

                  <Text
                    style={[
                      styles.publicacaoSeparator,
                      {
                        color:
                          colors.secondary,
                      },
                    ]}
                  >
                    ·
                  </Text>

                  <Text
                    style={[
                      styles.publicacaoLegenda,
                      {
                        color:
                          colors.secondary,
                      },
                    ]}
                  >
                    {formatarDataPublicacao(
                      item.criado_em,
                    )}
                  </Text>

                  <MaterialCommunityIcons
                    name="earth"
                    size={12}
                    color={
                      colors.secondary
                    }
                    style={{
                      marginLeft: 4,
                    }}
                  />
                </View>
              </View>

              <TouchableOpacity
                activeOpacity={0.7}
                style={
                  styles.postMoreButton
                }
              >
                <MaterialCommunityIcons
                  name="dots-horizontal"
                  size={21}
                  color={
                    colors.secondary
                  }
                />
              </TouchableOpacity>
            </View>

            {/* TEXTO */}

            {!!texto && (
              <Text
                style={[
                  styles.publicacaoTexto,
                  {
                    color:
                      colors.text,
                  },
                ]}
              >
                {texto}
              </Text>
            )}

            {/* LIVRO */}

            {(!!titulo || !!autor) && (
              <View
                style={[
                  styles.livroPublicacao,
                  {
                    backgroundColor:
                      colors.cardSecondary,
                    borderColor:
                      colors.border,
                  },
                ]}
              >
                <View
                  style={[
                    styles.livroPublicacaoIcon,
                    {
                      backgroundColor:
                        colors.primary,
                    },
                  ]}
                >
                  <LivroIcon
                    size={31}
                    color="#FFFFFF"
                    pageColor={
                      colors.primary
                    }
                  />
                </View>

                <View
                  style={
                    styles.livroPublicacaoInfo
                  }
                >
                  {!!titulo && (
                    <Text
                      style={[
                        styles.livroPublicacaoTitulo,
                        {
                          color:
                            colors.text,
                        },
                      ]}
                      numberOfLines={2}
                    >
                      {titulo}
                    </Text>
                  )}

                  {!!autor && (
                    <Text
                      style={[
                        styles.livroPublicacaoAutor,
                        {
                          color:
                            colors.secondary,
                        },
                      ]}
                      numberOfLines={1}
                    >
                      {autor}
                    </Text>
                  )}
                </View>
              </View>
            )}

            {/* IMAGEM */}

            {!!imagem && (
              <Image
                source={{
                  uri: imagem,
                }}
                style={
                  styles.publicacaoImagemSocial
                }
                resizeMode="cover"
                fadeDuration={0}
              />
            )}

            {/* ESTATÍSTICAS */}

            {possuiInteracao &&
              (quantidadeCurtidas > 0 ||
                quantidadeComentarios >
                  0) && (
                <View
                  style={[
                    styles.postStats,
                    {
                      borderBottomColor:
                        colors.border,
                    },
                  ]}
                >
                  <View
                    style={
                      styles.postLikeSummary
                    }
                  >
                    {quantidadeCurtidas >
                      0 && (
                      <View
                        style={[
                          styles.likeCircle,
                          {
                            backgroundColor:
                              colors.primary,
                          },
                        ]}
                      >
                        <MaterialCommunityIcons
                          name="heart"
                          size={10}
                          color="#FFFFFF"
                        />
                      </View>
                    )}

                    <Text
                      style={[
                        styles.postStatsText,
                        {
                          color:
                            colors.secondary,
                        },
                      ]}
                    >
                      {quantidadeCurtidas >
                      0
                        ? `${quantidadeCurtidas} ${
                            quantidadeCurtidas ===
                            1
                              ? "curtida"
                              : "curtidas"
                          }`
                        : ""}
                    </Text>
                  </View>

                  {quantidadeComentarios >
                    0 && (
                    <TouchableOpacity
                      activeOpacity={0.7}
                      onPress={() =>
                        void abrirComentarios(
                          item,
                        )
                      }
                    >
                      <Text
                        style={[
                          styles.postStatsText,
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
                  )}
                </View>
              )}

            {/* AÇÕES */}

            {possuiInteracao && (
              <View
                style={[
                  styles.postActions,
                  {
                    borderTopColor:
                      colors.border,
                  },
                ]}
              >
                <TouchableOpacity
                  activeOpacity={0.7}
                  onPress={() =>
                    void alternarCurtida(
                      item,
                    )
                  }
                  style={
                    styles.postAction
                  }
                >
                  <MaterialCommunityIcons
                    name={
                      curtiu
                        ? "heart"
                        : "heart-outline"
                    }
                    size={22}
                    color={
                      curtiu
                        ? colors.primary
                        : colors.secondary
                    }
                  />

                  <Text
                    style={[
                      styles.postActionText,
                      {
                        color:
                          curtiu
                            ? colors.primary
                            : colors.secondary,
                      },
                    ]}
                  >
                    Curtir
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  activeOpacity={0.7}
                  onPress={() =>
                    void abrirComentarios(
                      item,
                    )
                  }
                  style={
                    styles.postAction
                  }
                >
                  <MaterialCommunityIcons
                    name="comment-outline"
                    size={21}
                    color={
                      colors.secondary
                    }
                  />

                  <Text
                    style={[
                      styles.postActionText,
                      {
                        color:
                          colors.secondary,
                      },
                    ]}
                  >
                    Comentar
                  </Text>
                </TouchableOpacity>
              </View>
            )}
          </View>
        );
      },
      [
        colors,
        usuario,
        estatisticasPublicacoes,
        alternarCurtida,
        abrirComentarios,
      ],
    );

  /* =========================================================
     LIVRO LIDO
  ========================================================= */

  const renderLivro =
    useCallback(
      ({
        item,
      }: {
        item: LivroLido;
      }) => {
        const imagem =
          item.imagem ?? null;

        return (
          <View
            style={[
              styles.livroCard,
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
                styles.livroCapa,
                {
                  backgroundColor:
                    colors.primaryDeep,
                },
              ]}
            >
              {imagem ? (
                <Image
                  source={{
                    uri: imagem,
                  }}
                  style={
                    styles.livroImagem
                  }
                  resizeMode="cover"
                  fadeDuration={0}
                />
              ) : (
                <>
                  <LivroIcon
                    size={48}
                    color="#FFFFFF"
                    pageColor={
                      colors.primaryDeep
                    }
                  />

                  <Text
                    style={
                      styles.livroBookText
                    }
                  >
                    BOOK
                  </Text>
                </>
              )}
            </View>

            <View
              style={
                styles.livroInfo
              }
            >
              <Text
                style={[
                  styles.livroTitulo,
                  {
                    color:
                      colors.text,
                  },
                ]}
                numberOfLines={2}
              >
                {item.titulo ||
                  "Livro sem título"}
              </Text>

              <Text
                style={[
                  styles.livroAutor,
                  {
                    color:
                      colors.secondary,
                  },
                ]}
                numberOfLines={1}
              >
                {item.autor ||
                  "Autor não informado"}
              </Text>

              <View
                style={[
                  styles.lidoBadge,
                  {
                    backgroundColor:
                      colors.soft,
                  },
                ]}
              >
                <View
                  style={[
                    styles.lidoDot,
                    {
                      backgroundColor:
                        colors.primary,
                    },
                  ]}
                />

                <Text
                  style={[
                    styles.lidoText,
                    {
                      color:
                        colors.primaryDark,
                    },
                  ]}
                >
                  Lido
                </Text>
              </View>
            </View>
          </View>
        );
      },
      [colors],
    );

  const dadosAtuais =
    aba === "publicacoes"
      ? publicacoesUsuario
      : livrosLidos;

  /* =========================================================
     LOADING
  ========================================================= */

  if (
    carregando &&
    !usuario
  ) {
    return (
      <SafeAreaView
        style={[
          styles.safeArea,
          {
            backgroundColor:
              colors.background,
          },
        ]}
        edges={[
          "top",
          "left",
          "right",
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
          style={
            styles.loadingPage
          }
        >
          <View
            style={[
              styles.loadingIcon,
              {
                backgroundColor:
                  colors.primary,
              },
            ]}
          >
            <LivroIcon
              size={48}
              color="#FFFFFF"
              pageColor={
                colors.primary
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
            A carregar o seu perfil
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
            Estamos a preparar o
            seu espaço.
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
          backgroundColor:
            colors.background,
        },
      ]}
      edges={[
        "top",
        "left",
        "right",
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
          styles.container,
          {
            backgroundColor:
              colors.background,
          },
        ]}
      >
        {/* =================================================
            TOP BAR
        ================================================= */}

        <View
          style={styles.topBar}
        >
          <View>
            <Text
              style={[
                styles.eyebrow,
                {
                  color:
                    colors.primary,
                },
              ]}
            >
              MEU ESPAÇO
            </Text>

            <Text
              style={[
                styles.pageTitle,
                {
                  color:
                    colors.text,
                },
              ]}
            >
              Meu perfil
            </Text>
          </View>

          <TouchableOpacity
            style={[
              styles.menuButton,
              {
                backgroundColor:
                  colors.card,
              },
            ]}
            onPress={() =>
              setMenuVisible(true)
            }
            activeOpacity={0.8}
          >
            <MaterialCommunityIcons
              name="dots-horizontal"
              size={24}
              color={colors.text}
            />
          </TouchableOpacity>
        </View>

        <FlatList
          data={
            dadosAtuais as any[]
          }
          keyExtractor={(
            item,
            index,
          ) =>
            `${aba}-${String(
              item?.id ?? index,
            )}`
          }
          renderItem={
            aba === "publicacoes"
              ? (renderPublicacao as any)
              : (renderLivro as any)
          }
          showsVerticalScrollIndicator={
            false
          }
          contentContainerStyle={
            dadosAtuais.length === 0
              ? styles.listEmptyContent
              : styles.listContent
          }
          refreshControl={
            <RefreshControl
              refreshing={
                atualizando
              }
              onRefresh={
                atualizarPerfil
              }
              tintColor={
                colors.primary
              }
              colors={[
                colors.primary,
              ]}
            />
          }
          ListHeaderComponent={
            <View>
              {/* =================================================
                  PERFIL
              ================================================= */}

              <View
                style={[
                  styles.profileCard,
                  {
                    backgroundColor:
                      colors.card,
                    borderColor:
                      colors.border,
                  },
                ]}
              >
                <View
                  style={
                    styles.profileTop
                  }
                >
                  <View
                    style={[
                      styles.avatarWrapper,
                      {
                        borderColor:
                          colors.primary,
                        backgroundColor:
                          colors.card,
                      },
                    ]}
                  >
                    <Avatar
                      size={100}
                      foto={
                        usuario?.foto_perfil ??
                        null
                      }
                      nome={
                        usuario?.nome
                      }
                      primaryDeep={
                        colors.primaryDeep
                      }
                      white={
                        colors.white
                      }
                    />

                    <View
                      style={[
                        styles.onlineBadge,
                        {
                          backgroundColor:
                            colors.primary,
                          borderColor:
                            colors.card,
                        },
                      ]}
                    />
                  </View>

                  <View
                    style={
                      styles.profileInfo
                    }
                  >
                    <Text
                      style={[
                        styles.profileName,
                        {
                          color:
                            colors.text,
                        },
                      ]}
                      numberOfLines={2}
                    >
                      {usuario?.nome ||
                        "Utilizador"}
                    </Text>

                    <Text
                      style={[
                        styles.profileRole,
                        {
                          color:
                            colors.secondary,
                        },
                      ]}
                    >
                      Leitor BookNook
                    </Text>

                    <View
                      style={[
                        styles.activeBadge,
                        {
                          backgroundColor:
                            colors.soft,
                        },
                      ]}
                    >
                      <View
                        style={[
                          styles.activeDot,
                          {
                            backgroundColor:
                              colors.primary,
                          },
                        ]}
                      />

                      <Text
                        style={[
                          styles.activeText,
                          {
                            color:
                              colors.primaryDark,
                          },
                        ]}
                      >
                        Conta ativa
                      </Text>
                    </View>
                  </View>
                </View>

                {/* ESTATÍSTICAS */}

                <View
                  style={[
                    styles.statsContainer,
                    {
                      borderTopColor:
                        colors.border,
                    },
                  ]}
                >
                  {estatisticas.map(
                    (
                      estatistica,
                      index,
                    ) => (
                      <View
                        key={
                          estatistica.label
                        }
                        style={[
                          styles.statItem,
                          index !==
                            estatisticas.length -
                              1 && {
                              borderRightWidth: 1,
                              borderRightColor:
                                colors.border,
                            },
                        ]}
                      >
                        <Text
                          style={[
                            styles.statValue,
                            {
                              color:
                                colors.text,
                            },
                          ]}
                        >
                          {
                            estatistica.value
                          }
                        </Text>

                        <Text
                          style={[
                            styles.statLabel,
                            {
                              color:
                                colors.secondary,
                            },
                          ]}
                        >
                          {
                            estatistica.label
                          }
                        </Text>
                      </View>
                    ),
                  )}
                </View>
              </View>

              {/* =================================================
                  ABAS
              ================================================= */}

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
                <TouchableOpacity
                  activeOpacity={0.8}
                  onPress={() =>
                    setAba(
                      "publicacoes",
                    )
                  }
                  style={[
                    styles.tab,
                    aba ===
                      "publicacoes" && {
                      borderBottomColor:
                        colors.primary,
                      borderBottomWidth: 3,
                    },
                  ]}
                >
                  <MaterialCommunityIcons
                    name="post-outline"
                    size={21}
                    color={
                      aba ===
                      "publicacoes"
                        ? colors.primary
                        : colors.secondary
                    }
                  />

                  <Text
                    style={[
                      styles.tabText,
                      {
                        color:
                          aba ===
                          "publicacoes"
                            ? colors.primary
                            : colors.secondary,
                      },
                    ]}
                  >
                    Publicações
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  activeOpacity={0.8}
                  onPress={() =>
                    setAba("lidos")
                  }
                  style={[
                    styles.tab,
                    aba === "lidos" && {
                      borderBottomColor:
                        colors.primary,
                      borderBottomWidth: 3,
                    },
                  ]}
                >
                  <MaterialCommunityIcons
                    name="book-open-page-variant-outline"
                    size={22}
                    color={
                      aba === "lidos"
                        ? colors.primary
                        : colors.secondary
                    }
                  />

                  <Text
                    style={[
                      styles.tabText,
                      {
                        color:
                          aba ===
                          "lidos"
                            ? colors.primary
                            : colors.secondary,
                      },
                    ]}
                  >
                    Livros lidos
                  </Text>
                </TouchableOpacity>
              </View>

              {/* =================================================
                  TÍTULO
              ================================================= */}

              <View
                style={
                  styles.sectionHeader
                }
              >
                <View>
                  <Text
                    style={[
                      styles.sectionTitle,
                      {
                        color:
                          colors.text,
                      },
                    ]}
                  >
                    {aba ===
                    "publicacoes"
                      ? "As minhas publicações"
                      : "A minha biblioteca"}
                  </Text>

                  <Text
                    style={[
                      styles.sectionSubtitle,
                      {
                        color:
                          colors.secondary,
                      },
                    ]}
                  >
                    {aba ===
                    "publicacoes"
                      ? "Partilhas feitas por si."
                      : "Livros que já terminou de ler."}
                  </Text>
                </View>

                <View
                  style={[
                    styles.countBadge,
                    {
                      backgroundColor:
                        colors.soft,
                    },
                  ]}
                >
                  <Text
                    style={[
                      styles.countBadgeText,
                      {
                        color:
                          colors.primaryDark,
                      },
                    ]}
                  >
                    {
                      dadosAtuais.length
                    }
                  </Text>
                </View>
              </View>
            </View>
          }
          ListEmptyComponent={
            renderVazio
          }
          ListFooterComponent={
            dadosAtuais.length >
            0 ? (
              <View
                style={
                  styles.listFooter
                }
              />
            ) : null
          }
        />

        {/* =================================================
            MENU
        ================================================= */}

        <Modal
          transparent
          visible={
            menuVisible
          }
          animationType="fade"
          onRequestClose={() =>
            setMenuVisible(false)
          }
          statusBarTranslucent
        >
          <TouchableOpacity
            activeOpacity={1}
            style={
              styles.modalOverlay
            }
            onPress={() =>
              setMenuVisible(false)
            }
          >
            <TouchableOpacity
              activeOpacity={1}
              style={[
                styles.menuModal,
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
                  styles.menuModalHandle,
                  {
                    backgroundColor:
                      colors.border,
                  },
                ]}
              />

              <Text
                style={[
                  styles.menuModalTitle,
                  {
                    color:
                      colors.text,
                  },
                ]}
              >
                Configurações do perfil
              </Text>

              <TouchableOpacity
                style={[
                  styles.menuItem,
                  {
                    backgroundColor:
                      colors.cardSecondary,
                  },
                ]}
                onPress={
                  abrirEdicao
                }
                activeOpacity={0.8}
              >
                <View
                  style={[
                    styles.menuItemIcon,
                    {
                      backgroundColor:
                        colors.soft,
                    },
                  ]}
                >
                  <MaterialCommunityIcons
                    name="account-edit-outline"
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
                    Editar perfil
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
                    Alterar nome e foto
                  </Text>
                </View>

                <MaterialCommunityIcons
                  name="chevron-right"
                  size={22}
                  color={
                    colors.secondary
                  }
                />
              </TouchableOpacity>

              <TouchableOpacity
                style={[
                  styles.menuItem,
                  {
                    backgroundColor:
                      colors.dangerSoft,
                  },
                ]}
                onPress={
                  terminarSessao
                }
                activeOpacity={0.8}
              >
                <View
                  style={[
                    styles.menuItemIcon,
                    {
                      backgroundColor:
                        colors.card,
                    },
                  ]}
                >
                  <MaterialCommunityIcons
                    name="logout"
                    size={21}
                    color={
                      colors.danger
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
                          colors.danger,
                      },
                    ]}
                  >
                    Terminar sessão
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
                    Sair desta conta
                  </Text>
                </View>

                <MaterialCommunityIcons
                  name="chevron-right"
                  size={22}
                  color={
                    colors.danger
                  }
                />
              </TouchableOpacity>
            </TouchableOpacity>
          </TouchableOpacity>
        </Modal>

        {/* =================================================
            COMENTÁRIOS
        ================================================= */}

        <Modal
          transparent
          visible={
            comentariosVisible
          }
          animationType="slide"
          onRequestClose={
            fecharComentarios
          }
          statusBarTranslucent
        >
          <KeyboardAvoidingView
            style={
              styles.commentsOverlay
            }
            behavior={
              Platform.OS === "ios"
                ? "padding"
                : undefined
            }
          >
            <TouchableOpacity
              activeOpacity={1}
              style={
                styles.commentsBackground
              }
              onPress={
                fecharComentarios
              }
            />

            <View
              style={[
                styles.commentsSheet,
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
                  styles.commentsHandle,
                  {
                    backgroundColor:
                      colors.border,
                  },
                ]}
              />

              <View
                style={
                  styles.commentsHeader
                }
              >
                <View>
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
                  >
                    {
                      comentariosLista.length
                    }{" "}
                    {comentariosLista.length ===
                    1
                      ? "comentário"
                      : "comentários"}
                  </Text>
                </View>

                <TouchableOpacity
                  style={[
                    styles.commentsClose,
                    {
                      backgroundColor:
                        colors.soft,
                    },
                  ]}
                  onPress={
                    fecharComentarios
                  }
                  disabled={
                    enviandoComentario
                  }
                >
                  <MaterialCommunityIcons
                    name="close"
                    size={20}
                    color={
                      colors.text
                    }
                  />
                </TouchableOpacity>
              </View>

              {publicacaoSelecionada &&
                !!publicacaoSelecionada.texto && (
                  <View
                    style={[
                      styles.commentPostPreview,
                      {
                        backgroundColor:
                          colors.cardSecondary,
                        borderColor:
                          colors.border,
                      },
                    ]}
                  >
                    <Text
                      style={[
                        styles.commentPostPreviewText,
                        {
                          color:
                            colors.text,
                        },
                      ]}
                      numberOfLines={3}
                    >
                      {
                        publicacaoSelecionada.texto
                      }
                    </Text>
                  </View>
                )}

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
              ) : comentariosLista.length ===
                0 ? (
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
                          colors.soft,
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
                    Seja o primeiro a
                    comentar esta publicação.
                  </Text>
                </View>
              ) : (
                <FlatList
                  data={
                    comentariosLista
                  }
                  keyExtractor={(
                    item,
                  ) =>
                    String(
                      item.id,
                    )
                  }
                  showsVerticalScrollIndicator={
                    false
                  }
                  contentContainerStyle={
                    styles.commentsList
                  }
                  renderItem={({
                    item,
                  }) => {
                    const nome =
                      item.usuario
                        ?.nome ||
                      "Utilizador";

                    const foto =
                      item.usuario
                        ?.foto_perfil ??
                      null;

                    return (
                      <View
                        style={
                          styles.commentItem
                        }
                      >
                        <Avatar
                          size={40}
                          foto={foto}
                          nome={nome}
                          primaryDeep={
                            colors.primaryDeep
                          }
                          white={
                            colors.white
                          }
                        />

                        <View
                          style={[
                            styles.commentBubble,
                            {
                              backgroundColor:
                                colors.cardSecondary,
                            },
                          ]}
                        >
                          <View
                            style={
                              styles.commentAuthorRow
                            }
                          >
                            <Text
                              style={[
                                styles.commentAuthor,
                                {
                                  color:
                                    colors.text,
                                },
                              ]}
                            >
                              {nome}
                            </Text>

                            <Text
                              style={[
                                styles.commentDate,
                                {
                                  color:
                                    colors.secondary,
                                },
                              ]}
                            >
                              {formatarDataPublicacao(
                                item.createdAt,
                              )}
                            </Text>
                          </View>

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
                      </View>
                    );
                  }}
                />
              )}

              {/* INPUT */}

              <View
                style={[
                  styles.commentInputArea,
                  {
                    borderTopColor:
                      colors.border,
                    backgroundColor:
                      colors.card,
                  },
                ]}
              >
                <Avatar
                  size={38}
                  foto={
                    usuario?.foto_perfil ??
                    null
                  }
                  nome={usuario?.nome}
                  primaryDeep={
                    colors.primaryDeep
                  }
                  white={colors.white}
                />

                <TextInput
                  value={
                    comentarioTexto
                  }
                  onChangeText={
                    setComentarioTexto
                  }
                  placeholder="Escreva um comentário..."
                  placeholderTextColor={
                    colors.secondary
                  }
                  multiline
                  editable={
                    !enviandoComentario
                  }
                  style={[
                    styles.commentInput,
                    {
                      backgroundColor:
                        colors.input,
                      borderColor:
                        colors.border,
                      color:
                        colors.text,
                    },
                  ]}
                />

                <TouchableOpacity
                  activeOpacity={0.8}
                  onPress={() =>
                    void enviarComentario()
                  }
                  disabled={
                    enviandoComentario ||
                    !comentarioTexto.trim()
                  }
                  style={[
                    styles.sendCommentButton,
                    {
                      backgroundColor:
                        colors.primary,
                    },
                    (!comentarioTexto.trim() ||
                      enviandoComentario) &&
                      styles.sendCommentDisabled,
                  ]}
                >
                  {enviandoComentario ? (
                    <ActivityIndicator
                      size="small"
                      color="#FFFFFF"
                    />
                  ) : (
                    <MaterialCommunityIcons
                      name="send"
                      size={19}
                      color="#FFFFFF"
                    />
                  )}
                </TouchableOpacity>
              </View>
            </View>
          </KeyboardAvoidingView>
        </Modal>

        {/* =================================================
            EDITAR PERFIL
        ================================================= */}

        <Modal
          transparent
          visible={
            editModalVisible
          }
          animationType="slide"
          onRequestClose={() => {
            if (!salvando) {
              setEditModalVisible(
                false,
              );
            }
          }}
          statusBarTranslucent
        >
          <KeyboardAvoidingView
            style={
              styles.editOverlay
            }
            behavior={
              Platform.OS === "ios"
                ? "padding"
                : undefined
            }
          >
            <TouchableOpacity
              activeOpacity={1}
              style={
                styles.editBackground
              }
              onPress={() => {
                if (!salvando) {
                  setEditModalVisible(
                    false,
                  );
                }
              }}
            />

            <View
              style={[
                styles.editSheet,
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
                  styles.sheetHandle,
                  {
                    backgroundColor:
                      colors.border,
                  },
                ]}
              />

              <View
                style={
                  styles.editHeader
                }
              >
                <View>
                  <Text
                    style={[
                      styles.editTitle,
                      {
                        color:
                          colors.text,
                      },
                    ]}
                  >
                    Editar perfil
                  </Text>

                  <Text
                    style={[
                      styles.editSubtitle,
                      {
                        color:
                          colors.secondary,
                      },
                    ]}
                  >
                    Atualize os dados da sua conta.
                  </Text>
                </View>

                <TouchableOpacity
                  style={[
                    styles.closeButton,
                    {
                      backgroundColor:
                        colors.soft,
                    },
                  ]}
                  onPress={() => {
                    if (!salvando) {
                      setEditModalVisible(
                        false,
                      );
                    }
                  }}
                  disabled={
                    salvando
                  }
                >
                  <MaterialCommunityIcons
                    name="close"
                    size={21}
                    color={
                      colors.text
                    }
                  />
                </TouchableOpacity>
              </View>

              {/* FOTO */}

              <View
                style={
                  styles.photoSection
                }
              >
                <TouchableOpacity
                  activeOpacity={0.85}
                  onPress={
                    selecionarFoto
                  }
                  disabled={
                    salvando ||
                    selecionandoFoto
                  }
                  style={[
                    styles.editAvatarWrapper,
                    {
                      borderColor:
                        colors.primary,
                    },
                  ]}
                >
                  <Avatar
                    size={108}
                    foto={
                      fotoLocal ??
                      usuario?.foto_perfil ??
                      null
                    }
                    nome={
                      usuario?.nome
                    }
                    primaryDeep={
                      colors.primaryDeep
                    }
                    white={
                      colors.white
                    }
                  />

                  <View
                    style={[
                      styles.cameraBadge,
                      {
                        backgroundColor:
                          colors.primary,
                      },
                    ]}
                  >
                    <MaterialCommunityIcons
                      name="camera-plus"
                      size={16}
                      color="#FFFFFF"
                    />
                  </View>
                </TouchableOpacity>

                <TouchableOpacity
                  onPress={
                    selecionarFoto
                  }
                  disabled={
                    salvando ||
                    selecionandoFoto
                  }
                  activeOpacity={0.8}
                >
                  <Text
                    style={[
                      styles.changePhotoText,
                      {
                        color:
                          colors.primary,
                      },
                    ]}
                  >
                    {selecionandoFoto
                      ? "A selecionar..."
                      : "Alterar foto de perfil"}
                  </Text>
                </TouchableOpacity>
              </View>

              {/* NOME */}

              <View
                style={
                  styles.editField
                }
              >
                <Text
                  style={[
                    styles.editLabel,
                    {
                      color:
                        colors.text,
                    },
                  ]}
                >
                  Nome
                </Text>

                <TextInput
                  value={novoNome}
                  onChangeText={
                    setNovoNome
                  }
                  placeholder="Digite o seu nome"
                  placeholderTextColor={
                    colors.secondary
                  }
                  autoCapitalize="words"
                  autoCorrect={false}
                  editable={!salvando}
                  returnKeyType="done"
                  style={[
                    styles.editInput,
                    {
                      backgroundColor:
                        colors.input,
                      borderColor:
                        colors.border,
                      color:
                        colors.text,
                    },
                  ]}
                />
              </View>

              <TouchableOpacity
                activeOpacity={0.85}
                onPress={
                  salvarPerfil
                }
                disabled={
                  salvando
                }
                style={[
                  styles.saveButton,
                  {
                    backgroundColor:
                      colors.primary,
                  },
                  salvando &&
                    styles.saveButtonDisabled,
                ]}
              >
                {salvando ? (
                  <ActivityIndicator
                    size="small"
                    color="#FFFFFF"
                  />
                ) : (
                  <>
                    <MaterialCommunityIcons
                      name="check"
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
                  </>
                )}
              </TouchableOpacity>
            </View>
          </KeyboardAvoidingView>
        </Modal>
      </View>
    </SafeAreaView>
  );
}

/* ===========================================================
   ESTILOS
=========================================================== */

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
  },

  container: {
    flex: 1,
  },

  /* =========================================================
     TOP BAR
  ========================================================= */

  topBar: {
    minHeight: 68,
    paddingHorizontal: 16,
    paddingTop: 7,
    paddingBottom: 8,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },

  eyebrow: {
    fontSize: 10,
    fontWeight: "900",
    letterSpacing: 1.4,
    marginBottom: 2,
  },

  pageTitle: {
    fontSize: 25,
    fontWeight: "900",
    letterSpacing: -0.5,
  },

  menuButton: {
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: "center",
    justifyContent: "center",
  },

  menuDot: {
    width: 4,
    height: 4,
    borderRadius: 2,
  },

  /* =========================================================
     LISTA
  ========================================================= */

  listContent: {
    paddingHorizontal: 0,
    paddingBottom: 30,
  },

  listEmptyContent: {
    paddingHorizontal: 16,
    paddingBottom: 30,
  },

  /* =========================================================
     PERFIL
  ========================================================= */

  profileCard: {
    borderRadius: 0,
    borderWidth: 0,
    overflow: "hidden",
    marginBottom: 10,
  },

  profileTop: {
    paddingHorizontal: 18,
    paddingTop: 22,
    paddingBottom: 20,
    flexDirection: "row",
    alignItems: "center",
  },

  avatarWrapper: {
    width: 108,
    height: 108,
    borderRadius: 54,
    borderWidth: 3,
    alignItems: "center",
    justifyContent: "center",
    padding: 2,
  },

  avatarFallback: {
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  },

  avatarLetter: {
    fontWeight: "900",
  },

  onlineBadge: {
    position: "absolute",
    width: 19,
    height: 19,
    borderRadius: 10,
    right: 2,
    bottom: 7,
    borderWidth: 3,
  },

  profileInfo: {
    flex: 1,
    marginLeft: 16,
  },

  profileName: {
    fontSize: 23,
    fontWeight: "900",
    letterSpacing: -0.4,
  },

  profileRole: {
    fontSize: 14,
    marginTop: 4,
    fontWeight: "500",
  },

  activeBadge: {
    flexDirection: "row",
    alignItems: "center",
    alignSelf: "flex-start",
    paddingHorizontal: 9,
    paddingVertical: 5,
    borderRadius: 12,
    marginTop: 9,
  },

  activeDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
    marginRight: 6,
  },

  activeText: {
    fontSize: 11,
    fontWeight: "800",
  },

  statsContainer: {
    borderTopWidth: 1,
    flexDirection: "row",
  },

  statItem: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 14,
  },

  statValue: {
    fontSize: 19,
    fontWeight: "900",
  },

  statLabel: {
    fontSize: 11,
    marginTop: 3,
    fontWeight: "600",
  },

  /* =========================================================
     ABAS
  ========================================================= */

  tabsContainer: {
    minHeight: 58,
    borderRadius: 0,
    borderWidth: 0,
    borderBottomWidth: 1,
    padding: 0,
    flexDirection: "row",
    marginBottom: 16,
  },

  tab: {
    flex: 1,
    minHeight: 58,
    borderRadius: 0,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 7,
    gap: 7,
  },

  tabText: {
    fontSize: 13,
    fontWeight: "800",
  },

  /* =========================================================
     CABEÇALHO DA SECÇÃO
  ========================================================= */

  sectionHeader: {
    paddingHorizontal: 16,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 10,
  },

  sectionTitle: {
    fontSize: 18,
    fontWeight: "900",
  },

  sectionSubtitle: {
    fontSize: 12,
    marginTop: 3,
  },

  countBadge: {
    minWidth: 35,
    height: 35,
    paddingHorizontal: 9,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
  },

  countBadgeText: {
    fontSize: 13,
    fontWeight: "900",
  },

  /* =========================================================
     PUBLICAÇÕES
  ========================================================= */

  publicacaoSocial: {
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 4,
    borderBottomWidth: 8,
    marginBottom: 0,
  },

  publicacaoHeader: {
    flexDirection: "row",
    alignItems: "center",
  },

  publicacaoMeta: {
    flex: 1,
    marginLeft: 11,
  },

  publicacaoNome: {
    fontSize: 15,
    fontWeight: "800",
  },

  publicacaoDataRow: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 2,
  },

  publicacaoLegenda: {
    fontSize: 11,
  },

  publicacaoSeparator: {
    fontSize: 11,
    marginHorizontal: 4,
  },

  postMoreButton: {
    width: 36,
    height: 36,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 18,
  },

  publicacaoTexto: {
    fontSize: 15,
    lineHeight: 23,
    marginTop: 13,
    marginBottom: 12,
  },

  livroPublicacao: {
    minHeight: 74,
    borderWidth: 1,
    borderRadius: 12,
    flexDirection: "row",
    alignItems: "center",
    padding: 8,
    marginBottom: 11,
  },

  livroPublicacaoIcon: {
    width: 58,
    height: 58,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
  },

  livroPublicacaoInfo: {
    flex: 1,
    marginLeft: 11,
  },

  livroPublicacaoTitulo: {
    fontSize: 14,
    fontWeight: "900",
    lineHeight: 19,
  },

  livroPublicacaoAutor: {
    fontSize: 11,
    fontWeight: "600",
    marginTop: 3,
  },

  publicacaoImagemSocial: {
    width: "100%",
    height: 280,
    backgroundColor: "#E4E6EB",
  },

  postStats: {
    minHeight: 40,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    borderBottomWidth: 1,
  },

  postLikeSummary: {
    flexDirection: "row",
    alignItems: "center",
  },

  likeCircle: {
    width: 20,
    height: 20,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 6,
  },

  postStatsText: {
    fontSize: 11,
    fontWeight: "600",
  },

  postActions: {
    minHeight: 49,
    flexDirection: "row",
    alignItems: "center",
  },

  postAction: {
    flex: 1,
    height: 44,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 7,
  },

  postActionText: {
    fontSize: 12,
    fontWeight: "800",
  },

  /* =========================================================
     LIVROS
  ========================================================= */

  livroCard: {
    marginHorizontal: 16,
    borderRadius: 15,
    borderWidth: 1,
    padding: 12,
    marginBottom: 10,
    flexDirection: "row",
    minHeight: 142,
  },

  livroCapa: {
    width: 88,
    minHeight: 118,
    borderRadius: 9,
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  },

  livroImagem: {
    width: "100%",
    height: "100%",
    position: "absolute",
  },

  livroBookText: {
    color: "#FFFFFF",
    fontSize: 9,
    fontWeight: "900",
    letterSpacing: 1.2,
    marginTop: 4,
    opacity: 0.9,
  },

  livroInfo: {
    flex: 1,
    paddingHorizontal: 14,
    paddingVertical: 5,
  },

  livroTitulo: {
    fontSize: 16,
    lineHeight: 21,
    fontWeight: "900",
  },

  livroAutor: {
    fontSize: 12,
    marginTop: 5,
    fontWeight: "600",
  },

  lidoBadge: {
    flexDirection: "row",
    alignItems: "center",
    alignSelf: "flex-start",
    borderRadius: 10,
    paddingHorizontal: 9,
    paddingVertical: 5,
    marginTop: 12,
  },

  lidoDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    marginRight: 6,
  },

  lidoText: {
    fontSize: 10,
    fontWeight: "900",
  },

  /* =========================================================
     VAZIO
  ========================================================= */

  emptyCard: {
    borderRadius: 18,
    borderWidth: 1,
    padding: 28,
    alignItems: "center",
  },

  emptyIcon: {
    width: 78,
    height: 78,
    borderRadius: 25,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 17,
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
    height: 20,
  },

  /* =========================================================
     LOADING
  ========================================================= */

  loadingPage: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 30,
  },

  loadingIcon: {
    width: 82,
    height: 82,
    borderRadius: 27,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 24,
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

  /* =========================================================
     MENU
  ========================================================= */

  modalOverlay: {
    flex: 1,
    backgroundColor:
      "rgba(0,0,0,0.48)",
    justifyContent: "flex-end",
  },

  menuModal: {
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    borderWidth: 1,
    paddingHorizontal: 18,
    paddingTop: 10,
    paddingBottom:
      Platform.OS === "ios"
        ? 34
        : 22,
  },

  menuModalHandle: {
    width: 45,
    height: 4,
    borderRadius: 2,
    alignSelf: "center",
    marginBottom: 19,
  },

  menuModalTitle: {
    fontSize: 19,
    fontWeight: "900",
    marginBottom: 15,
  },

  menuItem: {
    minHeight: 72,
    borderRadius: 17,
    paddingHorizontal: 12,
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 10,
  },

  menuItemIcon: {
    width: 43,
    height: 43,
    borderRadius: 13,
    alignItems: "center",
    justifyContent: "center",
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
    fontSize: 11,
    marginTop: 3,
  },

  /* =========================================================
     COMENTÁRIOS
  ========================================================= */

  commentsOverlay: {
    flex: 1,
    justifyContent: "flex-end",
  },

  commentsBackground: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor:
      "rgba(0,0,0,0.52)",
  },

  commentsSheet: {
    height: "82%",
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    borderWidth: 1,
    paddingTop: 10,
  },

  commentsHandle: {
    width: 45,
    height: 4,
    borderRadius: 2,
    alignSelf: "center",
    marginBottom: 13,
  },

  commentsHeader: {
    paddingHorizontal: 18,
    paddingBottom: 13,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },

  commentsTitle: {
    fontSize: 20,
    fontWeight: "900",
  },

  commentsSubtitle: {
    fontSize: 11,
    marginTop: 3,
  },

  commentsClose: {
    width: 38,
    height: 38,
    borderRadius: 13,
    alignItems: "center",
    justifyContent: "center",
  },

  commentPostPreview: {
    marginHorizontal: 18,
    marginBottom: 8,
    padding: 11,
    borderWidth: 1,
    borderRadius: 12,
  },

  commentPostPreviewText: {
    fontSize: 12,
    lineHeight: 18,
  },

  commentsLoading: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },

  commentsLoadingText: {
    fontSize: 12,
    marginTop: 9,
  },

  commentsList: {
    paddingHorizontal: 18,
    paddingBottom: 12,
  },

  commentItem: {
    flexDirection: "row",
    alignItems: "flex-start",
    marginBottom: 13,
  },

  commentBubble: {
    flex: 1,
    marginLeft: 9,
    borderRadius: 16,
    paddingHorizontal: 12,
    paddingVertical: 9,
  },

  commentAuthorRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },

  commentAuthor: {
    fontSize: 12,
    fontWeight: "900",
    flex: 1,
  },

  commentDate: {
    fontSize: 9,
    marginLeft: 7,
  },

  commentText: {
    fontSize: 13,
    lineHeight: 19,
    marginTop: 4,
  },

  noComments: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 35,
  },

  noCommentsIcon: {
    width: 64,
    height: 64,
    borderRadius: 22,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 14,
  },

  noCommentsTitle: {
    fontSize: 15,
    fontWeight: "900",
    textAlign: "center",
  },

  noCommentsText: {
    fontSize: 12,
    lineHeight: 18,
    textAlign: "center",
    marginTop: 5,
  },

  commentInputArea: {
    minHeight: 70,
    borderTopWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 10,
    flexDirection: "row",
    alignItems: "center",
  },

  commentInput: {
    flex: 1,
    minHeight: 42,
    maxHeight: 90,
    borderWidth: 1,
    borderRadius: 21,
    paddingHorizontal: 14,
    paddingVertical: 9,
    fontSize: 13,
    marginLeft: 8,
  },

  sendCommentButton: {
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: "center",
    justifyContent: "center",
    marginLeft: 7,
  },

  sendCommentDisabled: {
    opacity: 0.45,
  },

  /* =========================================================
     EDITAR PERFIL
  ========================================================= */

  editOverlay: {
    flex: 1,
    justifyContent: "flex-end",
  },

  editBackground: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor:
      "rgba(0,0,0,0.5)",
  },

  editSheet: {
    borderTopLeftRadius: 30,
    borderTopRightRadius: 30,
    borderWidth: 1,
    paddingHorizontal: 20,
    paddingTop: 10,
    paddingBottom:
      Platform.OS === "ios"
        ? 35
        : 22,
  },

  sheetHandle: {
    width: 46,
    height: 4,
    borderRadius: 2,
    alignSelf: "center",
    marginBottom: 19,
  },

  editHeader: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
  },

  editTitle: {
    fontSize: 21,
    fontWeight: "900",
  },

  editSubtitle: {
    fontSize: 12,
    marginTop: 4,
  },

  closeButton: {
    width: 38,
    height: 38,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },

  photoSection: {
    alignItems: "center",
    marginTop: 22,
    marginBottom: 22,
  },

  editAvatarWrapper: {
    width: 116,
    height: 116,
    borderRadius: 58,
    borderWidth: 3,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 10,
  },

  cameraBadge: {
    position: "absolute",
    right: -1,
    bottom: 2,
    width: 33,
    height: 33,
    borderRadius: 17,
    borderWidth: 3,
    borderColor: "#FFFFFF",
    alignItems: "center",
    justifyContent: "center",
  },

  changePhotoText: {
    fontSize: 13,
    fontWeight: "900",
  },

  editField: {
    marginBottom: 18,
  },

  editLabel: {
    fontSize: 13,
    fontWeight: "800",
    marginBottom: 8,
    marginLeft: 2,
  },

  editInput: {
    minHeight: 54,
    borderWidth: 1,
    borderRadius: 15,
    paddingHorizontal: 15,
    fontSize: 15,
    fontWeight: "600",
  },

  saveButton: {
    minHeight: 55,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 2,
    flexDirection: "row",
    gap: 8,
  },

  saveButtonDisabled: {
    opacity: 0.65,
  },

  saveButtonText: {
    color: "#FFFFFF",
    fontSize: 15,
    fontWeight: "900",
  },
});

