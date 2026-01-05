// pages/recipes/dailyset/index.jsx
import React, { useEffect, useMemo, useState, useCallback } from "react";
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
  TextField,
  Snackbar,
  Alert,
} from "@mui/material";
import { Add as AddIcon, Save as SaveIcon } from "@mui/icons-material";
import {
  collection,
  getDocs,
  query,
  orderBy,
  where,
  doc,
  updateDoc,
  serverTimestamp,
} from "firebase/firestore";
import { db } from "@/lib/firebase";

const COLLECTION_DAILY = "dailySets";
const COLLECTION_RECIPES = "recipes";

const SLOT_LABELS = {
  staple: "主食",
  mainDish: "主菜",
  sideDish: "副菜",
  soup: "汁物",
};

const DEFAULT_IMAGE = "/images/default-recipe.png";

export default function DailySetsListPage() {
  const router = useRouter();
  const [dailySets, setDailySets] = useState([]);
  const [recipesById, setRecipesById] = useState({});

  const [loading, setLoading] = useState(true);
  const [loadingRecipes, setLoadingRecipes] = useState(true);
  const [error, setError] = useState("");

  // ✅ memo編集用
  const [memoDrafts, setMemoDrafts] = useState({}); // { [dailySetId]: string }
  const [savingById, setSavingById] = useState({}); // { [dailySetId]: boolean }

  // ✅ Snackbar（Toast）
  const [toast, setToast] = useState({
    open: false,
    severity: "success", // "success" | "error" | "info" | "warning"
    message: "",
  });

  const openToast = useCallback((severity, message) => {
    setToast({ open: true, severity, message });
  }, []);

  const closeToast = useCallback((_, reason) => {
    // クリックアウェイで閉じない（誤爆防止）
    if (reason === "clickaway") return;
    setToast((prev) => ({ ...prev, open: false }));
  }, []);

  useEffect(() => {
    const fetchDailySetsAndRecipes = async () => {
      setLoading(true);
      setError("");

      try {
        // 1) dailySets 取得
        const dailySetsRef = collection(db, COLLECTION_DAILY);
        const qDaily = query(dailySetsRef, orderBy("createdAt", "desc"));
        const dailySnap = await getDocs(qDaily);

        const dailyList = dailySnap.docs.map((d) => ({
          id: d.id,
          ...d.data(),
        }));

        setDailySets(dailyList);

        // ✅ 初回：memoDraftを同期（既に編集してたら上書きしない）
        setMemoDrafts((prev) => {
          const next = { ...prev };
          dailyList.forEach((setDoc) => {
            if (next[setDoc.id] === undefined) {
              next[setDoc.id] = setDoc.memo || "";
            }
          });
          return next;
        });

        setLoading(false);

        // 2) dailySets から必要 recipeId を収集
        const idSet = new Set();
        dailyList.forEach((setDoc) => {
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

        // Firestore in 句は最大10件 → 分割
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
          snap.forEach((d) => {
            recipesMap[d.id] = { id: d.id, ...d.data() };
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
    router.push("/recipes/dailyset/create");
  };

  // ✅ スロット単位で recipes 一覧へ（セットモード）
  const handleChangeSlotRecipe = (dailySetId, slotKey) => {
    router.push(
      `/recipes?mode=dailySet&slot=${slotKey}&dailySetId=${dailySetId}&from=dailyset`
    );
  };

  const renderRecipeSlot = (slotKey, recipeId, dailySetId) => {
    const label = SLOT_LABELS[slotKey];
    const recipe = recipeId ? recipesById[recipeId] : null;

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

    const hasRecipe = !!recipeId && !!recipe;
    const thumbnail = hasRecipe
      ? recipe.imageUrl || DEFAULT_IMAGE
      : DEFAULT_IMAGE;
    const title = hasRecipe ? recipe.recipeName || "名称未設定" : "未設定";
    const buttonLabel = hasRecipe ? "レシピを変更する" : "レシピをセット";

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

        <Typography
          variant="body2"
          sx={{
            fontWeight: 700,
            display: "-webkit-box",
            WebkitLineClamp: 2,
            WebkitBoxOrient: "vertical",
            overflow: "hidden",
            minHeight: 40,
          }}
          title={title}
        >
          {title}
        </Typography>

        <Button
          size="small"
          fullWidth
          variant="outlined"
          sx={{
            mt: 0.75,
            textTransform: "none",
            fontSize: 11,
            borderRadius: 999,
          }}
          onClick={() => handleChangeSlotRecipe(dailySetId, slotKey)}
        >
          {buttonLabel}
        </Button>
      </Box>
    );
  };

  // ✅ memoの下書き更新
  const handleMemoChange = useCallback((dailySetId, value) => {
    setMemoDrafts((prev) => ({ ...prev, [dailySetId]: value }));
  }, []);

  // ✅ isDirty判定（元memoと比較）
  const isDirty = useCallback(
    (setDoc) => {
      const original = setDoc.memo || "";
      const draft = memoDrafts[setDoc.id] ?? original;
      return draft !== original;
    },
    [memoDrafts]
  );

  // ✅ 保存処理
  const handleSaveMemo = useCallback(
    async (setDoc) => {
      const dailySetId = setDoc.id;
      const original = setDoc.memo || "";
      const draft = memoDrafts[dailySetId] ?? original;

      if (draft === original) return;

      setSavingById((prev) => ({ ...prev, [dailySetId]: true }));

      try {
        const ref = doc(db, COLLECTION_DAILY, dailySetId);
        await updateDoc(ref, {
          memo: draft,
          updatedAt: serverTimestamp(),
        });

        // ✅ 画面上のdailySetsも更新（即反映）
        setDailySets((prev) =>
          prev.map((d) => (d.id === dailySetId ? { ...d, memo: draft } : d))
        );

        openToast("success", "保存しました");
      } catch (e) {
        console.error(e);
        openToast(
          "error",
          "保存に失敗しました。通信状況を確認して再度お試しください。"
        );
      } finally {
        setSavingById((prev) => ({ ...prev, [dailySetId]: false }));
      }
    },
    [memoDrafts, openToast]
  );

  return (
    <Box sx={{ p: { xs: 2, md: 4 }, maxWidth: 1200, mx: "auto" }}>
      {/* Header */}
      <Stack
        direction={{ xs: "column", sm: "row" }}
        spacing={2}
        alignItems={{ xs: "flex-start", sm: "center" }}
        justifyContent="space-between"
        sx={{ mb: 3 }}
      >
        <Box>
          <Typography variant="h4" component="h1" sx={{ fontWeight: 800 }}>
            献立レシピセット一覧
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

      {/* Loading */}
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
                    {Array.from({ length: 4 }).map((__, j) => (
                      <Grid item xs={3} key={j}>
                        <Skeleton variant="rectangular" height={70} />
                        <Skeleton width="60%" />
                      </Grid>
                    ))}
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

      {/* Empty */}
      {isEmpty && (
        <Box sx={{ mt: 4, textAlign: "center", color: "text.secondary" }}>
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

      {/* List */}
      {!loading && dailySets.length > 0 && (
        <Grid container spacing={2}>
          {dailySets.map((setDoc) => {
            const draft = memoDrafts[setDoc.id] ?? (setDoc.memo || "");
            const dirty = isDirty(setDoc);
            const saving = !!savingById[setDoc.id];

            return (
              <Grid
                item
                xs={12}
                sm={6}
                md={4}
                key={setDoc.id}
                sx={{ display: "flex" }}
              >
                <Card
                  sx={{
                    height: "100%",
                    width: "100%",
                    display: "flex",
                    flexDirection: "column",
                  }}
                >
                  <CardContent sx={{ flexGrow: 1 }}>
                    <Stack
                      direction="row"
                      alignItems="center"
                      justifyContent="space-between"
                      sx={{ mb: 1 }}
                    >
                      <Typography
                        variant="h6"
                        component="h2"
                        sx={{ fontWeight: 800 }}
                        noWrap
                        title={setDoc.name}
                      >
                        {setDoc.name || "名称未設定セット"}
                      </Typography>

                      {setDoc.createdAt && setDoc.createdAt.toDate && (
                        <Typography variant="caption" color="text.secondary">
                          {new Date(
                            setDoc.createdAt.toDate()
                          ).toLocaleDateString("ja-JP", {
                            month: "short",
                            day: "numeric",
                          })}
                        </Typography>
                      )}
                    </Stack>

                    <Divider sx={{ my: 1.5 }} />

                    <Grid container spacing={1}>
                      <Grid item xs={3}>
                        {renderRecipeSlot("staple", setDoc.staple, setDoc.id)}
                      </Grid>
                      <Grid item xs={3}>
                        {renderRecipeSlot(
                          "mainDish",
                          setDoc.mainDish,
                          setDoc.id
                        )}
                      </Grid>
                      <Grid item xs={3}>
                        {renderRecipeSlot(
                          "sideDish",
                          setDoc.sideDish,
                          setDoc.id
                        )}
                      </Grid>
                      <Grid item xs={3}>
                        {renderRecipeSlot("soup", setDoc.soup, setDoc.id)}
                      </Grid>
                    </Grid>
                  </CardContent>

                  {/* ✅ Memo 編集 & 保存 */}
                  <Box
                    sx={{
                      p: 1.5,
                      borderTop: "1px solid",
                      borderColor: "divider",
                    }}
                  >
                    <Stack
                      direction="row"
                      alignItems="center"
                      justifyContent="space-between"
                      sx={{ mb: 0.5 }}
                    >
                      <Typography
                        variant="caption"
                        color="text.secondary"
                        sx={{ display: "block" }}
                      >
                        メモ
                      </Typography>

                      <Button
                        size="small"
                        variant={dirty ? "contained" : "outlined"}
                        startIcon={<SaveIcon />}
                        disabled={!dirty || saving}
                        onClick={() => handleSaveMemo(setDoc)}
                        sx={{
                          textTransform: "none",
                          borderRadius: 999,
                          minWidth: 110,
                        }}
                      >
                        {saving ? "保存中…" : "保存"}
                      </Button>
                    </Stack>

                    <TextField
                      value={draft}
                      onChange={(e) =>
                        handleMemoChange(setDoc.id, e.target.value)
                      }
                      placeholder="例）家族は汁物なしでもOK / 明日は多めに作る など"
                      size="small"
                      fullWidth
                      multiline
                      minRows={2}
                      maxRows={6}
                      sx={{
                        "& .MuiOutlinedInput-root": {
                          borderRadius: 2,
                          bgcolor: "background.paper",
                        },
                      }}
                    />

                    {dirty && (
                      <Typography
                        variant="caption"
                        color="warning.main"
                        sx={{ display: "block", mt: 0.75 }}
                      >
                        未保存の変更があります
                      </Typography>
                    )}
                  </Box>
                </Card>
              </Grid>
            );
          })}
        </Grid>
      )}

      {/* ✅ Snackbar Toast（画面右下） */}
      <Snackbar
        open={toast.open}
        autoHideDuration={2500}
        onClose={closeToast}
        anchorOrigin={{ vertical: "bottom", horizontal: "right" }}
      >
        <Alert
          onClose={closeToast}
          severity={toast.severity}
          variant="filled"
          sx={{ borderRadius: 2 }}
        >
          {toast.message}
        </Alert>
      </Snackbar>
    </Box>
  );
}
