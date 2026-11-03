import AppLayout from "@/components/layout/AppLayout";
import React, { useEffect, useState } from "react";
import { useRouter } from "next/router";
import { doc, getDoc, deleteDoc } from "firebase/firestore";
import { db, auth } from "@/lib/firebase";
import RecipeImage from "@/components/recipes/RecipeImage";
import { parseRecipeSource } from "@/features/recipes/utils/recipeSource";
import { OpenInNew } from "@mui/icons-material";

import {
  Box,
  Card,
  CardContent,
  Typography,
  Stack,
  Chip,
  Button,
  Divider,
} from "@mui/material";

function IngredientRow({ name, quantity }) {
  return (
    <Stack
      direction="row"
      justifyContent="space-between"
      spacing={2}
      sx={{
        py: 1,
        borderBottom: "1px solid #F0ECE6",
      }}
    >
      <Typography variant="body2">{name}</Typography>

      {quantity && (
        <Typography
          variant="body2"
          color="text.secondary"
          sx={{ whiteSpace: "nowrap" }}
        >
          {quantity}
        </Typography>
      )}
    </Stack>
  );
}

export default function RecipeDetailPage() {
  const router = useRouter();
  const { id, from, back } = router.query;

  // ✅ back を安全に復元（/recipes か /home だけ許可）
  const getSafeBackHref = () => {
    if (typeof back !== "string" || !back) return null;

    try {
      const decoded = decodeURIComponent(back);

      // 外部URLや変な遷移を防止（最低限：アプリ内パスのみ許可）
      if (decoded.startsWith("/recipes")) return decoded;
      if (decoded.startsWith("/home")) return decoded;

      return null;
    } catch {
      return null;
    }
  };

  const safeBack = getSafeBackHref();

  const backHref = safeBack ?? (from === "home" ? "/home" : "/recipes");

  const backLabel = safeBack?.startsWith("/recipes/zubora/edit/")
    ? "ズボラセット編集に戻る"
    : safeBack?.startsWith("/recipes/zubora/")
      ? "ズボラセットに戻る"
      : safeBack
        ? "レシピ一覧に戻る"
        : from === "home"
          ? "ホームに戻る"
          : "レシピ一覧に戻る";

  const [recipe, setRecipe] = useState(null);
  const [loading, setLoading] = useState(true);

  const categoryLabels = {
    staple: "主食",
    main: "主菜",
    side: "副菜",
    soup: "汁物",
  };

  useEffect(() => {
    if (!id) return;

    const fetchRecipe = async () => {
      try {
        const refDoc = doc(db, "recipes", id);
        const snap = await getDoc(refDoc);

        if (!snap.exists()) {
          alert("レシピが見つかりませんでした");
          router.push(backHref); // ✅ ここを backHref に
          return;
        }

        setRecipe({ id: snap.id, ...snap.data() });
        setLoading(false);
      } catch (err) {
        console.error("レシピ取得エラー:", err);
        alert("レシピの取得中にエラーが発生しました");
        router.push(backHref); // ✅ ここも backHref に
      }
    };

    fetchRecipe();
  }, [id, router, backHref]);

  const handleDelete = async () => {
    if (!recipe) return;
    const ok = window.confirm("このレシピを削除しますか？");
    if (!ok) return;

    try {
      await deleteDoc(doc(db, "recipes", recipe.id));
      alert("レシピを削除しました");
      router.push(backHref); // ✅ 削除後も backHref に戻す
    } catch (err) {
      console.error("削除エラー:", err);
      alert("削除に失敗しました");
    }
  };

  if (loading) {
    return (
      <Box sx={{ mt: 4, textAlign: "center" }}>
        <Typography>レシピを読み込んでいます…</Typography>
      </Box>
    );
  }

  if (!recipe) {
    return null;
  }

  const parsedSource = parseRecipeSource(
    recipe.sourceUrl || recipe.videoUrl || "",
  );

  const sourceType = recipe.sourceType || parsedSource?.sourceType || "manual";

  const sourceUrl =
    recipe.sourceUrl ||
    parsedSource?.sourceUrl ||
    (sourceType === "youtube" ? recipe.videoUrl : null);

  const sourceMeta = {
    youtube: {
      badge: "YouTubeから登録",
      name: "YouTube",
      buttonLabel: "YouTubeで見る",
    },
    instagram: {
      badge: "Instagramから登録",
      name: "Instagram",
      buttonLabel: "Instagramで見る",
    },
  };

  const externalSource = sourceMeta[sourceType] ?? null;

  const isMine = recipe.userId && recipe.userId === auth.currentUser?.uid;

  //  具材と調味料をそれぞれ配列として扱う（なければ []）
  const ingredients = Array.isArray(recipe.ingredients)
    ? recipe.ingredients
    : [];
  const seasonings = Array.isArray(recipe.seasonings) ? recipe.seasonings : [];

  // 将来 servings フィールドを入れたとき用
  const servings = recipe.servings;

  return (
    <AppLayout title="レシピ詳細" activeNav="recipes">
      <Box sx={{ maxWidth: 800, mx: "auto", mt: 4, px: 2 }}>
        <Button onClick={() => router.push(backHref)} sx={{ mb: 2 }}>
          ← {backLabel}
        </Button>

        <Card>
          <RecipeImage
            imageUrl={recipe.imageUrl}
            title={recipe.recipeName}
            height={300}
          />

          <CardContent>
            {/* タイトル */}
            <Typography
              variant="h4"
              sx={{
                fontSize: { xs: 24, sm: 28 },
                fontWeight: 800,
                color: "#333333",
                mb: 1,
              }}
            >
              {recipe.recipeName || "タイトル未設定"}
            </Typography>

            {externalSource && (
              <Chip
                size="small"
                label={externalSource.badge}
                sx={{
                  mb: 2,
                  bgcolor: "#FFF3E0",
                  color: "#D97706",
                  fontWeight: 700,
                }}
              />
            )}

            {/* カロリー & 調理時間 & カテゴリー */}
            <Stack direction="row" spacing={1} mb={2}>
              {recipe.cookingTime != null && (
                <Chip
                  label={`🕒 調理時間: ${recipe.cookingTime} 分`}
                  size="small"
                />
              )}
              {recipe.calories != null && (
                <Chip
                  label={`🔥 カロリー: ${recipe.calories} kcal`}
                  size="small"
                />
              )}
              {recipe.category && (
                <Chip
                  label={`📂 ${categoryLabels[recipe.category] || "未分類"}`}
                  size="small"
                  sx={{ mb: 1 }}
                />
              )}
            </Stack>

            <Divider sx={{ my: 2 }} />

            {/* 材料ブロック（具材 / 調味料） */}
            <Box sx={{ mt: 1 }}>
              <Typography variant="h6" gutterBottom>
                {servings ? `材料（${servings}人分）` : "材料"}
              </Typography>

              {/* オレンジっぽいライン風（色はお好みで） */}
              <Divider sx={{ mb: 1, borderBottomWidth: 2 }} />

              {/* 具材 */}
              <Typography
                variant="subtitle2"
                sx={{ mt: 1.5, mb: 0.5, fontWeight: "bold" }}
              >
                ■ 具材
              </Typography>
              {ingredients.length > 0 ? (
                <Box sx={{ mb: 2 }}>
                  {ingredients.map((ing, index) => (
                    <IngredientRow
                      key={`ing-${index}`}
                      name={ing.name}
                      quantity={ing.quantity}
                    />
                  ))}
                </Box>
              ) : (
                <Typography variant="body2" color="text.secondary">
                  なし
                </Typography>
              )}

              {/* 調味料 */}
              <Typography
                variant="subtitle2"
                sx={{ mt: 2, mb: 0.5, fontWeight: "bold" }}
              >
                ■ 調味料
              </Typography>
              {seasonings.length > 0 ? (
                <Box sx={{ mb: 2 }}>
                  {seasonings.map((s, index) => (
                    <IngredientRow
                      key={`sea-${index}`}
                      name={s.name}
                      quantity={s.quantity}
                    />
                  ))}
                </Box>
              ) : (
                // 🔽 フィールドが無い or 配列が空のときは「なし」
                <Typography variant="body2" color="text.secondary">
                  なし
                </Typography>
              )}
            </Box>

            {externalSource && sourceUrl && (
              <>
                <Divider sx={{ my: 3 }} />

                <Box>
                  <Typography
                    variant="h6"
                    sx={{
                      mb: 1.5,
                      fontWeight: 800,
                      color: "#333333",
                    }}
                  >
                    元コンテンツ
                  </Typography>

                  <Box
                    sx={{
                      p: 2,
                      borderRadius: 3,
                      bgcolor: "#FFF8EE",
                      border: "1px solid #F4D7AA",
                    }}
                  >
                    <Stack
                      direction={{ xs: "column", sm: "row" }}
                      alignItems={{ xs: "stretch", sm: "center" }}
                      justifyContent="space-between"
                      spacing={2}
                    >
                      <Box>
                        <Typography
                          sx={{
                            fontWeight: 700,
                            color: "#333333",
                          }}
                        >
                          {externalSource.name}
                        </Typography>

                        <Typography
                          variant="body2"
                          color="text.secondary"
                          sx={{ mt: 0.5 }}
                        >
                          作り方などは元コンテンツで確認できます
                        </Typography>
                      </Box>

                      <Button
                        component="a"
                        href={sourceUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        variant="outlined"
                        endIcon={<OpenInNew />}
                        sx={{
                          borderRadius: 999,
                          borderColor: "#FFB830",
                          color: "#9A6700",
                          fontWeight: 700,
                          whiteSpace: "nowrap",
                          "&:hover": {
                            borderColor: "#F5A900",
                            bgcolor: "#FFF3E0",
                          },
                        }}
                      >
                        {externalSource.buttonLabel}
                      </Button>
                    </Stack>
                  </Box>
                </Box>
              </>
            )}

            {/* 作成日時（あれば） */}
            {recipe.createdAt && (
              <Typography
                variant="caption"
                color="text.secondary"
                sx={{ display: "block", mt: 2 }}
              >
                作成日:{" "}
                {recipe.createdAt.toDate
                  ? recipe.createdAt.toDate().toLocaleString()
                  : String(recipe.createdAt)}
              </Typography>
            )}
          </CardContent>

          {/* フッターアクション */}
          <Box
            sx={{
              display: "flex",
              justifyContent: "space-between",
              px: 2,
              pb: 2,
            }}
          >
            {isMine ? (
              <Stack direction="row" spacing={1}>
                <Button
                  variant="outlined"
                  onClick={() => router.push(`/recipes/edit/${recipe.id}`)}
                >
                  編集
                </Button>
                <Button variant="outlined" color="error" onClick={handleDelete}>
                  削除
                </Button>
              </Stack>
            ) : (
              <Typography variant="caption" sx={{ ml: 1 }}>
                閲覧のみ
              </Typography>
            )}
            <Box />
          </Box>
        </Card>
      </Box>
    </AppLayout>
  );
}
