import {
  Box,
  Button,
  Card,
  Drawer,
  Stack,
  TextField,
  Typography,
} from "@mui/material";

type SlotKey = "staple" | "main" | "side" | "soup";
const DEFAULT_IMAGE = "/images/default-recipe.png";

const SLOT_ORDER: SlotKey[] = ["staple", "main", "side", "soup"];

const SLOT_LABEL: Record<SlotKey, string> = {
  staple: "主食",
  main: "主菜",
  side: "副菜",
  soup: "汁物",
};

type RecipeLike = {
  id: string;
  title?: string;
  recipeName?: string;
  imageUrl?: string;
  category?: string;
};

type Props = {
  open: boolean;
  mealLabel: string;
  selectedSlot: SlotKey;
  recipes: RecipeLike[];
  currentRecipeId?: string | null;
  searchQuery: string;
  busy?: boolean;
  onClose: () => void;
  onChangeSlot: (slotKey: SlotKey) => void;
  onChangeSearchQuery: (value: string) => void;
  onSelectRecipe: (recipeId: string) => void;
  onRemoveRecipe?: () => void;
};

export default function RecipeSelectionDrawer({
  open,
  mealLabel,
  selectedSlot,
  recipes,
  currentRecipeId = null,
  searchQuery,
  busy = false,
  onClose,
  onChangeSlot,
  onChangeSearchQuery,
  onSelectRecipe,
  onRemoveRecipe,
}: Props) {
  const currentRecipe =
    recipes.find((recipe) => recipe.id === currentRecipeId) ?? null;

  const filteredRecipes = recipes.filter((recipe) => {
    const query = searchQuery.trim().toLowerCase();

    const matchesSlot = recipe.category === selectedSlot;

    const matchesSearch = query
      ? (recipe.title || recipe.recipeName || "").toLowerCase().includes(query)
      : true;

    return matchesSlot && matchesSearch;
  });
  return (
    <Drawer anchor="right" open={open} onClose={onClose}>
      <Box
        sx={{
          width: { xs: "100vw", sm: 420 },
          maxWidth: "100vw",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          bgcolor: "#FFFDFA",
        }}
      >
        <Box
          sx={{
            px: 2.5,
            py: 2,
            borderBottom: "1px solid #EEEEEE",
            bgcolor: "#FFFFFF",
          }}
        >
          <Stack
            direction="row"
            alignItems="center"
            justifyContent="space-between"
            spacing={2}
          >
            <Box>
              <Typography
                component="h2"
                sx={{
                  fontSize: 18,
                  fontWeight: 700,
                  color: "#333333",
                }}
              >
                献立を編集
              </Typography>

              <Box
                sx={{
                  mt: 1.2,
                  px: 1.5,
                  py: 1.1,
                  borderRadius: 2.5,
                  bgcolor: "#FFF3E0",
                  display: "flex",
                  alignItems: "center",
                  gap: 1,
                }}
              >
                <Typography
                  sx={{
                    fontSize: 14,
                    fontWeight: 700,
                    color: "#333333",
                  }}
                >
                  {mealLabel} / {SLOT_LABEL[selectedSlot]}
                </Typography>
              </Box>
            </Box>

            <Button
              type="button"
              onClick={onClose}
              sx={{
                minWidth: "auto",
                color: "#777777",
                textTransform: "none",
              }}
            >
              閉じる
            </Button>
          </Stack>
        </Box>

        <Box
          sx={{
            flex: 1,
            overflowY: "auto",
            p: 2.5,
          }}
        >
          <Stack spacing={2}>
            {currentRecipe && (
              <Box>
                <Typography
                  sx={{
                    mb: 1,
                    fontSize: 14,
                    fontWeight: 700,
                    color: "#333333",
                  }}
                >
                  現在のレシピ
                </Typography>

                <Card
                  sx={{
                    borderRadius: 3,
                    border: "1px solid #F1E6D7",
                    boxShadow: "0 4px 12px rgba(0,0,0,0.04)",
                    bgcolor: "#FFFFFF",
                  }}
                >
                  <Stack
                    direction="row"
                    alignItems="center"
                    spacing={1.5}
                    sx={{ p: 1.5 }}
                  >
                    <Box
                      component="img"
                      src={currentRecipe.imageUrl || DEFAULT_IMAGE}
                      alt={
                        currentRecipe.title ||
                        currentRecipe.recipeName ||
                        "料理画像"
                      }
                      sx={{
                        width: 72,
                        height: 72,
                        borderRadius: 2,
                        objectFit: "cover",
                        flexShrink: 0,
                        bgcolor: "#F7F7F7",
                      }}
                    />

                    <Box sx={{ flex: 1, minWidth: 0 }}>
                      <Typography
                        sx={{
                          fontSize: 15,
                          fontWeight: 700,
                          color: "#333333",
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                          whiteSpace: "nowrap",
                        }}
                      >
                        {currentRecipe.title ||
                          currentRecipe.recipeName ||
                          "料理名未設定"}
                      </Typography>

                      <Box
                        sx={{
                          mt: 0.8,
                          display: "inline-flex",
                          alignItems: "center",
                          px: 1,
                          py: 0.35,
                          borderRadius: 999,
                          bgcolor: "#FFF3E0",
                          color: "#D98300",
                          fontSize: 11,
                          fontWeight: 700,
                        }}
                      >
                        選択中
                      </Box>
                    </Box>

                    {onRemoveRecipe && (
                      <Button
                        type="button"
                        variant="outlined"
                        disabled={busy}
                        onClick={onRemoveRecipe}
                        sx={{
                          minWidth: "auto",
                          px: 1.8,
                          py: 0.9,
                          borderRadius: 2,
                          borderColor: "#D9D9D9",
                          bgcolor: "#FFFFFF",
                          color: "#666666",
                          textTransform: "none",
                          fontSize: 13,
                          fontWeight: 700,
                        }}
                      >
                        献立から外す
                      </Button>
                    )}
                  </Stack>
                </Card>
              </Box>
            )}

            <Stack direction="row" spacing={1} flexWrap="wrap">
              {SLOT_ORDER.map((slotKey) => (
                <Button
                  key={slotKey}
                  type="button"
                  variant={selectedSlot === slotKey ? "contained" : "outlined"}
                  onClick={() => onChangeSlot(slotKey)}
                  sx={{
                    minWidth: 72,
                    borderRadius: 999,
                    textTransform: "none",
                    fontWeight: 700,
                  }}
                >
                  {SLOT_LABEL[slotKey]}
                </Button>
              ))}
            </Stack>

            <TextField
              fullWidth
              size="small"
              value={searchQuery}
              onChange={(e) => onChangeSearchQuery(e.target.value)}
              placeholder="レシピを検索"
              sx={{
                "& .MuiOutlinedInput-root": {
                  borderRadius: 2.5,
                  bgcolor: "#FFFFFF",
                  fontSize: 14,
                },
              }}
            />

            <Typography
              sx={{
                fontSize: 16,
                fontWeight: 700,
                color: "#333333",
              }}
            >
              レシピを選ぶ
            </Typography>

            <Stack spacing={1}>
              {filteredRecipes.map((recipe) => {
                const isSelected = recipe.id === currentRecipeId;

                return (
                  <Button
                    key={recipe.id}
                    type="button"
                    variant="outlined"
                    onClick={() => onSelectRecipe(recipe.id)}
                    disabled={busy}
                    sx={{
                      justifyContent: "flex-start",
                      textTransform: "none",
                      borderRadius: 3,
                      color: "#333333",
                      borderColor: isSelected ? "#FFB830" : "#E8E8E8",
                      borderWidth: isSelected ? 2 : 1,
                      py: 1,
                      px: 1.2,
                      bgcolor: isSelected ? "#FFF8ED" : "#FFFFFF",
                    }}
                  >
                    <Stack
                      direction="row"
                      spacing={1.2}
                      alignItems="center"
                      sx={{ width: "100%" }}
                    >
                      <Box
                        component="img"
                        src={recipe.imageUrl || DEFAULT_IMAGE}
                        alt={recipe.title || recipe.recipeName || "料理画像"}
                        sx={{
                          width: 72,
                          height: 72,
                          borderRadius: 2,
                          objectFit: "cover",
                          flexShrink: 0,
                          bgcolor: "#F7F7F7",
                        }}
                      />

                      <Box sx={{ flex: 1, minWidth: 0, textAlign: "left" }}>
                        <Typography
                          sx={{
                            fontSize: 15,
                            fontWeight: 700,
                            color: "#333333",
                            lineHeight: 1.4,
                            overflow: "hidden",
                            textOverflow: "ellipsis",
                            whiteSpace: "nowrap",
                          }}
                        >
                          {recipe.title || recipe.recipeName || "料理名未設定"}
                        </Typography>
                      </Box>

                      {isSelected && (
                        <Box
                          sx={{
                            ml: 1,
                            display: "inline-flex",
                            alignItems: "center",
                            px: 1.2,
                            py: 0.45,
                            borderRadius: 999,
                            bgcolor: "#FFB830",
                            color: "#FFFFFF",
                            fontSize: 12,
                            fontWeight: 700,
                            flexShrink: 0,
                          }}
                        >
                          選択中
                        </Box>
                      )}
                    </Stack>
                  </Button>
                );
              })}
            </Stack>
          </Stack>
        </Box>
      </Box>
    </Drawer>
  );
}
