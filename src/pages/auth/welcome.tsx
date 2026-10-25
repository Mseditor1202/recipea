import React from "react";
import { useRouter } from "next/router";
import { Box, Button, Typography } from "@mui/material";

export default function Welcome() {
  const router = useRouter();

  const handleStart = async () => {
    await router.replace("/home");
  };

  return (
    <Box
      sx={{
        minHeight: "100vh",
        bgcolor: "#FFFEFB",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        px: 3,
        py: 5,
      }}
    >
      <Box
        sx={{
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
            width: { xs: 130, sm: 150 },
            height: "auto",
            mb: 3,
          }}
        />

        <Typography
          component="h1"
          sx={{
            fontSize: { xs: 28, sm: 34 },
            fontWeight: 800,
            color: "#172033",
            lineHeight: 1.4,
          }}
        >
          ようこそ！
        </Typography>

        <Typography
          sx={{
            mt: 2,
            fontSize: { xs: 15, sm: 16 },
            color: "#5F6672",
            lineHeight: 1.9,
          }}
        >
          ラクするごはんへ
          <br />
          ご登録ありがとうございます。
        </Typography>

        <Box
          sx={{
            mt: 5,
            p: 3,
            borderRadius: 4,
            bgcolor: "#FFF8EC",
            border: "1px solid #F3D6A3",
          }}
        >
          <Typography
            sx={{
              fontSize: 15,
              fontWeight: 700,
              color: "#333333",
            }}
          >
            毎日の「何作る？」をもっとラクに。
          </Typography>

          <Typography
            sx={{
              mt: 1,
              fontSize: 13,
              color: "#777777",
              lineHeight: 1.8,
            }}
          >
            献立を決めたり、レシピを登録したり、
            <br />
            買い物リストをまとめて管理できます。
          </Typography>
        </Box>

        <Button
          type="button"
          variant="contained"
          fullWidth
          onClick={handleStart}
          sx={{
            mt: 5,
            minHeight: 54,
            borderRadius: 999,
            bgcolor: "#FFB830",
            color: "#333333",
            fontSize: 16,
            fontWeight: 700,
            textTransform: "none",
            boxShadow: "none",
            "&:hover": {
              bgcolor: "#F5A900",
              boxShadow: "none",
            },
          }}
        >
          はじめる
        </Button>
      </Box>
    </Box>
  );
}
