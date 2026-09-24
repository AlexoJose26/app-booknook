import { useUsuario } from "@/contexts/UsuarioContext";
import { getDb } from "@/database/db";
import { criticas, estantes, livros, usuarios } from "@/database/schema";
import {
  criarComentario,
  listarComentarios,
  obterEstatisticasCritica,
  toggleCurtida,
} from "@/database/services/socialService";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { desc, eq } from "drizzle-orm";
import { useFocusEffect } from "expo-router";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
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

type FeedItemType = "livro" | "critica";
type ReactionType = "gosto" | "adoro" | "riso" | "tristeza" | "raiva";

type FeedItem = {
  type: FeedItemType;
  id: string;
  usuarioId: string;
  usuarioNome: string;
  usuarioFoto: string | null;
  livroId: string;
  livroTitulo: string;
  livroAutor: string;
  livroImagem: string | null;
  texto?: string;
  nota?: number;
  criticaId?: number;
  createdAt: string;
};

type EstatisticaLocal = {
  curtidas: number;
  comentarios: number;
  curtiu: boolean;
  reaction?: ReactionType | null;
};

type ComentarioLocal = {
  id: string | number;
  postId: string;
  texto: string;
  createdAt?: string;
  usuario?: { id?: string; nome?: string | null; foto_perfil?: string | null } | null;
};

type NotificacaoLocal = {
  id: string;
  tipo: "livro" | "critica";
  titulo: string;
  mensagem: string;
  data: string;
  lida: boolean;
};

type Dashboard = {
  livrosLidos: number;
  publicacoes: number;
  usuarios: number;
  livros: number;
  curtidas: number;
  comentarios: number;
};

const REACTION_META: Record<ReactionType, { label: string; icon: string; color: string }> = {
  gosto: { label: "Gosto", icon: "thumb-up", color: "#1877F2" },
  adoro: { label: "Adoro", icon: "heart", color: "#E41E3F" },
  riso: { label: "Riso", icon: "emoticon-happy-outline", color: "#F7B928" },
  tristeza: { label: "Tristeza", icon: "emoticon-sad-outline", color: "#F7B928" },
  raiva: { label: "Raiva", icon: "emoticon-angry-outline", color: "#E41E3F" },
};

const REACTION_ORDER: ReactionType[] = ["gosto", "adoro", "riso", "tristeza", "raiva"];

