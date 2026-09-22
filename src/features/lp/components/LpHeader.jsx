import { Box, Button, Stack, Typography } from "@mui/material";
import NextLink from "next/link";

export default function LpHeader() {
  return (
    <Box
      component="header"
      sx={{
        position: "sticky",
        top: 0,
        zIndex: 10,
        bgcolor: "background.default",
        borderBottom: "1px solid",
        borderColor: "rgba(51, 51, 51, 0.08)",
      }}
    >
      <Box
        sx={{
          maxWidth: 1200,
          mx: "auto",
          px: { xs: 2, md: 6 },
          py: 2,
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
        }}
      >
        <Typography
          component={NextLink}
          href="/"
          sx={{
            color: "text.primary",
            fontWeight: 700,
            fontSize: 18,
            textDecoration: "none",
          }}
        >
          🍲 ラクするごはん
        </Typography>

        <Stack direction="row" spacing={1.5}>
          <Button
            component={NextLink}
            href="/auth/login"
            sx={{
              color: "text.primary",
              fontWeight: 700,
            }}
          >
            ログイン
          </Button>

          <Button
            component={NextLink}
            href="/auth/login"
            variant="contained"
            color="primary"
            sx={{
              borderRadius: 1,
              px: { xs: 2, md: 3 },
              fontWeight: 700,
            }}
          >
            無料ではじめる
          </Button>
        </Stack>
      </Box>
    </Box>
  );
}
