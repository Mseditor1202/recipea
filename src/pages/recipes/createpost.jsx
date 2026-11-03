import AppLayout from "@/components/layout/AppLayout";
import React, { useMemo, useState } from "react";
import { createRecipe as createRecipeApi } from "@/features/recipes";
import { useRouter } from "next/router";
import { useRequireAuth } from "@/hooks/useRequireAuth";
import { parseRecipeSource } from "@/features/recipes/utils/recipeSource";
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
  const [registrationMode, setRegistrationMode] = useState(null);

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
  const [sourceUrl, setSourceUrl] = useState("");
  const [category, setCategory] = useState("");

  /* ========= 疲労モード ========= */
  const [isMicrowave, setIsMicrowave] = useState(false);
  const [isLowDishwashing, setIsLowDishwashing] = useState(false);

  /* ========= 画面メッセージ ========= */
  const [errorMsg, setErrorMsg] = useState("");
  const [sourceUrlError, setSourceUrlError] = useState("");
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

    if (registrationMode === "external" && !sourceUrl.trim()) {
      setSourceUrlError("元コンテンツURLを入力してください。");
      return;
    }

    const parsedSource = parseRecipeSource(
      registrationMode === "external" ? sourceUrl : "",
    );

    if (!parsedSource) {
      setSourceUrlError(
        "YouTube・YouTube Shorts・Instagramの投稿またはリールURLを入力してください。埋め込みコード・TikTokには対応していません。",
      );
      return;
    }

    const { sourceType, sourceUrl: normalizedSourceUrl } = parsedSource;

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
        category: category || null,

        //  数値
        calories: calories ? Number(calories) : null,
        cookingTime: cookingTime ? Number(cookingTime) : null,

        // 元コンテンツ
        sourceType: sourceType || "manual",
        sourceUrl: normalizedSourceUrl || null,

        // 既存データ・詳細画面との互換用
        videoUrl:
          sourceType === "youtube" && normalizedSourceUrl
            ? normalizedSourceUrl
            : null,

        //  疲労モード用
        easyFlags: {
          microwave: !!isMicrowave,
          lowDishwashing: !!isLowDishwashing,
        },

        userId: user.uid,
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

  if (registrationMode === null) {
    return (
      <AppLayout title="レシピ登録" activeNav="create">
        <Paper
          elevation={0}
          sx={{
            maxWidth: 560,
            mx: "auto",
            mt: { xs: 2, sm: 5 },
            p: { xs: 2.5, sm: 4 },
            borderRadius: 3,
            border: "1px solid #EEE8DF",
            bgcolor: "#FFFFFF",
          }}
        >
          <Box sx={{ textAlign: "center", mb: 4 }}>
            <Typography
              component="h1"
              sx={{
                fontSize: 22,
                fontWeight: 800,
                color: "#333333",
              }}
            >
              どの方法で登録しますか？
            </Typography>

            <Typography
              variant="body2"
              sx={{
                mt: 1,
                color: "#777777",
              }}
            >
              あとからいつでも情報を追加できます
            </Typography>
          </Box>

          <Stack spacing={2}>
            <Button
              fullWidth
              variant="outlined"
              onClick={() => setRegistrationMode("manual")}
              sx={{
                justifyContent: "space-between",
                textAlign: "left",
                minHeight: 110,
                px: 2.5,
                py: 2,
                borderRadius: 3,
                borderColor: "#BFD9C2",
                color: "#333333",
                textTransform: "none",
                "&:hover": {
                  borderColor: "#4CAF6A",
                  bgcolor: "#F6FBF6",
                },
              }}
            >
              <Box>
                <Typography
                  sx={{
                    fontSize: 17,
                    fontWeight: 800,
                    color: "#247531",
                  }}
                >
                  自分で登録する
                </Typography>

                <Typography
                  variant="body2"
                  sx={{
                    mt: 0.75,
                    color: "#666666",
                    lineHeight: 1.7,
                  }}
                >
                  料理名と食材などを入力して
                  <br />
                  オリジナルのレシピを作ります
                </Typography>
              </Box>

              <Typography sx={{ fontSize: 24 }}>›</Typography>
            </Button>

            <Button
              fullWidth
              variant="outlined"
              onClick={() => setRegistrationMode("external")}
              sx={{
                justifyContent: "space-between",
                textAlign: "left",
                minHeight: 110,
                px: 2.5,
                py: 2,
                borderRadius: 3,
                borderColor: "#F3C4A5",
                color: "#333333",
                textTransform: "none",
                "&:hover": {
                  borderColor: "#FF7A3D",
                  bgcolor: "#FFF9F5",
                },
              }}
            >
              <Box>
                <Typography
                  sx={{
                    fontSize: 17,
                    fontWeight: 800,
                    color: "#E86224",
                  }}
                >
                  SNS・Webから登録する
                </Typography>

                <Typography
                  variant="body2"
                  sx={{
                    mt: 0.75,
                    color: "#666666",
                    lineHeight: 1.7,
                  }}
                >
                  InstagramやYouTubeなどのURLから
                  <br />
                  レシピ情報を取り込みます
                </Typography>
              </Box>

              <Typography sx={{ fontSize: 24 }}>›</Typography>
            </Button>
          </Stack>

          <Box
            sx={{
              mt: 3,
              p: 2,
              borderRadius: 3,
              bgcolor: "#FFFDF3",
              border: "1px solid #F2ECD1",
            }}
          >
            <Typography
              sx={{
                fontSize: 14,
                fontWeight: 800,
                color: "#386B35",
              }}
            >
              まずは最小限だけでOK！
            </Typography>

            <Typography
              variant="body2"
              sx={{
                mt: 1,
                color: "#555555",
                lineHeight: 1.8,
              }}
            >
              ✓ 料理名だけでも保存できます
              <br />
              ✓ 食材・写真・タグなどはあとから追加できます
              <br />✓ 保存したレシピは献立にも使えます
            </Typography>
          </Box>
        </Paper>
      </AppLayout>
    );
  }

  return (
    <AppLayout title="レシピ作成" activeNav="create">
      <Paper sx={{ maxWidth: 720, mx: "auto", mt: 5, p: { xs: 2, sm: 4 } }}>
        <Button
          size="small"
          onClick={() => {
            setRegistrationMode(null);
            setSourceUrlError("");
          }}
          disabled={saving}
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
          ← 登録方法を選び直す
        </Button>

        <Typography variant="h5" fontWeight={800} mb={2}>
          {registrationMode === "manual"
            ? "自分で登録する"
            : "SNS・Webから登録する"}
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
          <Typography fontWeight={900}>🥬 具材（任意）</Typography>
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
          {registrationMode === "external" && (
            <TextField
              label="元コンテンツURL"
              required
              value={sourceUrl}
              onChange={(e) => {
                setSourceUrl(e.target.value);

                if (sourceUrlError) {
                  setSourceUrlError("");
                }
              }}
              placeholder="https://www.instagram.com/reel/..."
              error={!!sourceUrlError}
              helperText={
                sourceUrlError ||
                "YouTube・YouTube Shorts・Instagramの投稿・リールに対応"
              }
              disabled={saving}
            />
          )}
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
