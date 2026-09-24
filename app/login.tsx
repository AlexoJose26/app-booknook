import { MaterialCommunityIcons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useRouter } from "expo-router";
import { useState } from "react";
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";

import { useUsuario } from "@/contexts/UsuarioContext";
import { loginUsuario } from "@/database/services/api";

const BLUE = "#1877F2";
const BLUE_DARK = "#0D65D9";
const BACKGROUND = "#FDF6E3";
const TEXT = "#17202A";
const MUTED = "#6B7280";
const BORDER = "#D8DEE6";
const INPUT_BACKGROUND = "#FFFFFF";

export default function LoginScreen() {
  const router = useRouter();

  const { setUsuario } = useUsuario();

  const [nome, setNome] = useState("");
  const [senha, setSenha] = useState("");
  const [mostrarSenha, setMostrarSenha] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleLogin = async () => {
    const nomeLimpo = nome.trim();

    if (!nomeLimpo || !senha) {
      Alert.alert(
        "Atenção",
        "Preencha o nome de usuário e a senha para continuar.",
      );
      return;
    }

    if (loading) {
      return;
    }

    try {
      setLoading(true);


      const resposta = await loginUsuario(nomeLimpo, senha);

      if (!resposta?.success) {
        throw new Error(
          "Não foi possível efetuar o login.",
        );
      }

      if (!resposta?.token) {
        throw new Error(
          "O servidor não devolveu o token de autenticação.",
        );
      }

      if (!resposta?.user) {
        throw new Error(
          "O servidor não devolveu os dados do utilizador.",
        );
      }


      const usuarioLogado = {
        id: String(resposta.user.id),
        nome: String(resposta.user.nome),
        foto_perfil:
          resposta.user.foto_perfil ?? null,
        createdAt:
          resposta.user.createdAt,
      };


      await AsyncStorage.setItem(
        "authToken",
        resposta.token,
      );


      await AsyncStorage.setItem(
        "usuarioLogado",
        JSON.stringify({
          ...usuarioLogado,
          perfilAtualizadoEm: Date.now(),
        }),
      );


      setUsuario(usuarioLogado);

   
      const tokenGuardado =
        await AsyncStorage.getItem("authToken");

      const usuarioGuardado =
        await AsyncStorage.getItem("usuarioLogado");

      if (!tokenGuardado || !usuarioGuardado) {
        throw new Error(
          "O login foi realizado, mas não foi possível guardar a sessão no dispositivo.",
        );
      }

      /**
       * =====================================================
       * NAVEGAR PARA O FEED
       * =====================================================
       */
      router.replace("/(tabs)/feed");
    } catch (error) {
      console.error("Erro no login:", error);

      let mensagem =
        "Não foi possível efetuar o login. Tente novamente.";

      if (error instanceof Error) {
        mensagem = error.message;
      } else if (typeof error === "string" && error.trim()) {
        mensagem = error;
      }

      Alert.alert(
        "Não foi possível entrar",
        mensagem,
      );
    } finally {
      setLoading(false);
    }
  };

  const abrirCadastro = () => {
    if (loading) {
      return;
    }

    router.push("/register");
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={
        Platform.OS === "ios"
          ? "padding"
          : undefined
      }
    >
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.content}>
          {/* =================================================
              LOGO / CABEÇALHO
              ================================================= */}
          <View style={styles.header}>
            <View style={styles.logoCircle}>
              <MaterialCommunityIcons
                name="book-open-page-variant"
                size={42}
                color="#FFFFFF"
              />
            </View>

            <Text style={styles.title}>
              BookNook
            </Text>

            <Text style={styles.subtitle}>
              A tua rede social para leitores
            </Text>
          </View>

          {/* =================================================
              FORMULÁRIO
              ================================================= */}
          <View style={styles.form}>
            <Text style={styles.formTitle}>
              Bem-vindo de volta!
            </Text>

            <Text style={styles.formSubtitle}>
              Entre na sua conta para continuar.
            </Text>

            {/* Nome */}
            <View style={styles.inputGroup}>
              <Text style={styles.label}>
                Nome de usuário
              </Text>

              <View style={styles.inputWrapper}>
                <MaterialCommunityIcons
                  name="account-outline"
                  size={22}
                  color={MUTED}
                  style={styles.inputIcon}
                />

                <TextInput
                  value={nome}
                  onChangeText={setNome}
                  placeholder="Digite o seu nome de usuário"
                  placeholderTextColor="#9CA3AF"
                  autoCapitalize="none"
                  autoCorrect={false}
                  editable={!loading}
                  returnKeyType="next"
                  style={styles.input}
                />
              </View>
            </View>

            {/* Senha */}
            <View style={styles.inputGroup}>
              <Text style={styles.label}>
                Senha
              </Text>

              <View style={styles.inputWrapper}>
                <MaterialCommunityIcons
                  name="lock-outline"
                  size={22}
                  color={MUTED}
                  style={styles.inputIcon}
                />

                <TextInput
                  value={senha}
                  onChangeText={setSenha}
                  placeholder="Digite a sua senha"
                  placeholderTextColor="#9CA3AF"
                  secureTextEntry={!mostrarSenha}
                  autoCapitalize="none"
                  autoCorrect={false}
                  editable={!loading}
                  returnKeyType="done"
                  onSubmitEditing={handleLogin}
                  style={styles.input}
                />

                <Pressable
                  onPress={() =>
                    setMostrarSenha(
                      (valor) => !valor,
                    )
                  }
                  disabled={loading}
                  hitSlop={10}
                  style={styles.eyeButton}
                >
                  <MaterialCommunityIcons
                    name={
                      mostrarSenha
                        ? "eye-off-outline"
                        : "eye-outline"
                    }
                    size={22}
                    color={MUTED}
                  />
                </Pressable>
              </View>
            </View>

            {/* =================================================
                BOTÃO ENTRAR
                ================================================= */}
            <Pressable
              onPress={handleLogin}
              disabled={loading}
              style={({ pressed }) => [
                styles.loginButton,
                pressed &&
                !loading &&
                styles.loginButtonPressed,
                loading &&
                styles.loginButtonDisabled,
              ]}
            >
              {loading ? (
                <ActivityIndicator
                  size="small"
                  color="#FFFFFF"
                />
              ) : (
                <>
                  <Text style={styles.loginButtonText}>
                    Entrar
                  </Text>

                  <MaterialCommunityIcons
                    name="arrow-right"
                    size={22}
                    color="#FFFFFF"
                  />
                </>
              )}
            </Pressable>

            {/* =================================================
                CADASTRO
                ================================================= */}
            <View style={styles.registerContainer}>
              <Text style={styles.registerText}>
                Ainda não tens uma conta?
              </Text>

              <Pressable
                onPress={abrirCadastro}
                disabled={loading}
                hitSlop={8}
              >
                <Text style={styles.registerLink}>
                  Criar conta
                </Text>
              </Pressable>
            </View>
          </View>

          {/* =================================================
              RODAPÉ
              ================================================= */}
          <View style={styles.footer}>
            <MaterialCommunityIcons
              name="book-open-variant"
              size={18}
              color={MUTED}
            />

            <Text style={styles.footerText}>
              Lê. Partilha. Descobre.
            </Text>
          </View>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: BACKGROUND,
  },

  scrollContent: {
    flexGrow: 1,
  },

  content: {
    flexGrow: 1,
    width: "100%",
    maxWidth: 520,
    alignSelf: "center",
    paddingHorizontal: 24,
    paddingTop: 48,
    paddingBottom: 30,
  },

  header: {
    alignItems: "center",
    marginBottom: 34,
  },

  logoCircle: {
    width: 82,
    height: 82,
    borderRadius: 26,
    backgroundColor: BLUE,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 16,
    elevation: 5,
    shadowColor: BLUE,
    shadowOffset: {
      width: 0,
      height: 4,
    },
    shadowOpacity: 0.2,
    shadowRadius: 8,
  },

  title: {
    fontSize: 32,
    fontWeight: "800",
    color: TEXT,
    letterSpacing: -0.8,
  },

  subtitle: {
    marginTop: 7,
    fontSize: 15,
    color: MUTED,
    textAlign: "center",
  },

  form: {
    width: "100%",
  },

  formTitle: {
    fontSize: 25,
    fontWeight: "800",
    color: TEXT,
    marginBottom: 7,
  },

  formSubtitle: {
    fontSize: 14,
    color: MUTED,
    marginBottom: 25,
  },

  inputGroup: {
    marginBottom: 18,
  },

  label: {
    fontSize: 14,
    fontWeight: "700",
    color: TEXT,
    marginBottom: 8,
  },

  inputWrapper: {
    minHeight: 54,
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: INPUT_BACKGROUND,
    borderWidth: 1,
    borderColor: BORDER,
    borderRadius: 15,
  },

  inputIcon: {
    marginLeft: 15,
  },

  input: {
    flex: 1,
    minHeight: 52,
    paddingHorizontal: 12,
    paddingVertical: 12,
    fontSize: 15,
    color: TEXT,
  },

  eyeButton: {
    paddingHorizontal: 15,
    paddingVertical: 12,
  },

  loginButton: {
    minHeight: 56,
    borderRadius: 16,
    backgroundColor: BLUE,
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    gap: 9,
    marginTop: 7,
    elevation: 3,
    shadowColor: BLUE,
    shadowOffset: {
      width: 0,
      height: 3,
    },
    shadowOpacity: 0.18,
    shadowRadius: 6,
  },

  loginButtonPressed: {
    backgroundColor: BLUE_DARK,
    transform: [
      {
        scale: 0.99,
      },
    ],
  },

  loginButtonDisabled: {
    opacity: 0.7,
  },

  loginButtonText: {
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "800",
  },

  registerContainer: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    flexWrap: "wrap",
    marginTop: 24,
    gap: 5,
  },

  registerText: {
    fontSize: 14,
    color: MUTED,
  },

  registerLink: {
    fontSize: 14,
    color: BLUE,
    fontWeight: "800",
  },

  footer: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 7,
    marginTop: "auto",
    paddingTop: 40,
  },

  footerText: {
    fontSize: 13,
    color: MUTED,
  },
});

