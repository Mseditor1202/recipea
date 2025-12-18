// pages/recipes/index.jsx
import React, { useEffect, useMemo, useState } from "react";
import {
  collection,
  getDocs,
  doc,
  setDoc,
  serverTimestamp,
} from "firebase/firestore";
import { db, auth } from "@/lib/firebase";
import { useRouter } from "next/router";
import RecipeImage from "@/components/recipes/RecipeImage";

import {
  Box,
  Grid,
  Card,
  CardContent,
  CardActions,
  Typography,
  Button,
  Chip,
  TextField,
  Stack,
  Alert,
} from "@mui/material";

/**
 * URLクエリでの利用モード
 * 1) 通常: /recipes
 * 2) weeklyDayセット用:
 *    /recipes?mode=weeklyDay&dayKey=YYYY-MM-DD&meal=breakfast&slot=main
 * 3) dailySet編集用（新）:
 *    /recipes?mode=dailySet&slot=mainDish&dailySetId=xxx
 * 4) dailyMeal編集用（旧・互換）:
 *    /recipes?mode=dailyMeal&meal=breakfast&slot=mainDish&dailySetId=xxx
 */

// slot param の揺れ（mainDish/sideDish etc）を weeklyDaySets のキーへ正規化
function normalizeWeeklySlot(slot) {
  if (!slot) return "";
  const s = String(slot);

  // weeklyDaySets は staple/main/side/soup
  if (s === "staple" || s === "main" || s === "side" || s === "soup") return s;

  // 旧表現
  if (s === "mainDish") return "main";
  if (s === "sideDish") return "side";

  // それっぽい文字列も救う
  const lower = s.toLowerCase();
  if (lower.includes("staple")) return "staple";
  if (lower.includes("main")) return "main";
  if (lower.includes("side")) return "side";
  if (lower.includes("soup")) return "soup";

  return s;
}

// recipes.category の揺れ（mainDish など）を正規化
function normalizeRecipeCategory(cat) {
  if (!cat) return "";
  const c = String(cat).toLowerCase();

  if (c === "staple") return "staple";
  if (c === "main" || c === "maindish" || c === "main_dish") return "main";
  if (c === "side" || c === "sidedish" || c === "side_dish") return "side";
  if (c === "soup") return "soup";

  if (c.includes("staple")) return "staple";
  if (c.includes("main")) return "main";
  if (c.includes("side")) return "side";
  if (c.includes("soup")) return "soup";

  return c;
}

const categoryLabels = {
  staple: "主食",
  main: "主菜",
  side: "副菜",
  soup: "汁物",
};

const mealLabels = {
  breakfast: "朝",
  lunch: "昼",
  dinner: "夜",
};

