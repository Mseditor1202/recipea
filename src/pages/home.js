import React, { useEffect, useState, useCallback, useMemo } from "react";
import NextLink from "next/link";
import {
  Box,
  Typography,
  Card,
  CardContent,
  Grid,
  Button,
  Stack,
  Tabs,
  Tab,
  Divider,
  Chip,
  Skeleton,
  Snackbar,
  Alert,
  CircularProgress,
} from "@mui/material";
import {
  collection,
  doc,
  getDoc,
  getDocs,
  where,
  query,
  setDoc,
  serverTimestamp,
  limit,
  orderBy,
} from "firebase/firestore";
import { db } from "@/lib/firebase";

const DEFAULT_IMAGE = "/images/default-recipe.png";

// ✅ dailySets の中で「ズボラ用」を探すキーワード（nameに含める）
const ZUBORA_DAILYSET_KEYWORD = "ズボラ";

// ✅ Firestore collection名
const COLLECTION_WEEKLY_DAY = "weeklyDaySets";
const COLLECTION_RECIPES = "recipes";
const COLLECTION_DAILYSETS = "dailySets";

const MEAL_LABEL = { breakfast: "朝", lunch: "昼", dinner: "夜" };
const SLOT_LABEL = { staple: "主食", main: "主菜", side: "副菜", soup: "汁物" };

const MEAL_ORDER = ["breakfast", "lunch", "dinner"];
const SLOT_ORDER = ["staple", "main", "side", "soup"];
const WEEKDAY_JA = ["日", "月", "火", "水", "木", "金", "土"];

/** ===============================
 * date utils
 =============================== */
