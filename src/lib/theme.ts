export const THEME_STORAGE_KEY = "trip-helper:theme";

export type ThemeChoice = "system" | "light" | "dark";

export function readTheme(): ThemeChoice {
  try {
    const value = localStorage.getItem(THEME_STORAGE_KEY);
    return value === "light" || value === "dark" ? value : "system";
  } catch {
    return "system";
  }
}

export function applyTheme(choice: ThemeChoice) {
  const root = document.documentElement;
  try {
    if (choice === "system") localStorage.removeItem(THEME_STORAGE_KEY);
    else localStorage.setItem(THEME_STORAGE_KEY, choice);
  } catch {
    // Storage blocked (private mode): the choice still applies for this visit.
  }
  if (choice === "system") delete root.dataset.theme;
  else root.dataset.theme = choice;
}

/**
 * Trip and avatar colors (direction D): deep, printed-ink tones. Each passes
 * AA with light text (#FFFCF6) on top and as large text on paper.
 */
export const PALETTE = [
  "#B8322A", // red
  "#1F6B52", // green
  "#2B4FA3", // blue
  "#7A3FA0", // plum
  "#B0571A", // rust
  "#0F6E7A", // teal
] as const;

export const DEFAULT_TRIP_COLOR = PALETTE[0];

/** Text drawn on top of a palette color. */
export const ON_PALETTE = "#FFFCF6";
