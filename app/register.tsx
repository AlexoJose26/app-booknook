import React, { useState, useRef, useEffect } from "react";
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
  ActivityIndicator,
  Animated,
} from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { LinearGradient } from "expo-linear-gradient";
import { useRouter } from "expo-router";
import { useThemeCustom } from "@/contexts/ThemeContext";

export default function Register() {
  const router = useRouter();
  const { colors, theme } = useThemeCustom();

  const [nome, setNome] = useState("");
  const [senha, setSenha] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);

  const fadeAnim = useRef(new Animated.Value(0)).current;
  const shakeAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(fadeAnim, {
      toValue: 1,
      duration: 800,
      useNativeDriver: true,
    }).start();
  }, []);

  const triggerShake = () => {
    shakeAnim.setValue(0);
    Animated.sequence([
      Animated.timing(shakeAnim, { toValue: 10, duration: 50, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: -10, duration: 50, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: 10, duration: 50, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: 0, duration: 50, useNativeDriver: true }),
    ]).start();
  };

  const handleRegister = async () => {
    if (!nome || !senha) {
      setError(true);
      triggerShake();
      Alert.alert("Erro", "Preencha todos os campos");
      return;
    }

    setLoading(true);
    setError(false);

    try {
      const data = await AsyncStorage.getItem("usuarios");
      const usuarios = data ? JSON.parse(data) : [];

      if (usuarios.some((u: any) => u.nome === nome)) {
        setError(true);
        triggerShake();
        Alert.alert("Erro", "Usuário já existe");
        setLoading(false);
        return;
      }

      const novo = { nome, senha, id: Date.now() };
      usuarios.push(novo);

      await AsyncStorage.setItem("usuarios", JSON.stringify(usuarios));
      await AsyncStorage.setItem("usuarioLogado", JSON.stringify(novo));

      router.replace("/(tabs)/feed");
    } catch {
      setError(true);
      triggerShake();
      Alert.alert("Erro", "Falha ao criar conta");
    } finally {
      setLoading(false);
    }
  };

  return (
    <LinearGradient
      colors={theme === "dark" ? ["#0B0F23", "#1A1F38"] : ["#EEF2FF", "#E0E7FF"]}
      style={styles.screen}
    >
      <KeyboardAvoidingView
        style={styles.container}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <ScrollView contentContainerStyle={styles.scroll}>
          <Animated.View
            style={[
              styles.card,
              {
                backgroundColor:
                  theme === "dark"
                    ? "rgba(20, 25, 50, 0.6)"
                    : "rgba(255, 255, 255, 0.6)",
                borderColor:
                  theme === "dark" ? "rgba(255,255,255,0.2)" : "rgba(0,0,0,0.1)",
                opacity: fadeAnim,
                transform: [{ translateX: shakeAnim }],
              },
            ]}
          >
            <Text style={[styles.title, { color: colors.text }]}>Criar Conta</Text>

            {/* Input Nome */}
            <View
              style={[
                styles.inputContainer,
                {
                  backgroundColor:
                    theme === "dark"
                      ? "rgba(255,255,255,0.08)"
                      : "rgba(0,0,0,0.06)",
                  borderColor: error
                    ? "#F87171"
                    : theme === "dark"
                    ? "rgba(255,255,255,0.3)"
                    : "rgba(0,0,0,0.2)",
                },
              ]}
            >
              <TextInput
                style={[styles.input, { color: colors.text }]}
                placeholder="Nome de utilizador"
                placeholderTextColor={theme === "dark" ? "#AAA" : "#555"}
                value={nome}
                onChangeText={setNome}
              />
            </View>

            {/* Input Senha */}
            <View
              style={[
                styles.inputContainer,
                {
                  backgroundColor:
                    theme === "dark"
                      ? "rgba(255,255,255,0.08)"
                      : "rgba(0,0,0,0.06)",
                  borderColor: error
                    ? "#F87171"
                    : theme === "dark"
                    ? "rgba(255,255,255,0.3)"
                    : "rgba(0,0,0,0.2)",
                },
              ]}
            >
              <TextInput
                style={[styles.input, { color: colors.text }]}
                placeholder="Senha"
                placeholderTextColor={theme === "dark" ? "#AAA" : "#555"}
                secureTextEntry
                value={senha}
                onChangeText={setSenha}
              />
            </View>

            {/* Botão */}
            <TouchableOpacity
              style={styles.button}
              onPress={handleRegister}
              disabled={loading}
              activeOpacity={0.85}
            >
              {loading ? (
                <ActivityIndicator color="#FFF" />
              ) : (
                <LinearGradient
                  colors={["#6366F1", "#4F46E5"]}
                  style={styles.buttonGradient}
                >
                  <Text style={styles.buttonText}>Criar Conta</Text>
                </LinearGradient>
              )}
            </TouchableOpacity>

            {/* Link login */}
            <TouchableOpacity onPress={() => router.replace("/login")}>
              <Text style={[styles.link, { color: theme === "dark" ? "#BBB" : "#444" }]}>
                Já tem conta? Entrar
              </Text>
            </TouchableOpacity>
          </Animated.View>
        </ScrollView>

        {loading && (
          <View style={styles.loadingOverlay}>
            <ActivityIndicator size="large" color={theme === "dark" ? "#6366F1" : "#4F46E5"} />
          </View>
        )}
      </KeyboardAvoidingView>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  container: { flex: 1 },
  scroll: { flexGrow: 1, justifyContent: "center", padding: 20 },

  card: {
    borderRadius: 22,
    padding: 35,
    borderWidth: 1,
    shadowColor: "#000",
    shadowOpacity: 0.2,
    shadowOffset: { width: 0, height: 12 },
    shadowRadius: 20,
    elevation: 15,
    backdropFilter: "blur(15px)", // efeito glassmorphism moderno
  },

  title: { fontSize: 32, fontWeight: "700", textAlign: "center", marginBottom: 30 },

  inputContainer: {
    marginBottom: 18,
    borderRadius: 16,
    overflow: "hidden",
    borderWidth: 1,
  },
  input: { padding: 18, fontSize: 16 },

  button: { marginTop: 18, borderRadius: 16, overflow: "hidden" },
  buttonGradient: { paddingVertical: 18, borderRadius: 16 },
  buttonText: { color: "#FFF", textAlign: "center", fontSize: 18, fontWeight: "600" },

  link: { textAlign: "center", marginTop: 20, fontSize: 14, fontWeight: "500" },

  loadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "rgba(0,0,0,0.2)",
  },
});
