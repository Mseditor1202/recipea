import { Box } from "@mui/material";
import Image from "next/image";

export default function HeroVisual() {
  return (
    <Box
      sx={{
        position: "relative",
        width: "100%",
        maxWidth: 360,
        aspectRatio: "360 / 620",
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
  );
}
