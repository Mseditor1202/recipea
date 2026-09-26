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
  Switch,
} from "@mui/material";
import {
  AddCircleOutline,
  RemoveCircleOutline,
  CloudUpload,
  Add as AddIcon,
} from "@mui/icons-material";
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
import { db, storage } from "@/lib/firebase";

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
  const [category, setCategory] = useState("main");
  const [videoUrl, setVideoUrl] = useState("");

  // ✅ 疲労モード用（Createと揃える）
  const [isMicrowave, setIsMicrowave] = useState(false);
  const [isLowDishwashing, setIsLowDishwashing] = useState(false);

  // タグ
  const [searchTags, setSearchTags] = useState([]);
  const [tagInput, setTagInput] = useState("");

  // UI状態
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");

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
        if (data.authorId !== user.uid) {
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

        setCategory(data.category || "main");
        setVideoUrl(data.videoUrl || "");

        // ✅ タグ
        setSearchTags(
          Array.isArray(data.searchTags)
            ? data.searchTags
                .map((t) => normalizeTag(t))
                .filter(Boolean)
                .slice(0, MAX_TAGS)
            : [],
        );

        // ✅ 疲労モードフラグ（古いデータは無いのでフォールバック）
        const ef = data.easyFlags || {};
        setIsMicrowave(!!ef.microwave);
        setIsLowDishwashing(!!ef.lowDishwashing);
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

    if (!recipeName.trim()) {
      setErrorMsg("レシピ名を入力してください");
      return;
    }

    const validIngredients = ingredients
      .map((i) => ({
        name: (i.name || "").trim(),
        quantity: (i.quantity || "").trim(),
      }))
      .filter((i) => i.name && i.quantity);

    const validSeasonings = seasonings
      .map((s) => ({
        name: (s.name || "").trim(),
        quantity: (s.quantity || "").trim(),
      }))
      .filter((s) => s.name && s.quantity);

    if (validIngredients.length === 0) {
      setErrorMsg("具材を1つ以上入力してください（例：鶏もも 200g）");
      return;
    }

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
        category,
        videoUrl: videoUrl?.trim() ? videoUrl.trim() : null,

        // ✅ タグ
        searchTags: searchTags.slice(0, MAX_TAGS),

        // ✅ 疲労モード用
        easyFlags: {
          microwave: !!isMicrowave,
          lowDishwashing: !!isLowDishwashing,
        },

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

        {/* 具材 */}
        <Divider sx={{ my: 2 }} />
        <Typography variant="h6" mb={1} fontWeight={900}>
          🥬 具材（必須）
        </Typography>

        {ingredients.map((ingredient, index) => (
          <Stack
            key={`ing-${index}`}
            direction="row"
            spacing={1.5}
            alignItems="center"
            sx={{ mb: 1.5 }}
          >
            <TextField
              label="具材名"
              variant="outlined"
              fullWidth
              value={ingredient.name}
              onChange={(e) =>
                handleIngredientChange(index, "name", e.target.value)
              }
              disabled={saving}
            />
            <TextField
              label="量"
              variant="outlined"
              fullWidth
              value={ingredient.quantity}
              onChange={(e) =>
                handleIngredientChange(index, "quantity", e.target.value)
              }
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
          sx={{ mb: 2 }}
          disabled={saving}
        >
          具材を追加
        </Button>

        {/* 調味料 */}
        <Typography variant="h6" mb={1} fontWeight={900}>
          🧂 調味料（任意）
        </Typography>

        {seasonings.map((seasoning, index) => (
          <Stack
            key={`sea-${index}`}
            direction="row"
            spacing={1.5}
            alignItems="center"
            sx={{ mb: 1.5 }}
          >
            <TextField
              label="調味料名"
              variant="outlined"
              fullWidth
              value={seasoning.name}
              onChange={(e) =>
                handleSeasoningChange(index, "name", e.target.value)
              }
              disabled={saving}
            />
            <TextField
              label="量"
              variant="outlined"
              fullWidth
              value={seasoning.quantity}
              onChange={(e) =>
                handleSeasoningChange(index, "quantity", e.target.value)
              }
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
          sx={{ mb: 2 }}
          disabled={saving}
        >
          調味料を追加
        </Button>

        {/* 疲労モード用 */}
        <Divider sx={{ my: 2 }} />
        <Typography variant="h6" mb={1} fontWeight={900}>
          ⚡ 疲労モード用（任意）
        </Typography>
        <Stack
          direction={{ xs: "column", sm: "row" }}
          spacing={2}
          sx={{ mb: 2 }}
        >
          <FormControlLabel
            control={
              <Switch
                checked={isMicrowave}
                onChange={(e) => setIsMicrowave(e.target.checked)}
                disabled={saving}
              />
            }
            label="レンチンOK"
          />
          <FormControlLabel
            control={
              <Switch
                checked={isLowDishwashing}
                onChange={(e) => setIsLowDishwashing(e.target.checked)}
                disabled={saving}
              />
            }
            label="洗い物少"
          />
          <Chip size="small" label="※10分は調理時間で判定" variant="outlined" />
        </Stack>

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
            label="動画URL"
            value={videoUrl}
            onChange={(e) => setVideoUrl(e.target.value)}
            fullWidth
            disabled={saving}
            placeholder="https://www.youtube.com/watch?v=..."
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
    </AppLayout>
  );
}
