import { useEffect, useState } from "react";
import { useRouter } from "next/router";
import { onAuthStateChanged } from "firebase/auth";
import { doc, getDoc, setDoc, serverTimestamp } from "firebase/firestore";
import {
  Alert,
  Box,
  Button,
  Card,
  Chip,
  Dialog,
  DialogContent,
  Snackbar,
  Stack,
  Typography,
} from "@mui/material";
import AppLayout from "@/components/layout/AppLayout";

import { auth, db } from "@/lib/firebase";
import { getZuboraSet } from "@/features/zuboraSets/repositories/zuboraSetRepository";
import type { ZuboraSet } from "@/features/zuboraSets/types";
import { listRecipes } from "@/features/recipes/repositories/recipeRepo";
import MealRecipeGrid from "@/features/recipes/components/MealRecipeGrid";
const MEAL_ICON = {
  breakfast: "/icons/rakusuru/content/lg_content_breakfast_time.png",
  lunch: "/icons/rakusuru/content/lg_content_lunch_time.png",
  dinner: "/icons/rakusuru/content/lg_content_dinner_time.png",
};

export default function ZuboraSetDetailPage() {
  const router = useRouter();
  const { id } = router.query;

  const [zuboraSet, setZuboraSet] = useState<ZuboraSet | null>(null);
  const [applyDialogOpen, setApplyDialogOpen] = useState(false);
  const [toast, setToast] = useState({
    open: false,
    message: "",
    severity: "success" as "success" | "error",
  });
  const [loading, setLoading] = useState(true);
  const [recipes, setRecipes] = useState<
    Awaited<ReturnType<typeof listRecipes>>
  >([]);
  const recipesById = Object.fromEntries(
    recipes.map((recipe) => [recipe.id, recipe]),
  );

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
        setRecipes(recipeList);
      } catch (error) {
        console.error("ズボラセットの取得に失敗しました", error);
      } finally {
        setLoading(false);
      }
    });

    return unsubscribe;
  }, [router.isReady, id]);

  if (loading) {
    return <div>読み込み中...</div>;
  }

  if (!zuboraSet) {
    return <div>ズボラセットが見つかりません。</div>;
  }

  const pad2 = (n: number) => String(n).padStart(2, "0");

  const toDateKey = (date: Date) =>
    `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())}`;
  const handleAddToToday = async () => {
    const user = auth.currentUser;

    if (!user) {
      return;
    }

    try {
      const todayKey = toDateKey(new Date());
      const dayRef = doc(db, "weeklyDaySets", `${user.uid}_${todayKey}`);
      const snap = await getDoc(dayRef);

      const current = snap.exists() ? snap.data() : {};

      const mergeMeal = (
        currentMeal: Record<string, string | null | undefined> = {},
        zuboraMeal: Record<string, string | null | undefined>,
      ) => ({
        staple: currentMeal.staple || zuboraMeal.staple || null,
        main: currentMeal.main || zuboraMeal.main || null,
        side: currentMeal.side || zuboraMeal.side || null,
        soup: currentMeal.soup || zuboraMeal.soup || null,
      });

      await setDoc(
        dayRef,
        {
          userId: user.uid,
          breakfast: mergeMeal(current.breakfast, zuboraSet.meals.breakfast),
          lunch: mergeMeal(current.lunch, zuboraSet.meals.lunch),
          dinner: mergeMeal(current.dinner, zuboraSet.meals.dinner),
          updatedAt: serverTimestamp(),
        },
        { merge: true },
      );

      setApplyDialogOpen(false);
      setToast({
        open: true,
        message: "今日の献立に追加しました。",
        severity: "success",
      });
    } catch (error) {
      console.error("ズボラセットの追加反映に失敗しました", error);
      setToast({
        open: true,
        message: "今日の献立への追加に失敗しました。",
        severity: "error",
      });
    }
  };
  const handleOverwriteToday = async () => {
    const user = auth.currentUser;

    if (!user) {
      return;
    }

    try {
      const todayKey = toDateKey(new Date());
      const dayRef = doc(db, "weeklyDaySets", `${user.uid}_${todayKey}`);

      await setDoc(
        dayRef,
        {
          userId: user.uid,
          breakfast: zuboraSet.meals.breakfast,
          lunch: zuboraSet.meals.lunch,
          dinner: zuboraSet.meals.dinner,
          updatedAt: serverTimestamp(),
        },
        { merge: true },
      );

      setApplyDialogOpen(false);
      setToast({
        open: true,
        message: "今日の献立を上書きしました。",
        severity: "success",
      });
    } catch (error) {
      console.error("ズボラセットの上書き反映に失敗しました", error);
      setToast({
        open: true,
        message: "今日の献立の上書きに失敗しました。",
        severity: "error",
      });
    }
  };
  return (
    <AppLayout title="ズボラセット詳細" activeNav="recipes">
      <Box
        component="main"
        sx={{
          maxWidth: 760,
          mx: "auto",
          px: { xs: 2, sm: 3 },
          py: 4,
        }}
      >
        <Card
          sx={{
            p: 3,
            borderRadius: 3,
            border: "1px solid #EEEEEE",
            boxShadow: "0 4px 14px rgba(0,0,0,0.04)",
          }}
        >
          <Stack spacing={1.5}>
            <Stack
              direction="row"
              alignItems="center"
              justifyContent="space-between"
              spacing={2}
            >
              <Stack
                direction="row"
                alignItems="center"
                spacing={1}
                sx={{ minWidth: 0 }}
              >
                <Typography
                  component="h1"
                  sx={{
                    fontSize: 24,
                    fontWeight: 700,
                    color: "#333333",
                  }}
                >
                  {zuboraSet.name}
                </Typography>

                <Chip
                  size="small"
                  label={
                    zuboraSet.category === "standard"
                      ? "定番"
                      : zuboraSet.category === "quick"
                        ? "時短"
                        : zuboraSet.category === "saving"
                          ? "節約"
                          : "その他"
                  }
                  sx={{
                    flexShrink: 0,
                    bgcolor: "#FFF3E0",
                    color: "#D98300",
                    fontWeight: 700,
                  }}
                />
              </Stack>

              <Button
                variant="outlined"
                onClick={() =>
                  router.push(`/recipes/zubora/edit/${zuboraSet.id}`)
                }
                sx={{
                  flexShrink: 0,
                  borderRadius: 3,
                  borderColor: "#F2C98C",
                  color: "#D98300",
                  fontWeight: 700,
                  textTransform: "none",
                  "&:hover": {
                    borderColor: "#D98300",
                    bgcolor: "#FFF8ED",
                  },
                }}
              >
                編集する
              </Button>
            </Stack>

            <Typography
              sx={{
                fontSize: 14,
                color: "#666666",
              }}
            >
              {zuboraSet.description || "説明文が設定されていません。"}
            </Typography>
          </Stack>
        </Card>
        <Card
          sx={{
            mt: 4,
            p: 2.5,
            borderRadius: 3,
            border: "1px solid #EEEEEE",
            boxShadow: "none",
          }}
        >
          <Stack
            direction="row"
            alignItems="center"
            spacing={1}
            sx={{ mb: 1.5 }}
          >
            <Box
              component="img"
              src={MEAL_ICON.breakfast}
              alt=""
              sx={{
                width: 28,
                height: 28,
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
            onRecipeClick={(recipeId) => {
              const back = router.asPath;

              router.push(
                `/recipes/${recipeId}?back=${encodeURIComponent(back)}`,
              );
            }}
          />
        </Card>

        <Card
          sx={{
            mt: 4,
            p: 2.5,
            borderRadius: 3,
            border: "1px solid #EEEEEE",
            boxShadow: "none",
          }}
        >
          <Stack
            direction="row"
            alignItems="center"
            spacing={1}
            sx={{ mb: 1.5 }}
          >
            <Box
              component="img"
              src={MEAL_ICON.lunch}
              alt=""
              sx={{
                width: 28,
                height: 28,
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
            onRecipeClick={(recipeId) => {
              const back = router.asPath;

              router.push(
                `/recipes/${recipeId}?back=${encodeURIComponent(back)}`,
              );
            }}
          />
        </Card>

        <Card
          sx={{
            mt: 4,
            p: 2.5,
            borderRadius: 3,
            border: "1px solid #EEEEEE",
            boxShadow: "none",
          }}
        >
          <Stack
            direction="row"
            alignItems="center"
            spacing={1}
            sx={{ mb: 1.5 }}
          >
            <Box
              component="img"
              src={MEAL_ICON.dinner}
              alt=""
              sx={{
                width: 28,
                height: 28,
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
            onRecipeClick={(recipeId) => {
              const back = router.asPath;

              router.push(
                `/recipes/${recipeId}?back=${encodeURIComponent(back)}`,
              );
            }}
          />
        </Card>
        <Card
          sx={{
            mt: 4,
            p: 2.5,
            borderRadius: 3,
            border: "1px solid #EEEEEE",
            boxShadow: "none",
          }}
        >
          <Typography
            component="h2"
            sx={{
              mb: 1.5,
              fontSize: 18,
              fontWeight: 700,
              color: "#333333",
            }}
          >
            セットの情報
          </Typography>

          <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
            {(zuboraSet.tags ?? []).length > 0 ? (
              zuboraSet.tags?.slice(0, 3).map((tag) => (
                <Chip
                  key={tag}
                  label={tag}
                  size="small"
                  sx={{
                    bgcolor: "#FFF3E0",
                    color: "#D98300",
                    fontWeight: 700,
                  }}
                />
              ))
            ) : (
              <Typography
                sx={{
                  fontSize: 13,
                  color: "#999999",
                }}
              >
                タグは設定されていません。
              </Typography>
            )}
          </Stack>
        </Card>
        <Button
          fullWidth
          variant="contained"
          onClick={() => setApplyDialogOpen(true)}
          sx={{
            mt: 3,
            py: 1.5,
            borderRadius: 3,
            bgcolor: "#FFB830",
            color: "#333333",
            fontSize: 16,
            fontWeight: 700,
            boxShadow: "none",
            textTransform: "none",
            "&:hover": {
              bgcolor: "#F2A900",
              boxShadow: "none",
            },
          }}
        >
          このセットを使う
        </Button>
      </Box>
      <Dialog
        open={applyDialogOpen}
        onClose={() => setApplyDialogOpen(false)}
        fullWidth
        maxWidth="xs"
        PaperProps={{
          sx: {
            borderRadius: 4,
          },
        }}
      >
        <DialogContent sx={{ p: 3 }}>
          <Stack spacing={2}>
            <Box sx={{ textAlign: "center" }}>
              <Typography
                component="h2"
                sx={{
                  fontSize: 20,
                  fontWeight: 700,
                  color: "#333333",
                }}
              >
                今日の献立に反映しますか？
              </Typography>

              <Typography
                sx={{
                  mt: 0.5,
                  fontSize: 13,
                  color: "#777777",
                }}
              >
                反映方法を選んでください。
              </Typography>
            </Box>

            <Button
              fullWidth
              variant="outlined"
              onClick={handleAddToToday}
              sx={{
                justifyContent: "flex-start",
                p: 2,
                borderRadius: 3,
                borderColor: "#F2C98C",
                color: "#333333",
                textTransform: "none",
              }}
            >
              <Box sx={{ textAlign: "left" }}>
                <Typography sx={{ fontSize: 15, fontWeight: 700 }}>
                  ＋ 空いている枠に追加する
                </Typography>
                <Typography sx={{ mt: 0.5, fontSize: 12, color: "#777777" }}>
                  すでに登録済みの献立は残し、未登録の枠だけ反映します
                </Typography>
              </Box>
            </Button>

            <Button
              fullWidth
              variant="outlined"
              onClick={handleOverwriteToday}
              sx={{
                justifyContent: "flex-start",
                p: 2,
                borderRadius: 3,
                borderColor: "#E5E5E5",
                color: "#333333",
                textTransform: "none",
              }}
            >
              <Box sx={{ textAlign: "left" }}>
                <Typography sx={{ fontSize: 15, fontWeight: 700 }}>
                  ↻ 今日の献立を上書きする
                </Typography>
                <Typography sx={{ mt: 0.5, fontSize: 12, color: "#777777" }}>
                  現在の今日の献立を、このズボラセットの内容で置き換えます
                </Typography>
              </Box>
            </Button>

            <Button
              fullWidth
              onClick={() => setApplyDialogOpen(false)}
              sx={{
                color: "#666666",
                bgcolor: "#F5F5F5",
                borderRadius: 3,
                py: 1.3,
                textTransform: "none",
              }}
            >
              キャンセル
            </Button>
          </Stack>
        </DialogContent>
      </Dialog>
      <Snackbar
        open={toast.open}
        autoHideDuration={2500}
        onClose={() =>
          setToast((prev) => ({
            ...prev,
            open: false,
          }))
        }
        anchorOrigin={{
          vertical: "bottom",
          horizontal: "center",
        }}
      >
        <Alert
          onClose={() =>
            setToast((prev) => ({
              ...prev,
              open: false,
            }))
          }
          severity={toast.severity}
          sx={{
            width: "100%",
            fontWeight: 700,
          }}
        >
          {toast.message}
        </Alert>
      </Snackbar>
    </AppLayout>
  );
}
