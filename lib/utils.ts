import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatTime(seconds: number): string {
  const s = Math.max(0, Math.floor(seconds));
  const mm = Math.floor(s / 60).toString().padStart(2, "0");
  const ss = (s % 60).toString().padStart(2, "0");
  return `${mm}:${ss}`;
}

export function capitalizeName(raw: string): string {
  return raw
    .trim()
    .replace(/\s+/g, " ")
    .split(/(\s+|-)/)
    .map((part) =>
      part.length > 0 && /[a-zåäöéèüñœ]/i.test(part[0])
        ? part[0].toLocaleUpperCase("sv-SE") + part.slice(1)
        : part
    )
    .join("");
}
