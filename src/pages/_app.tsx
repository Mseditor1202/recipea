import "@/styles/globals.css";
import "@/styles/Navbar.css";
import type { AppProps } from "next/app";
import Navbar from "@/components/notes/Navbar";
import { AuthProvider } from "@/hooks/useAuth";
import { useState } from "react";

export default function App({ Component, pageProps }: AppProps) {
  const [isAuth, setIsAuth] = useState(false);

  return (
    <AuthProvider>
      <Navbar />
      <div style={{ paddingTop: 50 }}>
        <Component {...pageProps} />
      </div>
    </AuthProvider>
  );
}
