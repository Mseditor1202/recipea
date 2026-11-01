// pages/recipes/weekly/zubora.jsx
import { useAuth } from "@/hooks/useAuth";
import AppLayout from "@/components/layout/AppLayout";
import { listZuboraSets } from "@/features/zuboraSets/repositories/zuboraSetRepository";
import { listRecipes } from "@/features/recipes/repositories/recipeRepo";
import { db } from "@/lib/firebase";

import { Fragment, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/router";

import {
  Alert,
  Box,
  Button,
  Card,
  CardActionArea,
  CardContent,
  Checkbox,
  Chip,
  CircularProgress,
  Divider,
  Stack,
  Typography,
} from "@mui/material";

import {
  doc,
  getDoc,
  runTransaction,
  serverTimestamp,
} from "firebase/firestore";

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
  { key: "breakfast", label: "朝" },
  { key: "lunch", label: "昼" },
  { key: "dinner", label: "夜" },
];

const SLOTS = [
  { key: "staple", label: "主食" },
  { key: "main", label: "主菜" },
  { key: "side", label: "副菜" },
  { key: "soup", label: "汁物" },
];

const CATEGORY_LABEL = {
  standard: "定番",
  quick: "時短",
  saving: "節約",
  other: "その他",
};

function emptyMeal() {
  return {
    staple: null,
    main: null,
    side: null,
    soup: null,
  };
}

function normalizeDayDoc(data) {
  return {
    breakfast: data?.breakfast
      ? { ...emptyMeal(), ...data.breakfast }
      : emptyMeal(),
    lunch: data?.lunch ? { ...emptyMeal(), ...data.lunch } : emptyMeal(),
    dinner: data?.dinner ? { ...emptyMeal(), ...data.dinner } : emptyMeal(),
  };
}

function isValidWeekKey(value) {
  return /^\d{4}-\d{2}-\d{2}$/.test(value);
}

function weekKeyToDate(weekKey) {
  return new Date(`${weekKey}T00:00:00+09:00`);
}

function toDateKey(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");

  return `${y}-${m}-${d}`;
}

function buildWeekDays(weekKey) {
  const sunday = weekKeyToDate(weekKey);

  return DAY_META.map((day, index) => {
    const date = new Date(sunday);
    date.setDate(sunday.getDate() + index);

    return {
      ...day,
      dateKey: toDateKey(date),
      dateLabel: `${date.getMonth() + 1}/${date.getDate()}（${day.label}）`,
    };
  });
}

function hasEmptySlot(dayData) {
  return MEALS.some((meal) =>
    SLOTS.some((slot) => !dayData?.[meal.key]?.[slot.key]),
  );
}

function buildMergedMeal(currentMeal, zuboraMeal) {
  return {
    staple: currentMeal?.staple || zuboraMeal?.staple || null,
    main: currentMeal?.main || zuboraMeal?.main || null,
    side: currentMeal?.side || zuboraMeal?.side || null,
    soup: currentMeal?.soup || zuboraMeal?.soup || null,
  };
}

function getApplySummary(dayData, zuboraSet) {
  const meals = {};

  let applyCount = 0;
  let existingCount = 0;
  let remainEmptyCount = 0;

  MEALS.forEach((meal) => {
    let mealApplyCount = 0;
    let mealExistingCount = 0;
    let mealRemainEmptyCount = 0;

    SLOTS.forEach((slot) => {
      const currentRecipeId = dayData?.[meal.key]?.[slot.key];
      const zuboraRecipeId = zuboraSet?.meals?.[meal.key]?.[slot.key];

      if (currentRecipeId) {
        existingCount += 1;
        mealExistingCount += 1;
        return;
      }

      if (zuboraRecipeId) {
        applyCount += 1;
        mealApplyCount += 1;
        return;
      }

      remainEmptyCount += 1;
      mealRemainEmptyCount += 1;
    });

    meals[meal.key] = {
      applyCount: mealApplyCount,
      existingCount: mealExistingCount,
      remainEmptyCount: mealRemainEmptyCount,
    };
  });

  return {
    meals,
    applyCount,
    existingCount,
    remainEmptyCount,
  };
}

