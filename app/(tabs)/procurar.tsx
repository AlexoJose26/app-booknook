import { Livro, useLivros } from "@/contexts/LivrosContext";
import { useThemeCustom } from "@/contexts/ThemeContext";
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
  Platform,
  RefreshControl,
  SafeAreaView,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
  useColorScheme,
} from "react-native";

type GoogleVolume = {
  id: string;
  volumeInfo?: {
    title?: string;
    authors?: string[];
    description?: string;
    imageLinks?: {
      thumbnail?: string;
      smallThumbnail?: string;
      small?: string;
      medium?: string;
      large?: string;
      extraLarge?: string;
    };
    previewLink?: string;
    infoLink?: string;
    publishedDate?: string;
    publisher?: string;
    pageCount?: number;
    categories?: string[];
  };
};

type GoogleBooksResponse = {
  totalItems?: number;
  items?: GoogleVolume[];
};

type OpenLibraryDocument = {
  key?: string;
  title?: string;
  author_name?: string[];
  first_publish_year?: number;
  publisher?: string[];
  number_of_pages_median?: number;
  cover_i?: number;
  cover_edition_key?: string;
  subject?: string[];
  first_sentence?: string[] | string;
};

type OpenLibraryResponse = {
  numFound?: number;
  docs?: OpenLibraryDocument[];
};

type LivroResultado = Livro & {
  capa?: string | null;
  descricao?: string | null;
  ano?: string | null;
  editora?: string | null;
  paginas?: number | null;
  categorias?: string[];
  previewLink?: string | null;
  fonte?: "google" | "openlibrary" | "demo" | string;
  fonteLabel?: string;
};

type CacheEntry = {
  timestamp: number;
  livros: LivroResultado[];
  total: number;
};

type PesquisaErrorCode =
  | "NO_RESULTS"
  | "INVALID_API_KEY"
  | "BAD_REQUEST"
  | "UNAUTHORIZED"
  | "FORBIDDEN"
  | "NOT_FOUND"
  | "RATE_LIMIT"
  | "SERVER_ERROR"
  | "TIMEOUT"
  | "NETWORK"
  | "ABORTED"
  | "INVALID_RESPONSE"
  | "UNKNOWN";

class PesquisaError extends Error {
  code: PesquisaErrorCode;
  status?: number;
  apiMessage?: string;

  constructor(
    code: PesquisaErrorCode,
    options?: {
      status?: number;
      apiMessage?: string;
    }
  ) {
    super(code);
    this.name = "PesquisaError";
    this.code = code;
    this.status = options?.status;
    this.apiMessage = options?.apiMessage;
  }
}

const GOOGLE_BOOKS_URL =
  "https://www.googleapis.com/books/v1/volumes";

const OPEN_LIBRARY_URL =
  "https://openlibrary.org/search.json";

const OPEN_LIBRARY_COVER_URL =
  "https://covers.openlibrary.org/b/id";

const GOOGLE_BOOKS_API_KEY =
  process.env.EXPO_PUBLIC_GOOGLE_BOOKS_API_KEY?.trim() || "";

const MAX_RESULTS = 20;
const REQUEST_TIMEOUT = 5000;
const CACHE_TIME = 10 * 60 * 1000;

/*
 * Paleta da rede social.
 *
 * Mantemos os nomes antigos das constantes para que
 * nenhuma parte da lógica precise ser alterada.
 */
const AGRO_GREEN = "#1877F2";
const AGRO_GREEN_DARK = "#166FE5";
const AGRO_GREEN_LIGHT = "#E7F3FF";
const AGRO_GREEN_SOFT = "#F0F7FF";

const livrosCache = new Map<string, CacheEntry>();

function normalizarTermo(texto: string): string {
  return texto
    .trim()
    .replace(/\s+/g, " ")
    .slice(0, 120);
}

function chavePesquisa(texto: string): string {
  return normalizarTermo(texto).toLowerCase();
}

function normalizarImagem(
  url?: string | null
): string | null {
  if (!url) {
    return null;
  }

  let imagem = url.trim();

  if (!imagem) {
    return null;
  }

  if (imagem.startsWith("http://")) {
    imagem = imagem.replace(
      "http://",
      "https://"
    );
  }

  return imagem;
}

function imagemFallback(titulo: string): string {
  return `https://placehold.co/300x450/png?text=${encodeURIComponent(
    titulo.slice(0, 28)
  )}`;
}

function converterLivroGoogle(
  volume: GoogleVolume
): LivroResultado | null {
  const info = volume.volumeInfo;

  if (!volume.id || !info?.title) {
    return null;
  }

  const titulo = String(info.title).trim();

  if (!titulo) {
    return null;
  }

  const autores = Array.isArray(info.authors)
    ? info.authors.filter(
      (autor): autor is string =>
        typeof autor === "string" &&
        autor.trim().length > 0
    )
    : [];

  const autor =
    autores.length > 0
      ? autores.join(", ")
      : "Autor desconhecido";

  const imagem =
    normalizarImagem(
      info.imageLinks?.extraLarge ||
      info.imageLinks?.large ||
      info.imageLinks?.medium ||
      info.imageLinks?.small ||
      info.imageLinks?.thumbnail ||
      info.imageLinks?.smallThumbnail
    ) || imagemFallback(titulo);

  const categorias = Array.isArray(info.categories)
    ? info.categories.filter(
      (categoria): categoria is string =>
        typeof categoria === "string" &&
        categoria.trim().length > 0
    )
    : [];

  const previewLink =
    typeof info.previewLink === "string"
      ? info.previewLink
      : typeof info.infoLink === "string"
        ? info.infoLink
        : null;

  return {
    id: String(volume.id),
    titulo,
    autor,
    imagem,
    capa: imagem,
    googleReaderLink: previewLink,
    descricao:
      typeof info.description === "string"
        ? info.description
        : null,
    ano:
      typeof info.publishedDate === "string" &&
        info.publishedDate.trim()
        ? info.publishedDate.slice(0, 4)
        : null,
    editora:
      typeof info.publisher === "string" &&
        info.publisher.trim()
        ? info.publisher
        : null,
    paginas:
      typeof info.pageCount === "number" &&
        info.pageCount > 0
        ? info.pageCount
        : null,
    categorias,
    previewLink,
    fonte: "google",
    fonteLabel: "Google Books",
  };
}

function converterLivroOpenLibrary(
  documento: OpenLibraryDocument
): LivroResultado | null {
  const titulo =
    typeof documento.title === "string"
      ? documento.title.trim()
      : "";

  if (!titulo) {
    return null;
  }

  const autores = Array.isArray(documento.author_name)
    ? documento.author_name.filter(
      (autor): autor is string =>
        typeof autor === "string" &&
        autor.trim().length > 0
    )
    : [];

  const autor =
    autores.length > 0
      ? autores.slice(0, 3).join(", ")
      : "Autor desconhecido";

  let imagem: string;

  if (
    typeof documento.cover_i === "number" &&
    documento.cover_i > 0
  ) {
    imagem = `${OPEN_LIBRARY_COVER_URL}/${documento.cover_i}-M.jpg`;
  } else {
    imagem = imagemFallback(titulo);
  }

  const categorias = Array.isArray(documento.subject)
    ? documento.subject
      .filter(
        (categoria) =>
          typeof categoria === "string" &&
          categoria.trim().length > 0
      )
      .slice(0, 5)
    : [];

  let descricao: string | null = null;

  if (Array.isArray(documento.first_sentence)) {
    const primeiraFrase =
      documento.first_sentence.find(
        (frase) =>
          typeof frase === "string" &&
          frase.trim().length > 0
      );

    descricao = primeiraFrase || null;
  } else if (
    typeof documento.first_sentence === "string"
  ) {
    descricao =
      documento.first_sentence.trim() || null;
  }

  const idBase =
    documento.key ||
    documento.cover_edition_key ||
    titulo;

  const id = `openlibrary-${String(idBase).replace(
    /[^a-zA-Z0-9_-]/g,
    "-"
  )}`;

  const previewLink =
    typeof documento.key === "string"
      ? `https://openlibrary.org${documento.key}`
      : null;

  return {
    id,
    titulo,
    autor,
    imagem,
    capa: imagem,
    googleReaderLink: previewLink,
    descricao,
    ano:
      typeof documento.first_publish_year === "number"
        ? String(documento.first_publish_year)
        : null,
    editora:
      Array.isArray(documento.publisher) &&
        documento.publisher.length > 0
        ? documento.publisher[0]
        : null,
    paginas:
      typeof documento.number_of_pages_median === "number" &&
        documento.number_of_pages_median > 0
        ? documento.number_of_pages_median
        : null,
    categorias,
    previewLink,
    fonte: "openlibrary",
    fonteLabel: "Open Library",
  };
}

function construirGoogleURL(
  termo: string,
  usarChave = false
): string {
  const parametros = new URLSearchParams();

  parametros.set("q", termo);
  parametros.set(
    "maxResults",
    String(MAX_RESULTS)
  );
  parametros.set("startIndex", "0");
  parametros.set("printType", "books");
  parametros.set("orderBy", "relevance");

  if (usarChave && GOOGLE_BOOKS_API_KEY) {
    parametros.set(
      "key",
      GOOGLE_BOOKS_API_KEY
    );
  }

  return `${GOOGLE_BOOKS_URL}?${parametros.toString()}`;
}

function construirOpenLibraryURL(
  termo: string
): string {
  const parametros = new URLSearchParams();

  parametros.set("q", termo);
  parametros.set("limit", String(MAX_RESULTS));
  parametros.set("page", "1");

  parametros.set(
    "fields",
    [
      "key",
      "title",
      "author_name",
      "first_publish_year",
      "publisher",
      "number_of_pages_median",
      "cover_i",
      "cover_edition_key",
      "subject",
      "first_sentence",
    ].join(",")
  );

  return `${OPEN_LIBRARY_URL}?${parametros.toString()}`;
}

