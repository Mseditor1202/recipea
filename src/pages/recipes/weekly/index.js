// pages/recipes/weekly/index.jsx
import { useAuth } from "@/hooks/useAuth";
import ListSkeleton from "@/components/states/ListSkeleton";
import ErrorState from "@/components/states/ErrorState";
import AppLayout from "@/components/layout/AppLayout";
import React, { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/router";
import {
  Box,
  Stack,
  Typography,
  Card,
  CardContent,
  Button,
  IconButton,
} from "@mui/material";
import { ArrowBack, ArrowForward } from "@mui/icons-material";
import {
  doc,
  getDoc,
  getDocs,
  collection,
  query,
  where,
} from "firebase/firestore";
import { db } from "@/lib/firebase";

/** 週間ページの最大表示（2ヶ月 ≒ 8週） */
const MAX_WEEKS = 8;

const DAY_META = [
  { key: "sun", label: "日" },
  { key: "mon", label: "月" },
  { key: "tue", label: "火" },
  { key: "wed", label: "水" },
  { key: "thu", label: "木" },
  { key: "fri", label: "金" },
  { key: "sat", label: "土" },
];

const MEALS = [
  { key: "breakfast", label: "朝", icon: "🍞" },
  { key: "lunch", label: "昼", icon: "🍜" },
  { key: "dinner", label: "夜", icon: "🍽️" },
];

const SLOTS = [
  { key: "staple", label: "主食" },
  { key: "main", label: "主菜" },
  { key: "side", label: "副菜" },
  { key: "soup", label: "汁物" },
];

function emptyMeal() {
  return { staple: null, main: null, side: null, soup: null };
}

function ensureDayDoc(data) {
  return {
    breakfast: data?.breakfast
      ? { ...emptyMeal(), ...data.breakfast }
      : emptyMeal(),
    lunch: data?.lunch ? { ...emptyMeal(), ...data.lunch } : emptyMeal(),
    dinner: data?.dinner ? { ...emptyMeal(), ...data.dinner } : emptyMeal(),
    memo: data?.memo || "",
    templateIds: {
      breakfast: data?.templateIds?.breakfast || "",
      lunch: data?.templateIds?.lunch || "",
      dinner: data?.templateIds?.dinner || "",
    },
  };
}

/** weekKey（日曜 YYYY-MM-DD）をoffsetから作る */
function getWeekKeyFromOffset(baseSunday, weekOffset) {
  const base = new Date(baseSunday);
  base.setDate(base.getDate() + weekOffset * 7);
  const y = base.getFullYear();
  const m = String(base.getMonth() + 1).padStart(2, "0");
  const d = String(base.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

/** "YYYY-MM-DD" → Date（JST） */
function weekKeyToDate(weekKey) {
  return new Date(`${weekKey}T00:00:00+09:00`);
}

/** 表示用：YYYY/MM/DD〜MM/DD */
function formatWeekRangeLabel(weekKey) {
  const start = weekKeyToDate(weekKey);
  const end = new Date(start);
  end.setDate(end.getDate() + 6);

  const sM = String(start.getMonth() + 1).padStart(2, "0");
  const sD = String(start.getDate()).padStart(2, "0");
  const eM = String(end.getMonth() + 1).padStart(2, "0");
  const eD = String(end.getDate()).padStart(2, "0");

  return `${start.getFullYear()}/${sM}/${sD}〜${eM}/${eD}`;
}

/** weekKey（日曜）+ dayKey(sun..sat) → その日の YYYY-MM-DD */
function getDayKeyFromWeekAndDay(weekKey, dayKey) {
  const sunday = weekKeyToDate(weekKey);
  const idx = DAY_META.findIndex((d) => d.key === dayKey);

  const d = new Date(sunday);
  d.setDate(sunday.getDate() + Math.max(0, idx));

  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");

  return `${y}-${m}-${dd}`;
}

export default function WeeklyPage() {
  const { user } = useAuth();
  const router = useRouter();

  const [mounted, setMounted] = useState(false);
  const [baseSunday, setBaseSunday] = useState(null);

  useEffect(() => {
    setMounted(true);

    const today = new Date();

    // 今週の日曜日
    today.setDate(today.getDate() - today.getDay());
    today.setHours(0, 0, 0, 0);

    setBaseSunday(today);
  }, []);

  // 週移動
  const [weekOffset, setWeekOffset] = useState(0);

  const weekKey = useMemo(() => {
    if (!baseSunday) return null;
    return getWeekKeyFromOffset(baseSunday, weekOffset);
  }, [baseSunday, weekOffset]);

  const [weekDocs, setWeekDocs] = useState({});
  const [weekLoading, setWeekLoading] = useState(true);
  const [weekLoadError, setWeekLoadError] = useState(false);

  // recipes
  const [recipeMap, setRecipeMap] = useState({});

  useEffect(() => {
    if (!user) return;

    const fetchRecipes = async () => {
      try {
        const rSnap = await getDocs(
          query(collection(db, "recipes"), where("userId", "==", user.uid)),
        );

        const map = {};

        rSnap.docs.forEach((d) => {
          map[d.id] = {
            id: d.id,
            ...d.data(),
          };
        });

        setRecipeMap(map);
      } catch (e) {
        console.error("[WEEKLY] fetch recipes failed:", e);
      }
    };

    fetchRecipes();
  }, [user]);

  // 週間分の weeklyDaySets を読み込み
  useEffect(() => {
    if (!weekKey || !user) return;

    const fetchWeek = async () => {
      setWeekLoading(true);
      setWeekLoadError(false);

      try {
        const dateKeys = DAY_META.map((day) =>
          getDayKeyFromWeekAndDay(weekKey, day.key),
        );

        const snapshots = await Promise.all(
          dateKeys.map((dk) =>
            getDoc(doc(db, "weeklyDaySets", `${user.uid}_${dk}`)),
          ),
        );

        const next = {};

        dateKeys.forEach((dk, index) => {
          const snapshot = snapshots[index];

          next[dk] = snapshot.exists()
            ? ensureDayDoc(snapshot.data())
            : ensureDayDoc(null);
        });

        setWeekDocs(next);
      } catch (error) {
        console.error("[WEEKLY] fetch week failed:", error);
        setWeekLoadError(true);
      } finally {
        setWeekLoading(false);
      }
    };

    fetchWeek();
  }, [weekKey, user]);

  const getMealPreview = (mealData) => {
    if (!mealData) {
      return {
        recipeIds: [],
        imageUrl: "",
        title: "",
      };
    }

    const recipeIds = SLOTS.map((slot) => mealData?.[slot.key]).filter(Boolean);

    const recipes = recipeIds.map((id) => recipeMap[id]).filter(Boolean);

    return {
      recipeIds,
      imageUrl: recipes[0]?.imageUrl || "",
      title: recipes
        .map((recipe) => recipe.recipeName)
        .filter(Boolean)
        .join("・"),
    };
  };

  // 週移動
  const handlePrevWeek = () => setWeekOffset((p) => Math.max(0, p - 1));
  const handleNextWeek = () =>
    setWeekOffset((p) => Math.min(MAX_WEEKS - 1, p + 1));

  // hydration対策
  if (!mounted || !baseSunday || !weekKey) {
    return (
      <Box sx={{ p: 4 }}>
        <Typography>読み込み中...</Typography>
      </Box>
    );
  }

  return (
    <AppLayout title="献立" activeNav="meal">
      <Box sx={{ bgcolor: "#faf7f0", minHeight: "100vh", py: 4 }}>
        <Box sx={{ maxWidth: 1200, mx: "auto", px: { xs: 1.5, sm: 2, md: 3 } }}>
          <Stack spacing={2.5}>
            {/* Header */}
            <Stack
              direction="row"
              justifyContent="space-between"
              alignItems="center"
            >
              <Box>
                <Typography variant="h5" sx={{ fontWeight: 800 }}>
                  週間レシピ登録
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  1週間の朝・昼・夜の献立をまとめて確認できます。
                </Typography>
              </Box>

              <Button
                variant="outlined"
                sx={{ borderRadius: 999, textTransform: "none" }}
                onClick={() => router.push("/recipes")}
              >
                レシピ一覧へ
              </Button>
            </Stack>

            {/* 週ナビ */}
            <Card
              sx={{
                borderRadius: 3,
                boxShadow: "0 12px 30px rgba(0,0,0,0.06)",
              }}
            >
              <CardContent>
                <Stack
                  direction="row"
                  alignItems="center"
                  justifyContent="space-between"
                >
                  <Stack direction="row" alignItems="center" spacing={1}>
                    <IconButton
                      size="small"
                      onClick={handlePrevWeek}
                      disabled={weekOffset === 0}
                    >
                      <ArrowBack />
                    </IconButton>
                    <Typography sx={{ fontWeight: 900 }}>
                      {formatWeekRangeLabel(weekKey)}
                    </Typography>
                    <IconButton
                      size="small"
                      onClick={handleNextWeek}
                      disabled={weekOffset === MAX_WEEKS - 1}
                    >
                      <ArrowForward />
                    </IconButton>
                  </Stack>
                </Stack>
              </CardContent>
            </Card>

            {weekLoading ? (
              <ListSkeleton count={3} />
            ) : weekLoadError ? (
              <ErrorState
                title="週間献立を読み込めませんでした"
                description="通信状態を確認して、もう一度お試しください。"
                onRetry={() => router.reload()}
              />
            ) : (
              <Card
                sx={{
                  borderRadius: 3,
                  border: "1px solid #F1E5D5",
                  boxShadow: "0 8px 24px rgba(80, 60, 30, 0.06)",
                  overflow: "hidden",
                }}
              >
                <CardContent sx={{ p: 0 }}>
                  <Box sx={{ overflowX: "auto" }}>
                    <Box
                      sx={{
                        minWidth: 900,
                        display: "grid",
                        gridTemplateColumns:
                          "90px repeat(7, minmax(110px, 1fr))",
                      }}
                    >
                      {/* 左上 */}
                      <Box
                        sx={{
                          borderRight: "1px solid #F1E5D5",
                          borderBottom: "1px solid #F1E5D5",
                          bgcolor: "#FFFDFA",
                        }}
                      />

                      {/* 曜日 */}
                      {DAY_META.map((day) => {
                        const dk = getDayKeyFromWeekAndDay(weekKey, day.key);

                        return (
                          <Box
                            key={day.key}
                            sx={{
                              py: 1.5,
                              textAlign: "center",
                              borderRight: "1px solid #F1E5D5",
                              borderBottom: "1px solid #F1E5D5",
                              bgcolor: "#FFFDFA",
                            }}
                          >
                            <Typography
                              sx={{
                                fontSize: 13,
                                fontWeight: 800,
                                color:
                                  day.key === "sun"
                                    ? "#D65A4A"
                                    : day.key === "sat"
                                      ? "#4277B8"
                                      : "#333333",
                              }}
                            >
                              {dk.slice(8)}
                            </Typography>

                            <Typography
                              sx={{
                                fontSize: 12,
                                color:
                                  day.key === "sun"
                                    ? "#D65A4A"
                                    : day.key === "sat"
                                      ? "#4277B8"
                                      : "#777777",
                              }}
                            >
                              {day.label}
                            </Typography>
                          </Box>
                        );
                      })}

                      {/* 朝・昼・夕 */}
                      {MEALS.map((meal) => (
                        <React.Fragment key={meal.key}>
                          <Box
                            sx={{
                              minHeight: 120,
                              display: "flex",
                              alignItems: "center",
                              justifyContent: "center",
                              borderRight: "1px solid #F1E5D5",
                              borderBottom: "1px solid #F1E5D5",
                              bgcolor: "#FFF9EF",
                            }}
                          >
                            <Typography
                              sx={{
                                fontWeight: 800,
                                fontSize: 13,
                              }}
                            >
                              {meal.label}
                            </Typography>
                          </Box>

                          {DAY_META.map((day) => {
                            const dk = getDayKeyFromWeekAndDay(
                              weekKey,
                              day.key,
                            );
                            const dayData = weekDocs[dk];
                            const preview = getMealPreview(dayData?.[meal.key]);
                            const hasMeal = preview.recipeIds.length > 0;

                            return (
                              <Box
                                key={`${dk}-${meal.key}`}
                                sx={{
                                  minHeight: 120,
                                  p: 1,
                                  borderRight: "1px solid #F1E5D5",
                                  borderBottom: "1px solid #F1E5D5",
                                  bgcolor: "#FFFFFF",
                                }}
                              >
                                <Button
                                  fullWidth
                                  onClick={() =>
                                    router.push(`/recipes/weekly/day/${dk}`)
                                  }
                                  sx={{
                                    height: "100%",
                                    minHeight: 100,
                                    p: 0.75,
                                    borderRadius: 2,
                                    display: "flex",
                                    flexDirection: "column",
                                    gap: 0.5,
                                    color: "#333333",
                                    textTransform: "none",
                                    "&:hover": {
                                      bgcolor: "#FFF8EC",
                                    },
                                  }}
                                >
                                  {hasMeal ? (
                                    <>
                                      {preview.imageUrl && (
                                        <Box
                                          component="img"
                                          src={preview.imageUrl}
                                          alt={preview.title}
                                          sx={{
                                            width: 56,
                                            height: 56,
                                            borderRadius: 2,
                                            objectFit: "cover",
                                          }}
                                        />
                                      )}

                                      <Typography
                                        sx={{
                                          width: "100%",
                                          fontSize: 11,
                                          lineHeight: 1.4,
                                          fontWeight: 700,
                                          overflow: "hidden",
                                          display: "-webkit-box",
                                          WebkitBoxOrient: "vertical",
                                          WebkitLineClamp: 2,
                                        }}
                                      >
                                        {preview.title}
                                      </Typography>
                                    </>
                                  ) : (
                                    <Typography
                                      sx={{
                                        fontSize: 24,
                                        lineHeight: 1,
                                        fontWeight: 400,
                                        color: "#4B8B4B",
                                      }}
                                    >
                                      ＋
                                    </Typography>
                                  )}
                                </Button>
                              </Box>
                            );
                          })}
                        </React.Fragment>
                      ))}
                    </Box>
                  </Box>

                  <Box
                    sx={{
                      p: 2.5,
                      textAlign: "center",
                      bgcolor: "#FFFDFA",
                    }}
                  >
                    <Button
                      variant="contained"
                      onClick={() =>
                        router.push(`/recipes/weekly/zubora?weekKey=${weekKey}`)
                      }
                      sx={{
                        minWidth: 240,
                        py: 1.2,
                        borderRadius: 2,
                        bgcolor: "#2F7D32",
                        fontWeight: 800,
                        boxShadow: "none",
                        textTransform: "none",
                        "&:hover": {
                          bgcolor: "#286C2B",
                          boxShadow: "none",
                        },
                      }}
                    >
                      おまかせで決める
                    </Button>

                    <Typography
                      sx={{
                        mt: 1,
                        fontSize: 12,
                        color: "#888888",
                      }}
                    >
                      または、＋から1日ずつ追加できます
                    </Typography>
                  </Box>
                </CardContent>
              </Card>
            )}
          </Stack>
        </Box>
      </Box>
    </AppLayout>
  );
}
