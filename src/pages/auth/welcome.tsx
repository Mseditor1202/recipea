import React from "react";
import { useRouter } from "next/router";
import { Box, Button, Stack, Typography } from "@mui/material";

const FEATURES = [
  {
    icon: "/icons/rakusuru/navigation/lg_nav_recipe.svg",
    label: "レシピを保存",
  },
  {
    icon: "/icons/rakusuru/navigation/lg_nav_mealplan.svg",
    label: "献立をラクに作成",
  },
  {
    icon: "/icons/rakusuru/life/lg_life_shopping_list.png",
    label: "買い物リストまで連携",
  },
];

export default function Welcome() {
  const router = useRouter();

  const handleStart = async () => {
    await router.replace("/home");
  };

  return (
    <Box
      sx={{
        minHeight: "100vh",
        position: "relative",
        overflow: "hidden",
        bgcolor: "#FFFEFB",
        px: { xs: 2.5, sm: 3 },
        py: { xs: 4, sm: 5 },
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
          maxWidth: 520,
          mx: "auto",
          textAlign: "center",
        }}
      >
        {/* マスコット */}
        <Box
          component="img"
          src="/icons/rakusuru/navigation/lg_brand_mascot.svg"
          alt="ラクするごはん"
          sx={{
            width: { xs: 120, sm: 140 },
            height: "auto",
          }}
        />

        <Typography
          sx={{
            fontSize: { xs: 28, sm: 32 },
            fontWeight: 800,
            color: "#172033",
            lineHeight: 1.3,
          }}
        >
          ようこそ
        </Typography>

        <Typography
          component="h1"
          sx={{
            mt: 0.5,
            fontSize: { xs: 36, sm: 44 },
            fontWeight: 900,
            color: "#1E7A3A",
            letterSpacing: "-0.04em",
            lineHeight: 1.25,
          }}
        >
          ラクするごはん
        </Typography>

        <Typography
          sx={{
            mt: 2,
            fontSize: { xs: 20, sm: 22 },
            fontWeight: 700,
            color: "#172033",
            lineHeight: 1.7,
          }}
        >
          毎日の「何作る？」を、
          <br />
          もっとラクに。
        </Typography>

        <Typography
          sx={{
            mt: 1,
            fontSize: { xs: 14, sm: 15 },
            color: "#4F5A68",
            lineHeight: 1.9,
          }}
        >
          お気に入りレシピを集めて、
          <br />
          献立づくりも、買い物も、ひとつに。
        </Typography>

        {/* 機能3つ */}
        <Box
          sx={{
            mt: 2.5,
            display: "grid",
            gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
            gap: { xs: 1.5, sm: 2 },
          }}
        >
          {FEATURES.map((feature) => (
            <Box key={feature.label}>
              <Box
                sx={{
                  width: { xs: 88, sm: 104 },
                  height: { xs: 88, sm: 104 },
                  mx: "auto",
                  borderRadius: "50%",
                  bgcolor: "#F4F9E8",
                  display: "grid",
                  placeItems: "center",
                }}
              >
                <Box
                  component="img"
                  src={feature.icon}
                  alt={feature.label}
                  sx={{
                    width: { xs: 48, sm: 56 },
                    height: { xs: 48, sm: 56 },
                    objectFit: "contain",
                  }}
                />
              </Box>

              <Typography
                sx={{
                  mt: 1.5,
                  fontSize: { xs: 12, sm: 13 },
                  fontWeight: 700,
                  color: "#172033",
                  lineHeight: 1.5,
                }}
              >
                {feature.label}
              </Typography>
            </Box>
          ))}
        </Box>

        {/* CTA */}
        <Button
          type="button"
          variant="contained"
          fullWidth
          onClick={handleStart}
          sx={{
            mt: 3,
            minHeight: 60,
            borderRadius: 3,
            bgcolor: "#22863A",
            color: "#FFFFFF",
            fontSize: { xs: 18, sm: 20 },
            fontWeight: 800,
            textTransform: "none",
            boxShadow: "0 8px 20px rgba(34, 134, 58, 0.18)",
            position: "relative",
            justifyContent: "center",
            "&:hover": {
              bgcolor: "#1C7432",
              boxShadow: "0 10px 24px rgba(34, 134, 58, 0.22)",
            },
          }}
        >
          はじめる
          <Box
            component="span"
            sx={{
              position: "absolute",
              right: 22,
              top: "50%",
              transform: "translateY(-50%)",
              fontSize: 28,
              lineHeight: 1,
            }}
          >
            ›
          </Box>
        </Button>

        <Typography
          sx={{
            mt: 2.5,
            fontSize: 13,
            color: "#7A8491",
          }}
        >
          まずはホームから使ってみましょう
        </Typography>

        {/* 下部装飾 */}
        <Box
          sx={{
            mt: 4,
            height: 70,
            position: "relative",
          }}
        >
          <Box
            sx={{
              position: "absolute",
              left: "5%",
              bottom: -25,
              width: 160,
              height: 80,
              borderRadius: "50% 50% 0 0",
              bgcolor: "#E7F3D4",
            }}
          />

          <Box
            sx={{
              position: "absolute",
              right: "0%",
              bottom: -35,
              width: 220,
              height: 95,
              borderRadius: "50% 50% 0 0",
              bgcolor: "#DDF0C8",
            }}
          />
        </Box>
      </Box>
    </Box>
  );
}
