import { Box, Stack, Typography } from "@mui/material";

const features = [
  {
    number: "01",
    title: "お気に入りレシピを、ひとまとめ。",
    lead: "「あのレシピ、どこに保存したっけ？」をなくします。",
    description:
      "SNSやWebで見つけた作りたいレシピを、ラクするごはんにまとめて管理。お気に入りが埋もれず、いつでも献立に使えます。",
    imageLabel: "レシピ一覧画面",
  },
  {
    number: "02",
    title: "集めたレシピから、献立をつくる。",
    lead: "毎日の「何作ろう？」を、もっとラクに。",
    description:
      "保存したレシピから、その日の献立や週間献立を作成。ゼロから考えるのではなく、好きな料理から選べます。",
    imageLabel: "週間献立画面",
  },
  {
    number: "03",
    title: "必要なものを、買い物リストに。",
    lead: "献立を決めたあとも、考えることを減らします。",
    description:
      "献立に必要な食材を買い物リストにまとめて管理。買うものを整理しやすくして、買い忘れや確認の手間を減らします。",
    imageLabel: "買い物リスト画面",
  },
  {
    number: "04",
    title: "冷蔵庫にあるものも、ひと目で確認。",
    lead: "家にある食材を確認して、ムダな買い物を減らす。",
    description:
      "冷蔵庫の在庫や期限を管理。買い物の前にも確認しやすく、すでにある食材を重複して買うことを防ぎます。",
    imageLabel: "冷蔵庫画面",
  },
  {
    number: "05",
    title: "疲れた日は、ズボラ献立。",
    lead: "考える余裕がない日まで、頑張らなくていい。",
    description:
      "よく使う1日分の献立をセットとして登録。疲れた日は、空いている献立にまとめて反映できます。",
    imageLabel: "ズボラ献立画面",
  },
];

export default function FeaturesSection() {
  return (
    <Box
      component="section"
      sx={{
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
            mb: { xs: 7, md: 12 },
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
            FEATURES
          </Typography>

          <Typography
            component="h2"
            sx={{
              fontSize: { xs: 26, md: 36 },
              fontWeight: 700,
              color: "text.primary",
            }}
          >
            毎日のごはんづくりを、
            <Box
              component="span"
              sx={{ display: { xs: "block", md: "inline" } }}
            >
              {" "}
              ひとつにつなげる。
            </Box>
          </Typography>

          <Typography
            sx={{
              fontSize: { xs: 14, md: 16 },
              lineHeight: 1.9,
              color: "text.primary",
              opacity: 0.72,
            }}
          >
            レシピを集めるところから、献立、買い物、冷蔵庫まで。
            <br />
            バラバラだったごはんづくりを、ひとつの流れにまとめます。
          </Typography>
        </Stack>

        <Stack spacing={{ xs: 10, md: 16 }}>
          {features.map((feature, index) => {
            const reverse = index % 2 === 1;

            return (
              <Box
                key={feature.number}
                sx={{
                  display: "flex",
                  flexDirection: {
                    xs: "column",
                    md: reverse ? "row-reverse" : "row",
                  },
                  alignItems: "center",
                  gap: { xs: 5, md: 10 },
                }}
              >
                <Box
                  sx={{
                    width: { xs: "100%", md: "45%" },
                  }}
                >
                  <Typography
                    sx={{
                      fontSize: 14,
                      fontWeight: 700,
                      color: "primary.main",
                      mb: 1.5,
                    }}
                  >
                    FEATURE {feature.number}
                  </Typography>

                  <Typography
                    component="h3"
                    sx={{
                      fontSize: { xs: 22, md: 28 },
                      fontWeight: 700,
                      lineHeight: 1.5,
                      color: "text.primary",
                      mb: 2,
                    }}
                  >
                    {feature.title}
                  </Typography>

                  <Typography
                    sx={{
                      fontSize: { xs: 15, md: 17 },
                      fontWeight: 600,
                      lineHeight: 1.8,
                      color: "text.primary",
                      mb: 2,
                    }}
                  >
                    {feature.lead}
                  </Typography>

                  <Typography
                    sx={{
                      fontSize: 14,
                      lineHeight: 2,
                      color: "text.primary",
                      opacity: 0.72,
                    }}
                  >
                    {feature.description}
                  </Typography>
                </Box>

                <Box
                  sx={{
                    width: { xs: "100%", md: "55%" },
                    minHeight: { xs: 300, md: 420 },
                    borderRadius: 4,
                    bgcolor: "secondary.main",
                    border: "1px solid",
                    borderColor: "divider",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    overflow: "hidden",
                  }}
                >
                  <Typography
                    sx={{
                      fontSize: 14,
                      fontWeight: 600,
                      color: "text.primary",
                      opacity: 0.45,
                    }}
                  >
                    {feature.imageLabel}
                  </Typography>
                </Box>
              </Box>
            );
          })}
        </Stack>
      </Box>
    </Box>
  );
}
