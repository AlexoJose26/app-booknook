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
  Animated,
  Easing,
  Image,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
  useColorScheme
} from "react-native";

import { MaterialCommunityIcons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { useFocusEffect, useLocalSearchParams } from "expo-router";

import { useThemeCustom } from "@/contexts/ThemeContext";
import { useUsuario } from "@/contexts/UsuarioContext";
import { getDb } from "@/database/db";

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
} from "@/database/services/socialService";

import { desc, eq } from "drizzle-orm";

type Critica = {
  id: number;
  usuario_id: string;
  livro_id: string;
  texto: string;
  nota: number | null;
  createdAt: string;
  usuario_nome: string;
  usuario_foto: string | null;
};

type LivroCritica = {
  id: string;
  titulo: string;
  autor: string | null;
  imagem: string | null;
};

type LivroComCriticas = {
  livro: LivroCritica;
  criticas: Critica[];
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

type EstatisticaSocial = {
  curtidas: number;
  comentarios: number;
  curtiu: boolean;
};

type IconName = React.ComponentProps<
  typeof MaterialCommunityIcons
>["name"];

export default function Criticas({
  atualizarFeed,
}: {
  atualizarFeed?: () => void;
}) {
  const { usuario } = useUsuario();
  const { theme } = useThemeCustom();

  const params = useLocalSearchParams<{
    livroId?: string;
    titulo?: string;
  }>();

  const colorScheme = useColorScheme();
  const isDark = theme === "dark" || colorScheme === "dark";

  const [criticasPorLivro, setCriticasPorLivro] = useState<
    LivroComCriticas[]
  >([]);

  const [editando, setEditando] = useState(false);
  const [textoCritica, setTextoCritica] = useState("");
  const [nota, setNota] = useState<number | null>(null);

  const [criticaAtual, setCriticaAtual] =
    useState<Critica | null>(null);

  const [livroSelecionado, setLivroSelecionado] =
    useState<LivroCritica | null>(null);

  const [backupTexto, setBackupTexto] = useState("");
  const [backupNota, setBackupNota] =
    useState<number | null>(null);

  const [carregando, setCarregando] = useState(true);
  const [salvando, setSalvando] = useState(false);
  const [processandoExclusao, setProcessandoExclusao] =
    useState(false);

  const [livroParametroProcessado, setLivroParametroProcessado] =
    useState<string | null>(null);

  const [estatisticas, setEstatisticas] = useState<
    Record<number, EstatisticaSocial>
  >({});

  const [comentariosAbertos, setComentariosAbertos] =
    useState<Record<number, boolean>>({});

  const [comentarios, setComentarios] = useState<
    Record<number, Comentario[]>
  >({});

  const [comentarioTexto, setComentarioTexto] = useState<
    Record<number, string>
  >({});

  const [carregandoSocial, setCarregandoSocial] = useState<
    Record<number, boolean>
  >({});

  const [publicandoComentario, setPublicandoComentario] =
    useState<Record<number, boolean>>({});

  const animationForm = useRef(new Animated.Value(0)).current;

  const colors = useMemo(
    () =>
      isDark
        ? {
          background: "#0B1118",
          card: "#141B23",
          cardSecondary: "#19222D",
          text: "#F4F7FA",
          secondary: "#AAB7C5",
          primary: "#4B9BFF",
          primaryDark: "#1877F2",
          primaryDeep: "#0F5FCC",
          border: "#283442",
          input: "#10171F",
          inputBorder: "#334354",
          muted: "#172536",
          soft: "#17283B",
          white: "#FFFFFF",
          danger: "#EF6B6B",
          dangerSoft: "#351B1F",
          warning: "#F4C451",
          warningSoft: "#352D18",
          success: "#4B9BFF",
          successSoft: "#17283B",
        }
        : {
          background: "#F0F2F5",
          card: "#FFFFFF",
          cardSecondary: "#F7F9FC",
          text: "#1C1E21",
          secondary: "#65676B",
          primary: "#1877F2",
          primaryDark: "#166FE5",
          primaryDeep: "#0D65D9",
          border: "#DADDE1",
          input: "#F0F2F5",
          inputBorder: "#CCD0D5",
          muted: "#EAF2FB",
          soft: "#E7F3FF",
          white: "#FFFFFF",
          danger: "#D94B4B",
          dangerSoft: "#FDECEC",
          warning: "#D99700",
          warningSoft: "#FFF6D8",
          success: "#1877F2",
          successSoft: "#E7F3FF",
        },
    [isDark]
  );

  const carregarCriticas = useCallback(async () => {
    if (!usuario?.id) {
      setCriticasPorLivro([]);
      setCarregando(false);
      return;
    }

    try {
      setCarregando(true);

      const database = await getDb();

      const livrosLidos = await database
        .select({
          id: livros.id,
          titulo: livros.titulo,
          autor: livros.autor,
          imagem: livros.imagem,
          status: estantes.status,
        })
        .from(estantes)
        .innerJoin(
          livros,
          eq(estantes.livro_id, livros.id)
        )
        .where(eq(estantes.usuario_id, usuario.id));

      const livrosParaCriticar = livrosLidos.filter(
        (livro) => livro.status === "lido"
      );

      const resultados = await Promise.all(
        livrosParaCriticar.map(async (livro) => {
          try {
            const res = await database
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
              .leftJoin(
                usuarios,
                eq(usuarios.id, criticas.usuario_id)
              )
              .where(eq(criticas.livro_id, livro.id))
              .orderBy(desc(criticas.createdAt));

            const dadosComFoto: Critica[] = res.map((c) => ({
              ...c,
              nota: c.nota ?? null,
              usuario_nome: c.usuario_nome ?? "Usuário",
              usuario_foto: c.usuario_foto ?? null,
            }));

            return {
              livro: {
                id: livro.id,
                titulo: livro.titulo,
                autor: livro.autor ?? "Autor desconhecido",
                imagem: livro.imagem ?? null,
              },
              criticas: dadosComFoto,
            };
          } catch (error) {
            console.error(
              `Erro ao carregar críticas do livro ${livro.id}:`,
              error
            );

            return {
              livro: {
                id: livro.id,
                titulo: livro.titulo,
                autor: livro.autor ?? "Autor desconhecido",
                imagem: livro.imagem ?? null,
              },
              criticas: [],
            };
          }
        })
      );

      setCriticasPorLivro(resultados);

      const todasCriticas = resultados.flatMap(
        (item) => item.criticas
      );

      if (todasCriticas.length > 0) {
        const resultadosSocial = await Promise.all(
          todasCriticas.map(async (critica) => {
            try {
              const dados =
                await obterEstatisticasCritica(
                  critica.id,
                  usuario.id
                );

              return [critica.id, dados] as const;
            } catch (error) {
              console.error(
                `Erro ao carregar estatísticas da crítica ${critica.id}:`,
                error
              );

              return [
                critica.id,
                {
                  curtidas: 0,
                  comentarios: 0,
                  curtiu: false,
                },
              ] as const;
            }
          })
        );

        setEstatisticas(
          Object.fromEntries(resultadosSocial)
        );
      } else {
        setEstatisticas({});
      }
    } catch (error) {
      console.error("Erro ao carregar críticas:", error);

      Alert.alert(
        "Erro",
        "Não foi possível carregar os seus livros lidos."
      );

      setCriticasPorLivro([]);
      setEstatisticas({});
    } finally {
      setCarregando(false);
    }
  }, [usuario?.id]);

  useFocusEffect(
    useCallback(() => {
      carregarCriticas();
    }, [carregarCriticas])
  );

  const atualizarEstatisticaLocal = useCallback(
    (
      criticaId: number,
      atualizacao: Partial<EstatisticaSocial>
    ) => {
      setEstatisticas((anterior) => ({
        ...anterior,
        [criticaId]: {
          curtidas:
            anterior[criticaId]?.curtidas ?? 0,
          comentarios:
            anterior[criticaId]?.comentarios ?? 0,
          curtiu:
            anterior[criticaId]?.curtiu ?? false,
          ...atualizacao,
        },
      }));
    },
    []
  );

  const carregarComentarios = useCallback(
    async (criticaId: number) => {
      if (!usuario?.id) return;

      try {
        setCarregandoSocial((anterior) => ({
          ...anterior,
          [criticaId]: true,
        }));

        const lista =
          await listarComentarios(criticaId);

        setComentarios((anterior) => ({
          ...anterior,
          [criticaId]: lista as Comentario[],
        }));

        const dados =
          await obterEstatisticasCritica(
            criticaId,
            usuario.id
          );

        atualizarEstatisticaLocal(
          criticaId,
          dados
        );
      } catch (error) {
        console.error(
          `Erro ao carregar comentários da crítica ${criticaId}:`,
          error
        );

        Alert.alert(
          "Erro",
          "Não foi possível carregar os comentários."
        );
      } finally {
        setCarregandoSocial((anterior) => ({
          ...anterior,
          [criticaId]: false,
        }));
      }
    },
    [
      usuario?.id,
      atualizarEstatisticaLocal,
    ]
  );

  const alternarComentarios = useCallback(
    async (criticaId: number) => {
      const aberto =
        comentariosAbertos[criticaId] ?? false;

      setComentariosAbertos((anterior) => ({
        ...anterior,
        [criticaId]: !aberto,
      }));

      if (!aberto) {
        await carregarComentarios(criticaId);
      }
    },
    [
      comentariosAbertos,
      carregarComentarios,
    ]
  );

  const curtirCritica = useCallback(
    async (criticaId: number) => {
      if (!usuario?.id) return;

      const atual =
        estatisticas[criticaId] ?? {
          curtidas: 0,
          comentarios: 0,
          curtiu: false,
        };

      setCarregandoSocial((anterior) => ({
        ...anterior,
        [criticaId]: true,
      }));

      setEstatisticas((anterior) => ({
        ...anterior,
        [criticaId]: {
          ...atual,
          curtiu: !atual.curtiu,
          curtidas: Math.max(
            0,
            atual.curtidas +
            (atual.curtiu ? -1 : 1)
          ),
        },
      }));

      try {
        const curtiu =
          await toggleCurtida(
            usuario.id,
            criticaId
          );

        const dados =
          await obterEstatisticasCritica(
            criticaId,
            usuario.id
          );

        setEstatisticas((anterior) => ({
          ...anterior,
          [criticaId]: {
            curtidas: dados.curtidas,
            comentarios: dados.comentarios,
            curtiu:
              typeof curtiu === "boolean"
                ? curtiu
                : dados.curtiu,
          },
        }));

        atualizarFeed?.();
      } catch (error) {
        console.error(
          `Erro ao curtir crítica ${criticaId}:`,
          error
        );

        setEstatisticas((anterior) => ({
          ...anterior,
          [criticaId]: atual,
        }));

        Alert.alert(
          "Erro",
          "Não foi possível atualizar a curtida."
        );
      } finally {
        setCarregandoSocial((anterior) => ({
          ...anterior,
          [criticaId]: false,
        }));
      }
    },
    [
      usuario?.id,
      estatisticas,
      atualizarFeed,
    ]
  );

  const publicarComentario = useCallback(
    async (criticaId: number) => {
      if (!usuario?.id) return;

      const texto =
        comentarioTexto[criticaId]?.trim() ?? "";

      if (!texto) {
        return;
      }

      if (texto.length < 1) {
        return;
      }

      try {
        setPublicandoComentario((anterior) => ({
          ...anterior,
          [criticaId]: true,
        }));

        const novoComentario =
          await criarComentario(
            usuario.id,
            criticaId,
            texto
          );

        setComentarios((anterior) => ({
          ...anterior,
          [criticaId]: [
            novoComentario as Comentario,
            ...(anterior[criticaId] ?? []),
          ],
        }));

        setComentarioTexto((anterior) => ({
          ...anterior,
          [criticaId]: "",
        }));

        const dados =
          await obterEstatisticasCritica(
            criticaId,
            usuario.id
          );

        atualizarEstatisticaLocal(
          criticaId,
          dados
        );

        atualizarFeed?.();
      } catch (error) {
        console.error(
          `Erro ao publicar comentário na crítica ${criticaId}:`,
          error
        );

        Alert.alert(
          "Erro",
          "Não foi possível publicar o comentário."
        );
      } finally {
        setPublicandoComentario((anterior) => ({
          ...anterior,
          [criticaId]: false,
        }));
      }
    },
    [
      usuario?.id,
      comentarioTexto,
      atualizarEstatisticaLocal,
      atualizarFeed,
    ]
  );

  const animarFormulario = useCallback(() => {
    animationForm.setValue(0);

    Animated.timing(animationForm, {
      toValue: 1,
      duration: 360,
      easing: Easing.out(Easing.ease),
      useNativeDriver: true,
    }).start();
  }, [animationForm]);

  const selecionarCritica = useCallback(
    (livroId: string) => {
      const livroData = criticasPorLivro.find(
        (item) => item.livro.id === livroId
      );

      if (!livroData) return;

      setLivroSelecionado(livroData.livro);

      const minhaCritica =
        livroData.criticas.find(
          (c) => c.usuario_id === usuario?.id
        ) ?? null;

      setCriticaAtual(minhaCritica);

      setTextoCritica(minhaCritica?.texto ?? "");
      setNota(minhaCritica?.nota ?? null);

      setBackupTexto(
        minhaCritica?.texto ?? ""
      );
      setBackupNota(
        minhaCritica?.nota ?? null
      );

      setEditando(true);

      animarFormulario();
    },
    [
      criticasPorLivro,
      usuario?.id,
      animarFormulario,
    ]
  );

  useEffect(() => {
    const livroId = Array.isArray(params.livroId)
      ? params.livroId[0]
      : params.livroId;

    if (
      !livroId ||
      livroParametroProcessado === livroId ||
      criticasPorLivro.length === 0
    ) {
      return;
    }

    const livroExiste = criticasPorLivro.some(
      (item) => item.livro.id === livroId
    );

    if (livroExiste) {
      setLivroParametroProcessado(livroId);
      selecionarCritica(livroId);
    }
  }, [
    params.livroId,
    criticasPorLivro,
    livroParametroProcessado,
    selecionarCritica,
  ]);

  const fecharEdicao = useCallback(() => {
    setTextoCritica(backupTexto);
    setNota(backupNota);

    setCriticaAtual(null);
    setLivroSelecionado(null);
    setEditando(false);

    animationForm.setValue(0);
  }, [
    backupTexto,
    backupNota,
    animationForm,
  ]);

  const publicarNoFeed = useCallback(
    async (
      livroId: string,
      criticaId: number,
      agora: string
    ) => {
      try {
        const database = await getDb();

        const feedExistente = await database
          .select({
            id: feed.id,
          })
          .from(feed)
          .where(
            eq(feed.critica_id, criticaId)
          )
          .limit(1);

        if (feedExistente.length === 0) {
          await database.insert(feed).values({
            usuario_id: usuario!.id,
            tipo: "critica",
            livro_id: livroId,
            critica_id: criticaId,
            createdAt: agora,
          });
        }
      } catch (error) {
        console.error(
          "Erro ao publicar crítica no feed:",
          error
        );

        throw error;
      }
    },
    [usuario]
  );

  const salvarCritica = useCallback(async () => {
    if (
      !usuario ||
      !livroSelecionado ||
      salvando
    ) {
      return;
    }

    const textoLimpo =
      textoCritica.trim();

    if (!textoLimpo) {
      Alert.alert(
        "Crítica incompleta",
        "Escreva sua opinião antes de publicar."
      );
      return;
    }

    if (nota === null) {
      Alert.alert(
        "Avaliação incompleta",
        "Selecione uma nota de 1 a 5 estrelas."
      );
      return;
    }

    if (textoLimpo.length < 5) {
      Alert.alert(
        "Crítica muito curta",
        "Escreva pelo menos algumas palavras para compartilhar uma opinião útil."
      );
      return;
    }

    try {
      setSalvando(true);

      const agora =
        new Date().toISOString();

      const database = await getDb();

      if (criticaAtual) {
        await database
          .update(criticas)
          .set({
            texto: textoLimpo,
            nota,
            createdAt: agora,
          })
          .where(
            eq(
              criticas.id,
              criticaAtual.id
            )
          );

        await publicarNoFeed(
          livroSelecionado.id,
          criticaAtual.id,
          agora
        );

        Alert.alert(
          "Crítica atualizada",
          "Sua crítica foi atualizada com sucesso."
        );
      } else {
        const resultado = await database
          .insert(criticas)
          .values({
            usuario_id: usuario.id,
            livro_id: livroSelecionado.id,
            texto: textoLimpo,
            nota,
            createdAt: agora,
          })
          .returning({
            id: criticas.id,
          });

        const novaCriticaId =
          resultado[0]?.id;

        if (!novaCriticaId) {
          throw new Error(
            "Não foi possível obter o ID da nova crítica."
          );
        }

        await publicarNoFeed(
          livroSelecionado.id,
          novaCriticaId,
          agora
        );

        Alert.alert(
          "Crítica publicada",
          "Sua crítica foi publicada e já está disponível no feed da comunidade."
        );
      }

      setTextoCritica("");
      setNota(null);
      setCriticaAtual(null);
      setLivroSelecionado(null);
      setEditando(false);

      animationForm.setValue(0);

      await carregarCriticas();

      atualizarFeed?.();
    } catch (error) {
      console.error(
        "Erro ao salvar/publicar crítica:",
        error
      );

      Alert.alert(
        "Não foi possível publicar",
        "Ocorreu um erro ao guardar sua crítica. Verifique novamente e tente publicar."
      );
    } finally {
      setSalvando(false);
    }
  }, [
    usuario,
    livroSelecionado,
    salvando,
    textoCritica,
    nota,
    criticaAtual,
    publicarNoFeed,
    carregarCriticas,
    atualizarFeed,
    animationForm,
  ]);

  const deletarCritica = useCallback(
    (critica: Critica) => {
      if (processandoExclusao) return;

      Alert.alert(
        "Eliminar crítica",
        "Tem certeza de que deseja eliminar esta crítica? A publicação correspondente também será removida do feed.",
        [
          {
            text: "Cancelar",
            style: "cancel",
          },
          {
            text: "Eliminar",
            style: "destructive",
            onPress: async () => {
              try {
                setProcessandoExclusao(
                  true
                );

                const database = await getDb();

                await database
                  .delete(criticas)
                  .where(
                    eq(
                      criticas.id,
                      critica.id
                    )
                  );

                if (
                  criticaAtual?.id ===
                  critica.id
                ) {
                  setCriticaAtual(null);
                  setLivroSelecionado(null);
                  setTextoCritica("");
                  setNota(null);
                  setEditando(false);
                }

                setEstatisticas(
                  (anterior) => {
                    const copia = {
                      ...anterior,
                    };

                    delete copia[critica.id];

                    return copia;
                  }
                );

                setComentarios(
                  (anterior) => {
                    const copia = {
                      ...anterior,
                    };

                    delete copia[critica.id];

                    return copia;
                  }
                );

                await carregarCriticas();

                atualizarFeed?.();
              } catch (error) {
                console.error(
                  "Erro ao eliminar crítica:",
                  error
                );

                Alert.alert(
                  "Erro",
                  "Não foi possível eliminar a crítica."
                );
              } finally {
                setProcessandoExclusao(
                  false
                );
              }
            },
          },
        ]
      );
    },
    [
      criticaAtual?.id,
      carregarCriticas,
      atualizarFeed,
      processandoExclusao,
    ]
  );

  const getAvatar = useCallback(
    (critica: Critica) => {
      if (
        critica.usuario_id ===
        usuario?.id
      ) {
        return usuario.foto_perfil;
      }

      return critica.usuario_foto;
    },
    [usuario]
  );

  const getInitial = useCallback(
    (nome?: string | null) => {
      if (!nome?.trim()) return "U";

      return nome
        .trim()
        .charAt(0)
        .toUpperCase();
    },
    []
  );

  const getComentarioAvatar = useCallback(
    (comentario: Comentario) => {
      if (
        comentario.usuario_id ===
        usuario?.id
      ) {
        return usuario.foto_perfil;
      }

      return (
        comentario.usuario
          ?.foto_perfil ?? null
      );
    },
    [usuario]
  );

  const getComentarioNome = useCallback(
    (comentario: Comentario) => {
      if (
        comentario.usuario_id ===
        usuario?.id
      ) {
        return usuario.nome;
      }

      return (
        comentario.usuario?.nome ??
        "Usuário"
      );
    },
    [usuario]
  );

  const formatarData = useCallback(
    (data: string) => {
      try {
        return new Date(
          data
        ).toLocaleString("pt-PT", {
          day: "2-digit",
          month: "short",
          year: "numeric",
          hour: "2-digit",
          minute: "2-digit",
        });
      } catch {
        return data;
      }
    },
    []
  );

  const formatarDataCurta = useCallback(
    (data: string) => {
      try {
        return new Date(
          data
        ).toLocaleDateString("pt-PT", {
          day: "2-digit",
          month: "short",
          year: "numeric",
        });
      } catch {
        return data;
      }
    },
    []
  );

  const textoNota = useCallback(
    (valor: number) => {
      if (valor === 5) return "Excelente";
      if (valor === 4) return "Muito bom";
      if (valor === 3) return "Bom";
      if (valor === 2) return "Regular";
      return "Fraco";
    },
    []
  );

  const livrosComCriticas = useMemo(
    () =>
      criticasPorLivro.filter(
        (item) =>
          item.criticas.length > 0
      ).length,
    [criticasPorLivro]
  );

  const totalCriticas = useMemo(
    () =>
      criticasPorLivro.reduce(
        (total, item) =>
          total +
          item.criticas.length,
        0
      ),
    [criticasPorLivro]
  );

  const totalCurtidas = useMemo(
    () =>
      Object.values(
        estatisticas
      ).reduce(
        (total, item) =>
          total + item.curtidas,
        0
      ),
    [estatisticas]
  );

  const translateYForm =
    animationForm.interpolate({
      inputRange: [0, 1],
      outputRange: [45, 0],
    });

  const opacityForm =
    animationForm.interpolate({
      inputRange: [0, 1],
      outputRange: [0, 1],
    });

  if (!usuario || carregando) {
    return (
      <View
        style={[
          styles.loading,
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
                colors.soft,
            },
          ]}
        >
          <MaterialCommunityIcons
            name="comment-text-outline"
            size={30}
            color={colors.primary}
          />
        </View>

        <ActivityIndicator
          size="small"
          color={colors.primary}
          style={styles.loadingSpinner}
        />

        <Text
          style={[
            styles.loadingTitle,
            {
              color: colors.text,
            },
          ]}
        >
          Preparando suas críticas
        </Text>

        <Text
          style={[
            styles.loadingSubtitle,
            {
              color: colors.secondary,
            },
          ]}
        >
          Carregando seus livros lidos...
        </Text>
      </View>
    );
  }

  return (
    <View
      style={[
        styles.screen,
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

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={
          styles.container
        }
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.header}>
          <View style={styles.headerTextArea}>
            <View
              style={[
                styles.headerEyebrow,
                {
                  backgroundColor:
                    colors.soft,
                  borderColor:
                    colors.border,
                },
              ]}
            >
              <MaterialCommunityIcons
                name="account-group-outline"
                size={12}
                color={colors.primary}
                style={{
                  marginRight: 5,
                }}
              />

              <Text
                style={[
                  styles.headerEyebrowText,
                  {
                    color:
                      colors.primary,
                  },
                ]}
              >
                COMUNIDADE
              </Text>
            </View>

            <Text
              style={[
                styles.pageTitle,
                {
                  color: colors.text,
                },
              ]}
            >
              Minhas críticas
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
              Compartilhe suas opiniões
              sobre os livros que já leu.
            </Text>
          </View>

          <View
            style={[
              styles.headerIcon,
              {
                backgroundColor:
                  colors.primary,
              },
            ]}
          >
            <MaterialCommunityIcons
              name="comment-quote-outline"
              size={29}
              color="#FFFFFF"
            />
          </View>
        </View>

        <View style={styles.statsRow}>
          <View
            style={[
              styles.statCard,
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
                styles.statIcon,
                {
                  backgroundColor:
                    colors.soft,
                },
              ]}
            >
              <MaterialCommunityIcons
                name="book-open-page-variant-outline"
                size={20}
                color={colors.primary}
              />
            </View>

            <View>
              <Text
                style={[
                  styles.statValue,
                  {
                    color: colors.text,
                  },
                ]}
              >
                {criticasPorLivro.length}
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
                Livros lidos
              </Text>
            </View>
          </View>

          <View
            style={[
              styles.statCard,
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
                styles.statIcon,
                {
                  backgroundColor:
                    colors.warningSoft,
                },
              ]}
            >
              <MaterialCommunityIcons
                name="star-outline"
                size={21}
                color={colors.warning}
              />
            </View>

            <View>
              <Text
                style={[
                  styles.statValue,
                  {
                    color: colors.text,
                  },
                ]}
              >
                {totalCriticas}
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
                Críticas
              </Text>
            </View>
          </View>

          <View
            style={[
              styles.statCard,
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
                styles.statIcon,
                {
                  backgroundColor:
                    colors.soft,
                },
              ]}
            >
              <MaterialCommunityIcons
                name="heart-outline"
                size={21}
                color={colors.primary}
              />
            </View>

            <View>
              <Text
                style={[
                  styles.statValue,
                  {
                    color: colors.text,
                  },
                ]}
              >
                {totalCurtidas}
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
                Curtidas
              </Text>
            </View>
          </View>
        </View>

        <LinearGradient
          colors={
            isDark
              ? ["#1557A8", "#103B73"]
              : ["#1877F2", "#0D65D9"]
          }
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={
            styles.communityBanner
          }
        >
          <View
            style={
              styles.communityBannerIcon
            }
          >
            <MaterialCommunityIcons
              name="message-text-outline"
              size={21}
              color="#FFFFFF"
            />
          </View>

          <View
            style={
              styles.communityBannerContent
            }
          >
            <Text
              style={
                styles.communityBannerTitle
              }
            >
              Sua opinião importa
            </Text>

            <Text
              style={
                styles.communityBannerText
              }
            >
              Avalie os livros que você já
              terminou e interaja com outros
              leitores através de curtidas e
              comentários.
            </Text>
          </View>

          <MaterialCommunityIcons
            name="chevron-right"
            size={23}
            color="rgba(255,255,255,0.8)"
          />
        </LinearGradient>

        <View
          style={styles.sectionHeader}
        >
          <View>
            <Text
              style={[
                styles.sectionTitle,
                {
                  color: colors.text,
                },
              ]}
            >
              Seus livros
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
              Avalie e acompanhe suas
              opiniões
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
                    colors.primary,
                },
              ]}
            >
              {livrosComCriticas}
            </Text>
          </View>
        </View>

        {criticasPorLivro.length === 0 && (
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
              <MaterialCommunityIcons
                name="book-open-blank-variant"
                size={30}
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
              Nenhum livro lido ainda
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
              Quando você marcar um livro
              como lido, poderá publicar sua
              primeira crítica aqui.
            </Text>
          </View>
        )}

        {criticasPorLivro.map(
          (livroData) => {
            const minhaCritica =
              livroData.criticas.find(
                (c) =>
                  c.usuario_id ===
                  usuario.id
              );

            const formularioAberto =
              livroSelecionado?.id ===
              livroData.livro.id &&
              editando;

            return (
              <View
                key={livroData.livro.id}
                style={
                  styles.bookSection
                }
              >
                <View
                  style={[
                    styles.bookHeaderCard,
                    {
                      backgroundColor:
                        colors.card,
                      borderColor:
                        colors.border,
                    },
                  ]}
                >
                  {livroData.livro
                    .imagem ? (
                    <Image
                      source={{
                        uri: livroData
                          .livro.imagem,
                      }}
                      style={
                        styles.bookCover
                      }
                      resizeMode="cover"
                    />
                  ) : (
                    <View
                      style={[
                        styles.bookCoverPlaceholder,
                        {
                          backgroundColor:
                            colors.soft,
                        },
                      ]}
                    >
                      <MaterialCommunityIcons
                        name="book-open-page-variant-outline"
                        size={28}
                        color={
                          colors.primary
                        }
                      />
                    </View>
                  )}

                  <View
                    style={styles.bookInfo}
                  >
                    <View
                      style={[
                        styles.bookTag,
                        {
                          backgroundColor:
                            colors.soft,
                        },
                      ]}
                    >
                      <MaterialCommunityIcons
                        name="check-circle-outline"
                        size={10}
                        color={
                          colors.primary
                        }
                        style={{
                          marginRight: 4,
                        }}
                      />

                      <Text
                        style={[
                          styles.bookTagText,
                          {
                            color:
                              colors.primary,
                          },
                        ]}
                      >
                        LIVRO LIDO
                      </Text>
                    </View>

                    <Text
                      style={[
                        styles.bookTitle,
                        {
                          color:
                            colors.text,
                        },
                      ]}
                      numberOfLines={2}
                    >
                      {
                        livroData.livro
                          .titulo
                      }
                    </Text>

                    <Text
                      style={[
                        styles.bookAuthor,
                        {
                          color:
                            colors.secondary,
                        },
                      ]}
                      numberOfLines={1}
                    >
                      {
                        livroData.livro
                          .autor
                      }
                    </Text>
                  </View>
                </View>

                {formularioAberto && (
                  <Animated.View
                    style={{
                      transform: [
                        {
                          translateY:
                            translateYForm,
                        },
                      ],
                      opacity:
                        opacityForm,
                    }}
                  >
                    <LinearGradient
                      colors={
                        isDark
                          ? [
                            "#172E49",
                            "#141B23",
                          ]
                          : [
                            "#EAF3FF",
                            "#FFFFFF",
                          ]
                      }
                      style={[
                        styles.form,
                        {
                          borderColor:
                            colors.border,
                        },
                      ]}
                    >
                      <View
                        style={
                          styles.formHeader
                        }
                      >
                        <View
                          style={{
                            flex: 1,
                          }}
                        >
                          <Text
                            style={[
                              styles.formTitle,
                              {
                                color:
                                  colors.text,
                              },
                            ]}
                          >
                            {criticaAtual
                              ? "Editar sua crítica"
                              : "Escrever uma crítica"}
                          </Text>

                          <Text
                            style={[
                              styles.formSubtitle,
                              {
                                color:
                                  colors.secondary,
                              },
                            ]}
                          >
                            Compartilhe sua
                            experiência com
                            outros leitores.
                          </Text>
                        </View>

                        <TouchableOpacity
                          onPress={
                            fecharEdicao
                          }
                          style={[
                            styles.closeButton,
                            {
                              backgroundColor:
                                colors.card,
                              borderColor:
                                colors.border,
                            },
                          ]}
                          activeOpacity={
                            0.8
                          }
                        >
                          <MaterialCommunityIcons
                            name="close"
                            size={19}
                            color={
                              colors.secondary
                            }
                          />
                        </TouchableOpacity>
                      </View>

                      <Text
                        style={[
                          styles.inputLabel,
                          {
                            color:
                              colors.text,
                          },
                        ]}
                      >
                        Sua opinião
                      </Text>

                      <TextInput
                        placeholder="O que você achou deste livro?"
                        placeholderTextColor={
                          colors.secondary
                        }
                        value={
                          textoCritica
                        }
                        onChangeText={
                          setTextoCritica
                        }
                        multiline
                        maxLength={1000}
                        textAlignVertical="top"
                        editable={!salvando}
                        style={[
                          styles.textarea,
                          {
                            color:
                              colors.text,
                            backgroundColor:
                              colors.input,
                            borderColor:
                              colors.inputBorder,
                          },
                        ]}
                      />

                      <View
                        style={
                          styles.characterCounter
                        }
                      >
                        <Text
                          style={{
                            color:
                              colors.secondary,
                            fontSize: 9,
                            fontWeight:
                              "700",
                          }}
                        >
                          {
                            textoCritica.length
                          }
                          /1000
                        </Text>
                      </View>

                      <View
                        style={
                          styles.ratingHeader
                        }
                      >
                        <Text
                          style={[
                            styles.inputLabel,
                            {
                              color:
                                colors.text,
                            },
                          ]}
                        >
                          Sua avaliação
                        </Text>

                        {nota !== null && (
                          <View
                            style={[
                              styles.ratingValue,
                              {
                                backgroundColor:
                                  colors.warningSoft,
                              },
                            ]}
                          >
                            <Text
                              style={[
                                styles.ratingValueText,
                                {
                                  color:
                                    colors.warning,
                                },
                              ]}
                            >
                              {nota}/5 ·{" "}
                              {textoNota(
                                nota
                              )}
                            </Text>
                          </View>
                        )}
                      </View>

                      <View
                        style={
                          styles.starsContainer
                        }
                      >
                        {[1, 2, 3, 4, 5].map(
                          (i) => {
                            const selecionada =
                              i <=
                              (nota ?? 0);

                            return (
                              <TouchableOpacity
                                key={i}
                                onPress={() =>
                                  !salvando &&
                                  setNota(i)
                                }
                                activeOpacity={
                                  0.7
                                }
                                style={[
                                  styles.starButton,
                                  {
                                    backgroundColor:
                                      selecionada
                                        ? colors.warningSoft
                                        : colors.input,
                                    borderColor:
                                      selecionada
                                        ? "#E8C65A"
                                        : colors.border,
                                  },
                                ]}
                              >
                                <MaterialCommunityIcons
                                  name={
                                    selecionada
                                      ? "star"
                                      : "star-outline"
                                  }
                                  size={23}
                                  color={
                                    selecionada
                                      ? colors.warning
                                      : colors.secondary
                                  }
                                />
                              </TouchableOpacity>
                            );
                          }
                        )}
                      </View>

                      <View
                        style={
                          styles.formActions
                        }
                      >
                        <TouchableOpacity
                          style={[
                            styles.primaryButton,
                            {
                              backgroundColor:
                                salvando
                                  ? colors.secondary
                                  : colors.primary,
                            },
                          ]}
                          onPress={
                            salvarCritica
                          }
                          disabled={
                            salvando
                          }
                          activeOpacity={
                            0.85
                          }
                        >
                          {salvando ? (
                            <ActivityIndicator
                              size="small"
                              color="#FFFFFF"
                            />
                          ) : (
                            <>
                              <MaterialCommunityIcons
                                name={
                                  criticaAtual
                                    ? "content-save-edit-outline"
                                    : "send-outline"
                                }
                                size={16}
                                color="#FFFFFF"
                                style={{
                                  marginRight: 7,
                                }}
                              />

                              <Text
                                style={
                                  styles.primaryButtonText
                                }
                              >
                                {criticaAtual
                                  ? "Atualizar crítica"
                                  : "Publicar crítica"}
                              </Text>
                            </>
                          )}
                        </TouchableOpacity>

                        {criticaAtual && (
                          <TouchableOpacity
                            style={[
                              styles.secondaryDangerButton,
                              {
                                backgroundColor:
                                  colors.dangerSoft,
                                borderColor:
                                  colors.danger,
                              },
                            ]}
                            onPress={() =>
                              deletarCritica(
                                criticaAtual
                              )
                            }
                            disabled={
                              processandoExclusao ||
                              salvando
                            }
                            activeOpacity={
                              0.85
                            }
                          >
                            <MaterialCommunityIcons
                              name="trash-can-outline"
                              size={17}
                              color={
                                colors.danger
                              }
                            />
                          </TouchableOpacity>
                        )}
                      </View>
                    </LinearGradient>
                  </Animated.View>
                )}

                <View
                  style={
                    styles.reviewSectionHeader
                  }
                >
                  <View
                    style={
                      styles.reviewSectionTitleArea
                    }
                  >
                    <View
                      style={[
                        styles.reviewIcon,
                        {
                          backgroundColor:
                            colors.soft,
                        },
                      ]}
                    >
                      <MaterialCommunityIcons
                        name="comment-text-outline"
                        size={17}
                        color={
                          colors.primary
                        }
                      />
                    </View>

                    <View>
                      <Text
                        style={[
                          styles.reviewSectionTitle,
                          {
                            color:
                              colors.text,
                          },
                        ]}
                      >
                        Críticas da comunidade
                      </Text>

                      <Text
                        style={[
                          styles.reviewSectionSubtitle,
                          {
                            color:
                              colors.secondary,
                          },
                        ]}
                      >
                        {livroData.criticas
                          .length === 1
                          ? "1 opinião publicada"
                          : `${livroData.criticas.length} opiniões publicadas`}
                      </Text>
                    </View>
                  </View>
                </View>

                {livroData.criticas.map(
                  (c) => {
                    const avatar =
                      getAvatar(c);

                    const isMinha =
                      c.usuario_id ===
                      usuario.id;

                    const social =
                      estatisticas[
                      c.id
                      ] ?? {
                        curtidas: 0,
                        comentarios: 0,
                        curtiu: false,
                      };

                    const comentariosDaCritica =
                      comentarios[
                      c.id
                      ] ?? [];

                    const comentariosVisiveis =
                      comentariosAbertos[
                      c.id
                      ] ?? false;

                    const processandoSocial =
                      carregandoSocial[
                      c.id
                      ] ?? false;

                    const enviandoComentario =
                      publicandoComentario[
                      c.id
                      ] ?? false;

                    return (
                      <View
                        key={c.id}
                        style={[
                          styles.cardCritica,
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
                            styles.usuarioRow
                          }
                        >
                          {avatar ? (
                            <Image
                              source={{
                                uri: avatar,
                              }}
                              style={
                                styles.avatar
                              }
                            />
                          ) : (
                            <View
                              style={[
                                styles.avatar,
                                styles.avatarFallback,
                                {
                                  backgroundColor:
                                    colors.soft,
                                  borderColor:
                                    colors.border,
                                },
                              ]}
                            >
                              <Text
                                style={[
                                  styles.avatarInitial,
                                  {
                                    color:
                                      colors.primary,
                                  },
                                ]}
                              >
                                {getInitial(
                                  isMinha
                                    ? usuario.nome
                                    : c.usuario_nome
                                )}
                              </Text>
                            </View>
                          )}

                          <View
                            style={
                              styles.userInfo
                            }
                          >
                            <View
                              style={
                                styles.userNameRow
                              }
                            >
                              <Text
                                style={[
                                  styles.usuarioNome,
                                  {
                                    color:
                                      colors.text,
                                  },
                                ]}
                                numberOfLines={
                                  1
                                }
                              >
                                {isMinha
                                  ? usuario.nome
                                  : c.usuario_nome}
                              </Text>

                              {isMinha && (
                                <View
                                  style={[
                                    styles.meBadge,
                                    {
                                      backgroundColor:
                                        colors.soft,
                                    },
                                  ]}
                                >
                                  <Text
                                    style={[
                                      styles.meBadgeText,
                                      {
                                        color:
                                          colors.primary,
                                      },
                                    ]}
                                  >
                                    VOCÊ
                                  </Text>
                                </View>
                              )}
                            </View>

                            <Text
                              style={[
                                styles.postMeta,
                                {
                                  color:
                                    colors.secondary,
                                },
                              ]}
                            >
                              publicou uma
                              crítica ·{" "}
                              {formatarData(
                                c.createdAt
                              )}
                            </Text>
                          </View>

                          <TouchableOpacity
                            style={[
                              styles.postMoreButton,
                              {
                                backgroundColor:
                                  colors.input,
                              },
                            ]}
                            activeOpacity={
                              0.75
                            }
                          >
                            <MaterialCommunityIcons
                              name="dots-horizontal"
                              size={19}
                              color={
                                colors.secondary
                              }
                            />
                          </TouchableOpacity>
                        </View>

                        <View
                          style={
                            styles.ratingRow
                          }
                        >
                          <View
                            style={[
                              styles.ratingBadge,
                              {
                                backgroundColor:
                                  colors.warningSoft,
                                borderColor:
                                  isDark
                                    ? "#665520"
                                    : "#F0D67A",
                              },
                            ]}
                          >
                            <MaterialCommunityIcons
                              name="star"
                              size={12}
                              color={
                                colors.warning
                              }
                              style={{
                                marginRight: 5,
                              }}
                            />

                            <Text
                              style={[
                                styles.ratingNumber,
                                {
                                  color:
                                    colors.warning,
                                },
                              ]}
                            >
                              {c.nota ??
                                0}
                              /5
                            </Text>
                          </View>

                          <Text
                            style={[
                              styles.ratingDescription,
                              {
                                color:
                                  colors.secondary,
                              },
                            ]}
                          >
                            {textoNota(
                              c.nota ?? 0
                            )}
                          </Text>
                        </View>

                        <View
                          style={[
                            styles.quoteBox,
                            {
                              backgroundColor:
                                colors.cardSecondary,
                              borderLeftColor:
                                colors.primary,
                            },
                          ]}
                        >
                          <MaterialCommunityIcons
                            name="format-quote-open"
                            size={22}
                            color={
                              colors.primary
                            }
                            style={
                              styles.quoteIcon
                            }
                          />

                          <Text
                            style={[
                              styles.textoCritica,
                              {
                                color:
                                  colors.text,
                              },
                            ]}
                          >
                            {c.texto}
                          </Text>
                        </View>

                        {(social.curtidas >
                          0 ||
                          social.comentarios >
                          0) && (
                            <View
                              style={[
                                styles.socialSummary,
                                {
                                  borderBottomColor:
                                    colors.border,
                                },
                              ]}
                            >
                              {social.curtidas >
                                0 && (
                                  <View
                                    style={
                                      styles.likeSummary
                                    }
                                  >
                                    <View
                                      style={[
                                        styles.likeIcon,
                                        {
                                          backgroundColor:
                                            colors.primary,
                                        },
                                      ]}
                                    >
                                      <MaterialCommunityIcons
                                        name="thumb-up"
                                        size={10}
                                        color="#FFFFFF"
                                      />
                                    </View>

                                    <Text
                                      style={[
                                        styles.socialSummaryText,
                                        {
                                          color:
                                            colors.secondary,
                                        },
                                      ]}
                                    >
                                      {social.curtidas ===
                                        1
                                        ? "1 curtida"
                                        : `${social.curtidas} curtidas`}
                                    </Text>
                                  </View>
                                )}

                              {social.comentarios >
                                0 && (
                                  <TouchableOpacity
                                    onPress={() =>
                                      alternarComentarios(
                                        c.id
                                      )
                                    }
                                    activeOpacity={
                                      0.7
                                    }
                                  >
                                    <Text
                                      style={[
                                        styles.commentSummaryText,
                                        {
                                          color:
                                            colors.secondary,
                                        },
                                      ]}
                                    >
                                      {social.comentarios ===
                                        1
                                        ? "1 comentário"
                                        : `${social.comentarios} comentários`}
                                    </Text>
                                  </TouchableOpacity>
                                )}
                            </View>
                          )}

                        <View
                          style={[
                            styles.socialActions,
                            {
                              borderTopColor:
                                colors.border,
                            },
                          ]}
                        >
                          <TouchableOpacity
                            style={[
                              styles.facebookAction,
                              social.curtiu && {
                                backgroundColor:
                                  colors.soft,
                              },
                            ]}
                            onPress={() =>
                              curtirCritica(
                                c.id
                              )
                            }
                            disabled={
                              processandoSocial
                            }
                            activeOpacity={
                              0.7
                            }
                          >
                            {processandoSocial &&
                              social.curtiu ? (
                              <ActivityIndicator
                                size="small"
                                color={
                                  colors.primary
                                }
                              />
                            ) : (
                              <MaterialCommunityIcons
                                name={
                                  social.curtiu
                                    ? "thumb-up"
                                    : "thumb-up-outline"
                                }
                                size={19}
                                color={
                                  social.curtiu
                                    ? colors.primary
                                    : colors.secondary
                                }
                              />
                            )}

                            <Text
                              style={[
                                styles.socialActionText,
                                {
                                  color:
                                    social.curtiu
                                      ? colors.primary
                                      : colors.secondary,
                                  fontWeight:
                                    social.curtiu
                                      ? "900"
                                      : "700",
                                },
                              ]}
                            >
                              Curtir
                            </Text>
                          </TouchableOpacity>

                          <TouchableOpacity
                            style={[
                              styles.facebookAction,
                              comentariosVisiveis && {
                                backgroundColor:
                                  colors.soft,
                              },
                            ]}
                            onPress={() =>
                              alternarComentarios(
                                c.id
                              )
                            }
                            activeOpacity={
                              0.7
                            }
                          >
                            <MaterialCommunityIcons
                              name={
                                comentariosVisiveis
                                  ? "comment"
                                  : "comment-outline"
                              }
                              size={19}
                              color={
                                comentariosVisiveis
                                  ? colors.primary
                                  : colors.secondary
                              }
                            />

                            <Text
                              style={[
                                styles.socialActionText,
                                {
                                  color:
                                    comentariosVisiveis
                                      ? colors.primary
                                      : colors.secondary,
                                },
                              ]}
                            >
                              Comentar
                            </Text>
                          </TouchableOpacity>
                        </View>

                        {comentariosVisiveis && (
                          <View
                            style={[
                              styles.commentsArea,
                              {
                                borderTopColor:
                                  colors.border,
                              },
                            ]}
                          >
                            <View
                              style={
                                styles.commentInputRow
                              }
                            >
                              {usuario.foto_perfil ? (
                                <Image
                                  source={{
                                    uri: usuario.foto_perfil,
                                  }}
                                  style={
                                    styles.commentAvatar
                                  }
                                />
                              ) : (
                                <View
                                  style={[
                                    styles.commentAvatar,
                                    styles.commentAvatarFallback,
                                    {
                                      backgroundColor:
                                        colors.soft,
                                    },
                                  ]}
                                >
                                  <Text
                                    style={[
                                      styles.commentAvatarText,
                                      {
                                        color:
                                          colors.primary,
                                      },
                                    ]}
                                  >
                                    {getInitial(
                                      usuario.nome
                                    )}
                                  </Text>
                                </View>
                              )}

                              <View
                                style={[
                                  styles.commentInputContainer,
                                  {
                                    backgroundColor:
                                      colors.input,
                                    borderColor:
                                      colors.inputBorder,
                                  },
                                ]}
                              >
                                <TextInput
                                  value={
                                    comentarioTexto[
                                    c.id
                                    ] ?? ""
                                  }
                                  onChangeText={(
                                    texto
                                  ) =>
                                    setComentarioTexto(
                                      (
                                        anterior
                                      ) => ({
                                        ...anterior,
                                        [c.id]:
                                          texto,
                                      })
                                    )
                                  }
                                  placeholder="Escreva um comentário..."
                                  placeholderTextColor={
                                    colors.secondary
                                  }
                                  multiline
                                  maxLength={
                                    500
                                  }
                                  editable={
                                    !enviandoComentario
                                  }
                                  style={[
                                    styles.commentInput,
                                    {
                                      color:
                                        colors.text,
                                    },
                                  ]}
                                />

                                <TouchableOpacity
                                  onPress={() =>
                                    publicarComentario(
                                      c.id
                                    )
                                  }
                                  disabled={
                                    enviandoComentario ||
                                    !(
                                      comentarioTexto[
                                      c.id
                                      ] ?? ""
                                    ).trim()
                                  }
                                  style={[
                                    styles.commentSendButton,
                                    {
                                      backgroundColor:
                                        (
                                          comentarioTexto[
                                          c.id
                                          ] ?? ""
                                        ).trim()
                                          ? colors.primary
                                          : colors.border,
                                    },
                                  ]}
                                  activeOpacity={
                                    0.8
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
                                      size={17}
                                      color={
                                        (
                                          comentarioTexto[
                                          c.id
                                          ] ?? ""
                                        ).trim()
                                          ? "#FFFFFF"
                                          : colors.secondary
                                      }
                                    />
                                  )}
                                </TouchableOpacity>
                              </View>
                            </View>

                            {carregandoSocial[
                              c.id
                            ] ? (
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
                                  Carregando
                                  comentários...
                                </Text>
                              </View>
                            ) : comentariosDaCritica.length >
                              0 ? (
                              <View
                                style={
                                  styles.commentsList
                                }
                              >
                                {comentariosDaCritica.map(
                                  (
                                    comentario
                                  ) => {
                                    const avatarComentario =
                                      getComentarioAvatar(
                                        comentario
                                      );

                                    return (
                                      <View
                                        key={
                                          comentario.id
                                        }
                                        style={
                                          styles.commentItem
                                        }
                                      >
                                        {avatarComentario ? (
                                          <Image
                                            source={{
                                              uri: avatarComentario,
                                            }}
                                            style={
                                              styles.commentAvatar
                                            }
                                          />
                                        ) : (
                                          <View
                                            style={[
                                              styles.commentAvatar,
                                              styles.commentAvatarFallback,
                                              {
                                                backgroundColor:
                                                  colors.soft,
                                              },
                                            ]}
                                          >
                                            <Text
                                              style={[
                                                styles.commentAvatarText,
                                                {
                                                  color:
                                                    colors.primary,
                                                },
                                              ]}
                                            >
                                              {getInitial(
                                                getComentarioNome(
                                                  comentario
                                                )
                                              )}
                                            </Text>
                                          </View>
                                        )}

                                        <View
                                          style={[
                                            styles.commentBubble,
                                            {
                                              backgroundColor:
                                                colors.input,
                                            },
                                          ]}
                                        >
                                          <View
                                            style={
                                              styles.commentHeader
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
                                              numberOfLines={
                                                1
                                              }
                                            >
                                              {getComentarioNome(
                                                comentario
                                              )}
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
                                              {formatarDataCurta(
                                                comentario.createdAt
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
                                            {
                                              comentario.texto
                                            }
                                          </Text>
                                        </View>
                                      </View>
                                    );
                                  }
                                )}
                              </View>
                            ) : (
                              <View
                                style={
                                  styles.noComments
                                }
                              >
                                <MaterialCommunityIcons
                                  name="comment-outline"
                                  size={20}
                                  color={
                                    colors.secondary
                                  }
                                />

                                <Text
                                  style={[
                                    styles.noCommentsText,
                                    {
                                      color:
                                        colors.secondary,
                                    },
                                  ]}
                                >
                                  Ainda não há
                                  comentários.
                                  Seja o
                                  primeiro a
                                  comentar.
                                </Text>
                              </View>
                            )}
                          </View>
                        )}

                        {isMinha &&
                          !editando && (
                            <View
                              style={
                                styles.botoesRow
                              }
                            >
                              <TouchableOpacity
                                style={[
                                  styles.updateButton,
                                  {
                                    backgroundColor:
                                      colors.soft,
                                    borderColor:
                                      colors.border,
                                  },
                                ]}
                                onPress={() =>
                                  selecionarCritica(
                                    livroData
                                      .livro
                                      .id
                                  )
                                }
                                activeOpacity={
                                  0.8
                                }
                              >
                                <MaterialCommunityIcons
                                  name="pencil-outline"
                                  size={15}
                                  color={
                                    colors.primary
                                  }
                                  style={{
                                    marginRight: 6,
                                  }}
                                />

                                <Text
                                  style={[
                                    styles.updateButtonText,
                                    {
                                      color:
                                        colors.primary,
                                    },
                                  ]}
                                >
                                  Editar
                                </Text>
                              </TouchableOpacity>

                              <TouchableOpacity
                                style={[
                                  styles.deleteButton,
                                  {
                                    backgroundColor:
                                      colors.dangerSoft,
                                    borderColor:
                                      colors.danger,
                                  },
                                ]}
                                onPress={() =>
                                  deletarCritica(
                                    c
                                  )
                                }
                                activeOpacity={
                                  0.8
                                }
                              >
                                <MaterialCommunityIcons
                                  name="trash-can-outline"
                                  size={17}
                                  color={
                                    colors.danger
                                  }
                                  style={{
                                    marginRight: 5,
                                  }}
                                />

                                <Text
                                  style={[
                                    styles.deleteButtonText,
                                    {
                                      color:
                                        colors.danger,
                                    },
                                  ]}
                                >
                                  Eliminar
                                </Text>
                              </TouchableOpacity>
                            </View>
                          )}
                      </View>
                    );
                  }
                )}

                {!minhaCritica &&
                  !formularioAberto && (
                    <TouchableOpacity
                      style={[
                        styles.addReviewButton,
                        {
                          backgroundColor:
                            colors.primary,
                          shadowColor:
                            colors.primary,
                        },
                      ]}
                      onPress={() =>
                        selecionarCritica(
                          livroData.livro.id
                        )
                      }
                      activeOpacity={
                        0.85
                      }
                    >
                      <View
                        style={
                          styles.addReviewIcon
                        }
                      >
                        <MaterialCommunityIcons
                          name="plus"
                          size={25}
                          color="#FFFFFF"
                        />
                      </View>

                      <View
                        style={
                          styles.addReviewContent
                        }
                      >
                        <Text
                          style={
                            styles.addReviewTitle
                          }
                        >
                          Adicionar sua crítica
                        </Text>

                        <Text
                          style={
                            styles.addReviewSubtitle
                          }
                        >
                          Conte à comunidade o
                          que achou deste livro
                        </Text>
                      </View>

                      <MaterialCommunityIcons
                        name="chevron-right"
                        size={27}
                        color="#FFFFFF"
                      />
                    </TouchableOpacity>
                  )}
              </View>
            );
          }
        )}

        {criticasPorLivro.length > 0 && (
          <View style={styles.footer}>
            <View
              style={[
                styles.footerIcon,
                {
                  backgroundColor:
                    colors.soft,
                },
              ]}
            >
              <MaterialCommunityIcons
                name="check"
                size={15}
                color={colors.primary}
              />
            </View>

            <Text
              style={[
                styles.footerText,
                {
                  color:
                    colors.secondary,
                },
              ]}
            >
              Continue lendo e compartilhando
              suas descobertas com a comunidade
              BookNook.
            </Text>
          </View>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
  },

  container: {
    padding: 16,
    paddingBottom: 48,
  },

  loading: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 32,
  },

  loadingIcon: {
    width: 68,
    height: 68,
    borderRadius: 22,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 15,
  },

  loadingSpinner: {
    marginBottom: 12,
  },

  loadingTitle: {
    fontSize: 18,
    fontWeight: "800",
    marginBottom: 6,
  },

  loadingSubtitle: {
    fontSize: 14,
  },

  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 20,
  },

  headerTextArea: {
    flex: 1,
    paddingRight: 16,
  },

  headerEyebrow: {
    alignSelf: "flex-start",
    borderRadius: 20,
    borderWidth: 1,
    paddingHorizontal: 10,
    paddingVertical: 6,
    marginBottom: 10,
    flexDirection: "row",
    alignItems: "center",
  },

  headerEyebrowText: {
    fontSize: 10,
    fontWeight: "900",
    letterSpacing: 1,
  },

  pageTitle: {
    fontSize: 28,
    fontWeight: "900",
    letterSpacing: -0.7,
    marginBottom: 6,
  },

  pageSubtitle: {
    fontSize: 14,
    lineHeight: 21,
  },

  headerIcon: {
    width: 62,
    height: 62,
    borderRadius: 22,
    alignItems: "center",
    justifyContent: "center",
  },

  statsRow: {
    flexDirection: "row",
    gap: 8,
    marginBottom: 16,
  },

  statCard: {
    flex: 1,
    minHeight: 82,
    borderRadius: 18,
    borderWidth: 1,
    padding: 10,
    flexDirection: "row",
    alignItems: "center",
  },

  statIcon: {
    width: 40,
    height: 40,
    borderRadius: 13,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 7,
  },

  statValue: {
    fontSize: 19,
    fontWeight: "900",
    marginBottom: 2,
  },

  statLabel: {
    fontSize: 10,
    fontWeight: "600",
  },

  communityBanner: {
    borderRadius: 21,
    padding: 17,
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 28,
  },

  communityBannerIcon: {
    width: 46,
    height: 46,
    borderRadius: 15,
    backgroundColor:
      "rgba(255,255,255,0.13)",
    alignItems: "center",
    justifyContent: "center",
    marginRight: 13,
  },

  communityBannerContent: {
    flex: 1,
  },

  communityBannerTitle: {
    color: "#FFFFFF",
    fontSize: 15,
    fontWeight: "900",
    marginBottom: 3,
  },

  communityBannerText: {
    color: "rgba(255,255,255,0.8)",
    fontSize: 12,
    lineHeight: 18,
  },

  sectionHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 14,
  },

  sectionTitle: {
    fontSize: 21,
    fontWeight: "900",
    letterSpacing: -0.3,
  },

  sectionSubtitle: {
    fontSize: 12,
    marginTop: 3,
  },

  countBadge: {
    minWidth: 38,
    height: 32,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 10,
  },

  countBadgeText: {
    fontSize: 13,
    fontWeight: "900",
  },

  emptyCard: {
    borderRadius: 22,
    borderWidth: 1,
    padding: 28,
    alignItems: "center",
    marginBottom: 24,
  },

  emptyIcon: {
    width: 66,
    height: 66,
    borderRadius: 22,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 14,
  },

  emptyTitle: {
    fontSize: 18,
    fontWeight: "900",
    marginBottom: 7,
    textAlign: "center",
  },

  emptyText: {
    fontSize: 13,
    lineHeight: 20,
    textAlign: "center",
    maxWidth: 300,
  },

  bookSection: {
    marginBottom: 28,
  },

  bookHeaderCard: {
    borderRadius: 21,
    borderWidth: 1,
    padding: 14,
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 12,
  },

  bookCover: {
    width: 60,
    height: 74,
    borderRadius: 15,
    marginRight: 14,
    backgroundColor: "#E5E7EB",
  },

  bookCoverPlaceholder: {
    width: 60,
    height: 74,
    borderRadius: 15,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 14,
  },

  bookInfo: {
    flex: 1,
  },

  bookTag: {
    alignSelf: "flex-start",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    marginBottom: 6,
    flexDirection: "row",
    alignItems: "center",
  },

  bookTagText: {
    fontSize: 9,
    fontWeight: "900",
    letterSpacing: 0.8,
  },

  bookTitle: {
    fontSize: 18,
    lineHeight: 23,
    fontWeight: "900",
    marginBottom: 4,
  },

  bookAuthor: {
    fontSize: 13,
  },

  form: {
    borderRadius: 22,
    borderWidth: 1,
    padding: 17,
    marginBottom: 18,
  },

  formHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 18,
  },

  formTitle: {
    fontSize: 18,
    fontWeight: "900",
    marginBottom: 4,
  },

  formSubtitle: {
    fontSize: 12,
    lineHeight: 18,
    maxWidth: 280,
  },

  closeButton: {
    width: 34,
    height: 34,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },

  inputLabel: {
    fontSize: 12,
    fontWeight: "800",
    marginBottom: 8,
  },

  textarea: {
    minHeight: 120,
    borderWidth: 1,
    borderRadius: 16,
    paddingHorizontal: 14,
    paddingVertical: 13,
    fontSize: 14,
    lineHeight: 21,
    marginBottom: 3,
  },

  characterCounter: {
    alignItems: "flex-end",
    marginBottom: 13,
    paddingRight: 3,
  },

  ratingHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },

  ratingValue: {
    paddingHorizontal: 9,
    paddingVertical: 5,
    borderRadius: 9,
    marginBottom: 8,
  },

  ratingValueText: {
    fontSize: 10,
    fontWeight: "900",
  },

  starsContainer: {
    flexDirection: "row",
    gap: 8,
    marginBottom: 18,
  },

  starButton: {
    width: 48,
    height: 46,
    borderRadius: 14,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },

  formActions: {
    flexDirection: "row",
    gap: 9,
  },

  primaryButton: {
    flex: 1,
    minHeight: 48,
    borderRadius: 14,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 12,
  },

  primaryButtonText: {
    color: "#FFFFFF",
    fontSize: 13,
    fontWeight: "900",
  },

  secondaryDangerButton: {
    minHeight: 48,
    minWidth: 52,
    borderRadius: 14,
    borderWidth: 1,
    paddingHorizontal: 15,
    alignItems: "center",
    justifyContent: "center",
  },

  reviewSectionHeader: {
    marginTop: 3,
    marginBottom: 10,
  },

  reviewSectionTitleArea: {
    flexDirection: "row",
    alignItems: "center",
  },

  reviewIcon: {
    width: 38,
    height: 38,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 10,
  },

  reviewSectionTitle: {
    fontSize: 15,
    fontWeight: "900",
  },

  reviewSectionSubtitle: {
    fontSize: 11,
    marginTop: 2,
  },

  cardCritica: {
    borderRadius: 21,
    borderWidth: 1,
    padding: 16,
    marginBottom: 10,
  },

  usuarioRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 14,
  },

  avatar: {
    width: 43,
    height: 43,
    borderRadius: 15,
  },

  avatarFallback: {
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },

  avatarInitial: {
    fontSize: 17,
    fontWeight: "900",
  },

  userInfo: {
    flex: 1,
    marginLeft: 10,
  },

  userNameRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 2,
  },

  usuarioNome: {
    fontSize: 14,
    fontWeight: "900",
    maxWidth: "72%",
  },

  meBadge: {
    paddingHorizontal: 6,
    paddingVertical: 3,
    borderRadius: 6,
    marginLeft: 6,
  },

  meBadgeText: {
    fontSize: 8,
    fontWeight: "900",
  },

  postMeta: {
    fontSize: 10,
    lineHeight: 15,
  },

  postMoreButton: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: "center",
    justifyContent: "center",
  },

  ratingRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 13,
  },

  ratingBadge: {
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 9,
    paddingVertical: 7,
    flexDirection: "row",
    alignItems: "center",
  },

  ratingNumber: {
    fontSize: 11,
    fontWeight: "900",
  },

  ratingDescription: {
    fontSize: 11,
    fontWeight: "700",
    marginLeft: 8,
  },

  quoteBox: {
    borderLeftWidth: 3,
    borderRadius: 5,
    paddingLeft: 13,
    paddingRight: 4,
    paddingVertical: 5,
    marginBottom: 8,
  },

  quoteIcon: {
    marginBottom: 3,
  },

  textoCritica: {
    fontSize: 14,
    lineHeight: 22,
  },

  socialSummary: {
    minHeight: 31,
    borderBottomWidth: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },

  likeSummary: {
    flexDirection: "row",
    alignItems: "center",
  },

  likeIcon: {
    width: 19,
    height: 19,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 6,
  },

  socialSummaryText: {
    fontSize: 11,
    fontWeight: "600",
  },

  commentSummaryText: {
    fontSize: 11,
    fontWeight: "600",
  },

  socialActions: {
    minHeight: 46,
    borderTopWidth: 1,
    borderBottomWidth: 0,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-around",
  },

  facebookAction: {
    flex: 1,
    height: 40,
    borderRadius: 9,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    marginHorizontal: 2,
  },

  socialActionText: {
    fontSize: 12,
    marginLeft: 7,
  },

  commentsArea: {
    borderTopWidth: 1,
    paddingTop: 12,
    marginTop: 2,
  },

  commentInputRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    marginBottom: 14,
  },

  commentAvatar: {
    width: 34,
    height: 34,
    borderRadius: 12,
    marginRight: 8,
  },

  commentAvatarFallback: {
    alignItems: "center",
    justifyContent: "center",
  },

  commentAvatarText: {
    fontSize: 13,
    fontWeight: "900",
  },

  commentInputContainer: {
    flex: 1,
    minHeight: 42,
    borderRadius: 20,
    borderWidth: 1,
    flexDirection: "row",
    alignItems: "center",
    paddingLeft: 13,
    paddingRight: 5,
  },

  commentInput: {
    flex: 1,
    minHeight: 38,
    maxHeight: 90,
    fontSize: 12,
    paddingVertical: 9,
    paddingRight: 8,
  },

  commentSendButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
  },

  commentsLoading: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 15,
  },

  commentsLoadingText: {
    fontSize: 11,
    marginLeft: 8,
  },

  commentsList: {
    gap: 10,
  },

  commentItem: {
    flexDirection: "row",
    alignItems: "flex-start",
  },

  commentBubble: {
    flex: 1,
    borderRadius: 15,
    paddingHorizontal: 12,
    paddingVertical: 9,
  },

  commentHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 4,
  },

  commentAuthor: {
    flex: 1,
    fontSize: 11,
    fontWeight: "900",
    marginRight: 8,
  },

  commentDate: {
    fontSize: 9,
  },

  commentText: {
    fontSize: 12,
    lineHeight: 18,
  },

  noComments: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 15,
    paddingHorizontal: 10,
  },

  noCommentsText: {
    fontSize: 11,
    marginLeft: 7,
    textAlign: "center",
  },

  botoesRow: {
    flexDirection: "row",
    gap: 8,
    marginTop: 4,
  },

  updateButton: {
    flex: 1,
    height: 42,
    borderRadius: 12,
    borderWidth: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
  },

  updateButtonText: {
    fontSize: 12,
    fontWeight: "900",
  },

  deleteButton: {
    flex: 1,
    height: 42,
    borderRadius: 12,
    borderWidth: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
  },

  deleteButtonText: {
    fontSize: 12,
    fontWeight: "900",
  },

  addReviewButton: {
    minHeight: 67,
    borderRadius: 18,
    paddingHorizontal: 13,
    flexDirection: "row",
    alignItems: "center",
    marginTop: 4,
    shadowOpacity: 0.12,
    shadowRadius: 10,
    shadowOffset: {
      width: 0,
      height: 5,
    },
    elevation: 4,
  },

  addReviewIcon: {
    width: 40,
    height: 40,
    borderRadius: 13,
    backgroundColor:
      "rgba(255,255,255,0.15)",
    alignItems: "center",
    justifyContent: "center",
    marginRight: 11,
  },

  addReviewContent: {
    flex: 1,
  },

  addReviewTitle: {
    color: "#FFFFFF",
    fontSize: 13,
    fontWeight: "900",
    marginBottom: 3,
  },

  addReviewSubtitle: {
    color: "rgba(255,255,255,0.72)",
    fontSize: 10,
    lineHeight: 15,
  },

  footer: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingTop: 8,
    paddingHorizontal: 18,
  },

  footerIcon: {
    width: 28,
    height: 28,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 8,
  },

  footerText: {
    flex: 1,
    fontSize: 10,
    lineHeight: 16,
    textAlign: "center",
  },
});
