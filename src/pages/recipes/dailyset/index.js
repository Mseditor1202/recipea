import React, { useEffect, useState, useMemo } from "react";
import { useRouter } from "next/router";
import {
  Box,
  Grid,
  Card,
  CardContent,
  CardMedia,
  Typography,
  Button,
  Stack,
  Divider,
  Skeleton,
} from "@mui/material";
import { Add as AddIcon } from "@mui/icons-material";
import { collection, getDocs, query, orderBy, where } from "firebase/firestore";
import { db } from "@/lib/firebase";

const COLLECTION_DAILY = "dailySets";
const COLLECTION_RECIPES = "recipes";

// ★ スロットキー＆ラベルを変更
const SLOT_LABELS = {
  staple: "主食",
  mainDish: "主菜",
  sideDish: "副菜",
  soup: "汁物",
};

const DEFAULT_IMAGE = "/images/default-recipe.png";

const DailySetsListPage = () => {
  const router = useRouter();
  const [dailySets, setDailySets] = useState([]);
  const [recipesById, setRecipesById] = useState({});
  const [loading, setLoading] = useState(true);
  const [loadingRecipes, setLoadingRecipes] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    const fetchDailySetsAndRecipes = async () => {
      setLoading(true);
      setError("");

      try {
        // 1. dailySets を取得（新しい順）
        const dailySetsRef = collection(db, COLLECTION_DAILY);
        const qDaily = query(dailySetsRef, orderBy("createdAt", "desc"));
        const dailySnap = await getDocs(qDaily);

        const dailyList = dailySnap.docs.map((doc) => ({
          id: doc.id,
          ...doc.data(),
        }));

        setDailySets(dailyList);
        setLoading(false);

        // 2. dailySets から必要な recipeId を全部集める
        const idSet = new Set();
        dailyList.forEach((setDoc) => {
          // ★ 主食・主菜・副菜・汁物に対応
          ["staple", "mainDish", "sideDish", "soup"].forEach((slot) => {
            const recipeId = setDoc[slot];
            if (recipeId) idSet.add(recipeId);
          });
        });

        if (idSet.size === 0) {
          setRecipesById({});
          setLoadingRecipes(false);
          return;
        }

        setLoadingRecipes(true);

        const allIds = Array.from(idSet);
        const recipesMap = {};

        // Firestore の in 句は最大10件なので分割
        const chunkSize = 10;
        const chunks = [];
        for (let i = 0; i < allIds.length; i += chunkSize) {
          chunks.push(allIds.slice(i, i + chunkSize));
        }

        const recipesRef = collection(db, COLLECTION_RECIPES);
        const promises = chunks.map((idChunk) => {
          const qRecipes = query(recipesRef, where("__name__", "in", idChunk));
          return getDocs(qRecipes);
        });

        const snapArray = await Promise.all(promises);
        snapArray.forEach((snap) => {
          snap.forEach((doc) => {
            recipesMap[doc.id] = {
              id: doc.id,
              ...doc.data(),
            };
          });
        });

        setRecipesById(recipesMap);
        setLoadingRecipes(false);
      } catch (err) {
        console.error(err);
        setError(err?.message || "データの取得に失敗しました。");
        setLoading(false);
        setLoadingRecipes(false);
      }
    };

    fetchDailySetsAndRecipes();
  }, []);

  const isEmpty = useMemo(
    () => !loading && dailySets.length === 0,
    [loading, dailySets]
  );

  const handleCreateNew = () => {
    // 新規作成ページ
    router.push("/recipes/dailyset/create");
  };

  // ★ 追加：スロット単位でレシピを変更しに行く遷移
  const handleChangeSlotRecipe = (dailySetId, slotKey) => {
    router.push(
      `/recipes?mode=dailySet&slot=${slotKey}&dailySetId=${dailySetId}`
    );
  };

  // ★ 第3引数に dailySetId を追加
  const renderRecipeSlot = (slotKey, recipeId, dailySetId) => {
    const label = SLOT_LABELS[slotKey];
    const recipe = recipeId ? recipesById[recipeId] : null;

    // まだレシピ一覧のロード中なら Skeleton
    if (loadingRecipes) {
      return (
        <Box>
          <Typography variant="caption" color="text.secondary">
            {label}
          </Typography>
          <Skeleton
            variant="rectangular"
            height={80}
            sx={{ mt: 0.5, mb: 0.5 }}
          />
          <Skeleton width="60%" />
        </Box>
      );
    }

    // デバッグ用：IDはあるのにレシピがないときはコンソールに出しておく
    if (recipeId && !recipe) {
      console.warn("recipes に存在しないIDです:", recipeId);
    }

    const hasRecipe = !!recipeId && !!recipe;

    const thumbnail = hasRecipe
      ? recipe.imageUrl || DEFAULT_IMAGE
      : DEFAULT_IMAGE;

    const title = hasRecipe ? recipe.recipeName || "名称未設定" : "未設定";

    const buttonLabel = hasRecipe ? "このレシピを変更" : "レシピをセット";

    return (
      <Box>
        <Typography variant="caption" color="text.secondary">
          {label}
        </Typography>

        <CardMedia
          component="img"
          image={thumbnail}
          alt={title}
          sx={{
            mt: 0.5,
            mb: 0.5,
            height: 80,
            borderRadius: 1,
            objectFit: "cover",
          }}
        />

        <Typography variant="body2" noWrap title={title}>
          {title}
        </Typography>

        {/* ★ ここで直接レシピ一覧に飛ぶボタンを追加 */}
        <Button
          size="small"
          variant="outlined"
          sx={{ mt: 0.5, textTransform: "none", fontSize: 11 }}
          onClick={() => handleChangeSlotRecipe(dailySetId, slotKey)}
        >
          {buttonLabel}
        </Button>
      </Box>
    );
  };

  return (
    <Box sx={{ p: { xs: 2, md: 4 }, maxWidth: 1200, mx: "auto" }}>
      {/* ヘッダー */}
      <Stack
        direction={{ xs: "column", sm: "row" }}
        spacing={2}
        alignItems={{ xs: "flex-start", sm: "center" }}
        justifyContent="space-between"
        sx={{ mb: 3 }}
      >
        <Box>
          <Typography variant="h4" component="h1" sx={{ fontWeight: 600 }}>
            レシピセット一覧
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
            主食・主菜・副菜・汁物の組み合わせを「1食セット」として管理します。
          </Typography>
        </Box>

        <Button
          variant="contained"
          startIcon={<AddIcon />}
          onClick={handleCreateNew}
        >
          新しい献立レシピセットを作成
        </Button>
      </Stack>

      {error && (
        <Box
          sx={{
            mb: 2,
            p: 2,
            borderRadius: 2,
            bgcolor: "error.light",
            color: "error.contrastText",
          }}
        >
          <Typography variant="body2">{error}</Typography>
        </Box>
      )}

      {/* ローディング状態 */}
      {loading && (
        <Grid container spacing={2}>
          {Array.from({ length: 4 }).map((_, i) => (
            <Grid item xs={12} sm={6} md={4} key={i}>
              <Card>
                <CardContent>
                  <Skeleton width="70%" />
                  <Skeleton width="40%" sx={{ mt: 1 }} />
                  <Divider sx={{ my: 1.5 }} />
                  <Grid container spacing={1}>
                    {/* 主食・主菜・副菜・汁物の4枠 */}
                    <Grid item xs={3}>
                      <Skeleton variant="rectangular" height={70} />
                      <Skeleton width="60%" />
                    </Grid>
                    <Grid item xs={3}>
                      <Skeleton variant="rectangular" height={70} />
                      <Skeleton width="60%" />
                    </Grid>
                    <Grid item xs={3}>
                      <Skeleton variant="rectangular" height={70} />
                      <Skeleton width="60%" />
                    </Grid>
                    <Grid item xs={3}>
                      <Skeleton variant="rectangular" height={70} />
                      <Skeleton width="60%" />
                    </Grid>
                  </Grid>
                  <Skeleton
                    width="50%"
                    sx={{ mt: 2, borderRadius: 9999 }}
                    height={32}
                  />
                </CardContent>
              </Card>
            </Grid>
          ))}
        </Grid>
      )}

      {/* データなし */}
      {isEmpty && (
        <Box
          sx={{
            mt: 4,
            textAlign: "center",
            color: "text.secondary",
          }}
        >
          <Typography variant="body1" sx={{ mb: 1 }}>
            まだ献立レシピセットがありません。
          </Typography>
          <Button
            variant="contained"
            startIcon={<AddIcon />}
            onClick={handleCreateNew}
          >
            最初の献立レシピセットを作成する
          </Button>
        </Box>
      )}

      {/* 一覧 */}
      {!loading && dailySets.length > 0 && (
        <Grid container spacing={2}>
          {dailySets.map((setDoc) => (
            <Grid item xs={12} sm={6} md={4} key={setDoc.id}>
              <Card
                sx={{
                  height: "100%",
                  display: "flex",
                  flexDirection: "column",
                }}
              >
                <CardContent
                  sx={{ flexGrow: 1, display: "flex", flexDirection: "column" }}
                >
                  <Stack
                    direction="row"
                    alignItems="center"
                    justifyContent="space-between"
                    sx={{ mb: 1 }}
                  >
                    <Typography
                      variant="h6"
                      component="h2"
                      noWrap
                      title={setDoc.name}
                      sx={{ fontWeight: 600 }}
                    >
                      {setDoc.name || "名称未設定セット"}
                    </Typography>

                    {setDoc.createdAt && setDoc.createdAt.toDate && (
                      <Typography variant="caption" color="text.secondary">
                        {new Date(setDoc.createdAt.toDate()).toLocaleDateString(
                          "ja-JP",
                          {
                            month: "short",
                            day: "numeric",
                          }
                        )}
                      </Typography>
                    )}
                  </Stack>

                  <Divider sx={{ my: 1.5 }} />

                  {/* 主食・主菜・副菜・汁物の4カラム表示 */}
                  <Grid container spacing={1}>
                    <Grid item xs={3}>
                      {renderRecipeSlot("staple", setDoc.staple, setDoc.id)}
                    </Grid>
                    <Grid item xs={3}>
                      {renderRecipeSlot("mainDish", setDoc.mainDish, setDoc.id)}
                    </Grid>
                    <Grid item xs={3}>
                      {renderRecipeSlot("sideDish", setDoc.sideDish, setDoc.id)}
                    </Grid>
                    <Grid item xs={3}>
                      {renderRecipeSlot("soup", setDoc.soup, setDoc.id)}
                    </Grid>
                  </Grid>
                </CardContent>

                {/* メモ + 編集ボタン */}
                <Box
                  sx={{
                    p: 1.5,
                    display: "flex",
                    alignItems: "flex-start",
                    gap: 2,
                    borderTop: "1px solid",
                    borderColor: "divider",
                  }}
                >
                  {/* メモ欄 */}
                  <Box sx={{ flexGrow: 1 }}>
                    <Typography
                      variant="caption"
                      color="text.secondary"
                      sx={{ display: "block", mb: 0.25 }}
                    >
                      メモ
                    </Typography>

                    {setDoc.memo ? (
                      <Typography
                        variant="body2"
                        sx={{
                          whiteSpace: "pre-line",
                        }}
                      >
                        {setDoc.memo}
                      </Typography>
                    ) : (
                      <Typography variant="body2" color="text.disabled">
                        メモは未入力です
                      </Typography>
                    )}
                  </Box>
                </Box>
              </Card>
            </Grid>
          ))}
        </Grid>
      )}
    </Box>
  );
};

export default DailySetsListPage;
