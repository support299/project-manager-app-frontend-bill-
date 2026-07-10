export const COLORS = {
  primary: "#ff8500",
  primaryForeground: "#ffffff",
  background: "oklch(0.992 0.003 80)",
  foreground: "oklch(0.22 0.01 60)",
  card: "oklch(1 0 0)",
  cardForeground: "oklch(0.22 0.01 60)",
  secondary: "oklch(0.965 0.005 80)",
  secondaryForeground: "oklch(0.28 0.01 60)",
  muted: "oklch(0.96 0.005 80)",
  mutedForeground: "oklch(0.52 0.012 60)",
  accent: "oklch(0.94 0.012 80)",
  accentForeground: "oklch(0.28 0.01 60)",
  destructive: "oklch(0.55 0.22 27)",
  destructiveForeground: "oklch(0.98 0.003 80)",
  border: "oklch(0.91 0.006 75)",
  input: "oklch(0.91 0.006 75)",
  ring: "oklch(0.7 0.04 60)",
  sidebar: "oklch(0.978 0.004 80)",
  sidebarForeground: "oklch(0.22 0.01 60)",
  sidebarBorder: "oklch(0.91 0.006 75)",
  priorityMedium: "#fde68a",
  priorityHigh: "#eab308",
  priorityUrgent: "#dc2626",
};

export const STATUS_COLORS = {
  backlog: "oklch(0.94 0.005 80)",
  todo: "oklch(0.92 0.03 250)",
  in_progress: "oklch(0.92 0.05 80)",
  review: "oklch(0.91 0.04 310)",
  done: "oklch(0.91 0.06 150)",
  archive: "oklch(0.90 0.02 280)",
  cancelled: "oklch(0.93 0.01 60)",
};

export const DARK_COLORS = {
  ...COLORS,
  background: "oklch(0.16 0.005 60)",
  foreground: "oklch(0.96 0.003 80)",
  card: "oklch(0.2 0.005 60)",
  border: "oklch(1 0 0 / 10%)",
};
