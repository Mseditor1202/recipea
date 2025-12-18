import React, { useEffect, useState, useMemo } from "react";
import { useRouter } from "next/router";
import {
  doc,
  getDoc,
  updateDoc,
  getDocs,
  collection,
} from "firebase/firestore";
import { db } from "@/lib/firebase";

import { Box, Typography, Card, Button } from "@mui/material";

const DEFAULT_IMAGE = "/images/default-recipe.png";

// 朝昼夜の表示ラベル
const MEAL_LABEL = {
  breakfast: "朝",
  lunch: "昼",
  dinner: "夜",
};

// 主食4枠の表示ラベル
const SLOT_LABEL = {
  staple: "主食",
  mainDish: "主菜",
  sideDish: "副菜",
  soup: "汁物",
};

export default function EditDailySet() {
  const router = useRouter();
  const { id, meal, slot, recipeId } = router.query;

  const dailySetId = Array.isArray(id) ? id[0] : id;

  const [recipes, setRecipes] = useState([]);
  const [setName, setSetName] = useState("");

  const [dailyData, setDailyData] = useState({
    breakfast: "",
    lunch: "",
    dinner: "",
    staple: "",
    mainDish: "",
    sideDish: "",
    soup: "",
  });

  const [loading, setLoading] = useState(true);

  // ▼ レシピ + dailySet 読み込み
  useEffect(() => {
    if (!dailySetId) return;

    const fetchData = async () => {
      const recipeSnap = await getDocs(collection(db, "recipes"));
      setRecipes(recipeSnap.docs.map((d) => ({ id: d.id, ...d.data() })));

      const snap = await getDoc(doc(db, "dailySets", dailySetId));
      if (!snap.exists()) {
        alert("献立レシピセットが見つかりません");
        router.push("/recipes/dailyset");
        return;
      }

      const data = snap.data();

      setSetName(data.name || "");
      setDailyData({
        breakfast: data.breakfast || "",
        lunch: data.lunch || "",
        dinner: data.dinner || "",
        staple: data.staple || "",
        mainDish: data.mainDish || "",
        sideDish: data.sideDish || "",
        soup: data.soup || "",
      });

      setLoading(false);
    };

    fetchData();
  }, [dailySetId]);

  // ▼ recipeMap
  const recipeMap = useMemo(() => {
    const m = {};
    recipes.forEach((r) => (m[r.id] = r));
    return m;
  }, [recipes]);

  // ▼ 選択後（recipeId がURLに来たら更新）
  useEffect(() => {
    if (!recipeId || !slot) return;

    const update = async () => {
      await updateDoc(doc(db, "dailySets", dailySetId), {
        [slot]: recipeId,
      });

      // 更新後：slot を維持して戻す
      router.replace(
        `/recipes/dailyset/${dailySetId}?meal=${meal}&slot=${slot}`
      );
    };

    update();
  }, [recipeId, slot, meal]);

  if (loading) return <Typography>読み込み中...</Typography>;

  // ▼ 今のスロットのレシピID
  const currentRecipeId = dailyData[slot];
  const recipe = recipeMap[currentRecipeId];

  // ▼ 選択画面へ飛ぶ
  const goSelectRecipe = () => {
    router.push(
      `/recipes?mode=dailyMeal&meal=${meal}&slot=${slot}&dailySetId=${dailySetId}`
    );
  };

  return (
    <Box sx={{ maxWidth: 700, mx: "auto", mt: 4 }}>
      <Typography variant="h5" mb={2}>
        ✏️ {MEAL_LABEL[meal]} — {SLOT_LABEL[slot]} のレシピを編集
      </Typography>

      <Card sx={{ p: 2 }}>
        <Typography variant="subtitle1" fontWeight={700} mb={1}>
          現在のレシピ
        </Typography>

        <Box sx={{ borderRadius: 2, overflow: "hidden", height: 150 }}>
          <img
            src={recipe?.imageUrl || DEFAULT_IMAGE}
            alt=""
            style={{ width: "100%", height: "100%", objectFit: "cover" }}
          />
        </Box>

        <Typography sx={{ mt: 1, fontWeight: 600 }}>
          {recipe?.recipeName || "未選択"}
        </Typography>

        <Button variant="outlined" sx={{ mt: 2 }} onClick={goSelectRecipe}>
          {recipe ? "変更する" : "追加する"}
        </Button>
      </Card>
    </Box>
  );
}
