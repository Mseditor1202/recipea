import React, { useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { signInWithPopup, onAuthStateChanged } from "firebase/auth";
import { auth, provider } from "@/lib/firebase";
import { useRouter } from "next/router";
import { Box, Button, CircularProgress, Typography } from "@mui/material";
import NextLink from "next/link";

function waitForFirebaseUser() {
  return new Promise((resolve, reject) => {
    const unsub = onAuthStateChanged(
      auth,
      (user) => {
        if (user) {
          unsub();
          resolve(user);
        }
      },
      (err) => {
        unsub();
        reject(err);
      },
    );
  });
}

function getSafeNext(next: string | string[] | undefined) {
  const candidate = Array.isArray(next) ? next[0] : next;

  // 必ず同一オリジンの相対パスに限定（open redirect対策）
  if (typeof candidate !== "string" || !candidate.startsWith("/")) {
    return "/home";
  }

  // auth配下へ戻すとループする可能性があるので弾く
  if (candidate.startsWith("/auth")) {
    return "/home";
  }

  return candidate;
}

export default function Login() {
  const router = useRouter();
  const { setIsAuth, loading } = useAuth();

  const [loggingIn, setLoggingIn] = useState(false);

  const handleLogin = async () => {
    setLoggingIn(true);

    try {
      await signInWithPopup(auth, provider);

      // currentUserが確実に入るまで待つ
      await waitForFirebaseUser();

      // AuthProviderの反映待ちで戻らないように即trueへ
      setIsAuth(true);

      // next を優先して戻す
      const nextPath = getSafeNext(router.query.next);
      await router.replace(nextPath);
    } catch (error: unknown) {
      const errorCode =
        typeof error === "object" &&
        error !== null &&
        "code" in error &&
        typeof (error as { code?: unknown }).code === "string"
          ? (error as { code: string }).code
          : "";

      // ユーザー自身によるキャンセルは正常操作として扱う
      if (
        errorCode === "auth/popup-closed-by-user" ||
        errorCode === "auth/cancelled-popup-request"
      ) {
        return;
      }

      console.error("[LOGIN] Google login failed:", error);
      alert("Googleログインに失敗しました。もう一度お試しください。");
    } finally {
      setLoggingIn(false);
    }
  };

  const isBusy = loading || loggingIn;

  return (
    <Box
      sx={{
        minHeight: "100vh",
        position: "relative",
        overflow: "hidden",
        bgcolor: "#FFFEFB",
        display: "flex",
        justifyContent: "center",
      }}
    >
      {/* 背景のやわらかい装飾 */}
      <Box
        sx={{
          position: "absolute",
          width: 180,
          height: 180,
          borderRadius: "50%",
          bgcolor: "#F2F8E7",
          top: -90,
          left: -80,
        }}
      />

      <Box
        sx={{
          position: "absolute",
          width: 220,
          height: 220,
          borderRadius: "50%",
          bgcolor: "#F6F9E9",
          bottom: -140,
          right: -90,
        }}
      />

      <Box
        sx={{
          width: "100%",
          maxWidth: 440,
          px: { xs: 3, sm: 4 },
          py: { xs: 5, sm: 7 },
          position: "relative",
          zIndex: 1,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
        }}
      >
        {/* ブランド */}
        <Box
          component="img"
          src="/icons/rakusuru/navigation/lg_brand_mascot.svg"
          alt="ラクするごはん"
          sx={{
            width: { xs: 120, sm: 135 },
            height: "auto",
            objectFit: "contain",
            mb: 1.5,
          }}
        />

        <Typography
          component="h1"
          sx={{
            fontSize: { xs: 30, sm: 36 },
            fontWeight: 800,
            color: "#146B2E",
            letterSpacing: "-0.03em",
            textAlign: "center",
          }}
        >
          ラクするごはん
        </Typography>

        <Typography
          sx={{
            mt: 1,
            fontSize: { xs: 15, sm: 16 },
            lineHeight: 1.8,
            color: "#343B4A",
            textAlign: "center",
          }}
        >
          毎日の「何作る？」を、
          <br />
          もっとラクに。
        </Typography>

        {/* ログインエリア */}
        <Box
          sx={{
            width: "100%",
            mt: { xs: 7, sm: 8 },
          }}
        >
          <Typography
            component="h2"
            sx={{
              fontSize: { xs: 24, sm: 28 },
              fontWeight: 800,
              color: "#172033",
              textAlign: "center",
            }}
          >
            ログイン
          </Typography>

          <Typography
            sx={{
              mt: 1,
              fontSize: 14,
              color: "#707784",
              textAlign: "center",
              lineHeight: 1.7,
            }}
          >
            Googleアカウントですぐにはじめられます
          </Typography>

          <Button
            type="button"
            onClick={handleLogin}
            disabled={isBusy}
            fullWidth
            variant="outlined"
            sx={{
              mt: 4,
              minHeight: 58,
              borderRadius: 3,
              borderWidth: 1.5,
              borderColor: "#C9DCC3",
              bgcolor: "#FFFFFF",
              color: "#172033",
              fontSize: 16,
              fontWeight: 700,
              textTransform: "none",
              boxShadow: "0 4px 14px rgba(41, 76, 37, 0.04)",
              "&:hover": {
                borderWidth: 1.5,
                borderColor: "#2B8A3E",
                bgcolor: "#FBFDF9",
              },
              "&.Mui-disabled": {
                bgcolor: "#F7F7F7",
                borderColor: "#DDDDDD",
              },
            }}
          >
            {isBusy ? (
              <>
                <CircularProgress
                  size={20}
                  thickness={5}
                  sx={{
                    mr: 1.5,
                    color: "#27863B",
                  }}
                />
                Googleでログイン中...
              </>
            ) : (
              <>
                <Box
                  component="span"
                  sx={{
                    width: 30,
                    height: 30,
                    mr: 1.5,
                    borderRadius: "50%",
                    bgcolor: "#FFFFFF",
                    border: "1px solid #E5E5E5",
                    display: "grid",
                    placeItems: "center",
                    fontSize: 18,
                    fontWeight: 800,
                    color: "#4285F4",
                    flexShrink: 0,
                  }}
                >
                  G
                </Box>
                Googleでログイン
              </>
            )}
          </Button>

          <Typography
            sx={{
              mt: 2.5,
              px: 2,
              fontSize: 12,
              lineHeight: 1.8,
              color: "#8A8A8A",
              textAlign: "center",
            }}
          >
            ログインすると、献立・レシピ・買い物リストなどの
            <br />
            機能をご利用いただけます。
          </Typography>
        </Box>
        <Box
          sx={{
            mt: 4,
            textAlign: "center",
          }}
        >
          <Typography
            component="span"
            sx={{
              fontSize: 13,
              color: "#707784",
            }}
          >
            はじめて利用する方は
          </Typography>

          <Button
            component={NextLink}
            href="/auth/signup"
            variant="text"
            sx={{
              ml: 0.5,
              minWidth: "auto",
              px: 0.5,
              color: "#27863B",
              fontSize: 13,
              fontWeight: 700,
              textTransform: "none",
            }}
          >
            新規登録
          </Button>
        </Box>

        {/* 下部メッセージ */}
        <Box
          sx={{
            mt: "auto",
            pt: { xs: 8, sm: 10 },
            textAlign: "center",
          }}
        >
          <Typography
            sx={{
              fontSize: 13,
              color: "#707784",
              lineHeight: 1.8,
            }}
          >
            毎日の「何作る？」をもっとラクに。
          </Typography>
        </Box>
      </Box>
    </Box>
  );
}
