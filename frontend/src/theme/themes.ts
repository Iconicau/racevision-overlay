export interface Theme {
  id: string;
  label: string;
  description: string;
  preview: { surface: string; accent: string; text: string; };
}

export const THEMES: Theme[] = [
  {
    id: "dark",
    label: "Dark",
    description: "Default dark theme",
    preview: { surface: "#16161a", accent: "#5294ff", text: "#ffffff" },
  },
  {
    id: "oled",
    label: "OLED",
    description: "True black for OLED displays",
    preview: { surface: "#08080a", accent: "#60a5fa", text: "#ffffff" },
  },
  {
    id: "midnight",
    label: "Midnight",
    description: "Deep blue-tinted dark",
    preview: { surface: "#0e1426", accent: "#8291ff", text: "#e6eeff" },
  },
  {
    id: "vibrant",
    label: "Vibrant",
    description: "High-contrast vivid colours",
    preview: { surface: "#12121c", accent: "#69beff", text: "#ffffff" },
  },
  {
    id: "sunset",
    label: "Sunset",
    description: "Warm orange accent",
    preview: { surface: "#1c1016", accent: "#ff8c50", text: "#fff2eb" },
  },
  {
    id: "light",
    label: "Light",
    description: "Light theme for bright environments",
    preview: { surface: "#eef2f8", accent: "#2563eb", text: "#0a1226" },
  },
];

export const THEME_MAP = Object.fromEntries(
  THEMES.map((t) => [t.id, t])
) as Record<string, Theme>;

export function applyTheme(themeId: string): void {
  document.documentElement.setAttribute("data-theme", themeId);
}
