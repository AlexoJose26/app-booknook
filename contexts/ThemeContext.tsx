import React, { createContext, useContext, useEffect, useState, ReactNode } from "react";
import { Appearance, ColorSchemeName } from "react-native";

type ThemeType = "light" | "dark";

interface ThemeColors {
  background: string;
  overlay: string;
  primary: string;
  secondary: string;
  text: string;
  placeholder: string;
  card: string;
  button: string;
  buttonText: string;
}

interface ThemeContextType {
  theme: ThemeType;
  colors: ThemeColors;
  toggleTheme: () => void;
}


const lightColors: ThemeColors = {
  background: "#F9FAFB",
  overlay: "rgba(255,255,255,0.8)",
  primary: "#1E3A8A",
  secondary: "#374151",
  text: "#0F172A",
  placeholder: "#6B7280",
  card: "#FFFFFF",
  button: "#2563EB",
  buttonText: "#FFFFFF",
};

const darkColors: ThemeColors = {
  background: "#020617",
  overlay: "rgba(2,6,23,0.9)",
  primary: "#FBBF24",
  secondary: "#CBD5E1",
  text: "#F8FAFC",
  placeholder: "#94A3B8",
  card: "#0F172A",
  button: "#F59E0B",
  buttonText: "#020617",
};

const ThemeContext = createContext<ThemeContextType>({
  theme: "light",
  colors: lightColors,
  toggleTheme: () => {},
});

export const ThemeProviderCustom = ({ children }: { children: ReactNode }) => {
  const getSystemTheme = (): ThemeType => {
    const scheme: ColorSchemeName = Appearance.getColorScheme();
    return scheme === "dark" ? "dark" : "light";
  };

  const [theme, setTheme] = useState<ThemeType>(getSystemTheme());

  useEffect(() => {
    const listener = Appearance.addChangeListener(({ colorScheme }) => {
      setTheme(colorScheme === "dark" ? "dark" : "light");
    });
    return () => listener.remove();
  }, []);

  const toggleTheme = () => setTheme(theme === "dark" ? "light" : "dark");

  const colors = theme === "dark" ? darkColors : lightColors;

  return (
    <ThemeContext.Provider value={{ theme, colors, toggleTheme }}>
      {children}
    </ThemeContext.Provider>
  );
};

export const useThemeCustom = () => {
  const context = useContext(ThemeContext);
  if (!context) throw new Error("useThemeCustom deve ser usado dentro de um ThemeProviderCustom");
  return context;
};
