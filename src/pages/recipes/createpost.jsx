import AppLayout from "@/components/layout/AppLayout";
import React, { useMemo, useState } from "react";
import { createRecipe as createRecipeApi } from "@/features/recipes";
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
  Radio,
  RadioGroup,
  FormControl,
  FormControlLabel,
  FormLabel,
  Chip,
  Divider,
  Alert,
  Switch,
} from "@mui/material";
import {
  AddCircleOutline,
  RemoveCircleOutline,
  CloudUpload,
} from "@mui/icons-material";
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
import { storage } from "@/lib/firebase";

export default function CreateRecipe() {
  const router = useRouter();
  const { user, loading } = useRequireAuth();
  const [recipeName, setRecipeName] = useState("");

  /* ========= 具材・調味料 ========= */
  const [ingredients, setIngredients] = useState([{ name: "", quantity: "" }]);
  const [seasonings, setSeasonings] = useState([{ name: "", quantity: "" }]);

  /* ========= タグ ========= */
  const [tagInput, setTagInput] = useState("");
  const [searchTags, setSearchTags] = useState([]);

  /* ========= その他 ========= */
  const [imageFile, setImageFile] = useState(null);
  const [previewUrl, setPreviewUrl] = useState("");
  const [calories, setCalories] = useState("");
  const [cookingTime, setCookingTime] = useState("");
  const [videoUrl, setVideoUrl] = useState("");
  const [category, setCategory] = useState("main");

  /* ========= 疲労モード ========= */
  const [isMicrowave, setIsMicrowave] = useState(false);
  const [isLowDishwashing, setIsLowDishwashing] = useState(false);

  /* ========= 画面メッセージ ========= */
  const [errorMsg, setErrorMsg] = useState("");
  const [saving, setSaving] = useState(false);

  /* ========= 共通操作 ========= */
  const handleImageSelect = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setImageFile(file);
    setPreviewUrl(URL.createObjectURL(file));
  };

  const uploadImage = async () => {
    if (!imageFile || !user) return "";
    const safeName = imageFile.name.replace(/\s+/g, "_");
    const path = `recipes/${user.uid}/${Date.now()}_${safeName}`;
    const storageRef = ref(storage, path);
    await uploadBytes(storageRef, imageFile);
    return await getDownloadURL(storageRef);
  };

  /* ========= 行UI（具材・調味料） ========= */
  const updateRow = (setter, list, idx, key, value) => {
    const next = [...list];
    next[idx] = { ...next[idx], [key]: value };
    setter(next);
  };

  const addRow = (setter, list) => {
    setter([...list, { name: "", quantity: "" }]);
  };

  const removeRow = (setter, list, idx) => {
    if (list.length <= 1) return; // 最低1行残す
    const next = list.filter((_, i) => i !== idx);
    setter(next);
  };

  /* ========= タグ操作 ========= */
  const addTag = () => {
    const tag = tagInput.trim();
    if (!tag) return;
    if (searchTags.includes(tag)) return;
    if (searchTags.length >= 4) return;

    setSearchTags([...searchTags, tag]);
    setTagInput("");
  };

  const removeTag = (tag) => {
    setSearchTags(searchTags.filter((t) => t !== tag));
  };

  const ingredientCount = useMemo(
    () => ingredients.filter((i) => i.name.trim()).length,
    [ingredients],
  );

  if (loading) return <div>Loading...</div>;
  if (!user) return <div>ユーザー情報を取得中...</div>;

  /* ========= 保存 ========= */
  const createRecipe = async () => {
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

      const imageUrl = imageFile ? await uploadImage() : "";

      await createRecipeApi({
        recipeName: recipeName.trim(),

        //  具材・調味料
        ingredients: validIngredients,
        seasonings: validSeasonings,

        //  検索タグ
        searchTags,

        //  画像・分類
        imageUrl,
        category, // staple/main/side/soup

        //  数値
        calories: calories ? Number(calories) : null,
        cookingTime: cookingTime ? Number(cookingTime) : null,

        //  動画
        videoUrl: videoUrl?.trim() ? videoUrl.trim() : null,

        //  疲労モード用
        easyFlags: {
          microwave: !!isMicrowave,
          lowDishwashing: !!isLowDishwashing,
        },

        //  author
        authorId: user.uid,
      });

      router.push("/recipes");
    } catch (e) {
      console.error(e);
      setErrorMsg(
        "登録に失敗しました（通信状況・権限・Storage設定を確認してね）",
      );
    } finally {
      setSaving(false);
    }
  };

  return (
    <AppLayout title="レシピ作成" activeNav="create">
      <Paper sx={{ maxWidth: 720, mx: "auto", mt: 5, p: { xs: 2, sm: 4 } }}>
        <Typography variant="h5" fontWeight={800} mb={2}>
          🍳 レシピを登録
        </Typography>

        {errorMsg && (
          <Alert severity="error" sx={{ mb: 2 }}>
            {errorMsg}
          </Alert>
        )}

        {/* レシピ名 */}
        <TextField
          fullWidth
          label="レシピ名"
          value={recipeName}
          onChange={(e) => setRecipeName(e.target.value)}
          sx={{ mb: 2 }}
        />

        {/* 画像 */}
        <Stack direction="row" spacing={2} alignItems="center" mb={2}>
          <Button
            variant="contained"
            component="label"
            startIcon={<CloudUpload />}
            disabled={saving}
          >
            画像を選択
            <input
              hidden
              type="file"
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
                objectFit: "cover",
                borderRadius: 8,
                border: "1px solid rgba(0,0,0,0.08)",
              }}
            />
          )}
        </Stack>

        <Divider sx={{ my: 2 }} />

        {/* ✅ 具材 */}
        <Stack
          direction="row"
          justifyContent="space-between"
          alignItems="center"
        >
          <Typography fontWeight={900}>🥬 具材（必須）</Typography>
          <Chip size="small" label={`入力：${ingredientCount}件`} />
        </Stack>

        <Box sx={{ mt: 1.2, mb: 2 }}>
          {ingredients.map((row, idx) => (
            <Stack
              key={idx}
              direction="row"
              spacing={1}
              alignItems="center"
              sx={{ mb: 1 }}
            >
              <TextField
                fullWidth
                size="small"
                label="具材名"
                placeholder="例：鶏もも肉"
                value={row.name}
                onChange={(e) =>
                  updateRow(
                    setIngredients,
                    ingredients,
                    idx,
                    "name",
                    e.target.value,
                  )
                }
                disabled={saving}
              />
              <TextField
                size="small"
                label="量"
                placeholder="例：200g"
                value={row.quantity}
                onChange={(e) =>
                  updateRow(
                    setIngredients,
                    ingredients,
                    idx,
                    "quantity",
                    e.target.value,
                  )
                }
                sx={{ width: 160 }}
                disabled={saving}
              />

              <IconButton
                onClick={() => removeRow(setIngredients, ingredients, idx)}
                disabled={saving || ingredients.length <= 1}
              >
                <RemoveCircleOutline />
              </IconButton>

              <IconButton
                onClick={() => addRow(setIngredients, ingredients)}
                disabled={saving}
              >
                <AddCircleOutline />
              </IconButton>
            </Stack>
          ))}
        </Box>

        {/* ✅ 調味料（任意） */}
        <Typography fontWeight={900} mb={1}>
          🧂 調味料（任意）
        </Typography>

        <Box sx={{ mb: 2 }}>
          {seasonings.map((row, idx) => (
            <Stack
              key={idx}
              direction="row"
              spacing={1}
              alignItems="center"
              sx={{ mb: 1 }}
            >
              <TextField
                fullWidth
                size="small"
                label="調味料名"
                placeholder="例：醤油"
                value={row.name}
                onChange={(e) =>
                  updateRow(
                    setSeasonings,
                    seasonings,
                    idx,
                    "name",
                    e.target.value,
                  )
                }
                disabled={saving}
              />
              <TextField
                size="small"
                label="量"
                placeholder="例：大さじ1"
                value={row.quantity}
                onChange={(e) =>
                  updateRow(
                    setSeasonings,
                    seasonings,
                    idx,
                    "quantity",
                    e.target.value,
                  )
                }
                sx={{ width: 160 }}
                disabled={saving}
              />

              <IconButton
                onClick={() => removeRow(setSeasonings, seasonings, idx)}
                disabled={saving || seasonings.length <= 1}
              >
                <RemoveCircleOutline />
              </IconButton>

              <IconButton
                onClick={() => addRow(setSeasonings, seasonings)}
                disabled={saving}
              >
                <AddCircleOutline />
              </IconButton>
            </Stack>
          ))}
        </Box>

        <Divider sx={{ my: 2 }} />

        {/* 🔍 検索タグ */}
        <Typography fontWeight={900} mb={1}>
          🔍 検索タグ（最大4つ）
        </Typography>

        <Stack direction="row" spacing={1} mb={1}>
          <TextField
            size="small"
            placeholder="例：時短 / 玉ねぎ / 節約 / かんたんレシピ"
            value={tagInput}
            onChange={(e) => setTagInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                addTag();
              }
            }}
            sx={{ width: 400 }}
            disabled={saving}
          />
          <Button variant="outlined" onClick={addTag} disabled={saving}>
            追加
          </Button>
        </Stack>

        <Stack direction="row" spacing={1} flexWrap="wrap" mb={2}>
          {searchTags.map((tag) => (
            <Chip key={tag} label={`#${tag}`} onDelete={() => removeTag(tag)} />
          ))}
        </Stack>

        {/* カテゴリー */}
        <FormControl sx={{ mb: 2 }}>
          <FormLabel sx={{ fontWeight: 900 }}>カテゴリー</FormLabel>
          <RadioGroup
            row
            value={category}
            onChange={(e) => setCategory(e.target.value)}
          >
            <FormControlLabel value="staple" control={<Radio />} label="主食" />
            <FormControlLabel value="main" control={<Radio />} label="主菜" />
            <FormControlLabel value="side" control={<Radio />} label="副菜" />
            <FormControlLabel value="soup" control={<Radio />} label="汁物" />
          </RadioGroup>
        </FormControl>

        {/* ✅ 疲労モード向け */}
        <Typography fontWeight={900} mb={1}>
          ⚡ 疲労モード用
        </Typography>
        <Stack direction="row" spacing={2} alignItems="center" mb={2}>
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

        {/* 数値・動画 */}
        <Stack spacing={2} mb={3}>
          <TextField
            label="カロリー (kcal)"
            type="number"
            value={calories}
            onChange={(e) => setCalories(e.target.value)}
            disabled={saving}
          />
          <TextField
            label="調理時間 (分)"
            type="number"
            value={cookingTime}
            onChange={(e) => setCookingTime(e.target.value)}
            disabled={saving}
          />
          <TextField
            label="動画URL"
            value={videoUrl}
            onChange={(e) => setVideoUrl(e.target.value)}
            disabled={saving}
          />
        </Stack>

        <Box textAlign="center">
          <Button
            variant="contained"
            sx={{ px: 5, borderRadius: 999 }}
            onClick={createRecipe}
            disabled={saving}
          >
            {saving ? "保存中…" : "登録する"}
          </Button>
        </Box>
      </Paper>
    </AppLayout>
  );
}
