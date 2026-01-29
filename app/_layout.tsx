import React, { useEffect, useState } from "react";
import { SafeAreaView, View, Text, Platform, StatusBar as RNStatusBar, StyleSheet } from "react-native";
import Constants from "expo-constants";
import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";

import { ThemeProviderCustom, useThemeCustom } from "@/contexts/ThemeContext";
import { LivrosProvider } from "@/contexts/LivrosContext";
import { UserProvider } from "@/contexts/UserContext";
import { initDB } from "@/database/db";

// Flag global para inicializar o banco apenas uma vez
let bancoInicializado = false;
function initDBOnce() {
  if (!bancoInicializado) {
    initDB();
    bancoInicializado = true;
    console.log("Banco inicializado com sucesso!");
  }
}

export const unstable_settings = { anchor: "(tabs)" };

export default function RootLayout() {
  const statusBarHeight = Platform.OS === "android" ? RNStatusBar.currentHeight || 0 : Constants.statusBarHeight;
  const [dbReady, setDbReady] = useState(false);

  useEffect(() => {
    try {
      initDBOnce();
      setDbReady(true);
    } catch (error) {
      console.error("Erro ao inicializar o banco:", error);
    }
  }, []);

  if (!dbReady) {
    return (
      <SafeAreaView style={[styles.safeArea, { justifyContent: "center", alignItems: "center" }]}>
        <Text style={{ fontSize: 16 }}>Carregando banco de dados...</Text>
      </SafeAreaView>
    );
  }

  return (
    <ThemeProviderCustom>
      <UserProvider>
        {/* LivrosProvider envolve as tabs, garantindo que useLivros funcione */}
        <LivrosProvider>
          <ThemeProviderWrapper statusBarHeight={statusBarHeight} />
        </LivrosProvider>
      </UserProvider>
    </ThemeProviderCustom>
  );
}

function ThemeProviderWrapper({ statusBarHeight }: { statusBarHeight: number }) {
  const { theme } = useThemeCustom();
  const isDark = theme === "dark";

  const globalContainerStyle = { flex: 1, backgroundColor: isDark ? "#111827" : "#FDF6E3" };

  return (
    <SafeAreaView style={[styles.safeArea, { paddingTop: statusBarHeight, backgroundColor: isDark ? "#000" : "#fff" }]}>
      <View style={globalContainerStyle}>
        <Stack>
          <Stack.Screen name="index" options={{ headerShown: false }} />
          <Stack.Screen name="login" options={{ headerShown: false }} />
          <Stack.Screen name="register" options={{ headerShown: false }} />
          <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        </Stack>
      </View>
      <StatusBar style={isDark ? "light" : "dark"} />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1 },
});
