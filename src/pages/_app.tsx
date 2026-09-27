import "@/styles/globals.css";
import type { AppProps } from "next/app";
import { CssBaseline, ThemeProvider } from "@mui/material";
import { Noto_Sans_JP } from "next/font/google";
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
    <div className={notoSansJP.variable}>
      <ThemeProvider theme={theme}>
        <CssBaseline />

        <AuthProvider>
          <Component {...pageProps} />
        </AuthProvider>
      </ThemeProvider>
    </div>
  );
}
