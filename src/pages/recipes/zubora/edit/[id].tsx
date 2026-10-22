import { useEffect, useState } from "react";
import { useRouter } from "next/router";
import { onAuthStateChanged } from "firebase/auth";

import { auth } from "@/lib/firebase";
import {
  getZuboraSet,
  updateZuboraSet,
  deleteZuboraSet,
} from "@/features/zuboraSets/repositories/zuboraSetRepository";
import {
  Box,
  Button,
  Chip,
  Snackbar,
  Stack,
  TextField,
  Typography,
  Dialog,
  DialogActions,
  DialogContent,
  DialogContentText,
  DialogTitle,
} from "@mui/material";
import type { ZuboraSet } from "@/features/zuboraSets/types";
import MealRecipeGrid from "@/features/recipes/components/MealRecipeGrid";
import RecipeSelectionDrawer from "@/features/recipes/components/RecipeSelectionDrawer";
import AppLayout from "@/components/layout/AppLayout";
import { listRecipes } from "@/features/recipes/repositories/recipeRepo";

export default function ZuboraSetEditPage() {
  const router = useRouter();
  const { id } = router.query;

  const [zuboraSet, setZuboraSet] = useState<ZuboraSet | null>(null);
  const [initialZuboraSet, setInitialZuboraSet] = useState<ZuboraSet | null>(
    null,
  );
  const [loading, setLoading] = useState(true);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [tags, setTags] = useState<string[]>([]);
  const [tagInput, setTagInput] = useState("");
  const [category, setCategory] = useState<
    "standard" | "quick" | "saving" | "other"
  >("standard");
  const [saving, setSaving] = useState(false);
  const [snackbarOpen, setSnackbarOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [leaveDialogOpen, setLeaveDialogOpen] = useState(false);
  const [mealEditTarget, setMealEditTarget] = useState<{
    meal: "breakfast" | "lunch" | "dinner";
    slot: "staple" | "main" | "side" | "soup";
  } | null>(null);

  const [recipeSearchQuery, setRecipeSearchQuery] = useState("");
  const [recipes, setRecipes] = useState<
    Awaited<ReturnType<typeof listRecipes>>
  >([]);

  const recipesById = Object.fromEntries(
    recipes.map((recipe) => [recipe.id, recipe]),
  );
  const hasAtLeastOneRecipe = zuboraSet
    ? Object.values(zuboraSet.meals).some((meal) =>
        Object.values(meal).some((recipeId) => Boolean(recipeId)),
      )
    : false;

  const currentRecipeId = mealEditTarget
    ? zuboraSet?.meals[mealEditTarget.meal]?.[mealEditTarget.slot] || null
    : null;

  const isDirty =
    !!initialZuboraSet &&
    !!zuboraSet &&
    (name !== initialZuboraSet.name ||
      description !== (initialZuboraSet.description ?? "") ||
      category !== initialZuboraSet.category ||
      JSON.stringify(tags) !== JSON.stringify(initialZuboraSet.tags ?? []) ||
      JSON.stringify(zuboraSet.meals) !==
        JSON.stringify(initialZuboraSet.meals));

  useEffect(() => {
    if (!router.isReady || typeof id !== "string") {
      return;
    }

    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (!user) {
        setLoading(false);
        return;
      }

      try {
        const [data, recipeList] = await Promise.all([
          getZuboraSet(id, user.uid),
          listRecipes(user.uid),
        ]);

        setZuboraSet(data);
        setInitialZuboraSet(data);
        setRecipes(recipeList);
        if (data) {
          setName(data.name);
          setDescription(data.description ?? "");
          setTags(data.tags ?? []);
          setCategory(data.category);
        }
      } catch (error) {
        console.error("ズボラセットの取得に失敗しました", error);
      } finally {
        setLoading(false);
      }
    });

    return unsubscribe;
  }, [router.isReady, id]);

  const handleAddTag = () => {
    const value = tagInput.trim();

    if (!value || tags.includes(value) || tags.length >= 3) {
      return;
    }

    setTags((prev) => [...prev, value]);
    setTagInput("");
  };

  const handleSave = async () => {
    if (typeof id !== "string") {
      return;
    }

    const user = auth.currentUser;

    if (!user || !zuboraSet || !name.trim() || !hasAtLeastOneRecipe) {
      return;
    }

    setSaving(true);

    try {
      await updateZuboraSet(id, user.uid, {
        name: name.trim(),
        description: description.trim(),
        tags,
        category,
        meals: zuboraSet.meals,
      });

      const savedZuboraSet: ZuboraSet = {
        ...zuboraSet,
        name: name.trim(),
        description: description.trim(),
        tags,
        category,
        meals: zuboraSet.meals,
      };

      setZuboraSet(savedZuboraSet);
      setInitialZuboraSet(savedZuboraSet);
      setSnackbarOpen(true);
    } catch (error) {
      console.error("ズボラセットの更新に失敗しました", error);
    } finally {
      setSaving(false);
    }
  };

  const handleClearRecipeSlot = (
    meal: "breakfast" | "lunch" | "dinner",
    slot: "staple" | "main" | "side" | "soup",
  ) => {
    setZuboraSet((prev) =>
      prev
        ? {
            ...prev,
            meals: {
              ...prev.meals,
              [meal]: {
                ...prev.meals[meal],
                [slot]: null,
              },
            },
          }
        : prev,
    );

    setMealEditTarget(null);
  };
  const handleSelectRecipe = (recipeId: string) => {
    if (!mealEditTarget || !recipeId || !zuboraSet) {
      return;
    }

    setZuboraSet((prev) =>
      prev
        ? {
            ...prev,
            meals: {
              ...prev.meals,
              [mealEditTarget.meal]: {
                ...prev.meals[mealEditTarget.meal],
                [mealEditTarget.slot]: recipeId,
              },
            },
          }
        : prev,
    );

    setMealEditTarget(null);
  };

  const handleBack = () => {
    if (isDirty) {
      setLeaveDialogOpen(true);
      return;
    }

    router.push(`/recipes/zubora/${zuboraSet?.id}`);
  };

  const handleDelete = async () => {
    if (typeof id !== "string") {
      return;
    }

    try {
      await deleteZuboraSet(id);
      setDeleteDialogOpen(false);
      await router.push("/recipes/zubora");
    } catch (error) {
      console.error("ズボラセットの削除に失敗しました", error);
    }
  };

  if (loading) {
    return <div>読み込み中...</div>;
  }

  if (!zuboraSet) {
    return <div>ズボラセットが見つかりません。</div>;
  }

  return (
    <AppLayout
      title="ズボラセットを編集"
      backHref={`/recipes/zubora/${zuboraSet.id}`}
      onBack={handleBack}
      activeNav="recipes"
      showBottomNavigation={false}
    >
      <Box
        sx={{
          maxWidth: 960,
          mx: "auto",
          px: { xs: 2, sm: 3 },
          py: 4,
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
          placeholder="このセットを使う場面や特徴を書いておくと便利です"
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
          sx={{ mb: 3 }}
        />
        <Box sx={{ mb: 3 }}>
          <Typography
            component="p"
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
            ].map((item) => {
              const selected = category === item.value;

              return (
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
                    bgcolor: selected ? "#FFF3E0" : "#FFFFFF",
                    color: "#333333",
                    fontWeight: selected ? 700 : 400,
                    border: selected
                      ? "1px solid #FFB830"
                      : "1px solid #E0E0E0",
                  }}
                />
              );
            })}
          </Stack>
        </Box>
        <Box sx={{ mb: 4 }}>
          <Typography
            component="p"
            sx={{
              mb: 1,
              fontSize: 14,
              fontWeight: 700,
              color: "#333333",
            }}
          >
            タグ（3つまで）
          </Typography>

          <Stack
            direction={{ xs: "column", sm: "row" }}
            spacing={1}
            alignItems={{ xs: "stretch", sm: "flex-start" }}
          >
            <TextField
              fullWidth
              value={tagInput}
              onChange={(e) => setTagInput(e.target.value)}
              placeholder="例：平日"
              disabled={tags.length >= 3}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.nativeEvent.isComposing) {
                  e.preventDefault();
                  handleAddTag();
                }
              }}
            />

            <Button
              type="button"
              variant="outlined"
              onClick={handleAddTag}
              disabled={!tagInput.trim() || tags.length >= 3}
              sx={{
                minWidth: { xs: "100%", sm: 96 },
                height: 56,
                borderRadius: 3,
                borderColor: "#FFB830",
                color: "#333333",
                fontWeight: 700,
                "&:hover": {
                  borderColor: "#F5A900",
                  bgcolor: "#FFF8EC",
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
                  onDelete={() => {
                    setTags((prev) => prev.filter((item) => item !== tag));
                  }}
                />
              ))}
            </Stack>
          )}
        </Box>

        <Stack
          direction="row"
          alignItems="center"
          spacing={1}
          sx={{ mb: 2, mt: 1 }}
        >
          <Box
            component="img"
            src="/icons/rakusuru/content/lg_content_breakfast_time.png"
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
          mealData={zuboraSet.meals.breakfast}
          recipesById={recipesById}
          onSelectSlot={(slotKey) => {
            setMealEditTarget({
              meal: "breakfast",
              slot: slotKey,
            });
          }}
          onEditSlot={(slotKey) => {
            setMealEditTarget({
              meal: "breakfast",
              slot: slotKey,
            });
          }}
          onRecipeClick={(recipeId) => {
            const back = router.asPath;

            router.push(
              `/recipes/${recipeId}?back=${encodeURIComponent(back)}`,
            );
          }}
          onRemoveSlot={(slotKey) => {
            handleClearRecipeSlot("breakfast", slotKey);
          }}
        />
        <Stack
          direction="row"
          alignItems="center"
          spacing={1}
          sx={{ mb: 2, mt: 4 }}
        >
          <Box
            component="img"
            src="/icons/rakusuru/content/lg_content_lunch_time.png"
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
          mealData={zuboraSet.meals.lunch}
          recipesById={recipesById}
          onSelectSlot={(slotKey) => {
            setMealEditTarget({
              meal: "lunch",
              slot: slotKey,
            });
          }}
          onEditSlot={(slotKey) => {
            setMealEditTarget({
              meal: "lunch",
              slot: slotKey,
            });
          }}
          onRecipeClick={(recipeId) => {
            const back = router.asPath;

            router.push(
              `/recipes/${recipeId}?back=${encodeURIComponent(back)}`,
            );
          }}
          onRemoveSlot={(slotKey) => {
            handleClearRecipeSlot("lunch", slotKey);
          }}
        />
        <Stack
          direction="row"
          alignItems="center"
          spacing={1}
          sx={{ mb: 2, mt: 4 }}
        >
          <Box
            component="img"
            src="/icons/rakusuru/content/lg_content_dinner_time.png"
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
          mealData={zuboraSet.meals.dinner}
          recipesById={recipesById}
          onSelectSlot={(slotKey) => {
            setMealEditTarget({
              meal: "dinner",
              slot: slotKey,
            });
          }}
          onEditSlot={(slotKey) => {
            setMealEditTarget({
              meal: "dinner",
              slot: slotKey,
            });
          }}
          onRecipeClick={(recipeId) => {
            const back = router.asPath;

            router.push(
              `/recipes/${recipeId}?back=${encodeURIComponent(back)}`,
            );
          }}
          onRemoveSlot={(slotKey) => {
            handleClearRecipeSlot("dinner", slotKey);
          }}
        />
        {!hasAtLeastOneRecipe && (
          <Typography
            sx={{
              mt: 3,
              fontSize: 13,
              color: "#F44336",
            }}
          >
            レシピを1件以上登録してください。
          </Typography>
        )}

        <Stack spacing={2} sx={{ mt: 4 }}>
          <Button
            type="button"
            variant="contained"
            fullWidth
            onClick={handleSave}
            disabled={
              saving || !isDirty || !name.trim() || !hasAtLeastOneRecipe
            }
            sx={{
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
            {saving ? "保存中..." : "変更を保存する"}
          </Button>

          <Button
            type="button"
            variant="outlined"
            fullWidth
            onClick={() => setDeleteDialogOpen(true)}
            sx={{
              py: 1.4,
              borderRadius: 3,
              borderColor: "#F44336",
              color: "#F44336",
              fontSize: 14,
              fontWeight: 700,
              "&:hover": {
                borderColor: "#D32F2F",
                bgcolor: "#FFF5F5",
              },
            }}
          >
            このズボラセットを削除する
          </Button>
        </Stack>

        <RecipeSelectionDrawer
          open={!!mealEditTarget}
          mealLabel={
            mealEditTarget
              ? mealEditTarget.meal === "breakfast"
                ? "朝"
                : mealEditTarget.meal === "lunch"
                  ? "昼"
                  : "夜"
              : ""
          }
          selectedSlot={mealEditTarget?.slot ?? "staple"}
          recipes={recipes}
          currentRecipeId={currentRecipeId}
          searchQuery={recipeSearchQuery}
          onClose={() => setMealEditTarget(null)}
          onChangeSlot={(slotKey) => {
            setMealEditTarget((prev) =>
              prev
                ? {
                    ...prev,
                    slot: slotKey,
                  }
                : prev,
            );
          }}
          onChangeSearchQuery={setRecipeSearchQuery}
          onSelectRecipe={handleSelectRecipe}
          onRemoveRecipe={() => {
            if (!mealEditTarget) {
              return;
            }

            handleClearRecipeSlot(mealEditTarget.meal, mealEditTarget.slot);
          }}
        />
        <Snackbar
          open={snackbarOpen}
          autoHideDuration={3000}
          onClose={() => setSnackbarOpen(false)}
          message="変更を保存しました"
          anchorOrigin={{
            vertical: "bottom",
            horizontal: "center",
          }}
        />

        <Dialog
          open={leaveDialogOpen}
          onClose={() => setLeaveDialogOpen(false)}
        >
          <DialogTitle>変更内容を破棄しますか？</DialogTitle>

          <DialogContent>
            <DialogContentText>
              保存していない変更があります。このまま戻ると変更内容は失われます。
            </DialogContentText>
          </DialogContent>

          <DialogActions sx={{ px: 3, pb: 2 }}>
            <Button
              type="button"
              onClick={() => setLeaveDialogOpen(false)}
              sx={{
                color: "#666666",
                fontWeight: 700,
              }}
            >
              編集を続ける
            </Button>

            <Button
              type="button"
              variant="contained"
              onClick={() => {
                setLeaveDialogOpen(false);
                router.push(`/recipes/zubora/${zuboraSet.id}`);
              }}
              sx={{
                bgcolor: "#F44336",
                color: "#FFFFFF",
                fontWeight: 700,
                boxShadow: "none",
                "&:hover": {
                  bgcolor: "#D32F2F",
                  boxShadow: "none",
                },
              }}
            >
              破棄して戻る
            </Button>
          </DialogActions>
        </Dialog>

        <Dialog
          open={deleteDialogOpen}
          onClose={() => setDeleteDialogOpen(false)}
        >
          <DialogTitle>ズボラセットを削除しますか？</DialogTitle>

          <DialogContent>
            <DialogContentText>この操作は取り消せません。</DialogContentText>
          </DialogContent>

          <DialogActions sx={{ px: 3, pb: 2 }}>
            <Button
              type="button"
              onClick={() => setDeleteDialogOpen(false)}
              sx={{
                color: "#666666",
                fontWeight: 700,
              }}
            >
              キャンセル
            </Button>

            <Button
              type="button"
              onClick={handleDelete}
              variant="contained"
              sx={{
                bgcolor: "#F44336",
                color: "#FFFFFF",
                fontWeight: 700,
                boxShadow: "none",
                "&:hover": {
                  bgcolor: "#D32F2F",
                  boxShadow: "none",
                },
              }}
            >
              削除する
            </Button>
          </DialogActions>
        </Dialog>
      </Box>
    </AppLayout>
  );
}
