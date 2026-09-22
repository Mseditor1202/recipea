import "@/styles/globals.css";
import "@/styles/Navbar.css";
import { useRouter } from "next/router";
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
  const router = useRouter();
  const isLp = router.pathname === "/";

  return (
    <div className={notoSansJP.variable}>
      <ThemeProvider theme={theme}>
        <CssBaseline />

        <AuthProvider>
          {!isLp && <Navbar />}

          <div style={{ paddingTop: isLp ? 0 : 50 }}>
            <Component {...pageProps} />
          </div>
        </AuthProvider>
      </ThemeProvider>
    </div>
  );
}
