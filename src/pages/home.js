// pages/home/index.jsx
import { useAuth } from "@/hooks/useAuth";
import AppLayout from "@/components/layout/AppLayout";
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
  Drawer,
  TextField,
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
import { listRecipes } from "@/features/recipes";

const DEFAULT_IMAGE = "/images/default-recipe.png";

// dailySets の中で「ズボラ用」を探すキーワード（nameに含める）
const ZUBORA_DAILYSET_KEYWORD = "ズボラ";

// Firestore collection名
const COLLECTION_WEEKLY_DAY = "weeklyDaySets";
const COLLECTION_RECIPES = "recipes";
const COLLECTION_DAILYSETS = "dailySets";

const MEAL_LABEL = { breakfast: "朝", lunch: "昼", dinner: "夜" };
const SLOT_LABEL = { staple: "主食", main: "主菜", side: "副菜", soup: "汁物" };
const MEAL_ICON = {
  breakfast: "/icons/rakusuru/content/lg_content_breakfast_time.png",
  lunch: "/icons/rakusuru/content/lg_content_lunch_time.png",
  dinner: "/icons/rakusuru/content/lg_content_dinner_time.png",
};

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
    const hasAnyRecipe = SLOT_ORDER.some((slotKey) => !!mealData?.[slotKey]);
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
    SLOT_ORDER.some((slotKey) => !!dayData?.[mealKey]?.[slotKey]),
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
  onChangeSlotRecipe,
  actionBusy,
  onPrevDay,
  onNextDay,
  onToday,
}) {
  if (loading) {
    return (
      <Stack spacing={2} sx={{ mt: 3 }}>
        {[0, 1, 2].map((item) => (
          <Skeleton
            key={item}
            variant="rounded"
            height={170}
            sx={{ borderRadius: 3 }}
          />
        ))}
      </Stack>
    );
  }

  if (error) {
    return (
      <Typography variant="body2" color="error" sx={{ mt: 3 }}>
        {error}
      </Typography>
    );
  }

  return (
    <Box sx={{ mt: 3 }}>
      <Stack
        direction="row"
        alignItems="center"
        justifyContent="space-between"
        sx={{ mb: 2 }}
      >
        <Box>
          <Typography
            component="h2"
            sx={{
              fontSize: { xs: 20, md: 24 },
              fontWeight: 700,
              color: "#333333",
            }}
          >
            今日の献立
          </Typography>

          {todayKey && (
            <Stack
              direction="row"
              alignItems="center"
              spacing={1}
              sx={{ mt: 1 }}
            >
              <Button
                type="button"
                onClick={onPrevDay}
                sx={{
                  minWidth: 36,
                  width: 36,
                  height: 36,
                  borderRadius: 3,
                  color: "#D98300",
                  bgcolor: "#FFF3E0",
                  p: 0,
                  "&:hover": {
                    bgcolor: "#FFE6BF",
                  },
                }}
              >
                ‹
              </Button>

              <Box
                sx={{
                  minWidth: 150,
                  height: 36,
                  px: 2,
                  borderRadius: 3,
                  bgcolor: "#FFFFFF",
                  border: "1px solid #F1E6D7",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <Typography
                  sx={{
                    fontSize: 14,
                    fontWeight: 600,
                    color: "#333333",
                  }}
                >
                  {formatDateTitle(todayKey)}
                </Typography>
              </Box>

              <Button
                type="button"
                onClick={onNextDay}
                sx={{
                  minWidth: 36,
                  width: 36,
                  height: 36,
                  borderRadius: 3,
                  color: "#D98300",
                  bgcolor: "#FFF3E0",
                  p: 0,
                  "&:hover": {
                    bgcolor: "#FFE6BF",
                  },
                }}
              >
                ›
              </Button>

              <Button
                type="button"
                onClick={onToday}
                variant="text"
                sx={{
                  ml: 0.5,
                  minWidth: "auto",
                  px: 1,
                  color: "#D98300",
                  fontSize: 12,
                  fontWeight: 600,
                  textTransform: "none",
                }}
              >
                今日に戻る
              </Button>
            </Stack>
          )}
        </Box>

        <Button
          component={NextLink}
          href="/recipes/weekly"
          variant="text"
          sx={{
            color: "#D98300",
            fontWeight: 700,
            fontSize: 13,
            textTransform: "none",
          }}
        >
          献立カレンダーを見る
        </Button>
      </Stack>

      <Stack spacing={2}>
        {MEAL_ORDER.map((mealKey) => {
          const mealData = dayData?.[mealKey] || {};

          const validSlots = SLOT_ORDER.filter((slotKey) => {
            const recipeId = mealData?.[slotKey];
            return !!(recipeId && recipesMap?.[recipeId]);
          });

          const filledCount = validSlots.length;
          const hasAnyRecipe = filledCount > 0;

          const firstEditableSlot =
            SLOT_ORDER.find((slotKey) => {
              const recipeId = mealData?.[slotKey];
              return !(recipeId && recipesMap?.[recipeId]);
            }) || SLOT_ORDER[0];

          return (
            <Card
              key={mealKey}
              sx={{
                borderRadius: 3,
                border: "1px solid #F1E6D7",
                bgcolor: "#FFFFFF",
                boxShadow: "0 4px 12px rgba(0,0,0,0.04)",
                overflow: "hidden",
              }}
            >
              <Box
                sx={{
                  position: "relative",
                  p: { xs: 2, md: 2.5 },
                  display: "grid",
                  gridTemplateColumns: {
                    xs: "1fr",
                    md: "140px minmax(0, 1fr) auto",
                  },
                  gap: { xs: 2, md: 2.5 },
                  alignItems: "center",
                }}
              >
                <Stack
                  direction={{ xs: "row", md: "column" }}
                  alignItems={{ xs: "center", md: "flex-start" }}
                  justifyContent={{ xs: "space-between", md: "center" }}
                  spacing={1.5}
                  sx={{
                    minWidth: 0,
                  }}
                >
                  <Stack direction="row" alignItems="center" spacing={1.2}>
                    <Box
                      sx={{
                        width: 36,
                        height: 36,
                        borderRadius: "50%",
                        display: "grid",
                        placeItems: "center",
                        bgcolor: "#FFF3E0",
                        flexShrink: 0,
                      }}
                    >
                      <Box
                        component="img"
                        src={MEAL_ICON[mealKey]}
                        alt={MEAL_LABEL[mealKey]}
                        sx={{
                          width: 32,
                          height: 32,
                          objectFit: "contain",
                        }}
                      />
                    </Box>

                    <Box>
                      <Typography
                        sx={{
                          fontSize: 16,
                          fontWeight: 600,
                          color: "#333333",
                        }}
                      >
                        {MEAL_LABEL[mealKey]}ごはん
                      </Typography>

                      <Typography
                        sx={{
                          mt: 0.2,
                          fontSize: 12,
                          color: "#777777",
                        }}
                      >
                        {filledCount} / {SLOT_ORDER.length}品 決定
                      </Typography>
                    </Box>
                  </Stack>
                </Stack>

                {!hasAnyRecipe ? (
                  <Box
                    component="button"
                    type="button"
                    onClick={() =>
                      onChangeSlotRecipe(todayKey, mealKey, firstEditableSlot)
                    }
                    disabled={!todayKey || actionBusy}
                    sx={{
                      width: "100%",
                      minHeight: { xs: 130, md: 120 },
                      border: "1.5px dashed #F2C98C",
                      borderRadius: 3,
                      bgcolor: "#FFFDFA",
                      cursor: !todayKey || actionBusy ? "default" : "pointer",
                      display: "flex",
                      flexDirection: "column",
                      alignItems: "center",
                      justifyContent: "center",
                      gap: 0.8,
                      color: "#D98300",
                      transition: "background-color 120ms ease",
                      "&:hover": {
                        bgcolor:
                          !todayKey || actionBusy ? "#FFFDFA" : "#FFF3E0",
                      },
                    }}
                  >
                    <Box
                      sx={{
                        width: 42,
                        height: 42,
                        borderRadius: "50%",
                        bgcolor: "#FFF3E0",
                        display: "grid",
                        placeItems: "center",
                        fontSize: 26,
                        lineHeight: 1,
                      }}
                    >
                      ＋
                    </Box>

                    <Typography
                      component="span"
                      sx={{
                        fontSize: 14,
                        fontWeight: 700,
                        color: "#D98300",
                      }}
                    >
                      献立を決める
                    </Typography>

                    <Typography
                      component="span"
                      sx={{
                        fontSize: 12,
                        color: "#999999",
                      }}
                    >
                      まだ献立が決まっていません
                    </Typography>
                  </Box>
                ) : (
                  <Box
                    sx={{
                      display: "grid",
                      gridTemplateColumns: {
                        xs: "repeat(2, minmax(0, 1fr))",
                        md: "repeat(4, minmax(0, 1fr))",
                      },
                      gap: 1.5,
                    }}
                  >
                    {SLOT_ORDER.map((slotKey) => {
                      const recipeId = mealData?.[slotKey] || null;
                      const recipe = recipeId ? recipesMap?.[recipeId] : null;

                      if (!recipeId || !recipe) {
                        return (
                          <Box
                            key={`${mealKey}-${slotKey}`}
                            component="button"
                            type="button"
                            onClick={() =>
                              onChangeSlotRecipe(todayKey, mealKey, slotKey)
                            }
                            disabled={!todayKey || actionBusy}
                            sx={{
                              width: "100%",
                              minWidth: 0,
                              height: 136,
                              border: "1px dashed #F2C98C",
                              borderRadius: 3,
                              bgcolor: "#FFFDFA",
                              cursor:
                                !todayKey || actionBusy ? "default" : "pointer",
                              display: "flex",
                              flexDirection: "column",
                              alignItems: "center",
                              justifyContent: "center",
                              gap: 0.8,
                              px: 1,
                              color: "#D98300",
                              boxShadow: "0 4px 12px rgba(0,0,0,0.03)",
                              transition: "all 120ms ease",
                              "&:hover": {
                                bgcolor:
                                  !todayKey || actionBusy
                                    ? "#FFFDFA"
                                    : "#FFF3E0",
                                borderColor: "#FFB830",
                              },
                            }}
                          >
                            <Box
                              sx={{
                                width: 36,
                                height: 36,
                                borderRadius: "50%",
                                bgcolor: "#FFF3E0",
                                display: "grid",
                                placeItems: "center",
                                fontSize: 23,
                              }}
                            >
                              ＋
                            </Box>

                            <Typography
                              component="span"
                              sx={{
                                fontSize: 12,
                                fontWeight: 700,
                                color: "#D98300",
                                textAlign: "center",
                              }}
                            >
                              {SLOT_LABEL[slotKey]}を決める
                            </Typography>
                          </Box>
                        );
                      }

                      const title =
                        recipe.title || recipe.recipeName || "料理名未設定";
                      const img = recipe.imageUrl || DEFAULT_IMAGE;

                      return (
                        <Card
                          key={`${mealKey}-${slotKey}`}
                          component={NextLink}
                          href={`/recipes/${recipeId}?from=home`}
                          sx={{
                            width: "100%",
                            minWidth: 0,
                            height: 136,
                            textDecoration: "none",
                            color: "inherit",
                            borderRadius: 3,
                            overflow: "hidden",
                            border: "1px solid #F0E8DC",
                            bgcolor: "#FFFFFF",
                            boxShadow: "0 4px 12px rgba(0,0,0,0.04)",
                            display: "flex",
                            flexDirection: "column",
                            transition:
                              "transform 120ms ease, box-shadow 120ms ease",
                            "&:hover": {
                              transform: "translateY(-2px)",
                              boxShadow: "0 8px 18px rgba(0,0,0,0.07)",
                            },
                          }}
                        >
                          <Box
                            sx={{
                              position: "relative",
                              height: 92,
                              overflow: "hidden",
                              bgcolor: "#F7F7F7",
                              flexShrink: 0,
                            }}
                          >
                            <Box
                              component="img"
                              src={img}
                              alt={title}
                              sx={{
                                width: "100%",
                                height: "100%",
                                objectFit: "cover",
                                display: "block",
                              }}
                            />

                            <Box
                              sx={{
                                position: "absolute",
                                right: 6,
                                bottom: 6,
                                px: 0.8,
                                py: 0.25,
                                borderRadius: 999,
                                bgcolor: "rgba(255,255,255,0.94)",
                                fontSize: 10,
                                fontWeight: 700,
                                color: "#555555",
                              }}
                            >
                              {SLOT_LABEL[slotKey]}
                            </Box>
                          </Box>

                          <Box sx={{ p: 1 }}>
                            <Typography
                              sx={{
                                fontSize: 12,
                                fontWeight: 700,
                                color: "#333333",
                                lineHeight: 1.4,
                                overflow: "hidden",
                                textOverflow: "ellipsis",
                                whiteSpace: "nowrap",
                              }}
                            >
                              {title}
                            </Typography>
                          </Box>
                        </Card>
                      );
                    })}
                  </Box>
                )}
                <Button
                  type="button"
                  variant="outlined"
                  onClick={() =>
                    onChangeSlotRecipe(todayKey, mealKey, firstEditableSlot)
                  }
                  disabled={!todayKey || actionBusy}
                  sx={{
                    alignSelf: "start",
                    minWidth: 64,
                    borderRadius: 999,
                    borderColor: "#F2C98C",
                    color: "#D98300",
                    fontWeight: 700,
                    fontSize: 12,
                    textTransform: "none",
                    whiteSpace: "nowrap",
                    "&:hover": {
                      borderColor: "#FFB830",
                      bgcolor: "#FFF3E0",
                    },
                  }}
                >
                  編集
                </Button>
              </Box>
            </Card>
          );
        })}
      </Stack>
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
  const { user } = useAuth();

  const [tab, setTab] = useState(0);

  const [todayKey, setTodayKey] = useState("");
  const [displayDayKey, setDisplayDayKey] = useState("");
  const [selectedDayKey, setSelectedDayKey] = useState("");

  const [rangeKeys, setRangeKeys] = useState([]);

  const [dayDocsByKey, setDayDocsByKey] = useState({});
  const [recipesById, setRecipesById] = useState({});
  const [selectableRecipes, setSelectableRecipes] = useState([]);

  const [loadingRange, setLoadingRange] = useState(true);
  const [error, setError] = useState("");

  const [monthDate, setMonthDate] = useState(new Date());

  const [actionBusy, setActionBusy] = useState(false);
  const [mealEditTarget, setMealEditTarget] = useState(null);
  const [recipeSearchQuery, setRecipeSearchQuery] = useState("");

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
    setDisplayDayKey(key);
    setSelectedDayKey(key);

    // 直近30日（取得用）
    const keys = [];
    for (let i = 29; i >= 0; i--) keys.push(toDateKey(addDays(d, -i)));
    setRangeKeys(keys);

    // 今月表示
    setMonthDate(new Date(d.getFullYear(), d.getMonth(), 1));
  }, []);

  useEffect(() => {
    if (!user || !rangeKeys || rangeKeys.length === 0) return;

    const fetchRange = async () => {
      setLoadingRange(true);
      setError("");

      try {
        console.log("DEBUG: weeklyDaySets fetch start");
        // weeklyDaySets を「ユーザーID + 日付」で取得
        const snaps = await Promise.all(
          rangeKeys.map((key) =>
            getDoc(doc(db, COLLECTION_WEEKLY_DAY, `${user.uid}_${key}`)),
          ),
        );

        console.log("DEBUG: weeklyDaySets fetch success");

        const map = {};
        const recipeIdSet = new Set();

        snaps.forEach((snap, i) => {
          const key = rangeKeys[i];
          if (!snap.exists()) return;

          const data = snap.data() || {};
          map[key] = data;

          collectRecipeIdsFromDay(data).forEach((id) => {
            recipeIdSet.add(id);
          });
        });

        setDayDocsByKey(map);

        if (recipeIdSet.size === 0) {
          setRecipesById({});
          setLoadingRange(false);
          return;
        }

        const allRecipes = await listRecipes(user.uid);

        const recipesMapTmp = {};

        allRecipes.forEach((recipe) => {
          if (recipeIdSet.has(recipe.id)) {
            recipesMapTmp[recipe.id] = recipe;
          }
        });

        setRecipesById(recipesMapTmp);
        setLoadingRange(false);
      } catch (e) {
        console.error("Home tabs fetch error:", e);
        setError("献立を読み込む際にエラーが発生しました。");
        setLoadingRange(false);
      }
    };

    fetchRange();
  }, [rangeKeys, user]);

  const handleTabChange = useCallback((_, next) => setTab(next), []);
  const handleSelectDay = useCallback((key) => setSelectedDayKey(key), []);

  const selectedDayData = selectedDayKey ? dayDocsByKey[selectedDayKey] : null;

  // 選択日が変わったら、表示は「昼」に戻す
  useEffect(() => {
    setSlideMealKey("lunch");
  }, [selectedDayKey]);

  const prevMonth = useCallback(() => {
    setMonthDate(
      (prev) => new Date(prev.getFullYear(), prev.getMonth() - 1, 1),
    );
  }, []);
  const nextMonth = useCallback(() => {
    setMonthDate(
      (prev) => new Date(prev.getFullYear(), prev.getMonth() + 1, 1),
    );
  }, []);

  const refreshDayAndRecipes = useCallback(
    async (key) => {
      if (!user || !key) return;

      const snap = await getDoc(
        doc(db, COLLECTION_WEEKLY_DAY, `${user.uid}_${key}`),
      );

      const nextDay = snap.exists() ? snap.data() || {} : null;

      setDayDocsByKey((prev) => {
        const next = { ...prev };

        if (nextDay) {
          next[key] = nextDay;
        } else {
          delete next[key];
        }

        return next;
      });

      if (!nextDay) return;

      const recipeIds = collectRecipeIdsFromDay(nextDay);

      const allRecipes = await listRecipes(user.uid);

      const fetched = {};

      allRecipes.forEach((recipe) => {
        if (recipeIds.has(recipe.id)) {
          fetched[recipe.id] = recipe;
        }
      });

      setRecipesById((prev) => ({
        ...prev,
        ...fetched,
      }));
    },
    [user],
  );

  /** ===============================
   * ズボラ用セットを今日に適用
   =============================== */
  const applyZuboraDailySetToToday = useCallback(async () => {
    if (!user || !todayKey) return;

    setActionBusy(true);

    try {
      const dailyRef = collection(db, COLLECTION_DAILYSETS);

      let snap;

      try {
        const qDaily = query(
          dailyRef,
          where("userId", "==", user.uid),
          orderBy("createdAt", "desc"),
          limit(30),
        );

        snap = await getDocs(qDaily);
      } catch (e) {
        console.warn("dailySets orderBy(createdAt) failed. fallback:", e);

        const qDaily = query(
          dailyRef,
          where("userId", "==", user.uid),
          limit(30),
        );

        snap = await getDocs(qDaily);
      }

      if (!snap || snap.empty) {
        showToast(
          "献立レシピの登録がされていません。先に献立レシピの登録をおこなってください。",
          "error",
        );
        return;
      }

      const list = snap.docs.map((d) => ({
        id: d.id,
        ...d.data(),
      }));

      const chosen =
        list.find((d) => (d.name || "").includes(ZUBORA_DAILYSET_KEYWORD)) ||
        list[0];

      const dailySetId = chosen?.id;

      if (!dailySetId) {
        showToast(
          "ズボラ用セットが見つかりませんでした。ズボラ用セットの登録をおこなってください。",
          "error",
        );
        return;
      }

      const dsSnap = await getDoc(doc(db, COLLECTION_DAILYSETS, dailySetId));

      if (!dsSnap.exists()) {
        showToast("選択されたテンプレートが見つかりませんでした。", "error");
        return;
      }

      const dailySetData = dsSnap.data() || {};

      if (dailySetData.userId !== user.uid) {
        showToast("このテンプレートは利用できません。", "error");
        return;
      }

      const slots = dailySetToMealSlots(dailySetData);

      await setDoc(
        doc(db, COLLECTION_WEEKLY_DAY, `${user.uid}_${todayKey}`),
        {
          userId: user.uid,
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
        { merge: true },
      );

      await refreshDayAndRecipes(todayKey);

      showToast("ズボラ用セットで献立を作成しました。", "success");
    } catch (e) {
      console.error("applyZuboraDailySetToToday error:", e);

      showToast("ズボラ用セットの適用に問題が発生しました。", "error");
    } finally {
      setActionBusy(false);
    }
  }, [user, todayKey, refreshDayAndRecipes, showToast]);

  /** ===============================
   * 変更する → /recipes の選択モードへ
   =============================== */
  const changeSlotRecipe = useCallback((dayKey, mealKey, slotKey) => {
    if (!dayKey) return;
    window.location.href = `/recipes?mode=weeklyDay&dayKey=${dayKey}&meal=${mealKey}&slot=${slotKey}&from=home`;
  }, []);

  const openMealEditDialog = useCallback(
    async (dayKey, mealKey, slotKey) => {
      if (!dayKey || !user) return;

      setMealEditTarget({
        dayKey,
        mealKey,
        slotKey,
      });

      try {
        const recipes = await listRecipes(user.uid);
        setSelectableRecipes(recipes);
      } catch (e) {
        console.error("openMealEditDialog listRecipes error:", e);
        showToast("レシピの読み込みに失敗しました。", "error");
      }
    },
    [user, showToast],
  );

  const saveSlotRecipe = useCallback(
    async (recipeId) => {
      if (!user || !mealEditTarget || !recipeId) return;

      const { dayKey, mealKey, slotKey } = mealEditTarget;

      try {
        setActionBusy(true);

        setDayDocsByKey((prev) => {
          const next = { ...prev };
          const day = next[dayKey] ? { ...next[dayKey] } : {};
          const meal = day?.[mealKey] ? { ...day[mealKey] } : {};

          meal[slotKey] = recipeId;
          day[mealKey] = meal;

          if (day?.templateIds?.[mealKey]) {
            day.templateIds = {
              ...(day.templateIds || {}),
              [mealKey]: "",
            };
          }

          next[dayKey] = day;
          return next;
        });

        await setDoc(
          doc(db, COLLECTION_WEEKLY_DAY, `${user.uid}_${dayKey}`),
          {
            userId: user.uid,
            [mealKey]: {
              [slotKey]: recipeId,
            },
            templateIds: {
              [mealKey]: "",
            },
            updatedAt: serverTimestamp(),
          },
          { merge: true },
        );

        await refreshDayAndRecipes(dayKey);
        showToast("献立を更新しました。", "success");
      } catch (e) {
        console.error("saveSlotRecipe error:", e);
        showToast("献立の更新に失敗しました。", "error");
      } finally {
        setActionBusy(false);
      }
    },
    [user, mealEditTarget, refreshDayAndRecipes, showToast],
  );

  const deleteSlotRecipe = useCallback(
    async (dayKey, mealKey, slotKey) => {
      if (!user || !dayKey) return;

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
            day.templateIds = {
              ...(day.templateIds || {}),
              [mealKey]: "",
            };
          }

          next[dayKey] = day;
          return next;
        });

        await setDoc(
          doc(db, COLLECTION_WEEKLY_DAY, `${user.uid}_${dayKey}`),
          {
            userId: user.uid,
            [mealKey]: {
              [slotKey]: null,
            },
            templateIds: {
              [mealKey]: "",
            },
            updatedAt: serverTimestamp(),
          },
          { merge: true },
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
    [user, refreshDayAndRecipes, showToast],
  );

  const selectedHasPlan = useMemo(() => {
    return selectedDayData && !isDayPlanEmpty(selectedDayData);
  }, [selectedDayData]);

  const currentRecipeId = mealEditTarget
    ? dayDocsByKey?.[mealEditTarget.dayKey]?.[mealEditTarget.mealKey]?.[
        mealEditTarget.slotKey
      ] || null
    : null;

  const currentRecipe = currentRecipeId
    ? selectableRecipes.find((recipe) => recipe.id === currentRecipeId) ||
      recipesById?.[currentRecipeId] ||
      null
    : null;

  const filteredRecipes = selectableRecipes.filter((recipe) => {
    const query = recipeSearchQuery.trim().toLowerCase();
    const selectedCategory = mealEditTarget?.slotKey;

    const matchesCategory = selectedCategory
      ? recipe.category === selectedCategory
      : true;

    const matchesSearch = query
      ? (recipe.title || "").toLowerCase().includes(query)
      : true;

    return matchesCategory && matchesSearch;
  });

  const recentRecipes = useMemo(() => {
    const recentKeys = rangeKeys.slice(-14).reverse();
    const seen = new Set();
    const result = [];

    for (const dayKey of recentKeys) {
      const dayData = dayDocsByKey?.[dayKey];

      if (!dayData) continue;

      for (const mealKey of MEAL_ORDER) {
        for (const slotKey of SLOT_ORDER) {
          const recipeId = dayData?.[mealKey]?.[slotKey];

          if (!recipeId || seen.has(recipeId)) continue;

          const recipe = recipesById?.[recipeId];

          if (!recipe) continue;

          seen.add(recipeId);
          result.push(recipe);

          if (result.length >= 4) {
            return result;
          }
        }
      }
    }

    return result;
  }, [rangeKeys, dayDocsByKey, recipesById]);

  const goToday = useCallback(() => {
    if (!todayKey) return;
    setDisplayDayKey(todayKey);
  }, [todayKey]);

  const goPrevDay = useCallback(() => {
    if (!displayDayKey) return;

    const prev = addDays(parseDateKey(displayDayKey), -1);
    setDisplayDayKey(toDateKey(prev));
  }, [displayDayKey]);

  const goNextDay = useCallback(() => {
    if (!displayDayKey) return;

    const next = addDays(parseDateKey(displayDayKey), 1);
    setDisplayDayKey(toDateKey(next));
  }, [displayDayKey]);

  return (
    <AppLayout title="ホーム" activeNav="home">
      <Box
        sx={{
          maxWidth: 1100,
          mx: "auto",
          mt: 4,
          px: { xs: 2, md: 3 },
          pb: 5,
        }}
      >
        <Card
          sx={{
            mb: 4,
            position: "relative",
            minHeight: { xs: 360, md: 250 },
            borderRadius: 4,
            overflow: "hidden",
            border: "1px solid #F1E7D8",
            bgcolor: "#FBF6EE",
            boxShadow: "0 8px 28px rgba(86, 64, 38, 0.06)",
          }}
        >
          {/* 背景画像 */}
          <Box
            component="img"
            src="/images/lp/hero/foods/hero-food-bento.png"
            alt="今日のごはん"
            sx={{
              position: "absolute",
              inset: 0,
              width: "100%",
              height: "100%",
              objectFit: "cover",
              objectPosition: {
                xs: "68% center",
                md: "72% center",
              },
              display: "block",
            }}
          />

          {/* 左から画像へ自然につながるグラデーション */}
          <Box
            sx={{
              position: "absolute",
              inset: 0,
              background: {
                xs: `
          linear-gradient(
            180deg,
            #FBF6EE 0%,
            #FBF6EE 48%,
            rgba(251,246,238,0.94) 60%,
            rgba(251,246,238,0.45) 78%,
            rgba(251,246,238,0.08) 100%
          )
        `,
                md: `
          linear-gradient(
            90deg,
            #FBF6EE 0%,
            #FBF6EE 34%,
            rgba(251,246,238,0.98) 42%,
            rgba(251,246,238,0.82) 49%,
            rgba(251,246,238,0.38) 57%,
            rgba(251,246,238,0.08) 65%,
            rgba(251,246,238,0) 72%
          )
        `,
              },
              pointerEvents: "none",
            }}
          />

          {/* テキスト */}
          <Stack
            justifyContent="center"
            sx={{
              position: "relative",
              zIndex: 1,
              minHeight: { xs: 360, md: 250 },
              width: { xs: "100%", md: "48%" },
              px: { xs: 3, md: 4.5 },
              py: { xs: 3.5, md: 4 },
            }}
          >
            <Stack
              direction="row"
              alignItems="center"
              spacing={1}
              sx={{ mb: 1.5 }}
            >
              <Box
                sx={{
                  width: 22,
                  height: 2,
                  borderRadius: 999,
                  bgcolor: "#D99A2B",
                }}
              />

              <Typography
                sx={{
                  fontSize: 12,
                  fontWeight: 700,
                  letterSpacing: "0.08em",
                  color: "#9A722F",
                }}
              >
                今日のごはん
              </Typography>
            </Stack>

            <Typography
              component="h1"
              sx={{
                fontSize: { xs: 25, md: 30 },
                lineHeight: 1.45,
                fontWeight: 700,
                letterSpacing: "-0.02em",
                color: "#2F2B26",
              }}
            >
              今日も、おいしいごはんを。
            </Typography>

            <Typography
              sx={{
                mt: 1.75,
                fontSize: 14,
                lineHeight: 1.9,
                color: "#6F685F",
              }}
            >
              朝・昼・夜の献立を確認して、
              <br />
              決まっていないところだけ、さっと決めましょう。
            </Typography>
          </Stack>
        </Card>

        {error && (
          <Typography variant="body2" color="error" sx={{ mt: 2 }}>
            {error}
          </Typography>
        )}

        {/* 今日 */}
        {tab === 0 && (
          <TodayDetail
            todayKey={displayDayKey}
            dayData={displayDayKey ? dayDocsByKey[displayDayKey] : null}
            recipesMap={recipesById}
            loading={loadingRange}
            error={error}
            onApplyZuboraDailySetToToday={applyZuboraDailySetToToday}
            onChangeSlotRecipe={openMealEditDialog}
            onDeleteSlotRecipe={deleteSlotRecipe}
            actionBusy={actionBusy}
            onPrevDay={goPrevDay}
            onNextDay={goNextDay}
            onToday={goToday}
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

        <Box sx={{ mt: 4 }}>
          {recentRecipes.length > 0 && (
            <Box sx={{ mt: 4, mb: 4 }}>
              <Stack
                direction="row"
                alignItems="center"
                justifyContent="space-between"
                spacing={2}
                sx={{
                  mb: 2,
                }}
              >
                <Typography
                  component="h2"
                  sx={{
                    fontSize: 18,
                    fontWeight: 700,
                    color: "#333333",
                  }}
                >
                  最近使ったレシピ
                </Typography>

                <Button
                  component={NextLink}
                  href="/recipes"
                  variant="text"
                  sx={{
                    minWidth: "auto",
                    px: 0,
                    color: "#D98300",
                    fontSize: 13,
                    fontWeight: 700,
                    textTransform: "none",
                    "&:hover": {
                      bgcolor: "transparent",
                      color: "#B86E00",
                    },
                  }}
                >
                  すべて見る
                </Button>
              </Stack>

              <Box
                sx={{
                  display: "grid",
                  gridTemplateColumns: {
                    xs: "repeat(2, minmax(0, 1fr))",
                    md: "repeat(4, minmax(0, 1fr))",
                  },
                  gap: 2,
                }}
              >
                {recentRecipes.map((recipe) => (
                  <Card
                    key={recipe.id}
                    component={NextLink}
                    href={`/recipes/${recipe.id}?from=home`}
                    sx={{
                      textDecoration: "none",
                      color: "inherit",
                      borderRadius: 3,
                      overflow: "hidden",
                      border: "1px solid #F0F0F0",
                      bgcolor: "#FFFFFF",
                      boxShadow: "0 4px 12px rgba(0,0,0,0.04)",
                      transition: "transform 120ms ease, box-shadow 120ms ease",
                      "&:hover": {
                        transform: "translateY(-2px)",
                        boxShadow: "0 8px 18px rgba(0,0,0,0.07)",
                      },
                    }}
                  >
                    <Box
                      component="img"
                      src={recipe.imageUrl || DEFAULT_IMAGE}
                      alt={recipe.title || recipe.recipeName || "料理画像"}
                      sx={{
                        width: "100%",
                        height: { xs: 104, md: 112 },
                        objectFit: "cover",
                        display: "block",
                        bgcolor: "#F7F7F7",
                      }}
                    />

                    <Box sx={{ p: 1.25 }}>
                      <Typography
                        sx={{
                          fontSize: 14,
                          fontWeight: 700,
                          color: "#333333",
                          lineHeight: 1.4,
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                          whiteSpace: "nowrap",
                        }}
                      >
                        {recipe.title || recipe.recipeName || "料理名未設定"}
                      </Typography>
                    </Box>
                  </Card>
                ))}
              </Box>
            </Box>
          )}
          <Typography
            component="h2"
            sx={{
              fontSize: 18,
              fontWeight: 700,
              color: "#333333",
              mb: 2,
            }}
          >
            すぐ使う
          </Typography>

          <Box
            sx={{
              display: "grid",
              gridTemplateColumns: {
                xs: "1fr",
                sm: "repeat(2, minmax(0, 1fr))",
              },
              gap: 2,
            }}
          >
            <Card
              component={NextLink}
              href="/shopping"
              sx={{
                textDecoration: "none",
                color: "inherit",
                borderRadius: 3,
                border: "1px solid #F3D6A3",
                bgcolor: "#FFF8EC",
                boxShadow: "0 6px 18px rgba(0,0,0,0.04)",
                transition: "transform 120ms ease, box-shadow 120ms ease",
                "&:hover": {
                  transform: "translateY(-2px)",
                  boxShadow: "0 10px 24px rgba(0,0,0,0.08)",
                },
              }}
            >
              <Stack
                direction="row"
                alignItems="center"
                spacing={2}
                sx={{ p: 2 }}
              >
                <Box
                  component="img"
                  src="/icons/rakusuru/life/lg_life_shopping_list.png"
                  alt="買い物リスト"
                  sx={{
                    width: 52,
                    height: 52,
                    objectFit: "contain",
                    flexShrink: 0,
                  }}
                />

                <Box>
                  <Typography
                    sx={{
                      fontSize: 17,
                      fontWeight: 700,
                      color: "#333333",
                    }}
                  >
                    買い物リスト
                  </Typography>

                  <Typography
                    sx={{
                      mt: 0.5,
                      fontSize: 13,
                      color: "#777777",
                    }}
                  >
                    必要な食材をまとめて確認
                  </Typography>
                </Box>
              </Stack>
            </Card>

            <Card
              component={NextLink}
              href="/fridge"
              sx={{
                textDecoration: "none",
                color: "inherit",
                borderRadius: 3,
                border: "1px solid #DCEBCF",
                bgcolor: "#F8FCF4",
                boxShadow: "0 4px 12px rgba(0,0,0,0.04)",
                transition: "transform 120ms ease, box-shadow 120ms ease",
                "&:hover": {
                  transform: "translateY(-2px)",
                  boxShadow: "0 8px 18px rgba(0,0,0,0.07)",
                },
              }}
            >
              <Stack
                direction="row"
                alignItems="center"
                spacing={2}
                sx={{ p: 2 }}
              >
                <Box
                  component="img"
                  src="/icons/rakusuru/life/lg_life_fridge.png"
                  alt="冷蔵庫"
                  sx={{
                    width: 52,
                    height: 52,
                    objectFit: "contain",
                    flexShrink: 0,
                  }}
                />

                <Box>
                  <Typography
                    sx={{
                      fontSize: 17,
                      fontWeight: 700,
                      color: "#333333",
                    }}
                  >
                    冷蔵庫
                  </Typography>

                  <Typography
                    sx={{
                      mt: 0.5,
                      fontSize: 13,
                      color: "#777777",
                    }}
                  >
                    家にある食材を確認
                  </Typography>
                </Box>
              </Stack>
            </Card>
          </Box>
        </Box>

        <Drawer
          anchor="right"
          open={!!mealEditTarget}
          onClose={() => setMealEditTarget(null)}
        >
          <Box
            sx={{
              width: { xs: "100vw", sm: 420 },
              maxWidth: "100vw",
              height: "100%",
              display: "flex",
              flexDirection: "column",
              bgcolor: "#FFFDFA",
            }}
          >
            <Box
              sx={{
                px: 2.5,
                py: 2,
                borderBottom: "1px solid #EEEEEE",
                bgcolor: "#FFFFFF",
              }}
            >
              <Stack
                direction="row"
                alignItems="center"
                justifyContent="space-between"
                spacing={2}
              >
                <Box>
                  <Typography
                    component="h2"
                    sx={{
                      fontSize: 18,
                      fontWeight: 700,
                      color: "#333333",
                    }}
                  >
                    献立を編集
                  </Typography>

                  {mealEditTarget && (
                    <Box
                      sx={{
                        mt: 1.2,
                        px: 1.5,
                        py: 1.1,
                        borderRadius: 2.5,
                        bgcolor: "#FFF3E0",
                        display: "flex",
                        alignItems: "center",
                        gap: 1,
                      }}
                    >
                      <Box
                        component="img"
                        src={MEAL_ICON[mealEditTarget.mealKey]}
                        alt={MEAL_LABEL[mealEditTarget.mealKey]}
                        sx={{
                          width: 28,
                          height: 28,
                          flexShrink: 0,
                        }}
                      />

                      <Typography
                        sx={{
                          fontSize: 14,
                          fontWeight: 700,
                          color: "#333333",
                        }}
                      >
                        {MEAL_LABEL[mealEditTarget.mealKey]} /{" "}
                        {SLOT_LABEL[mealEditTarget.slotKey]}
                      </Typography>
                    </Box>
                  )}
                </Box>

                <Button
                  type="button"
                  onClick={() => setMealEditTarget(null)}
                  sx={{
                    minWidth: "auto",
                    color: "#777777",
                    textTransform: "none",
                  }}
                >
                  閉じる
                </Button>
              </Stack>
            </Box>

            <Box
              sx={{
                flex: 1,
                overflowY: "auto",
                p: 2.5,
              }}
            >
              <Stack spacing={2}>
                {currentRecipe && (
                  <Box>
                    <Typography
                      sx={{
                        mb: 1,
                        fontSize: 14,
                        fontWeight: 700,
                        color: "#333333",
                      }}
                    >
                      現在のレシピ
                    </Typography>

                    <Card
                      sx={{
                        borderRadius: 3,
                        border: "1px solid #F1E6D7",
                        boxShadow: "0 4px 12px rgba(0,0,0,0.04)",
                        bgcolor: "#FFFFFF",
                      }}
                    >
                      <Stack
                        direction="row"
                        alignItems="center"
                        spacing={1.5}
                        sx={{ p: 1.5 }}
                      >
                        <Box
                          component="img"
                          src={currentRecipe.imageUrl || DEFAULT_IMAGE}
                          alt={currentRecipe.title || "料理画像"}
                          sx={{
                            width: 72,
                            height: 72,
                            borderRadius: 2,
                            objectFit: "cover",
                            flexShrink: 0,
                            bgcolor: "#F7F7F7",
                          }}
                        />

                        <Box sx={{ flex: 1, minWidth: 0 }}>
                          <Typography
                            sx={{
                              fontSize: 15,
                              fontWeight: 700,
                              color: "#333333",
                              overflow: "hidden",
                              textOverflow: "ellipsis",
                              whiteSpace: "nowrap",
                            }}
                          >
                            {currentRecipe.title || "料理名未設定"}
                          </Typography>

                          <Box
                            sx={{
                              mt: 0.8,
                              display: "inline-flex",
                              alignItems: "center",
                              px: 1,
                              py: 0.35,
                              borderRadius: 999,
                              bgcolor: "#FFF3E0",
                              color: "#D98300",
                              fontSize: 11,
                              fontWeight: 700,
                            }}
                          >
                            選択中
                          </Box>
                        </Box>
                        <Button
                          type="button"
                          variant="outlined"
                          disabled={actionBusy}
                          onClick={() => {
                            if (!mealEditTarget) return;

                            deleteSlotRecipe(
                              mealEditTarget.dayKey,
                              mealEditTarget.mealKey,
                              mealEditTarget.slotKey,
                            );
                          }}
                          sx={{
                            mt: 0.8,
                            minWidth: "auto",
                            px: 1.8,
                            py: 0.9,
                            borderRadius: 2,
                            borderColor: "#D9D9D9",
                            bgcolor: "#FFFFFF",
                            color: "#666666",
                            textTransform: "none",
                            fontSize: 13,
                            fontWeight: 700,
                            lineHeight: 1,
                            "&:hover": {
                              borderColor: "#BDBDBD",
                              bgcolor: "#FAFAFA",
                            },
                          }}
                        >
                          献立から外す
                        </Button>
                      </Stack>
                    </Card>
                  </Box>
                )}
                <Stack direction="row" spacing={1} flexWrap="wrap">
                  {SLOT_ORDER.map((slotKey) => (
                    <Button
                      key={slotKey}
                      type="button"
                      variant={
                        mealEditTarget?.slotKey === slotKey
                          ? "contained"
                          : "outlined"
                      }
                      onClick={() =>
                        setMealEditTarget((prev) =>
                          prev
                            ? {
                                ...prev,
                                slotKey,
                              }
                            : prev,
                        )
                      }
                      sx={{
                        minWidth: 72,
                        borderRadius: 999,
                        textTransform: "none",
                        fontWeight: 700,
                      }}
                    >
                      {SLOT_LABEL[slotKey]}
                    </Button>
                  ))}
                </Stack>
                <TextField
                  fullWidth
                  size="small"
                  value={recipeSearchQuery}
                  onChange={(e) => setRecipeSearchQuery(e.target.value)}
                  placeholder="レシピを検索"
                  sx={{
                    "& .MuiOutlinedInput-root": {
                      borderRadius: 2.5,
                      bgcolor: "#FFFFFF",
                      fontSize: 14,
                    },
                  }}
                />

                <Typography
                  sx={{
                    fontSize: 16,
                    fontWeight: 700,
                    color: "#333333",
                  }}
                >
                  レシピを選ぶ
                </Typography>

                <Stack spacing={1}>
                  {filteredRecipes.map((recipe) => {
                    const isSelected = recipe.id === currentRecipeId;

                    return (
                      <Button
                        key={recipe.id}
                        type="button"
                        variant="outlined"
                        onClick={() => saveSlotRecipe(recipe.id)}
                        disabled={actionBusy}
                        sx={{
                          justifyContent: "flex-start",
                          textTransform: "none",
                          borderRadius: 3,
                          color: "#333333",
                          borderColor: isSelected ? "#FFB830" : "#E8E8E8",
                          borderWidth: isSelected ? 2 : 1,
                          py: 1,
                          px: 1.2,
                          bgcolor: isSelected ? "#FFF8ED" : "#FFFFFF",
                          boxShadow: isSelected
                            ? "0 4px 12px rgba(255, 184, 48, 0.18)"
                            : "none",
                          "&:hover": {
                            borderColor: "#FFB830",
                            bgcolor: isSelected ? "#FFF8ED" : "#FFFDF8",
                          },
                        }}
                      >
                        <Stack
                          direction="row"
                          spacing={1.2}
                          alignItems="center"
                          sx={{ width: "100%" }}
                        >
                          <Box
                            component="img"
                            src={recipe.imageUrl || DEFAULT_IMAGE}
                            alt={
                              recipe.title || recipe.recipeName || "料理画像"
                            }
                            sx={{
                              width: 72,
                              height: 72,
                              borderRadius: 2,
                              objectFit: "cover",
                              flexShrink: 0,
                              bgcolor: "#F7F7F7",
                            }}
                          />

                          <Box sx={{ flex: 1, minWidth: 0, textAlign: "left" }}>
                            <Typography
                              sx={{
                                fontSize: 15,
                                fontWeight: 700,
                                color: "#333333",
                                lineHeight: 1.4,
                                overflow: "hidden",
                                textOverflow: "ellipsis",
                                whiteSpace: "nowrap",
                              }}
                            >
                              {recipe.title ||
                                recipe.recipeName ||
                                "料理名未設定"}
                            </Typography>
                          </Box>

                          {isSelected && (
                            <Box
                              sx={{
                                ml: 1,
                                display: "inline-flex",
                                alignItems: "center",
                                px: 1.2,
                                py: 0.45,
                                borderRadius: 999,
                                bgcolor: "#FFB830",
                                color: "#FFFFFF",
                                fontSize: 12,
                                fontWeight: 700,
                                flexShrink: 0,
                              }}
                            >
                              選択中
                            </Box>
                          )}
                        </Stack>
                      </Button>
                    );
                  })}
                </Stack>
              </Stack>
            </Box>
          </Box>
        </Drawer>

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
    </AppLayout>
  );
}
