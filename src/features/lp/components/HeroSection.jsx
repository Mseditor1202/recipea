import HeroContent from "@/features/lp/components/HeroContent";
import { Box } from "@mui/material";

export default function HeroSection() {
  return (
    <Box
      component="section"
      sx={{
        position: "relative",

        // Headerを除いたファーストビュー程度
        minHeight: {
          xs: "auto",
          md: "79vh",
        },

        width: "100%",

        backgroundImage: 'url("/images/lp/hero/hero-visual-final.png")',

        backgroundRepeat: "no-repeat",

        // PCでは画面全体を埋める
        backgroundSize: {
          xs: "contain",
          md: "100% auto",
        },

        // 料理・スマホが右側にあるので右基準
        backgroundPosition: {
          xs: "center",
          md: "center center",
        },

        bgcolor: "background.default",
      }}
    >
      <Box
        sx={{
          width: "100%",
          maxWidth: 1440,
          minHeight: {
            xs: "auto",
            md: "79vh",
          },
          mx: "auto",

          display: "flex",
          alignItems: "center",

          px: {
            xs: 2,
            sm: 4,
            md: 8,
            lg: 10,
          },

          py: {
            xs: 6,
            md: 4,
          },
        }}
      >
        <Box
          sx={{
            width: {
              xs: "100%",
              md: "42%",
            },
            maxWidth: 600,
            zIndex: 2,
          }}
        >
          <HeroContent />
        </Box>
      </Box>
    </Box>
  );
}
