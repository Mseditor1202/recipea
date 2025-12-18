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
 * 2) weeklyDayセット用: /recipes?mode=weeklyDay&dayKey=YYYY-MM-DD&meal=breakfast&slot=main
 * 3) dailySet編集用(旧): /recipes?mode=dailyMeal&meal=breakfast&slot=mainDish&dailySetId=xxx
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

const slotLabels = {
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

  // weeklyDay モード
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

  // dailyMeal（旧 dailySet 用）
  const isDailyMealMode =
    router.isReady &&
    mode === "dailyMeal" &&
    query.meal &&
    query.slot &&
    query.dailySetId;

  const dailySetId = isDailyMealMode ? String(query.dailySetId) : null;
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

    // weeklyDay / dailyMeal ではスロットに応じてカテゴリ絞り（あれば）
    if (isWeeklyDayMode && weeklySlotKey) {
      list = list.filter((r) => {
        const c = normalizeRecipeCategory(r.category);
        // category 未設定は一応通す（ユーザーのデータが揃ってない場合の救済）
        return !r.category || c === weeklySlotKey;
      });
    }

    // dailyMeal（旧）: mainDish → main 等に合わせて絞る
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

      // 戻り先：Drawer方式のページに戻す（week/day）
      router.push(`/recipes/weekly/day/${weeklyDayKey}`);
    } catch (e) {
      console.error(e);
      alert("レシピのセットに失敗しました。");
    }
  };

  // ✅ dailyMeal（旧）: 既存仕様どおり dailyset 編集ページへクエリで渡す
  const handleSelectForDailySet = (recipeId) => {
    router.push(
      `/recipes/dailyset/${dailySetId}?meal=${dailyMeal}&slot=${dailySlot}&recipeId=${recipeId}`
    );
  };

  // 通常の詳細・編集
  const handleDetail = (id) => router.push(`/recipes/${id}`);
  const handleEdit = (id) => router.push(`/recipes/edit/${id}`);

  const titleText = useMemo(() => {
    if (isWeeklyDayMode) {
      return `「${slotLabels[weeklyMealKey] || ""}」の ${
        categoryLabels[weeklySlotKey] || weeklySlotKey
      } を選択`;
    }
    if (isDailyMealMode) {
      return `「${slotLabels[dailyMeal] || ""}」の ${dailySlot} を選択`;
    }
    return "レシピ一覧";
  }, [
    isWeeklyDayMode,
    weeklyMealKey,
    weeklySlotKey,
    isDailyMealMode,
    dailyMeal,
    dailySlot,
  ]);

  const showSelectInfo = isWeeklyDayMode || isDailyMealMode;

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

        {isWeeklyDayMode && (
          <Button
            variant="outlined"
            sx={{ borderRadius: 999, textTransform: "none" }}
            onClick={() => router.push(`/recipes/weekly/day/${weeklyDayKey}`)}
          >
            戻る
          </Button>
        )}
      </Stack>

      {showSelectInfo && (
        <Alert severity="info" sx={{ mb: 2 }}>
          セットするレシピを選んでください。（カテゴリで自動絞り込み中：合わない場合はレシピの
          category を確認してね）
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
              sx={{ display: "flex" }} // ✅ カードの横幅・高さが安定
            >
              <Card
                sx={{
                  width: "100%",
                  borderRadius: 2.5,
                  overflow: "hidden",
                  boxSizing: "border-box",
                }}
              >
                <RecipeImage
                  imageUrl={recipe.imageUrl}
                  title={recipe.recipeName}
                  height={180} // ✅ ここで統一
                />

                <CardContent>
                  <Typography variant="h6" sx={{ fontWeight: 800 }}>
                    {recipe.recipeName}
                  </Typography>

                  {/* カテゴリ & 調理時間 */}
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

                <CardActions
                  sx={{ justifyContent: "space-between", px: 2, pb: 2 }}
                >
                  {isWeeklyDayMode ? (
                    <Button
                      fullWidth
                      variant="contained"
                      sx={{ borderRadius: 999, textTransform: "none" }}
                      onClick={() => handleSelectForWeeklyDay(recipe.id)}
                    >
                      このレシピをセット
                    </Button>
                  ) : isDailyMealMode ? (
                    <Button
                      fullWidth
                      variant="contained"
                      sx={{ borderRadius: 999, textTransform: "none" }}
                      onClick={() => handleSelectForDailySet(recipe.id)}
                    >
                      このレシピをセット
                    </Button>
                  ) : (
                    <Stack direction="row" spacing={1}>
                      <Button
                        variant="outlined"
                        size="small"
                        sx={{ borderRadius: 999, textTransform: "none" }}
                        onClick={() => handleDetail(recipe.id)}
                      >
                        詳細
                      </Button>

                      {canEdit && (
                        <Button
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
