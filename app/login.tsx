import { db } from "@/database/db";
import { usuarios } from "@/database/schema";
import AsyncStorage from "@react-native-async-storage/async-storage";
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
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  useColorScheme,
  View,
} from "react-native";

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
      if (user) {
        router.replace("/(tabs)/feed");
      }
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

    loadingBackground: isDark
      ? "rgba(0, 0, 0, 0.72)"
      : "rgba(15, 23, 42, 0.45)",
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
        <Animated.View
          style={[
            styles.card,
            {
              opacity: fadeAnim,
              backgroundColor: colors.card,
              borderColor: colors.cardBorder,
            },
          ]}
        >
          <View style={styles.header}>
            <View style={styles.logoCircle}>
              <Text style={styles.logoText}>B</Text>
            </View>

            <Text
              style={[
                styles.title,
                {
                  color: colors.title,
                },
              ]}
            >
              BookNook
            </Text>

            <Text
              style={[
                styles.subtitle,
                {
                  color: colors.subtitle,
                },
              ]}
            >
              Entre na sua conta e continue a sua experiência de leitura.
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
                editable={!loading}
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
                editable={!loading}
              />
            </View>

            <TouchableOpacity
              style={[
                styles.button,
                loading && styles.buttonDisabled,
              ]}
              onPress={handleLogin}
              activeOpacity={0.85}
              disabled={loading}
            >
              <Text style={styles.buttonText}>
                Entrar
              </Text>
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
              Não tem uma conta?
            </Text>

            <TouchableOpacity
              onPress={() => router.push("/register")}
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
                {" "}
                Cadastre-se
              </Text>
            </TouchableOpacity>
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
              <ActivityIndicator
                size="large"
                color="#405DE6"
              />

              <Text
                style={[
                  styles.loadingText,
                  {
                    color: colors.title,
                  },
                ]}
              >
                Entrando...
              </Text>

              <Text
                style={[
                  styles.loadingSubtext,
                  {
                    color: colors.subtitle,
                  },
                ]}
              >
                Aguarde um momento
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
    width: 76,
    height: 76,
    borderRadius: 38,
    backgroundColor: "#405DE6",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 18,
  },

  logoText: {
    color: "#FFFFFF",
    fontSize: 32,
    fontWeight: "900",
  },

  title: {
    fontSize: 34,
    fontWeight: "900",
    textAlign: "center",
    marginBottom: 10,
  },

  subtitle: {
    fontSize: 15,
    lineHeight: 22,
    textAlign: "center",
    maxWidth: 340,
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

  buttonDisabled: {
    opacity: 0.65,
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

  loadingOverlay: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 24,
  },

  loadingCard: {
    width: "82%",
    maxWidth: 320,
    borderRadius: 24,
    borderWidth: 1,
    paddingVertical: 30,
    paddingHorizontal: 24,
    alignItems: "center",
  },

  loadingText: {
    marginTop: 16,
    fontSize: 17,
    fontWeight: "800",
  },

  loadingSubtext: {
    marginTop: 6,
    fontSize: 13,
  },
});

