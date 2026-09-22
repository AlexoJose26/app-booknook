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
  Platform,
  RefreshControl,
  SafeAreaView,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  useColorScheme,
  useWindowDimensions,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { WebView } from "react-native-webview";

import { useLivros } from "@/contexts/LivrosContext";
import { useThemeCustom } from "@/contexts/ThemeContext";
import { useUsuario } from "@/contexts/UsuarioContext";
import { getDb } from "@/database/db";
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
  const insets = useSafeAreaInsets();

  const { width: screenWidth } = useWindowDimensions();

  const isDark =
    theme === "dark" || colorScheme === "dark";

  const isSmallScreen = screenWidth < 380;
  const isVerySmallScreen = screenWidth < 340;
  const isTablet = screenWidth >= 768;

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

  const [aba, setAba] =
    useState<StatusLivro>("lido");

  const [livrosEstante, setLivrosEstante] =
    useState<LivroEstante[]>([]);

  const [livroAberto, setLivroAberto] =
    useState<LivroEstante | null>(null);

  const [loading, setLoading] =
    useState(false);

  const [refreshing, setRefreshing] =
    useState(false);

  const [webViewLoading, setWebViewLoading] =
    useState(true);

  const [concluindoLeitura, setConcluindoLeitura] =
    useState(false);

  const [
    mostrarControlesLeitor,
    setMostrarControlesLeitor,
  ] = useState(true);

  const [
    tamanhoTexto,
    setTamanhoTexto,
  ] = useState(100);

  const [
    traduzirPortuguese,
    setTraduzirPortuguese,
  ] = useState(false);

  const [
    readerUrl,
    setReaderUrl,
  ] = useState<string | null>(null);

  const livroAutomaticoProcessado =
    useRef<string | null>(null);

  const webViewRef =
    useRef<WebView>(null);

  const readerTimerRef =
    useRef<ReturnType<typeof setTimeout> | null>(
      null
    );

  /*
   * ============================================================
   * URL DO LEITOR
   * ============================================================
   */

  const construirReaderUrl = useCallback(
    (
      url: string,
      portugues: boolean
    ) => {
      if (!portugues) {
        return url;
      }

      return `https://translate.google.com/translate?sl=auto&tl=pt&u=${encodeURIComponent(
        url
      )}`;
    },
    []
  );

  /*
   * ============================================================
   * SCRIPT DO LEITOR
   *
   * Cria uma apresentação limpa para leitura:
   * - remove menus e elementos de navegação comuns;
   * - adapta largura;
   * - adapta imagens;
   * - adapta tabelas;
   * - impede overflow horizontal;
   * - melhora tipografia;
   * - mantém links e conteúdo;
   * - coloca o conteúdo em formato de leitura.
   * ============================================================
   */

  const gerarScriptLeitor = useCallback(
    (
      tamanho: number
    ) => {
      const safeSize = Math.max(
        85,
        Math.min(160, tamanho)
      );

      return `
        (function() {
          try {
            var head =
              document.head ||
              document.getElementsByTagName('head')[0];

            if (!head) {
              return true;
            }

            /*
             * ----------------------------------------------------
             * VIEWPORT
             * ----------------------------------------------------
             */

            var viewport =
              document.querySelector(
                'meta[name="viewport"]'
              );

            if (!viewport) {
              viewport =
                document.createElement('meta');

              viewport.name = 'viewport';

              head.appendChild(
                viewport
              );
            }

            viewport.setAttribute(
              'content',
              'width=device-width, initial-scale=1.0, maximum-scale=5.0, user-scalable=yes, viewport-fit=cover'
            );

            /*
             * ----------------------------------------------------
             * REMOVE CSS ANTIGO DO MEDEA SOCIAL
             * ----------------------------------------------------
             */

            var oldStyle =
              document.getElementById(
                'medeasocial-reader-style'
              );

            if (oldStyle) {
              oldStyle.remove();
            }

            /*
             * ----------------------------------------------------
             * CSS PRINCIPAL DO LEITOR
             * ----------------------------------------------------
             */

            var style =
              document.createElement('style');

            style.id =
              'medeasocial-reader-style';

            style.innerHTML = \`
              *,
              *::before,
              *::after {
                box-sizing: border-box !important;
              }

              html {
                width: 100% !important;
                max-width: 100% !important;
                min-width: 0 !important;
                overflow-x: hidden !important;
                background: #ffffff !important;
              }

              body {
                width: 100% !important;
                max-width: 100% !important;
                min-width: 0 !important;

                margin: 0 !important;

                padding:
                  20px
                  18px
                  90px
                  18px !important;

                background: #ffffff !important;

                color: #202124 !important;

                font-family:
                  -apple-system,
                  BlinkMacSystemFont,
                  "Segoe UI",
                  Roboto,
                  Helvetica,
                  Arial,
                  sans-serif !important;

                font-size:
                  ${safeSize}% !important;

                line-height:
                  1.75 !important;

                overflow-x:
                  hidden !important;

                overflow-wrap:
                  anywhere !important;

                word-break:
                  normal !important;

                -webkit-text-size-adjust:
                  100% !important;

                text-size-adjust:
                  100% !important;
              }

              /*
               * ------------------------------------------------
               * OCULTA ELEMENTOS DE NAVEGAÇÃO DA PLATAFORMA
               * ------------------------------------------------
               */

              header,
              nav,
              footer,
              aside,
              [role="navigation"],
              [role="banner"],
              [role="complementary"],
              .navbar,
              .navigation,
              .nav,
              .menu,
              .toolbar,
              .topbar,
              .header,
              .site-header,
              .site-footer,
              .cookie-banner,
              .cookie-consent,
              .advertisement,
              .ads,
              .advert,
              .popup,
              .modal-backdrop {
                max-width: 100% !important;
              }

              /*
               * Não removemos todo header/footer automaticamente,
               * porque alguns livros utilizam essas tags como
               * conteúdo real.
               */

              /*
               * ------------------------------------------------
               * TEXTO
               * ------------------------------------------------
               */

              p {
                margin-top:
                  0.8em !important;

                margin-bottom:
                  0.8em !important;
              }

              h1,
              h2,
              h3,
              h4,
              h5,
              h6 {
                max-width:
                  100% !important;

                line-height:
                  1.3 !important;

                overflow-wrap:
                  anywhere !important;

                color:
                  #202124 !important;
              }

              h1 {
                font-size:
                  1.65em !important;
              }

              h2 {
                font-size:
                  1.4em !important;
              }

              h3 {
                font-size:
                  1.2em !important;
              }

              li {
                max-width:
                  100% !important;

                overflow-wrap:
                  anywhere !important;
              }

              blockquote {
                max-width:
                  100% !important;

                margin-left:
                  0 !important;

                margin-right:
                  0 !important;

                padding-left:
                  14px !important;
              }

              /*
               * ------------------------------------------------
               * LINKS
               * ------------------------------------------------
               */

              a {
                max-width:
                  100% !important;

                overflow-wrap:
                  anywhere !important;

                word-break:
                  break-word !important;
              }

              /*
               * ------------------------------------------------
               * IMAGENS
               * ------------------------------------------------
               */

              img,
              picture,
              video,
              canvas,
              svg {
                max-width:
                  100% !important;

                height:
                  auto !important;
              }

              img {
                display:
                  block !important;

                margin-left:
                  auto !important;

                margin-right:
                  auto !important;

                object-fit:
                  contain !important;
              }

              /*
               * ------------------------------------------------
               * IFRAMES
               * ------------------------------------------------
               */

              iframe,
              embed,
              object {
                max-width:
                  100% !important;

                width:
                  100% !important;
              }

              /*
               * ------------------------------------------------
               * CÓDIGO
               * ------------------------------------------------
               */

              pre {
                max-width:
                  100% !important;

                overflow-x:
                  auto !important;

                white-space:
                  pre-wrap !important;

                overflow-wrap:
                  anywhere !important;
              }

              code {
                white-space:
                  pre-wrap !important;

                overflow-wrap:
                  anywhere !important;
              }

              /*
               * ------------------------------------------------
               * TABELAS
               * ------------------------------------------------
               */

              table {
                width:
                  100% !important;

                max-width:
                  100% !important;

                border-collapse:
                  collapse !important;

                overflow-x:
                  auto !important;

                display:
                  block !important;
              }

              th,
              td {
                max-width:
                  100% !important;

                overflow-wrap:
                  anywhere !important;
              }

              /*
               * ------------------------------------------------
               * FORMULÁRIOS / BOTÕES
               * ------------------------------------------------
               */

              input,
              textarea,
              select,
              button {
                max-width:
                  100% !important;
              }

              /*
               * ------------------------------------------------
               * ELEMENTOS COM LARGURA FIXA
               * ------------------------------------------------
               */

              [width] {
                max-width:
                  100% !important;
              }

              [style*="width"] {
                max-width:
                  100% !important;
              }

              /*
               * ------------------------------------------------
               * ELEMENTOS ABSOLUTOS QUE PODEM COBRIR O LIVRO
               * ------------------------------------------------
               */

              [style*="position: fixed"] {
                max-width:
                  100% !important;
              }

              /*
               * ------------------------------------------------
               * PEQUENAS TELAS
               * ------------------------------------------------
               */

              @media (max-width: 480px) {
                body {
                  padding-left:
                    15px !important;

                  padding-right:
                    15px !important;

                  padding-top:
                    17px !important;

                  padding-bottom:
                    90px !important;
                }
              }

              @media (max-width: 340px) {
                body {
                  padding-left:
                    12px !important;

                  padding-right:
                    12px !important;
                }
              }
            \`;

            head.appendChild(style);

            /*
             * ----------------------------------------------------
             * TENTA IDENTIFICAR O CONTEÚDO PRINCIPAL
             * ----------------------------------------------------
             *
             * Alguns sites têm menus grandes antes do texto.
             * Damos prioridade ao elemento semântico de conteúdo.
             */

            var candidatos = [
              'main',
              'article',
              '[role="main"]',
              '.reader',
              '.reading-content',
              '.book-content',
              '.book-reader',
              '.reader-content',
              '.content',
              '#content',
              '#main'
            ];

            var principal = null;

            for (
              var i = 0;
              i < candidatos.length;
              i++
            ) {
              var encontrado =
                document.querySelector(
                  candidatos[i]
                );

              if (encontrado) {
                principal =
                  encontrado;

                break;
              }
            }

            if (principal) {
              principal.style.maxWidth =
                '100%';

              principal.style.width =
                '100%';

              principal.style.margin =
                '0 auto';

              principal.style.boxSizing =
                'border-box';

              principal.style.overflowWrap =
                'anywhere';
            }

            /*
             * ----------------------------------------------------
             * CORRIGE ELEMENTOS QUE EXCEDEM O CELULAR
             * ----------------------------------------------------
             */

            var elementos =
              document.querySelectorAll('*');

            for (
              var j = 0;
              j < elementos.length;
              j++
            ) {
              var elemento =
                elementos[j];

              elemento.style.maxWidth =
                '100%';

              elemento.style.boxSizing =
                'border-box';

              if (
                elemento.scrollWidth >
                window.innerWidth
              ) {
                elemento.style.maxWidth =
                  '100%';

                elemento.style.overflowX =
                  'auto';
              }
            }

            /*
             * ----------------------------------------------------
             * DESATIVA SCROLL LATERAL
             * ----------------------------------------------------
             */

            document.documentElement.style.width =
              '100%';

            document.documentElement.style.maxWidth =
              '100%';

            document.documentElement.style.overflowX =
              'hidden';

            document.body.style.width =
              '100%';

            document.body.style.maxWidth =
              '100%';

            document.body.style.overflowX =
              'hidden';

          } catch (error) {
            console.log(
              'Erro ao preparar leitor:',
              error
            );
          }

          true;
        })();
      `;
    },
    []
  );

  /*
   * ============================================================
   * APLICA CONFIGURAÇÃO DO LEITOR
   * ============================================================
   */

  const aplicarConfiguracaoLeitor =
    useCallback(() => {
      if (!webViewRef.current) {
        return;
      }

      webViewRef.current.injectJavaScript(
        gerarScriptLeitor(
          tamanhoTexto
        )
      );
    }, [
      gerarScriptLeitor,
      tamanhoTexto,
    ]);

  /*
   * ============================================================
   * ABRIR LIVRO
   * ============================================================
   */

  const abrirLivro = useCallback(
    async (
      livro: LivroEstante
    ) => {
      if (!livro.googleReaderLink) {
        Alert.alert(
          "Leitura indisponível",
          "Este livro ainda não possui um conteúdo ou link disponível para leitura."
        );

        return;
      }

      try {
        let livroAtual =
          livro;

        /*
         * Quando um livro "Quero ler"
         * é aberto, passa automaticamente
         * para "Lendo".
         */

        if (
          livro.status ===
          "queroLer"
        ) {
          const database =
            await getDb();

          await database
            .update(estantes)
            .set({
              status: "lendo",
            })
            .where(
              eq(
                estantes.id,
                livro.estanteId
              )
            );

          setLivrosEstante(
            (atual) =>
              atual.map(
                (item) =>
                  item.estanteId ===
                    livro.estanteId
                    ? {
                      ...item,
                      status:
                        "lendo",
                    }
                    : item
              )
          );

          livroAtual = {
            ...livro,
            status: "lendo",
          };
        }

        /*
         * Configuração inicial
         */

        setLivroAberto(
          livroAtual
        );

        setTamanhoTexto(
          100
        );

        setTraduzirPortuguese(
          false
        );

        setMostrarControlesLeitor(
          true
        );

        setWebViewLoading(
          true
        );

        setReaderUrl(
          construirReaderUrl(
            livroAtual.googleReaderLink,
            false
          )
        );
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
    [
      construirReaderUrl,
    ]
  );

  /*
   * ============================================================
   * FECHAR LEITOR
   * ============================================================
   */

  const fecharLeitor =
    useCallback(() => {
      if (
        readerTimerRef.current
      ) {
        clearTimeout(
          readerTimerRef.current
        );
      }

      setMostrarControlesLeitor(
        true
      );

      setTraduzirPortuguese(
        false
      );

      setReaderUrl(
        null
      );

      setLivroAberto(
        null
      );

      setWebViewLoading(
        false
      );
    }, []);

  /*
   * ============================================================
   * PORTUGUÊS
   * ============================================================
   */

  const alternarPortugues =
    useCallback(() => {
      if (
        !livroAberto?.googleReaderLink
      ) {
        return;
      }

      const novoEstado =
        !traduzirPortuguese;

      setTraduzirPortuguese(
        novoEstado
      );

      setWebViewLoading(
        true
      );

      setMostrarControlesLeitor(
        true
      );

      setReaderUrl(
        construirReaderUrl(
          livroAberto.googleReaderLink,
          novoEstado
        )
      );
    }, [
      livroAberto,
      traduzirPortuguese,
      construirReaderUrl,
    ]);

  /*
   * ============================================================
   * TAMANHO DA LETRA
   * ============================================================
   */

  const aumentarTexto =
    useCallback(() => {
      setTamanhoTexto(
        (valor) =>
          Math.min(
            valor + 10,
            160
          )
      );

      readerTimerRef.current =
        setTimeout(() => {
          aplicarConfiguracaoLeitor();
        }, 150);
    }, [
      aplicarConfiguracaoLeitor,
    ]);

  const diminuirTexto =
    useCallback(() => {
      setTamanhoTexto(
        (valor) =>
          Math.max(
            valor - 10,
            80
          )
      );

      readerTimerRef.current =
        setTimeout(() => {
          aplicarConfiguracaoLeitor();
        }, 150);
    }, [
      aplicarConfiguracaoLeitor,
    ]);

  /*
   * ============================================================
   * CARREGAR ESTANTES
   * ============================================================
   */

  const carregarEstantes =
    useCallback(
      async (
        mostrarLoading = true
      ) => {
        if (!usuario) {
          setLivrosEstante(
            []
          );

          return;
        }

        if (
          mostrarLoading
        ) {
          setLoading(true);
        }

        try {
          const database =
            await getDb();

          const dados =
            await database
              .select({
                estanteId:
                  estantes.id,
                status:
                  estantes.status,
                livroId:
                  livros.id,
                titulo:
                  livros.titulo,
                autor:
                  livros.autor,
                imagem:
                  livros.imagem,
                googleReaderLink:
                  livros.googleReaderLink,
              })
              .from(estantes)
              .innerJoin(
                livros,
                eq(
                  estantes.livro_id,
                  livros.id
                )
              )
              .where(
                eq(
                  estantes.usuario_id,
                  usuario.id
                )
              );

          const livrosFormatados:
            LivroEstante[] =
            dados.map(
              (livro) => ({
                estanteId:
                  livro.estanteId,

                livroId:
                  livro.livroId,

                titulo:
                  livro.titulo,

                autor:
                  livro.autor ||
                  "Autor desconhecido",

                imagem:
                  livro.imagem ||
                  null,

                googleReaderLink:
                  livro.googleReaderLink ||
                  null,

                status:
                  livro.status in
                    STATUS_CONFIG
                    ? (livro.status as StatusLivro)
                    : "queroLer",
              })
            );

          setLivrosEstante(
            livrosFormatados
          );

          if (
            livroAbrirAutomatico &&
            livroAutomaticoProcessado.current !==
            livroAbrirAutomatico
          ) {
            const livroAutomatico =
              livrosFormatados.find(
                (livro) =>
                  livro.livroId ===
                  livroAbrirAutomatico
              );

            if (
              livroAutomatico
            ) {
              livroAutomaticoProcessado.current =
                livroAbrirAutomatico;

              abrirLivro(
                livroAutomatico
              );
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
          if (
            mostrarLoading
          ) {
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
  }, [
    carregarEstantes,
  ]);

  /*
   * ============================================================
   * ATUALIZAR
   * ============================================================
   */

  const atualizar =
    useCallback(
      async () => {
        setRefreshing(true);

        try {
          await carregarEstantes(
            false
          );
        } finally {
          setRefreshing(
            false
          );
        }
      },
      [carregarEstantes]
    );

  /*
   * ============================================================
   * ATUALIZAR STATUS
   * ============================================================
   */

  const atualizarStatus =
    useCallback(
      async (
        estanteId: number,
        status: StatusLivro
      ) => {
        try {
          const database =
            await getDb();

          await database
            .update(estantes)
            .set({
              status,
            })
            .where(
              eq(
                estantes.id,
                estanteId
              )
            );

          setLivrosEstante(
            (atual) =>
              atual.map(
                (livro) =>
                  livro.estanteId ===
                    estanteId
                    ? {
                      ...livro,
                      status,
                    }
                    : livro
              )
          );

          setLivroAberto(
            (atual) =>
              atual?.estanteId ===
                estanteId
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

  /*
   * ============================================================
   * CONCLUIR LEITURA
   * ============================================================
   */

  const concluirLeitura =
    useCallback(
      async () => {
        if (
          !livroAberto ||
          concluindoLeitura
        ) {
          return;
        }

        setConcluindoLeitura(
          true
        );

        try {
          await atualizarStatus(
            livroAberto.estanteId,
            "lido"
          );

          const livroConcluido =
            livroAberto;

          /*
           * Primeiro atualizamos a
           * base de dados.
           */

          setLivrosEstante(
            (atual) =>
              atual.map(
                (livro) =>
                  livro.estanteId ===
                    livroConcluido.estanteId
                    ? {
                      ...livro,
                      status:
                        "lido",
                    }
                    : livro
              )
          );

          /*
           * Fecha o leitor somente depois
           * da atualização.
           */

          fecharLeitor();

          setAba(
            "lido"
          );

          setTimeout(() => {
            router.push({
              pathname:
                "/(tabs)/criticas",
              params: {
                livroId:
                  livroConcluido.livroId,
                titulo:
                  livroConcluido.titulo,
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
          setConcluindoLeitura(
            false
          );
        }
      },
      [
        livroAberto,
        concluindoLeitura,
        atualizarStatus,
        router,
        fecharLeitor,
      ]
    );

  /*
   * ============================================================
   * CONTADORES
   * ============================================================
   */

  const contadores =
    useMemo(
      () => ({
        queroLer:
          livrosEstante.filter(
            (livro) =>
              livro.status ===
              "queroLer"
          ).length,

        lendo:
          livrosEstante.filter(
            (livro) =>
              livro.status ===
              "lendo"
          ).length,

        lido:
          livrosEstante.filter(
            (livro) =>
              livro.status ===
              "lido"
          ).length,
      }),
      [livrosEstante]
    );

  const livrosFiltrados =
    useMemo(
      () =>
        livrosEstante.filter(
          (livro) =>
            livro.status ===
            aba
        ),
      [
        livrosEstante,
        aba,
      ]
    );

  const totalLivros =
    livrosEstante.length;

  /*
   * ============================================================
   * CAPA RESPONSIVA
   * ============================================================
   */

  const renderCapa =
    useCallback(
      (
        item: LivroEstante
      ) => {
        if (item.imagem) {
          return (
            <Image
              source={{
                uri: item.imagem,
              }}
              style={[
                styles.thumb,
                isVerySmallScreen &&
                styles.thumbSmall,
              ]}
              resizeMode="cover"
            />
          );
        }

        return (
          <View
            style={[
              styles.thumb,
              isVerySmallScreen &&
              styles.thumbSmall,
              styles.thumbFallback,
              {
                backgroundColor:
                  colors.soft,
              },
            ]}
          >
            <MaterialCommunityIcons
              name="book-open-page-variant-outline"
              size={
                isVerySmallScreen
                  ? 30
                  : 38
              }
              color={
                colors.primary
              }
            />
          </View>
        );
      },
      [
        colors.soft,
        colors.primary,
        isVerySmallScreen,
      ]
    );

  /*
   * ============================================================
   * LIVRO
   * ============================================================
   */

  const renderLivro =
    useCallback(
      ({
        item,
      }: {
        item: LivroEstante;
      }) => {
        const config =
          STATUS_CONFIG[
          item.status
          ];

        const statusBackground =
          isDark
            ? config.softDark
            : config.softLight;

        const statusColor =
          isDark
            ? config.colorDark
            : config.colorLight;

        const mensagem =
          item.status === "lido"
            ? "Terminei de ler este livro."
            : item.status ===
              "lendo"
              ? "Estou a ler este livro."
              : "Quero ler este livro.";

        return (
          <View
            style={[
              styles.feedPost,
              {
                backgroundColor:
                  colors.card,
                borderColor:
                  colors.border,
              },
              isTablet &&
              styles.feedPostTablet,
            ]}
          >
            <View
              style={
                styles.postHeader
              }
            >
              <View
                style={[
                  styles.postAvatar,
                  {
                    backgroundColor:
                      colors.primary,
                  },
                ]}
              >
                <MaterialCommunityIcons
                  name={
                    item.status ===
                      "lido"
                      ? "book-check"
                      : "book-open-page-variant"
                  }
                  size={
                    isVerySmallScreen
                      ? 19
                      : 21
                  }
                  color="#FFFFFF"
                />
              </View>

              <View
                style={
                  styles.postHeaderInfo
                }
              >
                <Text
                  style={[
                    styles.postAuthor,
                    {
                      color:
                        colors.text,
                    },
                  ]}
                  numberOfLines={
                    1
                  }
                >
                  Minha estante
                </Text>

                <View
                  style={
                    styles.postMeta
                  }
                >
                  <Text
                    style={[
                      styles.postMetaText,
                      {
                        color:
                          colors.secondary,
                      },
                    ]}
                    numberOfLines={
                      1
                    }
                  >
                    {item.status ===
                      "lido"
                      ? "Livro concluído"
                      : "Atualização da estante"}
                  </Text>

                  <Text
                    style={[
                      styles.postMetaDot,
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
                    size={11}
                    color={
                      colors.secondary
                    }
                  />

                  <Text
                    style={[
                      styles.postMetaText,
                      {
                        color:
                          colors.secondary,
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
                  color:
                    colors.text,
                },
              ]}
            >
              {mensagem}
            </Text>

            <TouchableOpacity
              activeOpacity={0.94}
              onPress={() =>
                abrirLivro(item)
              }
              style={[
                styles.bookPublication,
                {
                  backgroundColor:
                    colors.cardSecondary,
                  borderColor:
                    colors.border,
                },
                isVerySmallScreen &&
                styles.bookPublicationSmall,
              ]}
            >
              <View
                style={
                  styles.bookCoverContainer
                }
              >
                {renderCapa(item)}
              </View>

              <View
                style={
                  styles.bookPublicationContent
                }
              >
                <View
                  style={
                    styles.bookPublicationTop
                  }
                >
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
                      name={
                        config.icon
                      }
                      size={12}
                      color={
                        statusColor
                      }
                    />

                    <Text
                      style={[
                        styles.statusBadgeText,
                        {
                          color:
                            statusColor,
                        },
                      ]}
                      numberOfLines={
                        1
                      }
                    >
                      {config.label}
                    </Text>
                  </View>

                  {item.googleReaderLink && (
                    <MaterialCommunityIcons
                      name="chevron-right"
                      size={21}
                      color={
                        colors.secondary
                      }
                    />
                  )}
                </View>

                <Text
                  style={[
                    styles.bookTitle,
                    {
                      color:
                        colors.text,
                    },
                    isVerySmallScreen &&
                    styles.bookTitleSmall,
                  ]}
                  numberOfLines={
                    3
                  }
                >
                  {item.titulo}
                </Text>

                <Text
                  style={[
                    styles.bookAuthor,
                    {
                      color:
                        colors.secondary,
                    },
                  ]}
                  numberOfLines={
                    2
                  }
                >
                  {item.autor}
                </Text>

                {item.googleReaderLink && (
                  <View
                    style={
                      styles.bookOpenHint
                    }
                  >
                    <MaterialCommunityIcons
                      name={
                        item.status ===
                          "lido"
                          ? "book-check-outline"
                          : "book-open-outline"
                      }
                      size={14}
                      color={
                        colors.primary
                      }
                    />

                    <Text
                      style={[
                        styles.bookOpenHintText,
                        {
                          color:
                            colors.primary,
                        },
                      ]}
                      numberOfLines={
                        1
                      }
                    >
                      {item.status ===
                        "lido"
                        ? "Abrir novamente"
                        : "Abrir conteúdo"}
                    </Text>
                  </View>
                )}
              </View>
            </TouchableOpacity>

            {item.status ===
              "lido" && (
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
                    color={
                      statusColor
                    }
                  />

                  <Text
                    style={[
                      styles.readingNoticeText,
                      {
                        color:
                          statusColor,
                      },
                    ]}
                  >
                    Este livro já foi
                    concluído
                  </Text>
                </View>
              )}

            {item.status ===
              "lendo" && (
                <View
                  style={[
                    styles.readingNotice,
                    {
                      backgroundColor:
                        colors.soft,
                    },
                  ]}
                >
                  <MaterialCommunityIcons
                    name="book-open-page-variant"
                    size={16}
                    color={
                      colors.primary
                    }
                  />

                  <Text
                    style={[
                      styles.readingNoticeText,
                      {
                        color:
                          colors.primary,
                      },
                    ]}
                  >
                    Você está a ler
                    este livro
                  </Text>
                </View>
              )}

            <View
              style={[
                styles.postDivider,
                {
                  backgroundColor:
                    colors.border,
                },
              ]}
            />

            <View
              style={
                styles.statusActionsHeader
              }
            >
              <Text
                style={[
                  styles.statusActionsTitle,
                  {
                    color:
                      colors.secondary,
                  },
                ]}
              >
                Estado da leitura
              </Text>
            </View>

            <View
              style={[
                styles.statusSelector,
                isVerySmallScreen &&
                styles.statusSelectorSmall,
              ]}
            >
              {(
                [
                  "queroLer",
                  "lendo",
                  "lido",
                ] as StatusLivro[]
              ).map(
                (status) => {
                  const statusConfig =
                    STATUS_CONFIG[
                    status
                    ];

                  const ativo =
                    item.status ===
                    status;

                  const activeColor =
                    isDark
                      ? statusConfig.colorDark
                      : statusConfig.colorLight;

                  const activeBackground =
                    isDark
                      ? statusConfig.softDark
                      : statusConfig.softLight;

                  return (
                    <TouchableOpacity
                      key={status}
                      activeOpacity={
                        0.8
                      }
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
                          borderColor:
                            ativo
                              ? activeColor
                              : colors.border,
                          backgroundColor:
                            ativo
                              ? activeBackground
                              : colors.card,
                        },
                      ]}
                    >
                      <MaterialCommunityIcons
                        name={
                          statusConfig.icon
                        }
                        size={
                          isVerySmallScreen
                            ? 14
                            : 15
                        }
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
                            color:
                              ativo
                                ? activeColor
                                : colors.secondary,
                          },
                        ]}
                        numberOfLines={
                          1
                        }
                      >
                        {
                          statusConfig.shortLabel
                        }
                      </Text>
                    </TouchableOpacity>
                  );
                }
              )}
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
        isVerySmallScreen,
        isTablet,
      ]
    );

  /*
   * ============================================================
   * VAZIO
   * ============================================================
   */

  const renderEmpty =
    useCallback(
      () => {
        const config =
          STATUS_CONFIG[
          aba
          ];

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
          <View
            style={[
              styles.emptyWrapper,
              isTablet &&
              styles.emptyWrapperTablet,
            ]}
          >
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
                  name={
                    config.icon
                  }
                  size={36}
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
                {titulo}
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
                {descricao}
              </Text>
            </View>
          </View>
        );
      },
      [
        aba,
        colors,
        isTablet,
      ]
    );

  return (
    <SafeAreaView
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
          colors.background
        }
      />

      <FlatList
        data={
          livrosFiltrados
        }
        keyExtractor={(item) =>
          item.estanteId.toString()
        }
        renderItem={
          renderLivro
        }
        showsVerticalScrollIndicator={
          false
        }
        contentContainerStyle={[
          styles.listContent,
          isTablet &&
          styles.listContentTablet,
          livrosFiltrados.length ===
          0 && {
            flexGrow: 1,
          },
        ]}
        refreshControl={
          <RefreshControl
            refreshing={
              refreshing
            }
            onRefresh={
              atualizar
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
          <>
            <View
              style={[
                styles.pageHeader,
                isTablet &&
                styles.pageHeaderTablet,
              ]}
            >
              <View
                style={
                  styles.pageHeaderTop
                }
              >
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
                    size={
                      isVerySmallScreen
                        ? 21
                        : 24
                    }
                    color="#FFFFFF"
                  />
                </View>

                <View
                  style={
                    styles.pageHeaderText
                  }
                >
                  <Text
                    style={[
                      styles.pageTitle,
                      {
                        color:
                          colors.text,
                      },
                      isVerySmallScreen &&
                      styles.pageTitleSmall,
                    ]}
                    numberOfLines={
                      1
                    }
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
                    numberOfLines={
                      2
                    }
                  >
                    Sua biblioteca e
                    suas leituras
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
                    color={
                      colors.primary
                    }
                  />
                </View>

                <View
                  style={
                    styles.libraryInfoText
                  }
                >
                  <Text
                    style={[
                      styles.libraryInfoTitle,
                      {
                        color:
                          colors.text,
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
                    numberOfLines={
                      1
                    }
                  >
                    {totalLivros ===
                      1
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
              ).map(
                (status) => {
                  const ativo =
                    aba === status;

                  const config =
                    STATUS_CONFIG[
                    status
                    ];

                  const contador =
                    contadores[
                    status
                    ];

                  const statusColor =
                    isDark
                      ? config.colorDark
                      : config.colorLight;

                  return (
                    <TouchableOpacity
                      key={status}
                      activeOpacity={
                        0.85
                      }
                      onPress={() =>
                        setAba(
                          status
                        )
                      }
                      style={[
                        styles.tab,
                        isVerySmallScreen &&
                        styles.tabSmall,
                        ativo && {
                          backgroundColor:
                            colors.primary,
                        },
                      ]}
                    >
                      <MaterialCommunityIcons
                        name={
                          config.icon
                        }
                        size={
                          isVerySmallScreen
                            ? 14
                            : 16
                        }
                        color={
                          ativo
                            ? "#FFFFFF"
                            : statusColor
                        }
                      />

                      <Text
                        style={[
                          styles.tabText,
                          isVerySmallScreen &&
                          styles.tabTextSmall,
                          {
                            color:
                              ativo
                                ? "#FFFFFF"
                                : colors.secondary,
                          },
                        ]}
                        numberOfLines={
                          1
                        }
                      >
                        {
                          config.shortLabel
                        }
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
                              color:
                                ativo
                                  ? "#FFFFFF"
                                  : colors.primary,
                            },
                          ]}
                        >
                          {
                            contador
                          }
                        </Text>
                      </View>
                    </TouchableOpacity>
                  );
                }
              )}
            </View>

            {livrosFiltrados.length >
              0 && (
                <View
                  style={
                    styles.feedSectionHeader
                  }
                >
                  <View
                    style={{
                      flex: 1,
                      minWidth: 0,
                    }}
                  >
                    <Text
                      style={[
                        styles.feedSectionTitle,
                        {
                          color:
                            colors.text,
                        },
                      ]}
                      numberOfLines={
                        1
                      }
                    >
                      {aba ===
                        "lido"
                        ? "Livros lidos"
                        : STATUS_CONFIG[
                          aba
                        ].label}
                    </Text>

                    <Text
                      style={[
                        styles.feedSectionSubtitle,
                        {
                          color:
                            colors.secondary,
                        },
                      ]}
                      numberOfLines={
                        1
                      }
                    >
                      {livrosFiltrados.length ===
                        1
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
                      {
                        livrosFiltrados.length
                      }
                    </Text>
                  </View>
                </View>
              )}
          </>
        }
        ListEmptyComponent={
          loading
            ? null
            : renderEmpty
        }
        initialNumToRender={
          6
        }
        maxToRenderPerBatch={
          6
        }
        windowSize={7}
        removeClippedSubviews={
          Platform.OS ===
          "android"
        }
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
              color={
                colors.primary
              }
            />
          </View>

          <ActivityIndicator
            size="small"
            color={
              colors.primary
            }
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

      {/* ==========================================================
          LEITOR
          ========================================================== */}

      <Modal
        visible={
          !!livroAberto
        }
        animationType="slide"
        presentationStyle="fullScreen"
        statusBarTranslucent
        hardwareAccelerated
        onRequestClose={
          fecharLeitor
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
          <StatusBar
            hidden
            animated
          />

          {/* ======================================================
              CABEÇALHO
              ====================================================== */}

          {mostrarControlesLeitor && (
            <View
              style={[
                styles.readerHeader,
                {
                  backgroundColor:
                    colors.card,
                  borderBottomColor:
                    colors.border,

                  /*
                   * CORREÇÃO PRINCIPAL:
                   * reserva espaço para notch/status bar.
                   */
                  paddingTop:
                    Math.max(
                      insets.top,
                      8
                    ),

                  minHeight:
                    67 +
                    Math.max(
                      insets.top,
                      8
                    ),
                },
                isSmallScreen &&
                styles.readerHeaderSmall,
              ]}
            >
              <TouchableOpacity
                onPress={
                  fecharLeitor
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
                  color={
                    colors.text
                  }
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
                      color:
                        colors.text,
                    },
                  ]}
                  numberOfLines={
                    2
                  }
                  ellipsizeMode="tail"
                >
                  {
                    livroAberto?.titulo
                  }
                </Text>

                <Text
                  style={[
                    styles.readerAuthor,
                    {
                      color:
                        colors.secondary,
                    },
                  ]}
                  numberOfLines={
                    1
                  }
                >
                  {
                    livroAberto?.autor
                  }
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
                  color={
                    colors.primary
                  }
                />
              </TouchableOpacity>
            </View>
          )}

          {/* ======================================================
              CONTEÚDO DO LIVRO

              IMPORTANTE:
              NÃO usar screenHeight aqui.
              O flex:1 calcula automaticamente o espaço disponível
              entre cabeçalho e rodapé.
              ====================================================== */}

          <View
            style={
              styles.webViewWrapper
            }
          >
            {readerUrl && (
              <WebView
                key={
                  readerUrl
                }
                ref={
                  webViewRef
                }
                source={{
                  uri: readerUrl,
                }}
                style={
                  styles.webView
                }
                originWhitelist={[
                  "*",
                ]}
                javaScriptEnabled
                domStorageEnabled
                sharedCookiesEnabled
                thirdPartyCookiesEnabled
                allowsInlineMediaPlayback
                mediaPlaybackRequiresUserAction={
                  false
                }
                allowsBackForwardNavigationGestures
                setSupportMultipleWindows={
                  false
                }
                startInLoadingState
                cacheEnabled
                cacheMode="LOAD_DEFAULT"
                textZoom={
                  tamanhoTexto
                }
                scalesPageToFit={
                  Platform.OS ===
                  "android"
                }
                automaticallyAdjustContentInsets={
                  false
                }
                contentInset={{
                  top: 0,
                  left: 0,
                  right: 0,
                  bottom: 0,
                }}
                injectedJavaScriptBeforeContentLoaded={`
                  (function() {
                    try {
                      var viewport =
                        document.querySelector(
                          'meta[name="viewport"]'
                        );

                      if (!viewport) {
                        viewport =
                          document.createElement(
                            'meta'
                          );

                        viewport.name =
                          'viewport';

                        document.head.appendChild(
                          viewport
                        );
                      }

                      viewport.setAttribute(
                        'content',
                        'width=device-width, initial-scale=1.0, maximum-scale=5.0, user-scalable=yes, viewport-fit=cover'
                      );
                    } catch (e) {}

                    true;
                  })();
                `}
                onLoadStart={() =>
                  setWebViewLoading(
                    true
                  )
                }
                onLoadEnd={() => {
                  setWebViewLoading(
                    false
                  );

                  setTimeout(
                    () => {
                      aplicarConfiguracaoLeitor();
                    },
                    200
                  );
                }}
                onNavigationStateChange={() => {
                  setTimeout(
                    () => {
                      aplicarConfiguracaoLeitor();
                    },
                    250
                  );
                }}
                onError={() => {
                  setWebViewLoading(
                    false
                  );

                  Alert.alert(
                    "Não foi possível abrir",
                    "A fonte deste livro não conseguiu disponibilizar o conteúdo. Verifique a internet e tente novamente."
                  );
                }}
                onHttpError={(
                  event
                ) => {
                  const status =
                    event
                      .nativeEvent
                      .statusCode;

                  console.warn(
                    "Erro HTTP no leitor:",
                    status
                  );

                  setWebViewLoading(
                    false
                  );
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
                    color={
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
                    styles.readerLoadingText,
                    {
                      color:
                        colors.secondary,
                    },
                  ]}
                >
                  Preparando sua
                  leitura...
                </Text>
              </View>
            )}
          </View>

          {/* ======================================================
              RODAPÉ

              O botão fica FORA do WebView e sempre disponível.
              ====================================================== */}

          {mostrarControlesLeitor && (
            <View
              style={[
                styles.readerFooter,
                {
                  backgroundColor:
                    colors.card,
                  borderTopColor:
                    colors.border,

                  paddingBottom:
                    Math.max(
                      insets.bottom +
                      10,
                      12
                    ),
                },
              ]}
            >
              <View
                style={
                  styles.readerToolbar
                }
              >
                <TouchableOpacity
                  activeOpacity={
                    0.8
                  }
                  onPress={
                    diminuirTexto
                  }
                  style={[
                    styles.readerToolButton,
                    {
                      backgroundColor:
                        colors.soft,
                    },
                  ]}
                >
                  <MaterialCommunityIcons
                    name="format-font-size-decrease"
                    size={18}
                    color={
                      colors.primary
                    }
                  />
                </TouchableOpacity>

                <View
                  style={
                    styles.readerFontSize
                  }
                >
                  <MaterialCommunityIcons
                    name="format-size"
                    size={16}
                    color={
                      colors.secondary
                    }
                  />

                  <Text
                    style={[
                      styles.readerFontSizeText,
                      {
                        color:
                          colors.text,
                      },
                    ]}
                  >
                    {
                      tamanhoTexto
                    }
                    %
                  </Text>
                </View>

                <TouchableOpacity
                  activeOpacity={
                    0.8
                  }
                  onPress={
                    aumentarTexto
                  }
                  style={[
                    styles.readerToolButton,
                    {
                      backgroundColor:
                        colors.soft,
                    },
                  ]}
                >
                  <MaterialCommunityIcons
                    name="format-font-size-increase"
                    size={18}
                    color={
                      colors.primary
                    }
                  />
                </TouchableOpacity>

                <TouchableOpacity
                  activeOpacity={
                    0.8
                  }
                  onPress={
                    alternarPortugues
                  }
                  style={[
                    styles.languageButton,
                    {
                      backgroundColor:
                        traduzirPortuguese
                          ? colors.primary
                          : colors.soft,
                    },
                  ]}
                >
                  <MaterialCommunityIcons
                    name="translate"
                    size={17}
                    color={
                      traduzirPortuguese
                        ? "#FFFFFF"
                        : colors.primary
                    }
                  />

                  <Text
                    style={[
                      styles.languageButtonText,
                      {
                        color:
                          traduzirPortuguese
                            ? "#FFFFFF"
                            : colors.primary,
                      },
                    ]}
                  >
                    PT
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  activeOpacity={
                    0.8
                  }
                  onPress={() =>
                    setMostrarControlesLeitor(
                      false
                    )
                  }
                  style={[
                    styles.readerToolButton,
                    {
                      backgroundColor:
                        colors.soft,
                    },
                  ]}
                >
                  <MaterialCommunityIcons
                    name="fullscreen"
                    size={18}
                    color={
                      colors.primary
                    }
                  />
                </TouchableOpacity>
              </View>

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
                    color={
                      colors.success
                    }
                  />
                </View>

                <View
                  style={{
                    flex: 1,
                    minWidth: 0,
                  }}
                >
                  <Text
                    style={[
                      styles.readerProgressTitle,
                      {
                        color:
                          colors.text,
                      },
                    ]}
                    numberOfLines={
                      1
                    }
                  >
                    Está gostando da
                    leitura?
                  </Text>

                  <Text
                    style={[
                      styles.readerProgressSubtitle,
                      {
                        color:
                          colors.secondary,
                      },
                    ]}
                    numberOfLines={
                      2
                    }
                  >
                    Ao terminar, marque
                    o livro como
                    concluído.
                  </Text>
                </View>
              </View>

              {/* ==================================================
                  BOTÃO CONCLUIR LEITURA
                  ================================================== */}

              <TouchableOpacity
                activeOpacity={
                  0.85
                }
                onPress={
                  concluirLeitura
                }
                disabled={
                  concluindoLeitura
                }
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
                  style={
                    styles.concluirText
                  }
                >
                  {concluindoLeitura
                    ? "Concluindo..."
                    : "Concluir leitura"}
                </Text>
              </TouchableOpacity>
            </View>
          )}

          {/* ======================================================
              BOTÃO PARA SAIR DO MODO TELA CHEIA

              Não usamos mais uma camada transparente sobre todo
              o livro. Isso permite rolar, tocar e interagir
              normalmente com o conteúdo.
              ====================================================== */}

          {!mostrarControlesLeitor && (
            <TouchableOpacity
              activeOpacity={
                0.85
              }
              onPress={() =>
                setMostrarControlesLeitor(
                  true
                )
              }
              style={[
                styles.readerFloatingButton,
                {
                  backgroundColor:
                    colors.card,
                  borderColor:
                    colors.border,

                  top:
                    Math.max(
                      insets.top +
                      12,
                      18
                    ),
                },
              ]}
            >
              <MaterialCommunityIcons
                name="fullscreen-exit"
                size={20}
                color={
                  colors.primary
                }
              />
            </TouchableOpacity>
          )}
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    width: "100%",
  },

  listContent: {
    paddingTop: 0,
    paddingBottom: 30,
    width: "100%",
  },

  listContentTablet: {
    alignSelf: "center",
    width: "100%",
    maxWidth: 900,
  },

  pageHeader: {
    width: "100%",
    paddingHorizontal: 16,
    paddingTop: 10,
    paddingBottom: 12,
  },

  pageHeaderTablet: {
    paddingHorizontal: 24,
  },

  pageHeaderTop: {
    flexDirection: "row",
    alignItems: "center",
    width: "100%",
    marginBottom: 14,
  },

  pageAvatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 11,
    flexShrink: 0,
  },

  pageHeaderText: {
    flex: 1,
    minWidth: 0,
  },

  pageTitle: {
    fontSize: 23,
    lineHeight: 28,
    fontWeight: "900",
    letterSpacing: -0.4,
  },

  pageTitleSmall: {
    fontSize: 20,
    lineHeight: 25,
  },

  pageSubtitle: {
    fontSize: 12,
    marginTop: 2,
  },

  libraryInfo: {
    width: "100%",
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
    flexShrink: 0,
  },

  libraryInfoText: {
    flex: 1,
    minWidth: 0,
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
    marginLeft: 8,
  },

  totalBadgeText: {
    fontSize: 13,
    fontWeight: "900",
  },

  tabsContainer: {
    width: "auto",
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
    minWidth: 0,
  },

  tabSmall: {
    minHeight: 40,
  },

  tabText: {
    fontSize: 10,
    fontWeight: "800",
    marginLeft: 4,
    flexShrink: 1,
  },

  tabTextSmall: {
    fontSize: 8.5,
    marginLeft: 2,
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
    width: "100%",
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
    marginLeft: 10,
  },

  feedCountText: {
    fontSize: 11,
    fontWeight: "900",
  },

  feedPost: {
    width: "100%",
    borderTopWidth: 1,
    borderBottomWidth: 1,
    paddingTop: 13,
    paddingBottom: 12,
    marginBottom: 9,
  },

  feedPostTablet: {
    borderLeftWidth: 1,
    borderRightWidth: 1,
    borderRadius: 12,
    overflow: "hidden",
  },

  postHeader: {
    width: "100%",
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
    flexShrink: 0,
  },

  postHeaderInfo: {
    flex: 1,
    minWidth: 0,
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
    flexShrink: 1,
  },

  postMetaText: {
    fontSize: 9.5,
    flexShrink: 1,
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
    width: "auto",
    marginHorizontal: 12,
    borderRadius: 10,
    borderWidth: 1,
    minHeight: 142,
    padding: 10,
    flexDirection: "row",
    overflow: "hidden",
  },

  bookPublicationSmall: {
    padding: 8,
    minHeight: 125,
  },

  bookCoverContainer: {
    width: 92,
    height: 120,
    flexShrink: 0,
  },

  thumb: {
    width: 92,
    height: 120,
    borderRadius: 7,
    backgroundColor: "#E4E6EB",
  },

  thumbSmall: {
    width: 76,
    height: 104,
  },

  thumbFallback: {
    alignItems: "center",
    justifyContent: "center",
  },

  bookPublicationContent: {
    flex: 1,
    minWidth: 0,
    marginLeft: 11,
    paddingVertical: 1,
    justifyContent: "space-between",
  },

  bookPublicationTop: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    minWidth: 0,
  },

  statusBadge: {
    alignSelf: "flex-start",
    borderRadius: 6,
    paddingHorizontal: 7,
    paddingVertical: 4,
    flexDirection: "row",
    alignItems: "center",
    maxWidth: "85%",
  },

  statusBadgeText: {
    fontSize: 8.5,
    fontWeight: "900",
    marginLeft: 4,
    flexShrink: 1,
  },

  bookTitle: {
    fontSize: 16,
    lineHeight: 21,
    fontWeight: "900",
    marginTop: 7,
  },

  bookTitleSmall: {
    fontSize: 14,
    lineHeight: 19,
  },

  bookAuthor: {
    fontSize: 11,
    marginTop: 3,
  },

  bookOpenHint: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 8,
    minWidth: 0,
  },

  bookOpenHintText: {
    fontSize: 10,
    fontWeight: "800",
    marginLeft: 5,
    flexShrink: 1,
  },

  readingNotice: {
    width: "auto",
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
    flexShrink: 1,
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
    width: "100%",
    flexDirection: "row",
    paddingHorizontal: 10,
    gap: 6,
  },

  statusSelectorSmall: {
    gap: 4,
  },

  statusAction: {
    flex: 1,
    minHeight: 38,
    minWidth: 0,
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
    flexShrink: 1,
  },

  emptyWrapper: {
    flex: 1,
    justifyContent: "center",
    paddingHorizontal: 16,
    paddingVertical: 35,
  },

  emptyWrapperTablet: {
    alignSelf: "center",
    width: "100%",
    maxWidth: 700,
  },

  emptyCard: {
    width: "100%",
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
    textAlign: "center",
  },

  emptyText: {
    fontSize: 12,
    lineHeight: 19,
    textAlign: "center",
    maxWidth: 290,
  },

  loadingOverlay: {
    ...StyleSheet.absoluteFillObject,
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

  /*
   * ============================================================
   * LEITOR
   * ============================================================
   */

  readerContainer: {
    flex: 1,
    width: "100%",
    height: "100%",
  },

  readerHeader: {
    width: "100%",
    borderBottomWidth: 1,
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 12,
    flexShrink: 0,
  },

  readerHeaderSmall: {
    paddingHorizontal: 8,
  },

  readerCloseButton: {
    width: 42,
    height: 42,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },

  readerTitleArea: {
    flex: 1,
    minWidth: 0,
    marginHorizontal: 10,
    justifyContent: "center",
  },

  /*
   * O título agora pode ocupar 2 linhas.
   * Isso evita cortar títulos grandes.
   */

  readerTitle: {
    fontSize: 14,
    lineHeight: 18,
    fontWeight: "900",
    flexShrink: 1,
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
    flexShrink: 0,
  },

  /*
   * O WebView ocupa APENAS o espaço disponível.
   * Não existe height: screenHeight aqui.
   */

  webViewWrapper: {
    flex: 1,
    width: "100%",
    minHeight: 0,
    position: "relative",
    overflow: "hidden",
  },

  webView: {
    flex: 1,
    width: "100%",
    height: "100%",
    backgroundColor: "#FFFFFF",
  },

  webViewLoading: {
    ...StyleSheet.absoluteFillObject,
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

  /*
   * ============================================================
   * RODAPÉ
   * ============================================================
   */

  readerFooter: {
    width: "100%",
    borderTopWidth: 1,
    paddingHorizontal: 12,
    paddingTop: 9,
    flexShrink: 0,
  },

  readerToolbar: {
    width: "100%",
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 10,
    gap: 6,
  },

  readerToolButton: {
    width: 40,
    height: 38,
    borderRadius: 11,
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },

  readerFontSize: {
    height: 38,
    minWidth: 60,
    paddingHorizontal: 7,
    borderRadius: 11,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 4,
  },

  readerFontSizeText: {
    fontSize: 9,
    fontWeight: "800",
  },

  languageButton: {
    minWidth: 47,
    height: 38,
    borderRadius: 11,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 7,
    marginLeft: "auto",
  },

  languageButtonText: {
    fontSize: 10,
    fontWeight: "900",
    marginLeft: 4,
  },

  readerProgressInfo: {
    width: "100%",
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
    flexShrink: 0,
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
    width: "100%",
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

  /*
   * ============================================================
   * BOTÃO FLUTUANTE DE TELA CHEIA
   * ============================================================
   *
   * Aparece somente quando os controles estão ocultos.
   * Não bloqueia o livro inteiro.
   */

  readerFloatingButton: {
    position: "absolute",
    right: 14,
    width: 44,
    height: 44,
    borderRadius: 14,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
    zIndex: 50,

    shadowColor: "#000000",
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.12,
    shadowRadius: 5,
    elevation: 5,
  },
});
