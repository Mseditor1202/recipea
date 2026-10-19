import NextLink from "next/link";
import { Box, Stack, Typography } from "@mui/material";

export default function BrandLogo({
  href = "/home",
  size = "default",
  showText = true,
}) {
  const mascotSize = size === "small" ? 30 : 36;
  const fontSize = size === "small" ? 16 : 18;

  return (
    <Stack
      component={NextLink}
      href={href}
      direction="row"
      alignItems="center"
      spacing={1}
      sx={{
        textDecoration: "none",
        width: "fit-content",
      }}
    >
      <Box
        component="img"
        src="/icons/rakusuru/navigation/lg_brand_mascot.svg"
        alt="ラクするごはん"
        sx={{
          width: mascotSize,
          height: mascotSize,
          objectFit: "contain",
          flexShrink: 0,
        }}
      />

      {showText && (
        <Typography
          component="div"
          sx={{
            fontSize,
            fontWeight: 700,
            letterSpacing: "0.02em",
            lineHeight: 1,
            whiteSpace: "nowrap",
          }}
        >
          <Box component="span" sx={{ color: "#D98A16" }}>
            ラクする
          </Box>

          <Box component="span" sx={{ color: "#5A4634" }}>
            ごはん
          </Box>
        </Typography>
      )}
    </Stack>
  );
}