export default function RecipesPage() {
  const router = useRouter();

  const [recipes, setRecipes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchText, setSearchText] = useState("");

  // クエリ（router.isReady を前提に扱う）
  const query = router.query;
  const mode = query.mode;

  // ✅ weeklyDay モード
  const isWeeklyDayMode =
    router.isReady &&
    mode === "weeklyDay" &&
    query.dayKey &&
    query.meal &&
    query.slot;

  const weeklyDayKey = isWeeklyDayMode ? String(query.dayKey) : null; // YYYY-MM-DD
  const weeklyMealKey = isWeeklyDayMode ? String(query.meal) : null; // breakfast/lunch/dinner
  const weeklySlotKey = isWeeklyDayMode
    ? normalizeWeeklySlot(query.slot)
    : null; // staple/main/side/soup

  // ✅ dailySet（新）モード：dailySets を直接更新する
  const isDailySetMode =
    router.isReady && mode === "dailySet" && query.slot && query.dailySetId;

  const dailySetIdNew = isDailySetMode ? String(query.dailySetId) : null;
  const dailySetSlotKey = isDailySetMode ? String(query.slot) : null; // staple/mainDish/sideDish/soup

  // ✅ dailyMeal（旧互換）モード：残すなら残す
  const isDailyMealMode =
    router.isReady &&
    mode === "dailyMeal" &&
    query.meal &&
    query.slot &&
    query.dailySetId;

  const dailySetIdOld = isDailyMealMode ? String(query.dailySetId) : null;
  const dailyMeal = isDailyMealMode ? String(query.meal) : null;
  const dailySlot = isDailyMealMode ? String(query.slot) : null;

  const currentUserId = auth.currentUser?.uid || null;

  // 初回ロード：recipes 全取得
  useEffect(() => {
    const run = async () => {
      setLoading(true);
      try {
        const snap = await getDocs(collection(db, "recipes"));
        setRecipes(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    };
    run();
  }, []);

  // フィルタ（検索 + 選択モード時のカテゴリ絞り）
  const filtered = useMemo(() => {
    let list = recipes;

    // weeklyDay は slot に応じてカテゴリ絞り（あれば）
    if (isWeeklyDayMode && weeklySlotKey) {
      list = list.filter((r) => {
        const c = normalizeRecipeCategory(r.category);
        return !r.category || c === weeklySlotKey;
      });
    }

    // dailySet（新）も slot に応じてカテゴリ絞り（mainDish/sideDish → main/side）
    if (isDailySetMode && dailySetSlotKey) {
      const slotToCat = {
        staple: "staple",
        mainDish: "main",
        sideDish: "side",
        soup: "soup",
      };
      const target =
        slotToCat[dailySetSlotKey] || normalizeWeeklySlot(dailySetSlotKey);
      list = list.filter((r) => {
        const c = normalizeRecipeCategory(r.category);
        return !r.category || c === target;
      });
    }

    // dailyMeal（旧互換）
    if (isDailyMealMode && dailySlot) {
      const slotToCat = {
        staple: "staple",
        mainDish: "main",
        sideDish: "side",
        soup: "soup",
      };
      const target = slotToCat[dailySlot] || normalizeWeeklySlot(dailySlot);
      list = list.filter((r) => {
        const c = normalizeRecipeCategory(r.category);
        return !r.category || c === target;
      });
    }

    const q = searchText.trim().toLowerCase();
    if (!q) return list;

    return list.filter((r) => (r.recipeName || "").toLowerCase().includes(q));
  }, [
    recipes,
    searchText,
    isWeeklyDayMode,
    weeklySlotKey,
    isDailySetMode,
    dailySetSlotKey,
    isDailyMealMode,
    dailySlot,
  ]);

  // ✅ weeklyDay: 選択 → weeklyDaySets に保存して戻る
  const handleSelectForWeeklyDay = async (recipeId) => {
    if (!weeklyDayKey || !weeklyMealKey || !weeklySlotKey) return;

    try {
      await setDoc(
        doc(db, "weeklyDaySets", weeklyDayKey),
        {
          [weeklyMealKey]: {
            [weeklySlotKey]: recipeId,
          },
          updatedAt: serverTimestamp(),
        },
        { merge: true }
      );

      router.push(`/recipes/weekly/day/${weeklyDayKey}`);
    } catch (e) {
      console.error(e);
      alert("レシピのセットに失敗しました。");
    }
  };

  // ✅ dailySet（新）: 選択 → dailySets に保存して一覧へ戻る
  const handleSelectForDailySetNew = async (recipeId) => {
    if (!dailySetIdNew || !dailySetSlotKey) return;

    try {
      await setDoc(
        doc(db, "dailySets", dailySetIdNew),
        {
          [dailySetSlotKey]: recipeId,
          updatedAt: serverTimestamp(),
        },
        { merge: true }
      );

      router.push("/recipes/dailyset");
    } catch (e) {
      console.error(e);
      alert("レシピのセットに失敗しました。");
    }
  };

  // ✅ dailyMeal（旧互換）: 既存仕様どおり
  const handleSelectForDailySetOld = (recipeId) => {
    router.push(
      `/recipes/dailyset/${dailySetIdOld}?meal=${dailyMeal}&slot=${dailySlot}&recipeId=${recipeId}`
    );
  };

  // 通常の詳細・編集
  const handleDetail = (id) => router.push(`/recipes/${id}`);
  const handleEdit = (id) => router.push(`/recipes/edit/${id}`);

  const titleText = useMemo(() => {
    if (isWeeklyDayMode) {
      return `「${mealLabels[weeklyMealKey] || ""}」の ${
        categoryLabels[weeklySlotKey] || weeklySlotKey
      } を選択`;
    }
    if (isDailySetMode) {
      const label =
        { staple: "主食", mainDish: "主菜", sideDish: "副菜", soup: "汁物" }[
          dailySetSlotKey
        ] || dailySetSlotKey;
      return `献立レシピセット：${label} を選択`;
    }
    if (isDailyMealMode) {
      return `「${mealLabels[dailyMeal] || ""}」の ${dailySlot} を選択`;
    }
    return "レシピ一覧";
  }, [
    isWeeklyDayMode,
    weeklyMealKey,
    weeklySlotKey,
    isDailySetMode,
    dailySetSlotKey,
    isDailyMealMode,
    dailyMeal,
    dailySlot,
  ]);

  const showSelectInfo = isWeeklyDayMode || isDailySetMode || isDailyMealMode;

  const handleBack = () => {
    if (isWeeklyDayMode)
      return router.push(`/recipes/weekly/day/${weeklyDayKey}`);
    if (isDailySetMode) return router.push("/recipes/dailyset");
    if (isDailyMealMode)
      return router.push(`/recipes/dailyset/${dailySetIdOld}`);
    return router.back();
  };

  return (
    <Box
      sx={{ maxWidth: 1100, mx: "auto", mt: 4, px: { xs: 1.5, sm: 2, md: 3 } }}
    >
      <Stack
        direction="row"
        justifyContent="space-between"
        alignItems="center"
        sx={{ mb: 2 }}
      >
        <Typography variant="h5" sx={{ fontWeight: 800 }}>
          {titleText}
        </Typography>

        {showSelectInfo && (
          <Button
            variant="outlined"
            sx={{ borderRadius: 999, textTransform: "none" }}
            onClick={handleBack}
          >
            戻る
          </Button>
        )}
      </Stack>

      {showSelectInfo && (
        <Alert severity="info" sx={{ mb: 2 }}>
          セットするレシピを選んでください。（カテゴリで自動絞り込み中：合わない場合は
          recipes の category を確認してね）
        </Alert>
      )}

      <TextField
        fullWidth
        sx={{ mb: 3 }}
        value={searchText}
        onChange={(e) => setSearchText(e.target.value)}
        label="レシピ名で検索"
      />

      {loading && (
        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
          読み込み中...
        </Typography>
      )}

      <Grid container spacing={3} columns={12}>
        {filtered.map((recipe) => {
          const normalizedCat = normalizeRecipeCategory(recipe.category);
          const canEdit = currentUserId && currentUserId === recipe.authorId;

          return (
            <Grid
              item
              xs={12}
              sm={6}
              md={4}
              key={recipe.id}
              sx={{ display: "flex" }}
            >
              <Card
                sx={{
                  width: "100%",
                  borderRadius: 2.5,
                  overflow: "hidden",
                  boxSizing: "border-box",
                  display: "flex",
                  flexDirection: "column",
                }}
              >
                <RecipeImage
                  imageUrl={recipe.imageUrl}
                  title={recipe.recipeName}
                  height={180}
                />

                <CardContent sx={{ flexGrow: 1 }}>
                  <Typography variant="h6" sx={{ fontWeight: 800 }}>
                    {recipe.recipeName}
                  </Typography>

                  <Stack
                    direction="row"
                    spacing={1}
                    alignItems="center"
                    mt={1}
                    flexWrap="wrap"
                  >
                    {normalizedCat && (
                      <Chip
                        size="small"
                        label={categoryLabels[normalizedCat] || normalizedCat}
                      />
                    )}

                    {typeof recipe.cookingTime === "number" && (
                      <Typography variant="body2" color="text.secondary">
                        調理時間: {recipe.cookingTime}分
                      </Typography>
                    )}
                  </Stack>
                </CardContent>

                <CardActions sx={{ px: 2, pb: 2 }}>
                  {isWeeklyDayMode ? (
                    <Button
                      fullWidth
                      variant="contained"
                      sx={{ borderRadius: 999, textTransform: "none" }}
                      onClick={() => handleSelectForWeeklyDay(recipe.id)}
                    >
                      このレシピをセット
                    </Button>
                  ) : isDailySetMode ? (
                    <Button
                      fullWidth
                      variant="contained"
                      sx={{ borderRadius: 999, textTransform: "none" }}
                      onClick={() => handleSelectForDailySetNew(recipe.id)}
                    >
                      このレシピをセット
                    </Button>
                  ) : isDailyMealMode ? (
                    <Button
                      fullWidth
                      variant="contained"
                      sx={{ borderRadius: 999, textTransform: "none" }}
                      onClick={() => handleSelectForDailySetOld(recipe.id)}
                    >
                      このレシピをセット
                    </Button>
                  ) : (
                    <Stack direction="row" spacing={1} sx={{ width: "100%" }}>
                      <Button
                        fullWidth
                        variant="outlined"
                        size="small"
                        sx={{ borderRadius: 999, textTransform: "none" }}
                        onClick={() => handleDetail(recipe.id)}
                      >
                        詳細
                      </Button>

                      {canEdit && (
                        <Button
                          fullWidth
                          variant="contained"
                          size="small"
                          sx={{ borderRadius: 999, textTransform: "none" }}
                          onClick={() => handleEdit(recipe.id)}
                        >
                          編集
                        </Button>
                      )}
                    </Stack>
                  )}
                </CardActions>
              </Card>
            </Grid>
          );
        })}
      </Grid>

      {!loading && filtered.length === 0 && (
        <Typography variant="body2" color="text.secondary" sx={{ mt: 3 }}>
          該当するレシピがありません。
        </Typography>
      )}
    </Box>
  );
}
