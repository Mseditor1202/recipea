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

  // 新しいAppLayoutへ移行済みのページ
  const usesAppLayout = router.pathname === "/home";

  // LPと新Layoutページでは旧Navbarを表示しない
  const hideLegacyNavbar = isLp || usesAppLayout;

  return (
    <div className={notoSansJP.variable}>
      <ThemeProvider theme={theme}>
        <CssBaseline />

        <AuthProvider>
          {!hideLegacyNavbar && <Navbar />}

          <div style={{ paddingTop: hideLegacyNavbar ? 0 : 50 }}>
            <Component {...pageProps} />
          </div>
        </AuthProvider>
      </ThemeProvider>
    </div>
  );
}
