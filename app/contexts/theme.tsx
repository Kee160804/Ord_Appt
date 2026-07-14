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

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  // Main theme for business owner signup area
  const [theme, setThemeState] = useState<Theme>(() => {
    if (typeof window !== "undefined") {
      const savedTheme = localStorage.getItem("theme-main") as Theme | null;
      return savedTheme || "dark";
    }
    return "dark";
  });

  // Separate theme for live demos section
  const [demoTheme, setDemoThemeState] = useState<Theme>(() => {
    if (typeof window !== "undefined") {
      const savedDemoTheme = localStorage.getItem("theme-demo") as Theme | null;
      return savedDemoTheme || "dark";
    }
    return "dark";
  });

  // Apply main theme to page
  useEffect(() => {
    const root = document.documentElement;
    const body = document.body;

    if (theme === "light") {
      root.classList.add("light");
      root.setAttribute("data-theme", "light");
      document.documentElement.style.colorScheme = "light";
      document.documentElement.style.backgroundColor = "white";
      document.documentElement.style.color = "#111827";
      body.classList.add("light");
    } else {
      root.classList.remove("light");
      root.setAttribute("data-theme", "dark");
      document.documentElement.style.colorScheme = "dark";
      document.documentElement.style.backgroundColor = "#070b14";
      document.documentElement.style.color = "white";
      body.classList.remove("light");
    }

    localStorage.setItem("theme-main", theme);
  }, [theme]);

  // Store demo theme for section-level styling
  useEffect(() => {
    localStorage.setItem("theme-demo", demoTheme);
  }, [demoTheme]);

  const toggleTheme = () => {
    setThemeState((prev) => (prev === "dark" ? "light" : "dark"));
  };

  const toggleDemoTheme = () => {
    setDemoThemeState((prev) => (prev === "dark" ? "light" : "dark"));
  };

  const setTheme = (newTheme: Theme) => {
    setThemeState(newTheme);
  };

  const setDemoTheme = (newTheme: Theme) => {
    setDemoThemeState(newTheme);
  };

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
