import React, { useEffect, useState } from "react";
import { useRouter } from "next/router";
import {
  doc,
  getDoc,
  getDocs,
  updateDoc,
  collection,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import {
  Box,
  TextField,
  Button,
  MenuItem,
  Typography,
  Card,
  Stack,
  Divider,
} from "@mui/material";

export default function EditDailySet() {
  const router = useRouter();
  const { id } = router.query;

  const [recipes, setRecipes] = useState([]);
  const [loading, setLoading] = useState(true);

  const [setName, setSetName] = useState("");
  const [breakfast, setBreakfast] = useState("");
  const [lunch, setLunch] = useState("");
  const [dinner, setDinner] = useState("");

  // レシピ一覧 & 日次セットの読み込み
  useEffect(() => {
    if (!id) return;

    const fetchData = async () => {
      // レシピ一覧
      const recipeSnap = await getDocs(collection(db, "recipes"));
      const recipeList = recipeSnap.docs.map((d) => ({
        id: d.id,
        ...d.data(),
      }));
      setRecipes(recipeList);

      // 編集対象セット
      const ref = doc(db, "dailySets", id);
      const snap = await getDoc(ref);

      if (!snap.exists()) {
        alert("セットが見つかりませんでした");
        router.push("/recipes/dailyset");
        return;
      }

      const data = snap.data();
      setSetName(data.name || "");
      setBreakfast(data.breakfast || "");
      setLunch(data.lunch || "");
      setDinner(data.dinner || "");
      setLoading(false);
    };

    fetchData();
  }, [id, router]);

  const handleUpdate = async () => {
    if (!setName.trim()) {
      alert("セット名を入力してください");
      return;
    }
    if (!breakfast || !lunch || !dinner) {
      alert("朝・昼・夜すべてのレシピを選択してください");
      return;
    }

    await updateDoc(doc(db, "dailySets", id), {
      name: setName.trim(),
      breakfast,
      lunch,
      dinner,
      updatedAt: new Date(),
    });

    alert("セットを更新しました");
    router.push("/recipes/dailyset");
  };

  if (loading) {
    return (
      <Box sx={{ mt: 4, textAlign: "center" }}>
        <Typography>セットを読み込んでいます…</Typography>
      </Box>
    );
  }

  return (
    <Box sx={{ maxWidth: 550, mx: "auto", mt: 4, px: 2 }}>
      <Typography variant="h5" mb={2}>
        ✏️ 1日レシピセットを編集
      </Typography>

      <Card sx={{ p: 3 }}>
        <TextField
          label="セット名"
          fullWidth
          value={setName}
          onChange={(e) => setSetName(e.target.value)}
          sx={{ mb: 3 }}
        />

        <Divider sx={{ mb: 3 }} />

        <Stack spacing={2}>
          {[
            { label: "朝食レシピ", value: breakfast, setter: setBreakfast },
            { label: "昼食レシピ", value: lunch, setter: setLunch },
            { label: "夕食レシピ", value: dinner, setter: setDinner },
          ].map((item, idx) => (
            <TextField
              key={idx}
              select
              label={item.label}
              value={item.value}
              onChange={(e) => item.setter(e.target.value)}
              fullWidth
            >
              {recipes.map((r) => (
                <MenuItem key={r.id} value={r.id}>
                  {r.recipeName}
                </MenuItem>
              ))}
            </TextField>
          ))}
        </Stack>

        <Button
          variant="contained"
          fullWidth
          sx={{ mt: 3, py: 1.2 }}
          onClick={handleUpdate}
        >
          更新する
        </Button>

        <Button
          sx={{ mt: 1 }}
          fullWidth
          onClick={() => router.push("/recipes/dailyset")}
        >
          戻る
        </Button>
      </Card>
    </Box>
  );
}
