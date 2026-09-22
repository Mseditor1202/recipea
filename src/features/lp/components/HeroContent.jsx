import { Box, Button, Stack, Typography } from "@mui/material";
import NextLink from "next/link";

export default function HeroContent() {
  return (
    <Box>
      <Typography
        component="h1"
        sx={{
          fontSize: { xs: 36, md: 56 },
          fontWeight: 700,
          lineHeight: 1.3,
          color: "#333",
        }}
      >
        好きなレシピを、
        <br />
        ひとつの場所に。
      </Typography>

      <Typography
        sx={{
          mt: 3,
          fontSize: { xs: 15, md: 17 },
          lineHeight: 1.9,
          color: "#555",
        }}
      >
        お気に入りのレシピをまとめて、
        <br />
        毎日の献立づくりをもっとラクに。
      </Typography>

      <Stack direction={{ xs: "column", sm: "row" }} spacing={2} sx={{ mt: 4 }}>
        <Button
          component={NextLink}
          href="/auth/login"
          variant="contained"
          sx={{
            bgcolor: "#FFB830",
            color: "#333",
            borderRadius: 3,
            px: 4,
            py: 1.5,
            fontWeight: 700,
          }}
        >
          無料ではじめる
        </Button>

        <Button
          component={NextLink}
          href="/auth/login"
          variant="outlined"
          sx={{
            borderRadius: 3,
            px: 4,
            py: 1.5,
            fontWeight: 700,
          }}
        >
          ログイン
        </Button>
      </Stack>
    </Box>
  );
}
