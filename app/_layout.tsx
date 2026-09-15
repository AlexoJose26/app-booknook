import React, { useEffect, useState } from "react";
import { View, Text, StyleSheet, SafeAreaView } from "react-native";
import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { SafeAreaProvider, useSafeAreaInsets } from "react-native-safe-area-context";

import { ThemeProviderCustom, useThemeCustom } from "@/contexts/ThemeContext";
import { LivrosProvider } from "@/contexts/LivrosContext";
import { UsuarioProvider } from "@/contexts/UsuarioContext";
import { runMigrations } from "@/database/migrations";

export default function RootLayout() {
  const [dbReady, setDbReady] = useState(false);

  useEffect(() => {
    try {
      runMigrations();
      setDbReady(true);
    } catch (err) {
      console.error("Erro ao preparar banco:", err);
    }
  }, []);

  if (!dbReady) {
    return (
      <SafeAreaView style={[styles.safeArea, styles.center]}>
        <Text>Preparando banco de dados…</Text>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaProvider>
      <ThemeProviderCustom>
        <UsuarioProvider>
          <LivrosProvider>
            <ThemeWrapper />
          </LivrosProvider>
        </UsuarioProvider>
      </ThemeProviderCustom>
    </SafeAreaProvider>
  );
}

function ThemeWrapper() {
  const { theme } = useThemeCustom();
  const insets = useSafeAreaInsets();
  const isDark = theme === "dark";

  return (
    <SafeAreaView
      style={[
        styles.safeArea,
        { paddingTop: insets.top, backgroundColor: isDark ? "#000" : "#fff" },
      ]}
    >
      <View style={{ flex: 1, backgroundColor: isDark ? "#111827" : "#FDF6E3" }}>
        <Stack screenOptions={{ headerShown: false }}>
          <Stack.Screen name="index" />
          <Stack.Screen name="login" />
          <Stack.Screen name="register" />
          <Stack.Screen name="(tabs)" />
        </Stack>
      </View>
      <StatusBar style={isDark ? "light" : "dark"} />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1 },
  center: { justifyContent: "center", alignItems: "center" },
});
