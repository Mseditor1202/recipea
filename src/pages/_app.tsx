import "@/styles/globals.css";
import "@/styles/Navbar.css";

import type { AppProps } from "next/app";
import { CssBaseline, ThemeProvider } from "@mui/material";
import { Noto_Sans_JP } from "next/font/google";

import Navbar from "@/components/notes/Navbar";
import { AuthProvider } from "@/hooks/useAuth";
import theme from "@/theme/theme";

const notoSansJP = Noto_Sans_JP({
  subsets: ["latin"],
  weight: ["400", "600", "700"],
  display: "swap",
  variable: "--font-noto-sans-jp",
});

export default function App({ Component, pageProps }: AppProps) {
  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />

      <AuthProvider>
        <Navbar />

        <div style={{ paddingTop: 50 }}>
          <Component {...pageProps} />
        </div>
      </AuthProvider>
    </ThemeProvider>
  );
}
