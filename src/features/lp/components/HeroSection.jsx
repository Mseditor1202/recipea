import HeroContent from "@/features/lp/components/HeroContent";
import HeroVisual from "@/features/lp/components/HeroVisual";
import { Box } from "@mui/material";

export default function HeroSection() {
  return (
    <Box
      component="section"
      sx={{
        minHeight: "100vh",
        bgcolor: "background.default",
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
        <HeroContent />

        <Box
          sx={{
            minHeight: { xs: 480, md: 620 },
            display: "flex",
            justifyContent: "center",
            alignItems: "center",
          }}
        >
          <HeroVisual />
        </Box>
      </Box>
    </Box>
  );
}
