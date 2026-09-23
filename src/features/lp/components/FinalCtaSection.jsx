import { Box, Button, Stack, Typography } from "@mui/material";
import { useRouter } from "next/router";

export default function FinalCtaSection() {
  const router = useRouter();

  return (
    <Box
      component="section"
      sx={{
        width: "100%",
        bgcolor: "secondary.main",
        py: { xs: 8, md: 12 },
        px: { xs: 2, sm: 4 },
      }}
    >
      <Box
        sx={{
          width: "100%",
          maxWidth: 960,
          mx: "auto",
          textAlign: "center",
        }}
      >
        <Stack spacing={3} alignItems="center">
          <Typography
            sx={{
              fontSize: 12,
              fontWeight: 700,
              letterSpacing: "0.12em",
              color: "primary.main",
            }}
          >
            START
          </Typography>

          <Typography
            component="h2"
            sx={{
              fontSize: { xs: 28, md: 40 },
              fontWeight: 700,
              lineHeight: 1.5,
              color: "text.primary",
            }}
          >
            お気に入りのレシピを、
            <Box component="span" sx={{ display: "block" }}>
              毎日のごはんへ。
            </Box>
          </Typography>

          <Typography
            sx={{
              maxWidth: 560,
              fontSize: { xs: 14, md: 16 },
              lineHeight: 2,
              color: "text.primary",
              opacity: 0.72,
            }}
          >
            レシピを探して、献立を考えて、買うものを整理する。
            <Box component="span" sx={{ display: "block" }}>
              バラバラだったレシピを、毎日のごはんづくりへ。
            </Box>
          </Typography>

          <Stack
            direction={{ xs: "column", sm: "row" }}
            spacing={2}
            sx={{
              pt: 2,
              width: { xs: "100%", sm: "auto" },
            }}
          >
            <Button
              variant="contained"
              size="large"
              onClick={() => router.push("/auth/login")}
              sx={{
                minWidth: { xs: "100%", sm: 200 },
                px: 5,
                py: 1.6,
                borderRadius: 999,
                fontSize: 16,
                fontWeight: 700,
                boxShadow: 1,
              }}
            >
              無料ではじめる
            </Button>

            <Button
              variant="outlined"
              size="large"
              onClick={() => router.push("/auth/login")}
              sx={{
                minWidth: { xs: "100%", sm: 160 },
                px: 5,
                py: 1.6,
                borderRadius: 999,
                fontSize: 16,
                fontWeight: 700,
                bgcolor: "background.paper",
                borderColor: "primary.main",
                color: "text.primary",
              }}
            >
              ログイン
            </Button>
          </Stack>

          <Typography
            sx={{
              pt: 1,
              fontSize: 12,
              color: "text.primary",
              opacity: 0.55,
            }}
          >
            毎日の「何作ろう？」を、少しずつラクに。
          </Typography>
        </Stack>
      </Box>
    </Box>
  );
}
