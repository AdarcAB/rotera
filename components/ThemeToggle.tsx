"use client";

import { useEffect, useState } from "react";

type Theme = "system" | "light" | "dark";

const STORAGE_KEY = "rotera.theme";

function applyTheme(theme: Theme) {
  const resolved =
    theme === "dark" ||
    (theme === "system" &&
      window.matchMedia("(prefers-color-scheme: dark)").matches);
  document.documentElement.classList.toggle("dark", resolved);
}

export function ThemeToggle() {
  const [theme, setTheme] = useState<Theme>("system");

  useEffect(() => {
    const stored = (localStorage.getItem(STORAGE_KEY) as Theme | null) ?? "system";
    setTheme(stored);
    // Apply once on mount in case head script missed an edge case
    applyTheme(stored);
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const onChange = () => {
      const current =
        (localStorage.getItem(STORAGE_KEY) as Theme | null) ?? "system";
      if (current === "system") applyTheme("system");
    };
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);

  const pick = (next: Theme) => {
    setTheme(next);
    try {
      localStorage.setItem(STORAGE_KEY, next);
    } catch {
      /* ignore */
    }
    applyTheme(next);
  };

  return (
    <div
      role="radiogroup"
      aria-label="Tema"
      className="inline-flex rounded-md border border-border overflow-hidden bg-white"
    >
      {(["system", "light", "dark"] as const).map((opt) => {
        const active = theme === opt;
        const label =
          opt === "system" ? "System" : opt === "light" ? "Ljus" : "Mörk";
        return (
          <button
            key={opt}
            type="button"
            role="radio"
            aria-checked={active}
            onClick={() => pick(opt)}
            className={`h-10 px-4 text-sm flex items-center justify-center ${
              active
                ? "bg-primary text-primary-foreground"
                : "hover:bg-neutral-50 text-neutral-700"
            }`}
          >
            {label}
          </button>
        );
      })}
    </div>
  );
}
