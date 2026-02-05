import React, { useEffect, useState } from "react";
import { View, Text, StyleSheet } from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";

import { ThemeProviderCustom, useThemeCustom } from "@/contexts/ThemeContext";
import { LivrosProvider } from "@/contexts/LivrosContext";
import { UsuarioProvider } from "@/contexts/UsuarioContext";
import { runMigrations } from "@/database/migrations";

export const unstable_settings = { anchor: "(tabs)" };

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
    <ThemeProviderCustom>
      <UsuarioProvider>
        <LivrosProvider>
          <ThemeWrapper />
        </LivrosProvider>
      </UsuarioProvider>
    </ThemeProviderCustom>
  );
}

function ThemeWrapper() {
  const { theme } = useThemeCustom();
  const isDark = theme === "dark";
  const insets = useSafeAreaInsets();

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
