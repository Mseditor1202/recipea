// src/features/lp/components/ProblemSection.jsx
import { Box } from "@mui/material";

export default function ProblemSection() {
  return (
    <Box
      component="section"
      sx={{
        width: "100%",
        bgcolor: "background.default",
        py: { xs: 4, md: 3.1 },
      }}
    >
      <Box
        sx={{
          width: "100%",
          mx: "auto",
          bgcolor: "background.default",
          py: 0,
        }}
      >
        <Box
          component="img"
          src="/images/lp/problem/problem-section-final.png"
          alt="課題提起セクション"
          sx={{
            display: "block",
            width: "100%",
            height: "auto",
          }}
        />
      </Box>
    </Box>
  );
}
