// src/features/lp/components/CycleSection.jsx
import { Box } from "@mui/material";

export default function CycleSection() {
  return (
    <Box
      component="section"
      sx={{
        width: "100%",
        bgcolor: "background.default",

        // 前セクションへ少し重ねる
        mt: { xs: 0, md: -2 },

        // セクション間の不要な余白をなくす
        pt: 0,
        pb: 0,

        position: "relative",
        zIndex: 1,
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
          src="/images/lp/cycle/cycle-section-final.png"
          alt="お気に入りレシピが毎日のごはんにつながるサイクル"
          sx={{
            display: "block",
            width: "100%",
            height: "auto",
            m: 0,
          }}
        />
      </Box>
    </Box>
  );
}
