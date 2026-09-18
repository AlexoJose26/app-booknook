import { LinearGradient } from "expo-linear-gradient";
import { useRouter } from "expo-router";
import { useEffect, useRef } from "react";
import {
  ActivityIndicator,
  Animated,
  Dimensions,
  ImageBackground,
  StatusBar,
  StyleSheet,
  Text,
  View,
} from "react-native";

const { width, height } = Dimensions.get("window");

export default function Splash() {
  const router = useRouter();

  const fadeAnim = useRef(new Animated.Value(0)).current;
  const logoTranslate = useRef(new Animated.Value(35)).current;
  const logoScale = useRef(new Animated.Value(0.88)).current;
  const subtitleAnim = useRef(new Animated.Value(0)).current;
  const loaderAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 900,
        useNativeDriver: true,
      }),

      Animated.spring(logoTranslate, {
        toValue: 0,
        friction: 7,
        tension: 45,
        useNativeDriver: true,
      }),

      Animated.spring(logoScale, {
        toValue: 1,
        friction: 6,
        tension: 45,
        useNativeDriver: true,
      }),

      Animated.timing(subtitleAnim, {
        toValue: 1,
        duration: 1000,
        delay: 350,
        useNativeDriver: true,
      }),

      Animated.timing(loaderAnim, {
        toValue: 1,
        duration: 800,
        delay: 600,
        useNativeDriver: false,
      }),
    ]).start();

    const timer = setTimeout(() => {
      router.replace("/login");
    }, 2800);

    return () => {
      clearTimeout(timer);
    };
  }, [
    fadeAnim,
    logoTranslate,
    logoScale,
    subtitleAnim,
    loaderAnim,
    router,
  ]);

  return (
    <View style={styles.screen}>
      <StatusBar
        barStyle="light-content"
        translucent
        backgroundColor="transparent"
      />

      <ImageBackground
        source={require("../assets/images/library-bg.jpg")}
        style={styles.background}
        resizeMode="cover"
        blurRadius={2}
      >
        <LinearGradient
          colors={[
            "rgba(3, 31, 20, 0.38)",
            "rgba(7, 21, 14, 0.76)",
            "rgba(3, 31, 20, 0.96)",
          ]}
          locations={[0, 0.48, 1]}
          style={styles.overlay}
        >
          {/* Decoração superior */}
          <View style={styles.topDecoration}>
            <View style={styles.decorationLine} />
            <View style={styles.decorationDot} />
            <View style={styles.decorationLine} />
          </View>

          {/* Conteúdo principal */}
          <Animated.View
            style={[
              styles.content,
              {
                opacity: fadeAnim,
                transform: [
                  {
                    translateY: logoTranslate,
                  },
                  {
                    scale: logoScale,
                  },
                ],
              },
            ]}
          >
            {/* LOGO */}
            <View style={styles.logoContainer}>
              <View style={styles.logoOuter}>
                <View style={styles.logoInner}>
                  {/* Ícone moderno de livro */}
                  <View style={styles.bookIcon}>
                    {/* Página esquerda */}
                    <View style={styles.bookPageLeft}>
                      <View style={styles.pageLine} />
                      <View style={styles.pageLineShort} />
                      <View style={styles.pageLineShort} />
                    </View>

                    {/* Página direita */}
                    <View style={styles.bookPageRight}>
                      <View style={styles.pageLine} />
                      <View style={styles.pageLineShort} />
                      <View style={styles.pageLineShort} />
                    </View>

                    {/* Lombada */}
                    <View style={styles.bookSpine} />
                  </View>
                </View>
              </View>
            </View>

            {/* Nome */}
            <Text style={styles.brand}>
              Book
              <Text style={styles.brandAccent}>Nook</Text>
            </Text>

            {/* Linha decorativa */}
            <View style={styles.brandUnderline}>
              <View style={styles.underlineSide} />
              <View style={styles.underlineCenter} />
              <View style={styles.underlineSide} />
            </View>

            {/* Texto */}
            <Animated.View
              style={[
                styles.subtitleContainer,
                {
                  opacity: subtitleAnim,
                  transform: [
                    {
                      translateY: subtitleAnim.interpolate({
                        inputRange: [0, 1],
                        outputRange: [12, 0],
                      }),
                    },
                  ],
                },
              ]}
            >
              <Text style={styles.subtitle}>
                A rede social para leitores
              </Text>

              <Text style={styles.description}>
                Descubra. Leia. Compartilhe.
              </Text>
            </Animated.View>
          </Animated.View>

          {/* Loading */}
          <Animated.View
            style={[
              styles.loadingContainer,
              {
                opacity: loaderAnim,
              },
            ]}
          >
            <View style={styles.loadingRow}>
              <ActivityIndicator
                size="small"
                color="#D9A441"
              />

              <Text style={styles.loadingText}>
                Preparando sua biblioteca...
              </Text>
            </View>

            <View style={styles.progressTrack}>
              <Animated.View
                style={[
                  styles.progressBar,
                  {
                    width: loaderAnim.interpolate({
                      inputRange: [0, 1],
                      outputRange: ["0%", "100%"],
                    }),
                  },
                ]}
              />
            </View>
          </Animated.View>

          {/* Rodapé */}
          <View style={styles.bottomContent}>
            <Text style={styles.bottomText}>
              SUA BIBLIOTECA • SUA JORNADA
            </Text>
          </View>
        </LinearGradient>
      </ImageBackground>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: "#031F14",
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

  topDecoration: {
    position: "absolute",
    top: height * 0.13,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    width: width * 0.42,
  },

  decorationLine: {
    flex: 1,
    height: 1,
    backgroundColor: "rgba(217, 164, 65, 0.42)",
  },

  decorationDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
    marginHorizontal: 9,
    backgroundColor: "#D9A441",
  },

  content: {
    alignItems: "center",
    justifyContent: "center",
    width: "100%",
  },

  logoContainer: {
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 20,
  },

  logoOuter: {
    width: 94,
    height: 94,
    borderRadius: 31,
    borderWidth: 1,
    borderColor: "rgba(217, 164, 65, 0.65)",
    alignItems: "center",
    justifyContent: "center",
    transform: [
      {
        rotate: "-3deg",
      },
    ],
  },

  logoInner: {
    width: 72,
    height: 72,
    borderRadius: 25,
    backgroundColor: "rgba(23, 107, 69, 0.94)",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.12)",
    alignItems: "center",
    justifyContent: "center",
    transform: [
      {
        rotate: "3deg",
      },
    ],
  },

  /*
   * ÍCONE DE LIVRO
   *
   * Criado com Views para:
   * - não depender de emoji
   * - manter o mesmo desenho em Android/iOS
   * - ter aparência mais profissional
   */

  bookIcon: {
    width: 48,
    height: 39,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    position: "relative",
  },

  bookPageLeft: {
    width: 22,
    height: 32,
    backgroundColor: "#FFFFFF",
    borderTopLeftRadius: 5,
    borderBottomLeftRadius: 5,
    borderTopRightRadius: 2,
    borderBottomRightRadius: 2,
    paddingTop: 8,
    paddingHorizontal: 5,
    transform: [
      {
        rotate: "-5deg",
      },
    ],
  },

  bookPageRight: {
    width: 22,
    height: 32,
    backgroundColor: "#F1F7F3",
    borderTopRightRadius: 5,
    borderBottomRightRadius: 5,
    borderTopLeftRadius: 2,
    borderBottomLeftRadius: 2,
    paddingTop: 8,
    paddingHorizontal: 5,
    transform: [
      {
        rotate: "5deg",
      },
    ],
  },

  bookSpine: {
    position: "absolute",
    width: 2,
    height: 30,
    backgroundColor: "#D9A441",
    left: "50%",
    marginLeft: -1,
    top: 4,
    borderRadius: 2,
  },

  pageLine: {
    width: "100%",
    height: 2,
    borderRadius: 2,
    backgroundColor: "rgba(23, 107, 69, 0.28)",
    marginBottom: 4,
  },

  pageLineShort: {
    width: "72%",
    height: 2,
    borderRadius: 2,
    backgroundColor: "rgba(23, 107, 69, 0.18)",
    marginBottom: 4,
  },

  brand: {
    color: "#FFFFFF",
    fontSize: width * 0.115,
    lineHeight: width * 0.125,
    fontWeight: "900",
    letterSpacing: -1.4,
  },

  brandAccent: {
    color: "#D9A441",
  },

  brandUnderline: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    marginTop: 12,
    marginBottom: 18,
  },

  underlineSide: {
    width: 28,
    height: 1,
    backgroundColor: "rgba(217, 164, 65, 0.55)",
  },

  underlineCenter: {
    width: 6,
    height: 6,
    borderRadius: 3,
    marginHorizontal: 7,
    backgroundColor: "#D9A441",
  },

  subtitleContainer: {
    alignItems: "center",
  },

  subtitle: {
    color: "#F1F7F3",
    fontSize: width * 0.043,
    fontWeight: "700",
    textAlign: "center",
    letterSpacing: 0.15,
  },

  description: {
    color: "#A6B8AE",
    fontSize: width * 0.031,
    fontWeight: "500",
    textAlign: "center",
    marginTop: 8,
    letterSpacing: 1.2,
  },

  loadingContainer: {
    position: "absolute",
    bottom: height * 0.13,
    width: width * 0.68,
    alignItems: "center",
  },

  loadingRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 11,
  },

  loadingText: {
    color: "#A6B8AE",
    fontSize: 10,
    fontWeight: "700",
    marginLeft: 8,
    letterSpacing: 0.2,
  },

  progressTrack: {
    width: "100%",
    height: 3,
    borderRadius: 2,
    backgroundColor: "rgba(255, 255, 255, 0.12)",
    overflow: "hidden",
  },

  progressBar: {
    height: "100%",
    borderRadius: 2,
    backgroundColor: "#D9A441",
  },

  bottomContent: {
    position: "absolute",
    bottom: 28,
    alignItems: "center",
    justifyContent: "center",
  },

  bottomText: {
    color: "rgba(241, 247, 243, 0.42)",
    fontSize: 7.5,
    fontWeight: "800",
    letterSpacing: 1.5,
  },
});