function normalizarFotoUri(foto?: string | null): string | null {
  if (!foto) return null;
  const valor = String(foto).trim();
  if (!valor) return null;
  if (/^(https?|file|content):\/\//i.test(valor) || valor.startsWith("data:image/")) {
    return valor.replace(/^http:\/\//i, "https://");
  }
  if (valor.startsWith("/") || /^[A-Za-z]:[\\/]/.test(valor)) return `file://${valor}`;
  return valor;
}

function dataSegura(valor?: string | null) {
  if (!valor) return new Date();
  const d = new Date(valor);
  return Number.isNaN(d.getTime()) ? new Date() : d;
}

function formatarData(valor?: string | null) {
  const d = dataSegura(valor);
  const diff = Date.now() - d.getTime();
  const min = Math.floor(diff / 60000);
  if (min < 1) return "agora";
  if (min < 60) return `${min} min`;
  const h = Math.floor(min / 60);
  if (h < 24) return `${h} h`;
  const days = Math.floor(h / 24);
  if (days < 7) return `${days} d`;
  return d.toLocaleDateString("pt-PT", { day: "2-digit", month: "2-digit", year: "numeric" });
}

const Avatar = ({ nome, foto, size = 44, backgroundColor, textColor }: { nome?: string | null; foto?: string | null; size?: number; backgroundColor: string; textColor: string }) => {
  const uri = useMemo(() => normalizarFotoUri(foto), [foto]);
  const letra = nome?.trim()?.charAt(0)?.toUpperCase() || "L";
  const box = { width: size, height: size, borderRadius: size / 2, backgroundColor, overflow: "hidden" as const };
  if (uri) return <View style={box}><Image source={{ uri }} style={{ width: size, height: size }} resizeMode="cover" fadeDuration={0} /></View>;
  return <View style={[box, { alignItems: "center", justifyContent: "center" }]}><Text style={{ color: textColor, fontSize: Math.max(14, size * 0.38), fontWeight: "900" }}>{letra}</Text></View>;
};

export default function Feed() {
  const colorScheme = useColorScheme();
  const isDark = colorScheme === "dark";
  const { usuario, carregarUsuario } = useUsuario();
  const colors = {
    background: isDark ? "#111827" : "#F0F2F5", card: isDark ? "#172033" : "#FFFFFF", cardSecondary: isDark ? "#202B3D" : "#F7F8FA",
    text: isDark ? "#F5F7FA" : "#1C1E21", secondary: isDark ? "#A8B3C2" : "#65676B", primary: "#1877F2", primaryDark: "#0D65D9",
    primaryLight: isDark ? "#17345D" : "#E7F3FF", border: isDark ? "#29384D" : "#DADDE1", softBorder: isDark ? "#26364A" : "#E4E6EB",
    muted: isDark ? "#273449" : "#E4E6EB", mutedText: isDark ? "#8997A9" : "#65676B", white: "#FFFFFF", gold: "#F7B928",
    liked: "#E41E3F", avatarBackground: isDark ? "#243752" : "#DCE7F7", avatarText: isDark ? "#BBD6FF" : "#1877F2",
    actionBackground: isDark ? "#202B3D" : "#F0F2F5", actionText: isDark ? "#C7D0DC" : "#65676B", overlay: "rgba(0,0,0,0.55)",
  };
  const [feed, setFeed] = useState<FeedItem[]>([]);
  const [estatisticas, setEstatisticas] = useState<Record<string, EstatisticaLocal>>({});
  const [refreshing, setRefreshing] = useState(false);
  const [carregando, setCarregando] = useState(true);
  const [textoPesquisa, setTextoPesquisa] = useState("");
  const [pesquisaAberta, setPesquisaAberta] = useState(false);
  const [menuAberto, setMenuAberto] = useState(false);
  const [notificacoesAbertas, setNotificacoesAbertas] = useState(false);
  const [notificacoes, setNotificacoes] = useState<NotificacaoLocal[]>([]);
  const [dashboardAberto, setDashboardAberto] = useState(false);
  const [dashboard, setDashboard] = useState<Dashboard | null>(null);
  const [fotoPerfilFeed, setFotoPerfilFeed] = useState<string | null>(null);
  const [nomePerfilFeed, setNomePerfilFeed] = useState("Leitor");
  const [comentariosAbertos, setComentariosAbertos] = useState(false);
  const [publicacaoSelecionada, setPublicacaoSelecionada] = useState<FeedItem | null>(null);
  const [comentarios, setComentarios] = useState<ComentarioLocal[]>([]);
  const [novoComentario, setNovoComentario] = useState("");
  const [carregandoComentarios, setCarregandoComentarios] = useState(false);
  const [enviandoComentario, setEnviandoComentario] = useState(false);
  const [reacoesAberta, setReacoesAberta] = useState<string | null>(null);
  const [processando, setProcessando] = useState<Set<string>>(new Set());
  const sincronizando = useRef(false);

  const currentId = usuario?.id ? String(usuario.id) : null;
  const nomeAtual = nomePerfilFeed || usuario?.nome?.trim() || "Leitor";
  const fotoAtual = fotoPerfilFeed ?? usuario?.foto_perfil ?? null;

  const chave = (item: FeedItem) => `${item.type}:${item.id}`;
  const sessionId = useCallback(async () => {
    try {
      const raw = await AsyncStorage.getItem("usuarioLogado");
      const parsed = raw ? JSON.parse(raw) : null;
      if (parsed?.id) return String(parsed.id);
    } catch {
      // Usa o contexto como fallback.
    }
    return currentId;
  }, [currentId]);

  const carregarFeed = useCallback(async () => {
    const db = await getDb();
    const idAtual = await sessionId();
    let nomeDoBanco = nomeAtual;
    let fotoDoBanco = fotoAtual;
    if (idAtual) {
      const rows = await db.select({ id: usuarios.id, nome: usuarios.nome, foto_perfil: usuarios.foto_perfil }).from(usuarios).where(eq(usuarios.id, idAtual)).limit(1);
      if (rows[0]) {
        nomeDoBanco = rows[0].nome || nomeDoBanco;
        fotoDoBanco = rows[0].foto_perfil ?? null;
      }
    }
    setNomePerfilFeed(nomeDoBanco || "Leitor");
    setFotoPerfilFeed(fotoDoBanco || null);
    const lidos = await db.select({ id: estantes.id, usuarioId: estantes.usuario_id, usuarioNome: usuarios.nome, usuarioFoto: usuarios.foto_perfil, livroId: livros.id, titulo: livros.titulo, autor: livros.autor, imagem: livros.imagem, createdAt: estantes.createdAt }).from(estantes).innerJoin(livros, eq(estantes.livro_id, livros.id)).innerJoin(usuarios, eq(estantes.usuario_id, usuarios.id)).where(eq(estantes.status, "lido")).orderBy(desc(estantes.id));
    const reviews = await db.select({ id: criticas.id, usuarioId: criticas.usuario_id, usuarioNome: usuarios.nome, usuarioFoto: usuarios.foto_perfil, livroId: livros.id, titulo: livros.titulo, autor: livros.autor, imagem: livros.imagem, texto: criticas.texto, nota: criticas.nota, createdAt: criticas.createdAt }).from(criticas).innerJoin(livros, eq(criticas.livro_id, livros.id)).innerJoin(usuarios, eq(criticas.usuario_id, usuarios.id)).orderBy(desc(criticas.id));
    const livrosFeed: FeedItem[] = lidos.map(r => ({ type: "livro", id: String(r.id), usuarioId: String(r.usuarioId), usuarioNome: String(r.usuarioId) === idAtual ? nomeDoBanco : (r.usuarioNome || "Leitor"), usuarioFoto: String(r.usuarioId) === idAtual ? fotoDoBanco : (r.usuarioFoto ?? null), livroId: String(r.livroId), livroTitulo: r.titulo || "Livro", livroAutor: r.autor || "Autor desconhecido", livroImagem: r.imagem ?? null, createdAt: String(r.createdAt || new Date().toISOString()) }));
    const criticasFeed: FeedItem[] = reviews.map(r => ({ type: "critica", id: String(r.id), criticaId: Number(r.id), usuarioId: String(r.usuarioId), usuarioNome: String(r.usuarioId) === idAtual ? nomeDoBanco : (r.usuarioNome || "Leitor"), usuarioFoto: String(r.usuarioId) === idAtual ? fotoDoBanco : (r.usuarioFoto ?? null), livroId: String(r.livroId), livroTitulo: r.titulo || "Livro", livroAutor: r.autor || "Autor desconhecido", livroImagem: r.imagem ?? null, texto: r.texto || "", nota: Number(r.nota || 0), createdAt: String(r.createdAt || new Date().toISOString()) }));
    const todos = [...livrosFeed, ...criticasFeed].sort((a, b) => dataSegura(b.createdAt).getTime() - dataSegura(a.createdAt).getTime());
    setFeed(todos);
    const saved = JSON.parse((await AsyncStorage.getItem("feedReacoes")) || "{}");
    const next: Record<string, EstatisticaLocal> = { ...saved };
    for (const item of todos) {
      const k = chave(item);
      if (item.type === "critica" && item.criticaId) {
        try { const s = await obterEstatisticasCritica(item.criticaId, idAtual || undefined); next[k] = { ...next[k], curtidas: s.curtidas, comentarios: s.comentarios, curtiu: s.curtiu, reaction: next[k]?.reaction || null }; } catch { next[k] = next[k] || { curtidas: 0, comentarios: 0, curtiu: false, reaction: null }; }
      } else next[k] = next[k] || { curtidas: 0, comentarios: 0, curtiu: false, reaction: null };
    }
    setEstatisticas(next);
    await AsyncStorage.setItem("feedReacoes", JSON.stringify(next));
  }, [currentId, fotoAtual, nomeAtual, sessionId]);

  const carregarNotificacoes = useCallback(async () => { try { setNotificacoes(JSON.parse((await AsyncStorage.getItem("feedNotificacoes")) || "[]")); } catch { setNotificacoes([]); } }, []);
  const salvarEstatisticas = useCallback(async (v: Record<string, EstatisticaLocal>) => { setEstatisticas(v); await AsyncStorage.setItem("feedReacoes", JSON.stringify(v)); }, []);

  const sincronizar = useCallback(async (loading = false) => {
    if (sincronizando.current) return;
    sincronizando.current = true;
    if (loading) setCarregando(true);
    try { await carregarUsuario(); await carregarNotificacoes(); await carregarFeed(); }
    finally { sincronizando.current = false; setCarregando(false); setRefreshing(false); }
  }, [carregarFeed, carregarNotificacoes, carregarUsuario]);

  useEffect(() => { void sincronizar(true); }, [sincronizar]);
  useFocusEffect(useCallback(() => { void sincronizar(false); }, [sincronizar]));

  const filtrados = useMemo(() => {
    const q = textoPesquisa.trim().toLowerCase();
    if (!q) return feed;
    return feed.filter(i => `${i.usuarioNome} ${i.livroTitulo} ${i.livroAutor} ${i.texto || ""}`.toLowerCase().includes(q));
  }, [feed, textoPesquisa]);

  const selecionarReacao = useCallback(async (item: FeedItem, reaction: ReactionType) => {
    const k = chave(item);
    if (processando.has(k)) return;
    setProcessando(prev => new Set(prev).add(k));
    setReacoesAberta(null);
    try {
      const idAtual = await sessionId();
      if (!idAtual) { Alert.alert("Sessão", "Inicie sessão para reagir a uma publicação."); return; }
      const atual = estatisticas[k] || { curtidas: 0, comentarios: 0, curtiu: false, reaction: null };
      if (item.type === "critica" && item.criticaId) {
        if (atual.reaction === reaction) {
          const liked = await toggleCurtida(idAtual, item.criticaId);
          const s = await obterEstatisticasCritica(item.criticaId, idAtual);
          const next = { ...estatisticas, [k]: { curtidas: s.curtidas, comentarios: s.comentarios, curtiu: liked, reaction: null } };
          await salvarEstatisticas(next);
        } else {
          if (atual.curtiu) await toggleCurtida(idAtual, item.criticaId);
          const liked = await toggleCurtida(idAtual, item.criticaId);
          const s = await obterEstatisticasCritica(item.criticaId, idAtual);
          const next = { ...estatisticas, [k]: { curtidas: s.curtidas, comentarios: s.comentarios, curtiu: liked, reaction } };
          await salvarEstatisticas(next);
        }
      } else {
        const nextReaction = atual.reaction === reaction ? null : reaction;
        const delta = atual.reaction ? 0 : 1;
        const newCount = Math.max(0, atual.curtidas + (nextReaction ? delta : -1));
        const next = { ...estatisticas, [k]: { ...atual, curtidas: newCount, curtiu: !!nextReaction, reaction: nextReaction } };
        await salvarEstatisticas(next);
      }
    } finally { setProcessando(prev => { const n = new Set(prev); n.delete(k); return n; }); }
  }, [estatisticas, processando, salvarEstatisticas, sessionId]);

  const abrirComentarios = useCallback(async (item: FeedItem) => {
    setPublicacaoSelecionada(item); setComentariosAbertos(true); setCarregandoComentarios(true); setComentarios([]);
    try {
      if (item.type === "critica" && item.criticaId) {
        const rows = await listarComentarios(item.criticaId);
        setComentarios(rows.map(c => ({ ...c, postId: chave(item) })));
      } else {
        const raw = JSON.parse((await AsyncStorage.getItem("feedComentarios")) || "{}");
        setComentarios((raw[chave(item)] || []).map((c: ComentarioLocal) => ({ ...c, postId: chave(item) })));
      }
    } catch { setComentarios([]); } finally { setCarregandoComentarios(false); }
  }, []);

  const enviarComentario = useCallback(async () => {
    if (!publicacaoSelecionada || !novoComentario.trim() || enviandoComentario) return;
    const idAtual = await sessionId();
    if (!idAtual) { Alert.alert("Sessão", "Inicie sessão para comentar."); return; }
    setEnviandoComentario(true);
    try {
      if (publicacaoSelecionada.type === "critica" && publicacaoSelecionada.criticaId) {
        const c = await criarComentario(idAtual, publicacaoSelecionada.criticaId, novoComentario.trim());
        setComentarios(prev => [...prev, { ...c, postId: chave(publicacaoSelecionada) }]);
      } else {
        const raw = JSON.parse((await AsyncStorage.getItem("feedComentarios")) || "{}");
        const k = chave(publicacaoSelecionada);
        const c: ComentarioLocal = { id: `${Date.now()}-${idAtual}`, postId: k, texto: novoComentario.trim(), createdAt: new Date().toISOString(), usuario: { id: idAtual, nome: nomeAtual, foto_perfil: fotoAtual } };
        raw[k] = [...(raw[k] || []), c]; await AsyncStorage.setItem("feedComentarios", JSON.stringify(raw)); setComentarios(prev => [...prev, c]);
      }
      const k = chave(publicacaoSelecionada); const old = estatisticas[k] || { curtidas: 0, comentarios: 0, curtiu: false, reaction: null };
      await salvarEstatisticas({ ...estatisticas, [k]: { ...old, comentarios: old.comentarios + 1 } }); setNovoComentario("");
    } catch (e) { Alert.alert("Erro", e instanceof Error ? e.message : "Não foi possível enviar o comentário."); } finally { setEnviandoComentario(false); }
  }, [enviandoComentario, estatisticas, fotoAtual, nomeAtual, novoComentario, publicacaoSelecionada, salvarEstatisticas, sessionId]);

  const abrirDashboard = useCallback(async () => {
    setMenuAberto(false); setDashboardAberto(true);
    setDashboard(null);
    try {
      const db = await getDb();
      const lidos = await db.select({ id: estantes.id }).from(estantes).where(eq(estantes.status, "lido"));
      const posts = await db.select({ id: criticas.id }).from(criticas);
      const users = await db.select({ id: usuarios.id }).from(usuarios);
      const books = await db.select({ id: livros.id }).from(livros);
      const vals = Object.values(estatisticas);
      setDashboard({ livrosLidos: lidos.length, publicacoes: posts.length + lidos.length, usuarios: users.length, livros: books.length, curtidas: vals.reduce((n, v) => n + v.curtidas, 0), comentarios: vals.reduce((n, v) => n + v.comentarios, 0) });
    } catch { setDashboard({ livrosLidos: 0, publicacoes: 0, usuarios: 0, livros: 0, curtidas: 0, comentarios: 0 }); }
  }, [estatisticas]);

  const marcarNotificacoesLidas = async () => { const n = notificacoes.map(x => ({ ...x, lida: true })); setNotificacoes(n); await AsyncStorage.setItem("feedNotificacoes", JSON.stringify(n)); };

  const renderReactionPicker = (item: FeedItem) => {
    const k = chave(item); if (reacoesAberta !== k) return null;
    return <View style={[styles.reactionPicker, { backgroundColor: colors.card, borderColor: colors.border }]}>{REACTION_ORDER.map(r => <TouchableOpacity key={r} style={styles.reactionChoice} onPress={() => void selecionarReacao(item, r)} activeOpacity={0.8}><View style={[styles.reactionBubble, { backgroundColor: REACTION_META[r].color }]}><MaterialCommunityIcons name={REACTION_META[r].icon as any} size={20} color="#FFF" /></View><Text style={[styles.reactionLabel, { color: colors.text }]}>{REACTION_META[r].label}</Text></TouchableOpacity>)}</View>;
  };

  const renderPost = ({ item }: { item: FeedItem }) => {
    const k = chave(item); const st = estatisticas[k] || { curtidas: 0, comentarios: 0, curtiu: false, reaction: null }; const reaction = st.reaction ? REACTION_META[st.reaction] : null;
    return <View style={[styles.facebookPost, { backgroundColor: colors.card, borderBottomColor: colors.border }]}>
      <View style={styles.postHeader}><Avatar nome={item.usuarioNome} foto={item.usuarioFoto} size={44} backgroundColor={colors.avatarBackground} textColor={colors.avatarText} /><View style={styles.postUserInfo}><Text style={[styles.userName, { color: colors.text }]}>{item.usuarioNome}</Text><View style={styles.metaRow}><Text style={[styles.postMeta, { color: colors.secondary }]}>{item.type === "critica" ? "Publicou uma crítica" : "Marcou um livro como lido"}</Text><Text style={[styles.metaDot, { color: colors.secondary }]}>•</Text><Text style={[styles.postMeta, { color: colors.secondary }]}>{formatarData(item.createdAt)}</Text></View></View><TouchableOpacity style={styles.moreButton}><MaterialCommunityIcons name="dots-horizontal" size={22} color={colors.secondary} /></TouchableOpacity></View>
      <Text style={[styles.postDescription, { color: colors.text }]}>{item.type === "critica" ? <><Text style={styles.inlineStrong}>{item.usuarioNome}</Text>{" fez uma crítica sobre "}<Text style={styles.inlineStrong}>{item.livroTitulo}</Text>{item.texto ? `: ${item.texto}` : "."}</> : <><Text style={styles.inlineStrong}>{item.usuarioNome}</Text>{" marcou "}<Text style={styles.inlineStrong}>{item.livroTitulo}</Text>{" como lido."}</>}</Text>
      <View style={[item.type === "critica" ? styles.reviewPost : styles.bookPost, { backgroundColor: colors.cardSecondary }]}>{item.livroImagem ? <Image source={{ uri: item.livroImagem }} style={item.type === "critica" ? styles.reviewPostCover : styles.bookPostCover} resizeMode="cover" /> : <View style={item.type === "critica" ? [styles.reviewPostCoverFallback, { backgroundColor: colors.primary }] : [styles.bookPostCoverFallback, { backgroundColor: colors.primary }]}><MaterialCommunityIcons name="book-open-page-variant" size={34} color="#FFF" /></View>}<View style={item.type === "critica" ? styles.reviewPostInfo : styles.bookPostInfo}><Text style={[item.type === "critica" ? styles.reviewPostTitle : styles.bookPostTitle, { color: colors.text }]} numberOfLines={2}>{item.livroTitulo}</Text><Text style={[item.type === "critica" ? styles.reviewPostAuthor : styles.bookPostAuthor, { color: colors.secondary }]} numberOfLines={1}>{item.livroAutor}</Text>{item.type === "critica" ? <View style={styles.ratingRow}><View style={styles.starsRow}>{[1, 2, 3, 4, 5].map(n => <MaterialCommunityIcons key={n} name={n <= (item.nota || 0) ? "star" : "star-outline"} size={16} color={colors.gold} style={styles.starIcon} />)}</View><Text style={[styles.ratingText, { color: colors.text }]}>{item.nota || 0}/5</Text></View> : <View style={styles.readIndicator}><MaterialCommunityIcons name="check-circle" size={15} color={colors.primary} /><Text style={[styles.readIndicatorText, { color: colors.primary }]}>Lido</Text></View>}</View></View>
      <View style={[styles.socialSummary, { borderBottomColor: colors.border }]}><View style={styles.summaryLeft}>{st.curtidas > 0 && <View style={[styles.likeCircle, { backgroundColor: reaction?.color || colors.primary }]}><MaterialCommunityIcons name={(reaction?.icon || "thumb-up") as any} size={11} color="#FFF" /></View>}<Text style={[styles.summaryText, { color: colors.secondary }]}>{st.curtidas ? `${st.curtidas} ${st.curtidas === 1 ? "reação" : "reações"}` : ""}</Text></View><TouchableOpacity onPress={() => void abrirComentarios(item)}><Text style={[styles.summaryText, { color: colors.secondary }]}>{st.comentarios ? `${st.comentarios} ${st.comentarios === 1 ? "comentário" : "comentários"}` : ""}</Text></TouchableOpacity></View>
      <View style={styles.socialActions}><View style={{ flex: 1, position: "relative" }}>{renderReactionPicker(item)}<TouchableOpacity style={styles.socialAction} activeOpacity={0.75} onLongPress={() => setReacoesAberta(reacoesAberta === k ? null : k)} onPress={() => setReacoesAberta(reacoesAberta === k ? null : k)}><MaterialCommunityIcons name={(reaction?.icon || "thumb-up-outline") as any} size={21} color={reaction?.color || colors.actionText} /><Text style={[styles.socialActionText, { color: reaction?.color || colors.actionText }]}>{reaction?.label || "Reagir"}</Text></TouchableOpacity></View><TouchableOpacity style={styles.socialAction} onPress={() => void abrirComentarios(item)}><MaterialCommunityIcons name="comment-outline" size={21} color={colors.actionText} /><Text style={[styles.socialActionText, { color: colors.actionText }]}>Comentar</Text></TouchableOpacity></View>
    </View>;
  };

  if (carregando && feed.length === 0) return <View style={[styles.loadingPage, { backgroundColor: colors.background }]}><View style={[styles.loadingIcon, { backgroundColor: colors.primary }]}><MaterialCommunityIcons name="book-open-page-variant" size={40} color="#FFF" /></View><ActivityIndicator size="large" color={colors.primary} /><Text style={[styles.loadingTitle, { color: colors.text }]}>A carregar o BookNook</Text><Text style={[styles.loadingSubtitle, { color: colors.secondary }]}>A preparar as publicações dos leitores.</Text></View>;

  const unread = notificacoes.filter(n => !n.lida).length;
  return <View style={[styles.container, { backgroundColor: colors.background }]}><StatusBar barStyle={isDark ? "light-content" : "dark-content"} backgroundColor={colors.card} />
    <View style={[styles.feedTop, { backgroundColor: colors.card, borderBottomColor: colors.border }]}>{pesquisaAberta ? <View style={[styles.searchContainer, { backgroundColor: colors.actionBackground, borderColor: colors.border }]}><MaterialCommunityIcons name="magnify" size={20} color={colors.secondary} /><TextInput autoFocus value={textoPesquisa} onChangeText={setTextoPesquisa} placeholder="Pesquisar no BookNook" placeholderTextColor={colors.mutedText} style={[styles.searchInput, { color: colors.text }]} /><TouchableOpacity style={styles.searchClearButton} onPress={() => { setTextoPesquisa(""); setPesquisaAberta(false); }}><MaterialCommunityIcons name="close" size={20} color={colors.secondary} /></TouchableOpacity></View> : <><View style={styles.brandArea}><TouchableOpacity style={[styles.menuButton, { backgroundColor: colors.actionBackground }]} onPress={() => setMenuAberto(true)}><MaterialCommunityIcons name="menu" size={23} color={colors.text} /></TouchableOpacity><Text style={[styles.feedTitle, { color: colors.text }]}>BookNook</Text></View><View style={styles.feedTopActions}><TouchableOpacity style={[styles.topAction, { backgroundColor: colors.actionBackground }]} onPress={() => setPesquisaAberta(true)}><MaterialCommunityIcons name="magnify" size={21} color={colors.text} /></TouchableOpacity><TouchableOpacity style={[styles.topAction, { backgroundColor: colors.actionBackground }]} onPress={() => setNotificacoesAbertas(true)}><MaterialCommunityIcons name="bell-outline" size={21} color={colors.text} />{unread > 0 && <View style={styles.notificationBadge}><Text style={styles.notificationBadgeText}>{unread > 99 ? "99+" : unread}</Text></View>}</TouchableOpacity></View></>}</View>
    {textoPesquisa.trim() && <View style={[styles.searchResultBar, { backgroundColor: colors.card, borderBottomColor: colors.border }]}><MaterialCommunityIcons name="filter-variant" size={16} color={colors.primary} /><Text style={[styles.searchResultText, { color: colors.secondary }]}>{filtrados.length} resultado(s) encontrado(s)</Text></View>}
    <FlatList data={filtrados} keyExtractor={item => chave(item)} renderItem={renderPost} showsVerticalScrollIndicator={false} contentContainerStyle={filtrados.length ? styles.listContent : styles.listEmptyContent} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); void sincronizar(false); }} tintColor={colors.primary} colors={[colors.primary]} />} ListHeaderComponent={<Text style={[styles.feedSectionTitle, { color: colors.secondary }]}>Publicações recentes</Text>} ListEmptyComponent={<View style={[styles.emptyState, { backgroundColor: colors.card }]}><View style={[styles.emptyIcon, { backgroundColor: colors.primaryLight }]}><MaterialCommunityIcons name="book-search-outline" size={35} color={colors.primary} /></View><Text style={[styles.emptyTitle, { color: colors.text }]}>Ainda não há publicações</Text><Text style={[styles.emptyText, { color: colors.secondary }]}>Quando os leitores marcarem livros como lidos ou publicarem críticas, elas aparecerão aqui.</Text></View>} ListFooterComponent={<View style={styles.listFooter} />} />

    <Modal visible={menuAberto} transparent animationType="slide" onRequestClose={() => setMenuAberto(false)}><View style={styles.menuOverlay}><View style={[styles.sideMenu, { backgroundColor: colors.card }]}><View style={[styles.sideMenuHeader, { borderBottomColor: colors.border }]}><TouchableOpacity style={styles.menuCloseButton} onPress={() => setMenuAberto(false)}><MaterialCommunityIcons name="close" size={22} color={colors.text} /></TouchableOpacity><View style={styles.sideMenuProfile}><Avatar nome={nomeAtual} foto={fotoAtual} size={64} backgroundColor={colors.avatarBackground} textColor={colors.avatarText} /><View style={styles.sideMenuUser}><Text style={[styles.sideMenuUserName, { color: colors.text }]} numberOfLines={1}>{nomeAtual}</Text><Text style={[styles.sideMenuUserSubtitle, { color: colors.secondary }]}>Leitor BookNook</Text><View style={[styles.onlineStatus, { backgroundColor: colors.primaryLight }]}><View style={[styles.onlineDot, { backgroundColor: colors.primary }]} /><Text style={[styles.onlineText, { color: colors.primaryDark }]}>Conta ativa</Text></View></View></View></View><View style={styles.sideMenuContent}><TouchableOpacity style={[styles.menuItem, { backgroundColor: colors.actionBackground }]} onPress={() => { setMenuAberto(false); setNotificacoesAbertas(true); }}><View style={[styles.menuItemIcon, { backgroundColor: colors.primaryLight }]}><MaterialCommunityIcons name="bell-outline" size={22} color={colors.primary} /></View><View style={styles.menuItemInfo}><Text style={[styles.menuItemTitle, { color: colors.text }]}>Notificações</Text><Text style={[styles.menuItemSubtitle, { color: colors.secondary }]}>Atividade recente da comunidade</Text></View>{unread > 0 && <View style={styles.menuNotificationCount}><Text style={styles.menuNotificationCountText}>{unread > 99 ? "99+" : unread}</Text></View>}</TouchableOpacity><TouchableOpacity style={[styles.menuItem, { backgroundColor: colors.actionBackground }]} onPress={() => void abrirDashboard()}><View style={[styles.menuItemIcon, { backgroundColor: colors.primaryLight }]}><MaterialCommunityIcons name="chart-box-outline" size={22} color={colors.primary} /></View><View style={styles.menuItemInfo}><Text style={[styles.menuItemTitle, { color: colors.text }]}>Dashboard</Text><Text style={[styles.menuItemSubtitle, { color: colors.secondary }]}>Resumo da atividade do BookNook</Text></View></TouchableOpacity></View><View style={[styles.sideMenuFooter, { borderTopColor: colors.border }]}><MaterialCommunityIcons name="shield-check-outline" size={17} color={colors.primary} /><Text style={[styles.sideMenuFooterText, { color: colors.secondary }]}>A tua conta e as tuas publicações ficam sincronizadas com o perfil.</Text></View></View><TouchableOpacity style={styles.menuOutside} activeOpacity={1} onPress={() => setMenuAberto(false)} /></View></Modal>

    <Modal visible={dashboardAberto} transparent animationType="slide" onRequestClose={() => setDashboardAberto(false)}><View style={styles.modalContainer}><View style={styles.modalBackground} /><View style={[styles.dashboardModal, { backgroundColor: colors.background }]}><View style={[styles.dashboardHeader, { backgroundColor: colors.card, borderBottomColor: colors.border }]}><View style={styles.dashboardHeaderInfo}><Text style={[styles.dashboardTitle, { color: colors.text }]}>Dashboard</Text><Text style={[styles.dashboardSubtitle, { color: colors.secondary }]}>Visão geral da comunidade BookNook</Text></View><TouchableOpacity style={styles.closeButton} onPress={() => setDashboardAberto(false)}><MaterialCommunityIcons name="close" size={22} color={colors.text} /></TouchableOpacity></View>{dashboard ? <FlatList data={[1]} renderItem={() => <View style={styles.dashboardContent}><View style={[styles.dashboardWelcome, { backgroundColor: colors.primary }]}><View style={styles.dashboardWelcomeText}><Text style={styles.dashboardWelcomeTitle}>Olá, {nomeAtual}</Text><Text style={styles.dashboardWelcomeDescription}>A tua atividade no BookNook num só lugar.</Text></View><Avatar nome={nomeAtual} foto={fotoAtual} size={70} backgroundColor="rgba(255,255,255,0.25)" textColor="#FFFFFF" /></View><View style={styles.dashboardGrid}>{([['book-open-page-variant', dashboard.livrosLidos, 'Livros lidos'], ['post-outline', dashboard.publicacoes, 'Publicações'], ['account-group-outline', dashboard.usuarios, 'Utilizadores'], ['bookshelf', dashboard.livros, 'Livros'], ['thumb-up-outline', dashboard.curtidas, 'Reações'], ['comment-outline', dashboard.comentarios, 'Comentários']] as const).map(([icon, value, title]) => <View key={title} style={[styles.dashboardCard, { backgroundColor: colors.card, borderColor: colors.border }]}><View style={[styles.dashboardCardIcon, { backgroundColor: colors.primaryLight }]}><MaterialCommunityIcons name={icon as any} size={23} color={colors.primary} /></View><Text style={[styles.dashboardCardValue, { color: colors.text }]}>{value}</Text><Text style={[styles.dashboardCardTitle, { color: colors.secondary }]}>{title}</Text></View>)}</View></View>} keyExtractor={() => "dashboard"} showsVerticalScrollIndicator={false} /> : <View style={styles.dashboardLoading}><ActivityIndicator size="large" color={colors.primary} /><Text style={[styles.dashboardLoadingText, { color: colors.secondary }]}>A calcular os dados...</Text></View>}</View></View></Modal>

    <Modal visible={notificacoesAbertas} transparent animationType="slide" onRequestClose={() => setNotificacoesAbertas(false)}><View style={styles.modalContainer}><View style={styles.modalBackground} /><View style={[styles.notificationsModal, { backgroundColor: colors.card }]}><View style={[styles.notificationsHeader, { borderBottomColor: colors.border }]}><View style={styles.notificationsHeaderInfo}><Text style={[styles.notificationsTitle, { color: colors.text }]}>Notificações</Text><Text style={[styles.notificationsSubtitle, { color: colors.secondary }]}>Atividade recente do BookNook</Text></View>{unread > 0 && <TouchableOpacity onPress={() => void marcarNotificacoesLidas()}><Text style={[styles.markAllText, { color: colors.primary }]}>Marcar lidas</Text></TouchableOpacity>}<TouchableOpacity style={styles.closeButton} onPress={() => setNotificacoesAbertas(false)}><MaterialCommunityIcons name="close" size={22} color={colors.text} /></TouchableOpacity></View><FlatList data={notificacoes} keyExtractor={i => i.id} contentContainerStyle={notificacoes.length ? styles.notificationsList : styles.notificationsListEmpty} ListEmptyComponent={<View style={styles.noNotifications}><View style={[styles.noNotificationsIcon, { backgroundColor: colors.primaryLight }]}><MaterialCommunityIcons name="bell-off-outline" size={32} color={colors.primary} /></View><Text style={[styles.noNotificationsTitle, { color: colors.text }]}>Sem notificações</Text><Text style={[styles.noNotificationsText, { color: colors.secondary }]}>Quando houver nova atividade, ela aparecerá aqui.</Text></View>} renderItem={({ item }) => <View style={[styles.notificationItem, { borderBottomColor: colors.border, backgroundColor: item.lida ? colors.card : colors.primaryLight }]}><View style={[styles.notificationIcon, { backgroundColor: item.tipo === "critica" ? colors.gold : colors.primary }]}><MaterialCommunityIcons name={item.tipo === "critica" ? "star-outline" : "book-check-outline"} size={21} color="#FFF" /></View><View style={styles.notificationContent}><Text style={[styles.notificationTitle, { color: colors.text }]}>{item.titulo}</Text><Text style={[styles.notificationMessage, { color: colors.secondary }]}>{item.mensagem}</Text><Text style={[styles.notificationDate, { color: colors.mutedText }]}>{formatarData(item.data)}</Text></View>{!item.lida && <View style={[styles.unreadDot, { backgroundColor: colors.primary }]} />}</View>} /></View></View></Modal>

    <Modal visible={comentariosAbertos} transparent animationType="slide" onRequestClose={() => setComentariosAbertos(false)}><KeyboardAvoidingView style={styles.modalContainer} behavior={Platform.OS === "ios" ? "padding" : undefined}><View style={styles.modalBackground} /><View style={[styles.commentsModal, { backgroundColor: colors.card }]}><View style={[styles.commentsHeader, { borderBottomColor: colors.border }]}><View style={styles.commentsHeaderInfo}><Text style={[styles.commentsTitle, { color: colors.text }]}>Comentários</Text><Text style={[styles.commentsSubtitle, { color: colors.secondary }]} numberOfLines={1}>{publicacaoSelecionada?.livroTitulo || "Publicação"}</Text></View><TouchableOpacity style={styles.closeButton} onPress={() => setComentariosAbertos(false)}><MaterialCommunityIcons name="close" size={22} color={colors.text} /></TouchableOpacity></View>{carregandoComentarios ? <View style={styles.commentsLoading}><ActivityIndicator size="large" color={colors.primary} /><Text style={[styles.commentsLoadingText, { color: colors.secondary }]}>A carregar comentários...</Text></View> : <FlatList data={comentarios} keyExtractor={c => String(c.id)} contentContainerStyle={comentarios.length ? styles.commentsList : styles.commentsListEmpty} ListEmptyComponent={<View style={styles.noComments}><View style={[styles.noCommentsIcon, { backgroundColor: colors.primaryLight }]}><MaterialCommunityIcons name="comment-outline" size={30} color={colors.primary} /></View><Text style={[styles.noCommentsTitle, { color: colors.text }]}>Ainda sem comentários</Text><Text style={[styles.noCommentsText, { color: colors.secondary }]}>Sê o primeiro a comentar esta publicação.</Text></View>} renderItem={({ item }) => <View style={[styles.commentItem, { borderBottomColor: colors.border }]}><Avatar nome={item.usuario?.nome} foto={item.usuario?.foto_perfil} size={36} backgroundColor={colors.avatarBackground} textColor={colors.avatarText} /><View style={styles.commentBody}><View style={[styles.commentBubble, { backgroundColor: colors.actionBackground }]}><Text style={[styles.commentName, { color: colors.text }]}>{item.usuario?.nome || "Leitor"}</Text><Text style={[styles.commentText, { color: colors.text }]}>{item.texto}</Text></View><Text style={[styles.commentDate, { color: colors.mutedText }]}>{formatarData(item.createdAt)}</Text></View></View>} keyboardShouldPersistTaps="handled" />}<View style={[styles.commentComposer, { borderTopColor: colors.border, backgroundColor: colors.card }]}><Avatar nome={nomeAtual} foto={fotoAtual} size={38} backgroundColor={colors.avatarBackground} textColor={colors.avatarText} /><TextInput value={novoComentario} onChangeText={setNovoComentario} placeholder="Escreve um comentário..." placeholderTextColor={colors.mutedText} style={[styles.commentInput, { color: colors.text, backgroundColor: colors.actionBackground, borderColor: colors.border }]} multiline /><TouchableOpacity disabled={!novoComentario.trim() || enviandoComentario} style={[styles.sendCommentButton, { backgroundColor: novoComentario.trim() && !enviandoComentario ? colors.primary : colors.muted }]} onPress={() => void enviarComentario()}>{enviandoComentario ? <ActivityIndicator size="small" color="#FFF" /> : <MaterialCommunityIcons name="send" size={19} color="#FFF" />}</TouchableOpacity></View></View></KeyboardAvoidingView></Modal>
  </View>;
}

