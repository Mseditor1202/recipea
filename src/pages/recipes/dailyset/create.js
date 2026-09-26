// src/pages/recipes/dailyset/create.js
import AppLayout from "@/components/layout/AppLayout";
import React, { useEffect, useState } from "react";
import {
  collection,
  getDocs,
  addDoc,
  serverTimestamp,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import MealTypeDescription from "@/components/recipes/MealTypeDescription";
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

export default function CreateDailySet() {
  const [recipes, setRecipes] = useState([]);
  const [setName, setSetName] = useState("");

  // 「主食・主菜・副菜・汁物」
  const [staple, setStaple] = useState(""); // 主食
  const [mainDish, setMainDish] = useState(""); // 主菜
  const [sideDish, setSideDish] = useState(""); // 副菜
  const [soup, setSoup] = useState(""); // 汁物

  // メモ
  const [memo, setMemo] = useState("");

  // 全レシピ取得
  useEffect(() => {
    const fetchRecipes = async () => {
      const snap = await getDocs(collection(db, "recipes"));
      const list = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
      setRecipes(list);
    };
    fetchRecipes();
  }, []);

  const createSet = async () => {
    if (!setName.trim()) {
      alert("セット名を入力してください");
      return;
    }

    // ✅ 4つ必須チェックは削除（空欄OK思想）
    await addDoc(collection(db, "dailySets"), {
      name: setName.trim(),
      staple: staple || null,
      mainDish: mainDish || null,
      sideDish: sideDish || null,
      soup: soup || null,
      memo: memo || "",
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });

    alert("レシピセットを作成しました！");

    // 入力内容クリア
    setSetName("");
    setStaple("");
    setMainDish("");
    setSideDish("");
    setSoup("");
    setMemo("");
  };

  return (
    <AppLayout title="献立レシピセット作成" activeNav="meal">
      <Box sx={{ maxWidth: 550, mx: "auto", mt: 4, px: 2 }}>
        <Typography variant="h5" mb={2} sx={{ fontWeight: 900 }}>
          🍱 献立レシピを作成
        </Typography>

        <MealTypeDescription />

        <Card sx={{ p: 3, borderRadius: 3 }}>
          <TextField
            label="セット名（例：和食Aセット）"
            fullWidth
            value={setName}
            onChange={(e) => setSetName(e.target.value)}
            sx={{ mb: 3 }}
          />

          <TextField
            label="メモ"
            fullWidth
            value={memo}
            onChange={(e) => setMemo(e.target.value)}
            multiline
            minRows={2}
            sx={{ mb: 3 }}
            placeholder="作り置き用 / 高タンパク / 節約デー など"
          />

          <Divider sx={{ mb: 3 }} />

          <Stack spacing={2}>
            {[
              { label: "主食", value: staple, setter: setStaple },
              { label: "主菜", value: mainDish, setter: setMainDish },
              { label: "副菜", value: sideDish, setter: setSideDish },
              { label: "汁物", value: soup, setter: setSoup },
            ].map((item, idx) => (
              <TextField
                key={idx}
                select
                label={item.label}
                value={item.value}
                onChange={(e) => item.setter(e.target.value)}
                fullWidth
                helperText="未設定（空欄）でもOK"
              >
                <MenuItem value="">未設定（空欄）</MenuItem>
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
            sx={{ mt: 3, py: 1.2, fontWeight: 900, borderRadius: 2 }}
            onClick={createSet}
          >
            保存する
          </Button>
        </Card>
      </Box>
    </AppLayout>
  );
}
