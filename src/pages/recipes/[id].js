import AppLayout from "@/components/layout/AppLayout";
import React, { useEffect, useState } from "react";
import { useRouter } from "next/router";
import { doc, getDoc, deleteDoc } from "firebase/firestore";
import { db, auth } from "@/lib/firebase";
import RecipeImage from "@/components/recipes/RecipeImage";
import { parseRecipeSource } from "@/features/recipes/utils/recipeSource";
import {
  Instagram,
  YouTube,
  OpenInNew,
  AccessTime,
  PeopleOutline,
} from "@mui/icons-material";
import Script from "next/script";
import Image from "next/image";

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

const getYouTubeEmbedUrl = (url) => {
  if (!url) return null;

  try {
    const parsed = new URL(url);
    const hostname = parsed.hostname.toLowerCase();
    const pathname = parsed.pathname;

    if (hostname === "youtu.be") {
      const videoId = pathname.split("/").filter(Boolean)[0];

      return videoId ? `https://www.youtube.com/embed/${videoId}` : null;
    }

    const isYouTube =
      hostname === "youtube.com" || hostname.endsWith(".youtube.com");

    if (!isYouTube) return null;

    if (pathname === "/watch") {
      const videoId = parsed.searchParams.get("v");

      return videoId ? `https://www.youtube.com/embed/${videoId}` : null;
    }

    if (pathname.startsWith("/shorts/")) {
      const videoId = pathname.split("/").filter(Boolean)[1];

      return videoId ? `https://www.youtube.com/embed/${videoId}` : null;
    }

    if (pathname.startsWith("/embed/")) {
      const videoId = pathname.split("/").filter(Boolean)[1];

      return videoId ? `https://www.youtube.com/embed/${videoId}` : null;
    }

    return null;
  } catch {
    return null;
  }
};