const styles = StyleSheet.create({
  container: { flex: 1 }, listContent: { paddingBottom: 100 }, listEmptyContent: { flexGrow: 1, paddingBottom: 100 }, feedTop: { minHeight: 66, paddingHorizontal: 14, flexDirection: "row", alignItems: "center", justifyContent: "space-between", borderBottomWidth: 1 }, brandArea: { flex: 1, flexDirection: "row", alignItems: "center", minWidth: 0 }, menuButton: { width: 40, height: 40, borderRadius: 20, alignItems: "center", justifyContent: "center", marginRight: 10 }, bookNookTitle: { fontSize: 14, fontWeight: "800", letterSpacing: .2 }, feedTitle: { fontSize: 24, fontWeight: "900", letterSpacing: -.5, lineHeight: 26 }, feedTopActions: { flexDirection: "row", alignItems: "center", gap: 8, marginLeft: 8 }, topAction: { width: 40, height: 40, borderRadius: 20, alignItems: "center", justifyContent: "center", position: "relative" }, notificationBadge: { position: "absolute", right: -2, top: -3, minWidth: 17, height: 17, borderRadius: 9, paddingHorizontal: 4, alignItems: "center", justifyContent: "center", backgroundColor: "#E41E3F", borderWidth: 2, borderColor: "#FFFFFF" }, notificationBadgeText: { color: "#FFFFFF", fontSize: 8, fontWeight: "900" }, searchContainer: { flex: 1, height: 42, borderRadius: 21, borderWidth: 1, paddingHorizontal: 13, flexDirection: "row", alignItems: "center", marginRight: 8 }, searchInput: { flex: 1, height: 42, paddingHorizontal: 9, fontSize: 14 }, searchClearButton: { width: 30, height: 30, alignItems: "center", justifyContent: "center" }, searchResultBar: { minHeight: 38, paddingHorizontal: 16, flexDirection: "row", alignItems: "center", gap: 7 }, searchResultText: { fontSize: 12, fontWeight: "600" }, feedSectionTitle: { paddingHorizontal: 15, paddingTop: 17, paddingBottom: 9 }, facebookPost: { marginBottom: 8, paddingTop: 14, paddingBottom: 2, borderBottomWidth: 1 }, postHeader: { paddingHorizontal: 15, flexDirection: "row", alignItems: "center" }, postUserInfo: { flex: 1, marginLeft: 10 }, userName: { fontSize: 14, fontWeight: "800" }, metaRow: { flexDirection: "row", alignItems: "center", marginTop: 2, gap: 4 }, postMeta: { fontSize: 11 }, metaDot: { fontSize: 10 }, moreButton: { width: 34, height: 34, borderRadius: 17, alignItems: "center", justifyContent: "center" }, postDescription: { paddingHorizontal: 15, marginTop: 13, marginBottom: 13, fontSize: 14, lineHeight: 20 }, inlineStrong: { fontWeight: "800" }, bookPost: { marginHorizontal: 15, flexDirection: "row", minHeight: 108, borderRadius: 10, overflow: "hidden" }, bookPostCover: { width: 82, height: 108 }, bookPostCoverFallback: { width: 82, height: 108, alignItems: "center", justifyContent: "center" }, bookPostInfo: { flex: 1, paddingHorizontal: 13, paddingVertical: 13, justifyContent: "center" }, bookPostTitle: { fontSize: 15, lineHeight: 20, fontWeight: "800" }, bookPostAuthor: { fontSize: 12, marginTop: 5 }, readIndicator: { flexDirection: "row", alignItems: "center", marginTop: 10, gap: 5 }, readIndicatorText: { fontSize: 11, fontWeight: "700" }, reviewPost: { marginHorizontal: 15, flexDirection: "row", minHeight: 108, borderRadius: 10, overflow: "hidden" }, reviewPostCover: { width: 82, height: 108 }, reviewPostCoverFallback: { width: 82, height: 108, alignItems: "center", justifyContent: "center" }, reviewPostInfo: { flex: 1, paddingHorizontal: 13, paddingVertical: 13, justifyContent: "center" }, reviewPostTitle: { fontSize: 15, lineHeight: 20, fontWeight: "800" }, reviewPostAuthor: { fontSize: 12, marginTop: 5 }, ratingRow: { flexDirection: "row", alignItems: "center", marginTop: 9 }, starsRow: { flexDirection: "row", alignItems: "center" }, starIcon: { marginRight: 1 }, ratingText: { fontSize: 11, fontWeight: "800", marginLeft: 7 }, socialSummary: { minHeight: 37, marginTop: 9, marginHorizontal: 15, borderBottomWidth: 1, flexDirection: "row", alignItems: "center", justifyContent: "space-between" }, summaryLeft: { flexDirection: "row", alignItems: "center" }, likeCircle: { width: 19, height: 19, borderRadius: 10, alignItems: "center", justifyContent: "center" }, summaryText: { fontSize: 11, marginLeft: 6 }, socialActions: { minHeight: 46, marginHorizontal: 10, flexDirection: "row", alignItems: "center" }, socialAction: { flex: 1, height: 42, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 7, borderRadius: 7 }, socialActionText: { fontSize: 12, fontWeight: "700" }, reactionPicker: { position: "absolute", zIndex: 20, bottom: 45, left: 0, right: 0, minHeight: 58, borderWidth: 1, borderRadius: 30, paddingHorizontal: 8, flexDirection: "row", alignItems: "center", justifyContent: "space-around", shadowOpacity: .18, shadowRadius: 10, elevation: 8 }, reactionChoice: { alignItems: "center", justifyContent: "center", minWidth: 48 }, reactionBubble: { width: 34, height: 34, borderRadius: 17, alignItems: "center", justifyContent: "center" }, reactionLabel: { fontSize: 7, fontWeight: "800", marginTop: 2 }, emptyState: { marginHorizontal: 15, marginTop: 15, paddingHorizontal: 25, paddingVertical: 34, alignItems: "center" }, emptyIcon: { width: 72, height: 72, borderRadius: 36, alignItems: "center", justifyContent: "center", marginBottom: 15 }, emptyTitle: { fontSize: 17, fontWeight: "900", textAlign: "center" }, emptyText: { fontSize: 13, lineHeight: 20, textAlign: "center", marginTop: 7, maxWidth: 310 }, listFooter: { height: 25 }, loadingPage: { flex: 1, alignItems: "center", justifyContent: "center", paddingHorizontal: 30 }, loadingIcon: { width: 82, height: 82, borderRadius: 27, alignItems: "center", justifyContent: "center", marginBottom: 22 }, loadingTitle: { fontSize: 17, fontWeight: "900", marginTop: 15 }, loadingSubtitle: { fontSize: 13, marginTop: 6, textAlign: "center" }, menuOverlay: { flex: 1, flexDirection: "row" }, sideMenu: { width: "86%", maxWidth: 380, height: "100%", shadowOpacity: .25, shadowRadius: 18, elevation: 15 }, menuOutside: { flex: 1 }, sideMenuHeader: { minHeight: 158, paddingHorizontal: 16, paddingTop: Platform.OS === "ios" ? 52 : (StatusBar.currentHeight ?? 0) + 18, paddingBottom: 18, borderBottomWidth: 1, position: "relative" }, sideMenuProfile: { flexDirection: "row", alignItems: "center" }, sideMenuUser: { flex: 1, marginLeft: 13, marginRight: 10 }, sideMenuUserName: { fontSize: 18, fontWeight: "900", lineHeight: 22 }, sideMenuUserSubtitle: { fontSize: 11, marginTop: 3 }, onlineStatus: { alignSelf: "flex-start", flexDirection: "row", alignItems: "center", marginTop: 8, paddingHorizontal: 8, paddingVertical: 4, borderRadius: 10, gap: 5 }, onlineDot: { width: 7, height: 7, borderRadius: 4 }, onlineText: { fontSize: 9, fontWeight: "800" }, menuCloseButton: { position: "absolute", right: 15, top: Platform.OS === "ios" ? 45 : (StatusBar.currentHeight ?? 0) + 10, width: 36, height: 36, borderRadius: 18, alignItems: "center", justifyContent: "center" }, sideMenuContent: { flex: 1, padding: 14 }, menuItem: { minHeight: 70, borderRadius: 12, paddingHorizontal: 11, paddingVertical: 10, flexDirection: "row", alignItems: "center", marginBottom: 9 }, menuItemIcon: { width: 43, height: 43, borderRadius: 22, alignItems: "center", justifyContent: "center" }, menuItemInfo: { flex: 1, marginLeft: 11 }, menuItemTitle: { fontSize: 14, fontWeight: "900" }, menuItemSubtitle: { fontSize: 10, marginTop: 3 }, menuNotificationCount: { minWidth: 22, height: 22, paddingHorizontal: 5, borderRadius: 11, alignItems: "center", justifyContent: "center", backgroundColor: "#E41E3F" }, menuNotificationCountText: { color: "#FFFFFF", fontSize: 9, fontWeight: "900" }, sideMenuFooter: { minHeight: 58, paddingHorizontal: 16, flexDirection: "row", alignItems: "center", gap: 8, borderTopWidth: 1 }, sideMenuFooterText: { fontSize: 10, flex: 1 }, modalContainer: { flex: 1, justifyContent: "flex-end" }, modalBackground: { ...StyleSheet.absoluteFill, backgroundColor: "rgba(0,0,0,0.55)" }, notificationsModal: { height: "82%", borderTopLeftRadius: 20, borderTopRightRadius: 20, overflow: "hidden" }, notificationsHeader: { minHeight: 70, paddingHorizontal: 17, paddingVertical: 12, borderBottomWidth: 1, flexDirection: "row", alignItems: "center" }, notificationsHeaderInfo: { flex: 1, paddingRight: 10 }, notificationsTitle: { fontSize: 19, fontWeight: "900" }, notificationsSubtitle: { fontSize: 11, marginTop: 3 }, markAllText: { fontSize: 11, fontWeight: "800", marginRight: 12 }, notificationsList: { paddingVertical: 4 }, notificationsListEmpty: { flexGrow: 1, justifyContent: "center" }, notificationItem: { minHeight: 82, paddingHorizontal: 15, paddingVertical: 12, borderBottomWidth: 1, flexDirection: "row", alignItems: "center" }, notificationIcon: { width: 43, height: 43, borderRadius: 22, alignItems: "center", justifyContent: "center", marginRight: 11 }, notificationContent: { flex: 1 }, notificationTitle: { fontSize: 13, fontWeight: "900" }, notificationMessage: { fontSize: 12, lineHeight: 17, marginTop: 2 }, notificationDate: { fontSize: 9, marginTop: 4 }, unreadDot: { width: 8, height: 8, borderRadius: 4, marginLeft: 7 }, noNotifications: { alignItems: "center", justifyContent: "center", paddingHorizontal: 30 }, noNotificationsIcon: { width: 68, height: 68, borderRadius: 34, alignItems: "center", justifyContent: "center", marginBottom: 14 }, noNotificationsTitle: { fontSize: 16, fontWeight: "900", textAlign: "center" }, noNotificationsText: { fontSize: 12, lineHeight: 18, textAlign: "center", marginTop: 6 }, closeButton: { width: 38, height: 38, borderRadius: 19, alignItems: "center", justifyContent: "center" }, dashboardModal: { height: "91%", borderTopLeftRadius: 22, borderTopRightRadius: 22, overflow: "hidden" }, dashboardHeader: { minHeight: 78, paddingHorizontal: 17, paddingVertical: 12, borderBottomWidth: 1, flexDirection: "row", alignItems: "center" }, dashboardHeaderInfo: { flex: 1, paddingRight: 10 }, dashboardTitle: { fontSize: 20, fontWeight: "900" }, dashboardSubtitle: { fontSize: 11, marginTop: 3 }, dashboardContent: { padding: 15, paddingBottom: 30 }, dashboardWelcome: { minHeight: 118, borderRadius: 16, paddingHorizontal: 17, paddingVertical: 17, flexDirection: "row", alignItems: "center", marginBottom: 20 }, dashboardWelcomeText: { flex: 1, paddingRight: 12 }, dashboardWelcomeTitle: { color: "#FFFFFF", fontSize: 18, fontWeight: "900" }, dashboardWelcomeDescription: { color: "#FFFFFF", opacity: .9, fontSize: 11, lineHeight: 17, marginTop: 5 }, dashboardGrid: { flexDirection: "row", flexWrap: "wrap", justifyContent: "space-between" }, dashboardCard: { width: "48.5%", minHeight: 145, borderRadius: 14, borderWidth: 1, padding: 14, marginBottom: 12, marginHorizontal: "0.75%" }, dashboardCardIcon: { width: 45, height: 45, borderRadius: 14, alignItems: "center", justifyContent: "center" }, dashboardCardValue: { fontSize: 25, fontWeight: "900", marginTop: 13 }, dashboardCardTitle: { fontSize: 11, fontWeight: "600", marginTop: 2 }, dashboardLoading: { flex: 1, alignItems: "center", justifyContent: "center" }, dashboardLoadingText: { fontSize: 12, marginTop: 10 }, commentsModal: { height: "80%", borderTopLeftRadius: 20, borderTopRightRadius: 20, overflow: "hidden" }, commentsHeader: { minHeight: 68, paddingHorizontal: 17, paddingVertical: 12, borderBottomWidth: 1, flexDirection: "row", alignItems: "center" }, commentsHeaderInfo: { flex: 1, paddingRight: 12 }, commentsTitle: { fontSize: 18, fontWeight: "900" }, commentsSubtitle: { fontSize: 11, marginTop: 3 }, commentsList: { paddingHorizontal: 15, paddingVertical: 8 }, commentsListEmpty: { flexGrow: 1, justifyContent: "center" }, commentItem: { flexDirection: "row", paddingVertical: 10, borderBottomWidth: 1 }, commentBody: { flex: 1, marginLeft: 9 }, commentBubble: { borderRadius: 17, paddingHorizontal: 12, paddingVertical: 9 }, commentName: { fontSize: 12, fontWeight: "900", marginBottom: 3 }, commentText: { fontSize: 13, lineHeight: 19 }, commentDate: { fontSize: 9, marginTop: 4, marginLeft: 3 }, commentsLoading: { flex: 1, alignItems: "center", justifyContent: "center" }, commentsLoadingText: { fontSize: 12, marginTop: 9 }, noComments: { alignItems: "center", justifyContent: "center", paddingHorizontal: 30 }, noCommentsIcon: { width: 64, height: 64, borderRadius: 32, alignItems: "center", justifyContent: "center", marginBottom: 13 }, noCommentsTitle: { fontSize: 15, fontWeight: "900", textAlign: "center" }, noCommentsText: { fontSize: 12, textAlign: "center", lineHeight: 18, marginTop: 5 }, commentComposer: { minHeight: 68, paddingHorizontal: 13, paddingVertical: 10, borderTopWidth: 1, flexDirection: "row", alignItems: "center", gap: 8 }, commentInput: { flex: 1, minHeight: 42, maxHeight: 90, borderWidth: 1, borderRadius: 21, paddingHorizontal: 14, paddingVertical: 9, fontSize: 12 }, sendCommentButton: { width: 42, height: 42, borderRadius: 21, alignItems: "center", justifyContent: "center" }
});