export default function WeeklyZuboraPage() {
  const router = useRouter();
  const { user } = useAuth();

  const rawWeekKey = router.query.weekKey;
  const weekKey = typeof rawWeekKey === "string" ? rawWeekKey : "";

  const weekDays = useMemo(() => {
    if (!isValidWeekKey(weekKey)) {
      return [];
    }

    return buildWeekDays(weekKey);
  }, [weekKey]);

  const [step, setStep] = useState(1);

  const [loading, setLoading] = useState(true);
  const [applying, setApplying] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");

  const [weekDocs, setWeekDocs] = useState({});
  const [zuboraSets, setZuboraSets] = useState([]);
  const [recipes, setRecipes] = useState([]);

  const [selectedDayKeys, setSelectedDayKeys] = useState([]);
  const [selectedSetId, setSelectedSetId] = useState("");

  const selectedSet = useMemo(
    () =>
      zuboraSets.find((zuboraSet) => zuboraSet.id === selectedSetId) || null,
    [zuboraSets, selectedSetId],
  );

  const recipeMap = useMemo(() => {
    return Object.fromEntries(recipes.map((recipe) => [recipe.id, recipe]));
  }, [recipes]);

  const selectedDays = useMemo(
    () => weekDays.filter((day) => selectedDayKeys.includes(day.dateKey)),
    [weekDays, selectedDayKeys],
  );

  const confirmationRows = useMemo(() => {
    if (!selectedSet) {
      return [];
    }

    return selectedDays.map((day) => ({
      ...day,
      summary: getApplySummary(weekDocs[day.dateKey], selectedSet),
    }));
  }, [selectedDays, selectedSet, weekDocs]);

  const totalApplyCount = useMemo(
    () =>
      confirmationRows.reduce((sum, row) => sum + row.summary.applyCount, 0),
    [confirmationRows],
  );

  useEffect(() => {
    if (!router.isReady || !user || !isValidWeekKey(weekKey)) {
      return;
    }

    let cancelled = false;

    const loadData = async () => {
      setLoading(true);
      setErrorMsg("");

      try {
        const daySnapshotsPromise = Promise.all(
          weekDays.map((day) =>
            getDoc(doc(db, "weeklyDaySets", `${user.uid}_${day.dateKey}`)),
          ),
        );

        const [sets, recipeList, daySnapshots] = await Promise.all([
          listZuboraSets(user.uid),
          listRecipes(user.uid),
          daySnapshotsPromise,
        ]);

        if (cancelled) {
          return;
        }

        const nextWeekDocs = {};

        weekDays.forEach((day, index) => {
          const snapshot = daySnapshots[index];

          nextWeekDocs[day.dateKey] = snapshot.exists()
            ? normalizeDayDoc(snapshot.data())
            : normalizeDayDoc(null);
        });

        setZuboraSets(sets);
        setRecipes(recipeList);
        setWeekDocs(nextWeekDocs);
        setSelectedDayKeys([]);
        setSelectedSetId("");
        setStep(1);
      } catch (error) {
        console.error("[WEEKLY_ZUBORA] load failed:", error);

        if (!cancelled) {
          setErrorMsg("おまかせに必要な情報を読み込めませんでした。");
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };

    loadData();

    return () => {
      cancelled = true;
    };
  }, [router.isReady, user, weekKey, weekDays]);

  const toggleDay = (dateKey) => {
    setSelectedDayKeys((prev) =>
      prev.includes(dateKey)
        ? prev.filter((key) => key !== dateKey)
        : [...prev, dateKey],
    );
  };

  const selectAllAvailableDays = () => {
    setSelectedDayKeys(
      weekDays
        .filter((day) => hasEmptySlot(weekDocs[day.dateKey]))
        .map((day) => day.dateKey),
    );
  };

  const selectWeekdays = () => {
    setSelectedDayKeys(
      weekDays
        .filter(
          (day) =>
            day.key !== "sun" &&
            day.key !== "sat" &&
            hasEmptySlot(weekDocs[day.dateKey]),
        )
        .map((day) => day.dateKey),
    );
  };

  const clearSelectedDays = () => {
    setSelectedDayKeys([]);
  };

  const getSetMealRecipes = (zuboraSet, mealKey) => {
    return SLOTS.map((slot) => {
      const recipeId = zuboraSet?.meals?.[mealKey]?.[slot.key] || null;

      const recipe = recipeId ? recipeMap[recipeId] : null;

      return {
        recipeId,
        slotKey: slot.key,
        slotLabel: slot.label,
        name:
          recipe?.recipeName ||
          recipe?.name ||
          recipe?.title ||
          (recipeId ? "料理名未設定" : "未設定"),
        imageUrl: recipe?.imageUrl || "",
      };
    });
  };

  const handleApply = async () => {
    if (
      !user ||
      !selectedSet ||
      selectedDays.length === 0 ||
      totalApplyCount === 0
    ) {
      return;
    }

    setApplying(true);
    setErrorMsg("");

    try {
      await runTransaction(db, async (transaction) => {
        const refs = selectedDays.map((day) =>
          doc(db, "weeklyDaySets", `${user.uid}_${day.dateKey}`),
        );

        const snapshots = [];

        for (const ref of refs) {
          const snapshot = await transaction.get(ref);
          snapshots.push(snapshot);
        }

        snapshots.forEach((snapshot, index) => {
          const currentDay = snapshot.exists()
            ? normalizeDayDoc(snapshot.data())
            : normalizeDayDoc(null);

          const breakfast = buildMergedMeal(
            currentDay.breakfast,
            selectedSet.meals?.breakfast,
          );

          const lunch = buildMergedMeal(
            currentDay.lunch,
            selectedSet.meals?.lunch,
          );

          const dinner = buildMergedMeal(
            currentDay.dinner,
            selectedSet.meals?.dinner,
          );

          transaction.set(
            refs[index],
            {
              userId: user.uid,
              breakfast,
              lunch,
              dinner,
              updatedAt: serverTimestamp(),
            },
            { merge: true },
          );
        });
      });

      setStep(4);
    } catch (error) {
      console.error("[WEEKLY_ZUBORA] apply failed:", error);

      setErrorMsg("おまかせの反映に失敗しました。もう一度お試しください。");
    } finally {
      setApplying(false);
    }
  };

  if (!router.isReady) {
    return (
      <AppLayout title="献立" activeNav="meal">
        <Box
          sx={{
            minHeight: "60vh",
            display: "grid",
            placeItems: "center",
          }}
        >
          <CircularProgress />
        </Box>
      </AppLayout>
    );
  }

  if (!isValidWeekKey(weekKey)) {
    return (
      <AppLayout title="献立" activeNav="meal">
        <Box
          sx={{
            maxWidth: 760,
            mx: "auto",
            px: 2,
            py: 5,
          }}
        >
          <Alert severity="error">対象の週を確認できませんでした。</Alert>

          <Button sx={{ mt: 2 }} onClick={() => router.push("/recipes/weekly")}>
            週間献立に戻る
          </Button>
        </Box>
      </AppLayout>
    );
  }

  return (
    <AppLayout title="献立" activeNav="meal">
      <Box
        sx={{
          bgcolor: "#FFFDFA",
          minHeight: "100vh",
          py: 4,
        }}
      >
        <Box
          sx={{
            maxWidth: 900,
            mx: "auto",
            px: { xs: 2, md: 3 },
          }}
        >
          <Stack spacing={3}>
            <Box>
              <Typography variant="h5" sx={{ fontWeight: 800 }}>
                おまかせで献立を決める
              </Typography>

              <Typography
                variant="body2"
                color="text.secondary"
                sx={{ mt: 0.5 }}
              >
                登録済みの献立はそのままに、空いている枠だけ埋めます。
              </Typography>
            </Box>

            <Stack
              direction="row"
              spacing={1}
              sx={{ flexWrap: "wrap", gap: 1 }}
            >
              <Chip
                label="1 日を選ぶ"
                color={step === 1 ? "primary" : "default"}
              />
              <Chip
                label="2 セットを選ぶ"
                color={step === 2 ? "primary" : "default"}
              />
              <Chip label="3 確認" color={step === 3 ? "primary" : "default"} />
            </Stack>

            {errorMsg && <Alert severity="error">{errorMsg}</Alert>}

            {loading ? (
              <Card>
                <CardContent>
                  <Stack alignItems="center" spacing={2} sx={{ py: 5 }}>
                    <CircularProgress />
                    <Typography variant="body2" color="text.secondary">
                      読み込み中...
                    </Typography>
                  </Stack>
                </CardContent>
              </Card>
            ) : step === 1 ? (
              <Card
                sx={{
                  borderRadius: 3,
                  boxShadow: "0 8px 24px rgba(80, 60, 30, 0.06)",
                }}
              >
                <CardContent>
                  <Typography variant="h6" sx={{ fontWeight: 800 }}>
                    おまかせする日を選ぶ
                  </Typography>

                  <Typography
                    variant="body2"
                    color="text.secondary"
                    sx={{ mt: 0.5 }}
                  >
                    一部の献立が登録済みの日も選べます。
                  </Typography>

                  <Stack
                    direction="row"
                    spacing={1}
                    sx={{
                      mt: 2,
                      flexWrap: "wrap",
                      gap: 1,
                    }}
                  >
                    <Button
                      size="small"
                      variant="outlined"
                      onClick={selectAllAvailableDays}
                    >
                      すべて選択
                    </Button>

                    <Button
                      size="small"
                      variant="outlined"
                      onClick={selectWeekdays}
                    >
                      平日を選択
                    </Button>

                    <Button
                      size="small"
                      variant="text"
                      onClick={clearSelectedDays}
                    >
                      選択解除
                    </Button>
                  </Stack>

                  <Stack spacing={1.25} sx={{ mt: 2 }}>
                    {weekDays.map((day) => {
                      const dayData = weekDocs[day.dateKey];

                      const canSelect = hasEmptySlot(dayData);

                      const selected = selectedDayKeys.includes(day.dateKey);

                      return (
                        <Card
                          key={day.dateKey}
                          variant="outlined"
                          sx={{
                            borderRadius: 2,
                            borderColor: selected ? "#FFB830" : "#F1E5D5",
                            bgcolor: selected ? "#FFF8E8" : "#FFFFFF",
                          }}
                        >
                          <CardActionArea
                            disabled={!canSelect}
                            onClick={() => toggleDay(day.dateKey)}
                          >
                            <Box
                              sx={{
                                px: 2,
                                py: 1.5,
                                display: "flex",
                                alignItems: "center",
                                gap: 1.5,
                              }}
                            >
                              <Checkbox
                                checked={selected}
                                disabled={!canSelect}
                                tabIndex={-1}
                              />

                              <Box sx={{ flex: 1 }}>
                                <Typography
                                  sx={{
                                    fontWeight: 800,
                                  }}
                                >
                                  {day.dateLabel}
                                </Typography>

                                <Typography
                                  variant="body2"
                                  color="text.secondary"
                                >
                                  {canSelect
                                    ? "空いている枠に適用できます"
                                    : "すべて登録済みです"}
                                </Typography>
                              </Box>
                            </Box>
                          </CardActionArea>
                        </Card>
                      );
                    })}
                  </Stack>

                  <Stack
                    direction="row"
                    justifyContent="space-between"
                    sx={{ mt: 3 }}
                  >
                    <Button onClick={() => router.push("/recipes/weekly")}>
                      戻る
                    </Button>

                    <Button
                      variant="contained"
                      disabled={selectedDayKeys.length === 0}
                      onClick={() => setStep(2)}
                      sx={{
                        bgcolor: "#FFB830",
                        color: "#333333",
                        fontWeight: 800,
                        boxShadow: "none",
                        "&:hover": {
                          bgcolor: "#F4A914",
                          boxShadow: "none",
                        },
                      }}
                    >
                      セットを選ぶ
                    </Button>
                  </Stack>
                </CardContent>
              </Card>
            ) : step === 2 ? (
              <Card
                sx={{
                  borderRadius: 3,
                  boxShadow: "0 8px 24px rgba(80, 60, 30, 0.06)",
                }}
              >
                <CardContent>
                  <Typography variant="h6" sx={{ fontWeight: 800 }}>
                    おまかせセットを選ぶ
                  </Typography>

                  <Typography
                    variant="body2"
                    color="text.secondary"
                    sx={{ mt: 0.5 }}
                  >
                    登録済みのズボラセットから選択します。
                  </Typography>

                  {zuboraSets.length === 0 ? (
                    <Alert severity="info" sx={{ mt: 2 }}>
                      <Stack spacing={1.5}>
                        <Typography>まだズボラセットがありません。</Typography>

                        <Button
                          variant="contained"
                          onClick={() => router.push("/recipes/zubora/create")}
                        >
                          ズボラセットを作る
                        </Button>
                      </Stack>
                    </Alert>
                  ) : (
                    <Stack spacing={1.5} sx={{ mt: 2 }}>
                      {zuboraSets.map((zuboraSet) => {
                        const selected = selectedSetId === zuboraSet.id;

                        return (
                          <Card
                            key={zuboraSet.id}
                            variant="outlined"
                            sx={{
                              borderRadius: 2.5,
                              borderColor: selected ? "#FFB830" : "#F1E5D5",
                              bgcolor: selected ? "#FFF8E8" : "#FFFFFF",
                            }}
                          >
                            <CardActionArea
                              onClick={() => setSelectedSetId(zuboraSet.id)}
                            >
                              <CardContent>
                                <Stack
                                  direction="row"
                                  alignItems="flex-start"
                                  spacing={1}
                                >
                                  <Checkbox checked={selected} tabIndex={-1} />

                                  <Box sx={{ flex: 1 }}>
                                    <Stack
                                      direction="row"
                                      spacing={1}
                                      alignItems="center"
                                      sx={{
                                        flexWrap: "wrap",
                                      }}
                                    >
                                      <Typography
                                        sx={{
                                          fontWeight: 800,
                                        }}
                                      >
                                        {zuboraSet.name}
                                      </Typography>

                                      <Chip
                                        size="small"
                                        label={
                                          CATEGORY_LABEL[zuboraSet.category] ||
                                          "その他"
                                        }
                                      />
                                    </Stack>

                                    {zuboraSet.description && (
                                      <Typography
                                        variant="body2"
                                        color="text.secondary"
                                        sx={{
                                          mt: 0.75,
                                        }}
                                      >
                                        {zuboraSet.description}
                                      </Typography>
                                    )}

                                    <Divider sx={{ my: 1.5 }} />

                                    <Box
                                      sx={{
                                        mt: 1.5,
                                        overflowX: "auto",
                                      }}
                                    >
                                      <Box
                                        sx={{
                                          minWidth: 680,
                                          display: "grid",
                                          gridTemplateColumns:
                                            "72px repeat(4, minmax(120px, 1fr))",
                                          gap: 1,
                                        }}
                                      >
                                        {/* 左上 */}
                                        <Box />

                                        {/* 主食・主菜・副菜・汁物 */}
                                        {SLOTS.map((slot) => (
                                          <Box
                                            key={slot.key}
                                            sx={{
                                              py: 0.75,
                                              px: 1,
                                              textAlign: "center",
                                              borderRadius: 1.5,
                                              bgcolor: "#F4F7E9",
                                            }}
                                          >
                                            <Typography
                                              variant="body2"
                                              sx={{
                                                fontWeight: 800,
                                                color: "#444444",
                                              }}
                                            >
                                              {slot.label}
                                            </Typography>
                                          </Box>
                                        ))}

                                        {/* 朝・昼・夜 */}
                                        {MEALS.map((meal) => {
                                          const mealRecipes = getSetMealRecipes(
                                            zuboraSet,
                                            meal.key,
                                          );

                                          return (
                                            <Fragment key={meal.key}>
                                              {/* 食事ラベル */}
                                              <Box
                                                sx={{
                                                  minHeight: 128,
                                                  display: "grid",
                                                  placeItems: "center",
                                                  borderRadius: 2,
                                                  bgcolor: "#F4F7E9",
                                                }}
                                              >
                                                <Typography
                                                  sx={{ fontWeight: 800 }}
                                                >
                                                  {meal.label}
                                                </Typography>
                                              </Box>

                                              {/* 主食・主菜・副菜・汁物 */}
                                              {mealRecipes.map((item) => (
                                                <Box
                                                  key={`${meal.key}-${item.slotKey}`}
                                                  sx={{
                                                    minWidth: 0,
                                                    overflow: "hidden",
                                                    borderRadius: 2,
                                                    bgcolor: "#FFFFFF",
                                                    border: item.recipeId
                                                      ? "1px solid #EEE3D4"
                                                      : "1px dashed #D8D0C4",
                                                  }}
                                                >
                                                  {item.recipeId ? (
                                                    <>
                                                      {item.imageUrl ? (
                                                        <Box
                                                          component="img"
                                                          src={item.imageUrl}
                                                          alt={item.name}
                                                          sx={{
                                                            width: "100%",
                                                            height: 82,
                                                            objectFit: "cover",
                                                            display: "block",
                                                          }}
                                                        />
                                                      ) : (
                                                        <Box
                                                          sx={{
                                                            height: 82,
                                                            bgcolor: "#F5F1EA",
                                                            display: "grid",
                                                            placeItems:
                                                              "center",
                                                          }}
                                                        >
                                                          <Typography
                                                            variant="caption"
                                                            color="text.secondary"
                                                          >
                                                            画像なし
                                                          </Typography>
                                                        </Box>
                                                      )}

                                                      <Typography
                                                        variant="body2"
                                                        title={item.name}
                                                        sx={{
                                                          px: 0.75,
                                                          py: 0.75,
                                                          minHeight: 44,
                                                          fontSize: 12,
                                                          fontWeight: 700,
                                                          lineHeight: 1.35,
                                                          textAlign: "center",
                                                          overflow: "hidden",
                                                          display:
                                                            "-webkit-box",
                                                          WebkitBoxOrient:
                                                            "vertical",
                                                          WebkitLineClamp: 2,
                                                        }}
                                                      >
                                                        {item.name}
                                                      </Typography>
                                                    </>
                                                  ) : (
                                                    <Box
                                                      sx={{
                                                        minHeight: 126,
                                                        display: "grid",
                                                        placeItems: "center",
                                                        bgcolor: "#FFFDFA",
                                                      }}
                                                    >
                                                      <Stack
                                                        spacing={0.25}
                                                        alignItems="center"
                                                      >
                                                        <Typography
                                                          sx={{
                                                            fontSize: 20,
                                                            color: "#AAA095",
                                                          }}
                                                        >
                                                          ＋
                                                        </Typography>

                                                        <Typography
                                                          variant="caption"
                                                          color="text.secondary"
                                                        >
                                                          未設定
                                                        </Typography>
                                                      </Stack>
                                                    </Box>
                                                  )}
                                                </Box>
                                              ))}
                                            </Fragment>
                                          );
                                        })}
                                      </Box>
                                    </Box>
                                  </Box>
                                </Stack>
                              </CardContent>
                            </CardActionArea>
                          </Card>
                        );
                      })}
                    </Stack>
                  )}

                  <Stack
                    direction="row"
                    justifyContent="space-between"
                    sx={{ mt: 3 }}
                  >
                    <Button onClick={() => setStep(1)}>日を選び直す</Button>

                    <Button
                      variant="contained"
                      disabled={!selectedSet}
                      onClick={() => setStep(3)}
                      sx={{
                        bgcolor: "#FFB830",
                        color: "#333333",
                        fontWeight: 800,
                        boxShadow: "none",
                        "&:hover": {
                          bgcolor: "#F4A914",
                          boxShadow: "none",
                        },
                      }}
                    >
                      適用内容を確認
                    </Button>
                  </Stack>
                </CardContent>
              </Card>
            ) : step === 3 ? (
              <Card
                sx={{
                  borderRadius: 3,
                  boxShadow: "0 8px 24px rgba(80, 60, 30, 0.06)",
                }}
              >
                <CardContent>
                  <Typography variant="h6" sx={{ fontWeight: 800 }}>
                    適用内容を確認
                  </Typography>

                  <Alert severity="info" sx={{ mt: 2 }}>
                    登録済みの献立は変更しません。 空いている枠だけに 「
                    {selectedSet?.name}」を適用します。
                  </Alert>

                  <Stack spacing={1.5} sx={{ mt: 2 }}>
                    {confirmationRows.map((row) => (
                      <Card
                        key={row.dateKey}
                        variant="outlined"
                        sx={{
                          borderRadius: 2,
                          borderColor: "#F1E5D5",
                        }}
                      >
                        <CardContent>
                          <Typography
                            sx={{
                              fontWeight: 800,
                            }}
                          >
                            {row.dateLabel}
                          </Typography>

                          <Stack spacing={0.75} sx={{ mt: 1.25 }}>
                            {MEALS.map((meal) => {
                              const mealSummary = row.summary.meals[meal.key];

                              return (
                                <Stack
                                  key={meal.key}
                                  direction="row"
                                  spacing={1}
                                  alignItems="center"
                                  sx={{
                                    flexWrap: "wrap",
                                  }}
                                >
                                  <Typography
                                    variant="body2"
                                    sx={{
                                      width: 36,
                                      fontWeight: 800,
                                    }}
                                  >
                                    {meal.label}
                                  </Typography>

                                  {mealSummary.applyCount > 0 && (
                                    <Chip
                                      size="small"
                                      color="success"
                                      label={`${mealSummary.applyCount}枠追加`}
                                    />
                                  )}

                                  {mealSummary.existingCount > 0 && (
                                    <Chip
                                      size="small"
                                      variant="outlined"
                                      label={`${mealSummary.existingCount}枠 登録済み`}
                                    />
                                  )}

                                  {mealSummary.remainEmptyCount > 0 && (
                                    <Chip
                                      size="small"
                                      variant="outlined"
                                      label={`${mealSummary.remainEmptyCount}枠 空きのまま`}
                                    />
                                  )}
                                </Stack>
                              );
                            })}
                          </Stack>
                        </CardContent>
                      </Card>
                    ))}
                  </Stack>

                  <Box
                    sx={{
                      mt: 2,
                      p: 2,
                      borderRadius: 2,
                      bgcolor: "#FFF3E0",
                    }}
                  >
                    <Typography sx={{ fontWeight: 800 }}>
                      合計 {totalApplyCount} 枠に追加します
                    </Typography>
                  </Box>

                  <Stack
                    direction="row"
                    justifyContent="space-between"
                    sx={{ mt: 3 }}
                  >
                    <Button disabled={applying} onClick={() => setStep(2)}>
                      セットを選び直す
                    </Button>

                    <Button
                      variant="contained"
                      disabled={applying || totalApplyCount === 0}
                      onClick={handleApply}
                      sx={{
                        bgcolor: "#66BB6A",
                        fontWeight: 800,
                        boxShadow: "none",
                        "&:hover": {
                          bgcolor: "#57A85B",
                          boxShadow: "none",
                        },
                      }}
                    >
                      {applying ? "反映中..." : "この内容で反映する"}
                    </Button>
                  </Stack>
                </CardContent>
              </Card>
            ) : (
              <Card
                sx={{
                  borderRadius: 3,
                  boxShadow: "0 8px 24px rgba(80, 60, 30, 0.06)",
                }}
              >
                <CardContent>
                  <Stack
                    spacing={2}
                    alignItems="center"
                    sx={{
                      py: 4,
                      textAlign: "center",
                    }}
                  >
                    <Typography variant="h5" sx={{ fontWeight: 800 }}>
                      献立を反映しました
                    </Typography>

                    <Typography color="text.secondary">
                      登録済みの献立は残したまま、
                      空いている枠におまかせセットを追加しました。
                    </Typography>

                    <Button
                      variant="contained"
                      onClick={() =>
                        router.push(`/recipes/weekly?weekKey=${weekKey}`)
                      }
                      sx={{
                        mt: 1,
                        bgcolor: "#FFB830",
                        color: "#333333",
                        fontWeight: 800,
                        boxShadow: "none",
                        "&:hover": {
                          bgcolor: "#F4A914",
                          boxShadow: "none",
                        },
                      }}
                    >
                      週間献立を確認する
                    </Button>
                  </Stack>
                </CardContent>
              </Card>
            )}
          </Stack>
        </Box>
      </Box>
    </AppLayout>
  );
}
