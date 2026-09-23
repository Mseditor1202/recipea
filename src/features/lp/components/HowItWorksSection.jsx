import { Box, Stack, Typography } from "@mui/material";

const steps = [
  {
    number: "01",
    title: "レシピを集める",
    description: "SNSやWebで見つけた「作りたい」を、ラクするごはんに保存。",
  },
  {
    number: "02",
    title: "献立を決める",
    description: "集めたレシピから、その日や　1週間の献立をつくります。",
  },
  {
    number: "03",
    title: "買うものをまとめる",
    description: "献立に必要な食材を整理して、買い物リストへまとめます。",
  },
  {
    number: "04",
    title: "毎日のごはんに使う",
    description:
      "冷蔵庫の在庫も確認しながら、無理なく毎日のごはんづくりを回していきます。",
  },
];

export default function HowItWorksSection() {
  return (
    <Box
      component="section"
      sx={{
        width: "100%",
        bgcolor: "background.default",
        py: { xs: 8, md: 12 },
      }}
    >
      <Box
        sx={{
          width: "100%",
          maxWidth: 1200,
          mx: "auto",
          px: { xs: 2, sm: 4, md: 6 },
        }}
      >
        <Stack
          spacing={2}
          sx={{
            textAlign: "center",
            mb: { xs: 6, md: 9 },
          }}
        >
          <Typography
            component="p"
            sx={{
              fontSize: 12,
              fontWeight: 700,
              letterSpacing: "0.12em",
              color: "primary.main",
            }}
          >
            HOW IT WORKS
          </Typography>

          <Typography
            component="h2"
            sx={{
              fontSize: { xs: 26, md: 36 },
              fontWeight: 700,
              color: "text.primary",
            }}
          >
            使い方は、シンプル。
          </Typography>

          <Typography
            sx={{
              fontSize: { xs: 14, md: 16 },
              lineHeight: 1.9,
              color: "text.primary",
              opacity: 0.72,
            }}
          >
            お気に入りのレシピを集めたら、
            <Box component="span" sx={{ display: "block" }}>
              あとは毎日のごはんづくりにつなげるだけ。
            </Box>
          </Typography>
        </Stack>

        <Box
          sx={{
            display: "grid",
            gridTemplateColumns: {
              xs: "1fr",
              sm: "repeat(2, 1fr)",
              md: "repeat(4, 1fr)",
            },
            gap: { xs: 3, md: 3 },
          }}
        >
          {steps.map((step) => (
            <Box
              key={step.number}
              sx={{
                position: "relative",
                minHeight: 260,
                p: { xs: 3, md: 3.5 },
                borderRadius: 3,
                bgcolor: "background.paper",
                boxShadow: 1,
                border: "1px solid",
                borderColor: "rgba(51, 51, 51, 0.06)",
              }}
            >
              <Typography
                sx={{
                  fontSize: 13,
                  fontWeight: 700,
                  letterSpacing: "0.08em",
                  color: "primary.main",
                  mb: 3,
                }}
              >
                STEP {step.number}
              </Typography>

              <Box
                sx={{
                  width: 56,
                  height: 56,
                  borderRadius: "50%",
                  bgcolor: "secondary.main",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  mb: 3,
                }}
              >
                <Typography
                  sx={{
                    fontSize: 20,
                    fontWeight: 700,
                    color: "text.primary",
                  }}
                >
                  {step.number}
                </Typography>
              </Box>

              <Typography
                component="h3"
                sx={{
                  fontSize: { xs: 18, md: 20 },
                  fontWeight: 700,
                  lineHeight: 1.5,
                  color: "text.primary",
                  mb: 2,
                }}
              >
                {step.title}
              </Typography>

              <Typography
                sx={{
                  fontSize: 14,
                  lineHeight: 1.9,
                  color: "text.primary",
                  opacity: 0.72,
                }}
              >
                {step.description}
              </Typography>
            </Box>
          ))}
        </Box>
      </Box>
    </Box>
  );
}
