"use client";

import React, { createContext, useContext, useEffect, useState } from "react";

type Theme = "dark" | "light";

interface ThemeContextType {
  theme: Theme;
  toggleTheme: () => void;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  // COMMENT: Use lazy initializer to load theme from localStorage on mount, default to dark
  const [theme, setTheme] = useState<Theme>(() => {
    if (typeof window !== "undefined") {
      const savedTheme = localStorage.getItem("theme") as Theme | null;
      return savedTheme || "dark";
    }
    return "dark";
  });

  // COMMENT: This effect ensures the theme is applied on mount and whenever it changes
  // It adds/removes the 'light' class on the HTML element to trigger Tailwind's light variant styles
  useEffect(() => {
    const root = document.documentElement;
    const body = document.body;

    // NEW: AGGRESSIVE DOM UPDATE - Force immediate visual change
    console.log("🎨 useEffect triggered - applying theme:", theme);

    // NEW: Clear both elements first to ensure clean state
    root.classList.remove("light");
    body.classList.remove("light");

    // NEW: Force synchronous DOM update immediately
    // This ensures the class is added/removed instantly
    if (theme === "light") {
      // COMMENT: Add 'light' class to HTML element to enable light mode styles
      console.log("🎨 Setting LIGHT mode...");
      root.classList.add("light");
      root.setAttribute("data-theme", "light");
      // COMMENT: Set colorScheme for browser UI elements
      document.documentElement.style.colorScheme = "light";
      document.documentElement.style.backgroundColor = "white";
      document.documentElement.style.color = "#111827";

      // NEW: Also set body for redundancy
      body.classList.add("light");
      body.setAttribute("data-theme", "light");
      body.style.backgroundColor = "white";
      body.style.color = "#111827";

      // NEW: Force a repaint by triggering reflow
      void body.offsetHeight;

      // NEW: Verify the change was applied
      console.log(
        "🎨 Light mode applied - HTML.light exists:",
        root.classList.contains("light"),
      );
    } else {
      // COMMENT: Remove 'light' class to revert to dark mode
      console.log("🎨 Setting DARK mode...");
      root.classList.remove("light");
      root.setAttribute("data-theme", "dark");
      // COMMENT: Set colorScheme for dark mode
      document.documentElement.style.colorScheme = "dark";
      document.documentElement.style.backgroundColor = "#070b14";
      document.documentElement.style.color = "white";

      // NEW: Also remove from body for redundancy
      body.classList.remove("light");
      body.setAttribute("data-theme", "dark");
      body.style.backgroundColor = "#070b14";
      body.style.color = "white";

      // NEW: Force a repaint by triggering reflow
      void body.offsetHeight;

      // NEW: Verify the change was applied
      console.log(
        "🎨 Dark mode applied - HTML.light removed:",
        !root.classList.contains("light"),
      );
    }

    // COMMENT: Persist theme preference to localStorage so it survives page refreshes
    localStorage.setItem("theme", theme);
  }, [theme]);

  // COMMENT: Toggle between dark and light themes - this is called when button is clicked
  const toggleTheme = () => {
    setTheme((prev) => {
      const newTheme = prev === "dark" ? "light" : "dark";

      // NEW: AGGRESSIVE DEBUG - Log theme toggle attempt
      console.log(
        "🎨 THEME TOGGLE INITIATED - Current:",
        prev,
        "→ New:",
        newTheme,
      );

      // NEW: FORCE IMMEDIATE DOM UPDATE (don't wait for React)
      const root = document.documentElement;
      const body = document.body;

      // NEW: Clear any conflicting classes first
      root.classList.remove("light");
      body.classList.remove("light");

      // NEW: Apply new theme immediately
      if (newTheme === "light") {
        console.log("🎨 APPLYING LIGHT MODE TO DOM...");
        root.classList.add("light");
        body.classList.add("light");
        root.setAttribute("data-theme", "light");
        body.setAttribute("data-theme", "light");
        document.documentElement.style.colorScheme = "light";
        document.body.style.backgroundColor = "white";
        document.body.style.color = "#111827";
      } else {
        console.log("🎨 APPLYING DARK MODE TO DOM...");
        root.classList.remove("light");
        body.classList.remove("light");
        root.setAttribute("data-theme", "dark");
        body.setAttribute("data-theme", "dark");
        document.documentElement.style.colorScheme = "dark";
        document.body.style.backgroundColor = "#070b14";
        document.body.style.color = "white";
      }

      // NEW: Verify the class was applied
      console.log(
        "🎨 HTML has 'light' class:",
        root.classList.contains("light"),
      );
      console.log(
        "🎨 BODY has 'light' class:",
        body.classList.contains("light"),
      );

      // NEW: Save to localStorage
      localStorage.setItem("theme", newTheme);
      console.log("🎨 Theme saved to localStorage:", newTheme);

      return newTheme;
    });
  };

  return (
    <ThemeContext.Provider value={{ theme, toggleTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}

// COMMENT: Hook to use theme context in any client component
export function useTheme() {
  const context = useContext(ThemeContext);
  if (!context) throw new Error("useTheme must be used within ThemeProvider");
  return context;
}
