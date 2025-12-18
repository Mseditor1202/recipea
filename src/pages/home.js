import React, { useEffect, useMemo, useState } from "react";
import NextLink from "next/link";
import {
  Box,
  Typography,
  Card,
  CardContent,
  Grid,
  Button,
  Stack,
} from "@mui/material";
import {
  collection,
  doc,
  getDoc,
  getDocs,
  where,
  query,
} from "firebase/firestore";
import { db } from "@/lib/firebase";

const DEFAULT_IMAGE = "/images/default-recipe.png";

// 朝昼夜の表示ラベル
const MEAL_LABEL = {
  breakfast: "朝",
  lunch: "昼",
  dinner: "夜",
};

// 主食4枠の表示ラベル（weeklyDaySets: { staple, main, side, soup } を想定）
const SLOT_LABEL = {
  staple: "主食",
  main: "主菜",
  side: "副菜",
  soup: "汁物",
};

export default function HomeTodayMenu() {
  const [todayKey, setTodayKey] = useState("");
  const [weeklyDayData, setWeeklyDayData] = useState(null); // { breakfast, lunch, dinner }
  const [recipesMap, setRecipesMap] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // 今日の日付キー（YYYY-MM-DD）を計算
  useEffect(() => {
    const d = new Date();
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    setTodayKey(`${y}-${m}-${day}`);
  }, []);

  // weeklyDaySets / recipes 読み込み
  useEffect(() => {
    if (!todayKey) return;

    const fetchData = async () => {
      setLoading(true);
      setError("");

      try {
        // 1) 今日の weeklyDaySets ドキュメント取得
        const ref = doc(db, "weeklyDaySets", todayKey);
        const snap = await getDoc(ref);

        if (!snap.exists()) {
          // まだ登録されていない場合
          setWeeklyDayData(null);
          setRecipesMap({});
          setLoading(false);
          return;
        }

        const dayData = snap.data() || {};
        setWeeklyDayData(dayData);

        // 2) 使用している recipeId を全部集める
        const recipeIdSet = new Set();

        ["breakfast", "lunch", "dinner"].forEach((mealKey) => {
          const mealData = dayData[mealKey] || {};
          ["staple", "main", "side", "soup"].forEach((slotKey) => {
            const id = mealData[slotKey];
            if (id) recipeIdSet.add(id);
          });
        });

        if (recipeIdSet.size === 0) {
          setRecipesMap({});
          setLoading(false);
          return;
        }

        const allIds = Array.from(recipeIdSet);
        const recipesCol = collection(db, "recipes");
        const recipesMapTmp = {};

        // Firestore の where in は 10件までなので分割
        const chunkSize = 10;
        for (let i = 0; i < allIds.length; i += chunkSize) {
          const chunk = allIds.slice(i, i + chunkSize);
          const q = query(recipesCol, where("__name__", "in", chunk));
          const snapRecipes = await getDocs(q);
          snapRecipes.forEach((docSnap) => {
            recipesMapTmp[docSnap.id] = {
              id: docSnap.id,
              ...docSnap.data(),
            };
          });
        }

        setRecipesMap(recipesMapTmp);
        setLoading(false);
      } catch (err) {
        console.error("HomeTodayMenu fetch error:", err);
        setError("今日の献立を読み込む際にエラーが発生しました。");
        setLoading(false);
      }
    };

    fetchData();
  }, [todayKey]);

  const MEAL_ORDER = useMemo(() => ["breakfast", "lunch", "dinner"], []);

  const SLOT_ORDER = useMemo(() => ["staple", "main", "side", "soup"], []);

  return (
    <Box
      sx={{
        maxWidth: 1100,
        mx: "auto",
        mt: 4,
        px: { xs: 2, md: 3 },
        pb: 4,
      }}
    >
      {/* ヘッダー */}
      <Typography
        variant="h5"
        sx={{
          fontWeight: 700,
          mb: 1,
        }}
      >
        今日の献立
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
        {todayKey
          ? `日付：${todayKey} の 朝・昼・夜（主食 / 主菜 / 副菜 / 汁物）の献立`
          : "日付情報を読み込み中です…"}
      </Typography>

      {loading && (
        <Typography variant="body2" color="text.secondary">
          献立を読み込み中です…
        </Typography>
      )}

      {error && (
        <Typography variant="body2" color="error" sx={{ mt: 1 }}>
          {error}
        </Typography>
      )}

      {!loading && !error && !weeklyDayData && (
        <Typography variant="body2" color="text.secondary">
          今日の weeklyDaySets がまだ登録されていません。
        </Typography>
      )}

      {/* 朝・昼・夜 × 主食/主菜/副菜/汁物 */}
      {!loading && !error && weeklyDayData && (
        <Stack spacing={3}>
          {MEAL_ORDER.map((mealKey) => {
            const mealData = weeklyDayData[mealKey] || {};

            return (
              <Card
                key={mealKey}
                sx={{
                  borderRadius: 3,
                  border: "1px solid #eee0cc",
                  boxShadow: "0 8px 24px rgba(0,0,0,0.04)",
                }}
              >
                <CardContent>
                  {/* 朝 / 昼 / 夜 タイトル */}
                  <Typography
                    variant="h6"
                    sx={{ fontWeight: 700, mb: 1.5, letterSpacing: "0.05em" }}
                  >
                    {MEAL_LABEL[mealKey]} の献立
                  </Typography>

                  <Grid container spacing={1.5}>
                    {SLOT_ORDER.map((slotKey) => {
                      const recipeId = mealData[slotKey];
                      const recipe = recipeId ? recipesMap[recipeId] : null;

                      return (
                        <Grid item xs={6} sm={3} key={slotKey}>
                          <Box
                            sx={{
                              borderRadius: 2,
                              overflow: "hidden",
                              bgcolor: "#fff",
                              border: "1px solid #eee0cc",
                              boxShadow: "0 4px 12px rgba(0,0,0,0.04)",
                              display: "flex",
                              flexDirection: "column",
                            }}
                          >
                            {/* 画像 */}
                            <Box
                              sx={{
                                position: "relative",
                                height: 110,
                                overflow: "hidden",
                              }}
                            >
                              <Box
                                component="img"
                                src={recipe?.imageUrl || DEFAULT_IMAGE}
                                alt={recipe?.recipeName || "未登録レシピ"}
                                sx={{
                                  width: "100%",
                                  height: "100%",
                                  objectFit: "cover",
                                }}
                              />

                              {/* 主食 / 主菜 / 副菜 / 汁物 ラベル */}
                              <Box
                                sx={{
                                  position: "absolute",
                                  top: 6,
                                  left: 6,
                                  px: 1,
                                  py: 0.2,
                                  borderRadius: "999px",
                                  bgcolor: "rgba(255,255,255,0.95)",
                                  border: "1px solid rgba(0,0,0,0.08)",
                                  fontSize: 11,
                                  fontWeight: 700,
                                }}
                              >
                                {SLOT_LABEL[slotKey]}
                              </Box>
                            </Box>

                            {/* タイトル＆ボタン */}
                            <Box sx={{ p: 1.2 }}>
                              <Typography
                                variant="body2"
                                sx={{
                                  minHeight: "2.6em",
                                  lineHeight: 1.3,
                                }}
                                color={
                                  recipe ? "text.primary" : "text.disabled"
                                }
                              >
                                {recipe?.recipeName || "未登録"}
                              </Typography>

                              {recipe ? (
                                <Button
                                  component={NextLink}
                                  href={`/recipes/${recipeId}?from=home`}
                                  variant="outlined"
                                  size="small"
                                  sx={{
                                    mt: 0.8,
                                    textTransform: "none",
                                    fontSize: 12,
                                    borderRadius: 999,
                                  }}
                                >
                                  このレシピの詳細を見る
                                </Button>
                              ) : (
                                <Button
                                  variant="outlined"
                                  size="small"
                                  disabled
                                  sx={{
                                    mt: 0.8,
                                    textTransform: "none",
                                    fontSize: 12,
                                    borderRadius: 999,
                                  }}
                                >
                                  レシピ未登録
                                </Button>
                              )}
                            </Box>
                          </Box>
                        </Grid>
                      );
                    })}
                  </Grid>
                </CardContent>
              </Card>
            );
          })}
        </Stack>
      )}
    </Box>
  );
}
