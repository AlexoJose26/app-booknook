import React, { useState } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Alert,
  ActivityIndicator,
  ScrollView,
} from "react-native";
import { useRouter } from "expo-router";
import { criarUsuario, buscarUsuarioPorNome } from "@/database/services/usuarios";

export default function Register() {
  const router = useRouter();
  const [nome, setNome] = useState("");
  const [senha, setSenha] = useState("");
  const [confirmar, setConfirmar] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleRegister() {
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

      const existe = await buscarUsuarioPorNome(nome);
      if (existe) {
        Alert.alert("Erro", "Nome de usuário já existe");
        return;
      }

      await criarUsuario(nome, senha);

      Alert.alert("Sucesso", "Conta criada!", [
        { text: "OK", onPress: () => router.replace("/login") },
      ]);
    } catch {
      Alert.alert("Erro", "Falha ao criar conta");
    } finally {
      setLoading(false);
    }
  }

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={styles.title}>Criar conta</Text>

      <TextInput placeholder="Usuário" style={styles.input} value={nome} onChangeText={setNome} />
      <TextInput placeholder="Senha" style={styles.input} secureTextEntry value={senha} onChangeText={setSenha} />
      <TextInput placeholder="Confirmar senha" style={styles.input} secureTextEntry value={confirmar} onChangeText={setConfirmar} />

      {loading && <ActivityIndicator />}

      <TouchableOpacity style={styles.button} onPress={handleRegister}>
        <Text style={styles.buttonText}>Registrar</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flexGrow: 1, justifyContent: "center", padding: 20 },
  title: { fontSize: 32, fontWeight: "800", textAlign: "center", marginBottom: 30 },
  input: { padding: 14, borderRadius: 12, backgroundColor: "#eee", marginBottom: 14 },
  button: { padding: 16, borderRadius: 12, backgroundColor: "#22c55e" },
  buttonText: { color: "#fff", textAlign: "center", fontWeight: "bold" },
});
