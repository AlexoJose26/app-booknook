import React, { useEffect } from "react";
import { DarkTheme, DefaultTheme, ThemeProvider } from "@react-navigation/native";
import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { Platform, StatusBar as RNStatusBar, SafeAreaView, View, StyleSheet } from "react-native";
import Constants from "expo-constants";

import { ThemeProviderCustom, useThemeCustom } from "@/contexts/ThemeContext";
import { LivrosProvider } from "@/contexts/LivrosContext";
import { UserProvider } from "@/contexts/UserContext";
import { initDB } from "@/database/db";

export const unstable_settings = { anchor: "(tabs)" };

export default function RootLayout() {
  const statusBarHeight = Platform.OS === "android" ? RNStatusBar.currentHeight || 0 : Constants.statusBarHeight;

  useEffect(() => {
    initDB();
  }, []);

  return (
    <ThemeProviderCustom>
      <UserProvider>
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
    <ThemeProvider value={isDark ? DarkTheme : DefaultTheme}>
      <SafeAreaView
        style={[
          styles.safeArea,
          { paddingTop: statusBarHeight, backgroundColor: isDark ? "#000" : "#fff" },
        ]}
      >
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
    </ThemeProvider>
  );
}

const styles = StyleSheet.create({ safeArea: { flex: 1 } });
