import { getDb } from "@/database/db";
import { usuarios } from "@/database/schema";

import { eq } from "drizzle-orm";
import { useRouter } from "expo-router";
import { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Animated,
  KeyboardAvoidingView,
  Modal,
  Platform,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  useColorScheme,
  View,
} from "react-native";

export default function Register() {
  const router = useRouter();

  const colorScheme = useColorScheme();
  const isDark = colorScheme === "dark";

  const [nome, setNome] = useState("");
  const [senha, setSenha] = useState("");
  const [confirmar, setConfirmar] = useState("");
  const [loading, setLoading] = useState(false);
  const [mostrarSenha, setMostrarSenha] = useState(false);
  const [mostrarConfirmar, setMostrarConfirmar] = useState(false);

  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(25)).current;
  const logoScale = useRef(new Animated.Value(0.85)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 650,
        useNativeDriver: true,
      }),
      Animated.timing(slideAnim, {
        toValue: 0,
        duration: 650,
        useNativeDriver: true,
      }),
      Animated.spring(logoScale, {
        toValue: 1,
        friction: 7,
        tension: 70,
        useNativeDriver: true,
      }),
    ]).start();
  }, [fadeAnim, logoScale, slideAnim]);

  const handleRegister = async () => {
    const nomeLimpo = nome.trim();

    if (!nomeLimpo || !senha || !confirmar) {
      Alert.alert(
        "Atenção",
        "Preencha todos os campos para criar a sua conta.",
      );
      return;
    }

    if (nomeLimpo.length < 3) {
      Alert.alert(
        "Nome de usuário inválido",
        "O nome de usuário deve ter pelo menos 3 caracteres.",
      );
      return;
    }

    if (senha.length < 4) {
      Alert.alert(
        "Senha inválida",
        "A senha deve ter pelo menos 4 caracteres.",
      );
      return;
    }

    if (senha !== confirmar) {
      Alert.alert(
        "Senhas diferentes",
        "A confirmação da senha não corresponde à senha informada.",
      );
      return;
    }

    try {
      setLoading(true);

      const database = await getDb();

      const existe = await database
        .select()
        .from(usuarios)
        .where(eq(usuarios.nome, nomeLimpo))
        .limit(1);

      if (existe.length > 0) {
        Alert.alert(
          "Usuário já existe",
          "Esse nome de usuário já está registado. Escolha outro.",
        );
        return;
      }

      const novoUsuario = {
        id: Date.now().toString(),
        nome: nomeLimpo,
        senha,
        foto_perfil: null,
      };

      await database.insert(usuarios).values(novoUsuario);

      Alert.alert(
        "Conta criada!",
        "A sua conta foi criada com sucesso. Agora pode entrar no BookNook.",
        [
          {
            text: "Entrar",
            onPress: () => router.replace("/login"),
          },
        ],
      );
    } catch (err) {
      console.error("Erro ao criar usuário:", err);

      Alert.alert(
        "Erro",
        "Não foi possível criar a conta. Tente novamente.",
      );
    } finally {
      setLoading(false);
    }
  };

  const colors = {
    background: isDark ? "#070B18" : "#F5F7FF",

    card: isDark ? "#10172A" : "#FFFFFF",
    cardBorder: isDark ? "#1E293B" : "#E5E7EB",

    title: isDark ? "#FFFFFF" : "#111827",
    subtitle: isDark ? "#9CA8BF" : "#64748B",

    label: isDark ? "#E8ECF5" : "#1E293B",

    inputBackground: isDark ? "#151E33" : "#F8FAFC",
    inputBorder: isDark ? "#293750" : "#DDE3EE",
    inputText: isDark ? "#FFFFFF" : "#0F172A",
    placeholder: isDark ? "#71809A" : "#94A3B8",

    link: "#405DE6",

    iconBackground: isDark ? "#192344" : "#EEF2FF",

    loadingBackground: isDark
      ? "rgba(2, 6, 23, 0.82)"
      : "rgba(15, 23, 42, 0.48)",
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
      <StatusBar
        barStyle={isDark ? "light-content" : "dark-content"}
        backgroundColor={colors.background}
      />

      <ScrollView
        contentContainerStyle={styles.scroll}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <View
          pointerEvents="none"
          style={[
            styles.backgroundGlow,
            {
              backgroundColor: isDark
                ? "rgba(64, 93, 230, 0.13)"
                : "rgba(64, 93, 230, 0.08)",
            },
          ]}
        />

        <Animated.View
          style={[
            styles.content,
            {
              opacity: fadeAnim,
              transform: [{ translateY: slideAnim }],
            },
          ]}
        >
          <Animated.View
            style={[
              styles.logoWrapper,
              {
                transform: [{ scale: logoScale }],
              },
            ]}
          >
            <View style={styles.logoCircle}>
              <Text style={styles.logoText}>B</Text>
            </View>

            <View style={styles.logoDot} />
          </Animated.View>

          <View style={styles.header}>
            <Text
              style={[
                styles.title,
                {
                  color: colors.title,
                },
              ]}
            >
              Cria a tua conta
            </Text>

            <Text
              style={[
                styles.subtitle,
                {
                  color: colors.subtitle,
                },
              ]}
            >
              Junta-te ao BookNook e começa a descobrir, ler e partilhar
              novas histórias.
            </Text>
          </View>

          <View
            style={[
              styles.card,
              {
                backgroundColor: colors.card,
                borderColor: colors.cardBorder,
              },
            ]}
          >
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

                <View
                  style={[
                    styles.inputWrapper,
                    {
                      backgroundColor: colors.inputBackground,
                      borderColor: colors.inputBorder,
                    },
                  ]}
                >
                  <View
                    style={[
                      styles.inputIcon,
                      {
                        backgroundColor: colors.iconBackground,
                      },
                    ]}
                  >
                    <Text style={styles.inputIconText}>@</Text>
                  </View>

                  <TextInput
                    placeholder="Escolha um nome de usuário"
                    placeholderTextColor={colors.placeholder}
                    style={[
                      styles.input,
                      {
                        color: colors.inputText,
                      },
                    ]}
                    value={nome}
                    onChangeText={setNome}
                    autoCapitalize="none"
                    autoCorrect={false}
                    autoComplete="username"
                    editable={!loading}
                    returnKeyType="next"
                  />
                </View>
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

                <View
                  style={[
                    styles.inputWrapper,
                    {
                      backgroundColor: colors.inputBackground,
                      borderColor: colors.inputBorder,
                    },
                  ]}
                >
                  <View
                    style={[
                      styles.inputIcon,
                      {
                        backgroundColor: colors.iconBackground,
                      },
                    ]}
                  >
                    <Text style={styles.inputIconText}>•</Text>
                  </View>

                  <TextInput
                    placeholder="Crie uma senha"
                    placeholderTextColor={colors.placeholder}
                    style={[
                      styles.input,
                      {
                        color: colors.inputText,
                      },
                    ]}
                    secureTextEntry={!mostrarSenha}
                    value={senha}
                    onChangeText={setSenha}
                    autoCapitalize="none"
                    autoCorrect={false}
                    autoComplete="new-password"
                    editable={!loading}
                    returnKeyType="next"
                  />

                  <TouchableOpacity
                    style={styles.showPassword}
                    onPress={() => setMostrarSenha((value) => !value)}
                    disabled={loading}
                    activeOpacity={0.7}
                  >
                    <Text
                      style={[
                        styles.showPasswordText,
                        {
                          color: colors.subtitle,
                        },
                      ]}
                    >
                      {mostrarSenha ? "Ocultar" : "Mostrar"}
                    </Text>
                  </TouchableOpacity>
                </View>
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

                <View
                  style={[
                    styles.inputWrapper,
                    {
                      backgroundColor: colors.inputBackground,
                      borderColor: colors.inputBorder,
                    },
                  ]}
                >
                  <View
                    style={[
                      styles.inputIcon,
                      {
                        backgroundColor: colors.iconBackground,
                      },
                    ]}
                  >
                    <Text style={styles.inputIconText}>✓</Text>
                  </View>

                  <TextInput
                    placeholder="Digite a senha novamente"
                    placeholderTextColor={colors.placeholder}
                    style={[
                      styles.input,
                      {
                        color: colors.inputText,
                      },
                    ]}
                    secureTextEntry={!mostrarConfirmar}
                    value={confirmar}
                    onChangeText={setConfirmar}
                    autoCapitalize="none"
                    autoCorrect={false}
                    autoComplete="new-password"
                    editable={!loading}
                    returnKeyType="done"
                    onSubmitEditing={handleRegister}
                  />

                  <TouchableOpacity
                    style={styles.showPassword}
                    onPress={() =>
                      setMostrarConfirmar((value) => !value)
                    }
                    disabled={loading}
                    activeOpacity={0.7}
                  >
                    <Text
                      style={[
                        styles.showPasswordText,
                        {
                          color: colors.subtitle,
                        },
                      ]}
                    >
                      {mostrarConfirmar ? "Ocultar" : "Mostrar"}
                    </Text>
                  </TouchableOpacity>
                </View>
              </View>

              <TouchableOpacity
                style={[
                  styles.button,
                  loading && styles.buttonDisabled,
                ]}
                onPress={handleRegister}
                activeOpacity={0.88}
                disabled={loading}
              >
                <Text style={styles.buttonText}>
                  Criar minha conta
                </Text>

                <View style={styles.buttonArrow}>
                  <Text style={styles.buttonArrowText}>→</Text>
                </View>
              </TouchableOpacity>
            </View>

            <View
              style={[
                styles.divider,
                {
                  backgroundColor: colors.cardBorder,
                },
              ]}
            />

            <View style={styles.footer}>
              <Text
                style={[
                  styles.footerText,
                  {
                    color: colors.subtitle,
                  },
                ]}
              >
                Já tens uma conta?
              </Text>

              <TouchableOpacity
                onPress={() => router.replace("/login")}
                activeOpacity={0.7}
                disabled={loading}
              >
                <Text
                  style={[
                    styles.link,
                    {
                      color: colors.link,
                    },
                  ]}
                >
                  Entrar
                </Text>
              </TouchableOpacity>
            </View>
          </View>

          <View style={styles.bottomMessage}>
            <View
              style={[
                styles.bottomDot,
                {
                  backgroundColor: "#405DE6",
                },
              ]}
            />

            <Text
              style={[
                styles.bottomText,
                {
                  color: colors.subtitle,
                },
              ]}
            >
              Cria o teu espaço de leitura
            </Text>
          </View>
        </Animated.View>
      </ScrollView>

      {loading && (
        <Modal
          transparent
          visible={loading}
          animationType="fade"
          statusBarTranslucent
        >
          <View
            style={[
              styles.loadingOverlay,
              {
                backgroundColor: colors.loadingBackground,
              },
            ]}
          >
            <View
              style={[
                styles.loadingCard,
                {
                  backgroundColor: colors.card,
                  borderColor: colors.cardBorder,
                },
              ]}
            >
              <View style={styles.loadingIcon}>
                <ActivityIndicator
                  size="large"
                  color="#405DE6"
                />
              </View>

              <Text
                style={[
                  styles.loadingText,
                  {
                    color: colors.title,
                  },
                ]}
              >
                A criar a conta...
              </Text>

              <Text
                style={[
                  styles.loadingSubtext,
                  {
                    color: colors.subtitle,
                  },
                ]}
              >
                A preparar o teu espaço no BookNook
              </Text>
            </View>
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
    paddingHorizontal: 22,
    paddingVertical: 36,
  },

  backgroundGlow: {
    position: "absolute",
    width: 320,
    height: 320,
    borderRadius: 160,
    top: -110,
    right: -110,
  },

  content: {
    width: "100%",
    maxWidth: 470,
    alignItems: "center",
  },

  logoWrapper: {
    position: "relative",
    marginBottom: 20,
  },

  logoCircle: {
    width: 78,
    height: 78,
    borderRadius: 24,
    backgroundColor: "#405DE6",
    alignItems: "center",
    justifyContent: "center",

    shadowColor: "#405DE6",
    shadowOffset: {
      width: 0,
      height: 10,
    },
    shadowOpacity: 0.28,
    shadowRadius: 18,
    elevation: 10,
  },

  logoText: {
    color: "#FFFFFF",
    fontSize: 38,
    fontWeight: "900",
    letterSpacing: -2,
  },

  logoDot: {
    position: "absolute",
    width: 13,
    height: 13,
    borderRadius: 7,
    backgroundColor: "#FFFFFF",
    right: -4,
    bottom: -3,
    borderWidth: 3,
    borderColor: "#405DE6",
  },

  header: {
    alignItems: "center",
    marginBottom: 28,
    paddingHorizontal: 10,
  },

  title: {
    fontSize: 30,
    lineHeight: 36,
    fontWeight: "900",
    letterSpacing: -0.7,
    textAlign: "center",
    marginBottom: 9,
  },

  subtitle: {
    fontSize: 15,
    lineHeight: 22,
    textAlign: "center",
    maxWidth: 390,
  },

  card: {
    width: "100%",
    borderRadius: 26,
    borderWidth: 1,
    padding: 22,

    shadowColor: "#000000",
    shadowOffset: {
      width: 0,
      height: 12,
    },
    shadowOpacity: 0.08,
    shadowRadius: 25,
    elevation: 7,
  },

  form: {
    width: "100%",
  },

  field: {
    width: "100%",
    marginBottom: 19,
  },

  label: {
    fontSize: 13,
    fontWeight: "800",
    marginBottom: 8,
    marginLeft: 2,
    letterSpacing: 0.1,
  },

  inputWrapper: {
    width: "100%",
    minHeight: 58,
    borderRadius: 16,
    borderWidth: 1,
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 9,
  },

  inputIcon: {
    width: 38,
    height: 38,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 9,
  },

  inputIconText: {
    color: "#405DE6",
    fontSize: 18,
    fontWeight: "900",
  },

  input: {
    flex: 1,
    minHeight: 56,
    paddingHorizontal: 4,
    fontSize: 16,
    fontWeight: "500",
  },

  showPassword: {
    paddingHorizontal: 7,
    paddingVertical: 10,
  },

  showPasswordText: {
    fontSize: 12,
    fontWeight: "800",
  },

  button: {
    width: "100%",
    minHeight: 58,
    borderRadius: 16,
    backgroundColor: "#405DE6",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    marginTop: 3,

    shadowColor: "#405DE6",
    shadowOffset: {
      width: 0,
      height: 8,
    },
    shadowOpacity: 0.28,
    shadowRadius: 14,
    elevation: 6,
  },

  buttonDisabled: {
    opacity: 0.62,
  },

  buttonText: {
    color: "#FFFFFF",
    fontWeight: "900",
    fontSize: 16,
    letterSpacing: 0.2,
  },

  buttonArrow: {
    position: "absolute",
    right: 15,
    width: 34,
    height: 34,
    borderRadius: 10,
    backgroundColor: "rgba(255,255,255,0.16)",
    alignItems: "center",
    justifyContent: "center",
  },

  buttonArrowText: {
    color: "#FFFFFF",
    fontSize: 20,
    fontWeight: "700",
    marginTop: -2,
  },

  divider: {
    height: 1,
    width: "100%",
    marginTop: 22,
    marginBottom: 18,
  },

  footer: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    flexWrap: "wrap",
  },

  footerText: {
    fontSize: 13,
    lineHeight: 20,
    marginRight: 5,
  },

  link: {
    fontSize: 13,
    lineHeight: 20,
    fontWeight: "900",
  },

  bottomMessage: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    marginTop: 23,
    paddingHorizontal: 10,
  },

  bottomDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    marginRight: 8,
  },

  bottomText: {
    fontSize: 12,
    fontWeight: "600",
  },

  loadingOverlay: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 24,
  },

  loadingCard: {
    width: "84%",
    maxWidth: 320,
    borderRadius: 25,
    borderWidth: 1,
    paddingVertical: 30,
    paddingHorizontal: 24,
    alignItems: "center",

    shadowColor: "#000000",
    shadowOffset: {
      width: 0,
      height: 10,
    },
    shadowOpacity: 0.15,
    shadowRadius: 25,
    elevation: 10,
  },

  loadingIcon: {
    width: 58,
    height: 58,
    borderRadius: 18,
    backgroundColor: "rgba(64, 93, 230, 0.10)",
    alignItems: "center",
    justifyContent: "center",
  },

  loadingText: {
    marginTop: 16,
    fontSize: 17,
    fontWeight: "900",
  },

  loadingSubtext: {
    marginTop: 6,
    fontSize: 13,
    textAlign: "center",
    lineHeight: 19,
  },
});
