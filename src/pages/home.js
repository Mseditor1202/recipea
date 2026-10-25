// pages/home/index.jsx
import { useAuth } from "@/hooks/useAuth";
import AppLayout from "@/components/layout/AppLayout";
import React, { useEffect, useState, useCallback, useMemo } from "react";
import NextLink from "next/link";
import {
  Box,
  Typography,
  Card,
  Button,
  Stack,
  Skeleton,
  Snackbar,
  Alert,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
} from "@mui/material";
import { doc, getDoc, setDoc, serverTimestamp } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { listRecipes } from "@/features/recipes";
import { listZuboraSets } from "@/features/zuboraSets/repositories/zuboraSetRepository";
import RecipeSelectionDrawer from "@/features/recipes/components/RecipeSelectionDrawer";

const DEFAULT_IMAGE = "/images/default-recipe.png";

// Firestore collection名
const COLLECTION_WEEKLY_DAY = "weeklyDaySets";

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

const formatDateTitle = (key) => {
  const d = parseDateKey(key);
  return `${d.getMonth() + 1}月 ${d.getDate()}日(${WEEKDAY_JA[d.getDay()]})`;
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
  selectedZuboraSet,
  onApplyZuboraSet,
  onCloseZuboraDialog,
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

      <Dialog
        open={!!selectedZuboraSet}
        onClose={actionBusy ? undefined : onCloseZuboraDialog}
        fullWidth
        maxWidth="sm"
        PaperProps={{
          sx: {
            borderRadius: 4,
            bgcolor: "#FFFDFA",
            boxShadow: "0 20px 60px rgba(86, 64, 38, 0.18)",
          },
        }}
      >
        <DialogTitle
          sx={{
            px: { xs: 2.5, sm: 3.5 },
            pt: 3.5,
            pb: 1,
            textAlign: "center",
          }}
        >
          <Typography
            component="div"
            sx={{
              fontSize: { xs: 20, sm: 22 },
              fontWeight: 700,
              color: "#333333",
            }}
          >
            このズボラセットを使いますか？
          </Typography>

          <Typography
            sx={{
              mt: 0.8,
              fontSize: 13,
              fontWeight: 400,
              color: "#777777",
            }}
          >
            反映方法を選んでください
          </Typography>
        </DialogTitle>

        <DialogContent
          sx={{
            px: { xs: 2.5, sm: 3.5 },
            pt: "16px !important",
            pb: 1,
          }}
        >
          {/* 選ばれたズボラセット */}
          <Box
            sx={{
              mb: 2.5,
              p: 2,
              borderRadius: 3,
              bgcolor: "#FFF8EC",
              border: "1px solid #F3D6A3",
            }}
          >
            <Typography
              sx={{
                fontSize: 12,
                fontWeight: 700,
                color: "#B87818",
              }}
            >
              選ばれたズボラセット
            </Typography>

            <Typography
              sx={{
                mt: 0.5,
                fontSize: 17,
                fontWeight: 700,
                color: "#333333",
              }}
            >
              {selectedZuboraSet?.name || "名称未設定"}
            </Typography>

            {selectedZuboraSet?.description && (
              <Typography
                sx={{
                  mt: 0.6,
                  fontSize: 13,
                  color: "#777777",
                  lineHeight: 1.7,
                }}
              >
                {selectedZuboraSet.description}
              </Typography>
            )}
          </Box>

          <Stack spacing={1.5}>
            {/* 推奨 */}
            <Box
              component="button"
              type="button"
              disabled={actionBusy}
              onClick={() => onApplyZuboraSet("empty")}
              sx={{
                width: "100%",
                p: 2,
                borderRadius: 3,
                border: "2px solid #FFB830",
                bgcolor: "#FFF8EC",
                textAlign: "left",
                cursor: actionBusy ? "default" : "pointer",
                font: "inherit",
                transition: "all 120ms ease",
                "&:hover": {
                  bgcolor: actionBusy ? "#FFF8EC" : "#FFF3E0",
                  transform: actionBusy ? "none" : "translateY(-1px)",
                },
                "&:disabled": {
                  opacity: 0.6,
                },
              }}
            >
              <Stack
                direction="row"
                alignItems="flex-start"
                justifyContent="space-between"
                spacing={2}
              >
                <Box>
                  <Stack direction="row" alignItems="center" spacing={1}>
                    <Typography
                      component="span"
                      sx={{
                        fontSize: 16,
                        fontWeight: 700,
                        color: "#333333",
                      }}
                    >
                      空いている枠だけ反映する
                    </Typography>

                    <Box
                      component="span"
                      sx={{
                        px: 1,
                        py: 0.25,
                        borderRadius: 999,
                        bgcolor: "#FFB830",
                        color: "#333333",
                        fontSize: 10,
                        fontWeight: 700,
                        whiteSpace: "nowrap",
                      }}
                    >
                      おすすめ
                    </Box>
                  </Stack>

                  <Typography
                    component="div"
                    sx={{
                      mt: 0.6,
                      fontSize: 13,
                      color: "#777777",
                      lineHeight: 1.6,
                    }}
                  >
                    すでに決まっている献立はそのまま残します。
                  </Typography>
                </Box>

                <Typography
                  component="span"
                  sx={{
                    fontSize: 22,
                    lineHeight: 1,
                    color: "#D98300",
                    flexShrink: 0,
                  }}
                >
                  ›
                </Typography>
              </Stack>
            </Box>

            {/* 上書き */}
            <Box
              component="button"
              type="button"
              disabled={actionBusy}
              onClick={() => onApplyZuboraSet("overwrite")}
              sx={{
                width: "100%",
                p: 2,
                borderRadius: 3,
                border: "1px solid #E8DED1",
                bgcolor: "#FFFFFF",
                textAlign: "left",
                cursor: actionBusy ? "default" : "pointer",
                font: "inherit",
                transition: "all 120ms ease",
                "&:hover": {
                  bgcolor: actionBusy ? "#FFFFFF" : "#FAF8F5",
                  borderColor: actionBusy ? "#E8DED1" : "#D9C9B7",
                },
                "&:disabled": {
                  opacity: 0.6,
                },
              }}
            >
              <Stack
                direction="row"
                alignItems="flex-start"
                justifyContent="space-between"
                spacing={2}
              >
                <Box>
                  <Typography
                    component="div"
                    sx={{
                      fontSize: 16,
                      fontWeight: 700,
                      color: "#333333",
                    }}
                  >
                    今日の献立を上書きする
                  </Typography>

                  <Typography
                    component="div"
                    sx={{
                      mt: 0.6,
                      fontSize: 13,
                      color: "#777777",
                      lineHeight: 1.6,
                    }}
                  >
                    決まっている献立もズボラセットの内容に置き換えます。
                  </Typography>
                </Box>

                <Typography
                  component="span"
                  sx={{
                    fontSize: 22,
                    lineHeight: 1,
                    color: "#999999",
                    flexShrink: 0,
                  }}
                >
                  ›
                </Typography>
              </Stack>
            </Box>
          </Stack>
        </DialogContent>

        <DialogActions
          sx={{
            justifyContent: "center",
            px: 3.5,
            pt: 1.5,
            pb: 3,
          }}
        >
          <Button
            type="button"
            onClick={onCloseZuboraDialog}
            disabled={actionBusy}
            sx={{
              color: "#777777",
              fontSize: 13,
              fontWeight: 600,
              textTransform: "none",
              "&:hover": {
                bgcolor: "#F7F3EE",
              },
            }}
          >
            キャンセル
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}

