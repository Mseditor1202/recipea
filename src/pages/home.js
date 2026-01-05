// pages/home/index.jsx
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

// dailySets の中で「ズボラ用」を探すキーワード（nameに含める）
const ZUBORA_DAILYSET_KEYWORD = "ズボラ";

// Firestore collection名
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
 * 今日タブ
 =============================== */
function TodayDetail({
  todayKey,
  dayData,
  recipesMap,
  loading,
  error,
  onApplyZuboraDailySetToToday,
  onChangeSlotRecipe,
  onDeleteSlotRecipe,
  actionBusy,
}) {
  const empty = !loading && !error && isDayPlanEmpty(dayData);

  return (
    <Box sx={{ pt: 2 }}>
      <Typography variant="h5" sx={{ fontWeight: 900, mb: 1 }}>
        今日の献立{todayKey ? ` (${todayKey}) ` : "日付情報を読み込み中です…"}
      </Typography>

      <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
        朝・昼・夜（主食 / 主菜 / 副菜 /
        汁物）の献立を登録・変更・削除できます。
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

      {/* 空のときだけ：ズボラ救済 */}
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
              今日の献立はまだ作ってません。ズボラ用セットで登録しませんか？
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
              「ズボラ用セット」を使えば、朝・昼・夜のベースの献立が自動で作れます。
              作成後の部分的な変更も可能です。
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
                  "ズボラ用セットで今日を埋める（疲れたとき）"
                )}
              </Button>

              <Button
                component={NextLink}
                href="/recipes/weekly"
                variant="outlined"
                sx={{
                  borderRadius: 2,
                  textTransform: "none",
                  fontWeight: 900,
                  py: 1.2,
                }}
              >
                今日の献立を登録してみる（頑張れる日だけ）
              </Button>
            </Stack>
          </CardContent>
        </Card>
      )}

      {/* 空じゃないとき：朝昼夜の縦積み */}
      {!loading && !error && !empty && dayData && (
        <Stack spacing={2.5} sx={{ mt: 2 }}>
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
                  <Stack
                    direction="row"
                    alignItems="center"
                    justifyContent="space-between"
                    sx={{ mb: 1.5 }}
                  >
                    <Typography
                      variant="h6"
                      sx={{ fontWeight: 900, letterSpacing: "0.05em" }}
                    >
                      {MEAL_LABEL[mealKey]} の献立
                    </Typography>
                  </Stack>

                  {/* 4枠を「1列」で並べる（横スクロール対応） */}
                  <Box
                    sx={{
                      display: "flex",
                      gap: 12 / 8,
                      overflowX: "auto",
                      pb: 0.5,
                      WebkitOverflowScrolling: "touch",
                      scrollSnapType: "x mandatory",
                    }}
                  >
                    {SLOT_ORDER.map((slotKey) => {
                      const recipeId = mealData?.[slotKey] || null;
                      const recipe = recipeId ? recipesMap?.[recipeId] : null;
                      const title = recipe?.recipeName || "未登録";
                      const img = recipe?.imageUrl || DEFAULT_IMAGE;

                      return (
                        <Card
                          key={`${mealKey}-${slotKey}`}
                          variant="outlined"
                          sx={{
                            flex: "0 0 auto",
                            width: { xs: 255, sm: 255, md: 255 },
                            borderRadius: 2.5,
                            overflow: "hidden",
                            borderColor: "#eee",
                            boxShadow: "0 4px 12px rgba(0,0,0,0.04)",
                            scrollSnapAlign: "start",
                          }}
                        >
                          <Box sx={{ position: "relative" }}>
                            <Box
                              component="img"
                              src={img}
                              alt={title}
                              sx={{
                                width: "100%",
                                height: 120,
                                objectFit: "cover",
                              }}
                            />
                            <Box
                              sx={{
                                position: "absolute",
                                top: 8,
                                left: 8,
                                px: 1,
                                py: 0.25,
                                borderRadius: 999,
                                bgcolor: "rgba(255,255,255,0.95)",
                                border: "1px solid rgba(0,0,0,0.08)",
                                fontSize: 11,
                                fontWeight: 900,
                              }}
                            >
                              {SLOT_LABEL[slotKey]}
                            </Box>
                          </Box>

                          <Box sx={{ p: 1.2 }}>
                            <Typography
                              sx={{
                                fontWeight: 400,
                                fontSize: 13,
                                lineHeight: 1.35,
                                display: "-webkit-box",
                                WebkitLineClamp: 2,
                                WebkitBoxOrient: "vertical",
                                overflow: "hidden",
                                minHeight: "2.7em",
                              }}
                              title={title}
                            >
                              {title}
                            </Typography>

                            <Stack
                              direction="row"
                              spacing={1}
                              sx={{ mt: 1.1 }}
                              alignItems="center"
                              flexWrap="wrap"
                            >
                              <Button
                                variant="outlined"
                                disabled={!recipeId || actionBusy}
                                component={NextLink}
                                href={
                                  recipeId
                                    ? `/recipes/${recipeId}?from=home`
                                    : "#"
                                }
                                sx={{
                                  borderRadius: 999,
                                  textTransform: "none",
                                  fontWeight: 900,
                                  px: 2,
                                }}
                              >
                                レシピ
                              </Button>

                              <Button
                                variant="contained"
                                onClick={() =>
                                  onChangeSlotRecipe(todayKey, mealKey, slotKey)
                                }
                                disabled={!todayKey || actionBusy}
                                sx={{
                                  borderRadius: 999,
                                  textTransform: "none",
                                  fontWeight: 900,
                                  px: 2,
                                }}
                              >
                                変更
                              </Button>

                              <Button
                                variant="outlined"
                                color="error"
                                onClick={() =>
                                  onDeleteSlotRecipe(todayKey, mealKey, slotKey)
                                }
                                disabled={!todayKey || !recipeId || actionBusy}
                                sx={{
                                  borderRadius: 999,
                                  textTransform: "none",
                                  fontWeight: 900,
                                  px: 2,
                                }}
                              >
                                削除
                              </Button>
                            </Stack>
                          </Box>
                        </Card>
                      );
                    })}
                  </Box>
                </CardContent>
              </Card>
            );
          })}
        </Stack>
      )}
    </Box>
  );
}

