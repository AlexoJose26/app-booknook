import React, { useState, useEffect } from "react";
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
} from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useRouter } from "expo-router";
import { db } from "../database/db";
import { usuarios } from "../database/schema";
import { eq } from "drizzle-orm";

export default function Login() {
  const router = useRouter();
  const [nome, setNome] = useState("");
  const [senha, setSenha] = useState("");
  const [loading, setLoading] = useState(false);

  // ✅ Redireciona se usuário já estiver logado
  useEffect(() => {
    const checkUsuario = async () => {
      const userStr = await AsyncStorage.getItem("usuarioLogado");
      if (userStr) {
        router.replace("/(tabs)/feed");
      }
    };
    checkUsuario();
  }, [router]);

  async function handleLogin() {
    if (!nome || !senha) {
      Alert.alert("Atenção", "Preencha todos os campos");
      return;
    }

    try {
      setLoading(true);

      const res = await db.select().from(usuarios).where(eq(usuarios.nome, nome));

      if (res.length === 0) {
        Alert.alert("Erro", "Usuário não encontrado");
        return;
      }

      if (res[0].senha !== senha) {
        Alert.alert("Erro", "Senha incorreta");
        return;
      }

      // ✅ Salva usuário logado no AsyncStorage
      await AsyncStorage.setItem(
        "usuarioLogado",
        JSON.stringify({
          id: res[0].id,
          nome: res[0].nome,
          foto_perfil: res[0].foto_perfil ?? null,
        })
      );

      router.replace("/(tabs)/feed"); // vai direto para feed
    } catch (e) {
      console.error(e);
      Alert.alert("Erro", "Falha ao efetuar login");
    } finally {
      setLoading(false);
    }
  }

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: "#020617" }}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <ScrollView
        contentContainerStyle={{ flexGrow: 1, justifyContent: "center", padding: 20 }}
        keyboardShouldPersistTaps="handled"
      >
        <Text style={styles.title}>Entrar</Text>

        <TextInput
          placeholder="Nome de usuário"
          style={styles.input}
          value={nome}
          onChangeText={setNome}
          placeholderTextColor="#94a3b8"
        />

        <TextInput
          placeholder="Senha"
          style={styles.input}
          secureTextEntry
          value={senha}
          onChangeText={setSenha}
          placeholderTextColor="#94a3b8"
        />

        <TouchableOpacity
          style={[styles.button, loading && { opacity: 0.7 }]}
          onPress={handleLogin}
          disabled={loading}
        >
          {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.buttonText}>Entrar</Text>}
        </TouchableOpacity>

        <TouchableOpacity onPress={() => router.push("/register")}>
          <Text style={styles.link}>Não tem conta? Registrar</Text>
        </TouchableOpacity>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  title: { fontSize: 28, fontWeight: "bold", color: "#fff", marginBottom: 20, textAlign: "center" },
  input: {
    backgroundColor: "#1e293b",
    borderWidth: 1,
    borderColor: "#334155",
    color: "#fff",
    borderRadius: 10,
    padding: 14,
    marginBottom: 14,
  },
  button: { backgroundColor: "#22c55e", padding: 16, borderRadius: 10, alignItems: "center", marginTop: 10 },
  buttonText: { color: "#020617", fontWeight: "bold", fontSize: 16 },
  link: { color: "#94a3b8", textAlign: "center", marginTop: 20 },
});
