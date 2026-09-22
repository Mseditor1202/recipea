export const colorTokens = {
  main: "#FFB830",
  sub: "#FFF3E0",

  background: "#FFFDFA",
  surface: "#FFFFFF",

  text: "#333333",

  success: "#66BB6A",
  warning: "#FF9800",
  error: "#F44336",
} as const;

export const typographyTokens = {
  fontFamily: "var(--font-noto-sans-jp), sans-serif",

  h1: {
    fontSize: 24,
    fontWeight: 700,
  },

  h2: {
    fontSize: 18,
    fontWeight: 700,
  },

  section: {
    fontSize: 16,
    fontWeight: 600,
  },

  body: {
    fontSize: 14,
    fontWeight: 400,
  },

  helper: {
    fontSize: 12,
    fontWeight: 400,
  },
} as const;

export const spacingTokens = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  xxl: 32,
} as const;

export const radiusTokens = {
  sm: 8,
  md: 12,
  lg: 16,
  pill: 999,
} as const;

export const shadowTokens = {
  soft: "0 4px 12px rgba(0, 0, 0, 0.06)",
  card: "0 8px 24px rgba(0, 0, 0, 0.08)",
} as const;
