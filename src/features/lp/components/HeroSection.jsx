import HeroContent from "@/features/lp/components/HeroContent";
import { Box, Button, Stack, Typography } from "@mui/material";
import Image from "next/image";
import NextLink from "next/link";

export default function HeroSection() {
  return (
    <Box
      component="section"
      sx={{
        minHeight: "100vh",
        bgcolor: "#FFFDFA",
        px: { xs: 2, md: 6 },
        py: { xs: 4, md: 8 },
      }}
    >
      <Box
        sx={{
          maxWidth: 1200,
          mx: "auto",
          display: "grid",
          gridTemplateColumns: {
            xs: "1fr",
            md: "1fr 1fr",
          },
          alignItems: "center",
          gap: { xs: 5, md: 8 },
        }}
      >
        {/* 左：コピー・CTA */}
        <Box>
          <HeroContent />
        </Box>

        {/* 右：Heroビジュアル */}
        <Box
          sx={{
            position: "relative",
            minHeight: { xs: 480, md: 620 },
            display: "flex",
            justifyContent: "center",
            alignItems: "center",
          }}
        >
          <Image
            src="/images/lp/hero/device/hero-phone.png"
            alt="ラクするごはんのアプリ画面"
            fill
            sizes="(max-width: 900px) 80vw, 360px"
            loading="eager"
            style={{
              objectFit: "contain",
            }}
          />
        </Box>
      </Box>
    </Box>
  );
}
