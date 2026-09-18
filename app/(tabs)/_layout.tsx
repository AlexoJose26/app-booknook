import { MaterialCommunityIcons } from "@expo/vector-icons";
import { Tabs } from "expo-router";
import { Platform, StyleSheet, View } from "react-native";

const BLUE = "#1877F2";
const BLUE_INACTIVE = "#8AAFD9";

function TabIcon({
  name,
  size,
  focused,
}: {
  name: string;
  size: number;
  focused: boolean;
}) {
  return (
    <View style={styles.iconWrapper}>
      <MaterialCommunityIcons
        name={name as any}
        size={focused ? size + 2 : size}
        color={focused ? BLUE : BLUE_INACTIVE}
      />
    </View>
  );
}

export default function TabsLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,

        tabBarStyle: [
          styles.tabBar,
          {
            height: Platform.OS === "ios" ? 82 : 68,
            paddingTop: 7,
            paddingBottom: Platform.OS === "ios" ? 17 : 8,
          },
        ],

        tabBarActiveTintColor: BLUE,
        tabBarInactiveTintColor: BLUE_INACTIVE,

        tabBarLabelStyle: {
          fontSize: 11,
          fontWeight: "600",
          marginTop: 1,
          letterSpacing: 0.1,
        },

        tabBarItemStyle: {
          paddingVertical: 2,
          backgroundColor: "transparent",
        },

        tabBarHideOnKeyboard: true,

        tabBarBackground: () => (
          <View
            pointerEvents="none"
            style={styles.tabBarBackground}
          />
        ),
      }}
    >
      <Tabs.Screen
        name="feed"
        options={{
          title: "Feed",
          tabBarIcon: ({ size, focused }) => (
            <TabIcon
              name={
                focused
                  ? "home-variant"
                  : "home-variant-outline"
              }
              size={size}
              focused={focused}
            />
          ),
        }}
      />

      <Tabs.Screen
        name="procurar"
        options={{
          title: "Procurar",
          tabBarIcon: ({ size, focused }) => (
            <TabIcon
              name="magnify"
              size={size}
              focused={focused}
            />
          ),
        }}
      />

      <Tabs.Screen
        name="estantes"
        options={{
          title: "Estantes",
          tabBarIcon: ({ size, focused }) => (
            <TabIcon
              name="bookshelf"
              size={size}
              focused={focused}
            />
          ),
        }}
      />

      <Tabs.Screen
        name="criticas"
        options={{
          title: "Críticas",
          tabBarIcon: ({ size, focused }) => (
            <TabIcon
              name={
                focused
                  ? "comment-quote"
                  : "comment-quote-outline"
              }
              size={size}
              focused={focused}
            />
          ),
        }}
      />

      <Tabs.Screen
        name="perfil"
        options={{
          title: "Perfil",
          tabBarIcon: ({ size, focused }) => (
            <TabIcon
              name={
                focused
                  ? "account-circle"
                  : "account-circle-outline"
              }
              size={size}
              focused={focused}
            />
          ),
        }}
      />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  tabBar: {
    position: "absolute",

    left: 12,
    right: 12,

    bottom: Platform.OS === "ios" ? 10 : 9,

    paddingHorizontal: 5,

    backgroundColor: "transparent",

    borderWidth: 0,
    borderColor: "transparent",

    elevation: 0,

    shadowColor: "transparent",
    shadowOpacity: 0,
    shadowRadius: 0,

    shadowOffset: {
      width: 0,
      height: 0,
    },
  },

  tabBarBackground: {
    ...StyleSheet.absoluteFill,

    backgroundColor: "transparent",

    borderWidth: 0,
    borderColor: "transparent",
  },

  iconWrapper: {
    width: 42,
    height: 34,

    borderRadius: 14,

    justifyContent: "center",
    alignItems: "center",

    marginBottom: 1,

    backgroundColor: "transparent",
  },
});
