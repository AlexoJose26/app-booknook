import { LinearGradient } from "expo-linear-gradient";
import { useRouter } from "expo-router";
import React, { useEffect, useRef } from "react";
import {
  Animated,
  Dimensions,
  ImageBackground,
  StyleSheet,
  Text,
  View,
  StatusBar,
} from "react-native";

const { width } = Dimensions.get("window");

export default function Splash() {
  const router = useRouter();

  const fadeAnim = useRef(new Animated.Value(0)).current;
  const logoAnim = useRef(new Animated.Value(40)).current;
  const scaleAnim = useRef(new Animated.Value(0.85)).current;

  useEffect(() => {
    // Animação de entrada
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 1200,
        useNativeDriver: true,
      }),
      Animated.timing(logoAnim, {
        toValue: 0,
        duration: 1200,
        useNativeDriver: true,
      }),
      Animated.spring(scaleAnim, {
        toValue: 1,
        friction: 5,
        useNativeDriver: true,
      }),
    ]).start();

    // Redirecionamento automático
    const timer = setTimeout(() => {
      router.replace("/login");
    }, 2500); // tempo total da splash

    return () => clearTimeout(timer);
  }, []);

  return (
    <View style={styles.screen}>
      <StatusBar barStyle="light-content" translucent backgroundColor="transparent" />

      <ImageBackground
        source={require("../assets/images/library-bg.jpg")}
        style={styles.background}
        blurRadius={4}
      >
        <LinearGradient
          colors={["rgba(0,0,0,0.45)", "rgba(0,0,0,0.8)"]}
          style={styles.overlay}
        >
          <Animated.View
            style={[
              styles.container,
              {
                opacity: fadeAnim,
                transform: [{ translateY: logoAnim }, { scale: scaleAnim }],
              },
            ]}
          >
            <Text style={styles.title}>BookNook</Text>
            <Text style={styles.subtitle}>
              A rede social para leitores
            </Text>
          </Animated.View>
        </LinearGradient>
      </ImageBackground>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: "#000",
  },
  background: {
    flex: 1,
    width: "100%",
    height: "100%",
  },
  overlay: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 24,
  },
  container: {
    alignItems: "center",
  },
  title: {
    fontSize: width * 0.1,
    fontWeight: "800",
    color: "#fff",
    letterSpacing: 1,
    marginBottom: 8,
  },
  subtitle: {
    fontSize: width * 0.045,
    color: "#E5E7EB",
    textAlign: "center",
    opacity: 0.9,
  },
});
