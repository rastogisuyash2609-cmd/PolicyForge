"use client";
import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import { MotionConfig } from "framer-motion";
import { usePathname } from "next/navigation";

type Theme = "light" | "dark";
const ThemeContext = createContext<{
  theme: Theme;
  toggleTheme: () => void;
} | null>(null);
export function ThemeProvider({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const [theme, setTheme] = useState<Theme>("light");
  useEffect(() => {
    // A cached App Router transition may restore the initial HTML classes.
    // Reconcile from the saved preference instead of treating those as truth.
    let next: Theme = document.documentElement.classList.contains("dark")
      ? "dark"
      : "light";
    try {
      const saved = localStorage.getItem("pf-theme");
      next =
        saved === "dark" ||
        (saved !== "light" &&
          window.matchMedia("(prefers-color-scheme: dark)").matches)
          ? "dark"
          : "light";
    } catch {
      /* Keep the current theme when storage is unavailable. */
    }
    document.documentElement.classList.toggle("dark", next === "dark");
    setTheme(next);
    function syncTheme(event: StorageEvent) {
      if (event.key !== "pf-theme") return;
      const next =
        event.newValue === "dark" ||
        (!event.newValue &&
          window.matchMedia("(prefers-color-scheme: dark)").matches)
          ? "dark"
          : "light";
      document.documentElement.classList.toggle("dark", next === "dark");
      setTheme(next);
    }
    window.addEventListener("storage", syncTheme);
    return () => window.removeEventListener("storage", syncTheme);
  }, [pathname]);
  function toggleTheme() {
    const next = document.documentElement.classList.contains("dark")
      ? "light"
      : "dark";
    document.documentElement.classList.toggle("dark", next === "dark");
    setTheme(next);
    try {
      localStorage.setItem("pf-theme", next);
    } catch {
      /* Theme works when storage is unavailable. */
    }
  }
  return (
    <ThemeContext.Provider value={{ theme, toggleTheme }}>
      <MotionConfig reducedMotion="user">{children}</MotionConfig>
    </ThemeContext.Provider>
  );
}
export function useTheme() {
  const context = useContext(ThemeContext);
  if (!context) throw new Error("useTheme requires ThemeProvider");
  return context;
}