async function fetchComTimeout(
  url: string,
  signal: AbortSignal | undefined,
  timeoutMs: number
): Promise<Response> {
  const controller = new AbortController();

  let expirou = false;

  const timer = setTimeout(() => {
    expirou = true;
    controller.abort();
  }, Math.max(1, timeoutMs));

  const abortar = () => {
    controller.abort();
  };

  if (signal) {
    if (signal.aborted) {
      clearTimeout(timer);
      throw new PesquisaError("ABORTED");
    }

    signal.addEventListener(
      "abort",
      abortar,
      { once: true }
    );
  }

  try {
    return await fetch(url, {
      method: "GET",
      headers: {
        Accept: "application/json",
      },
      signal: controller.signal,
    });
  } catch {
    if (signal?.aborted) {
      throw new PesquisaError("ABORTED");
    }

    if (expirou) {
      throw new PesquisaError("TIMEOUT");
    }

    throw new PesquisaError("NETWORK");
  } finally {
    clearTimeout(timer);

    if (signal) {
      signal.removeEventListener(
        "abort",
        abortar
      );
    }
  }
}

async function lerResposta(
  response: Response
): Promise<any> {
  const texto = await response.text();

  if (!texto) {
    return null;
  }

  try {
    return JSON.parse(texto);
  } catch {
    return {
      raw: texto,
    };
  }
}

function mensagemAPI(data: any): string {
  if (
    typeof data?.error?.message === "string"
  ) {
    return data.error.message;
  }

  if (
    typeof data?.message === "string"
  ) {
    return data.message;
  }

  return "";
}

function criarErroHTTP(
  status: number,
  mensagem: string
): PesquisaError {
  const texto = mensagem.toLowerCase();

  if (
    (status === 400 ||
      status === 401 ||
      status === 403) &&
    (texto.includes("api key") ||
      texto.includes("apikey") ||
      texto.includes("invalid key") ||
      texto.includes("keyinvalid"))
  ) {
    return new PesquisaError(
      "INVALID_API_KEY",
      {
        status,
        apiMessage: mensagem,
      }
    );
  }

  if (status === 400) {
    return new PesquisaError(
      "BAD_REQUEST",
      {
        status,
        apiMessage: mensagem,
      }
    );
  }

  if (status === 401) {
    return new PesquisaError(
      "UNAUTHORIZED",
      {
        status,
        apiMessage: mensagem,
      }
    );
  }

  if (status === 403) {
    return new PesquisaError(
      "FORBIDDEN",
      {
        status,
        apiMessage: mensagem,
      }
    );
  }

  if (status === 404) {
    return new PesquisaError(
      "NOT_FOUND",
      {
        status,
        apiMessage: mensagem,
      }
    );
  }

  if (status === 429) {
    return new PesquisaError(
      "RATE_LIMIT",
      {
        status,
        apiMessage: mensagem,
      }
    );
  }

  if (
    status === 502 ||
    status === 503 ||
    status === 504
  ) {
    return new PesquisaError(
      "SERVER_ERROR",
      {
        status,
        apiMessage: mensagem,
      }
    );
  }

  return new PesquisaError(
    "UNKNOWN",
    {
      status,
      apiMessage: mensagem,
    }
  );
}

async function requisitarJSON(
  url: string,
  signal: AbortSignal | undefined,
  timeoutMs: number,
  fonte: "google" | "openlibrary"
): Promise<any> {
  const response =
    await fetchComTimeout(
      url,
      signal,
      timeoutMs
    );

  const data =
    await lerResposta(response);

  const mensagem =
    mensagemAPI(data);

  console.log(
    `[${fonte === "google" ? "Google Books" : "Open Library"}]`,
    {
      status: response.status,
      statusText: response.statusText,
      mensagem:
        mensagem || "Sem mensagem",
    }
  );

  if (!response.ok) {
    throw criarErroHTTP(
      response.status,
      mensagem
    );
  }

  if (
    !data ||
    typeof data !== "object"
  ) {
    throw new PesquisaError(
      "INVALID_RESPONSE",
      {
        status: response.status,
      }
    );
  }

  return data;
}

async function buscarGoogleBooks(
  termo: string,
  signal?: AbortSignal,
  timeoutMs = REQUEST_TIMEOUT
): Promise<GoogleBooksResponse> {
  try {
    return await requisitarJSON(
      construirGoogleURL(
        termo,
        false
      ),
      signal,
      timeoutMs,
      "google"
    );
  } catch (error) {
    if (
      error instanceof PesquisaError &&
      error.code === "ABORTED"
    ) {
      throw error;
    }

    if (!GOOGLE_BOOKS_API_KEY) {
      throw error;
    }

    if (
      error instanceof PesquisaError &&
      (
        error.code === "RATE_LIMIT" ||
        error.code === "SERVER_ERROR" ||
        error.code === "TIMEOUT"
      )
    ) {
      throw error;
    }

    return await requisitarJSON(
      construirGoogleURL(
        termo,
        true
      ),
      signal,
      timeoutMs,
      "google"
    );
  }
}

async function buscarOpenLibrary(
  termo: string,
  signal?: AbortSignal,
  timeoutMs = REQUEST_TIMEOUT
): Promise<OpenLibraryResponse> {
  const resposta =
    await requisitarJSON(
      construirOpenLibraryURL(
        termo
      ),
      signal,
      timeoutMs,
      "openlibrary"
    );

  if (
    !Array.isArray(
      resposta.docs
    )
  ) {
    throw new PesquisaError(
      "INVALID_RESPONSE"
    );
  }

  return resposta as OpenLibraryResponse;
}

function removerDuplicados(
  livros: LivroResultado[]
): LivroResultado[] {
  const vistos = new Set<string>();

  return livros.filter(
    (livro) => {
      const chave =
        `${livro.titulo
          .toLowerCase()
          .trim()}-${(
            livro.autor || ""
          )
            .toLowerCase()
            .trim()}`;

      if (
        vistos.has(chave)
      ) {
        return false;
      }

      vistos.add(chave);

      return true;
    }
  );
}

function mensagemErro(
  error: unknown
): string {
  if (
    !(error instanceof PesquisaError)
  ) {
    return "Não foi possível concluir a pesquisa.";
  }

  switch (error.code) {
    case "INVALID_API_KEY":
      return "A chave da Google Books foi rejeitada.";

    case "BAD_REQUEST":
      return "A pesquisa enviada não foi aceita.";

    case "UNAUTHORIZED":
      return "A autenticação da Google Books não foi autorizada.";

    case "FORBIDDEN":
      return "O acesso à Google Books foi recusado.";

    case "NOT_FOUND":
      return "O serviço solicitado não foi encontrado.";

    case "RATE_LIMIT":
      return "A Google Books atingiu o limite de consultas. Tentaremos outra fonte.";

    case "SERVER_ERROR":
      return "A Google Books está temporariamente indisponível. Tentaremos outra fonte.";

    case "TIMEOUT":
      return "A pesquisa ultrapassou o limite de tempo.";

    case "NETWORK":
      return "Não foi possível comunicar com o serviço de livros.";

    case "INVALID_RESPONSE":
      return "O serviço de livros enviou uma resposta inválida.";

    case "NO_RESULTS":
      return "Nenhum livro foi encontrado.";

    case "ABORTED":
      return "";

    default:
      return "Não foi possível concluir a pesquisa.";
  }
}

function detalheErro(
  error: unknown
): string | null {
  if (
    !(error instanceof PesquisaError)
  ) {
    return null;
  }

  if (
    error.code === "ABORTED"
  ) {
    return null;
  }

  const detalhes: string[] = [];

  if (
    typeof error.status ===
    "number"
  ) {
    detalhes.push(
      `HTTP ${String(
        error.status
      )}`
    );
  }

  if (
    error.apiMessage
  ) {
    detalhes.push(
      String(
        error.apiMessage
      )
    );
  }

  return detalhes.length > 0
    ? detalhes.join(" • ")
    : null;
}

function iconeCategoria(
  categoria: string
) {
  const texto =
    categoria
      .toLowerCase()
      .normalize("NFD")
      .replace(
        /[\u0300-\u036f]/g,
        ""
      );

  if (
    texto.includes("romance") ||
    texto.includes("ficcao")
  ) {
    return "heart-outline";
  }

  if (
    texto.includes("educacao") ||
    texto.includes("escola")
  ) {
    return "school-outline";
  }

  if (
    texto.includes("historia")
  ) {
    return "clock-outline";
  }

  if (
    texto.includes("ciencia") ||
    texto.includes("tecnologia")
  ) {
    return "flask-outline";
  }

  if (
    texto.includes("negocio") ||
    texto.includes("economia") ||
    texto.includes("financas")
  ) {
    return "briefcase-outline";
  }

  if (
    texto.includes("filosofia")
  ) {
    return "head-lightbulb-outline";
  }

  return "book-open-page-variant-outline";
}

