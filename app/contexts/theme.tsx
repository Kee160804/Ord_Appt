"use client";

import React, { createContext, useContext, useEffect, useState } from "react";

type Theme = "dark" | "light";

interface ThemeContextType {
  theme: Theme;
  demoTheme: Theme;
  toggleTheme: () => void;
  toggleDemoTheme: () => void;
  setTheme: (theme: Theme) => void;
  setDemoTheme: (theme: Theme) => void;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

const THEME_KEY = "theme";
const DEMO_THEME_KEY = "theme-demo";

function getBrowserTheme(): Theme {
  const savedTheme = localStorage.getItem(THEME_KEY) as Theme | null;
  if (savedTheme === "light" || savedTheme === "dark") return savedTheme;
  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setThemeState] = useState<Theme>("dark");
  const [demoTheme, setDemoThemeState] = useState<Theme>("dark");

  useEffect(() => {
    const initialTheme = getBrowserTheme();
    setThemeState(initialTheme);

    const savedDemoTheme = localStorage.getItem(DEMO_THEME_KEY) as Theme | null;
    setDemoThemeState(
      savedDemoTheme === "light" || savedDemoTheme === "dark" ? savedDemoTheme : "dark"
    );
  }, []);

  useEffect(() => {
    const root = document.documentElement;
    const body = document.body;

    if (theme === "light") {
      root.classList.add("light");
      root.classList.remove("dark");
      body.classList.add("light");
      body.classList.remove("dark");
      root.style.colorScheme = "light";
      root.style.backgroundColor = "white";
      root.style.color = "#111827";
    } else {
      root.classList.add("dark");
      root.classList.remove("light");
      body.classList.add("dark");
      body.classList.remove("light");
      root.style.colorScheme = "dark";
      root.style.backgroundColor = "#070b14";
      root.style.color = "white";
    }

    localStorage.setItem(THEME_KEY, theme);
  }, [theme]);

  useEffect(() => {
    localStorage.setItem(DEMO_THEME_KEY, demoTheme);
  }, [demoTheme]);

  const toggleTheme = () => setThemeState((prev) => (prev === "dark" ? "light" : "dark"));
  const toggleDemoTheme = () => setDemoThemeState((prev) => (prev === "dark" ? "light" : "dark"));
  const setTheme = (newTheme: Theme) => setThemeState(newTheme);
  const setDemoTheme = (newTheme: Theme) => setDemoThemeState(newTheme);

  return (
    <ThemeContext.Provider
      value={{
        theme,
        demoTheme,
        toggleTheme,
        toggleDemoTheme,
        setTheme,
        setDemoTheme,
      }}
    >
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (!context) throw new Error("useTheme must be used within ThemeProvider");
  return context;
}
