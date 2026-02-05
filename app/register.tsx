import React, { useState, useRef, useEffect } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Alert,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  Animated,
  Modal,
  useColorScheme,
} from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useRouter } from "expo-router";
import { db } from "@/database/db";
import { usuarios } from "@/database/schema";
import { eq } from "drizzle-orm";

export default function Register() {
  const router = useRouter();
  const [nome, setNome] = useState("");
  const [senha, setSenha] = useState("");
  const [confirmar, setConfirmar] = useState("");
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

    AsyncStorage.getItem("usuarioLogado").then((user) => {
      if (user) router.replace("/(tabs)/feed");
    });
  }, []);

  const handleRegister = async () => {
    if (!nome || !senha || !confirmar) {
      Alert.alert("Erro", "Preencha todos os campos");
      return;
    }
    if (senha !== confirmar) {
      Alert.alert("Erro", "As senhas não coincidem");
      return;
    }

    try {
      setLoading(true);

      // Verifica se já existe
      const res = await db.select().from(usuarios).where(eq(usuarios.nome, nome));
      if (res.length > 0) {
        Alert.alert("Erro", "Nome de usuário já existe");
        return;
      }

      // Cria usuário no SQLite
      const id = Date.now().toString(); // simples ID único
      await db.insert(usuarios).values({ id, nome, senha, foto_perfil: null });

      // Salva usuário logado
      await AsyncStorage.setItem(
        "usuarioLogado",
        JSON.stringify({ id, nome, foto_perfil: null })
      );

      Alert.alert("Sucesso", "Conta criada!", [
        { text: "OK", onPress: () => router.replace("/(tabs)/feed") },
      ]);
    } catch (e) {
      console.error(e);
      Alert.alert("Erro", "Falha ao criar conta");
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
          <Text style={[styles.title, { color: "#405DE6" }]}>Criar Conta</Text>

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

          <TextInput
            placeholder="Confirmar senha"
            placeholderTextColor={isDark ? "#888" : "#aaa"}
            style={[styles.input, themeStyles.input]}
            secureTextEntry
            value={confirmar}
            onChangeText={setConfirmar}
          />

          <TouchableOpacity style={styles.button} onPress={handleRegister}>
            <Text style={styles.buttonText}>Registrar</Text>
          </TouchableOpacity>

          <View style={{ flexDirection: "row", justifyContent: "center", marginTop: 20 }}>
            <Text style={{ color: isDark ? "#aaa" : "#666" }}>Já tem conta? </Text>
            <TouchableOpacity onPress={() => router.push("/login")}>
              <Text style={[{ fontWeight: "bold" }, themeStyles.linkText]}>Entrar</Text>
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
  title: { fontSize: 36, fontWeight: "900", marginBottom: 40, textAlign: "center" },
  input: { width: "100%", padding: 16, borderRadius: 14, marginBottom: 16, fontSize: 16 },
  button: {
    width: "100%",
    padding: 16,
    borderRadius: 14,
    backgroundColor: "#405DE6",
    alignItems: "center",
    marginTop: 8,
  },
  buttonText: { color: "#fff", fontWeight: "bold", fontSize: 18 },
  loadingOverlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.5)", justifyContent: "center", alignItems: "center" },
  loadingText: { color: "#fff", marginTop: 12, fontWeight: "bold", fontSize: 16 },
});
