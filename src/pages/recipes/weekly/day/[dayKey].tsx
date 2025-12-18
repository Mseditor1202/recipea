// pages/recipes/weekly/day/[dayKey].jsx
import React, { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/router";
import {
  Box,
  Button,
  Card,
  CardContent,
  Grid,
  IconButton,
  MenuItem,
  Stack,
  TextField,
  Typography,
} from "@mui/material";
import ArrowBackIosNewIcon from "@mui/icons-material/ArrowBackIosNew";
import {
  collection,
  getDocs,
  doc,
  getDoc,
  setDoc,
  serverTimestamp,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import MealTypeDescription from "@/components/recipes/MealTypeDescription";

const DEFAULT_IMAGE = "/images/default-recipe.png";

// 各時間帯の空テンプレ
const EMPTY_SLOTS = {
  staple: "",
  main: "",
  side: "",
  soup: "",
};

/** 1つの枠（主菜・副菜など）のカード */
function RecipeSlotCard({ label, color, recipe, onClick }) {
  const title = recipe?.recipeName ?? "未設定";

  return (
    <Box
      sx={{
        borderRadius: 2,
        overflow: "hidden",
        bgcolor: "#fff",
        border: "1px solid #eee0cc",
        boxShadow: "0 6px 16px rgba(0, 0, 0, 0.06)",
        display: "flex",
        flexDirection: "column",
      }}
    >
      {/* 画像 + ラベル */}
      <Box sx={{ position: "relative", height: 120 }}>
        <Box
          component="img"
          src={recipe?.imageUrl || DEFAULT_IMAGE}
          alt={title}
          sx={{ width: "100%", height: "100%", objectFit: "cover" }}
        />
        <Box
          sx={{
            position: "absolute",
            top: 8,
            left: 8,
            px: 1,
            py: 0.2,
            borderRadius: "999px",
            fontSize: 11,
            fontWeight: 700,
            bgcolor: "#fff",
            color,
            border: `1px solid ${color}`,
          }}
        >
          {label}
        </Box>
      </Box>

      {/* 料理名 + 変更ボタン */}
      <Box sx={{ p: 1, pb: 1.1 }}>
        <Typography
          variant="body2"
          sx={{
            fontSize: 12,
            minHeight: "2.6em",
            lineHeight: 1.3,
          }}
          color={recipe ? "text.primary" : "text.disabled"}
        >
          {title}
        </Typography>

        <Button
          variant="text"
          size="small"
          onClick={onClick}
          sx={{
            mt: 0.4,
            textTransform: "none",
            fontSize: 11,
            color: "#ff7043",
          }}
        >
          {recipe ? "変更する" : "追加する"}
        </Button>
      </Box>
    </Box>
  );
}

/** 朝・昼・夜 1ブロック分（見出し＋主食/主菜/副菜/汁物） */
function MealSection({
  title,
  hint,
  slotState,
  onChangeSlot,
  recipes,
  onClickSlot,
}) {
  const recipeMap = useMemo(() => {
    const m = {};
    recipes.forEach((r) => {
      m[r.id] = r;
    });
    return m;
  }, [recipes]);

  const slots = [
    {
      key: "main",
      label: "主菜",
      color: "#e53935",
      value: slotState.main,
    },
    {
      key: "side",
      label: "副菜",
      color: "#43a047",
      value: slotState.side,
    },
    {
      key: "staple",
      label: "主食",
      color: "#f5a623",
      value: slotState.staple,
    },
    {
      key: "soup",
      label: "汁物",
      color: "#fb8c00",
      value: slotState.soup,
    },
  ];

  return (
    <Card
      sx={{
        mb: 3,
        borderRadius: 3,
        boxShadow: "0 10px 26px rgba(0, 0, 0, 0.06)",
      }}
    >
      <CardContent sx={{ pb: 2.5 }}>
        {/* 見出し */}
        <Stack
          direction="row"
          alignItems="baseline"
          spacing={1.5}
          sx={{ mb: 1.5 }}
        >
          <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>
            {title}
          </Typography>
          <Typography variant="body2" color="text.secondary">
            {hint}
          </Typography>
        </Stack>

        {/* 主菜・副菜・主食・汁物 カード横並び */}
        <Grid container spacing={1.5} sx={{ mb: 2 }}>
          {slots.map((slot) => (
            <Grid item xs={6} sm={3} key={slot.key}>
              <RecipeSlotCard
                label={slot.label}
                color={slot.color}
                recipe={slot.value ? recipeMap[slot.value] ?? null : null}
                onClick={() => onClickSlot(slot.key)}
              />
            </Grid>
          ))}
        </Grid>

        {/* 下に選択用セレクト（実際の登録用） */}
        <Stack spacing={1.5}>
          {slots.map((slot) => (
            <TextField
              key={slot.key}
              select
              fullWidth
              size="small"
              label={`${slot.label}レシピ`}
              value={slot.value}
              onChange={(e) => onChangeSlot(slot.key, e.target.value)}
            >
              <MenuItem value="">
                <em>未選択</em>
              </MenuItem>
              {recipes.map((r) => (
                <MenuItem key={r.id} value={r.id}>
                  {r.recipeName}
                </MenuItem>
              ))}
            </TextField>
          ))}
        </Stack>
      </CardContent>
    </Card>
  );
}

/** この日の週間献立 詳細編集ページ */
export default function WeeklyDayDetailPage() {
  const router = useRouter();
  const { dayKey, meal, slot, recipeId } = router.query; // 例: "2025-12-01"

  // dayKey は配列で来ることもあるので正規化
  const dayKeyStr = useMemo(
    () => (Array.isArray(dayKey) ? dayKey[0] : dayKey || ""),
    [dayKey]
  );

  const [recipes, setRecipes] = useState([]);

  // 朝・昼・夜それぞれの枠ごとの状態
  const [breakfast, setBreakfast] = useState({ ...EMPTY_SLOTS });
  const [lunch, setLunch] = useState({ ...EMPTY_SLOTS });
  const [dinner, setDinner] = useState({ ...EMPTY_SLOTS });

  // ① レシピ一覧取得
  useEffect(() => {
    const fetchRecipes = async () => {
      const snap = await getDocs(collection(db, "recipes"));
      const list = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
      setRecipes(list);
    };
    fetchRecipes();
  }, []);

  // ② Firestore からこの日の breakfast/lunch/dinner を読み込み
  useEffect(() => {
    if (!dayKeyStr) return;

    const loadDayData = async () => {
      try {
        const ref = doc(db, "weeklyDaySets", dayKeyStr);
        const snap = await getDoc(ref);
        if (!snap.exists()) return;

        const data = snap.data();
        setBreakfast(data.breakfast || { ...EMPTY_SLOTS });
        setLunch(data.lunch || { ...EMPTY_SLOTS });
        setDinner(data.dinner || { ...EMPTY_SLOTS });
      } catch (e) {
        console.error("weeklyDaySets 読み込みエラー", e);
      }
    };

    loadDayData();
  }, [dayKeyStr]);

  // ③ /recipes から戻ってきたときに state に反映
  useEffect(() => {
    if (!recipeId || !meal || !slot || !dayKeyStr) return;

    const mealStr = Array.isArray(meal) ? meal[0] : meal;
    const slotParam = Array.isArray(slot) ? slot[0] : slot;
    const recipeIdStr = Array.isArray(recipeId) ? recipeId[0] : recipeId;

    // slotParam(mainDish/sideDish/staple/soup) → ローカルのキー(main/side/staple/soup)
    let localSlotKey = slotParam;
    if (slotParam === "mainDish") localSlotKey = "main";
    if (slotParam === "sideDish") localSlotKey = "side";

    const updater = (prev) => ({
      ...prev,
      [localSlotKey]: recipeIdStr,
    });

    if (mealStr === "breakfast") {
      setBreakfast(updater);
    } else if (mealStr === "lunch") {
      setLunch(updater);
    } else if (mealStr === "dinner") {
      setDinner(updater);
    }

    // クエリが残り続けると再度 useEffect が走るので、クエリだけ消しておく（shallow）
    router.replace(
      {
        pathname: `/recipes/weekly/day/${dayKeyStr}`,
        query: {},
      },
      undefined,
      { shallow: true }
    );
  }, [dayKeyStr, meal, slot, recipeId, router]);

  // ヘッダーの日付表示用
  const headerLabel = useMemo(() => {
    if (!dayKeyStr) return "";
    const d = new Date(`${dayKeyStr}T00:00:00+09:00`);
    if (Number.isNaN(d.getTime())) return dayKeyStr;
    const wList = ["日", "月", "火", "水", "木", "金", "土"];
    const w = wList[d.getDay()];
    const m = d.getMonth() + 1;
    const day = d.getDate();
    return `${String(m).padStart(2, "0")}/${String(day).padStart(
      2,
      "0"
    )}(${w})`;
  }, [dayKeyStr]);

  // 追加/変更ボタンから /recipes に飛ばす
  const handleSelectFromRecipes = (mealType, slotKey) => {
    if (!dayKeyStr) return;

    // ローカルキー(main/side/staple/soup) → recipesページ用(mainDish/sideDish/staple/soup)
    let slotParam = slotKey;
    if (slotKey === "main") slotParam = "mainDish";
    if (slotKey === "side") slotParam = "sideDish";

    router.push(
      `/recipes?mode=weeklyDay&dayKey=${dayKeyStr}&meal=${mealType}&slot=${slotParam}`
    );
  };

  // ④ Firestore に保存
  const handleSave = async () => {
    if (!dayKeyStr) {
      alert("日付情報が取得できませんでした。");
      return;
    }

    try {
      await setDoc(
        doc(db, "weeklyDaySets", dayKeyStr),
        {
          breakfast,
          lunch,
          dinner,
          updatedAt: serverTimestamp(),
        },
        { merge: true }
      );

      alert("この日の献立セットを保存しました。");
    } catch (e) {
      console.error("weeklyDaySets 保存エラー", e);
      alert("保存中にエラーが発生しました。");
    }
  };

  return (
    <Box
      sx={{
        maxWidth: 1000,
        mx: "auto",
        px: { xs: 2, sm: 3 },
        py: 3,
      }}
    >
      {/* 上部ヘッダー（←前の画面 / 日付） */}
      <Stack direction="row" alignItems="center" spacing={1.5} sx={{ mb: 2 }}>
        <IconButton onClick={() => router.back()} size="small">
          <ArrowBackIosNewIcon fontSize="small" />
        </IconButton>
        <Box>
          <Typography variant="h6" sx={{ fontWeight: 700 }}>
            献立編集
          </Typography>
          {headerLabel && (
            <Typography variant="body2" color="text.secondary">
              {headerLabel} の朝・昼・夜の献立セット
            </Typography>
          )}
        </Box>
      </Stack>

      {/* 主食 / 主菜 / 副菜 / 汁物の解説（既存コンポーネント） */}
      <MealTypeDescription />

      {/* 朝の献立セット */}
      <MealSection
        title="朝の献立セット"
        hint="（例：パンの日、さっと作れる朝ごはん など）"
        slotState={breakfast}
        onChangeSlot={(k, v) =>
          setBreakfast((prev) => ({
            ...prev,
            [k]: v,
          }))
        }
        recipes={recipes}
        onClickSlot={(slotKey) => handleSelectFromRecipes("breakfast", slotKey)}
      />

      {/* 昼の献立セット */}
      <MealSection
        title="昼の献立セット"
        hint="（例：丼ものの日、テレワークのお昼 など）"
        slotState={lunch}
        onChangeSlot={(k, v) =>
          setLunch((prev) => ({
            ...prev,
            [k]: v,
          }))
        }
        recipes={recipes}
        onClickSlot={(slotKey) => handleSelectFromRecipes("lunch", slotKey)}
      />

      {/* 夜の献立セット */}
      <MealSection
        title="夜の献立セット"
        hint="（例：鍋の日、カレーの日 など）"
        slotState={dinner}
        onChangeSlot={(k, v) =>
          setDinner((prev) => ({
            ...prev,
            [k]: v,
          }))
        }
        recipes={recipes}
        onClickSlot={(slotKey) => handleSelectFromRecipes("dinner", slotKey)}
      />

      {/* 下部のアクションボタン */}
      <Stack
        direction={{ xs: "column", sm: "row" }}
        spacing={1.5}
        sx={{ mt: 2 }}
      >
        <Button
          variant="contained"
          fullWidth
          sx={{ py: 1.2 }}
          onClick={handleSave}
        >
          この日の献立セットを保存
        </Button>
        <Button variant="text" fullWidth onClick={() => router.back()}>
          戻る
        </Button>
      </Stack>
    </Box>
  );
}