const pad2 = (n) => String(n).padStart(2, "0");
const toDateKey = (d) =>
  `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
const parseDateKey = (key) => {
  const [y, m, d] = key.split("-").map(Number);
  return new Date(y, m - 1, d);
};
const addDays = (date, diff) => {
  const d = new Date(date);
  d.setDate(d.getDate() + diff);
  return d;
};
const formatMonthTitle = (date) =>
  `${date.getFullYear()}年${date.getMonth() + 1}月`;
const formatDateTitle = (key) => {
  const d = parseDateKey(key);
  return `${d.getMonth() + 1}月 ${d.getDate()}日(${WEEKDAY_JA[d.getDay()]})`;
};
const formatMMDD = (key) => {
  const d = parseDateKey(key);
  return `${d.getMonth() + 1}/${d.getDate()}`;
};

/** ===============================
 * data helpers
 =============================== */
function collectRecipeIdsFromDay(dayData) {
  const set = new Set();
  MEAL_ORDER.forEach((mealKey) => {
    const mealData = dayData?.[mealKey] || {};
    SLOT_ORDER.forEach((slotKey) => {
      const id = mealData?.[slotKey];
      if (id) set.add(id);
    });
  });
  return set;
}

function mealFilledMap(dayData) {
  const filled = { breakfast: false, lunch: false, dinner: false };
  if (!dayData) return filled;

  MEAL_ORDER.forEach((mealKey) => {
    const mealData = dayData?.[mealKey] || {};
    filled[mealKey] = SLOT_ORDER.some((slotKey) => !!mealData?.[slotKey]);
  });

  return filled;
}

function isDayPlanEmpty(dayData) {
  if (!dayData) return true;
  return !MEAL_ORDER.some((mealKey) =>
    SLOT_ORDER.some((slotKey) => !!dayData?.[mealKey]?.[slotKey])
  );
}

function pickRepresentativeRecipeId(mealData) {
  if (!mealData) return null;
  // 代表優先順：主菜 → 主食 → 副菜 → 汁物
  const order = ["main", "staple", "side", "soup"];
  for (const k of order) {
    if (mealData[k]) return mealData[k];
  }
  return null;
}

function getRepresentative3(dayData) {
  const b = pickRepresentativeRecipeId(dayData?.breakfast);
  const l = pickRepresentativeRecipeId(dayData?.lunch);
  const d = pickRepresentativeRecipeId(dayData?.dinner);
  return { breakfast: b, lunch: l, dinner: d };
}

function dailySetToMealSlots(dailySetData) {
  // dailySets: { staple, mainDish, sideDish, soup } 想定
  // 揺れ吸収：main / side が入ってても拾う
  return {
    staple: dailySetData?.staple || null,
    main: dailySetData?.mainDish || dailySetData?.main || null,
    side: dailySetData?.sideDish || dailySetData?.side || null,
    soup: dailySetData?.soup || null,
  };
}

/** ===============================
 * 今日タブ（完成版：空状態救済UIつき）
 =============================== */
function TodayDetail({
  todayKey,
  dayData,
  recipesMap,
  loading,
  error,
  onApplyZuboraDailySetToToday,
  onLoadFatigueCandidates,
  fatigueCandidates,
  fatigueLoading,
  fatigueError,
  fatigueTargetMeal,
  setFatigueTargetMeal,
  onChooseFatigueRecipe,
  actionBusy,
}) {
  const empty = !loading && !error && isDayPlanEmpty(dayData);

  return (
    <Box sx={{ pt: 2 }}>
      <Typography variant="h5" sx={{ fontWeight: 700, mb: 1 }}>
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

      {/* ✅ 空のときだけ：ズボラ救済UI */}
      {!loading && !error && empty && (
        <Card
          sx={{
            borderRadius: 3,
            border: "1px solid #e6e6e6",
            boxShadow: "0 8px 24px rgba(0,0,0,0.04)",
            overflow: "hidden",
          }}
        >
          <CardContent>
            <Typography sx={{ fontWeight: 900, fontSize: 18, mb: 0.6 }}>
              まだ献立が入ってないよ
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
              ズボラ用に「押すだけで決まる」導線を出してるよ。
            </Typography>

            <Stack
              direction={{ xs: "column", sm: "row" }}
              spacing={1.2}
              sx={{ mb: 1.5 }}
            >
              <Button
                variant="contained"
                onClick={onApplyZuboraDailySetToToday}
                disabled={!todayKey || actionBusy}
                sx={{
                  borderRadius: 2,
                  textTransform: "none",
                  fontWeight: 900,
                  py: 1.2,
                }}
              >
                {actionBusy ? (
                  <Stack direction="row" spacing={1} alignItems="center">
                    <CircularProgress size={18} />
                    <span>セット適用中…</span>
                  </Stack>
                ) : (
                  "ズボラ用セットで今日を埋める"
                )}
              </Button>

              <Button
                variant="outlined"
                onClick={onLoadFatigueCandidates}
                disabled={!todayKey || fatigueLoading || actionBusy}
                sx={{
                  borderRadius: 2,
                  textTransform: "none",
                  fontWeight: 900,
                  py: 1.2,
                }}
              >
                {fatigueLoading ? (
                  <Stack direction="row" spacing={1} alignItems="center">
                    <CircularProgress size={18} />
                    <span>候補を探してる…</span>
                  </Stack>
                ) : (
                  "疲労モード（主菜）候補を出す"
                )}
              </Button>
            </Stack>

            <Stack direction="row" spacing={1} sx={{ mb: 1.5 }}>
              <Button
                component={NextLink}
                href="/recipes/dailyset"
                variant="text"
                sx={{ textTransform: "none", fontWeight: 900, px: 0 }}
              >
                テンプレ（献立テンプレ）を編集する
              </Button>
              <Box sx={{ flexGrow: 1 }} />
              <Button
                component={NextLink}
                href="/recipes"
                variant="text"
                sx={{ textTransform: "none", fontWeight: 900, px: 0 }}
              >
                レシピ一覧から選ぶ
              </Button>
            </Stack>

            <Divider sx={{ my: 1.2 }} />

            {/* ✅ 疲労モード候補エリア */}
            <Box sx={{ mt: 1 }}>
              <Stack
                direction={{ xs: "column", sm: "row" }}
                spacing={1}
                alignItems={{ xs: "flex-start", sm: "center" }}
                sx={{ mb: 1 }}
              >
                <Typography sx={{ fontWeight: 900, fontSize: 14 }}>
                  疲労モード：どの食事にセットする？
                </Typography>
                <Stack direction="row" spacing={0.8}>
                  {MEAL_ORDER.map((m) => (
                    <Chip
                      key={m}
                      label={MEAL_LABEL[m]}
                      clickable
                      onClick={() => setFatigueTargetMeal(m)}
                      sx={{
                        fontWeight: 900,
                        bgcolor:
                          fatigueTargetMeal === m
                            ? "rgba(25,118,210,0.10)"
                            : "#f5f5f5",
                      }}
                    />
                  ))}
                </Stack>
              </Stack>

              {fatigueError && (
                <Typography variant="body2" color="error" sx={{ mb: 1 }}>
                  {fatigueError}
                </Typography>
              )}

              {!fatigueLoading &&
                !fatigueError &&
                fatigueCandidates &&
                fatigueCandidates.length > 0 && (
                  <Grid container spacing={1.5}>
                    {fatigueCandidates.slice(0, 6).map((r) => (
                      <Grid item xs={12} sm={6} md={4} key={r.id}>
                        <Box
                          sx={{
                            border: "1px solid #eee",
                            borderRadius: 2,
                            overflow: "hidden",
                            bgcolor: "#fff",
                            display: "flex",
                            flexDirection: "column",
                          }}
                        >
                          <Box sx={{ position: "relative", height: 120 }}>
                            <Box
                              component="img"
                              src={r.imageUrl || DEFAULT_IMAGE}
                              alt={r.recipeName || "レシピ"}
                              sx={{
                                width: "100%",
                                height: "100%",
                                objectFit: "cover",
                              }}
                            />
                            <Box
                              sx={{
                                position: "absolute",
                                top: 8,
                                left: 8,
                                px: 1,
                                py: 0.2,
                                borderRadius: 999,
                                bgcolor: "rgba(255,255,255,0.92)",
                                border: "1px solid rgba(0,0,0,0.08)",
                                fontSize: 11,
                                fontWeight: 900,
                              }}
                            >
                              主菜候補
                            </Box>
                          </Box>

                          <Box sx={{ p: 1.2 }}>
                            <Typography
                              sx={{
                                fontWeight: 900,
                                fontSize: 14,
                                lineHeight: 1.35,
                                display: "-webkit-box",
                                WebkitLineClamp: 2,
                                WebkitBoxOrient: "vertical",
                                overflow: "hidden",
                                minHeight: "2.8em",
                              }}
                            >
                              {r.recipeName || "（名称未設定）"}
                            </Typography>

                            <Typography
                              variant="caption"
                              color="text.secondary"
                              sx={{ display: "block", mt: 0.2 }}
                            >
                              {typeof r.cookingTime === "number"
                                ? `目安：${r.cookingTime}分`
                                : "目安：未設定"}
                            </Typography>

                            <Stack direction="row" spacing={1} sx={{ mt: 1 }}>
                              <Button
                                variant="contained"
                                size="small"
                                onClick={() => onChooseFatigueRecipe(r.id)}
                                disabled={actionBusy}
                                sx={{
                                  borderRadius: 999,
                                  textTransform: "none",
                                  fontWeight: 900,
                                  flexGrow: 1,
                                }}
                              >
                                これにする
                              </Button>
                              <Button
                                component={NextLink}
                                href={`/recipes/${r.id}?from=home`}
                                variant="outlined"
                                size="small"
                                sx={{
                                  borderRadius: 999,
                                  textTransform: "none",
                                  fontWeight: 900,
                                }}
                              >
                                詳細
                              </Button>
                            </Stack>
                          </Box>
                        </Box>
                      </Grid>
                    ))}
                  </Grid>
                )}

              {!fatigueLoading &&
                !fatigueError &&
                fatigueCandidates &&
                fatigueCandidates.length === 0 && (
                  <Typography variant="body2" color="text.secondary">
                    条件に合う候補が見つからなかったよ。レシピに「10分/レンチン/洗い物少」
                    の情報を追加すると精度が上がる！
                  </Typography>
                )}
            </Box>
          </CardContent>
        </Card>
      )}

      {/* ✅ 空じゃないとき：従来の表示 */}
      {!loading && !error && !empty && dayData && (
        <Stack spacing={3} sx={{ mt: 0 }}>
          {MEAL_ORDER.map((mealKey) => {
            const mealData = dayData[mealKey] || {};

            return (
              <Card
                key={mealKey}
                sx={{
                  borderRadius: 3,
                  border: "1px solid #e6e6e6",
                  boxShadow: "0 8px 24px rgba(0,0,0,0.04)",
                }}
              >
                <CardContent>
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
                              border: "1px solid #eee",
                              boxShadow: "0 4px 12px rgba(0,0,0,0.04)",
                              display: "flex",
                              flexDirection: "column",
                            }}
                          >
                            <Box sx={{ position: "relative", height: 110 }}>
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

      {!loading && !error && empty && !todayKey && (
        <Typography variant="body2" color="text.secondary">
          日付情報を読み込み中です…
        </Typography>
      )}
    </Box>
  );
}

/** ===============================
 * A：月間カレンダー（7列固定・セル大）
 =============================== */
function CalendarMonthGridA({
  monthDate,
  dayDocsByKey,
  selectedDayKey,
  onSelectDay,
  todayKey,
  cellHeight = 118,
}) {
  const year = monthDate.getFullYear();
  const month = monthDate.getMonth();

  const first = new Date(year, month, 1);
  const startWeekday = first.getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();

  const cells = [];
  for (let i = 0; i < 42; i++) {
    const dayNum = i - startWeekday + 1;
    if (dayNum < 1 || dayNum > daysInMonth) cells.push(null);
    else cells.push(new Date(year, month, dayNum));
  }

  return (
    <Box sx={{ borderTop: "1px solid #e9e9e9" }}>
      {/* 曜日ヘッダー */}
      <Box
        sx={{
          display: "grid",
          gridTemplateColumns: "repeat(7, 1fr)",
          borderBottom: "1px solid #e9e9e9",
          bgcolor: "#fff",
        }}
      >
        {WEEKDAY_JA.map((w, idx) => (
          <Box
            key={w}
            sx={{
              py: 1,
              textAlign: "center",
              fontWeight: 900,
              fontSize: 13,
              color: idx === 0 ? "#d32f2f" : idx === 6 ? "#1976d2" : "#555",
            }}
          >
            {w}
          </Box>
        ))}
      </Box>

      {/* 日付セル */}
      <Box
        sx={{
          display: "grid",
          gridTemplateColumns: "repeat(7, 1fr)",
          bgcolor: "#fff",
        }}
      >
        {cells.map((d, idx) => {
          const isEmpty = !d;
          const dayKey = d ? toDateKey(d) : "";
          const isSelected = !!d && dayKey === selectedDayKey;
          const isToday = !!d && dayKey === todayKey;

          const weekday = d ? d.getDay() : 0;
          const numColor =
            weekday === 0 ? "#d32f2f" : weekday === 6 ? "#1976d2" : "#333";

          const filled = d ? mealFilledMap(dayDocsByKey?.[dayKey]) : null;

          const isLastCol = idx % 7 === 6;
          const isLastRow = idx >= 35;

          return (
            <Box
              key={isEmpty ? `e-${idx}` : dayKey}
              onClick={() => !isEmpty && onSelectDay(dayKey)}
              sx={{
                height: cellHeight,
                position: "relative",
                cursor: isEmpty ? "default" : "pointer",
                userSelect: "none",
                bgcolor: isSelected
                  ? "rgba(25,118,210,0.08)"
                  : isToday
                  ? "rgba(255,193,7,0.10)"
                  : "#fff",
                borderRight: isLastCol ? "none" : "1px solid #e9e9e9",
                borderBottom: isLastRow ? "none" : "1px solid #e9e9e9",
                outline: isSelected
                  ? "2px solid rgba(25,118,210,0.55)"
                  : "none",
                outlineOffset: isSelected ? "-2px" : 0,
              }}
            >
              {!isEmpty && (
                <Box sx={{ p: 1 }}>
                  <Typography sx={{ fontWeight: 900, color: numColor }}>
                    {d.getDate()}
                  </Typography>

                  {/* 朝昼夜バッジ */}
                  <Stack
                    direction="row"
                    spacing={0.6}
                    sx={{ position: "absolute", left: 10, bottom: 10 }}
                  >
                    {filled?.breakfast && (
                      <Box
                        sx={{
                          width: 22,
                          height: 22,
                          borderRadius: 999,
                          bgcolor: "#F6A623",
                          color: "#fff",
                          fontSize: 11,
                          fontWeight: 900,
                          display: "grid",
                          placeItems: "center",
                          boxShadow: "0 2px 8px rgba(0,0,0,0.10)",
                        }}
                      >
                        朝
                      </Box>
                    )}
                    {filled?.lunch && (
                      <Box
                        sx={{
                          width: 22,
                          height: 22,
                          borderRadius: 999,
                          bgcolor: "#4A90E2",
                          color: "#fff",
                          fontSize: 11,
                          fontWeight: 900,
                          display: "grid",
                          placeItems: "center",
                          boxShadow: "0 2px 8px rgba(0,0,0,0.10)",
                        }}
                      >
                        昼
                      </Box>
                    )}
                    {filled?.dinner && (
                      <Box
                        sx={{
                          width: 22,
                          height: 22,
                          borderRadius: 999,
                          bgcolor: "#7ED321",
                          color: "#fff",
                          fontSize: 11,
                          fontWeight: 900,
                          display: "grid",
                          placeItems: "center",
                          boxShadow: "0 2px 8px rgba(0,0,0,0.10)",
                        }}
                      >
                        夜
                      </Box>
                    )}
                  </Stack>
                </Box>
              )}
            </Box>
          );
        })}
      </Box>
    </Box>
  );
}

export default function HomeTodayMenu() {
  const [tab, setTab] = useState(0);

  const [todayKey, setTodayKey] = useState("");
  const [selectedDayKey, setSelectedDayKey] = useState("");

  const [rangeKeys, setRangeKeys] = useState([]);

  const [dayDocsByKey, setDayDocsByKey] = useState({});
  const [recipesById, setRecipesById] = useState({});

  const [loadingRange, setLoadingRange] = useState(true);
  const [error, setError] = useState("");

  const [monthDate, setMonthDate] = useState(new Date());

  // ✅ 空状態救済用 state
  const [actionBusy, setActionBusy] = useState(false);

  const [fatigueLoading, setFatigueLoading] = useState(false);
  const [fatigueError, setFatigueError] = useState("");
  const [fatigueCandidates, setFatigueCandidates] = useState([]);
  const [fatigueTargetMeal, setFatigueTargetMeal] = useState("dinner");

  const [toast, setToast] = useState({
    open: false,
    message: "",
    severity: "success",
  });
  const showToast = useCallback((message, severity = "success") => {
    setToast({ open: true, message, severity });
  }, []);

  useEffect(() => {
    const d = new Date();
    const key = toDateKey(d);

    setTodayKey(key);
    setSelectedDayKey(key);

    // 直近30日（取得用）
    const keys = [];
    for (let i = 29; i >= 0; i--) keys.push(toDateKey(addDays(d, -i)));
    setRangeKeys(keys);

    // 今月表示
    setMonthDate(new Date(d.getFullYear(), d.getMonth(), 1));
  }, []);

  useEffect(() => {
    if (!rangeKeys || rangeKeys.length === 0) return;

    const fetchRange = async () => {
      setLoadingRange(true);
      setError("");

      try {
        const snaps = await Promise.all(
          rangeKeys.map((key) => getDoc(doc(db, COLLECTION_WEEKLY_DAY, key)))
        );

        const map = {};
        const recipeIdSet = new Set();

        snaps.forEach((snap, i) => {
          const key = rangeKeys[i];
          if (!snap.exists()) return;

          const data = snap.data() || {};
          map[key] = data;

          collectRecipeIdsFromDay(data).forEach((id) => recipeIdSet.add(id));
        });

        setDayDocsByKey(map);

        if (recipeIdSet.size === 0) {
          setRecipesById({});
          setLoadingRange(false);
          return;
        }

        const allIds = Array.from(recipeIdSet);
        const recipesCol = collection(db, COLLECTION_RECIPES);
        const recipesMapTmp = {};

        // where in は10件制限 → 分割
        const chunkSize = 10;
        for (let i = 0; i < allIds.length; i += chunkSize) {
          const chunk = allIds.slice(i, i + chunkSize);
          const q = query(recipesCol, where("__name__", "in", chunk));
          const snapRecipes = await getDocs(q);

          snapRecipes.forEach((docSnap) => {
            recipesMapTmp[docSnap.id] = { id: docSnap.id, ...docSnap.data() };
          });
        }

        setRecipesById(recipesMapTmp);
        setLoadingRange(false);
      } catch (e) {
        console.error("Home tabs fetch error:", e);
        setError("献立を読み込む際にエラーが発生しました。");
        setLoadingRange(false);
      }
    };

    fetchRange();
  }, [rangeKeys]);

  const handleTabChange = useCallback((_, next) => setTab(next), []);
  const handleSelectDay = useCallback((key) => setSelectedDayKey(key), []);

  const selectedDayData = selectedDayKey ? dayDocsByKey[selectedDayKey] : null;

  const prevMonth = useCallback(() => {
    setMonthDate(
      (prev) => new Date(prev.getFullYear(), prev.getMonth() - 1, 1)
    );
  }, []);
  const nextMonth = useCallback(() => {
    setMonthDate(
      (prev) => new Date(prev.getFullYear(), prev.getMonth() + 1, 1)
    );
  }, []);

  const refreshDayAndRecipes = useCallback(
    async (key) => {
      const snap = await getDoc(doc(db, COLLECTION_WEEKLY_DAY, key));
      const nextDay = snap.exists() ? snap.data() || {} : null;

      setDayDocsByKey((prev) => {
        const next = { ...prev };
        if (nextDay) next[key] = nextDay;
        else delete next[key];
        return next;
      });

      if (!nextDay) return;

      const needed = Array.from(collectRecipeIdsFromDay(nextDay)).filter(
        (id) => !recipesById[id]
      );

      if (needed.length === 0) return;

      const recipesCol = collection(db, COLLECTION_RECIPES);
      const chunkSize = 10;
      const fetched = {};

      for (let i = 0; i < needed.length; i += chunkSize) {
        const chunk = needed.slice(i, i + chunkSize);
        const q = query(recipesCol, where("__name__", "in", chunk));
        const snapRecipes = await getDocs(q);
        snapRecipes.forEach((docSnap) => {
          fetched[docSnap.id] = { id: docSnap.id, ...docSnap.data() };
        });
      }

      setRecipesById((prev) => ({ ...prev, ...fetched }));
    },
    [recipesById]
  );

  /** ===============================
   * ✅ ①案：dailySetsを活用して「今日」を埋める（weeklyTemplates不要）
   * - 優先：nameに「ズボラ」含む
   * - 次点：createdAt desc の先頭
   * - 朝昼夜に同じセットを流し込む
   =============================== */
  const applyZuboraDailySetToToday = useCallback(async () => {
    if (!todayKey) return;

    setActionBusy(true);
    setFatigueError("");

    try {
      const dailyRef = collection(db, COLLECTION_DAILYSETS);

      // createdAt が無いと orderBy で落ちるので、ここは try/catch で保険を掛ける
      let snap;
      try {
        const qDaily = query(dailyRef, orderBy("createdAt", "desc"), limit(30));
        snap = await getDocs(qDaily);
      } catch (e) {
        // createdAt が無い時用：最小限 fallback（limitだけ）
        console.warn("dailySets orderBy(createdAt) failed. fallback:", e);
        const qDaily = query(dailyRef, limit(30));
        snap = await getDocs(qDaily);
      }

      if (!snap || snap.empty) {
        showToast(
          "献立テンプレ（dailySets）がまだ無いよ。先に作ってね。",
          "error"
        );
        return;
      }

      const list = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
      const chosen =
        list.find((d) => (d.name || "").includes(ZUBORA_DAILYSET_KEYWORD)) ||
        list[0];

      const dailySetId = chosen?.id;
      if (!dailySetId) {
        showToast("ズボラ用セットが見つからなかったよ。", "error");
        return;
      }

      const dsSnap = await getDoc(doc(db, COLLECTION_DAILYSETS, dailySetId));
      if (!dsSnap.exists()) {
        showToast("選ばれたテンプレが見つからないよ（dailySets）", "error");
        return;
      }

      const slots = dailySetToMealSlots(dsSnap.data() || {});

      await setDoc(
        doc(db, COLLECTION_WEEKLY_DAY, todayKey),
        {
          breakfast: slots,
          lunch: slots,
          dinner: slots,
          templateIds: {
            breakfast: dailySetId,
            lunch: dailySetId,
            dinner: dailySetId,
          },
          updatedAt: serverTimestamp(),
        },
        { merge: true }
      );

      await refreshDayAndRecipes(todayKey);
      showToast("ズボラ用セットで今日の献立を埋めたよ！", "success");
    } catch (e) {
      console.error("applyZuboraDailySetToToday error:", e);
      showToast("ズボラ用セット適用でエラーが発生したよ。", "error");
    } finally {
      setActionBusy(false);
    }
  }, [todayKey, refreshDayAndRecipes, showToast]);

  /** ===============================
   * ② 疲労モード候補（主菜）を取得
   * - 主菜 & cookingTime<=10（インデックス作成済み想定）
   =============================== */
  const loadFatigueCandidates = useCallback(async () => {
    setFatigueLoading(true);
    setFatigueError("");
    setFatigueCandidates([]);

    try {
      const recipesCol = collection(db, COLLECTION_RECIPES);
      const q1 = query(
        recipesCol,
        where("category", "==", "main"),
        where("cookingTime", "<=", 10),
        limit(20)
      );
      const s1 = await getDocs(q1);
      const list = s1.docs.map((d) => ({ id: d.id, ...d.data() }));

      setFatigueCandidates(list);
      if (list.length === 0) {
        setFatigueError(
          "条件（主菜 & 10分以内）に合うレシピが見つからなかったよ。"
        );
      }
    } catch (e) {
      console.error("loadFatigueCandidates error:", e);
      setFatigueError("疲労モード候補の取得でエラーが出たよ。");
    } finally {
      setFatigueLoading(false);
    }
  }, []);

  /** ===============================
   * ③ 疲労モード：候補を「今日」にセット（主菜だけ）
   =============================== */
  const chooseFatigueRecipe = useCallback(
    async (recipeId) => {
      if (!todayKey || !recipeId) return;

      setActionBusy(true);
      try {
        const current = dayDocsByKey?.[todayKey] || null;
        const nextMeal = {
          ...(current?.[fatigueTargetMeal] || {}),
          main: recipeId,
        };

        await setDoc(
          doc(db, COLLECTION_WEEKLY_DAY, todayKey),
          {
            [fatigueTargetMeal]: nextMeal,
            updatedAt: serverTimestamp(),
          },
          { merge: true }
        );

        await refreshDayAndRecipes(todayKey);
        showToast(
          `疲労モードで「${MEAL_LABEL[fatigueTargetMeal]}の主菜」をセットしたよ！`,
          "success"
        );
      } catch (e) {
        console.error("chooseFatigueRecipe error:", e);
        showToast("セット中にエラーが出たよ。", "error");
      } finally {
        setActionBusy(false);
      }
    },
    [todayKey, dayDocsByKey, fatigueTargetMeal, refreshDayAndRecipes, showToast]
  );

  const selectedHasPlan = useMemo(() => {
    return selectedDayData && !isDayPlanEmpty(selectedDayData);
  }, [selectedDayData]);

  return (
    <Box
      sx={{
        maxWidth: 1100,
        mx: "auto",
        mt: 4,
        px: { xs: 2, md: 3 },
        pb: 5,
      }}
    >
      {/* Tabs（2つだけ） */}
      <Box
        sx={{
          border: "1px solid #e6e6e6",
          borderRadius: 2,
          overflow: "hidden",
          bgcolor: "#fff",
        }}
      >
        <Tabs
          value={tab}
          onChange={handleTabChange}
          variant="fullWidth"
          sx={{
            minHeight: 44,
            "& .MuiTab-root": {
              minHeight: 44,
              fontWeight: 900,
              textTransform: "none",
            },
            "& .MuiTabs-indicator": { height: 4, borderRadius: 999 },
          }}
        >
          <Tab label="今日の献立" />
          <Tab label="カレンダー" />
        </Tabs>
        <Divider />
      </Box>

      {error && (
        <Typography variant="body2" color="error" sx={{ mt: 2 }}>
          {error}
        </Typography>
      )}

      {/* 今日 */}
      {tab === 0 && (
        <TodayDetail
          todayKey={todayKey}
          dayData={todayKey ? dayDocsByKey[todayKey] : null}
          recipesMap={recipesById}
          loading={loadingRange}
          error={error}
          onApplyZuboraDailySetToToday={applyZuboraDailySetToToday}
          onLoadFatigueCandidates={loadFatigueCandidates}
          fatigueCandidates={fatigueCandidates}
          fatigueLoading={fatigueLoading}
          fatigueError={fatigueError}
          fatigueTargetMeal={fatigueTargetMeal}
          setFatigueTargetMeal={setFatigueTargetMeal}
          onChooseFatigueRecipe={chooseFatigueRecipe}
          actionBusy={actionBusy}
        />
      )}

      {/* カレンダー */}
      {tab === 1 && (
        <Box sx={{ pt: 2 }}>
          <Box
            sx={{
              border: "1px solid #e6e6e6",
              borderRadius: 2,
              bgcolor: "#fff",
              overflow: "hidden",
            }}
          >
            {/* 上：カレンダーゾーン */}
            <Box sx={{ px: { xs: 1.5, md: 2 }, pt: 2, pb: 1.5 }}>
              <Stack
                direction="row"
                alignItems="center"
                justifyContent="space-between"
                sx={{ mb: 1 }}
              >
                <Button
                  variant="outlined"
                  onClick={prevMonth}
                  sx={{
                    borderRadius: 999,
                    textTransform: "none",
                    minWidth: 92,
                    fontWeight: 900,
                  }}
                >
                  前の月
                </Button>

                <Typography
                  variant="h6"
                  sx={{ fontWeight: 900, letterSpacing: "0.02em" }}
                >
                  {formatMonthTitle(monthDate)}
                </Typography>

                <Button
                  variant="outlined"
                  onClick={nextMonth}
                  sx={{
                    borderRadius: 999,
                    textTransform: "none",
                    minWidth: 92,
                    fontWeight: 900,
                  }}
                >
                  次の月
                </Button>
              </Stack>

              <CalendarMonthGridA
                monthDate={monthDate}
                dayDocsByKey={dayDocsByKey}
                selectedDayKey={selectedDayKey}
                onSelectDay={handleSelectDay}
                todayKey={todayKey}
                cellHeight={118}
              />
            </Box>

            <Divider />

            {/* 下：献立ゾーン */}
            <Box>
              <Box sx={{ px: { xs: 1.5, md: 2 }, py: 1.6 }}>
                <Stack
                  direction={{ xs: "column", sm: "row" }}
                  alignItems={{ xs: "flex-start", sm: "center" }}
                  justifyContent="space-between"
                  spacing={1}
                >
                  <Typography sx={{ fontWeight: 900, fontSize: 18 }}>
                    {selectedDayKey
                      ? `${formatDateTitle(selectedDayKey)} の献立`
                      : "— の献立"}
                  </Typography>

                  <Stack direction="row" spacing={1}>
                    <Chip
                      label={
                        selectedHasPlan
                          ? "献立あり（選択日）"
                          : "未登録（選択日）"
                      }
                      sx={{
                        fontWeight: 900,
                        bgcolor: selectedHasPlan ? "#ffebee" : "#f5f5f5",
                        color: selectedHasPlan ? "#d32f2f" : "#666",
                      }}
                    />
                    <Chip
                      label={`選択：${
                        selectedDayKey ? formatMMDD(selectedDayKey) : "-"
                      }`}
                      sx={{ fontWeight: 900 }}
                    />
                  </Stack>
                </Stack>
              </Box>

              <Divider />

              <Box sx={{ p: { xs: 1.5, md: 2 } }}>
                {(() => {
                  const rep = getRepresentative3(selectedDayData || null);
                  const items = [
                    {
                      key: "breakfast",
                      label: "朝の献立",
                      id: rep.breakfast,
                      tint: "#fff5ea",
                    },
                    {
                      key: "lunch",
                      label: "昼の献立",
                      id: rep.lunch,
                      tint: "#eef5ff",
                    },
                    {
                      key: "dinner",
                      label: "夜の献立",
                      id: rep.dinner,
                      tint: "#eefaf0",
                    },
                  ];

                  if (loadingRange) {
                    return (
                      <Grid container spacing={2}>
                        {items.map((it) => (
                          <Grid item xs={12} md={4} key={it.key}>
                            <Box
                              sx={{
                                border: "1px solid #eee",
                                borderRadius: 2,
                                p: 1.6,
                              }}
                            >
                              <Skeleton width="50%" />
                              <Skeleton
                                variant="rectangular"
                                height={200}
                                sx={{ mt: 1 }}
                              />
                              <Skeleton width="70%" sx={{ mt: 1 }} />
                              <Skeleton height={44} sx={{ mt: 1 }} />
                            </Box>
                          </Grid>
                        ))}
                      </Grid>
                    );
                  }

                  return (
                    <Grid container spacing={2}>
                      {items.map((it) => {
                        const recipe = it.id ? recipesById[it.id] : null;
                        const img = recipe?.imageUrl || DEFAULT_IMAGE;
                        const name = recipe?.recipeName || "未登録";

                        return (
                          <Grid item xs={12} md={4} key={it.key}>
                            <Box
                              sx={{
                                border: "1px solid #eee",
                                borderRadius: 2,
                                overflow: "hidden",
                                bgcolor: "#fff",
                                height: "100%",
                                display: "flex",
                                flexDirection: "column",
                              }}
                            >
                              {/* 帯 */}
                              <Box
                                sx={{
                                  px: 1.6,
                                  py: 1.1,
                                  bgcolor: it.tint,
                                  borderBottom: "1px solid #eee",
                                }}
                              >
                                <Typography
                                  sx={{ fontWeight: 900, fontSize: 14 }}
                                >
                                  {it.label}
                                </Typography>
                              </Box>

                              {/* 中身 */}
                              <Box
                                sx={{
                                  p: 1.6,
                                  flexGrow: 1,
                                  display: "flex",
                                  flexDirection: "column",
                                }}
                              >
                                <Box
                                  component="img"
                                  src={img}
                                  alt={name}
                                  sx={{
                                    width: "100%",
                                    height: { xs: 180, sm: 200, md: 180 },
                                    objectFit: "cover",
                                    borderRadius: 2,
                                    border: "1px solid #eee",
                                  }}
                                />

                                <Typography
                                  sx={{
                                    fontWeight: 900,
                                    mt: 1.2,
                                    mb: 1.2,
                                    fontSize: 15,
                                    lineHeight: 1.35,
                                    display: "-webkit-box",
                                    WebkitLineClamp: 2,
                                    WebkitBoxOrient: "vertical",
                                    overflow: "hidden",
                                    minHeight: "2.8em",
                                  }}
                                  title={name}
                                >
                                  {name}
                                </Typography>

                                {/* ✅ 日付連動して weekly へ */}
                                <Box sx={{ mt: "auto" }}>
                                  <Button
                                    component={NextLink}
                                    href={`/recipes/weekly?dayKey=${
                                      selectedDayKey || todayKey
                                    }`}
                                    variant="contained"
                                    fullWidth
                                    sx={{
                                      borderRadius: 1.8,
                                      textTransform: "none",
                                      fontWeight: 900,
                                      py: 1.1,
                                      fontSize: 14,
                                    }}
                                  >
                                    レシピを見る
                                  </Button>
                                </Box>
                              </Box>
                            </Box>
                          </Grid>
                        );
                      })}
                    </Grid>
                  );
                })()}
              </Box>
            </Box>
          </Box>
        </Box>
      )}

      <Snackbar
        open={toast.open}
        autoHideDuration={2500}
        onClose={() => setToast((p) => ({ ...p, open: false }))}
        anchorOrigin={{ vertical: "bottom", horizontal: "center" }}
      >
        <Alert
          onClose={() => setToast((p) => ({ ...p, open: false }))}
          severity={toast.severity}
          sx={{ width: "100%", fontWeight: 900 }}
        >
          {toast.message}
        </Alert>
      </Snackbar>
    </Box>
  );
}
