import { MaterialCommunityIcons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useRouter } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useEffect, useRef, useState, type ComponentProps } from "react";
import {
  ActivityIndicator,
  Alert,
  Animated,
  Easing,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  useColorScheme,
  View,
} from "react-native";

import { useUsuario } from "@/contexts/UsuarioContext";
import { loginUsuario } from "@/database/services/api";

const BLUE = "#1877F2";
const BLUE_DARK = "#0D65D9";

const LIGHT = {
  background: "#F4F7FB",
  surface: "#FFFFFF",
  surfaceSoft: "#F8FAFD",
  text: "#17202A",
  muted: "#667085",
  placeholder: "#98A2B3",
  border: "#D9E0EA",
  borderFocused: "#1877F2",
  icon: "#667085",
  footer: "#7A8494",
};

const DARK = {
  background: "#0B1220",
  surface: "#121B2B",
  surfaceSoft: "#182235",
  text: "#F4F7FB",
  muted: "#A8B2C1",
  placeholder: "#778399",
  border: "#29364A",
  borderFocused: "#5EA2FF",
  icon: "#A8B2C1",
  footer: "#8995A8",
};

type IconName = ComponentProps<
  typeof MaterialCommunityIcons
>["name"];

export default function LoginScreen() {
  const router = useRouter();
  const { setUsuario } = useUsuario();

  const colorScheme = useColorScheme();
  const isDark = colorScheme === "dark";
  const colors = isDark ? DARK : LIGHT;

  const [nome, setNome] = useState("");
  const [senha, setSenha] = useState("");
  const [mostrarSenha, setMostrarSenha] = useState(false);

  const [loading, setLoading] = useState(false);
  const [nomeFocused, setNomeFocused] = useState(false);
  const [senhaFocused, setSenhaFocused] = useState(false);

  /*
   * IMPORTANTE:
   * Cada Animated.Value é criado apenas uma vez.
   * Não utilizamos animação de cores com useNativeDriver:false,
   * pois isso estava causando o erro "_tracking".
   */
  const entrance = useRef(new Animated.Value(0)).current;
  const logoScale = useRef(new Animated.Value(0.82)).current;
  const logoRotate = useRef(new Animated.Value(0)).current;
  const buttonScale = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    entrance.setValue(0);
    logoScale.setValue(0.82);
    logoRotate.setValue(0);

    const animation = Animated.parallel([
      Animated.timing(entrance, {
        toValue: 1,
        duration: 650,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),

      Animated.spring(logoScale, {
        toValue: 1,
        damping: 13,
        stiffness: 150,
        mass: 0.8,
        useNativeDriver: true,
      }),

      Animated.sequence([
        Animated.timing(logoRotate, {
          toValue: 1,
          duration: 450,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }),

        Animated.timing(logoRotate, {
          toValue: 0,
          duration: 280,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
      ]),
    ]);

    animation.start();

    return () => {
      animation.stop();
    };
  }, [entrance, logoRotate, logoScale]);

  const logoRotation = logoRotate.interpolate({
    inputRange: [0, 1],
    outputRange: ["0deg", "-5deg"],
  });

  const contentTranslate = entrance.interpolate({
    inputRange: [0, 1],
    outputRange: [24, 0],
  });

  const contentOpacity = entrance.interpolate({
    inputRange: [0, 1],
    outputRange: [0, 1],
  });

  const animateButtonPress = () => {
    Animated.sequence([
      Animated.timing(buttonScale, {
        toValue: 0.985,
        duration: 80,
        easing: Easing.out(Easing.quad),
        useNativeDriver: true,
      }),

      Animated.spring(buttonScale, {
        toValue: 1,
        damping: 12,
        stiffness: 180,
        mass: 0.7,
        useNativeDriver: true,
      }),
    ]).start();
  };

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

      animateButtonPress();

      const resposta = await loginUsuario(nomeLimpo, senha);

      if (!resposta?.success) {
        throw new Error(
          resposta?.message ||
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
        foto_perfil: resposta.user.foto_perfil ?? null,
        createdAt: resposta.user.createdAt,
      };

      /*
       * Guarda o token recebido pela API.
       */
      await AsyncStorage.setItem(
        "authToken",
        String(resposta.token),
      );

      /*
       * Guarda os dados atuais do utilizador.
       */
      await AsyncStorage.setItem(
        "usuarioLogado",
        JSON.stringify({
          ...usuarioLogado,
          perfilAtualizadoEm: Date.now(),
        }),
      );

      /*
       * Atualiza o contexto global.
       */
      setUsuario(usuarioLogado);

      /*
       * Confirma que a sessão realmente foi persistida.
       */
      const tokenGuardado =
        await AsyncStorage.getItem("authToken");

      const usuarioGuardado =
        await AsyncStorage.getItem("usuarioLogado");

      if (!tokenGuardado || !usuarioGuardado) {
        throw new Error(
          "O login foi realizado, mas não foi possível guardar a sessão no dispositivo.",
        );
      }

      /*
       * Limpa os campos antes de navegar.
       */
      setSenha("");
      setNome("");

      /*
       * Vai diretamente para o Feed.
       */
      router.replace("/(tabs)/feed");
    } catch (error) {
      console.error("Erro no login:", error);

      let mensagem =
        "Não foi possível efetuar o login. Tente novamente.";

      if (error instanceof Error) {
        mensagem = error.message;
      } else if (
        typeof error === "string" &&
        error.trim()
      ) {
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

  const renderInputIcon = (
    name: IconName,
    focused: boolean,
  ) => {
    return (
      <MaterialCommunityIcons
        name={name}
        size={22}
        color={focused ? BLUE : colors.icon}
      />
    );
  };

  return (
    <View
      style={[
        styles.container,
        {
          backgroundColor: colors.background,
        },
      ]}
    >
      <StatusBar
        style={isDark ? "light" : "dark"}
        backgroundColor={colors.background}
      />

      <KeyboardAvoidingView
        style={styles.keyboard}
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
          bounces={false}
        >
          <View style={styles.content}>
            {/* HEADER */}
            <Animated.View
              style={[
                styles.header,
                {
                  opacity: contentOpacity,
                  transform: [
                    {
                      translateY: contentTranslate,
                    },
                  ],
                },
              ]}
            >
              <Animated.View
                style={[
                  styles.logoShell,
                  {
                    transform: [
                      {
                        scale: logoScale,
                      },
                      {
                        rotate: logoRotation,
                      },
                    ],
                  },
                ]}
              >
                <View
                  style={[
                    styles.logoGlow,
                    {
                      backgroundColor: isDark
                        ? "rgba(24,119,242,0.16)"
                        : "rgba(24,119,242,0.12)",
                    },
                  ]}
                />

                <View style={styles.logoCircle}>
                  <MaterialCommunityIcons
                    name="book-open-page-variant-outline"
                    size={38}
                    color="#FFFFFF"
                  />
                </View>
              </Animated.View>

              <Text
                style={[
                  styles.brand,
                  {
                    color: colors.text,
                  },
                ]}
              >
                BookNook
              </Text>

              <Text
                style={[
                  styles.subtitle,
                  {
                    color: colors.muted,
                  },
                ]}
              >
                A tua rede social para leitores
              </Text>

              <View
                style={[
                  styles.headerBadge,
                  {
                    backgroundColor: isDark
                      ? "rgba(24,119,242,0.14)"
                      : "rgba(24,119,242,0.09)",
                  },
                ]}
              >
                <MaterialCommunityIcons
                  name="book-multiple-outline"
                  size={15}
                  color={BLUE}
                />

                <Text style={styles.headerBadgeText}>
                  Lê. Partilha. Descobre.
                </Text>
              </View>
            </Animated.View>

            {/* CARD */}
            <Animated.View
              style={[
                styles.card,
                {
                  backgroundColor: colors.surface,
                  opacity: contentOpacity,
                  transform: [
                    {
                      translateY: contentTranslate,
                    },
                  ],
                  shadowColor: isDark
                    ? "#000000"
                    : "#102A43",
                },
              ]}
            >
              {/* CARD HEADER */}
              <View style={styles.cardHeader}>
                <View style={styles.cardTitleRow}>
                  <View
                    style={[
                      styles.titleIcon,
                      {
                        backgroundColor: isDark
                          ? "rgba(24,119,242,0.16)"
                          : "rgba(24,119,242,0.10)",
                      },
                    ]}
                  >
                    <MaterialCommunityIcons
                      name="login-variant"
                      size={20}
                      color={BLUE}
                    />
                  </View>

                  <View style={styles.titleCopy}>
                    <Text
                      style={[
                        styles.formTitle,
                        {
                          color: colors.text,
                        },
                      ]}
                    >
                      Bem-vindo de volta
                    </Text>

                    <Text
                      style={[
                        styles.formSubtitle,
                        {
                          color: colors.muted,
                        },
                      ]}
                    >
                      Entra na tua conta para continuar
                      a tua jornada.
                    </Text>
                  </View>
                </View>
              </View>

              {/* FORM */}
              <View style={styles.form}>
                {/* USERNAME */}
                <View style={styles.inputGroup}>
                  <Text
                    style={[
                      styles.label,
                      {
                        color: colors.text,
                      },
                    ]}
                  >
                    Nome de usuário
                  </Text>

                  <View
                    style={[
                      styles.inputWrapper,
                      {
                        backgroundColor:
                          colors.surfaceSoft,
                        borderColor: nomeFocused
                          ? colors.borderFocused
                          : colors.border,
                      },
                      nomeFocused &&
                      styles.inputWrapperFocused,
                    ]}
                  >
                    <View style={styles.inputIcon}>
                      {renderInputIcon(
                        "account-outline",
                        nomeFocused,
                      )}
                    </View>

                    <TextInput
                      value={nome}
                      onChangeText={setNome}
                      placeholder="Digite o seu nome de usuário"
                      placeholderTextColor={
                        colors.placeholder
                      }
                      autoCapitalize="none"
                      autoCorrect={false}
                      editable={!loading}
                      returnKeyType="next"
                      onFocus={() =>
                        setNomeFocused(true)
                      }
                      onBlur={() =>
                        setNomeFocused(false)
                      }
                      style={[
                        styles.input,
                        {
                          color: colors.text,
                        },
                      ]}
                    />
                  </View>
                </View>

                {/* PASSWORD */}
                <View style={styles.inputGroup}>
                  <Text
                    style={[
                      styles.label,
                      {
                        color: colors.text,
                      },
                    ]}
                  >
                    Senha
                  </Text>

                  <View
                    style={[
                      styles.inputWrapper,
                      {
                        backgroundColor:
                          colors.surfaceSoft,
                        borderColor: senhaFocused
                          ? colors.borderFocused
                          : colors.border,
                      },
                      senhaFocused &&
                      styles.inputWrapperFocused,
                    ]}
                  >
                    <View style={styles.inputIcon}>
                      {renderInputIcon(
                        "lock-outline",
                        senhaFocused,
                      )}
                    </View>

                    <TextInput
                      value={senha}
                      onChangeText={setSenha}
                      placeholder="Digite a sua senha"
                      placeholderTextColor={
                        colors.placeholder
                      }
                      secureTextEntry={!mostrarSenha}
                      autoCapitalize="none"
                      autoCorrect={false}
                      editable={!loading}
                      returnKeyType="done"
                      onSubmitEditing={handleLogin}
                      onFocus={() =>
                        setSenhaFocused(true)
                      }
                      onBlur={() =>
                        setSenhaFocused(false)
                      }
                      style={[
                        styles.input,
                        {
                          color: colors.text,
                        },
                      ]}
                    />

                    <Pressable
                      onPress={() =>
                        setMostrarSenha(
                          (valor) => !valor,
                        )
                      }
                      disabled={loading}
                      hitSlop={10}
                      style={({ pressed }) => [
                        styles.eyeButton,
                        pressed &&
                        styles.iconPressed,
                      ]}
                    >
                      <MaterialCommunityIcons
                        name={
                          mostrarSenha
                            ? "eye-off-outline"
                            : "eye-outline"
                        }
                        size={22}
                        color={colors.icon}
                      />
                    </Pressable>
                  </View>
                </View>

                {/* LOGIN BUTTON */}
                <Animated.View
                  style={[
                    styles.buttonWrapper,
                    {
                      transform: [
                        {
                          scale: buttonScale,
                        },
                      ],
                    },
                  ]}
                >
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
                      <View
                        style={styles.loadingContent}
                      >
                        <ActivityIndicator
                          size="small"
                          color="#FFFFFF"
                        />

                        <Text
                          style={styles.loginButtonText}
                        >
                          A entrar...
                        </Text>
                      </View>
                    ) : (
                      <View
                        style={styles.buttonContent}
                      >
                        <Text
                          style={
                            styles.loginButtonText
                          }
                        >
                          Entrar na conta
                        </Text>

                        <View
                          style={styles.buttonArrow}
                        >
                          <MaterialCommunityIcons
                            name="arrow-right"
                            size={19}
                            color="#FFFFFF"
                          />
                        </View>
                      </View>
                    )}
                  </Pressable>
                </Animated.View>
              </View>

              {/* DIVIDER */}
              <View
                style={[
                  styles.divider,
                  {
                    backgroundColor: colors.border,
                  },
                ]}
              />

              {/* REGISTER */}
              <View
                style={styles.registerContainer}
              >
                <Text
                  style={[
                    styles.registerText,
                    {
                      color: colors.muted,
                    },
                  ]}
                >
                  Ainda não tens uma conta?
                </Text>

                <Pressable
                  onPress={abrirCadastro}
                  disabled={loading}
                  hitSlop={8}
                  style={({ pressed }) => [
                    styles.registerButton,
                    pressed &&
                    styles.registerButtonPressed,
                  ]}
                >
                  <Text style={styles.registerLink}>
                    Criar conta
                  </Text>

                  <MaterialCommunityIcons
                    name="arrow-top-right"
                    size={16}
                    color={BLUE}
                  />
                </Pressable>
              </View>
            </Animated.View>

            {/* FOOTER */}
            <Animated.View
              style={[
                styles.footer,
                {
                  opacity: contentOpacity,
                  transform: [
                    {
                      translateY: contentTranslate,
                    },
                  ],
                },
              ]}
            >
              <View
                style={[
                  styles.footerIcon,
                  {
                    backgroundColor: isDark
                      ? "rgba(24,119,242,0.14)"
                      : "rgba(24,119,242,0.08)",
                  },
                ]}
              >
                <MaterialCommunityIcons
                  name="book-open-variant"
                  size={17}
                  color={BLUE}
                />
              </View>

              <Text
                style={[
                  styles.footerText,
                  {
                    color: colors.footer,
                  },
                ]}
              >
                Uma comunidade feita para quem ama
                ler.
              </Text>
            </Animated.View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },

  keyboard: {
    flex: 1,
  },

  scrollContent: {
    flexGrow: 1,
  },

  content: {
    width: "100%",
    maxWidth: 540,
    alignSelf: "center",
    paddingHorizontal: 22,
    paddingTop:
      Platform.OS === "web" ? 54 : 34,
    paddingBottom: 28,
  },

  header: {
    alignItems: "center",
    marginBottom: 26,
  },

  logoShell: {
    width: 88,
    height: 88,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 15,
  },

  logoGlow: {
    position: "absolute",
    width: 84,
    height: 84,
    borderRadius: 28,
    transform: [{ scale: 1.12 }],
  },

  logoCircle: {
    width: 78,
    height: 78,
    borderRadius: 25,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: BLUE,

    shadowColor: BLUE,
    shadowOffset: {
      width: 0,
      height: 8,
    },
    shadowOpacity: 0.25,
    shadowRadius: 14,
    elevation: 8,
  },

  brand: {
    fontSize: 32,
    lineHeight: 38,
    fontWeight: "900",
    letterSpacing: -1,
  },

  subtitle: {
    marginTop: 5,
    fontSize: 14.5,
    fontWeight: "500",
    textAlign: "center",
  },

  headerBadge: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 13,
    paddingHorizontal: 11,
    paddingVertical: 7,
    borderRadius: 99,
    gap: 6,
  },

  headerBadgeText: {
    color: BLUE,
    fontSize: 12,
    fontWeight: "700",
  },

  card: {
    width: "100%",
    borderRadius: 24,
    padding: 21,

    shadowOffset: {
      width: 0,
      height: 8,
    },
    shadowOpacity: 0.09,
    shadowRadius: 24,
    elevation: 5,
  },

  cardHeader: {
    marginBottom: 22,
  },

  cardTitleRow: {
    flexDirection: "row",
    alignItems: "flex-start",
  },

  titleIcon: {
    width: 42,
    height: 42,
    borderRadius: 13,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 12,
  },

  titleCopy: {
    flex: 1,
  },

  formTitle: {
    fontSize: 22,
    lineHeight: 28,
    fontWeight: "800",
    letterSpacing: -0.35,
  },

  formSubtitle: {
    fontSize: 13.5,
    lineHeight: 20,
    marginTop: 3,
  },

  form: {
    width: "100%",
  },

  inputGroup: {
    marginBottom: 17,
  },

  label: {
    fontSize: 13.5,
    fontWeight: "700",
    marginBottom: 8,
  },

  inputWrapper: {
    minHeight: 56,
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1,
    borderRadius: 16,
  },

  inputWrapperFocused: {
    shadowColor: BLUE,
    shadowOffset: {
      width: 0,
      height: 0,
    },
    shadowOpacity: 0.13,
    shadowRadius: 7,
    elevation: 2,
  },

  inputIcon: {
    width: 49,
    alignItems: "center",
    justifyContent: "center",
  },

  input: {
    flex: 1,
    minHeight: 54,
    paddingRight: 12,
    paddingVertical: 12,
    fontSize: 15,
    fontWeight: "500",
  },

  eyeButton: {
    width: 48,
    minHeight: 54,
    alignItems: "center",
    justifyContent: "center",
  },

  iconPressed: {
    opacity: 0.55,
    transform: [{ scale: 0.94 }],
  },

  buttonWrapper: {
    marginTop: 4,
  },

  loginButton: {
    minHeight: 57,
    borderRadius: 16,
    backgroundColor: BLUE,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 18,

    shadowColor: BLUE,
    shadowOffset: {
      width: 0,
      height: 6,
    },
    shadowOpacity: 0.22,
    shadowRadius: 12,
    elevation: 5,
  },

  loginButtonPressed: {
    backgroundColor: BLUE_DARK,
    opacity: 0.94,
  },

  loginButtonDisabled: {
    opacity: 0.72,
  },

  buttonContent: {
    width: "100%",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
  },

  loadingContent: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
  },

  loginButtonText: {
    color: "#FFFFFF",
    fontSize: 15.5,
    fontWeight: "800",
    letterSpacing: 0.05,
  },

  buttonArrow: {
    position: "absolute",
    right: 1,
    width: 36,
    height: 36,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(255,255,255,0.15)",
  },

  divider: {
    height: 1,
    width: "100%",
    marginTop: 23,
    marginBottom: 18,
  },

  registerContainer: {
    minHeight: 32,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    flexWrap: "wrap",
    gap: 5,
  },

  registerText: {
    fontSize: 13.5,
  },

  registerButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
    paddingVertical: 4,
  },

  registerButtonPressed: {
    opacity: 0.55,
    transform: [{ scale: 0.97 }],
  },

  registerLink: {
    color: BLUE,
    fontSize: 13.5,
    fontWeight: "800",
  },

  footer: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    marginTop: 22,
    paddingHorizontal: 12,
    gap: 8,
  },

  footerIcon: {
    width: 30,
    height: 30,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
  },

  footerText: {
    fontSize: 12.5,
    fontWeight: "500",
    textAlign: "center",
  },
});
