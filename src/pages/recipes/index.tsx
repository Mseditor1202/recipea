// pages/recipes/index.jsx
import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  collection,
  getDocs,
  doc,
  updateDoc,
  serverTimestamp,
} from "firebase/firestore";
import { db, auth } from "@/lib/firebase";
import { useRouter } from "next/router";
import RecipeImage from "@/components/recipes/RecipeImage";

import {
  Box,
  Grid,
  Card,
  CardContent,
  CardActions,
  Typography,
  Button,
  Chip,
  TextField,
  Stack,
  Divider,
  Snackbar,
  Alert,
} from "@mui/material";
import { Save as SaveIcon } from "@mui/icons-material";

/* ===============================
   正規化
================================ */
const normalize = (v) => (v || "").toLowerCase();

/* ===============================
   ページ本体
================================ */
export default function RecipesPage() {
  const router = useRouter();
  const currentUserId = auth.currentUser?.uid;

  const [recipes, setRecipes] = useState([]);
  const [loading, setLoading] = useState(true);

  const [searchText, setSearchText] = useState("");
  const [activeTags, setActiveTags] = useState([]);

  // ✅ memo編集用（dailysetと同じ思想）
  const [memoDrafts, setMemoDrafts] = useState({}); // { [recipeId]: string }
  const [savingById, setSavingById] = useState({}); // { [recipeId]: boolean }

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
    if (reason === "clickaway") return;
    setToast((prev) => ({ ...prev, open: false }));
  }, []);

  /* ---------- 取得 ---------- */
  useEffect(() => {
    const run = async () => {
      try {
        const snap = await getDocs(collection(db, "recipes"));
        const list = snap.docs.map((d) => ({ id: d.id, ...d.data() }));

        setRecipes(list);

        // ✅ 初回：memoDraftを同期（既に編集してたら上書きしない）
        setMemoDrafts((prev) => {
          const next = { ...prev };
          list.forEach((r) => {
            if (next[r.id] === undefined) next[r.id] = r.memo || "";
          });
          return next;
        });
      } finally {
        setLoading(false);
      }
    };
    run();
  }, []);

  /* ---------- 全タグ一覧 ---------- */
  const allTags = useMemo(() => {
    const set = new Set();
    recipes.forEach(
      (r) =>
        Array.isArray(r.searchTags) && r.searchTags.forEach((t) => set.add(t))
    );
    return [...set];
  }, [recipes]);

  /* ---------- フィルタ ---------- */
  const filtered = useMemo(() => {
    let list = recipes;

    const q = normalize(searchText);

    if (q) {
      list = list.filter((r) => {
        const nameHit = normalize(r.recipeName).includes(q);
        const tagHit =
          Array.isArray(r.searchTags) &&
          r.searchTags.some((t) => normalize(t).includes(q));
        return nameHit || tagHit;
      });
    }

    if (activeTags.length > 0) {
      list = list.filter(
        (r) =>
          Array.isArray(r.searchTags) &&
          activeTags.every((t) => r.searchTags.includes(t))
      );
    }

    return list;
  }, [recipes, searchText, activeTags]);

  /* ---------- タグ操作 ---------- */
  const toggleTag = (tag) => {
    setActiveTags((prev) =>
      prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag]
    );
  };

  // ✅ memoの下書き更新
  const handleMemoChange = useCallback((recipeId, value) => {
    setMemoDrafts((prev) => ({ ...prev, [recipeId]: value }));
  }, []);

  // ✅ isDirty判定（元memoと比較）
  const isDirty = useCallback(
    (recipeDoc) => {
      const original = recipeDoc.memo || "";
      const draft = memoDrafts[recipeDoc.id] ?? original;
      return draft !== original;
    },
    [memoDrafts]
  );

  // ✅ 保存処理（recipes）
  const handleSaveMemo = useCallback(
    async (recipeDoc) => {
      const recipeId = recipeDoc.id;
      const original = recipeDoc.memo || "";
      const draft = memoDrafts[recipeId] ?? original;

      if (draft === original) return;

      setSavingById((prev) => ({ ...prev, [recipeId]: true }));

      try {
        const ref = doc(db, "recipes", recipeId);
        await updateDoc(ref, {
          memo: draft,
          updatedAt: serverTimestamp(),
        });

        // ✅ 画面上の recipes も更新（即反映）
        setRecipes((prev) =>
          prev.map((r) => (r.id === recipeId ? { ...r, memo: draft } : r))
        );

        openToast("success", "保存しました");
      } catch (e) {
        console.error(e);
        openToast(
          "error",
          "保存に失敗しました。通信状況を確認して再度お試しください。"
        );
      } finally {
        setSavingById((prev) => ({ ...prev, [recipeId]: false }));
      }
    },
    [memoDrafts, openToast]
  );

  /* ---------- 画面 ---------- */
  return (
    <Box sx={{ maxWidth: 1200, mx: "auto", mt: 4, px: 2 }}>
      <Typography variant="h5" fontWeight={800} mb={2}>
        レシピ一覧
      </Typography>

      {/* 🔍 検索 */}
      <TextField
        fullWidth
        label="レシピ名 or タグで検索"
        value={searchText}
        onChange={(e) => setSearchText(e.target.value)}
        sx={{ mb: 2 }}
      />

      {/* 🏷 タグ一覧 */}
      <Stack direction="row" spacing={1} flexWrap="wrap" mb={2}>
        {allTags.map((tag) => {
          const active = activeTags.includes(tag);
          return (
            <Chip
              key={tag}
              label={`#${tag}`}
              clickable
              onClick={() => toggleTag(tag)}
              color={active ? "primary" : "default"}
              variant={active ? "filled" : "outlined"}
              sx={{
                fontWeight: active ? 700 : 400,
                cursor: "pointer",
              }}
            />
          );
        })}
      </Stack>

      {activeTags.length > 0 && (
        <Stack direction="row" spacing={1} mb={2}>
          <Typography variant="body2">選択中：</Typography>
          {activeTags.map((t) => (
            <Chip
              key={t}
              label={`#${t}`}
              color="primary"
              onDelete={() => toggleTag(t)}
            />
          ))}
        </Stack>
      )}

      <Divider sx={{ mb: 3 }} />

      {/* 🧱 一覧 */}
      <Grid container spacing={3}>
        {filtered.map((recipe) => {
          const canEdit = recipe.authorId === currentUserId;

          // ✅ ここがdirty未定義エラーの解決ポイント
          const dirty = isDirty(recipe);
          const saving = !!savingById[recipe.id];
          const draft = memoDrafts[recipe.id] ?? (recipe.memo || "");

          return (
            <Grid item xs={12} sm={6} md={4} key={recipe.id}>
              <Card
                sx={{
                  height: "100%",
                  display: "flex",
                  flexDirection: "column",
                }}
              >
                <RecipeImage
                  imageUrl={recipe.imageUrl}
                  title={recipe.recipeName}
                  height={180}
                />

                <CardContent sx={{ flexGrow: 1 }}>
                  <Typography fontWeight={800}>{recipe.recipeName}</Typography>

                  <Stack direction="row" spacing={0.5} mt={1} flexWrap="wrap">
                    {recipe.searchTags?.map((t) => (
                      <Chip key={t} size="small" label={`#${t}`} />
                    ))}
                  </Stack>
                </CardContent>

                <CardActions sx={{ px: 2, pb: 2 }}>
                  <Button
                    fullWidth
                    variant="outlined"
                    sx={{ borderRadius: 999 }}
                    onClick={() => router.push(`/recipes/${recipe.id}`)}
                  >
                    詳細
                  </Button>

                  {canEdit && (
                    <Button
                      fullWidth
                      variant="contained"
                      sx={{ borderRadius: 999 }}
                      onClick={() => router.push(`/recipes/edit/${recipe.id}`)}
                    >
                      編集
                    </Button>
                  )}
                </CardActions>

                {/* ✅ Memoを「詳細/編集ボタンより下」に配置 */}
                <Box
                  sx={{
                    px: 2,
                    pb: 2,
                    pt: 1.25,
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
                    <Typography variant="caption" color="text.secondary">
                      メモ
                    </Typography>

                    <Button
                      size="small"
                      variant={dirty ? "contained" : "outlined"}
                      startIcon={<SaveIcon />}
                      disabled={!canEdit || !dirty || saving}
                      onClick={() => handleSaveMemo(recipe)}
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
                      handleMemoChange(recipe.id, e.target.value)
                    }
                    placeholder={
                      canEdit
                        ? "例）辛めが好き / 次は倍量で作る"
                        : "（編集は作成者のみ）"
                    }
                    size="small"
                    fullWidth
                    multiline
                    minRows={2}
                    maxRows={6}
                    disabled={!canEdit}
                    sx={{
                      "& .MuiOutlinedInput-root": {
                        borderRadius: 2,
                        bgcolor: "background.paper",
                      },
                    }}
                  />

                  {canEdit && dirty && (
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

      {!loading && filtered.length === 0 && (
        <Typography color="text.secondary" mt={3}>
          該当するレシピがありません
        </Typography>
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
