import React, { useState } from "react";
import { addDoc, collection } from "firebase/firestore";
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
} from "@mui/material";
import {
  AddCircleOutline,
  RemoveCircleOutline,
  CloudUpload,
} from "@mui/icons-material";

import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
import { db, storage } from "@/lib/firebase";

export default function CreateRecipe() {
  const router = useRouter();
  const { user } = useRequireAuth();

  const [recipeName, setRecipeName] = useState("");

  // 🔹 具材と調味料を分離
  const [ingredients, setIngredients] = useState([{ name: "", quantity: "" }]);
  const [seasonings, setSeasonings] = useState([{ name: "", quantity: "" }]);

  const [imageFile, setImageFile] = useState(null);
  const [previewUrl, setPreviewUrl] = useState("");
  const [calories, setCalories] = useState("");
  const [cookingTime, setCookingTime] = useState("");
  const [videoUrl, setVideoUrl] = useState("");
  const [category, setCategory] = useState("main");

  // === 具材の操作 ===
  const handleAddIngredient = () => {
    setIngredients([...ingredients, { name: "", quantity: "" }]);
  };

  const handleRemoveIngredient = (index) => {
    const newList = ingredients.filter((_, i) => i !== index);
    setIngredients(newList.length > 0 ? newList : [{ name: "", quantity: "" }]);
  };

  const handleIngredientChange = (index, field, value) => {
    const newList = [...ingredients];
    newList[index][field] = value;
    setIngredients(newList);
  };

  // === 調味料の操作 ===
  const handleAddSeasoning = () => {
    setSeasonings([...seasonings, { name: "", quantity: "" }]);
  };

  const handleRemoveSeasoning = (index) => {
    const newList = seasonings.filter((_, i) => i !== index);
    setSeasonings(newList.length > 0 ? newList : [{ name: "", quantity: "" }]);
  };

  const handleSeasoningChange = (index, field, value) => {
    const newList = [...seasonings];
    newList[index][field] = value;
    setSeasonings(newList);
  };

  // 画像選択処理
  const handleImageSelect = (e) => {
    const file = e.target.files && e.target.files[0];
    if (file) {
      setImageFile(file);
      setPreviewUrl(URL.createObjectURL(file));
    }
  };

  const uploadImage = async () => {
    if (!imageFile || !user) return "";

    const safeName = imageFile.name.replace(/\s+/g, "_");
    const path = `recipes/${user.uid}/${Date.now()}_${safeName}`;

    const storageRef = ref(storage, path);
    await uploadBytes(storageRef, imageFile);
    const downloadUrl = await getDownloadURL(storageRef);
    return downloadUrl;
  };

  const createRecipe = async () => {
    if (!user) {
      alert("user が取得できていません");
      return;
    }

    if (!recipeName.trim()) {
      alert("レシピ名を入力してください");
      return;
    }

    // 🔹 空行を除いた有効データだけにする
    const validIngredients = ingredients.filter(
      (ing) => ing.name.trim() && ing.quantity.trim()
    );
    const validSeasonings = seasonings.filter(
      (s) => s.name.trim() && s.quantity.trim()
    );

    if (validIngredients.length === 0) {
      alert("具材を1つ以上登録してください");
      return;
    }

    try {
      let imageUrl = "";
      if (imageFile) {
        imageUrl = await uploadImage();
      }

      await addDoc(collection(db, "recipes"), {
        recipeName,
        ingredients: validIngredients, // ← 具材
        seasonings: validSeasonings, // ← 調味料（0件なら []）
        imageUrl,
        authorId: user.uid,
        createdAt: new Date(),
        calories: calories ? Number(calories) : null,
        cookingTime: cookingTime ? Number(cookingTime) : null,
        category,
        videoUrl: videoUrl || null,
      });

      alert("レシピを登録しました");
      router.push("/recipes");
    } catch (err) {
      console.error("登録エラー:", err);
      alert(`登録に失敗しました: ${err.message ?? err}`);
    }
  };

  return (
    <Paper
      elevation={3}
      sx={{ maxWidth: 600, mx: "auto", mt: 5, p: 4, borderRadius: 2 }}
    >
      <Typography variant="h5" mb={3}>
        🍳 レシピを登録する
      </Typography>

      {/* レシピ名 */}
      <TextField
        label="レシピ名"
        variant="outlined"
        fullWidth
        value={recipeName}
        onChange={(e) => setRecipeName(e.target.value)}
        sx={{ mb: 3 }}
      />

      {/* 画像アップロード */}
      <Stack direction="row" spacing={2} alignItems="center" sx={{ mb: 3 }}>
        <Button
          variant="contained"
          component="label"
          startIcon={<CloudUpload />}
        >
          画像を選択
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
            }}
          />
        )}
      </Stack>

      {/* 具材欄 */}
      <Typography variant="h6" mb={1}>
        具材一覧
      </Typography>

      {ingredients.map((ingredient, index) => (
        <Stack
          key={`ing-${index}`}
          direction="row"
          spacing={2}
          alignItems="center"
          sx={{ mb: 2 }}
        >
          <TextField
            label="具材名"
            variant="outlined"
            fullWidth
            value={ingredient.name}
            onChange={(e) =>
              handleIngredientChange(index, "name", e.target.value)
            }
          />
          <TextField
            label="量（g・個など）"
            variant="outlined"
            fullWidth
            value={ingredient.quantity}
            onChange={(e) =>
              handleIngredientChange(index, "quantity", e.target.value)
            }
          />
          <IconButton
            color="error"
            onClick={() => handleRemoveIngredient(index)}
            disabled={ingredients.length === 1}
          >
            <RemoveCircleOutline />
          </IconButton>
        </Stack>
      ))}

      <Button
        variant="outlined"
        startIcon={<AddCircleOutline />}
        onClick={handleAddIngredient}
        sx={{ mb: 3 }}
      >
        具材を追加
      </Button>

      {/* 調味料欄 */}
      <Typography variant="h6" mb={1}>
        調味料一覧
      </Typography>

      {seasonings.map((seasoning, index) => (
        <Stack
          key={`sea-${index}`}
          direction="row"
          spacing={2}
          alignItems="center"
          sx={{ mb: 2 }}
        >
          <TextField
            label="調味料名"
            variant="outlined"
            fullWidth
            value={seasoning.name}
            onChange={(e) =>
              handleSeasoningChange(index, "name", e.target.value)
            }
          />
          <TextField
            label="量（小さじ・大さじなど）"
            variant="outlined"
            fullWidth
            value={seasoning.quantity}
            onChange={(e) =>
              handleSeasoningChange(index, "quantity", e.target.value)
            }
          />
          <IconButton
            color="error"
            onClick={() => handleRemoveSeasoning(index)}
            disabled={seasonings.length === 1}
          >
            <RemoveCircleOutline />
          </IconButton>
        </Stack>
      ))}

      <Button
        variant="outlined"
        startIcon={<AddCircleOutline />}
        onClick={handleAddSeasoning}
        sx={{ mb: 3 }}
      >
        調味料を追加
      </Button>

      {/* レシピ全体の情報 */}
      <Typography variant="h6" mb={1}>
        レシピ情報
      </Typography>
      <FormControl component="fieldset" sx={{ mb: 3 }}>
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
        />
        <TextField
          label="調理時間 (分)"
          type="number"
          value={cookingTime}
          onChange={(e) => setCookingTime(e.target.value)}
          fullWidth
        />
        <TextField
          label="動画URL"
          value={videoUrl}
          onChange={(e) => setVideoUrl(e.target.value)}
          fullWidth
          placeholder="https://www.youtube.com/watch?v=..."
        />
      </Stack>

      <Box textAlign="center">
        <Button
          variant="contained"
          color="primary"
          onClick={createRecipe}
          sx={{ px: 5 }}
        >
          登録する
        </Button>
      </Box>
    </Paper>
  );
}
