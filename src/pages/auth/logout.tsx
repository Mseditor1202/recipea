import React, { useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { signOut } from "firebase/auth";
import { auth } from "@/lib/firebase";
import { useRouter } from "next/router";
import { Box, Button, CircularProgress, Typography } from "@mui/material";

export default function Logout() {
  const router = useRouter();
  const { setIsAuth } = useAuth();

  const [loggingOut, setLoggingOut] = useState(false);

  const handleLogout = async () => {
    try {
      setLoggingOut(true);

      await signOut(auth);

      localStorage.setItem("isAuth", "false");
      setIsAuth(false);

      await router.replace("/");
    } catch (error: unknown) {
      console.error("[LOGOUT] logout failed:", error);
      alert("ログアウトに失敗しました。もう一度お試しください。");
      setLoggingOut(false);
    }
  };

  return (
    <Box
      sx={{
        minHeight: "100vh",
        position: "relative",
        overflow: "hidden",
        bgcolor: "#FFFEFB",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        px: 3,
        py: 5,
      }}
    >
      {/* 背景装飾 */}
      <Box
        sx={{
          position: "absolute",
          width: 180,
          height: 180,
          borderRadius: "50%",
          bgcolor: "#EFF8E4",
          top: -80,
          left: -100,
          opacity: 0.9,
        }}
      />

      <Box
        sx={{
          position: "absolute",
          width: 240,
          height: 240,
          borderRadius: "50%",
          bgcolor: "#F3F9E8",
          bottom: -120,
          right: -120,
          opacity: 0.9,
        }}
      />

      <Box
        sx={{
          position: "relative",
          zIndex: 1,
          width: "100%",
          maxWidth: 440,
          textAlign: "center",
        }}
      >
        <Box
          component="img"
          src="/icons/rakusuru/navigation/lg_brand_mascot.svg"
          alt="ラクするごはん"
          sx={{
            width: { xs: 120, sm: 140 },
            height: "auto",
            mb: 2,
          }}
        />

        <Typography
          component="h1"
          sx={{
            fontSize: { xs: 28, sm: 32 },
            fontWeight: 800,
            color: "#172033",
          }}
        >
          ログアウトしますか？
        </Typography>

        <Typography
          sx={{
            mt: 2,
            fontSize: { xs: 14, sm: 15 },
            color: "#5F6672",
            lineHeight: 1.9,
          }}
        >
          ログアウトしても、
          <br />
          保存したレシピや献立はそのまま残ります。
        </Typography>

        <Button
          type="button"
          variant="contained"
          fullWidth
          onClick={handleLogout}
          disabled={loggingOut}
          sx={{
            mt: 5,
            minHeight: 58,
            borderRadius: 3,
            bgcolor: "#22863A",
            color: "#FFFFFF",
            fontSize: { xs: 17, sm: 18 },
            fontWeight: 800,
            textTransform: "none",
            boxShadow: "0 8px 20px rgba(34, 134, 58, 0.18)",
            "&:hover": {
              bgcolor: "#1C7432",
              boxShadow: "0 10px 24px rgba(34, 134, 58, 0.22)",
            },
            "&.Mui-disabled": {
              bgcolor: "#A8CDB0",
              color: "#FFFFFF",
            },
          }}
        >
          {loggingOut ? (
            <>
              <CircularProgress
                size={20}
                thickness={5}
                sx={{
                  mr: 1.5,
                  color: "#FFFFFF",
                }}
              />
              ログアウト中...
            </>
          ) : (
            "ログアウトする"
          )}
        </Button>

        <Button
          type="button"
          variant="text"
          fullWidth
          disabled={loggingOut}
          onClick={() => router.back()}
          sx={{
            mt: 1.5,
            minHeight: 48,
            color: "#667085",
            fontSize: 14,
            fontWeight: 700,
            textTransform: "none",
            "&:hover": {
              bgcolor: "#F7F9F4",
            },
          }}
        >
          戻る
        </Button>
      </Box>
    </Box>
  );
}
