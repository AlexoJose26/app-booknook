import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { StyleSheet, View } from "react-native";
import {
  SafeAreaProvider,
  SafeAreaView,
  useSafeAreaInsets,
} from "react-native-safe-area-context";

import { LivrosProvider } from "@/contexts/LivrosContext";
import { ThemeProviderCustom, useThemeCustom } from "@/contexts/ThemeContext";
import { UsuarioProvider } from "@/contexts/UsuarioContext";

export default function RootLayout() {
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

  const backgroundColor = isDark ? "#111827" : "#FDF6E3";
  const safeAreaColor = isDark ? "#0B1220" : "#FDF6E3";

  return (
    <SafeAreaView
      style={[
        styles.safeArea,
        {
          backgroundColor: safeAreaColor,
          paddingTop: insets.top,
        },
      ]}
      edges={["top", "left", "right"]}
    >
      <View
        style={[
          styles.container,
          {
            backgroundColor,
          },
        ]}
      >
        <Stack
          screenOptions={{
            headerShown: false,
            animation: "fade",
            contentStyle: {
              backgroundColor,
            },
          }}
        >
          <Stack.Screen
            name="index"
            options={{
              headerShown: false,
            }}
          />

          <Stack.Screen
            name="login"
            options={{
              headerShown: false,
            }}
          />

          <Stack.Screen
            name="register"
            options={{
              headerShown: false,
            }}
          />

          <Stack.Screen
            name="(tabs)"
            options={{
              headerShown: false,
            }}
          />
        </Stack>
      </View>

      <StatusBar style={isDark ? "light" : "dark"} />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
  },

  container: {
    flex: 1,
    overflow: "hidden",
  },
});
