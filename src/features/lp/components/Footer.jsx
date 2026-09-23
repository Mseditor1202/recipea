import { Box, Typography } from "@mui/material";

export default function Footer() {
  return (
    <Box
      component="footer"
      sx={{
        width: "100%",
        bgcolor: "background.default",
        py: 4,
        px: 2,
        textAlign: "center",
        borderTop: "1px solid",
        borderColor: "rgba(51, 51, 51, 0.06)",
      }}
    >
      <Typography
        sx={{
          fontSize: 14,
          fontWeight: 700,
          color: "text.primary",
          mb: 1,
        }}
      >
        ラクするごはん
      </Typography>

      <Typography
        sx={{
          fontSize: 12,
          color: "text.primary",
          opacity: 0.5,
        }}
      >
        © 2026　amPatchworks
      </Typography>
    </Box>
  );
}
