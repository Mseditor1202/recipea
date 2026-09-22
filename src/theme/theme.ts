import { createTheme } from "@mui/material/styles";
import {
  colorTokens,
  typographyTokens,
  radiusTokens,
  shadowTokens,
} from "./tokens";

const theme = createTheme({
  palette: {
    primary: {
      main: colorTokens.main,
      contrastText: colorTokens.text,
    },

    secondary: {
      main: colorTokens.sub,
      contrastText: colorTokens.text,
    },

    background: {
      default: colorTokens.background,
      paper: colorTokens.surface,
    },

    text: {
      primary: colorTokens.text,
    },

    success: {
      main: colorTokens.success,
    },

    warning: {
      main: colorTokens.warning,
    },

    error: {
      main: colorTokens.error,
    },
  },

  typography: {
    fontFamily: typographyTokens.fontFamily,

    h1: {
      fontSize: typographyTokens.h1.fontSize,
      fontWeight: typographyTokens.h1.fontWeight,
    },

    h2: {
      fontSize: typographyTokens.h2.fontSize,
      fontWeight: typographyTokens.h2.fontWeight,
    },

    body1: {
      fontSize: typographyTokens.body.fontSize,
      fontWeight: typographyTokens.body.fontWeight,
    },

    caption: {
      fontSize: typographyTokens.helper.fontSize,
      fontWeight: typographyTokens.helper.fontWeight,
    },
  },

  shape: {
    borderRadius: radiusTokens.md,
  },

  shadows: [
    "none",
    shadowTokens.soft,
    shadowTokens.card,
    shadowTokens.card,
    shadowTokens.card,
    shadowTokens.card,
    shadowTokens.card,
    shadowTokens.card,
    shadowTokens.card,
    shadowTokens.card,
    shadowTokens.card,
    shadowTokens.card,
    shadowTokens.card,
    shadowTokens.card,
    shadowTokens.card,
    shadowTokens.card,
    shadowTokens.card,
    shadowTokens.card,
    shadowTokens.card,
    shadowTokens.card,
    shadowTokens.card,
    shadowTokens.card,
    shadowTokens.card,
    shadowTokens.card,
    shadowTokens.card,
  ],
});

export default theme;