/** ===============================
 * 月間カレンダー（7列固定）
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
  for (let i = 0; i < 35; i++) {
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

/** ===============================
 * 朝/昼/夜スライド + 2x2（主食/主菜/副菜/汁物）
 =============================== */
function MealSlidePanelV2({
  mealKey,
  onChangeMeal,
  selectedDayKey,
  todayKey,
  selectedDayData,
  recipesById,
  loadingRange,
  selectedHasPlan,
}) {
  const mealIndex = MEAL_ORDER.indexOf(mealKey);
  const dateTitle = selectedDayKey ? formatDateTitle(selectedDayKey) : "—";
  const mmdd = selectedDayKey ? formatMMDD(selectedDayKey) : "-";

  const goPrev = () => {
    const next = (mealIndex - 1 + MEAL_ORDER.length) % MEAL_ORDER.length;
    onChangeMeal(MEAL_ORDER[next]);
  };
  const goNext = () => {
    const next = (mealIndex + 1) % MEAL_ORDER.length;
    onChangeMeal(MEAL_ORDER[next]);
  };

  const mealData = selectedDayData?.[mealKey] || {};
  const titleKey = selectedDayKey || todayKey;

  return (
    <Box
      sx={{
        maxWidth: 760,
        mx: "auto",
        borderRadius: 4,
        border: "1px solid #e6e9f0",
        bgcolor: "#fff",
        overflow: "hidden",
        boxShadow: "0 18px 40px rgba(15, 23, 42, 0.08)",
        mb: 2.5,
      }}
    >
      {/* Header */}
      <Box sx={{ px: { xs: 2, sm: 3 }, py: { xs: 2.2, sm: 2.6 } }}>
        <Stack
          direction="row"
          alignItems="center"
          justifyContent="space-between"
        >
          <Typography
            sx={{
              fontSize: { xs: 28, sm: 34 },
              fontWeight: 950,
              letterSpacing: "0.02em",
            }}
          >
            {dateTitle} の献立
          </Typography>

          <Box
            sx={{
              display: "inline-flex",
              alignItems: "center",
              gap: 0.8,
              px: 2,
              py: 1,
              borderRadius: 999,
              fontWeight: 900,
              fontSize: 13,
              bgcolor: selectedHasPlan ? "#ffe9ee" : "#f1f3f6",
              color: selectedHasPlan ? "#d32f2f" : "#667085",
            }}
          >
            {selectedHasPlan ? "献立あり（選択日）" : "未登録（選択日）"}
            <span style={{ fontWeight: 900, fontSize: 16, lineHeight: 1 }}>
              ›
            </span>
          </Box>
        </Stack>
      </Box>

      {/* Nav row */}
      <Box
        sx={{
          px: { xs: 2, sm: 3 },
          py: 1.8,
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 2,
          borderTop: "1px solid #eef1f6",
        }}
      >
        <Button
          onClick={goPrev}
          sx={{
            width: 64,
            height: 64,
            borderRadius: 999,
            bgcolor: "#eef1f6",
            border: "1px solid #e6e9f0",
            boxShadow: "0 10px 18px rgba(15, 23, 42, 0.06)",
            "&:hover": { bgcolor: "#e9edf5" },
          }}
        >
          <Typography sx={{ fontSize: 28, fontWeight: 900, color: "#1f2a37" }}>
            ‹
          </Typography>
        </Button>

        <Box
          sx={{
            bgcolor: "#eaf1ff",
            border: "1px solid #d7e5ff",
            borderRadius: 999,
            p: 0.6,
            display: "inline-flex",
            gap: 0.6,
            minWidth: 260,
            justifyContent: "center",
          }}
        >
          {MEAL_ORDER.map((k) => {
            const active = k === mealKey;
            return (
              <Box
                key={k}
                onClick={() => onChangeMeal(k)}
                sx={{
                  px: 3,
                  py: 1.1,
                  borderRadius: 999,
                  fontWeight: 950,
                  fontSize: 16,
                  letterSpacing: "0.02em",
                  cursor: "pointer",
                  userSelect: "none",
                  bgcolor: active ? "#2F6BD8" : "transparent",
                  color: active ? "#fff" : "#1f2a37",
                  boxShadow: active
                    ? "0 10px 18px rgba(47,107,216,0.28)"
                    : "none",
                  transition: "all 140ms ease",
                }}
              >
                {MEAL_LABEL[k]}
              </Box>
            );
          })}
        </Box>

        <Button
          onClick={goNext}
          sx={{
            width: 64,
            height: 64,
            borderRadius: 999,
            bgcolor: "#eef1f6",
            border: "1px solid #e6e9f0",
            boxShadow: "0 10px 18px rgba(15, 23, 42, 0.06)",
            "&:hover": { bgcolor: "#e9edf5" },
          }}
        >
          <Typography sx={{ fontSize: 28, fontWeight: 900, color: "#1f2a37" }}>
            ›
          </Typography>
        </Button>
      </Box>

      {/* Grid */}
      <Box
        sx={{
          px: { xs: 2, sm: 3 },
          py: 2.2,
          borderTop: "1px solid #eef1f6",
        }}
      >
        {loadingRange ? (
          <Grid container spacing={2}>
            {SLOT_ORDER.map((s) => (
              <Grid item xs={12} sm={6} key={s}>
                <Box sx={{ borderRadius: 2.6, overflow: "hidden" }}>
                  <Skeleton variant="rectangular" height={150} />
                  <Box sx={{ p: 1.4 }}>
                    <Skeleton width="40%" />
                    <Skeleton width="80%" />
                  </Box>
                </Box>
              </Grid>
            ))}
          </Grid>
        ) : (
          <Grid container spacing={2}>
            {SLOT_ORDER.map((slotKey) => {
              const recipeId = mealData?.[slotKey] || null;
              const recipe = recipeId ? recipesById?.[recipeId] : null;

              const img = recipe?.imageUrl || DEFAULT_IMAGE;
              const name = recipe?.recipeName || "未登録";
              const clickable = !!recipeId;

              return (
                <Grid
                  item
                  xs={12}
                  sm={6}
                  sx={{ width: 320, maxWidth: 320 }}
                  key={slotKey}
                >
                  <Card
                    sx={{
                      borderRadius: 2.6,
                      border: "1px solid #e7ebf3",
                      overflow: "hidden",
                      bgcolor: "#fff",
                      boxShadow: "0 10px 18px rgba(15, 23, 42, 0.06)",
                      cursor: clickable ? "pointer" : "default",
                      transition: "transform 120ms ease",
                      "&:hover": clickable
                        ? { transform: "translateY(-2px)" }
                        : {},
                    }}
                    onClick={() => {
                      if (!recipeId) return;
                      window.location.href = `/recipes/${recipeId}?from=home`;
                    }}
                  >
                    <Box sx={{ position: "relative" }}>
                      <Box
                        component="img"
                        src={img}
                        alt={name}
                        sx={{
                          width: "100%",
                          height: { xs: 140, sm: 150 },
                          objectFit: "cover",
                          filter: recipeId ? "none" : "grayscale(0.35)",
                        }}
                      />
                      <Box
                        sx={{
                          position: "absolute",
                          top: 10,
                          left: 10,
                          px: 1.6,
                          py: 0.65,
                          borderRadius: 999,
                          bgcolor: "rgba(255,255,255,0.96)",
                          border: "1px solid rgba(0,0,0,0.08)",
                          fontWeight: 950,
                          fontSize: 13,
                          lineHeight: 1,
                          boxShadow: "0 6px 14px rgba(15, 23, 42, 0.10)",
                        }}
                      >
                        {SLOT_LABEL[slotKey]}
                      </Box>
                    </Box>

                    <Box
                      sx={{
                        px: 1.6,
                        py: 1.2,
                        bgcolor: "#fff",
                        borderTop: "1px solid #eef1f6",
                      }}
                    >
                      <Typography
                        sx={{
                          fontWeight: 500,
                          fontSize: 16,
                          whiteSpace: "nowrap",
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                          opacity: recipeId ? 1 : 0.55,
                        }}
                        title={name}
                      >
                        {name}
                      </Typography>
                    </Box>
                  </Card>
                </Grid>
              );
            })}
          </Grid>
        )}
      </Box>

      {/* Big button */}
      <Box
        sx={{
          px: { xs: 2, sm: 3 },
          pb: 3,
          pt: 1.4,
          display: "flex",
          justifyContent: "center",
        }}
      >
        <Button
          component={NextLink}
          href={`/recipes/weekly?dayKey=${titleKey}`}
          variant="contained"
          sx={{
            width: "100%",
            maxWidth: 460,
            borderRadius: 2.2,
            textTransform: "none",
            fontWeight: 950,
            fontSize: 16,
            py: 1.6,
            boxShadow: "0 16px 30px rgba(47,107,216,0.35)",
          }}
        >
          献立を変更する
        </Button>
      </Box>

      {/* footer chips */}
      <Box
        sx={{
          px: { xs: 2, sm: 3 },
          pb: 2.4,
          display: "flex",
          justifyContent: "flex-end",
          gap: 1.2,
        }}
      >
        <Box
          sx={{
            px: 2,
            py: 0.9,
            borderRadius: 999,
            fontWeight: 950,
            fontSize: 13,
            bgcolor: selectedHasPlan ? "#ffe9ee" : "#f1f3f6",
            color: selectedHasPlan ? "#d32f2f" : "#111827",
            border: "1px solid rgba(0,0,0,0.06)",
          }}
        >
          {selectedHasPlan ? "献立あり（選択日）" : "未登録（選択日）"}
        </Box>
        <Box
          sx={{
            px: 2,
            py: 0.9,
            borderRadius: 999,
            fontWeight: 950,
            fontSize: 13,
            bgcolor: "#f1f3f6",
            color: "#111827",
            border: "1px solid rgba(0,0,0,0.06)",
          }}
        >
          選択. {mmdd}
        </Box>
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

  // 空状態救済用 state
  const [actionBusy, setActionBusy] = useState(false);

  // 下ゾーン：朝/昼/夜のスライド状態
  const [slideMealKey, setSlideMealKey] = useState("lunch");

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

  // 選択日が変わったら、表示は「昼」に戻す
  useEffect(() => {
    setSlideMealKey("lunch");
  }, [selectedDayKey]);

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
   * ズボラ用セットを今日に適用
   =============================== */
  const applyZuboraDailySetToToday = useCallback(async () => {
    if (!todayKey) return;

    setActionBusy(true);

    try {
      const dailyRef = collection(db, COLLECTION_DAILYSETS);

      // createdAt が無いと orderBy で落ちるので、try/catch fallback
      let snap;
      try {
        const qDaily = query(dailyRef, orderBy("createdAt", "desc"), limit(30));
        snap = await getDocs(qDaily);
      } catch (e) {
        console.warn("dailySets orderBy(createdAt) failed. fallback:", e);
        const qDaily = query(dailyRef, limit(30));
        snap = await getDocs(qDaily);
      }

      if (!snap || snap.empty) {
        showToast(
          "献立レシピの登録がされていません。先に献立レシピの登録をおこなってください。",
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
        showToast(
          "ズボラ用セットが見つかりませんでした。ズボラ用セットの登録をおこなってください。",
          "error"
        );
        return;
      }

      const dsSnap = await getDoc(doc(db, COLLECTION_DAILYSETS, dailySetId));
      if (!dsSnap.exists()) {
        showToast("選択されたテンプレートが見つかりませんでした。", "error");
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
      showToast("ズボラ用セットで献立を作成しました。", "success");
    } catch (e) {
      console.error("applyZuboraDailySetToToday error:", e);
      showToast("ズボラ用セットの適用に問題が発生しました。", "error");
    } finally {
      setActionBusy(false);
    }
  }, [todayKey, refreshDayAndRecipes, showToast]);

  /** ===============================
   * 変更する → /recipes の選択モードへ
   =============================== */
  const changeSlotRecipe = useCallback((dayKey, mealKey, slotKey) => {
    if (!dayKey) return;
    window.location.href = `/recipes?mode=weeklyDay&dayKey=${dayKey}&meal=${mealKey}&slot=${slotKey}&from=home`;
  }, []);

  /** ===============================
   * 削除（枠をnullにして templateIds も解除）
   =============================== */
  const deleteSlotRecipe = useCallback(
    async (dayKey, mealKey, slotKey) => {
      if (!dayKey) return;

      try {
        setActionBusy(true);

        // ローカル即反映
        setDayDocsByKey((prev) => {
          const next = { ...prev };
          const day = next[dayKey] ? { ...next[dayKey] } : {};
          const meal = day?.[mealKey] ? { ...day[mealKey] } : {};
          meal[slotKey] = null;

          day[mealKey] = meal;

          // テンプレ適用中に部分削除するとズレるので templateIds を外す
          if (day?.templateIds?.[mealKey]) {
            day.templateIds = { ...(day.templateIds || {}), [mealKey]: "" };
          }

          next[dayKey] = day;
          return next;
        });

        await setDoc(
          doc(db, COLLECTION_WEEKLY_DAY, dayKey),
          {
            [mealKey]: { [slotKey]: null },
            templateIds: { [mealKey]: "" },
            updatedAt: serverTimestamp(),
          },
          { merge: true }
        );

        await refreshDayAndRecipes(dayKey);
        showToast("削除しました", "success");
      } catch (e) {
        console.error("deleteSlotRecipe error:", e);
        showToast("削除に失敗しました", "error");
      } finally {
        setActionBusy(false);
      }
    },
    [refreshDayAndRecipes, showToast]
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
          <Tab label="献立カレンダー" />
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
          onChangeSlotRecipe={changeSlotRecipe}
          onDeleteSlotRecipe={deleteSlotRecipe}
          actionBusy={actionBusy}
        />
      )}

      {/* 献立カレンダー */}
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

            {/* 下：献立ゾーン（画像イメージのUI） */}
            <Box sx={{ p: { xs: 1.5, md: 2 } }}>
              <MealSlidePanelV2
                mealKey={slideMealKey}
                onChangeMeal={setSlideMealKey}
                selectedDayKey={selectedDayKey}
                todayKey={todayKey}
                selectedDayData={selectedDayData}
                recipesById={recipesById}
                loadingRange={loadingRange}
                selectedHasPlan={selectedHasPlan}
              />
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
