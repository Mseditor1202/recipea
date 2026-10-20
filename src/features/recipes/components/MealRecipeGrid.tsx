import { Box, Card, Grid, Skeleton, Typography } from "@mui/material";

const DEFAULT_IMAGE = "/images/default-recipe.png";

const SLOT_ORDER: SlotKey[] = ["staple", "main", "side", "soup"];

const SLOT_LABEL: Record<SlotKey, string> = {
  staple: "主食",
  main: "主菜",
  side: "副菜",
  soup: "汁物",
};

type SlotKey = "staple" | "main" | "side" | "soup";

type MealData = {
  staple?: string | null;
  main?: string | null;
  side?: string | null;
  soup?: string | null;
};

type RecipeLike = {
  id: string;
  title?: string;
  recipeName?: string;
  imageUrl?: string;
};

type Props = {
  mealData: MealData;
  recipesById: Record<string, RecipeLike>;
  loading?: boolean;
  onSelectSlot?: (slotKey: SlotKey) => void;
  onRecipeClick?: (recipeId: string) => void;
  onEditSlot?: (slotKey: SlotKey) => void;
  onRemoveSlot?: (slotKey: SlotKey) => void;
};

export default function MealRecipeGrid({
  mealData,
  recipesById,
  loading = false,
  onSelectSlot,
  onRecipeClick,
  onEditSlot,
  onRemoveSlot,
}: Props) {
  return (
    <Grid container spacing={2}>
      {SLOT_ORDER.map((slotKey) => {
        const recipeId = mealData?.[slotKey] || null;
        const recipe = recipeId ? recipesById?.[recipeId] : null;

        if (loading) {
          return (
            <Grid size={{ xs: 12, sm: 3 }} key={slotKey}>
              <Box sx={{ borderRadius: 2.6, overflow: "hidden" }}>
                <Skeleton variant="rectangular" height={150} />
                <Box sx={{ p: 1.4 }}>
                  <Skeleton width="40%" />
                  <Skeleton width="80%" />
                </Box>
              </Box>
            </Grid>
          );
        }

        if (!recipeId || !recipe) {
          return (
            <Grid size={{ xs: 12, sm: 3 }} key={slotKey}>
              <Box
                component={onSelectSlot ? "button" : "div"}
                type={onSelectSlot ? "button" : undefined}
                onClick={onSelectSlot ? () => onSelectSlot(slotKey) : undefined}
                sx={{
                  width: "100%",
                  minHeight: 150,
                  border: "1px dashed #F2C98C",
                  borderRadius: 3,
                  bgcolor: "#FFFDFA",
                  cursor: onSelectSlot ? "pointer" : "default",
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: 1,
                  color: onSelectSlot ? "#D98300" : "#777777",
                }}
              >
                {onSelectSlot ? (
                  <>
                    <Typography
                      component="span"
                      sx={{
                        fontSize: 24,
                        lineHeight: 1,
                      }}
                    >
                      ＋
                    </Typography>

                    <Typography
                      component="span"
                      sx={{
                        fontSize: 13,
                        fontWeight: 700,
                      }}
                    >
                      {SLOT_LABEL[slotKey]}を選ぶ
                    </Typography>
                  </>
                ) : (
                  <Typography
                    component="span"
                    sx={{
                      fontSize: 13,
                      fontWeight: 700,
                    }}
                  >
                    <>
                      <Typography
                        component="span"
                        sx={{
                          fontSize: 12,
                          fontWeight: 700,
                          color: "#555555",
                        }}
                      >
                        {SLOT_LABEL[slotKey]}
                      </Typography>

                      <Typography
                        component="span"
                        sx={{
                          fontSize: 12,
                          color: "#999999",
                        }}
                      >
                        ：未登録
                      </Typography>
                    </>
                  </Typography>
                )}
              </Box>
            </Grid>
          );
        }

        const name = recipe.title || recipe.recipeName || "料理名未設定";
        const img = recipe.imageUrl || DEFAULT_IMAGE;

        return (
          <Grid size={{ xs: 12, sm: 3 }} key={slotKey}>
            <Card
              onClick={() => onRecipeClick?.(recipeId)}
              sx={{
                borderRadius: 2.6,
                border: "1px solid #e7ebf3",
                overflow: "hidden",
                bgcolor: "#fff",
                boxShadow: "0 10px 18px rgba(15, 23, 42, 0.06)",
                cursor: onRecipeClick ? "pointer" : "default",
                transition: "transform 120ms ease",
                "&:hover": onRecipeClick
                  ? {
                      transform: "translateY(-2px)",
                    }
                  : {},
              }}
            >
              <Box sx={{ position: "relative" }}>
                <Box
                  component="img"
                  src={img}
                  alt={name}
                  sx={{
                    width: "100%",
                    height: { xs: 130, sm: 130 },
                    objectFit: "cover",
                  }}
                />

                <Box
                  sx={{
                    position: "absolute",
                    top: 10,
                    left: 10,
                    px: 1.6,
                    py: 0.65,
                    borderRadius: 999,
                    bgcolor: "rgba(255,255,255,0.96)",
                    border: "1px solid rgba(0,0,0,0.08)",
                    fontWeight: 700,
                    fontSize: 13,
                  }}
                >
                  {SLOT_LABEL[slotKey]}
                </Box>
              </Box>

              <Box
                sx={{
                  px: 1.6,
                  py: 1,
                  bgcolor: "#fff",
                  borderTop: "1px solid #eef1f6",
                }}
              >
                <Typography
                  sx={{
                    fontWeight: 500,
                    fontSize: 16,
                    whiteSpace: "nowrap",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                  }}
                  title={name}
                >
                  {name}
                </Typography>
                {onEditSlot && (
                  <Box
                    component="button"
                    type="button"
                    onClick={(event) => {
                      event.stopPropagation();
                      onEditSlot(slotKey);
                    }}
                    sx={{
                      mt: 1,
                      mr: 1.5,
                      border: "none",
                      bgcolor: "transparent",
                      color: "#D98300",
                      fontSize: 12,
                      fontWeight: 700,
                      cursor: "pointer",
                      p: 0,
                    }}
                  >
                    変更
                  </Box>
                )}
                {onRemoveSlot && (
                  <Box
                    component="button"
                    type="button"
                    onClick={(event) => {
                      event.stopPropagation();
                      onRemoveSlot(slotKey);
                    }}
                    sx={{
                      mt: 1,
                      border: "none",
                      bgcolor: "transparent",
                      color: "#777777",
                      fontSize: 12,
                      cursor: "pointer",
                      p: 0,
                    }}
                  >
                    外す
                  </Box>
                )}
              </Box>
            </Card>
          </Grid>
        );
      })}
    </Grid>
  );
}