const isInstagramReelUrl = (url) => {
  if (!url) return false;

  try {
    const parsed = new URL(url);
    const hostname = parsed.hostname.toLowerCase();

    const isInstagram =
      hostname === "instagram.com" || hostname.endsWith(".instagram.com");

    return isInstagram && parsed.pathname.startsWith("/reel/");
  } catch {
    return false;
  }
};

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

  const youtubeEmbedUrl =
    sourceType === "youtube"
      ? getYouTubeEmbedUrl(sourceUrl || recipe.videoUrl)
      : null;

  const isInstagramReel =
    sourceType === "instagram" && isInstagramReelUrl(sourceUrl);

  const displayTags = Array.isArray(recipe.searchTags)
    ? recipe.searchTags
    : Array.isArray(recipe.tags)
      ? recipe.tags
      : [];

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
      <Box
        sx={{
          maxWidth: 560,
          mx: "auto",
          mt: { xs: 2, sm: 4 },
          px: { xs: 2, sm: 3 },
          pb: 5,
        }}
      >
        {/* 戻る */}
        <Button
          onClick={() => router.push(backHref)}
          sx={{
            mb: 2,
            px: 0,
            minWidth: 0,
            color: "#666666",
            fontWeight: 700,
            "&:hover": {
              bgcolor: "transparent",
              color: "#333333",
            },
          }}
        >
          ← {backLabel}
        </Button>

        <Card
          elevation={0}
          sx={{
            overflow: "hidden",
            borderRadius: 3,
            border: "1px solid #EEE8DF",
            bgcolor: "#FFFFFF",
            boxShadow: "0 4px 16px rgba(80, 60, 30, 0.06)",
          }}
        >
          {/* メインメディア */}
          {youtubeEmbedUrl ? (
            <Box
              sx={{
                width: "100%",
                bgcolor: "#000000",
              }}
            >
              <Box
                sx={{
                  position: "relative",
                  pt: "56.25%",
                }}
              >
                <Box
                  component="iframe"
                  src={youtubeEmbedUrl}
                  title={`${recipe.recipeName || "レシピ"}の動画`}
                  sx={{
                    position: "absolute",
                    inset: 0,
                    width: "100%",
                    height: "100%",
                    border: 0,
                  }}
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                  allowFullScreen
                />
              </Box>
            </Box>
          ) : isInstagramReel && sourceUrl ? (
            <Box
              sx={{
                display: "flex",
                justifyContent: "center",
                bgcolor: "#FFFFFF",
                overflow: "hidden",
              }}
            >
              <Script
                src="https://www.instagram.com/embed.js"
                strategy="afterInteractive"
                onReady={() => {
                  window.instgrm?.Embeds?.process?.();
                }}
              />

              <Box
                component="blockquote"
                className="instagram-media"
                data-instgrm-permalink={sourceUrl}
                data-instgrm-version="14"
                sx={{
                  width: "100%",
                  maxWidth: 540,
                  minWidth: 0,
                  m: "0 auto !important",
                  border: "0 !important",
                }}
              >
                <Box
                  component="a"
                  href={sourceUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  Instagramで見る
                </Box>
              </Box>
            </Box>
          ) : (
            <RecipeImage
              imageUrl={recipe.imageUrl}
              title={recipe.recipeName}
              height={280}
            />
          )}

          <CardContent
            sx={{
              p: { xs: 2.5, sm: 4 },
              "&:last-child": {
                pb: { xs: 2.5, sm: 4 },
              },
            }}
          >
            {/* タイトル */}
            <Typography
              component="h1"
              sx={{
                fontSize: { xs: 20, sm: 22 },
                lineHeight: 1.5,
                fontWeight: 800,
                color: "#333333",
              }}
            >
              {recipe.recipeName || "タイトル未設定"}
            </Typography>

            {/* 登録元 */}
            {externalSource && sourceUrl && (
              <Stack
                direction="row"
                alignItems="center"
                justifyContent="space-between"
                spacing={2}
                sx={{
                  mt: 1.5,
                  mb: 2,
                }}
              >
                <Stack direction="row" alignItems="center" spacing={1}>
                  {sourceType === "instagram" && (
                    <Instagram
                      sx={{
                        fontSize: 22,
                        color: "#E4405F",
                      }}
                    />
                  )}

                  {sourceType === "youtube" && (
                    <YouTube
                      sx={{
                        fontSize: 24,
                        color: "#FF0000",
                      }}
                    />
                  )}

                  <Typography
                    variant="body2"
                    sx={{
                      fontWeight: 700,
                      color: "#555555",
                    }}
                  >
                    {externalSource.name}
                  </Typography>
                </Stack>

                <Button
                  component="a"
                  href={sourceUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  size="small"
                  endIcon={<OpenInNew />}
                  sx={{
                    p: 0,
                    minWidth: 0,
                    color: "#1976D2",
                    fontWeight: 700,
                    "&:hover": {
                      bgcolor: "transparent",
                      textDecoration: "underline",
                    },
                  }}
                >
                  元コンテンツを見る
                </Button>
              </Stack>
            )}

            {/* 基本情報 */}
            {(recipe.cookingTime != null || servings || recipe.category) && (
              <Stack
                direction="row"
                divider={<Divider orientation="vertical" flexItem />}
                sx={{
                  mt: 1,
                  mb: 2.5,
                  py: 1.5,
                  borderTop: "1px solid #F0ECE6",
                  borderBottom: "1px solid #F0ECE6",
                }}
              >
                {recipe.cookingTime != null && (
                  <Stack
                    direction="row"
                    spacing={1}
                    alignItems="center"
                    justifyContent="center"
                    sx={{ flex: 1 }}
                  >
                    <AccessTime
                      sx={{
                        fontSize: 25,
                        color: "#5A3324",
                      }}
                    />

                    <Box>
                      <Typography
                        sx={{
                          fontSize: 14,
                          fontWeight: 800,
                        }}
                      >
                        {recipe.cookingTime}分
                      </Typography>

                      <Typography variant="caption" color="text.secondary">
                        調理時間
                      </Typography>
                    </Box>
                  </Stack>
                )}

                {servings && (
                  <Stack
                    direction="row"
                    spacing={1}
                    alignItems="center"
                    justifyContent="center"
                    sx={{ flex: 1 }}
                  >
                    <PeopleOutline
                      sx={{
                        fontSize: 27,
                        color: "#6B7A2D",
                      }}
                    />

                    <Box>
                      <Typography
                        sx={{
                          fontSize: 14,
                          fontWeight: 800,
                        }}
                      >
                        {servings}人分
                      </Typography>

                      <Typography variant="caption" color="text.secondary">
                        分量
                      </Typography>
                    </Box>
                  </Stack>
                )}

                {recipe.category && (
                  <Box
                    sx={{
                      flex: 1,
                      textAlign: "center",
                    }}
                  >
                    <Typography
                      sx={{
                        fontSize: 14,
                        fontWeight: 800,
                      }}
                    >
                      {categoryLabels[recipe.category] || "未分類"}
                    </Typography>

                    <Typography variant="caption" color="text.secondary">
                      カテゴリ
                    </Typography>
                  </Box>
                )}
              </Stack>
            )}

            {displayTags.length > 0 && (
              <Stack
                direction="row"
                spacing={1}
                useFlexGap
                flexWrap="wrap"
                sx={{ mb: 3 }}
              >
                {displayTags.map((tag) => (
                  <Chip
                    key={tag}
                    label={tag}
                    size="small"
                    sx={{
                      bgcolor: "#FFF3E0",
                      color: "#75511B",
                      border: "1px solid #F4D6A0",
                      fontWeight: 700,
                    }}
                  />
                ))}
              </Stack>
            )}

            {/* メモ */}
            <Divider sx={{ my: 2.5 }} />

            <Box>
              <Stack
                direction="row"
                alignItems="center"
                justifyContent="space-between"
                sx={{ mb: 1 }}
              >
                <Stack direction="row" alignItems="center" spacing={0.75}>
                  <Image
                    src="/icons/rakusuru/action/lg_other_memo.png"
                    alt=""
                    width={24}
                    height={24}
                  />

                  <Typography
                    sx={{
                      fontSize: 16,
                      fontWeight: 800,
                      color: "#333333",
                    }}
                  >
                    メモ
                  </Typography>
                </Stack>

                {isMine && (
                  <Button
                    size="small"
                    onClick={() => router.push(`/recipes/edit/${recipe.id}`)}
                    startIcon={
                      <Image
                        src="/icons/rakusuru/action/lg_action_edit.png"
                        alt=""
                        width={20}
                        height={20}
                      />
                    }
                    sx={{
                      minWidth: 0,
                      color: "#2E7D32",
                      fontWeight: 700,
                      px: 1,
                      "& .MuiButton-startIcon": {
                        mr: 0.5,
                      },
                    }}
                  >
                    編集
                  </Button>
                )}
              </Stack>

              <Box
                sx={{
                  p: 1.5,
                  border: "1px solid #E7E1D8",
                  borderRadius: 2,
                  bgcolor: "#FFFFFF",
                }}
              >
                <Typography
                  variant="body2"
                  sx={{
                    lineHeight: 1.7,
                    whiteSpace: "pre-wrap",
                    color: recipe.memo ? "#444444" : "#999999",
                  }}
                >
                  {recipe.memo || "メモはまだありません"}
                </Typography>
              </Box>
            </Box>

            {/* 食材 */}
            <Divider sx={{ my: 3 }} />

            <Box>
              <Typography
                variant="h6"
                sx={{
                  mb: 1.5,
                  fontSize: 18,
                  fontWeight: 800,
                  color: "#333333",
                }}
              >
                食材
              </Typography>

              {ingredients.length > 0 || seasonings.length > 0 ? (
                <Box
                  sx={{
                    border: "1px solid #F0ECE6",
                    borderRadius: 3,
                    px: 2,
                    bgcolor: "#FFFDFA",
                  }}
                >
                  {ingredients.length > 0 && (
                    <Box>
                      <Typography
                        variant="caption"
                        sx={{
                          display: "block",
                          pt: 1.5,
                          pb: 0.5,
                          color: "#888888",
                          fontWeight: 700,
                        }}
                      >
                        具材
                      </Typography>

                      {ingredients.map((ingredient, index) => (
                        <IngredientRow
                          key={`ing-${index}`}
                          name={ingredient.name}
                          quantity={ingredient.quantity}
                        />
                      ))}
                    </Box>
                  )}

                  {seasonings.length > 0 && (
                    <Box sx={{ pb: 1 }}>
                      <Typography
                        variant="caption"
                        sx={{
                          display: "block",
                          pt: 1.5,
                          pb: 0.5,
                          color: "#888888",
                          fontWeight: 700,
                        }}
                      >
                        調味料
                      </Typography>

                      {seasonings.map((seasoning, index) => (
                        <IngredientRow
                          key={`sea-${index}`}
                          name={seasoning.name}
                          quantity={seasoning.quantity}
                        />
                      ))}
                    </Box>
                  )}
                </Box>
              ) : (
                <Box
                  sx={{
                    p: 2,
                    borderRadius: 3,
                    bgcolor: "#F8F8F8",
                  }}
                >
                  <Typography variant="body2" color="text.secondary">
                    食材はまだ登録されていません
                  </Typography>
                </Box>
              )}
            </Box>

            {/* 元コンテンツ */}
            {externalSource && sourceUrl && (
              <Box sx={{ mt: 3 }}>
                <Button
                  fullWidth
                  component="a"
                  href={sourceUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  variant="contained"
                  endIcon={<OpenInNew />}
                  sx={{
                    minHeight: 58,
                    borderRadius: 999,
                    bgcolor: "#2E8B3C",
                    color: "#FFFFFF",
                    fontSize: 16,
                    fontWeight: 800,
                    boxShadow: "none",
                    "&:hover": {
                      bgcolor: "#247531",
                      boxShadow: "none",
                    },
                  }}
                >
                  元コンテンツを見る
                </Button>

                <Typography
                  variant="caption"
                  color="text.secondary"
                  sx={{
                    display: "block",
                    mt: 0.75,
                    textAlign: "center",
                  }}
                >
                  {externalSource.name}の投稿を開きます
                </Typography>
              </Box>
            )}

            {/* 作成日 */}
            {recipe.createdAt && (
              <Typography
                variant="caption"
                color="text.secondary"
                sx={{
                  display: "block",
                  mt: 3,
                }}
              >
                作成日：
                {recipe.createdAt.toDate
                  ? recipe.createdAt.toDate().toLocaleDateString("ja-JP")
                  : String(recipe.createdAt)}
              </Typography>
            )}
          </CardContent>

          {/* 編集・削除 */}
          {isMine && (
            <Box
              sx={{
                px: { xs: 2.5, sm: 4 },
                pb: { xs: 2.5, sm: 4 },
              }}
            >
              <Divider sx={{ mb: 2.5 }} />

              <Stack direction={{ xs: "column", sm: "row" }} spacing={1.5}>
                <Button
                  fullWidth
                  variant="contained"
                  onClick={() => router.push(`/recipes/edit/${recipe.id}`)}
                  sx={{
                    minHeight: 46,
                    borderRadius: 999,
                    bgcolor: "#FFB830",
                    color: "#333333",
                    fontWeight: 800,
                    boxShadow: "none",
                    "&:hover": {
                      bgcolor: "#F5A900",
                      boxShadow: "none",
                    },
                  }}
                >
                  レシピを編集する
                </Button>

                <Button
                  variant="outlined"
                  color="error"
                  onClick={handleDelete}
                  sx={{
                    minHeight: 46,
                    px: 3,
                    borderRadius: 999,
                    fontWeight: 700,
                    whiteSpace: "nowrap",
                  }}
                >
                  削除
                </Button>
              </Stack>
            </Box>
          )}
        </Card>
      </Box>
    </AppLayout>
  );
}
