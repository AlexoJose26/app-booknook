import React, { useState, useEffect, useRef } from "react";
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
  useColorScheme,
  Animated,
} from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useRouter } from "expo-router";
import { buscarUsuarioPorNome } from "@/database/services/usuarios";

export default function Login() {
  const router = useRouter();
  const [nome, setNome] = useState("");
  const [senha, setSenha] = useState("");
  const [loading, setLoading] = useState(false);
  const fadeAnim = useRef(new Animated.Value(1)).current;
  const colorScheme = useColorScheme();

  const isDark = colorScheme === "dark";

  async function handleLogin() {
    if (!nome || !senha) {
      Alert.alert("Atenção", "Preencha todos os campos");
      return;
    }

    try {
      setLoading(true);

      const usuario = await buscarUsuarioPorNome(nome);

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
          foto_perfil: usuario.foto_perfil,
        })
      );

      router.replace("/(tabs)/feed");
    } catch (e) {
      Alert.alert("Erro", "Falha ao efetuar login");
    } finally {
      setLoading(false);
    }
  }

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: isDark ? "#000" : "#fff" }}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <ScrollView contentContainerStyle={styles.container}>
        <Animated.View style={{ opacity: fadeAnim }}>
          <Text style={styles.title}>BookNook</Text>

          <TextInput
            placeholder="Nome de usuário"
            style={styles.input}
            value={nome}
            onChangeText={setNome}
          />

          <TextInput
            placeholder="Senha"
            style={styles.input}
            secureTextEntry
            value={senha}
            onChangeText={setSenha}
          />

          {loading && <ActivityIndicator size="large" />}

          <TouchableOpacity style={styles.button} onPress={handleLogin}>
            <Text style={styles.buttonText}>Entrar</Text>
          </TouchableOpacity>

          <TouchableOpacity onPress={() => router.push("/register")}>
            <Text style={styles.link}>Criar conta</Text>
          </TouchableOpacity>
        </Animated.View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flexGrow: 1, justifyContent: "center", padding: 20 },
  title: { fontSize: 40, fontWeight: "800", textAlign: "center", marginBottom: 30 },
  input: { padding: 14, borderRadius: 12, backgroundColor: "#eee", marginBottom: 14 },
  button: { padding: 16, borderRadius: 12, backgroundColor: "#405de6" },
  buttonText: { color: "#fff", textAlign: "center", fontWeight: "bold" },
  link: { textAlign: "center", marginTop: 20, color: "#22c55e" },
});
