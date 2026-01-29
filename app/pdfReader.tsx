import React, { useState } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  SafeAreaView,
  StyleSheet,
  Platform,
  ActivityIndicator,
} from "react-native";
import { WebView } from "react-native-webview";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";

interface PdfReaderProps {
  pdfUri?: string;
  titulo?: string;
}

export default function PdfReader() {
  const router = useRouter();
  const query = router.query as PdfReaderProps;

  const pdfUri = query.pdfUri ? decodeURIComponent(query.pdfUri) : null;
  const titulo = query.titulo ?? "PDF";

  const [loading, setLoading] = useState(true);

  if (!pdfUri) {
    return (
      <View style={styles.center}>
        <Text style={styles.errorText}>PDF não encontrado</Text>
        <TouchableOpacity style={styles.fecharBtn} onPress={() => router.back()}>
          <Text style={styles.fecharText}>Voltar</Text>
        </TouchableOpacity>
      </View>
    );
  }

  // Para arquivos locais ou URL remotas
  const getWebViewUri = () => {
    return pdfUri.startsWith("file://") ? pdfUri : pdfUri;
  };

  return (
    <SafeAreaView style={{ flex: 1 }}>
      {/* HEADER */}
      <View style={styles.header}>
        <Text style={styles.titulo} numberOfLines={1}>
          {titulo}
        </Text>
        <TouchableOpacity style={styles.fechar} onPress={() => router.back()}>
          <Ionicons name="close" size={28} color="#FFF" />
        </TouchableOpacity>
      </View>

      {/* WEBVIEW */}
      <WebView
        source={{ uri: getWebViewUri() }}
        style={{ flex: 1 }}
        useWebKit
        javaScriptEnabled
        domStorageEnabled
        startInLoadingState
        onLoadStart={() => setLoading(true)}
        onLoadEnd={() => setLoading(false)}
        renderLoading={() => (
          <View style={styles.loading}>
            <ActivityIndicator size="large" color="#4F46E5" />
            <Text style={styles.loadingText}>Carregando PDF…</Text>
          </View>
        )}
        scalesPageToFit={Platform.OS === "android"}
        bounces={false}
      />

      {loading && (
        <View style={styles.loadingOverlay}>
          <ActivityIndicator size="large" color="#4F46E5" />
          <Text style={styles.loadingText}>Carregando PDF…</Text>
        </View>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, justifyContent: "center", alignItems: "center", padding: 16 },
  errorText: { fontSize: 16, color: "#111", marginBottom: 12 },
  fecharBtn: { padding: 12, backgroundColor: "#4F46E5", borderRadius: 10 },
  fecharText: { color: "#FFF", fontWeight: "bold" },

  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: "#4F46E5",
    padding: 12,
    marginTop: Platform.OS === "ios" ? 40 : 0,
  },
  titulo: { color: "#FFF", fontSize: 18, fontWeight: "bold", flex: 1 },
  fechar: { padding: 10, borderRadius: 20, backgroundColor: "#7C3AED", marginLeft: 8 },

  loading: { flex: 1, justifyContent: "center", alignItems: "center" },
  loadingOverlay: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "rgba(255,255,255,0.7)",
  },
  loadingText: { marginTop: 8, color: "#4F46E5" },
});
