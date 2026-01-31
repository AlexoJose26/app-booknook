import React, { useEffect, useState } from "react";
import {
  SafeAreaView,
  View,
  Text,
  Platform,
  StatusBar as RNStatusBar,
  StyleSheet,
} from "react-native";
import Constants from "expo-constants";
import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";

import { ThemeProviderCustom, useThemeCustom } from "@/contexts/ThemeContext";
import { LivrosProvider } from "@/contexts/LivrosContext";
import { UserProvider } from "@/contexts/UserContext";
import { runMigrations } from "@/database/migrations";

export const unstable_settings = { anchor: "(tabs)" };

export default function RootLayout() {
  const statusBarHeight =
    Platform.OS === "android"
      ? RNStatusBar.currentHeight || 0
      : Constants.statusBarHeight;

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
      <UserProvider>
        <LivrosProvider>
          <ThemeWrapper statusBarHeight={statusBarHeight} />
        </LivrosProvider>
      </UserProvider>
    </ThemeProviderCustom>
  );
}

function ThemeWrapper({ statusBarHeight }: { statusBarHeight: number }) {
  const { theme } = useThemeCustom();
  const isDark = theme === "dark";

  return (
    <SafeAreaView
      style={[
        styles.safeArea,
        { paddingTop: statusBarHeight, backgroundColor: isDark ? "#000" : "#fff" },
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
