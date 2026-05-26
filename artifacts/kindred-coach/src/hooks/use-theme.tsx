import { createContext, useContext, useEffect, useState, ReactNode } from "react";

export type ThemeName = "midnight" | "forest";

const STORAGE_KEY = "kindred-theme";
const THEME_CLASSES: Record<ThemeName, string> = {
  midnight: "theme-midnight",
  forest: "theme-forest",
};

type ThemeContextValue = {
  theme: ThemeName;
  setTheme: (theme: ThemeName) => void;
};

const ThemeContext = createContext<ThemeContextValue | null>(null);

function readStoredTheme(): ThemeName {
  if (typeof window === "undefined") return "midnight";
  const stored = window.localStorage.getItem(STORAGE_KEY);
  if (stored === "midnight" || stored === "forest") return stored;
  return "midnight";
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setThemeState] = useState<ThemeName>(() => readStoredTheme());

  useEffect(() => {
    const root = document.documentElement;
    Object.values(THEME_CLASSES).forEach((cls) => root.classList.remove(cls));
    root.classList.add(THEME_CLASSES[theme]);
    window.localStorage.setItem(STORAGE_KEY, theme);
  }, [theme]);

  return (
    <ThemeContext.Provider value={{ theme, setTheme: setThemeState }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error("useTheme must be used within a ThemeProvider");
  return ctx;
}

export const THEME_OPTIONS: { value: ThemeName; label: string; swatches: string[] }[] = [
  { value: "midnight", label: "Midnight", swatches: ["#0a1530", "#ffffff", "#000000"] },
  { value: "forest", label: "Forest", swatches: ["#2eb56a", "#000000", "#a155d6"] },
];
