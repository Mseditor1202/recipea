// src/pages/recipes/edit/[id].js
import AppLayout from "@/components/layout/AppLayout";
import React, { useEffect, useMemo, useState } from "react";
import { doc, getDoc, updateDoc, serverTimestamp } from "firebase/firestore";
import { useRouter } from "next/router";
import { useRequireAuth } from "@/hooks/useRequireAuth";
import {
  Box,
  Button,
  TextField,
  Typography,
  IconButton,
  Stack,
  Paper,
  FormControl,
  FormLabel,
  RadioGroup,
  Radio,
  FormControlLabel,
  Chip,
  Divider,
  Alert,
  Drawer,
  Collapse,
} from "@mui/material";
import {
  AddCircleOutline,
  RemoveCircleOutline,
  CloudUpload,
  Add as AddIcon,
} from "@mui/icons-material";
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
import { db, storage } from "@/lib/firebase";
import { parseRecipeSource } from "@/features/recipes/utils/recipeSource";

const MAX_TAGS = 4;

// 余計なスペースや # を吸収して正規化
const normalizeTag = (t) =>
  (t || "").trim().replace(/^#+/, "").replace(/\s+/g, " ").slice(0, 24);

export default function EditRecipe() {
  const router = useRouter();
  const { id } = router.query;
  const { user } = useRequireAuth();

  const [recipeName, setRecipeName] = useState("");

  // 具材・調味料
  const [ingredients, setIngredients] = useState([{ name: "", quantity: "" }]);
  const [seasonings, setSeasonings] = useState([{ name: "", quantity: "" }]);

  // 画像
  const [imageFile, setImageFile] = useState(null);
  const [previewUrl, setPreviewUrl] = useState("");
  const [currentImageUrl, setCurrentImageUrl] = useState("");

  // レシピ情報
  const [calories, setCalories] = useState("");
  const [cookingTime, setCookingTime] = useState("");
  const [category, setCategory] = useState("");
  const [sourceUrl, setSourceUrl] = useState("");
  const [memo, setMemo] = useState("");

  // どのカードを開いているか
  const [editingSection, setEditingSection] = useState(null);
  const [ingredientDrawerOpen, setIngredientDrawerOpen] = useState(false);

  // タグ
  const [searchTags, setSearchTags] = useState([]);
  const [tagInput, setTagInput] = useState("");

  // UI状態
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  const [sourceUrlError, setSourceUrlError] = useState("");

  // タグ追加可否
  const canAddTag = useMemo(() => {
    const t = normalizeTag(tagInput);
    if (!t) return false;
    if (searchTags.includes(t)) return false;
    if (searchTags.length >= MAX_TAGS) return false;
    return true;
  }, [tagInput, searchTags]);

  /** =========================
   * 初回：レシピ読み込み
   ========================= */
  useEffect(() => {
    if (!id || !user) return;

    const fetchRecipe = async () => {
      setLoading(true);
      setErrorMsg("");

      try {
        const refDoc = doc(db, "recipes", id);
        const snap = await getDoc(refDoc);

        if (!snap.exists()) {
          alert("レシピが見つかりませんでした");
          router.push("/recipes");
          return;
        }

        const data = snap.data();

        // 権限チェック
        if (data.userId !== user.uid) {
          alert("このレシピを編集する権限がありません");
          router.push("/recipes");
          return;
        }

        setRecipeName(data.recipeName || "");

        setIngredients(
          Array.isArray(data.ingredients) && data.ingredients.length > 0
            ? data.ingredients
            : [{ name: "", quantity: "" }],
        );

        setSeasonings(
          Array.isArray(data.seasonings) && data.seasonings.length > 0
            ? data.seasonings
            : [{ name: "", quantity: "" }],
        );

        setCurrentImageUrl(data.imageUrl || "");
        setPreviewUrl(data.imageUrl || "");

        setCalories(
          data.calories !== undefined && data.calories !== null
            ? String(data.calories)
            : "",
        );
        setCookingTime(
          data.cookingTime !== undefined && data.cookingTime !== null
            ? String(data.cookingTime)
            : "",
        );

        setCategory(data.category || "");
        setSourceUrl(data.sourceUrl || data.videoUrl || "");
        setMemo(data.memo || "");

        //  タグ
        setSearchTags(
          Array.isArray(data.searchTags)
            ? data.searchTags
                .map((t) => normalizeTag(t))
                .filter(Boolean)
                .slice(0, MAX_TAGS)
            : [],
        );
      } catch (err) {
        console.error("レシピ取得エラー:", err);
        alert("レシピの取得中にエラーが発生しました");
        router.push("/recipes");
      } finally {
        setLoading(false);
      }
    };

    fetchRecipe();
  }, [id, user, router]);

  /** =========================
   * 行操作（具材・調味料）
   ========================= */
  const handleAddIngredient = () =>
    setIngredients((p) => [...p, { name: "", quantity: "" }]);
  const handleRemoveIngredient = (index) =>
    setIngredients((p) => {
      const next = p.filter((_, i) => i !== index);
      return next.length > 0 ? next : [{ name: "", quantity: "" }];
    });
  const handleIngredientChange = (index, field, value) =>
    setIngredients((p) => {
      const next = [...p];
      next[index] = { ...next[index], [field]: value };
      return next;
    });

  const handleAddSeasoning = () =>
    setSeasonings((p) => [...p, { name: "", quantity: "" }]);
  const handleRemoveSeasoning = (index) =>
    setSeasonings((p) => {
      const next = p.filter((_, i) => i !== index);
      return next.length > 0 ? next : [{ name: "", quantity: "" }];
    });
  const handleSeasoningChange = (index, field, value) =>
    setSeasonings((p) => {
      const next = [...p];
      next[index] = { ...next[index], [field]: value };
      return next;
    });

  /** =========================
   * タグ操作
   ========================= */
  const handleAddTag = () => {
    const t = normalizeTag(tagInput);
    if (!t) return;

    setSearchTags((prev) => {
      if (prev.includes(t)) return prev;
      if (prev.length >= MAX_TAGS) return prev;
      return [...prev, t];
    });

    setTagInput("");
  };

  const handleDeleteTag = (tag) =>
    setSearchTags((prev) => prev.filter((t) => t !== tag));

  const handleTagKeyDown = (e) => {
    if (e.key === "Enter") {
      e.preventDefault();
      if (canAddTag) handleAddTag();
    }
  };

  /** =========================
   * 画像選択 & アップロード
   ========================= */
  const handleImageSelect = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setImageFile(file);
    setPreviewUrl(URL.createObjectURL(file));
  };

  const uploadImage = async () => {
    // 新しい画像を選んでいなければ元のURLを返す
    if (!imageFile || !user) return currentImageUrl;

    const safeName = imageFile.name.replace(/\s+/g, "_");
    const path = `recipes/${user.uid}/${Date.now()}_${safeName}`;
    const storageRef = ref(storage, path);
    await uploadBytes(storageRef, imageFile);
    return await getDownloadURL(storageRef);
  };

  /** =========================
   * 更新
   ========================= */
  const updateRecipe = async () => {
    if (!user) return;

    setErrorMsg("");
    setSourceUrlError("");

    if (!recipeName.trim()) {
      setErrorMsg("レシピ名を入力してください");
      return;
    }

    const validIngredients = ingredients
      .map((i) => ({
        name: (i.name || "").trim(),
        quantity: (i.quantity || "").trim(),
      }))
      .filter((i) => i.name);

    const validSeasonings = seasonings
      .map((s) => ({
        name: (s.name || "").trim(),
        quantity: (s.quantity || "").trim(),
      }))
      .filter((s) => s.name);

    const parsedSource = parseRecipeSource(sourceUrl);

    if (!parsedSource) {
      setSourceUrlError(
        "YouTube・YouTube Shorts・Instagramの投稿またはリールURLを入力してください。埋め込みコード・TikTokには対応していません。",
      );
      return;
    }

    const { sourceType, sourceUrl: normalizedSourceUrl } = parsedSource;

    try {
      setSaving(true);

      const imageUrl = await uploadImage();

      await updateDoc(doc(db, "recipes", id), {
        recipeName: recipeName.trim(),
        ingredients: validIngredients,
        seasonings: validSeasonings,
        imageUrl,

        calories: calories ? Number(calories) : null,
        cookingTime: cookingTime ? Number(cookingTime) : null,
        category: category || null,
        sourceType: sourceType || "manual",
        sourceUrl: normalizedSourceUrl || null,
        memo: memo.trim() || null,

        // 既存のYouTube詳細表示との互換用
        videoUrl:
          sourceType === "youtube" && normalizedSourceUrl
            ? normalizedSourceUrl
            : null,

        //  タグ
        searchTags: searchTags.slice(0, MAX_TAGS),

        updatedAt: serverTimestamp(),
      });

      router.push("/recipes");
    } catch (err) {
      console.error("更新エラー:", err);
      setErrorMsg(`更新に失敗しました: ${err.message ?? err}`);
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <Typography sx={{ mt: 4, textAlign: "center" }}>
        レシピを読み込んでいます…
      </Typography>
    );
  }
  const ingredientCount = ingredients.filter((item) =>
    item.name?.trim(),
  ).length;

  const seasoningCount = seasonings.filter((item) => item.name?.trim()).length;

  return (
    <AppLayout title="レシピ編集" activeNav="recipes">
      <Paper
        elevation={3}
        sx={{
          maxWidth: 720,
          mx: "auto",
          mt: 5,
          p: { xs: 2, sm: 4 },
          borderRadius: 2,
        }}
      >
        <Typography variant="h5" mb={2} fontWeight={900}>
          ✏️ レシピを編集する
        </Typography>

        {errorMsg && (
          <Alert severity="error" sx={{ mb: 2 }}>
            {errorMsg}
          </Alert>
        )}

        {/* レシピ名 */}
        <TextField
          label="レシピ名"
          variant="outlined"
          fullWidth
          value={recipeName}
          onChange={(e) => setRecipeName(e.target.value)}
          sx={{ mb: 2 }}
          disabled={saving}
        />

        {/* 画像 */}
        <Stack direction="row" spacing={2} alignItems="center" sx={{ mb: 2 }}>
          <Button
            variant="contained"
            component="label"
            startIcon={<CloudUpload />}
            disabled={saving}
          >
            画像を変更
            <input
              type="file"
              hidden
              accept="image/*"
              onChange={handleImageSelect}
            />
          </Button>

          {previewUrl && (
            <img
              src={previewUrl}
              alt="preview"
              style={{
                width: 80,
                height: 80,
                borderRadius: 8,
                objectFit: "cover",
                border: "1px solid rgba(0,0,0,0.08)",
              }}
            />
          )}
        </Stack>

        {/* タグ */}
        <Divider sx={{ my: 2 }} />
        <Typography variant="h6" mb={1} fontWeight={900}>
          🔍 検索タグ（最大{MAX_TAGS}つ）
        </Typography>

        <Stack
          direction={{ xs: "column", sm: "row" }}
          spacing={1}
          sx={{ mb: 1 }}
        >
          <TextField
            label="タグを追加（例：時短 / 玉ねぎ / 節約 / かんたんレシピ）"
            value={tagInput}
            onChange={(e) => setTagInput(e.target.value)}
            onKeyDown={handleTagKeyDown}
            fullWidth
            disabled={saving || searchTags.length >= MAX_TAGS}
            helperText={
              searchTags.length >= MAX_TAGS
                ? `タグは最大${MAX_TAGS}つまでです`
                : "Enterでも追加できます（先頭の # は不要）"
            }
          />
          <Button
            variant="contained"
            startIcon={<AddIcon />}
            onClick={handleAddTag}
            disabled={saving || !canAddTag}
            sx={{ borderRadius: 2, whiteSpace: "nowrap" }}
          >
            追加
          </Button>
        </Stack>

        <Stack direction="row" spacing={1} flexWrap="wrap" sx={{ mb: 2 }}>
          {searchTags.length === 0 ? (
            <Typography variant="body2" color="text.secondary">
              タグは未設定です
            </Typography>
          ) : (
            searchTags.map((t) => (
              <Chip
                key={t}
                label={`#${t}`}
                color="primary"
                onDelete={saving ? undefined : () => handleDeleteTag(t)}
                sx={{ fontWeight: 800 }}
              />
            ))
          )}
        </Stack>

        <Box
          sx={{
            mb: 2,
            border: "1px solid #E7E1D8",
            borderRadius: 3,
            bgcolor: "#FFFFFF",
          }}
        >
          <Stack
            direction="row"
            alignItems="center"
            justifyContent="space-between"
            sx={{ p: 2 }}
          >
            <Box>
              <Typography
                sx={{
                  fontSize: 16,
                  fontWeight: 800,
                  color: "#333333",
                }}
              >
                食材
              </Typography>

              <Typography
                variant="body2"
                sx={{
                  mt: 0.5,
                  color: "#777777",
                }}
              >
                買い物リストや冷蔵庫管理に使います
              </Typography>

              <Typography
                variant="caption"
                sx={{
                  display: "block",
                  mt: 0.75,
                  color:
                    ingredientCount + seasoningCount > 0
                      ? "#2E7D32"
                      : "#FF8A00",
                  fontWeight: 700,
                }}
              >
                {ingredientCount + seasoningCount > 0
                  ? `食材${ingredientCount}件・調味料${seasoningCount}件`
                  : "未登録"}
              </Typography>
            </Box>

            <Button
              size="small"
              variant="outlined"
              onClick={() => setIngredientDrawerOpen(true)}
              disabled={saving}
              sx={{
                borderRadius: 999,
                fontWeight: 700,
              }}
            >
              {ingredientCount + seasoningCount > 0 ? "編集" : "＋ 追加"}
            </Button>
          </Stack>
        </Box>

        <Box
          sx={{
            mb: 2,
            border: "1px solid #E7E1D8",
            borderRadius: 3,
            bgcolor: "#FFFFFF",
            overflow: "hidden",
          }}
        >
          <Stack
            direction="row"
            alignItems="center"
            justifyContent="space-between"
            sx={{ p: 2 }}
          >
            <Box>
              <Typography
                sx={{
                  fontSize: 16,
                  fontWeight: 800,
                  color: "#333333",
                }}
              >
                コメント
              </Typography>

              <Typography
                variant="body2"
                sx={{
                  mt: 0.5,
                  color: "#777777",
                }}
              >
                作った感想や家族の反応を残せます
              </Typography>

              {!memo.trim() && (
                <Typography
                  variant="caption"
                  sx={{
                    display: "block",
                    mt: 0.75,
                    color: "#FF8A00",
                    fontWeight: 700,
                  }}
                >
                  未登録
                </Typography>
              )}
            </Box>

            <Button
              size="small"
              variant="outlined"
              onClick={() =>
                setEditingSection((current) =>
                  current === "memo" ? null : "memo",
                )
              }
              disabled={saving}
              sx={{
                borderRadius: 999,
                fontWeight: 700,
              }}
            >
              {memo.trim() ? "編集" : "＋ 追加"}
            </Button>
          </Stack>

          <Collapse in={editingSection === "memo"}>
            <Box
              sx={{
                px: 2,
                pb: 2,
              }}
            >
              <TextField
                fullWidth
                multiline
                minRows={3}
                value={memo}
                onChange={(e) => setMemo(e.target.value)}
                placeholder="例：きのこの香りがよくて、家族にも好評！"
                inputProps={{ maxLength: 200 }}
                helperText={`${memo.length} / 200`}
                disabled={saving}
              />

              <Stack
                direction="row"
                justifyContent="flex-end"
                spacing={1}
                sx={{ mt: 1.5 }}
              >
                <Button
                  size="small"
                  onClick={() => setEditingSection(null)}
                  disabled={saving}
                >
                  閉じる
                </Button>
              </Stack>
            </Box>
          </Collapse>
        </Box>

        {/* レシピ情報 */}
        <Divider sx={{ my: 2 }} />
        <Typography variant="h6" mb={1} fontWeight={900}>
          レシピ情報
        </Typography>

        <FormControl component="fieldset" sx={{ mb: 2 }}>
          <FormLabel component="legend">料理のカテゴリー</FormLabel>
          <RadioGroup
            row
            name="recipe-category"
            value={category}
            onChange={(e) => setCategory(e.target.value)}
          >
            <FormControlLabel value="staple" control={<Radio />} label="主食" />
            <FormControlLabel value="main" control={<Radio />} label="主菜" />
            <FormControlLabel value="side" control={<Radio />} label="副菜" />
            <FormControlLabel value="soup" control={<Radio />} label="汁物" />
          </RadioGroup>
        </FormControl>

        <Stack spacing={2} sx={{ mb: 3 }}>
          <TextField
            label="カロリー (kcal)"
            type="number"
            value={calories}
            onChange={(e) => setCalories(e.target.value)}
            fullWidth
            disabled={saving}
          />
          <TextField
            label="調理時間 (分)"
            type="number"
            value={cookingTime}
            onChange={(e) => setCookingTime(e.target.value)}
            fullWidth
            disabled={saving}
          />
          <TextField
            label="元コンテンツURL（任意）"
            value={sourceUrl}
            onChange={(e) => {
              setSourceUrl(e.target.value);
              if (sourceUrlError) {
                setSourceUrlError("");
              }
            }}
            fullWidth
            disabled={saving}
            placeholder="https://www.instagram.com/p/..."
            error={!!sourceUrlError}
            helperText={
              sourceUrlError ||
              "YouTube・YouTube Shorts・Instagramの投稿・リールに対応"
            }
          />
        </Stack>

        <Box textAlign="center">
          <Button
            variant="contained"
            color="primary"
            onClick={updateRecipe}
            sx={{ px: 5, borderRadius: 999 }}
            disabled={saving}
          >
            {saving ? "更新中…" : "更新する"}
          </Button>
        </Box>
      </Paper>
      <Drawer
        anchor="right"
        open={ingredientDrawerOpen}
        onClose={() => setIngredientDrawerOpen(false)}
        PaperProps={{
          sx: {
            width: {
              xs: "100%",
              sm: 480,
            },
            p: 3,
          },
        }}
      >
        <Box
          sx={{
            display: "flex",
            flexDirection: "column",
            height: "100%",
          }}
        >
          <Box sx={{ mb: 3 }}>
            <Typography
              sx={{
                fontSize: 20,
                fontWeight: 800,
                color: "#333333",
              }}
            >
              食材を編集
            </Typography>

            <Typography
              variant="body2"
              sx={{
                mt: 0.5,
                color: "#777777",
              }}
            >
              食材と調味料をまとめて編集できます
            </Typography>
          </Box>

          <Box sx={{ flex: 1, overflowY: "auto" }}>
            <Typography
              sx={{
                mb: 1.5,
                fontWeight: 800,
              }}
            >
              食材
            </Typography>

            {ingredients.map((ingredient, index) => (
              <Stack
                key={`ing-${index}`}
                direction="row"
                spacing={1}
                alignItems="center"
                sx={{ mb: 1.5 }}
              >
                <TextField
                  label="食材名"
                  size="small"
                  fullWidth
                  value={ingredient.name}
                  onChange={(e) =>
                    handleIngredientChange(index, "name", e.target.value)
                  }
                  disabled={saving}
                />

                <TextField
                  label="量"
                  size="small"
                  value={ingredient.quantity}
                  onChange={(e) =>
                    handleIngredientChange(index, "quantity", e.target.value)
                  }
                  sx={{ width: 130 }}
                  disabled={saving}
                />

                <IconButton
                  color="error"
                  onClick={() => handleRemoveIngredient(index)}
                  disabled={saving || ingredients.length === 1}
                >
                  <RemoveCircleOutline />
                </IconButton>
              </Stack>
            ))}

            <Button
              variant="outlined"
              startIcon={<AddCircleOutline />}
              onClick={handleAddIngredient}
              disabled={saving}
              sx={{ mb: 4 }}
            >
              食材を追加
            </Button>

            <Typography
              sx={{
                mb: 1.5,
                fontWeight: 800,
              }}
            >
              調味料
            </Typography>

            {seasonings.map((seasoning, index) => (
              <Stack
                key={`sea-${index}`}
                direction="row"
                spacing={1}
                alignItems="center"
                sx={{ mb: 1.5 }}
              >
                <TextField
                  label="調味料名"
                  size="small"
                  fullWidth
                  value={seasoning.name}
                  onChange={(e) =>
                    handleSeasoningChange(index, "name", e.target.value)
                  }
                  disabled={saving}
                />

                <TextField
                  label="量"
                  size="small"
                  value={seasoning.quantity}
                  onChange={(e) =>
                    handleSeasoningChange(index, "quantity", e.target.value)
                  }
                  sx={{ width: 130 }}
                  disabled={saving}
                />

                <IconButton
                  color="error"
                  onClick={() => handleRemoveSeasoning(index)}
                  disabled={saving || seasonings.length === 1}
                >
                  <RemoveCircleOutline />
                </IconButton>
              </Stack>
            ))}

            <Button
              variant="outlined"
              startIcon={<AddCircleOutline />}
              onClick={handleAddSeasoning}
              disabled={saving}
            >
              調味料を追加
            </Button>
          </Box>

          <Box
            sx={{
              pt: 2,
              mt: 2,
              borderTop: "1px solid #EEE8DF",
            }}
          >
            <Button
              fullWidth
              variant="contained"
              onClick={() => setIngredientDrawerOpen(false)}
              sx={{
                minHeight: 48,
                borderRadius: 999,
                fontWeight: 800,
              }}
            >
              編集を終える
            </Button>

            <Typography
              variant="caption"
              sx={{
                display: "block",
                mt: 1,
                textAlign: "center",
                color: "#888888",
              }}
            >
              変更内容は画面下の「更新する」で保存されます
            </Typography>
          </Box>
        </Box>
      </Drawer>
    </AppLayout>
  );
}
