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

      const res = await db
        .select()
        .from(usuarios)
        .where(eq(usuarios.nome, nome));

      const usuario = res[0];

      if (!usuario) {
        Alert.alert("Erro", "Usuário não encontrado");
        return;
      }

      if (usuario.senha !== senha) {
        Alert.alert("Erro", "Senha incorreta");
        return;
      }

      await AsyncStorage.setItem(
        "usuarioLogado",
        JSON.stringify({
          id: usuario.id,
          nome: usuario.nome,
          foto_perfil: usuario.foto_perfil ?? null,
        })
      );

      router.replace("/(tabs)/feed");
    } catch (err) {
      console.error(err);
      Alert.alert("Erro", "Falha ao efetuar login");
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={[
        styles.container,
        { backgroundColor: isDark ? "#000" : "#fff" },
      ]}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <ScrollView contentContainerStyle={styles.scroll}>
        <Animated.View style={{ opacity: fadeAnim, width: "100%" }}>
          <Text style={styles.title}>BookNook</Text>

          <TextInput
            placeholder="Nome de usuário"
            placeholderTextColor={isDark ? "#888" : "#aaa"}
            style={[
              styles.input,
              { backgroundColor: isDark ? "#1f1f1f" : "#f0f0f0", color: isDark ? "#fff" : "#000" },
            ]}
            value={nome}
            onChangeText={setNome}
          />

          <TextInput
            placeholder="Senha"
            placeholderTextColor={isDark ? "#888" : "#aaa"}
            style={[
              styles.input,
              { backgroundColor: isDark ? "#1f1f1f" : "#f0f0f0", color: isDark ? "#fff" : "#000" },
            ]}
            secureTextEntry
            value={senha}
            onChangeText={setSenha}
          />

          <TouchableOpacity style={styles.button} onPress={handleLogin}>
            <Text style={styles.buttonText}>Entrar</Text>
          </TouchableOpacity>

          <View style={styles.footer}>
            <Text style={{ color: isDark ? "#aaa" : "#666" }}>
              Não tem conta?
            </Text>
            <TouchableOpacity onPress={() => router.push("/register")}>
              <Text style={styles.link}> Cadastre-se</Text>
            </TouchableOpacity>
          </View>
        </Animated.View>
      </ScrollView>

      {loading && (
        <Modal transparent>
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
  container: {
    flex: 1,
  },
  scroll: {
    flexGrow: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 24,
  },
  title: {
    fontSize: 48,
    fontWeight: "900",
    color: "#405DE6",
    marginBottom: 40,
    textAlign: "center",
  },
  input: {
    width: "100%",
    padding: 16,
    borderRadius: 14,
    marginBottom: 16,
    fontSize: 16,
  },
  button: {
    width: "100%",
    padding: 16,
    borderRadius: 14,
    backgroundColor: "#405DE6",
    alignItems: "center",
    marginTop: 8,
  },
  buttonText: {
    color: "#fff",
    fontWeight: "bold",
    fontSize: 18,
  },
  footer: {
    flexDirection: "row",
    justifyContent: "center",
    marginTop: 20,
  },
  link: {
    color: "#405DE6",
    fontWeight: "bold",
  },
  loadingOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "center",
    alignItems: "center",
  },
  loadingText: {
    color: "#fff",
    marginTop: 12,
    fontWeight: "bold",
    fontSize: 16,
  },
});
