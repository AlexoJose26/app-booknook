import React, { useState } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Alert,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
} from "react-native";
import { useRouter } from "expo-router";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { db } from "../database/db";
import { usuarios } from "../database/schema";
import { eq } from "drizzle-orm";

export default function Register() {
  const router = useRouter();
  const [nome, setNome] = useState("");
  const [senha, setSenha] = useState("");
  const [confirmar, setConfirmar] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleRegister() {
    if (!nome || !senha || !confirmar) {
      Alert.alert("Atenção", "Preencha todos os campos");
      return;
    }

    if (senha !== confirmar) {
      Alert.alert("Erro", "As senhas não coincidem");
      return;
    }

    try {
      setLoading(true);

      const existe = await db.select().from(usuarios).where(eq(usuarios.nome, nome));
      if (existe.length) {
        Alert.alert("Erro", "Este nome já existe");
        return;
      }

      const id = String(Date.now());

      await db.insert(usuarios).values({ id, nome, senha, foto_perfil: null });

      // Salva usuário logado no AsyncStorage diretamente
      await AsyncStorage.setItem("usuarioLogado", JSON.stringify({ id, nome }));

      Alert.alert("Sucesso", "Conta criada com sucesso!");
      router.replace("/login"); 
    } catch (e: any) {
      console.error(e);
      Alert.alert("Erro", e?.message ? String(e.message) : "Falha ao criar conta");
    } finally {
      setLoading(false);
    }
  }

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: "#020617" }}
      behavior={Platform.OS === "ios" ? "padding" : "height"}
      keyboardVerticalOffset={Platform.OS === "ios" ? 0 : 20}
    >
      <ScrollView
        contentContainerStyle={styles.scrollContainer}
        keyboardShouldPersistTaps="handled"
      >
        <Text style={styles.title}>Criar Conta</Text>

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

        <TextInput
          placeholder="Confirmar senha"
          style={styles.input}
          secureTextEntry
          value={confirmar}
          onChangeText={setConfirmar}
          placeholderTextColor="#94a3b8"
        />

        <TouchableOpacity
          style={[styles.button, loading ? { opacity: 0.7 } : {}]}
          onPress={handleRegister}
          disabled={loading}
        >
          {loading ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.buttonText}>Criar Conta</Text>
          )}
        </TouchableOpacity>

        <TouchableOpacity onPress={() => router.back()}>
          <Text style={styles.link}>Voltar para login</Text>
        </TouchableOpacity>

        <View style={{ height: 40 }} />
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  scrollContainer: { flexGrow: 1, justifyContent: "center", padding: 20 },
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
