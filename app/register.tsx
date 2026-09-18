import { db } from "@/database/db";
import { usuarios } from "@/database/schema";
import { eq } from "drizzle-orm";
import { useRouter } from "expo-router";
import { useState } from "react";
import {
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
  useColorScheme,
} from "react-native";

export default function Register() {
  const router = useRouter();
  const colorScheme = useColorScheme();

  const isDark = colorScheme === "dark";

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

  const colors = {
    background: isDark ? "#0B1020" : "#F8FAFC",
    card: isDark ? "#111827" : "#FFFFFF",
    cardBorder: isDark ? "#1F2937" : "#E2E8F0",

    title: isDark ? "#FFFFFF" : "#0F172A",
    subtitle: isDark ? "#A8B1C2" : "#64748B",

    label: isDark ? "#F8FAFC" : "#1E293B",

    inputBackground: isDark ? "#1E293B" : "#F8FAFC",
    inputBorder: isDark ? "#334155" : "#CBD5E1",
    inputText: isDark ? "#FFFFFF" : "#0F172A",
    placeholder: isDark ? "#94A3B8" : "#64748B",

    footerText: isDark ? "#94A3B8" : "#64748B",
    link: isDark ? "#7C8CF8" : "#405DE6",
  };

  return (
    <KeyboardAvoidingView
      style={[
        styles.container,
        {
          backgroundColor: colors.background,
        },
      ]}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <ScrollView
        contentContainerStyle={styles.scroll}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <View
          style={[
            styles.card,
            {
              backgroundColor: colors.card,
              borderColor: colors.cardBorder,
            },
          ]}
        >
          <View style={styles.header}>
            <View style={styles.logoCircle}>
              <Text style={styles.logoText}>M</Text>
            </View>

            <Text
              style={[
                styles.title,
                {
                  color: colors.title,
                },
              ]}
            >
              Criar conta
            </Text>

            <Text
              style={[
                styles.subtitle,
                {
                  color: colors.subtitle,
                },
              ]}
            >
              Crie a sua conta para começar a utilizar o MedeaSocial.
            </Text>
          </View>

          <View style={styles.form}>
            <View style={styles.field}>
              <Text
                style={[
                  styles.label,
                  {
                    color: colors.label,
                  },
                ]}
              >
                Nome de usuário
              </Text>

              <TextInput
                placeholder="Digite seu nome de usuário"
                placeholderTextColor={colors.placeholder}
                style={[
                  styles.input,
                  {
                    backgroundColor: colors.inputBackground,
                    borderColor: colors.inputBorder,
                    color: colors.inputText,
                  },
                ]}
                value={nome}
                onChangeText={setNome}
                autoCapitalize="none"
                autoCorrect={false}
              />
            </View>

            <View style={styles.field}>
              <Text
                style={[
                  styles.label,
                  {
                    color: colors.label,
                  },
                ]}
              >
                Senha
              </Text>

              <TextInput
                placeholder="Digite sua senha"
                placeholderTextColor={colors.placeholder}
                style={[
                  styles.input,
                  {
                    backgroundColor: colors.inputBackground,
                    borderColor: colors.inputBorder,
                    color: colors.inputText,
                  },
                ]}
                secureTextEntry
                value={senha}
                onChangeText={setSenha}
                autoCapitalize="none"
                autoCorrect={false}
              />
            </View>

            <View style={styles.field}>
              <Text
                style={[
                  styles.label,
                  {
                    color: colors.label,
                  },
                ]}
              >
                Confirmar senha
              </Text>

              <TextInput
                placeholder="Digite novamente sua senha"
                placeholderTextColor={colors.placeholder}
                style={[
                  styles.input,
                  {
                    backgroundColor: colors.inputBackground,
                    borderColor: colors.inputBorder,
                    color: colors.inputText,
                  },
                ]}
                secureTextEntry
                value={confirmar}
                onChangeText={setConfirmar}
                autoCapitalize="none"
                autoCorrect={false}
              />
            </View>

            <TouchableOpacity
              style={styles.button}
              onPress={handleRegister}
              activeOpacity={0.85}
            >
              <Text style={styles.buttonText}>Criar conta</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.footer}>
            <Text
              style={[
                styles.footerText,
                {
                  color: colors.footerText,
                },
              ]}
            >
              Já tem uma conta?
            </Text>

            <TouchableOpacity
              onPress={() => router.push("/login")}
              activeOpacity={0.7}
            >
              <Text
                style={[
                  styles.link,
                  {
                    color: colors.link,
                  },
                ]}
              >
                {" "}
                Entrar
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </ScrollView>
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

  card: {
    width: "100%",
    maxWidth: 460,
    borderRadius: 28,
    padding: 28,
    borderWidth: 1,
  },

  header: {
    alignItems: "center",
    marginBottom: 32,
  },

  logoCircle: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: "#405DE6",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 18,
  },

  logoText: {
    color: "#FFFFFF",
    fontSize: 30,
    fontWeight: "900",
  },

  title: {
    fontSize: 32,
    fontWeight: "900",
    textAlign: "center",
    marginBottom: 10,
  },

  subtitle: {
    fontSize: 15,
    lineHeight: 22,
    textAlign: "center",
    maxWidth: 330,
  },

  form: {
    width: "100%",
  },

  field: {
    width: "100%",
    marginBottom: 18,
  },

  label: {
    fontSize: 14,
    fontWeight: "700",
    marginBottom: 8,
    marginLeft: 3,
  },

  input: {
    width: "100%",
    minHeight: 56,
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderRadius: 15,
    borderWidth: 1,
    fontSize: 16,
  },

  button: {
    width: "100%",
    minHeight: 56,
    paddingHorizontal: 18,
    borderRadius: 15,
    backgroundColor: "#405DE6",
    alignItems: "center",
    justifyContent: "center",
    marginTop: 4,
  },

  buttonText: {
    color: "#FFFFFF",
    fontWeight: "800",
    fontSize: 17,
  },

  footer: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    marginTop: 26,
  },

  footerText: {
    fontSize: 14,
  },

  link: {
    fontSize: 14,
    fontWeight: "800",
  },
});

