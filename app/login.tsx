import React, { useState, useRef, useEffect } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Animated,
  Modal,
  useColorScheme,
} from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useRouter } from "expo-router";
import { db } from "@/database/db";
import { usuarios } from "@/database/schema";
import { eq } from "drizzle-orm";
import { v4 as uuidv4 } from "uuid";

export default function Login() {
  const router = useRouter();
  const [nome, setNome] = useState("");
  const [senha, setSenha] = useState("");
  const [loading, setLoading] = useState(false);
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const colorScheme = useColorScheme();
  const isDark = colorScheme === "dark";

  useEffect(() => {
    Animated.timing(fadeAnim, {
      toValue: 1,
      duration: 600,
      useNativeDriver: true,
    }).start();

    // Verifica usuário logado
    AsyncStorage.getItem("usuarioLogado").then((user) => {
      if (user) router.replace("/(tabs)/feed");
    });
  }, []);

  const handleLogin = async () => {
    if (!nome || !senha) {
      Alert.alert("Atenção", "Preencha todos os campos");
      return;
    }

    try {
      setLoading(true);

      // Busca usuário no SQLite
      const res = await db.select().from(usuarios).where(eq(usuarios.nome, nome));
      const usuarioEncontrado = res[0];
      if (!usuarioEncontrado) {
        Alert.alert("Erro", "Usuário não encontrado");
        return;
      }
      if (usuarioEncontrado.senha !== senha) {
        Alert.alert("Erro", "Senha incorreta");
        return;
      }

      const usuarioLogado = {
        id: usuarioEncontrado.id,
        nome: usuarioEncontrado.nome,
        foto_perfil: usuarioEncontrado.foto_perfil ?? null,
      };

      // Salva no AsyncStorage
      await AsyncStorage.setItem("usuarioLogado", JSON.stringify(usuarioLogado));

      router.replace("/(tabs)/feed");
    } catch (e) {
      console.error(e);
      Alert.alert("Erro", "Falha ao efetuar login");
    } finally {
      setLoading(false);
    }
  };

  const themeStyles = {
    container: { flex: 1, backgroundColor: isDark ? "#000" : "#fff" },
    input: { backgroundColor: isDark ? "#1f1f1f" : "#f0f0f0", color: isDark ? "#fff" : "#000" },
    linkText: { color: "#405DE6" },
  };

  return (
    <KeyboardAvoidingView
      style={themeStyles.container}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
        <Animated.View style={{ opacity: fadeAnim, width: "100%" }}>
          <Text style={[styles.title, { color: "#405DE6" }]}>BookNook</Text>

          <TextInput
            placeholder="Nome de usuário"
            placeholderTextColor={isDark ? "#888" : "#aaa"}
            style={[styles.input, themeStyles.input]}
            value={nome}
            onChangeText={setNome}
          />

          <TextInput
            placeholder="Senha"
            placeholderTextColor={isDark ? "#888" : "#aaa"}
            style={[styles.input, themeStyles.input]}
            secureTextEntry
            value={senha}
            onChangeText={setSenha}
          />

          <TouchableOpacity style={styles.button} onPress={handleLogin}>
            <Text style={styles.buttonText}>Entrar</Text>
          </TouchableOpacity>

          <View style={{ flexDirection: "row", justifyContent: "center", marginTop: 20 }}>
            <Text style={{ color: isDark ? "#aaa" : "#666" }}>Não tem conta? </Text>
            <TouchableOpacity onPress={() => router.push("/register")}>
              <Text style={[{ fontWeight: "bold" }, themeStyles.linkText]}>Cadastre-se</Text>
            </TouchableOpacity>
          </View>
        </Animated.View>
      </ScrollView>

      {loading && (
        <Modal transparent animationType="fade">
          <View style={styles.loadingOverlay}>
            <ActivityIndicator size="large" color="#405DE6" />
            <Text style={styles.loadingText}>Carregando...</Text>
          </View>
        </Modal>
      )}
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  scroll: { flexGrow: 1, justifyContent: "center", alignItems: "center", padding: 24 },
  title: { fontSize: 48, fontWeight: "900", marginBottom: 40, textAlign: "center" },
  input: { width: "100%", padding: 16, borderRadius: 14, marginBottom: 16, fontSize: 16 },
  button: { width: "100%", padding: 16, borderRadius: 14, backgroundColor: "#405DE6", alignItems: "center", marginTop: 8 },
  buttonText: { color: "#fff", fontWeight: "bold", fontSize: 18 },
  loadingOverlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.5)", justifyContent: "center", alignItems: "center" },
  loadingText: { color: "#fff", marginTop: 12, fontWeight: "bold", fontSize: 16 },
});
