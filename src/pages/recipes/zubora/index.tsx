import { useRouter } from "next/router";
import { useEffect, useState } from "react";
import { onAuthStateChanged } from "firebase/auth";
import { Box, Button, Card, Chip, Stack, Typography } from "@mui/material";

import { auth } from "@/lib/firebase";
import { listZuboraSets } from "@/features/zuboraSets/repositories/zuboraSetRepository";
import { listRecipes } from "@/features/recipes/repositories/recipeRepo";
import type { ZuboraSet } from "@/features/zuboraSets/types";

export default function ZuboraSetListPage() {
  const router = useRouter();
  const [zuboraSets, setZuboraSets] = useState<ZuboraSet[]>([]);
  const [recipes, setRecipes] = useState<
    Awaited<ReturnType<typeof listRecipes>>
  >([]);
  const [loading, setLoading] = useState(true);
  const [selectedCategory, setSelectedCategory] = useState<
    "all" | "standard" | "quick" | "saving" | "other"
  >("all");

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (!user) {
        setZuboraSets([]);
        setLoading(false);
        return;
      }

      try {
        const [sets, recipeList] = await Promise.all([
          listZuboraSets(user.uid),
          listRecipes(user.uid),
        ]);

        setZuboraSets(sets);
        setRecipes(recipeList);
      } catch (error) {
        console.error("ズボラセット一覧の取得に失敗しました", error);
      } finally {
        setLoading(false);
      }
    });

    return unsubscribe;
  }, []);

  if (loading) {
    return <div>読み込み中...</div>;
  }
  const recipesById = Object.fromEntries(
    recipes.map((recipe) => [recipe.id, recipe]),
  );
  const filteredZuboraSets =
    selectedCategory === "all"
      ? zuboraSets
      : zuboraSets.filter((set) => set.category === selectedCategory);

  return (
    <Box
      component="main"
      sx={{
        maxWidth: 960,
        mx: "auto",
        px: { xs: 2, sm: 3 },
        py: 4,
      }}
    >
      <Stack spacing={3}>
        <Box>
          <Typography
            component="h1"
            sx={{
              fontSize: 24,
              fontWeight: 700,
              color: "#333333",
            }}
          >
            ズボラセット
          </Typography>

          <Typography
            sx={{
              mt: 0.8,
              fontSize: 14,
              color: "#666666",
            }}
          >
            よく使う1日分の献立をテンプレートとして保存できます。
          </Typography>
        </Box>

        <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
          <Chip
            label="すべて"
            onClick={() => setSelectedCategory("all")}
            variant={selectedCategory === "all" ? "filled" : "outlined"}
            sx={{
              bgcolor: selectedCategory === "all" ? "#FFF3E0" : "#FFFFFF",
              borderColor: "#F2C98C",
              color: "#333333",
              fontWeight: selectedCategory === "all" ? 700 : 500,
            }}
          />
          <Chip
            label="定番"
            onClick={() => setSelectedCategory("standard")}
            variant={selectedCategory === "standard" ? "filled" : "outlined"}
            sx={{
              bgcolor: selectedCategory === "standard" ? "#FFF3E0" : "#FFFFFF",
              borderColor: "#F2C98C",
              color: "#333333",
              fontWeight: selectedCategory === "standard" ? 700 : 500,
            }}
          />
          <Chip
            label="時短"
            onClick={() => setSelectedCategory("quick")}
            variant={selectedCategory === "quick" ? "filled" : "outlined"}
            sx={{
              bgcolor: selectedCategory === "quick" ? "#FFF3E0" : "#FFFFFF",
              borderColor: "#F2C98C",
              color: "#333333",
              fontWeight: selectedCategory === "quick" ? 700 : 500,
            }}
          />
          <Chip
            label="節約"
            onClick={() => setSelectedCategory("saving")}
            variant={selectedCategory === "saving" ? "filled" : "outlined"}
            sx={{
              bgcolor: selectedCategory === "saving" ? "#FFF3E0" : "#FFFFFF",
              borderColor: "#F2C98C",
              color: "#333333",
              fontWeight: selectedCategory === "saving" ? 700 : 500,
            }}
          />
          <Chip
            label="その他"
            onClick={() => setSelectedCategory("other")}
            variant={selectedCategory === "other" ? "filled" : "outlined"}
            sx={{
              bgcolor: selectedCategory === "other" ? "#FFF3E0" : "#FFFFFF",
              borderColor: "#F2C98C",
              color: "#333333",
              fontWeight: selectedCategory === "other" ? 700 : 500,
            }}
          />
        </Stack>

        {filteredZuboraSets.length === 0 ? (
          <Card
            sx={{
              p: 3,
              borderRadius: 3,
              textAlign: "center",
              boxShadow: "none",
              border: "1px solid #EEEEEE",
            }}
          >
            <Typography sx={{ color: "#666666" }}>
              {selectedCategory === "all"
                ? "ズボラセットはまだありません。"
                : "このカテゴリのズボラセットはありません。"}
            </Typography>
          </Card>
        ) : (
          <Stack spacing={2}>
            {filteredZuboraSets.map((set) => {
              const getMealRecipeNames = (
                meal: ZuboraSet["meals"]["breakfast"],
              ) =>
                Object.values(meal)
                  .filter(Boolean)
                  .map((recipeId) => {
                    const recipe = recipeId ? recipesById[recipeId] : null;
                    return recipe?.title || "料理名未設定";
                  });

              const breakfastNames = getMealRecipeNames(set.meals.breakfast);
              const lunchNames = getMealRecipeNames(set.meals.lunch);
              const dinnerNames = getMealRecipeNames(set.meals.dinner);

              const getMealImageUrl = (
                meal: ZuboraSet["meals"]["breakfast"],
              ) => {
                const firstRecipeId = Object.values(meal).find(Boolean);

                if (!firstRecipeId) {
                  return "/images/default-recipe.png";
                }

                return (
                  recipesById[firstRecipeId]?.imageUrl ||
                  "/images/default-recipe.png"
                );
              };

              const breakfastImage = getMealImageUrl(set.meals.breakfast);
              const lunchImage = getMealImageUrl(set.meals.lunch);
              const dinnerImage = getMealImageUrl(set.meals.dinner);

              const totalRecipeCount = Object.values(set.meals).reduce(
                (total, meal) =>
                  total + Object.values(meal).filter(Boolean).length,
                0,
              );

              return (
                <Card
                  key={set.id}
                  onClick={() => router.push(`/recipes/zubora/${set.id}`)}
                  sx={{
                    p: 2,
                    borderRadius: 3,
                    cursor: "pointer",
                    border: "1px solid #EEEEEE",
                    boxShadow: "0 4px 14px rgba(0,0,0,0.04)",
                    transition:
                      "transform 0.2s ease, box-shadow 0.2s ease, border-color 0.2s ease",
                    "&:hover": {
                      transform: "translateY(-2px)",
                      boxShadow: "0 8px 20px rgba(0,0,0,0.07)",
                      borderColor: "#F2C98C",
                    },
                  }}
                >
                  <Stack
                    direction="row"
                    alignItems="center"
                    justifyContent="space-between"
                    spacing={2}
                  >
                    <Stack
                      direction="row"
                      alignItems="center"
                      spacing={1}
                      sx={{ minWidth: 0 }}
                    >
                      <Typography
                        sx={{
                          fontSize: 17,
                          fontWeight: 700,
                          color: "#333333",
                        }}
                      >
                        {set.name}
                      </Typography>

                      <Chip
                        size="small"
                        label={
                          set.category === "standard"
                            ? "定番"
                            : set.category === "quick"
                              ? "時短"
                              : set.category === "saving"
                                ? "節約"
                                : "その他"
                        }
                        sx={{
                          bgcolor: "#FFF3E0",
                          color: "#D98300",
                          fontWeight: 700,
                        }}
                      />
                    </Stack>

                    <Typography
                      sx={{
                        flexShrink: 0,
                        fontSize: 12,
                        fontWeight: 700,
                        color: "#D98300",
                      }}
                    >
                      {totalRecipeCount}品
                    </Typography>
                  </Stack>

                  {set.description && (
                    <Typography
                      sx={{
                        mt: 0.8,
                        fontSize: 13,
                        color: "#666666",
                      }}
                    >
                      {set.description}
                    </Typography>
                  )}

                  <Stack
                    direction="row"
                    spacing={1}
                    sx={{
                      mt: 2,
                    }}
                  >
                    {[breakfastImage, lunchImage, dinnerImage].map(
                      (imageUrl, index) => (
                        <Box
                          key={`${set.id}-meal-image-${index}`}
                          component="img"
                          src={imageUrl}
                          alt={
                            index === 0 ? "朝食" : index === 1 ? "昼食" : "夕食"
                          }
                          sx={{
                            width: "calc((100% - 16px) / 3)",
                            aspectRatio: "16 / 9",
                            objectFit: "cover",
                            borderRadius: 2,
                          }}
                        />
                      ),
                    )}
                  </Stack>

                  <Stack spacing={0.8} sx={{ mt: 2 }}>
                    <Typography sx={{ fontSize: 13, color: "#555555" }}>
                      朝食　{breakfastNames.join("・") || "未登録"}
                    </Typography>

                    <Typography sx={{ fontSize: 13, color: "#555555" }}>
                      昼食　{lunchNames.join("・") || "未登録"}
                    </Typography>

                    <Typography sx={{ fontSize: 13, color: "#555555" }}>
                      夕食　{dinnerNames.join("・") || "未登録"}
                    </Typography>
                  </Stack>
                </Card>
              );
            })}
          </Stack>
        )}

        <Button
          variant="contained"
          onClick={() => router.push("/recipes/zubora/create")}
          sx={{
            py: 1.4,
            borderRadius: 3,
            bgcolor: "#FFB830",
            color: "#333333",
            fontWeight: 700,
            boxShadow: "none",
            "&:hover": {
              bgcolor: "#F5A900",
              boxShadow: "none",
            },
          }}
        >
          ＋ セットを作る
        </Button>
      </Stack>
    </Box>
  );
}