export default function HomeTodayMenu() {
  const { user } = useAuth();

  const [todayKey, setTodayKey] = useState("");
  const [displayDayKey, setDisplayDayKey] = useState("");

  const [rangeKeys, setRangeKeys] = useState([]);

  const [dayDocsByKey, setDayDocsByKey] = useState({});
  const [recipesById, setRecipesById] = useState({});
  const [selectableRecipes, setSelectableRecipes] = useState([]);
  const [zuboraSets, setZuboraSets] = useState([]);
  const [selectedZuboraSet, setSelectedZuboraSet] = useState(null);

  const [loadingRange, setLoadingRange] = useState(true);
  const [error, setError] = useState("");

  const [actionBusy, setActionBusy] = useState(false);
  const [mealEditTarget, setMealEditTarget] = useState(null);
  const [recipeSearchQuery, setRecipeSearchQuery] = useState("");

  const [toast, setToast] = useState({
    open: false,
    message: "",
    severity: "success",
  });
  const showToast = useCallback((message, severity = "success") => {
    setToast({ open: true, message, severity });
  }, []);

  const chooseRandomZuboraSet = useCallback(() => {
    if (zuboraSets.length === 0) {
      setSelectedZuboraSet(null);
      return;
    }

    const randomIndex = Math.floor(Math.random() * zuboraSets.length);
    setSelectedZuboraSet(zuboraSets[randomIndex]);
  }, [zuboraSets]);

  useEffect(() => {
    const d = new Date();
    const key = toDateKey(d);

    setTodayKey(key);
    setDisplayDayKey(key);

    // 直近30日（取得用）
    const keys = [];
    for (let i = 29; i >= 0; i--) keys.push(toDateKey(addDays(d, -i)));
    setRangeKeys(keys);
  }, []);

  useEffect(() => {
    if (!user) {
      setZuboraSets([]);
      return;
    }

    const fetchZuboraSets = async () => {
      try {
        const sets = await listZuboraSets(user.uid);
        setZuboraSets(sets);
      } catch (e) {
        console.error("ズボラセットの取得に失敗しました", e);
        setZuboraSets([]);
      }
    };

    fetchZuboraSets();
  }, [user]);

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

  const displayDayData = displayDayKey ? dayDocsByKey[displayDayKey] : null;

  const hasEmptySlot = MEAL_ORDER.some((mealKey) =>
    SLOT_ORDER.some((slotKey) => !displayDayData?.[mealKey]?.[slotKey]),
  );

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

  const applySelectedZuboraSet = useCallback(
    async (mode) => {
      if (!user || !displayDayKey || !selectedZuboraSet) return;

      try {
        setActionBusy(true);

        const dayRef = doc(
          db,
          COLLECTION_WEEKLY_DAY,
          `${user.uid}_${displayDayKey}`,
        );

        const daySnap = await getDoc(dayRef);
        const currentDay = daySnap.exists() ? daySnap.data() || {} : {};

        const buildMeal = (mealKey) => {
          const currentMeal = currentDay?.[mealKey] || {};
          const zuboraMeal = selectedZuboraSet?.meals?.[mealKey] || {};

          if (mode === "overwrite") {
            return {
              staple: zuboraMeal.staple || null,
              main: zuboraMeal.main || null,
              side: zuboraMeal.side || null,
              soup: zuboraMeal.soup || null,
            };
          }

          return {
            staple: currentMeal.staple || zuboraMeal.staple || null,
            main: currentMeal.main || zuboraMeal.main || null,
            side: currentMeal.side || zuboraMeal.side || null,
            soup: currentMeal.soup || zuboraMeal.soup || null,
          };
        };

        await setDoc(
          dayRef,
          {
            userId: user.uid,
            breakfast: buildMeal("breakfast"),
            lunch: buildMeal("lunch"),
            dinner: buildMeal("dinner"),
            updatedAt: serverTimestamp(),
          },
          { merge: true },
        );

        await refreshDayAndRecipes(displayDayKey);
        setSelectedZuboraSet(null);

        showToast(
          mode === "overwrite"
            ? "ズボラセットで献立を上書きしました。"
            : "空いている献立にズボラセットを反映しました。",
          "success",
        );
      } catch (e) {
        console.error("applySelectedZuboraSet error:", e);
        showToast("ズボラセットの反映に失敗しました。", "error");
      } finally {
        setActionBusy(false);
      }
    },
    [user, displayDayKey, selectedZuboraSet, refreshDayAndRecipes, showToast],
  );

  /** ===============================
   * 変更する → /recipes の選択モードへ
   =============================== */

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

  const currentRecipeId = mealEditTarget
    ? dayDocsByKey?.[mealEditTarget.dayKey]?.[mealEditTarget.mealKey]?.[
        mealEditTarget.slotKey
      ] || null
    : null;

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
        <TodayDetail
          todayKey={displayDayKey}
          onCloseZuboraDialog={() => setSelectedZuboraSet(null)}
          dayData={displayDayKey ? dayDocsByKey[displayDayKey] : null}
          recipesMap={recipesById}
          loading={loadingRange}
          error={error}
          onChangeSlotRecipe={openMealEditDialog}
          actionBusy={actionBusy}
          onPrevDay={goPrevDay}
          onNextDay={goNextDay}
          onToday={goToday}
          selectedZuboraSet={selectedZuboraSet}
          onApplyZuboraSet={applySelectedZuboraSet}
        />

        {hasEmptySlot && (
          <Card
            sx={{
              mt: 2,
              mb: 2,
              p: { xs: 2, md: 2.5 },
              borderRadius: 4,
              border: "1.5px solid #F3C46B",
              bgcolor: "#FFF9F0",
              boxShadow: "0 6px 18px rgba(217, 131, 0, 0.08)",
            }}
          >
            <Stack
              direction={{ xs: "column", sm: "row" }}
              alignItems={{ xs: "stretch", sm: "center" }}
              justifyContent="space-between"
              spacing={2}
            >
              <Stack direction="row" alignItems="center" spacing={1.5}>
                <Box
                  sx={{
                    width: 44,
                    height: 44,
                    borderRadius: "50%",
                    bgcolor: "#FFF0D6",
                    display: "grid",
                    placeItems: "center",
                    flexShrink: 0,
                  }}
                >
                  <Box
                    component="img"
                    src="/icons/rakusuru/navigation/lg_brand_mascot.svg"
                    alt="ラクするごはん"
                    sx={{
                      width: 34,
                      height: 34,
                      objectFit: "contain",
                      display: "block",
                    }}
                  />
                </Box>

                <Box>
                  <Typography
                    sx={{
                      fontSize: 16,
                      fontWeight: 700,
                      color: "#333333",
                    }}
                  >
                    まだ決まっていない献立があります
                  </Typography>

                  <Typography
                    sx={{
                      mt: 0.5,
                      fontSize: 13,
                      color: "#777777",
                    }}
                  >
                    ズボラセットを使えば、まとめて献立を決められます。
                  </Typography>
                </Box>
              </Stack>

              <Button
                component={zuboraSets.length === 0 ? NextLink : "button"}
                href={
                  zuboraSets.length === 0 ? "/recipes/zubora/create" : undefined
                }
                onClick={
                  zuboraSets.length > 0 ? chooseRandomZuboraSet : undefined
                }
                variant="contained"
                sx={{
                  minHeight: 44,
                  px: 2.5,
                  borderRadius: 999,
                  bgcolor: "#FFB830",
                  color: "#333333",
                  fontWeight: 700,
                  fontSize: 14,
                  textTransform: "none",
                  boxShadow: "none",
                  whiteSpace: "nowrap",
                  "&:hover": {
                    bgcolor: "#F5A900",
                    boxShadow: "none",
                  },
                }}
              >
                {zuboraSets.length > 0
                  ? "ズボラセットで決める ›"
                  : "ズボラセットを作る ›"}
              </Button>
            </Stack>
          </Card>
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

        <RecipeSelectionDrawer
          open={!!mealEditTarget}
          mealLabel={mealEditTarget ? MEAL_LABEL[mealEditTarget.mealKey] : ""}
          selectedSlot={mealEditTarget?.slotKey || "staple"}
          recipes={selectableRecipes}
          currentRecipeId={currentRecipeId}
          searchQuery={recipeSearchQuery}
          busy={actionBusy}
          onClose={() => setMealEditTarget(null)}
          onChangeSlot={(slotKey) => {
            setMealEditTarget((prev) =>
              prev
                ? {
                    ...prev,
                    slotKey,
                  }
                : prev,
            );
          }}
          onChangeSearchQuery={setRecipeSearchQuery}
          onSelectRecipe={saveSlotRecipe}
          onRemoveRecipe={() => {
            if (!mealEditTarget) return;

            deleteSlotRecipe(
              mealEditTarget.dayKey,
              mealEditTarget.mealKey,
              mealEditTarget.slotKey,
            );
          }}
        />

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
