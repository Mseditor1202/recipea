import { useEffect, useState } from "react";
import { useRouter } from "next/router";
import { onAuthStateChanged } from "firebase/auth";
import { createZuboraSet } from "@/features/zuboraSets/repositories/zuboraSetRepository";
import RecipeSelectionDrawer from "@/features/recipes/components/RecipeSelectionDrawer";
import MealRecipeGrid from "@/features/recipes/components/MealRecipeGrid";
import AppLayout from "@/components/layout/AppLayout";
import { listRecipes } from "@/features/recipes/repositories/recipeRepo";
import { Box, Button, Chip, Stack, TextField, Typography } from "@mui/material";
import { auth } from "@/lib/firebase";

const MEAL_ICON = {
  breakfast: "/icons/rakusuru/content/lg_content_breakfast_time.png",
  lunch: "/icons/rakusuru/content/lg_content_lunch_time.png",
  dinner: "/icons/rakusuru/content/lg_content_dinner_time.png",
};

export default function CreateZuboraSetPage() {
  const router = useRouter();

  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState<
    "standard" | "quick" | "saving" | "other"
  >("standard");
  const [tags, setTags] = useState<string[]>([]);
  const [tagInput, setTagInput] = useState("");
  const [saving, setSaving] = useState(false);
  const [meals, setMeals] = useState({
    breakfast: {
      staple: null as string | null,
      main: null as string | null,
      side: null as string | null,
      soup: null as string | null,
    },
    lunch: {
      staple: null as string | null,
      main: null as string | null,
      side: null as string | null,
      soup: null as string | null,
    },
    dinner: {
      staple: null as string | null,
      main: null as string | null,
      side: null as string | null,
      soup: null as string | null,
    },
  });
  const [selectionTarget, setSelectionTarget] = useState<{
    meal: "breakfast" | "lunch" | "dinner";
    slot: "staple" | "main" | "side" | "soup";
  } | null>(null);

  const [recipeSearchQuery, setRecipeSearchQuery] = useState("");
  const [recipes, setRecipes] = useState<
    Awaited<ReturnType<typeof listRecipes>>
  >([]);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (!user) {
        setRecipes([]);
        return;
      }

      try {
        const recipeList = await listRecipes(user.uid);
        setRecipes(recipeList);
      } catch (error) {
        console.error("レシピ一覧の取得に失敗しました", error);
        setRecipes([]);
      }
    });

    return unsubscribe;
  }, []);

  const recipesById = Object.fromEntries(
    recipes.map((recipe) => [recipe.id, recipe]),
  );

  const currentRecipeId = selectionTarget
    ? meals[selectionTarget.meal][selectionTarget.slot]
    : null;

  const hasAnyRecipe = Object.values(meals).some((meal) =>
    Object.values(meal).some(Boolean),
  );

  const handleAddTag = () => {
    const newTag = tagInput.trim();

    if (!newTag) {
      return;
    }

    if (tags.length >= 3) {
      return;
    }

    if (tags.includes(newTag)) {
      setTagInput("");
      return;
    }

    setTags((prev) => [...prev, newTag]);
    setTagInput("");
  };

  const handleSelectRecipe = async (recipeId: string) => {
    if (!selectionTarget) {
      return;
    }

    const { meal, slot } = selectionTarget;

    setMeals((prev) => ({
      ...prev,
      [meal]: {
        ...prev[meal],
        [slot]: recipeId,
      },
    }));

    setSelectionTarget(null);
    setRecipeSearchQuery("");
  };

  const handleSave = () => {
    setSaving(true);

    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      unsubscribe();

      if (!user) {
        setSaving(false);
        return;
      }

      try {
        const newId = await createZuboraSet({
          userId: user.uid,
          name: name.trim(),
          description: description.trim(),
          category,
          tags,
          meals,
        });

        await router.push(`/recipes/zubora/${newId}`);
      } catch (error) {
        console.error("ズボラセットの作成に失敗しました", error);
        setSaving(false);
      }
    });
  };

  return (
    <AppLayout
      title="ズボラセットを作る"
      backHref="/recipes/zubora"
      showBottomNavigation={false}
    >
      <Box
        sx={{
          maxWidth: 960,
          mx: "auto",
          px: { xs: 2, sm: 3 },
          py: { xs: 3, sm: 4 },
        }}
      >
        <TextField
          fullWidth
          required
          label="セット名"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="例：平日の定番セット"
          helperText={`${name.length}/30`}
          slotProps={{
            htmlInput: {
              maxLength: 30,
            },
            formHelperText: {
              sx: {
                textAlign: "right",
                mr: 0,
              },
            },
          }}
          sx={{ mb: 2 }}
        />

        <TextField
          fullWidth
          multiline
          minRows={3}
          label="説明"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="例：疲れた平日に使う定番セット"
          helperText={`${description.length}/200`}
          slotProps={{
            htmlInput: {
              maxLength: 200,
            },
            formHelperText: {
              sx: {
                textAlign: "right",
                mr: 0,
              },
            },
          }}
          sx={{ mb: 2 }}
        />

        <Box sx={{ mb: 2 }}>
          <Typography
            sx={{
              mb: 1,
              fontSize: 14,
              fontWeight: 700,
              color: "#333333",
            }}
          >
            カテゴリ
          </Typography>

          <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
            {[
              { value: "standard", label: "定番" },
              { value: "quick", label: "時短" },
              { value: "saving", label: "節約" },
              { value: "other", label: "その他" },
            ].map((item) => (
              <Chip
                key={item.value}
                label={item.label}
                clickable
                onClick={() =>
                  setCategory(
                    item.value as "standard" | "quick" | "saving" | "other",
                  )
                }
                sx={{
                  bgcolor: category === item.value ? "#FFF3E0" : "#ffffff",
                  color: category === item.value ? "#D98300" : "#555555",
                  border: "1px solid",
                  borderColor: category === item.value ? "#FFB830" : "#DDDDDD",
                  fontWeight: 700,
                }}
              />
            ))}
          </Stack>
        </Box>

        <Box sx={{ mb: 4 }}>
          <Stack
            direction={{ xs: "column", sm: "row" }}
            spacing={1}
            alignItems={{ xs: "stretch", sm: "flex-start" }}
          >
            <TextField
              fullWidth
              label="タグ(3つまで)"
              value={tagInput}
              onChange={(e) => setTagInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.nativeEvent.isComposing) {
                  return;
                }

                if (e.key === "Enter") {
                  e.preventDefault();
                  handleAddTag();
                }
              }}
              placeholder="例：家族向け"
              disabled={tags.length >= 3}
              helperText={`${tags.length}/3件`}
            />

            <Button
              type="button"
              variant="contained"
              onClick={handleAddTag}
              disabled={!tagInput.trim() || tags.length >= 3}
              sx={{
                minWidth: { xs: "100%", sm: 96 },
                height: 56,
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
              追加
            </Button>
          </Stack>

          {tags.length > 0 && (
            <Stack
              direction="row"
              spacing={1}
              flexWrap="wrap"
              useFlexGap
              sx={{ mt: 1.5 }}
            >
              {tags.map((tag) => (
                <Chip
                  key={tag}
                  label={tag}
                  onDelete={() =>
                    setTags((prev) => prev.filter((item) => item !== tag))
                  }
                  sx={{
                    bgcolor: "#FFF3E0",
                    color: "#8A5A00",
                    fontWeight: 700,
                  }}
                />
              ))}
            </Stack>
          )}
        </Box>

        <div>
          <Stack
            direction="row"
            spacing={1}
            alignItems="center"
            sx={{ mb: 1.5 }}
          >
            <Box
              component="img"
              src={MEAL_ICON.breakfast}
              alt=""
              sx={{
                width: 36,
                height: 36,
                objectFit: "contain",
              }}
            />

            <Typography
              component="h2"
              sx={{
                fontSize: 18,
                fontWeight: 700,
                color: "#333333",
              }}
            >
              朝食
            </Typography>
          </Stack>

          <MealRecipeGrid
            mealData={meals.breakfast}
            recipesById={recipesById}
            onSelectSlot={(slot) =>
              setSelectionTarget({
                meal: "breakfast",
                slot,
              })
            }
            onEditSlot={(slot) =>
              setSelectionTarget({
                meal: "breakfast",
                slot,
              })
            }
            onRemoveSlot={(slot) =>
              setMeals((prev) => ({
                ...prev,
                breakfast: {
                  ...prev.breakfast,
                  [slot]: null,
                },
              }))
            }
          />
        </div>

        <div>
          <Stack
            direction="row"
            spacing={1}
            alignItems="center"
            sx={{ mb: 1.5 }}
          >
            <Box
              component="img"
              src={MEAL_ICON.lunch}
              alt=""
              sx={{
                width: 36,
                height: 36,
                objectFit: "contain",
              }}
            />

            <Typography
              component="h2"
              sx={{
                fontSize: 18,
                fontWeight: 700,
                color: "#333333",
              }}
            >
              昼食
            </Typography>
          </Stack>

          <MealRecipeGrid
            mealData={meals.lunch}
            recipesById={recipesById}
            onSelectSlot={(slot) =>
              setSelectionTarget({
                meal: "lunch",
                slot,
              })
            }
            onEditSlot={(slot) =>
              setSelectionTarget({
                meal: "lunch",
                slot,
              })
            }
            onRemoveSlot={(slot) =>
              setMeals((prev) => ({
                ...prev,
                lunch: {
                  ...prev.lunch,
                  [slot]: null,
                },
              }))
            }
          />
        </div>

        <div>
          <Stack
            direction="row"
            spacing={1}
            alignItems="center"
            sx={{ mb: 1.5 }}
          >
            <Box
              component="img"
              src={MEAL_ICON.dinner}
              alt=""
              sx={{
                width: 36,
                height: 36,
                objectFit: "contain",
              }}
            />

            <Typography
              component="h2"
              sx={{
                fontSize: 18,
                fontWeight: 700,
                color: "#333333",
              }}
            >
              夕食
            </Typography>
          </Stack>

          <MealRecipeGrid
            mealData={meals.dinner}
            recipesById={recipesById}
            onSelectSlot={(slot) =>
              setSelectionTarget({
                meal: "dinner",
                slot,
              })
            }
            onEditSlot={(slot) =>
              setSelectionTarget({
                meal: "dinner",
                slot,
              })
            }
            onRemoveSlot={(slot) =>
              setMeals((prev) => ({
                ...prev,
                dinner: {
                  ...prev.dinner,
                  [slot]: null,
                },
              }))
            }
          />
        </div>

        <Button
          type="button"
          variant="contained"
          fullWidth
          onClick={handleSave}
          disabled={saving || !name.trim() || !hasAnyRecipe}
          sx={{
            mt: 4,
            py: 1.6,
            borderRadius: 3,
            bgcolor: "#FFB830",
            color: "#333333",
            fontSize: 16,
            fontWeight: 700,
            boxShadow: "none",
            "&:hover": {
              bgcolor: "#F5A900",
              boxShadow: "none",
            },
            "&.Mui-disabled": {
              bgcolor: "#E5E5E5",
              color: "#999999",
            },
          }}
        >
          {saving ? "作成中..." : "この内容で作成する"}
        </Button>

        <RecipeSelectionDrawer
          open={!!selectionTarget}
          mealLabel={
            selectionTarget?.meal === "breakfast"
              ? "朝食"
              : selectionTarget?.meal === "lunch"
                ? "昼食"
                : selectionTarget?.meal === "dinner"
                  ? "夕食"
                  : ""
          }
          selectedSlot={selectionTarget?.slot || "staple"}
          recipes={recipes}
          currentRecipeId={currentRecipeId}
          searchQuery={recipeSearchQuery}
          busy={saving}
          onClose={() => {
            setSelectionTarget(null);
            setRecipeSearchQuery("");
          }}
          onChangeSlot={(slot) => {
            if (!selectionTarget) {
              return;
            }

            setSelectionTarget({
              ...selectionTarget,
              slot,
            });
          }}
          onChangeSearchQuery={setRecipeSearchQuery}
          onSelectRecipe={handleSelectRecipe}
          onRemoveRecipe={() => {
            if (!selectionTarget) {
              return;
            }

            const { meal, slot } = selectionTarget;

            setMeals((prev) => ({
              ...prev,
              [meal]: {
                ...prev[meal],
                [slot]: null,
              },
            }));

            setSelectionTarget(null);
            setRecipeSearchQuery("");
          }}
        />
      </Box>
    </AppLayout>
  );
}
