import React from "react";
import { Tabs } from "expo-router";
import { Platform, StyleSheet, View } from "react-native";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useThemeCustom } from "@/contexts/ThemeContext";

function TabIcon({
  name,
  color,
  size,
  focused,
  activeColor,
}: {
  name: string;
  color: string;
  size: number;
  focused: boolean;
  activeColor: string;
}) {
  return (
    <View style={styles.iconWrapper}>
      <MaterialCommunityIcons
        name={name}
        size={focused ? size + 2 : size}
        color={focused ? activeColor : color}
      />
    </View>
  );
}

export default function TabsLayout() {
  const { colors } = useThemeCustom();

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarStyle: [
          styles.tabBar,
          {
            height: Platform.OS === "ios" ? 70 : 60,
            paddingBottom: Platform.OS === "ios" ? 15 : 8,
            backgroundColor: colors.card,
          },
        ],
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.placeholder,
        tabBarLabelStyle: {
          fontSize: 11,
          fontWeight: "500",
          color: colors.text,
        },
      }}
    >
      <Tabs.Screen
        name="feed"
        options={{
          title: "Feed",
          tabBarIcon: ({ color, size, focused }) => (
            <TabIcon
              name={focused ? "home-variant" : "home-variant-outline"}
              color={color}
              size={size}
              focused={focused}
              activeColor={colors.primary}
            />
          ),
        }}
      />

      <Tabs.Screen
        name="procurar"
        options={{
          title: "Procurar",
          tabBarIcon: ({ color, size, focused }) => (
            <TabIcon
              name="magnify"
              color={color}
              size={size}
              focused={focused}
              activeColor={colors.primary}
            />
          ),
        }}
      />

      <Tabs.Screen
        name="estantes"
        options={{
          title: "Estantes",
          tabBarIcon: ({ color, size, focused }) => (
            <TabIcon
              name="bookshelf"
              color={color}
              size={size}
              focused={focused}
              activeColor={colors.primary}
            />
          ),
        }}
      />

      <Tabs.Screen
        name="criticas"
        options={{
          title: "Críticas",
          tabBarIcon: ({ color, size, focused }) => (
            <TabIcon
              name={focused ? "comment-quote" : "comment-quote-outline"}
              color={color}
              size={size}
              focused={focused}
              activeColor={colors.primary}
            />
          ),
        }}
      />

      <Tabs.Screen
        name="perfil"
        options={{
          title: "Perfil",
          tabBarIcon: ({ color, size, focused }) => (
            <TabIcon
              name={focused ? "account-circle" : "account-circle-outline"}
              color={color}
              size={size}
              focused={focused}
              activeColor={colors.primary}
            />
          ),
        }}
      />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  tabBar: {
    borderTopWidth: 0,
    elevation: 0,
    shadowOpacity: 0,
  },
  iconWrapper: {
    width: 40,
    height: 40,
    justifyContent: "center",
    alignItems: "center",
  },
});
