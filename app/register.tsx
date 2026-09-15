import React, { useState } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
} from "react-native";
import { useRouter } from "expo-router";
import { db } from "@/database/db";
import { usuarios } from "@/database/schema";
import { eq } from "drizzle-orm";

export default function Register() {
  const router = useRouter();

  const [nome, setNome] = useState("");
  const [senha, setSenha] = useState("");
  const [confirmar, setConfirmar] = useState("");

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

      const existe = await db
        .select()
        .from(usuarios)
        .where(eq(usuarios.nome, nome))
        .limit(1);

      if (existe.length > 0) {
        Alert.alert("Erro", "Usuário já existe");
        return;
      }

      const novoUsuario = {
        id: Date.now().toString(),
        nome,
        senha,
        foto_perfil: null,
      };

      await db.insert(usuarios).values(novoUsuario);

      Alert.alert("Sucesso", "Usuário criado com sucesso!");

      router.push("/login");
    } catch (err) {
      console.error(err);
      Alert.alert("Erro", "Falha ao criar usuário");
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <ScrollView contentContainerStyle={styles.scroll}>
        <Text style={styles.title}>Cadastro</Text>

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
        <TextInput
          placeholder="Confirmar senha"
          style={styles.input}
          secureTextEntry
          value={confirmar}
          onChangeText={setConfirmar}
        />

        <TouchableOpacity style={styles.button} onPress={handleRegister}>
          <Text style={styles.buttonText}>Criar conta</Text>
        </TouchableOpacity>

        <View style={styles.footer}>
          <Text>Já tem conta?</Text>
          <TouchableOpacity onPress={() => router.push("/login")}>
            <Text style={styles.link}> Entrar</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#fff",
  },
  scroll: {
    flexGrow: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 24,
  },
  title: {
    fontSize: 36,
    fontWeight: "900",
    color: "#405DE6",
    marginBottom: 40,
    textAlign: "center",
  },
  input: {
    width: "100%",
    padding: 16,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#ccc",
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
});
