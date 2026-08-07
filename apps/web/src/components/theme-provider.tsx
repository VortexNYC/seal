import {
  createContext,
  type ReactNode,
  useContext,
  useEffect,
  useLayoutEffect,
  useMemo,
  useState,
} from "react";

type Theme = "light" | "dark" | "system";
type ResolvedTheme = Exclude<Theme, "system">;

type ThemeContextValue = {
  theme: Theme;
  resolvedTheme: ResolvedTheme;
  setTheme: (theme: Theme) => void;
};

const STORAGE_KEY = "catapult.theme";

const ThemeContext = createContext<ThemeContextValue | null>(null);

const isTheme = (value: unknown): value is Theme => {
  return value === "light" || value === "dark" || value === "system";
};

const readStoredTheme = (): Theme => {
  if (typeof window === "undefined") {
    return "system";
  }

  const stored = window.localStorage.getItem(STORAGE_KEY);
  if (isTheme(stored)) {
    return stored;
  }
  return "system";
};

const readSystemPreference = (): ResolvedTheme => {
  if (typeof window === "undefined") {
    return "light";
  }

  return window.matchMedia("(prefers-color-scheme: dark)").matches
    ? "dark"
    : "light";
};

const applyThemeClass = (theme: ResolvedTheme) => {
  if (typeof document === "undefined") {
    return;
  }

  const root = document.documentElement;
  root.classList.toggle("dark", theme === "dark");
  root.dataset.theme = theme;
  root.style.colorScheme = theme;
};

const useIsomorphicLayoutEffect =
  typeof window !== "undefined" ? useLayoutEffect : useEffect;

export const ThemeProvider = ({ children }: { children: ReactNode }) => {
  const storedTheme = readStoredTheme();
  const initialResolvedTheme =
    storedTheme === "system" ? readSystemPreference() : storedTheme;

  const [theme, setThemeState] = useState<Theme>(storedTheme);
  const [resolvedTheme, setResolvedTheme] =
    useState<ResolvedTheme>(initialResolvedTheme);

  useIsomorphicLayoutEffect(() => {
    if (typeof window === "undefined") {
      return undefined;
    }

    const nextResolved = theme === "system" ? readSystemPreference() : theme;
    setResolvedTheme(nextResolved);
    applyThemeClass(nextResolved);

    if (theme !== "system") {
      window.localStorage.setItem(STORAGE_KEY, theme);
    } else {
      window.localStorage.removeItem(STORAGE_KEY);
    }

    if (theme !== "system") {
      return undefined;
    }

    const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)");
    const handleChange = (event: MediaQueryListEvent) => {
      const updatedResolved = event.matches ? "dark" : "light";
      setResolvedTheme(updatedResolved);
      applyThemeClass(updatedResolved);
    };

    mediaQuery.addEventListener("change", handleChange);
    return () => mediaQuery.removeEventListener("change", handleChange);
  }, [theme]);

  const value = useMemo<ThemeContextValue>(
    () => ({
      theme,
      resolvedTheme,
      setTheme: (nextTheme) => {
        if (nextTheme === theme) {
          return;
        }
        setThemeState(nextTheme);
      },
    }),
    [resolvedTheme, theme]
  );

  return (
    <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>
  );
};

export const useTheme = () => {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error("useTheme must be used within a ThemeProvider");
  }

  return context;
};
