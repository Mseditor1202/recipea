import React, { useEffect, useState } from "react";
import { collection, getDocs, addDoc } from "firebase/firestore";
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

  // 「主食・主菜・副菜・汁物」に変更
  const [staple, setStaple] = useState(""); // 主食
  const [mainDish, setMainDish] = useState(""); // 主菜
  const [sideDish, setSideDish] = useState(""); // 副菜
  const [soup, setSoup] = useState(""); // 汁物

  // メモ
  const [memo, setMemo] = useState("");

  //  全レシピを取得
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

    // 4つすべて必須
    if (!staple || !mainDish || !sideDish || !soup) {
      alert("主食・主菜・副菜・汁物すべて選んでください");
      return;
    }

    await addDoc(collection(db, "dailySets"), {
      name: setName.trim(),
      staple, // 主食
      mainDish, // 主菜
      sideDish, // 副菜
      soup, // 汁物
      memo: memo || "",
      createdAt: new Date(),
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
    <Box sx={{ maxWidth: 550, mx: "auto", mt: 4, px: 2 }}>
      <Typography variant="h5" mb={2}>
        🍱 献立レシピを作成
      </Typography>

      {/* 主食、主菜、副菜の説明 */}
      <MealTypeDescription />

      <Card sx={{ p: 3 }}>
        {/* セット名 */}
        <TextField
          label="セット名（例：和食Aセット）"
          fullWidth
          value={setName}
          onChange={(e) => setSetName(e.target.value)}
          sx={{ mb: 3 }}
        />

        {/* メモ欄 */}
        <TextField
          label="メモ"
          fullWidth
          value={memo}
          onChange={(e) => setMemo(e.target.value)}
          multiline
          minRows={2}
          sx={{ mb: 3 }}
          placeholder="作り置き用 / 高タンパク / 節約デー などメモを書いておくと便利です"
        />

        <Divider sx={{ mb: 3 }} />

        {/* 主食・主菜・副菜・汁物のレシピ選択 */}
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
          onClick={createSet}
        >
          保存する
        </Button>
      </Card>
    </Box>
  );
}
