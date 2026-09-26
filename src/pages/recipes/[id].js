import AppLayout from "@/components/layout/AppLayout";
import React, { useEffect, useState } from "react";
import { useRouter } from "next/router";
import { doc, getDoc, deleteDoc } from "firebase/firestore";
import { db, auth } from "@/lib/firebase";
import RecipeImage from "@/components/recipes/RecipeImage";

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

// --- YouTubeの埋め込み用URLを作る関数 ---
const getEmbedUrl = (url) => {
  if (!url) return null;

  try {
    // すでに embed URL の場合はそのまま使う
    if (url.includes("youtube.com/embed")) return url;

    const u = new URL(url);
    const hostname = u.hostname;
    const pathname = u.pathname; // 例: "/watch" or "/shorts/XXX"
    const params = u.searchParams;

    // youtu.be の短縮URL 例: https://youtu.be/VIDEO_ID
    if (hostname === "youtu.be") {
      const videoId = pathname.replace("/", "").split("/")[0];
      if (videoId) {
        return `https://www.youtube.com/embed/${videoId}`;
      }
    }

    // ショート動画: https://www.youtube.com/shorts/VIDEO_ID
    if (hostname.includes("youtube.com") && pathname.startsWith("/shorts/")) {
      const parts = pathname.split("/"); // ["", "shorts", "VIDEO_ID"]
      const videoId = parts[2];
      if (videoId) {
        return `https://www.youtube.com/embed/${videoId}`;
      }
    }

    // 通常動画: https://www.youtube.com/watch?v=VIDEO_ID
    if (hostname.includes("youtube.com") && pathname === "/watch") {
      const videoId = params.get("v");
      if (videoId) {
        return `https://www.youtube.com/embed/${videoId}`;
      }
    }

    // ここまで来たら対応外URL
    return null;
  } catch (e) {
    console.error("動画URL解析エラー:", e);
    return null;
  }
};

// 👇 行の見た目（左：名前、右：量）を共通化
function IngredientRow({ name, quantity }) {
  return (
    <Stack
      direction="row"
      justifyContent="space-between"
      sx={{
        py: 0.75,
        borderBottom: "1px solid #eee",
      }}
    >
      <Typography variant="body2">{name}</Typography>
      <Typography variant="body2">{quantity}</Typography>
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

  const backLabel = safeBack
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

  // 「動画があるかどうか」を判定
  const embedUrl = getEmbedUrl(recipe.videoUrl);

  const isMine = recipe.authorId && recipe.authorId === auth.currentUser?.uid;

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
          {/* ▼ 動画があれば動画を最上部に、なければアイキャッチ画像 */}
          {embedUrl ? (
            <Box
              sx={{
                position: "relative",
                pt: "56.25%", // 16:9
                backgroundColor: "#000",
              }}
            >
              <Box
                component="iframe"
                src={embedUrl}
                sx={{
                  position: "absolute",
                  top: 0,
                  left: 0,
                  width: "100%",
                  height: "100%",
                  border: 0,
                }}
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                allowFullScreen
              />
            </Box>
          ) : (
            <RecipeImage
              imageUrl={recipe.imageUrl}
              title={recipe.recipeName}
              height={260}
            />
          )}

          <CardContent>
            {/* タイトル */}
            <Typography variant="h4" gutterBottom>
              {recipe.recipeName || "タイトル未設定"}
            </Typography>

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