export default function Procurar() {
  const router =
    useRouter();

  const colorScheme =
    useColorScheme();

  const { theme } =
    useThemeCustom();

  const {
    adicionarLivro,
    verificarLivroNaEstante,
  } =
    useLivros();

  const isDark =
    theme === "dark" ||
    colorScheme === "dark";

  /*
   * A estrutura da aplicação continua a mesma.
   * Apenas a paleta foi transformada para o azul
   * característico de uma rede social.
   */
  const backgroundColor =
    isDark
      ? "#101418"
      : "#F0F2F5";

  const cardColor =
    isDark
      ? "#181C20"
      : "#FFFFFF";

  const borderColor =
    isDark
      ? "#30363D"
      : "#DADDE1";

  const textColor =
    isDark
      ? "#F5F6F7"
      : "#1C1E21";

  const secondaryColor =
    isDark
      ? "#AAB4BE"
      : "#65676B";

  const green =
    isDark
      ? "#4B9BFF"
      : AGRO_GREEN;

  const greenDark =
    isDark
      ? "#2E7DD9"
      : AGRO_GREEN_DARK;

  const greenLight =
    isDark
      ? "#17395F"
      : AGRO_GREEN_LIGHT;

  const greenSoft =
    isDark
      ? "#142A42"
      : AGRO_GREEN_SOFT;

  const [
    query,
    setQuery,
  ] = useState("");

  const [
    ultimaPesquisa,
    setUltimaPesquisa,
  ] = useState("");

  const [
    resultados,
    setResultados,
  ] = useState<
    LivroResultado[]
  >([]);

  const [
    totalResultados,
    setTotalResultados,
  ] = useState(0);

  const [
    loading,
    setLoading,
  ] = useState(false);

  const [
    refreshing,
    setRefreshing,
  ] = useState(false);

  const [
    erro,
    setErro,
  ] = useState<
    string | null
  >(null);

  const [
    detalhe,
    setDetalhe,
  ] = useState<
    string | null
  >(null);

  const [
    adicionandoId,
    setAdicionandoId,
  ] = useState<
    string | null
  >(null);

  const [
    idsAdicionados,
    setIdsAdicionados,
  ] = useState<
    Set<string>
  >(new Set());

  const [
    idsConfirmadosBanco,
    setIdsConfirmadosBanco,
  ] = useState<
    Set<string>
  >(new Set());

  const [
    fontePesquisa,
    setFontePesquisa,
  ] = useState<
    "google" |
    "openlibrary" |
    "cache"
  >("google");

  const abortRef =
    useRef<AbortController | null>(
      null
    );

  const requestIdRef =
    useRef(0);

  const mountedRef =
    useRef(true);

  useEffect(() => {
    mountedRef.current =
      true;

    return () => {
      mountedRef.current =
        false;

      abortRef.current?.abort();
    };
  }, []);

  useEffect(() => {
    let cancelado = false;

    const atualizarEstadoEstantes =
      async () => {
        if (
          resultados.length ===
          0
        ) {
          setIdsConfirmadosBanco(
            new Set()
          );

          return;
        }

        const encontrados =
          new Set<string>();

        const verificacoes =
          await Promise.all(
            resultados.map(
              async (livro) => {
                if (
                  cancelado ||
                  !livro?.id
                ) {
                  return null;
                }

                try {
                  const id =
                    String(
                      livro.id
                    ).trim();

                  const existe =
                    await verificarLivroNaEstante(
                      id
                    );

                  return existe
                    ? id
                    : null;
                } catch (
                error
                ) {
                  console.error(
                    "[Procurar] Erro ao verificar livro na estante:",
                    error
                  );

                  return null;
                }
              }
            )
          );

        if (
          cancelado ||
          !mountedRef.current
        ) {
          return;
        }

        verificacoes.forEach(
          (id) => {
            if (id) {
              encontrados.add(
                id
              );
            }
          }
        );

        setIdsConfirmadosBanco(
          encontrados
        );
      };

    atualizarEstadoEstantes();

    return () => {
      cancelado = true;
    };
  }, [
    resultados,
    verificarLivroNaEstante,
  ]);

  const idsNaEstante =
    useMemo(() => {
      const ids =
        new Set<string>();

      idsAdicionados.forEach(
        (id) => {
          ids.add(
            String(id)
          );
        }
      );

      idsConfirmadosBanco.forEach(
        (id) => {
          ids.add(
            String(id)
          );
        }
      );

      return ids;
    }, [
      idsAdicionados,
      idsConfirmadosBanco,
    ]);

  const resultadosUnicos =
    useMemo(
      () =>
        removerDuplicados(
          resultados
        ),
      [resultados]
    );

  const pesquisar =
    useCallback(
      async (
        termoOriginal: string,
        forcarAtualizacao = false
      ) => {
        const termo =
          normalizarTermo(
            termoOriginal
          );

        if (!termo) {
          setErro(null);
          setDetalhe(null);
          setResultados([]);
          setTotalResultados(0);
          setUltimaPesquisa("");
          setIdsAdicionados(
            new Set()
          );
          setIdsConfirmadosBanco(
            new Set()
          );
          setFontePesquisa(
            "google"
          );

          return;
        }

        abortRef.current?.abort();

        const requestId =
          ++requestIdRef.current;

        const controller =
          new AbortController();

        abortRef.current =
          controller;

        setLoading(true);
        setErro(null);
        setDetalhe(null);

        setIdsAdicionados(
          new Set()
        );

        setIdsConfirmadosBanco(
          new Set()
        );

        if (
          !forcarAtualizacao
        ) {
          setResultados([]);
          setTotalResultados(0);
        }

        try {
          const chave =
            chavePesquisa(
              termo
            );

          const cache =
            livrosCache.get(
              chave
            );

          if (
            cache &&
            Date.now() -
            cache.timestamp <
            CACHE_TIME &&
            !forcarAtualizacao
          ) {
            if (
              requestId !==
              requestIdRef.current
            ) {
              return;
            }

            setResultados(
              cache.livros
            );

            setTotalResultados(
              cache.total
            );

            setUltimaPesquisa(
              termo
            );

            setFontePesquisa(
              "cache"
            );

            return;
          }

          let livrosGoogle:
            LivroResultado[] =
            [];

          let livrosOpenLibrary:
            LivroResultado[] =
            [];

          let erroGoogle:
            unknown = null;

          let erroOpenLibrary:
            unknown = null;

          const resultadoGoogle =
            buscarGoogleBooks(
              termo,
              controller.signal,
              REQUEST_TIMEOUT
            )
              .then(
                (resposta) => {
                  const itens =
                    Array.isArray(
                      resposta.items
                    )
                      ? resposta.items
                      : [];

                  livrosGoogle =
                    removerDuplicados(
                      itens
                        .map(
                          converterLivroGoogle
                        )
                        .filter(
                          (
                            livro
                          ): livro is LivroResultado =>
                            livro !== null
                        )
                    );

                  console.log(
                    "[Pesquisa] Google Books:",
                    livrosGoogle.length,
                    "resultados"
                  );

                  return livrosGoogle;
                }
              )
              .catch(
                (error) => {
                  erroGoogle =
                    error;

                  console.log(
                    "[Pesquisa] Google Books falhou:",
                    error instanceof
                      PesquisaError
                      ? error.code
                      : "UNKNOWN"
                  );

                  return [];
                }
              );

          const resultadoOpenLibrary =
            buscarOpenLibrary(
              termo,
              controller.signal,
              REQUEST_TIMEOUT
            )
              .then(
                (resposta) => {
                  const documentos =
                    Array.isArray(
                      resposta.docs
                    )
                      ? resposta.docs
                      : [];

                  livrosOpenLibrary =
                    removerDuplicados(
                      documentos
                        .map(
                          converterLivroOpenLibrary
                        )
                        .filter(
                          (
                            livro
                          ): livro is LivroResultado =>
                            livro !== null
                        )
                    );

                  console.log(
                    "[Pesquisa] Open Library:",
                    livrosOpenLibrary.length,
                    "resultados"
                  );

                  return livrosOpenLibrary;
                }
              )
              .catch(
                (error) => {
                  erroOpenLibrary =
                    error;

                  console.log(
                    "[Pesquisa] Open Library falhou:",
                    error instanceof
                      PesquisaError
                      ? error.code
                      : "UNKNOWN"
                  );

                  return [];
                }
              );

          await Promise.all([
            resultadoGoogle,
            resultadoOpenLibrary,
          ]);

          if (
            controller.signal.aborted
          ) {
            throw new PesquisaError(
              "ABORTED"
            );
          }

          if (
            requestId !==
            requestIdRef.current
          ) {
            return;
          }

          let livrosEncontrados:
            LivroResultado[] =
            [];

          let total = 0;

          let fonte:
            | "google"
            | "openlibrary" =
            "google";

          if (
            livrosGoogle.length >
            0
          ) {
            livrosEncontrados =
              livrosGoogle;

            total =
              livrosGoogle.length;

            fonte =
              "google";
          } else if (
            livrosOpenLibrary.length >
            0
          ) {
            livrosEncontrados =
              livrosOpenLibrary;

            total =
              livrosOpenLibrary.length;

            fonte =
              "openlibrary";
          }

          if (
            livrosEncontrados.length >
            0 &&
            livrosEncontrados.length <
            MAX_RESULTS &&
            livrosGoogle.length >
            0 &&
            livrosOpenLibrary.length >
            0
          ) {
            livrosEncontrados =
              removerDuplicados([
                ...livrosGoogle,
                ...livrosOpenLibrary,
              ]).slice(
                0,
                MAX_RESULTS
              );

            total =
              livrosEncontrados.length;
          }

          if (
            livrosEncontrados.length ===
            0
          ) {
            let erroPrincipal:
              unknown =
              erroOpenLibrary ||
              erroGoogle;

            if (
              erroGoogle instanceof
              PesquisaError &&
              erroGoogle.code ===
              "RATE_LIMIT" &&
              !erroOpenLibrary
            ) {
              erroPrincipal =
                erroGoogle;
            }

            if (
              erroPrincipal instanceof
              PesquisaError &&
              erroPrincipal.code ===
              "ABORTED"
            ) {
              return;
            }

            setResultados([]);
            setTotalResultados(0);
            setUltimaPesquisa(
              termo
            );

            if (
              erroPrincipal
            ) {
              setErro(
                mensagemErro(
                  erroPrincipal
                )
              );

              setDetalhe(
                detalheErro(
                  erroPrincipal
                )
              );
            } else {
              setErro(
                "Nenhum livro foi encontrado."
              );

              setDetalhe(null);
            }

            return;
          }

          livrosCache.set(
            chave,
            {
              timestamp:
                Date.now(),
              livros:
                livrosEncontrados,
              total,
            }
          );

          if (
            requestId !==
            requestIdRef.current
          ) {
            return;
          }

          setResultados(
            livrosEncontrados
          );

          setTotalResultados(
            total
          );

          setUltimaPesquisa(
            termo
          );

          setFontePesquisa(
            fonte
          );

          setErro(null);
          setDetalhe(null);
        } catch (
        error
        ) {
          if (
            error instanceof
            PesquisaError &&
            error.code ===
            "ABORTED"
          ) {
            return;
          }

          if (
            requestId !==
            requestIdRef.current
          ) {
            return;
          }

          console.log(
            "[Pesquisa diagnóstico]",
            {
              tipo:
                error instanceof
                  PesquisaError
                  ? error.code
                  : "UNKNOWN",
              status:
                error instanceof
                  PesquisaError
                  ? error.status
                  : undefined,
              mensagem:
                error instanceof
                  PesquisaError
                  ? error.apiMessage
                  : undefined,
            }
          );

          setResultados([]);
          setTotalResultados(0);
          setUltimaPesquisa(
            termo
          );

          setErro(
            mensagemErro(
              error
            )
          );

          setDetalhe(
            detalheErro(
              error
            )
          );
        } finally {
          if (
            requestId ===
            requestIdRef.current &&
            mountedRef.current
          ) {
            setLoading(false);
            setRefreshing(false);
          }
        }
      },
      []
    );

  const executarPesquisa =
    useCallback(() => {
      const termo =
        normalizarTermo(
          query
        );

      if (!termo) {
        Alert.alert(
          "Pesquisa",
          "Digite o título de um livro, autor ou assunto."
        );

        return;
      }

      pesquisar(termo);
    }, [
      query,
      pesquisar,
    ]);

  const limpar =
    useCallback(() => {
      abortRef.current?.abort();

      requestIdRef.current++;

      setQuery("");
      setUltimaPesquisa("");
      setResultados([]);
      setTotalResultados(0);
      setErro(null);
      setDetalhe(null);
      setLoading(false);
      setRefreshing(false);

      setIdsAdicionados(
        new Set()
      );

      setIdsConfirmadosBanco(
        new Set()
      );

      setFontePesquisa(
        "google"
      );
    }, []);

  const atualizar =
    useCallback(async () => {
      if (
        !ultimaPesquisa ||
        loading
      ) {
        return;
      }

      livrosCache.delete(
        chavePesquisa(
          ultimaPesquisa
        )
      );

      setRefreshing(true);

      await pesquisar(
        ultimaPesquisa,
        true
      );
    }, [
      ultimaPesquisa,
      loading,
      pesquisar,
    ]);

  const adicionar =
    useCallback(
      async (
        livro: LivroResultado
      ) => {
        if (
          !livro?.id
        ) {
          Alert.alert(
            "Livro inválido",
            "Não foi possível identificar este livro."
          );

          return;
        }

        const id =
          String(
            livro.id
          ).trim();

        if (!id) {
          Alert.alert(
            "Livro inválido",
            "O identificador deste livro não é válido."
          );

          return;
        }

        if (
          idsNaEstante.has(id)
        ) {
          Alert.alert(
            "Livro já adicionado",
            "Este livro já está na sua estante."
          );

          return;
        }

        if (
          adicionandoId
        ) {
          return;
        }

        try {
          setAdicionandoId(
            id
          );

          const livroParaEstante:
            Livro = {
            id,
            titulo:
              String(
                livro.titulo ||
                ""
              ).trim(),
            autor:
              typeof livro.autor ===
                "string" &&
                livro.autor.trim()
                ? livro.autor.trim()
                : "Autor desconhecido",
            imagem:
              livro.imagem ||
              livro.capa ||
              null,
            googleReaderLink:
              livro.googleReaderLink ||
              livro.previewLink ||
              null,
            descricao:
              livro.descricao ||
              null,
            ano:
              livro.ano ||
              null,
            editora:
              livro.editora ||
              null,
            paginas:
              typeof livro.paginas ===
                "number" &&
                livro.paginas > 0
                ? livro.paginas
                : null,
            categorias:
              Array.isArray(
                livro.categorias
              )
                ? livro.categorias
                : [],
            fonte:
              livro.fonte,
            fonteLabel:
              livro.fonte ===
                "google"
                ? "Google Books"
                : livro.fonte ===
                  "openlibrary"
                  ? "Open Library"
                  : livro.fonteLabel ||
                  "Fonte externa",
            previewLink:
              livro.previewLink ||
              null,
          };

          if (
            !livroParaEstante.titulo
          ) {
            throw new Error(
              "O livro não possui um título válido."
            );
          }

          console.log(
            "[Procurar] Iniciando inclusão na estante:",
            {
              id:
                livroParaEstante.id,
              titulo:
                livroParaEstante.titulo,
              fonte:
                livroParaEstante.fonte,
              status:
                "queroLer",
            }
          );

          await adicionarLivro(
            livroParaEstante
          );

          const confirmado =
            await verificarLivroNaEstante(
              id
            );

          if (!confirmado) {
            throw new Error(
              "O livro foi processado, mas não foi confirmado na sua estante."
            );
          }

          if (
            mountedRef.current
          ) {
            setIdsAdicionados(
              (anterior) => {
                const novo =
                  new Set(
                    anterior
                  );

                novo.add(id);

                return novo;
              }
            );

            setIdsConfirmadosBanco(
              (anterior) => {
                const novo =
                  new Set(
                    anterior
                  );

                novo.add(id);

                return novo;
              }
            );

            Alert.alert(
              "Livro adicionado",
              `"${livroParaEstante.titulo}" foi adicionado à sua estante em "Quero ler".`
            );
          }
        } catch (
        error: any
        ) {
          console.error(
            "================================"
          );

          console.error(
            "ERRO AO ADICIONAR LIVRO"
          );

          console.error(
            error
          );

          console.error(
            "Mensagem:",
            error?.message
          );

          console.error(
            "Cause:",
            error?.cause
          );

          console.error(
            "================================"
          );

          if (
            mountedRef.current
          ) {
            const mensagem =
              error?.message ||
              "O livro não pôde ser adicionado à sua estante.";

            Alert.alert(
              "Não foi possível adicionar",
              String(
                mensagem
              )
            );
          }
        } finally {
          if (
            mountedRef.current
          ) {
            setAdicionandoId(
              null
            );
          }
        }
      },
      [
        adicionarLivro,
        adicionandoId,
        idsNaEstante,
        verificarLivroNaEstante,
      ]
    );

  const abrirEstante =
    useCallback(() => {
      router.push(
        "/(tabs)/estante" as any
      );
    }, [
      router,
    ]);

  const nomeFonte =
    fontePesquisa ===
      "openlibrary"
      ? "Open Library"
      : fontePesquisa ===
        "cache"
        ? "Cache local"
        : "Google Books";

  /*
   * Cada resultado agora é uma publicação.
   * A funcionalidade do botão "Quero ler" continua
   * exatamente ligada à função adicionar().
   */
  const renderLivro =
    useCallback(
      ({
        item,
      }: {
        item: LivroResultado;
      }) => {
        const id =
          String(
            item.id
          );

        const adicionado =
          idsNaEstante.has(
            id
          );

        const adicionando =
          adicionandoId ===
          id;

        const titulo =
          typeof item.titulo ===
            "string"
            ? item.titulo
            : "Livro sem título";

        const autor =
          typeof item.autor ===
            "string" &&
            item.autor.trim()
            ? item.autor
            : "Autor desconhecido";

        const categoria =
          Array.isArray(
            item.categorias
          ) &&
            typeof item.categorias[0] ===
            "string"
            ? item.categorias[0]
            : null;

        const temAno =
          typeof item.ano ===
          "string" &&
          item.ano.trim().length >
          0;

        const temPaginas =
          typeof item.paginas ===
          "number" &&
          item.paginas > 0;

        const temEditora =
          typeof item.editora ===
          "string" &&
          item.editora.trim().length >
          0;

        const isGoogle =
          item.fonte ===
          "google";

        const isOpenLibrary =
          item.fonte ===
          "openlibrary";

        const imagem =
          item.imagem ||
          item.capa ||
          imagemFallback(
            titulo
          );

        const descricao =
          typeof item.descricao ===
            "string" &&
            item.descricao.trim()
            ? item.descricao.trim()
            : null;

        return (
          <View
            style={[
              styles.socialPost,
              {
                backgroundColor:
                  cardColor,
                borderColor,
              },
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
                      green,
                  },
                ]}
              >
                <MaterialCommunityIcons
                  name="book-open-page-variant"
                  size={21}
                  color="#FFFFFF"
                />
              </View>

              <View
                style={
                  styles.postIdentity
                }
              >
                <View
                  style={
                    styles.postNameRow
                  }
                >
                  <Text
                    style={[
                      styles.postAuthor,
                      {
                        color:
                          textColor,
                      },
                    ]}
                  >
                    MedeaSocial
                  </Text>

                  <MaterialCommunityIcons
                    name="check-circle"
                    size={13}
                    color={
                      green
                    }
                  />
                </View>

                <View
                  style={
                    styles.postMetaRow
                  }
                >
                  <Text
                    style={[
                      styles.postMeta,
                      {
                        color:
                          secondaryColor,
                      },
                    ]}
                  >
                    Descobrir livros
                  </Text>

                  <Text
                    style={[
                      styles.postDot,
                      {
                        color:
                          secondaryColor,
                      },
                    ]}
                  >
                    •
                  </Text>

                  <MaterialCommunityIcons
                    name="earth"
                    size={11}
                    color={
                      secondaryColor
                    }
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
                  size={22}
                  color={
                    secondaryColor
                  }
                />
              </TouchableOpacity>
            </View>

            <View
              style={
                styles.postTextArea
              }
            >
              <Text
                style={[
                  styles.postText,
                  {
                    color:
                      textColor,
                  },
                ]}
              >
                Encontrei este livro e achei que
                poderia ser interessante para a
                comunidade.
              </Text>

              {descricao ? (
                <Text
                  numberOfLines={3}
                  style={[
                    styles.postDescription,
                    {
                      color:
                        secondaryColor,
                    },
                  ]}
                >
                  {descricao}
                </Text>
              ) : null}
            </View>

            <View
              style={[
                styles.bookPublication,
                {
                  backgroundColor:
                    isDark
                      ? "#20252A"
                      : "#F5F6F7",
                  borderColor,
                },
              ]}
            >
              <Image
                source={{
                  uri: imagem,
                }}
                style={
                  styles.socialBookCover
                }
                resizeMode="cover"
              />

              <View
                style={
                  styles.socialBookInfo
                }
              >
                <View
                  style={
                    styles.socialSourceRow
                  }
                >
                  <View
                    style={[
                      styles.sourcePill,
                      {
                        backgroundColor:
                          greenLight,
                      },
                    ]}
                  >
                    <MaterialCommunityIcons
                      name={
                        isGoogle
                          ? "google"
                          : isOpenLibrary
                            ? "library-outline"
                            : "database-outline"
                      }
                      size={11}
                      color={
                        green
                      }
                    />

                    <Text
                      style={[
                        styles.sourcePillText,
                        {
                          color:
                            green,
                        },
                      ]}
                    >
                      {isGoogle
                        ? "Google Books"
                        : isOpenLibrary
                          ? "Open Library"
                          : "Fonte externa"}
                    </Text>
                  </View>
                </View>

                <Text
                  numberOfLines={3}
                  style={[
                    styles.socialBookTitle,
                    {
                      color:
                        textColor,
                    },
                  ]}
                >
                  {titulo}
                </Text>

                <View
                  style={
                    styles.socialAuthorRow
                  }
                >
                  <MaterialCommunityIcons
                    name="account-outline"
                    size={14}
                    color={
                      green
                    }
                  />

                  <Text
                    numberOfLines={2}
                    style={[
                      styles.socialBookAuthor,
                      {
                        color:
                          secondaryColor,
                      },
                    ]}
                  >
                    {autor}
                  </Text>
                </View>

                <View
                  style={
                    styles.socialBookMeta
                  }
                >
                  {temAno ? (
                    <View
                      style={
                        styles.socialMetaItem
                      }
                    >
                      <MaterialCommunityIcons
                        name="calendar-outline"
                        size={12}
                        color={
                          secondaryColor
                        }
                      />

                      <Text
                        style={[
                          styles.socialMetaText,
                          {
                            color:
                              secondaryColor,
                          },
                        ]}
                      >
                        {String(
                          item.ano
                        )}
                      </Text>
                    </View>
                  ) : null}

                  {temPaginas ? (
                    <View
                      style={
                        styles.socialMetaItem
                      }
                    >
                      <MaterialCommunityIcons
                        name="file-document-outline"
                        size={12}
                        color={
                          secondaryColor
                        }
                      />

                      <Text
                        style={[
                          styles.socialMetaText,
                          {
                            color:
                              secondaryColor,
                          },
                        ]}
                      >
                        {String(
                          item.paginas
                        )}{" "}
                        pág.
                      </Text>
                    </View>
                  ) : null}
                </View>

                {temEditora ? (
                  <View
                    style={
                      styles.socialPublisher
                    }
                  >
                    <MaterialCommunityIcons
                      name="office-building-outline"
                      size={12}
                      color={
                        secondaryColor
                      }
                    />

                    <Text
                      numberOfLines={1}
                      style={[
                        styles.socialPublisherText,
                        {
                          color:
                            secondaryColor,
                        },
                      ]}
                    >
                      {String(
                        item.editora
                      )}
                    </Text>
                  </View>
                ) : null}

                {categoria ? (
                  <View
                    style={[
                      styles.socialCategory,
                      {
                        backgroundColor:
                          greenSoft,
                      },
                    ]}
                  >
                    <MaterialCommunityIcons
                      name={
                        iconeCategoria(
                          String(
                            categoria
                          )
                        ) as any
                      }
                      size={11}
                      color={
                        green
                      }
                    />

                    <Text
                      numberOfLines={1}
                      style={[
                        styles.socialCategoryText,
                        {
                          color:
                            green,
                        },
                      ]}
                    >
                      {String(
                        categoria
                      )}
                    </Text>
                  </View>
                ) : null}

                <TouchableOpacity
                  activeOpacity={0.82}
                  disabled={
                    adicionado ||
                    adicionando
                  }
                  onPress={() =>
                    adicionar(
                      item
                    )
                  }
                  style={[
                    styles.socialShelfAction,
                    {
                      backgroundColor:
                        adicionado
                          ? greenLight
                          : green,
                      borderColor:
                        adicionado
                          ? borderColor
                          : green,
                    },
                  ]}
                >
                  {adicionando ? (
                    <ActivityIndicator
                      size="small"
                      color="#FFFFFF"
                    />
                  ) : (
                    <MaterialCommunityIcons
                      name={
                        adicionado
                          ? "check-circle-outline"
                          : "bookmark-plus-outline"
                      }
                      size={17}
                      color={
                        adicionado
                          ? green
                          : "#FFFFFF"
                      }
                    />
                  )}

                  <Text
                    style={[
                      styles.socialShelfActionText,
                      {
                        color:
                          adicionado
                            ? green
                            : "#FFFFFF",
                      },
                    ]}
                  >
                    {adicionando
                      ? "Adicionando..."
                      : adicionado
                        ? "Na minha estante"
                        : "Quero ler"}
                  </Text>
                </TouchableOpacity>
              </View>
            </View>

            <View
              style={[
                styles.postStats,
                {
                  borderBottomColor:
                    borderColor,
                },
              ]}
            >
              <View
                style={
                  styles.postStatsLeft
                }
              >
                <View
                  style={[
                    styles.postReactionIcon,
                    {
                      backgroundColor:
                        green,
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
                    styles.postStatsText,
                    {
                      color:
                        secondaryColor,
                    },
                  ]}
                >
                  Livro encontrado
                </Text>
              </View>

              <Text
                style={[
                  styles.postStatsText,
                  {
                    color:
                      secondaryColor,
                  },
                ]}
              >
                {String(
                  item.fonteLabel ||
                  "Fonte externa"
                )}
              </Text>
            </View>

            <View
              style={
                styles.postActions
              }
            >
              <TouchableOpacity
                activeOpacity={0.7}
                style={
                  styles.postAction
                }
              >
                <MaterialCommunityIcons
                  name="thumb-up-outline"
                  size={19}
                  color={
                    secondaryColor
                  }
                />

                <Text
                  style={[
                    styles.postActionText,
                    {
                      color:
                        secondaryColor,
                    },
                  ]}
                >
                  Gosto
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                activeOpacity={0.7}
                style={
                  styles.postAction
                }
              >
                <MaterialCommunityIcons
                  name="comment-outline"
                  size={19}
                  color={
                    secondaryColor
                  }
                />

                <Text
                  style={[
                    styles.postActionText,
                    {
                      color:
                        secondaryColor,
                    },
                  ]}
                >
                  Comentar
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                activeOpacity={0.7}
                style={
                  styles.postAction
                }
              >
                <MaterialCommunityIcons
                  name="share-outline"
                  size={20}
                  color={
                    secondaryColor
                  }
                />

                <Text
                  style={[
                    styles.postActionText,
                    {
                      color:
                        secondaryColor,
                    },
                  ]}
                >
                  Partilhar
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        );
      },
      [
        adicionar,
        adicionandoId,
        cardColor,
        borderColor,
        green,
        greenLight,
        greenSoft,
        idsNaEstante,
        isDark,
        secondaryColor,
        textColor,
      ]
    );

  const headerContent =
    useMemo(
      () => (
        <>
          <View
            style={[
              styles.searchComposer,
              {
                backgroundColor:
                  cardColor,
                borderColor,
              },
            ]}
          >
            <View
              style={
                styles.composerHeader
              }
            >
              <View
                style={[
                  styles.composerAvatar,
                  {
                    backgroundColor:
                      green,
                  },
                ]}
              >
                <MaterialCommunityIcons
                  name="book-search-outline"
                  size={20}
                  color="#FFFFFF"
                />
              </View>

              <View
                style={
                  styles.composerIdentity
                }
              >
                <Text
                  style={[
                    styles.composerTitle,
                    {
                      color:
                        textColor,
                    },
                  ]}
                >
                  Procurar livros
                </Text>

                <Text
                  style={[
                    styles.composerSubtitle,
                    {
                      color:
                        secondaryColor,
                    },
                  ]}
                >
                  Descubra o seu próximo livro
                </Text>
              </View>

              <TouchableOpacity
                activeOpacity={0.78}
                onPress={
                  abrirEstante
                }
                style={[
                  styles.composerLibrary,
                  {
                    backgroundColor:
                      greenLight,
                  },
                ]}
              >
                <MaterialCommunityIcons
                  name="bookshelf"
                  size={20}
                  color={
                    green
                  }
                />
              </TouchableOpacity>
            </View>

            <View
              style={[
                styles.socialSearchInput,
                {
                  backgroundColor:
                    isDark
                      ? "#20252A"
                      : "#F0F2F5",
                  borderColor,
                },
              ]}
            >
              <MaterialCommunityIcons
                name="magnify"
                size={20}
                color={
                  secondaryColor
                }
              />

              <TextInput
                value={query}
                onChangeText={
                  setQuery
                }
                onSubmitEditing={
                  executarPesquisa
                }
                placeholder="Pesquisar livros, autores ou assuntos..."
                placeholderTextColor={
                  secondaryColor
                }
                returnKeyType="search"
                editable={!loading}
                autoCorrect={false}
                autoCapitalize="sentences"
                style={[
                  styles.socialInput,
                  {
                    color:
                      textColor,
                  },
                ]}
              />

              {query.length >
                0 ? (
                <TouchableOpacity
                  activeOpacity={0.7}
                  onPress={() =>
                    setQuery("")
                  }
                  style={
                    styles.inputClear
                  }
                >
                  <MaterialCommunityIcons
                    name="close-circle"
                    size={18}
                    color={
                      secondaryColor
                    }
                  />
                </TouchableOpacity>
              ) : null}
            </View>

            <View
              style={
                styles.composerActions
              }
            >
              <TouchableOpacity
                activeOpacity={0.82}
                disabled={
                  loading ||
                  query.trim()
                    .length === 0
                }
                onPress={
                  executarPesquisa
                }
                style={[
                  styles.composerSearchButton,
                  {
                    backgroundColor:
                      query.trim()
                        .length >
                        0 &&
                        !loading
                        ? green
                        : isDark
                          ? "#27313A"
                          : "#E4E6EB",
                  },
                ]}
              >
                {loading ? (
                  <ActivityIndicator
                    size="small"
                    color="#FFFFFF"
                  />
                ) : (
                  <MaterialCommunityIcons
                    name="magnify"
                    size={18}
                    color={
                      query.trim()
                        .length >
                        0
                        ? "#FFFFFF"
                        : secondaryColor
                    }
                  />
                )}

                <Text
                  style={[
                    styles.composerSearchText,
                    {
                      color:
                        query.trim()
                          .length >
                          0 &&
                          !loading
                          ? "#FFFFFF"
                          : secondaryColor,
                    },
                  ]}
                >
                  Pesquisar
                </Text>
              </TouchableOpacity>

              {ultimaPesquisa ? (
                <TouchableOpacity
                  activeOpacity={0.7}
                  onPress={
                    limpar
                  }
                  style={
                    styles.composerClearButton
                  }
                >
                  <MaterialCommunityIcons
                    name="close"
                    size={15}
                    color={
                      secondaryColor
                    }
                  />

                  <Text
                    style={[
                      styles.composerClearText,
                      {
                        color:
                          secondaryColor,
                      },
                    ]}
                  >
                    Limpar
                  </Text>
                </TouchableOpacity>
              ) : null}
            </View>
          </View>

          {loading ? (
            <View
              style={[
                styles.feedNotice,
                {
                  backgroundColor:
                    cardColor,
                  borderColor,
                },
              ]}
            >
              <View
                style={[
                  styles.noticeIcon,
                  {
                    backgroundColor:
                      greenLight,
                  },
                ]}
              >
                <ActivityIndicator
                  size="small"
                  color={
                    green
                  }
                />
              </View>

              <View
                style={
                  styles.noticeBody
                }
              >
                <Text
                  style={[
                    styles.noticeTitle,
                    {
                      color:
                        textColor,
                    },
                  ]}
                >
                  A procurar livros
                </Text>

                <Text
                  style={[
                    styles.noticeText,
                    {
                      color:
                        secondaryColor,
                    },
                  ]}
                >
                  Consultando os catálogos disponíveis...
                </Text>
              </View>
            </View>
          ) : null}

          {!loading &&
            !erro &&
            !ultimaPesquisa ? (
            <View
              style={[
                styles.welcomePost,
                {
                  backgroundColor:
                    cardColor,
                  borderColor,
                },
              ]}
            >
              <View
                style={
                  styles.welcomeHeader
                }
              >
                <View
                  style={[
                    styles.welcomeAvatar,
                    {
                      backgroundColor:
                        green,
                    },
                  ]}
                >
                  <MaterialCommunityIcons
                    name="bookshelf"
                    size={21}
                    color="#FFFFFF"
                  />
                </View>

                <View
                  style={
                    styles.welcomeIdentity
                  }
                >
                  <Text
                    style={[
                      styles.welcomeName,
                      {
                        color:
                          textColor,
                      },
                    ]}
                  >
                    MedeaSocial
                  </Text>

                  <View
                    style={
                      styles.welcomeMeta
                    }
                  >
                    <Text
                      style={[
                        styles.welcomeMetaText,
                        {
                          color:
                            secondaryColor,
                        },
                      ]}
                    >
                      Descobrir livros
                    </Text>

                    <Text
                      style={[
                        styles.postDot,
                        {
                          color:
                            secondaryColor,
                        },
                      ]}
                    >
                      •
                    </Text>

                    <MaterialCommunityIcons
                      name="earth"
                      size={11}
                      color={
                        secondaryColor
                      }
                    />
                  </View>
                </View>
              </View>

              <Text
                style={[
                  styles.welcomeTitle,
                  {
                    color:
                      textColor,
                  },
                ]}
              >
                Encontre o seu próximo livro
              </Text>

              <Text
                style={[
                  styles.welcomeText,
                  {
                    color:
                      secondaryColor,
                  },
                ]}
              >
                Pesquise por título, autor ou assunto.
                A pesquisa consulta diferentes catálogos
                para encontrar livros reais e permitir que
                você os guarde na sua estante.
              </Text>

              <View
                style={
                  styles.welcomeFeatures
                }
              >
                <View
                  style={
                    styles.welcomeFeature
                  }
                >
                  <MaterialCommunityIcons
                    name="magnify"
                    size={17}
                    color={
                      green
                    }
                  />

                  <Text
                    style={[
                      styles.welcomeFeatureText,
                      {
                        color:
                          textColor,
                      },
                    ]}
                  >
                    Pesquise livros reais
                  </Text>
                </View>

                <View
                  style={
                    styles.welcomeFeature
                  }
                >
                  <MaterialCommunityIcons
                    name="bookmark-plus-outline"
                    size={17}
                    color={
                      green
                    }
                  />

                  <Text
                    style={[
                      styles.welcomeFeatureText,
                      {
                        color:
                          textColor,
                      },
                    ]}
                  >
                    Adicione à sua estante
                  </Text>
                </View>

                <View
                  style={
                    styles.welcomeFeature
                  }
                >
                  <MaterialCommunityIcons
                    name="sync"
                    size={17}
                    color={
                      green
                    }
                  />

                  <Text
                    style={[
                      styles.welcomeFeatureText,
                      {
                        color:
                          textColor,
                      },
                    ]}
                  >
                    Mantenha tudo sincronizado
                  </Text>
                </View>
              </View>
            </View>
          ) : null}

          {erro && !loading ? (
            <View
              style={[
                styles.errorPost,
                {
                  backgroundColor:
                    cardColor,
                  borderColor:
                    isDark
                      ? "#55302D"
                      : "#EFD4D1",
                },
              ]}
            >
              <View
                style={
                  styles.errorIcon
                }
              >
                <MaterialCommunityIcons
                  name="cloud-alert"
                  size={24}
                  color={
                    isDark
                      ? "#EF6B6B"
                      : "#D94B4B"
                  }
                />
              </View>

              <View
                style={
                  styles.errorBody
                }
              >
                <Text
                  style={[
                    styles.errorTitle,
                    {
                      color:
                        textColor,
                    },
                  ]}
                >
                  Não foi possível pesquisar
                </Text>

                <Text
                  style={[
                    styles.errorMessage,
                    {
                      color:
                        secondaryColor,
                    },
                  ]}
                >
                  {String(
                    erro
                  )}
                </Text>

                {detalhe ? (
                  <View
                    style={[
                      styles.diagnostic,
                      {
                        backgroundColor:
                          isDark
                            ? "#20252A"
                            : "#F0F2F5",
                        borderColor,
                      },
                    ]}
                  >
                    <View
                      style={
                        styles.diagnosticHeader
                      }
                    >
                      <MaterialCommunityIcons
                        name="information-outline"
                        size={14}
                        color={
                          secondaryColor
                        }
                      />

                      <Text
                        style={[
                          styles.diagnosticTitle,
                          {
                            color:
                              secondaryColor,
                          },
                        ]}
                      >
                        Diagnóstico
                      </Text>
                    </View>

                    <Text
                      style={[
                        styles.diagnosticText,
                        {
                          color:
                            textColor,
                        },
                      ]}
                    >
                      {String(
                        detalhe
                      )}
                    </Text>
                  </View>
                ) : null}

                <TouchableOpacity
                  activeOpacity={0.82}
                  onPress={() =>
                    pesquisar(
                      ultimaPesquisa ||
                      query
                    )
                  }
                  style={[
                    styles.retryButton,
                    {
                      backgroundColor:
                        green,
                    },
                  ]}
                >
                  <MaterialCommunityIcons
                    name="refresh"
                    size={17}
                    color="#FFFFFF"
                  />

                  <Text
                    style={
                      styles.retryText
                    }
                  >
                    Tentar novamente
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
          ) : null}

          {!loading &&
            !erro &&
            ultimaPesquisa &&
            resultadosUnicos.length >
            0 ? (
            <View
              style={[
                styles.resultsHeader,
                {
                  backgroundColor:
                    cardColor,
                  borderColor,
                },
              ]}
            >
              <View
                style={
                  styles.resultsHeaderLeft
                }
              >
                <View
                  style={[
                    styles.resultsAvatar,
                    {
                      backgroundColor:
                        green,
                    },
                  ]}
                >
                  <MaterialCommunityIcons
                    name="magnify"
                    size={18}
                    color="#FFFFFF"
                  />
                </View>

                <View
                  style={
                    styles.resultsHeaderText
                  }
                >
                  <Text
                    style={[
                      styles.resultsHeaderTitle,
                      {
                        color:
                          textColor,
                      },
                    ]}
                  >
                    Resultados da pesquisa
                  </Text>

                  <Text
                    numberOfLines={1}
                    style={[
                      styles.resultsHeaderSubtitle,
                      {
                        color:
                          secondaryColor,
                      },
                    ]}
                  >
                    {String(
                      resultadosUnicos.length
                    )}{" "}
                    livros para "
                    {String(
                      ultimaPesquisa
                    )}
                    "
                  </Text>
                </View>
              </View>

              <View
                style={[
                  styles.resultsBadge,
                  {
                    backgroundColor:
                      greenLight,
                  },
                ]}
              >
                <Text
                  style={[
                    styles.resultsBadgeText,
                    {
                      color:
                        green,
                    },
                  ]}
                >
                  {String(
                    resultadosUnicos.length
                  )}
                </Text>
              </View>
            </View>
          ) : null}

          {!loading &&
            !erro &&
            ultimaPesquisa &&
            resultadosUnicos.length ===
            0 ? (
            <View
              style={[
                styles.emptyPost,
                {
                  backgroundColor:
                    cardColor,
                  borderColor,
                },
              ]}
            >
              <View
                style={[
                  styles.emptyIcon,
                  {
                    backgroundColor:
                      greenLight,
                  },
                ]}
              >
                <MaterialCommunityIcons
                  name="book-search-outline"
                  size={30}
                  color={
                    green
                  }
                />
              </View>

              <Text
                style={[
                  styles.emptyTitle,
                  {
                    color:
                      textColor,
                  },
                ]}
              >
                Nenhum livro encontrado
              </Text>

              <Text
                style={[
                  styles.emptyMessage,
                  {
                    color:
                      secondaryColor,
                  },
                ]}
              >
                Não encontramos livros para "
                {String(
                  ultimaPesquisa
                )}
                ". Tente outro título, autor ou assunto.
              </Text>

              <View
                style={[
                  styles.emptyHint,
                  {
                    backgroundColor:
                      greenSoft,
                  },
                ]}
              >
                <MaterialCommunityIcons
                  name="lightbulb-outline"
                  size={16}
                  color={
                    green
                  }
                />

                <Text
                  style={[
                    styles.emptyHintText,
                    {
                      color:
                        secondaryColor,
                    },
                  ]}
                >
                  Experimente pesquisar pelo nome completo
                  do livro ou autor.
                </Text>
              </View>
            </View>
          ) : null}
        </>
      ),
      [
        abrirEstante,
        cardColor,
        borderColor,
        detalhe,
        erro,
        executarPesquisa,
        fontePesquisa,
        green,
        greenLight,
        greenSoft,
        isDark,
        limpar,
        loading,
        ultimaPesquisa,
        query,
        pesquisar,
        resultadosUnicos.length,
        secondaryColor,
        textColor,
      ]
    );

  return (
    <SafeAreaView
      style={[
        styles.safeArea,
        {
          backgroundColor:
            backgroundColor,
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
          backgroundColor
        }
      />

      <View
        style={
          styles.container
        }
      >
        <View
          style={[
            styles.topBar,
            {
              backgroundColor:
                cardColor,
              borderBottomColor:
                borderColor,
            },
          ]}
        >
          <View
            style={
              styles.topBarLeft
            }
          >
            <View
              style={[
                styles.topBarLogo,
                {
                  backgroundColor:
                    green,
                },
              ]}
            >
              <MaterialCommunityIcons
                name="book-open-page-variant"
                size={22}
                color="#FFFFFF"
              />
            </View>

            <View
              style={
                styles.topBarTitles
              }
            >
              <Text
                style={[
                  styles.topBarTitle,
                  {
                    color:
                      textColor,
                  },
                ]}
              >
                Procurar
              </Text>

              <Text
                style={[
                  styles.topBarSubtitle,
                  {
                    color:
                      secondaryColor,
                  },
                ]}
              >
                Livros
              </Text>
            </View>
          </View>

          <View
            style={
              styles.topBarActions
            }
          >
            <TouchableOpacity
              activeOpacity={0.78}
              onPress={
                abrirEstante
              }
              style={[
                styles.topBarButton,
                {
                  backgroundColor:
                    greenLight,
                },
              ]}
            >
              <MaterialCommunityIcons
                name="bookshelf"
                size={21}
                color={
                  green
                }
              />
            </TouchableOpacity>
          </View>
        </View>

        <FlatList
          data={
            resultadosUnicos
          }
          renderItem={
            renderLivro
          }
          keyExtractor={(item) =>
            String(
              item.id
            )
          }
          showsVerticalScrollIndicator={
            false
          }
          keyboardShouldPersistTaps="handled"
          refreshControl={
            <RefreshControl
              refreshing={
                refreshing
              }
              onRefresh={
                atualizar
              }
              tintColor={
                green
              }
              colors={[
                green,
              ]}
            />
          }
          contentContainerStyle={
            styles.listContent
          }
          ListHeaderComponent={
            headerContent
          }
          ListFooterComponent={
            resultadosUnicos.length >
              0 ? (
              <View
                style={
                  styles.footer
                }
              >
                <View
                  style={[
                    styles.footerDivider,
                    {
                      backgroundColor:
                        borderColor,
                    },
                  ]}
                />

                <MaterialCommunityIcons
                  name={
                    fontePesquisa ===
                      "google"
                      ? "google"
                      : fontePesquisa ===
                        "openlibrary"
                        ? "library-outline"
                        : "database-outline"
                  }
                  size={14}
                  color={
                    secondaryColor
                  }
                />

                <Text
                  style={[
                    styles.footerText,
                    {
                      color:
                        secondaryColor,
                    },
                  ]}
                >
                  Fonte:{" "}
                  {String(
                    nomeFonte
                  )}
                </Text>
              </View>
            ) : (
              <View
                style={
                  styles.bottomSpace
                }
              />
            )
          }
        />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
  },

  container: {
    flex: 1,
  },

  /*
   * Barra superior simples de rede social.
   */
  topBar: {
    minHeight: 64,
    paddingHorizontal: 15,
    paddingTop:
      Platform.OS === "android"
        ? 5
        : 0,
    paddingBottom: 7,
    borderBottomWidth: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },

  topBarLeft: {
    flexDirection: "row",
    alignItems: "center",
    minWidth: 0,
  },

  topBarLogo: {
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: "center",
    justifyContent: "center",
  },

  topBarTitles: {
    marginLeft: 10,
  },

  topBarTitle: {
    fontSize: 17,
    lineHeight: 20,
    fontWeight: "900",
    letterSpacing: -0.2,
  },

  topBarSubtitle: {
    fontSize: 9,
    lineHeight: 12,
    marginTop: 1,
  },

  topBarActions: {
    flexDirection: "row",
    alignItems: "center",
  },

  topBarButton: {
    width: 39,
    height: 39,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
  },

  /*
   * O conteúdo agora ocupa quase toda a largura,
   * como publicações de uma rede social.
   */
  listContent: {
    paddingTop: 8,
    paddingBottom: 25,
  },

  /*
   * Caixa de pesquisa semelhante ao compositor
   * de uma rede social.
   */
  searchComposer: {
    borderWidth: 1,
    borderRadius: 0,
    borderLeftWidth: 0,
    borderRightWidth: 0,
    paddingHorizontal: 14,
    paddingTop: 13,
    paddingBottom: 12,
    marginBottom: 8,
  },

  composerHeader: {
    flexDirection: "row",
    alignItems: "center",
  },

  composerAvatar: {
    width: 43,
    height: 43,
    borderRadius: 22,
    alignItems: "center",
    justifyContent: "center",
  },

  composerIdentity: {
    flex: 1,
    minWidth: 0,
    marginLeft: 10,
  },

  composerTitle: {
    fontSize: 14,
    lineHeight: 18,
    fontWeight: "900",
  },

  composerSubtitle: {
    fontSize: 10,
    lineHeight: 14,
    marginTop: 1,
  },

  composerLibrary: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
  },

  socialSearchInput: {
    minHeight: 46,
    marginTop: 12,
    borderWidth: 1,
    borderRadius: 23,
    paddingHorizontal: 14,
    flexDirection: "row",
    alignItems: "center",
  },

  socialInput: {
    flex: 1,
    minHeight: 44,
    marginLeft: 8,
    fontSize: 12,
    fontWeight: "500",
  },

  composerActions: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 9,
  },

  composerSearchButton: {
    flex: 1,
    minHeight: 40,
    borderRadius: 8,
    paddingHorizontal: 14,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
  },

  composerSearchText: {
    fontSize: 11,
    fontWeight: "900",
  },

  composerClearButton: {
    minHeight: 40,
    paddingHorizontal: 12,
    marginLeft: 7,
    borderRadius: 8,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 3,
  },

  composerClearText: {
    fontSize: 10,
    fontWeight: "700",
  },

  inputClear: {
    paddingLeft: 7,
  },

  /*
   * Aviso de pesquisa.
   */
  feedNotice: {
    minHeight: 63,
    borderWidth: 1,
    borderLeftWidth: 0,
    borderRightWidth: 0,
    paddingHorizontal: 14,
    paddingVertical: 10,
    marginBottom: 8,
    flexDirection: "row",
    alignItems: "center",
  },

  noticeIcon: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: "center",
    justifyContent: "center",
  },

  noticeBody: {
    flex: 1,
    marginLeft: 10,
  },

  noticeTitle: {
    fontSize: 12,
    fontWeight: "900",
  },

  noticeText: {
    fontSize: 9.5,
    marginTop: 2,
  },

  /*
   * Publicação de boas-vindas.
   */
  welcomePost: {
    borderWidth: 1,
    borderLeftWidth: 0,
    borderRightWidth: 0,
    paddingHorizontal: 14,
    paddingTop: 14,
    paddingBottom: 15,
    marginBottom: 8,
  },

  welcomeHeader: {
    flexDirection: "row",
    alignItems: "center",
  },

  welcomeAvatar: {
    width: 43,
    height: 43,
    borderRadius: 22,
    alignItems: "center",
    justifyContent: "center",
  },

  welcomeIdentity: {
    flex: 1,
    marginLeft: 10,
  },

  welcomeName: {
    fontSize: 13,
    fontWeight: "900",
  },

  welcomeMeta: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 2,
    gap: 4,
  },

  welcomeMetaText: {
    fontSize: 9,
  },

  welcomeTitle: {
    fontSize: 17,
    lineHeight: 22,
    fontWeight: "900",
    marginTop: 15,
  },

  welcomeText: {
    fontSize: 11,
    lineHeight: 18,
    marginTop: 5,
  },

  welcomeFeatures: {
    marginTop: 13,
    paddingTop: 11,
    borderTopWidth: 1,
    borderTopColor: "#E4E6E9",
    gap: 10,
  },

  welcomeFeature: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },

  welcomeFeatureText: {
    fontSize: 10,
    fontWeight: "700",
  },

  /*
   * Cabeçalho dos resultados.
   */
  resultsHeader: {
    minHeight: 61,
    borderWidth: 1,
    borderLeftWidth: 0,
    borderRightWidth: 0,
    paddingHorizontal: 14,
    paddingVertical: 9,
    marginBottom: 8,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },

  resultsHeaderLeft: {
    flex: 1,
    minWidth: 0,
    flexDirection: "row",
    alignItems: "center",
  },

  resultsAvatar: {
    width: 39,
    height: 39,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
  },

  resultsHeaderText: {
    flex: 1,
    minWidth: 0,
    marginLeft: 9,
  },

  resultsHeaderTitle: {
    fontSize: 12,
    fontWeight: "900",
  },

  resultsHeaderSubtitle: {
    fontSize: 9,
    marginTop: 2,
  },

  resultsBadge: {
    minWidth: 34,
    height: 34,
    borderRadius: 17,
    paddingHorizontal: 7,
    alignItems: "center",
    justifyContent: "center",
    marginLeft: 8,
  },

  resultsBadgeText: {
    fontSize: 12,
    fontWeight: "900",
  },

  /*
   * PUBLICAÇÃO — principal mudança visual.
   *
   * Não existe mais o antigo bookCard.
   * Cada livro é apresentado como uma publicação.
   */
  socialPost: {
    borderWidth: 1,
    borderLeftWidth: 0,
    borderRightWidth: 0,
    marginBottom: 8,
    paddingTop: 13,
  },

  postHeader: {
    paddingHorizontal: 14,
    flexDirection: "row",
    alignItems: "center",
  },

  postAvatar: {
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: "center",
    justifyContent: "center",
  },

  postIdentity: {
    flex: 1,
    minWidth: 0,
    marginLeft: 9,
  },

  postNameRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },

  postAuthor: {
    fontSize: 12.5,
    fontWeight: "900",
  },

  postMetaRow: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 2,
    gap: 4,
  },

  postMeta: {
    fontSize: 9,
  },

  postDot: {
    fontSize: 9,
  },

  postMoreButton: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: "center",
    justifyContent: "center",
  },

  postTextArea: {
    paddingHorizontal: 14,
    paddingTop: 11,
    paddingBottom: 11,
  },

  postText: {
    fontSize: 11.5,
    lineHeight: 17,
  },

  postDescription: {
    fontSize: 10,
    lineHeight: 16,
    marginTop: 6,
  },

  /*
   * Conteúdo do livro dentro da publicação.
   */
  bookPublication: {
    marginHorizontal: 14,
    borderWidth: 1,
    borderRadius: 8,
    padding: 9,
    flexDirection: "row",
    overflow: "hidden",
  },

  socialBookCover: {
    width: 91,
    height: 130,
    borderRadius: 5,
    backgroundColor: "#E4E6E9",
  },

  socialBookInfo: {
    flex: 1,
    minWidth: 0,
    marginLeft: 10,
  },

  socialSourceRow: {
    minHeight: 20,
    flexDirection: "row",
    alignItems: "center",
  },

  sourcePill: {
    borderRadius: 5,
    paddingHorizontal: 6,
    paddingVertical: 3,
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
  },

  sourcePillText: {
    fontSize: 7,
    fontWeight: "900",
  },

  socialBookTitle: {
    fontSize: 15,
    lineHeight: 19,
    fontWeight: "900",
    marginTop: 5,
  },

  socialAuthorRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    marginTop: 5,
  },

  socialBookAuthor: {
    flex: 1,
    fontSize: 9.5,
    lineHeight: 14,
    fontWeight: "600",
  },

  socialBookMeta: {
    flexDirection: "row",
    flexWrap: "wrap",
    alignItems: "center",
    gap: 8,
    marginTop: 5,
  },

  socialMetaItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
  },

  socialMetaText: {
    fontSize: 8,
    fontWeight: "600",
  },

  socialPublisher: {
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
    marginTop: 5,
  },

  socialPublisherText: {
    flex: 1,
    fontSize: 8,
  },

  socialCategory: {
    alignSelf: "flex-start",
    maxWidth: 150,
    borderRadius: 5,
    paddingHorizontal: 6,
    paddingVertical: 3,
    marginTop: 5,
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
  },

  socialCategoryText: {
    flexShrink: 1,
    fontSize: 7.5,
    fontWeight: "800",
  },

  /*
   * Ação real da estante.
   */
  socialShelfAction: {
    minHeight: 35,
    borderRadius: 6,
    borderWidth: 1,
    marginTop: 8,
    paddingHorizontal: 9,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 5,
  },

  socialShelfActionText: {
    fontSize: 9,
    fontWeight: "900",
  },

  /*
   * Estatísticas da publicação.
   */
  postStats: {
    minHeight: 39,
    marginTop: 8,
    marginHorizontal: 14,
    borderBottomWidth: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },

  postStatsLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
  },

  postReactionIcon: {
    width: 18,
    height: 18,
    borderRadius: 9,
    alignItems: "center",
    justifyContent: "center",
  },

  postStatsText: {
    fontSize: 8.5,
  },

  /*
   * Barra semelhante a:
   * Gosto | Comentar | Partilhar
   */
  postActions: {
    minHeight: 45,
    marginHorizontal: 7,
    flexDirection: "row",
    alignItems: "center",
  },

  postAction: {
    flex: 1,
    height: 40,
    borderRadius: 6,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 5,
  },

  postActionText: {
    fontSize: 9.5,
    fontWeight: "700",
  },

  /*
   * Erros.
   */
  errorPost: {
    borderWidth: 1,
    borderLeftWidth: 0,
    borderRightWidth: 0,
    paddingHorizontal: 14,
    paddingVertical: 13,
    marginBottom: 8,
    flexDirection: "row",
  },

  errorIcon: {
    width: 43,
    height: 43,
    borderRadius: 21,
    backgroundColor:
      "rgba(217,75,75,0.09)",
    alignItems: "center",
    justifyContent: "center",
  },

  errorBody: {
    flex: 1,
    minWidth: 0,
    marginLeft: 10,
  },

  errorTitle: {
    fontSize: 12.5,
    lineHeight: 17,
    fontWeight: "900",
  },

  errorMessage: {
    fontSize: 10,
    lineHeight: 16,
    marginTop: 4,
  },

  diagnostic: {
    borderRadius: 7,
    borderWidth: 1,
    padding: 8,
    marginTop: 8,
  },

  diagnosticHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    marginBottom: 3,
  },

  diagnosticTitle: {
    fontSize: 8,
    fontWeight: "900",
    textTransform: "uppercase",
    letterSpacing: 0.3,
  },

  diagnosticText: {
    fontSize: 8.5,
    lineHeight: 13,
  },

  retryButton: {
    minHeight: 36,
    borderRadius: 7,
    paddingHorizontal: 11,
    alignSelf: "flex-start",
    marginTop: 9,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 5,
  },

  retryText: {
    color: "#FFFFFF",
    fontSize: 9,
    fontWeight: "900",
  },

  /*
   * Estado vazio.
   */
  emptyPost: {
    borderWidth: 1,
    borderLeftWidth: 0,
    borderRightWidth: 0,
    paddingHorizontal: 20,
    paddingVertical: 25,
    alignItems: "center",
    marginBottom: 8,
  },

  emptyIcon: {
    width: 62,
    height: 62,
    borderRadius: 31,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 12,
  },

  emptyTitle: {
    fontSize: 17,
    lineHeight: 22,
    fontWeight: "900",
    textAlign: "center",
  },

  emptyMessage: {
    fontSize: 10.5,
    lineHeight: 17,
    textAlign: "center",
    marginTop: 5,
    maxWidth: 330,
  },

  emptyHint: {
    width: "100%",
    minHeight: 42,
    borderRadius: 7,
    marginTop: 14,
    paddingHorizontal: 10,
    flexDirection: "row",
    alignItems: "center",
    gap: 7,
  },

  emptyHintText: {
    flex: 1,
    fontSize: 9,
    lineHeight: 14,
    fontWeight: "600",
  },

  /*
   * Rodapé.
   */
  footer: {
    alignItems: "center",
    paddingTop: 7,
    paddingBottom: 13,
    gap: 5,
  },

  footerDivider: {
    width: "92%",
    height: 1,
    marginBottom: 5,
  },

  footerText: {
    fontSize: 8,
    textAlign: "center",
  },

  bottomSpace: {
    height: 18,
  },
});
