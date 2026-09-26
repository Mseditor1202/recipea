// pages/recipes/weekly/zubora.jsx
import AppLayout from "@/components/layout/AppLayout";
import React, { useEffect, useMemo, useState } from "react";
import NextLink from "next/link";
import {
  Box,
  Stack,
  Typography,
  Card,
  CardContent,
  Divider,
  Button,
  TextField,
  Drawer,
  List,
  ListItemButton,
  ListItemText,
  InputAdornment,
  Chip,
  FormControlLabel,
  Switch,
  Alert,
} from "@mui/material";
import SearchIcon from "@mui/icons-material/Search";
import { Add } from "@mui/icons-material";
import {
  doc,
  getDoc,
  getDocs,
  collection,
  setDoc,
  serverTimestamp,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import RecipeImage from "@/components/recipes/RecipeImage";

/** ===============================
 * ✅ ズボラ用セットの固定ドキュメントID
 * - home側が参照しやすいよう固定にする
 =============================== */
const ZUBORA_DOC_ID = "zuboraTemplate";

/** ===============================
 * meta
 =============================== */
const MEALS = [
  { key: "breakfast", label: "朝", icon: "🍞" },
  { key: "lunch", label: "昼", icon: "🍜" },
  { key: "dinner", label: "夜", icon: "🍽️" },
];

const SLOTS = [
  { key: "staple", label: "主食" },
  { key: "main", label: "主菜" },
  { key: "side", label: "副菜" },
  { key: "soup", label: "汁物" },
];

function emptyMeal() {
  return { staple: null, main: null, side: null, soup: null };
}

function ensureTemplateDoc(data) {
  return {
    breakfast: data?.breakfast
      ? { ...emptyMeal(), ...data.breakfast }
      : emptyMeal(),
    lunch: data?.lunch ? { ...emptyMeal(), ...data.lunch } : emptyMeal(),
    dinner: data?.dinner ? { ...emptyMeal(), ...data.dinner } : emptyMeal(),
    memo: data?.memo || "",
  };
}

/** ✅ category の揺れ吸収（Drawer絞り込み用） */
function normalizeCategory(cat) {
  if (!cat) return "";
  const c = String(cat).toLowerCase();

  if (c === "staple") return "staple";
  if (c === "main" || c === "maindish") return "main";
  if (c === "side" || c === "sidedish") return "side";
  if (c === "soup") return "soup";

  if (c.includes("staple")) return "staple";
  if (c.includes("main")) return "main";
  if (c.includes("side")) return "side";
  if (c.includes("soup")) return "soup";

  return c;
}

export default function ZuboraTemplatePage() {
  // 状態
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  const [saveMsg, setSaveMsg] = useState("");

  const [tplDoc, setTplDoc] = useState(ensureTemplateDoc(null));

  // recipes
  const [recipeList, setRecipeList] = useState([]);
  const [recipeMap, setRecipeMap] = useState({});

  // Drawer
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [picker, setPicker] = useState({
    meal: null,
    slot: null,
  });
  const [pickerSearch, setPickerSearch] = useState("");
  const [useCategoryFilter, setUseCategoryFilter] = useState(true);

  // 初回：recipes + zubora template 読み込み
  useEffect(() => {
    const run = async () => {
      setLoading(true);
      setErrorMsg("");
      setSaveMsg("");

      try {
        // 1) recipes
        const rSnap = await getDocs(collection(db, "recipes"));
        const list = rSnap.docs.map((d) => ({ id: d.id, ...d.data() }));
        const map = {};
        list.forEach((r) => (map[r.id] = r));
        setRecipeList(list);
        setRecipeMap(map);

        // 2) template doc
        const ref = doc(db, "weeklyDaySets", ZUBORA_DOC_ID);
        const snap = await getDoc(ref);
        if (snap.exists()) setTplDoc(ensureTemplateDoc(snap.data()));
        else setTplDoc(ensureTemplateDoc(null));
      } catch (e) {
        console.error(e);
        setErrorMsg("読み込みに失敗しました。");
      } finally {
        setLoading(false);
      }
    };

    run();
  }, []);

  // 表示用
  const getRecipeName = (id) => recipeMap?.[id]?.recipeName || "未設定";
  const getRecipeImg = (id) => recipeMap?.[id]?.imageUrl || "";

  // Drawer
  const openPicker = (meal, slot) => {
    setPicker({ meal, slot });
    setPickerSearch("");
    setUseCategoryFilter(true);
    setDrawerOpen(true);
  };
  const closePicker = () => setDrawerOpen(false);

  const pickerTitle = useMemo(() => {
    if (!picker.meal || !picker.slot) return "レシピを選択";
    const m = MEALS.find((x) => x.key === picker.meal)?.label || "";
    const s = SLOTS.find((x) => x.key === picker.slot)?.label || "";
    return `${m} / ${s} を変更`;
  }, [picker.meal, picker.slot]);

  // Drawer filter
  const pickerFiltered = useMemo(() => {
    let list = recipeList;

    const q = (pickerSearch || "").trim().toLowerCase();
    if (q) {
      list = list.filter((r) => (r.recipeName || "").toLowerCase().includes(q));
    }

    if (useCategoryFilter && picker.slot) {
      const filteredByCat = list.filter((r) => {
        const cat = normalizeCategory(r.category);
        return !r.category || cat === picker.slot;
      });
      if (filteredByCat.length === 0) return list; // 0件なら全件
      return filteredByCat;
    }

    return list;
  }, [recipeList, pickerSearch, picker.slot, useCategoryFilter]);

  /** ===============================
   * ✅ レシピ選択 → template doc に保存
   =============================== */
  const handlePickRecipe = async (recipeId) => {
    if (!picker?.meal || !picker?.slot) return;

    setErrorMsg("");
    setSaveMsg("");

    try {
      setSaving(true);

      // 即反映
      setTplDoc((prev) => ({
        ...prev,
        [picker.meal]: { ...prev[picker.meal], [picker.slot]: recipeId },
      }));

      await setDoc(
        doc(db, "weeklyDaySets", ZUBORA_DOC_ID),
        {
          [picker.meal]: { [picker.slot]: recipeId },
          updatedAt: serverTimestamp(),
        },
        { merge: true },
      );

      setSaveMsg("ズボラ用セットを更新しました。");
      closePicker();
    } catch (e) {
      console.error(e);
      setErrorMsg("レシピのセットに失敗しました。");
    } finally {
      setSaving(false);
    }
  };

  /** ===============================
   * ✅ meal単位の削除（4枠null）
   =============================== */
  const handleClearMeal = async (mealKey) => {
    setErrorMsg("");
    setSaveMsg("");

    const cleared = emptyMeal();

    // 即反映
    setTplDoc((prev) => ({ ...prev, [mealKey]: cleared }));

    try {
      setSaving(true);
      await setDoc(
        doc(db, "weeklyDaySets", ZUBORA_DOC_ID),
        {
          [mealKey]: cleared,
          updatedAt: serverTimestamp(),
        },
        { merge: true },
      );

      const label = MEALS.find((m) => m.key === mealKey)?.label || mealKey;
      setSaveMsg(`${label} の献立を削除しました。`);
    } catch (e) {
      console.error(e);
      setErrorMsg("削除に失敗しました。");
    } finally {
      setSaving(false);
    }
  };

  /** ===============================
   * ✅ メモ保存
   =============================== */
  const handleSaveMemo = async () => {
    setErrorMsg("");
    setSaveMsg("");

    try {
      setSaving(true);
      await setDoc(
        doc(db, "weeklyDaySets", ZUBORA_DOC_ID),
        { memo: tplDoc.memo || "", updatedAt: serverTimestamp() },
        { merge: true },
      );
      setSaveMsg("メモを保存しました。");
    } catch (e) {
      console.error(e);
      setErrorMsg("メモ保存に失敗しました。");
    } finally {
      setSaving(false);
    }
  };

  /** ===============================
   * ✅ 全体保存（まとめて保存したい派向け）
   * - 変更ボタン連打しても最後に一括保存できるように残しておくと安心
   =============================== */
  const handleSaveAll = async () => {
    setErrorMsg("");
    setSaveMsg("");

    try {
      setSaving(true);
      await setDoc(
        doc(db, "weeklyDaySets", ZUBORA_DOC_ID),
        {
          breakfast: tplDoc.breakfast,
          lunch: tplDoc.lunch,
          dinner: tplDoc.dinner,
          memo: tplDoc.memo || "",
          updatedAt: serverTimestamp(),
        },
        { merge: true },
      );
      setSaveMsg("ズボラ用セットを保存しました。");
    } catch (e) {
      console.error(e);
      setErrorMsg("保存に失敗しました。");
    } finally {
      setSaving(false);
    }
  };

  return (
    <AppLayout title="ズボラ献立" activeNav="meal">
      <Box sx={{ bgcolor: "#faf7f0", minHeight: "100vh", py: 4 }}>
        <Box sx={{ maxWidth: 1200, mx: "auto", px: { xs: 1.5, sm: 2, md: 3 } }}>
          <Stack spacing={2.5}>
            {/* Header */}
            <Stack
              direction={{ xs: "column", sm: "row" }}
              justifyContent="space-between"
              alignItems={{ xs: "flex-start", sm: "center" }}
              spacing={1}
            >
              <Box>
                <Typography variant="h5" sx={{ fontWeight: 800 }}>
                  ズボラ用セット編集
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  朝昼夜の「主食/主菜/副菜/汁物」をテンプレとして保存します。
                </Typography>
              </Box>

              <Stack direction="row" spacing={1}>
                <Button
                  component={NextLink}
                  href="/home"
                  variant="outlined"
                  sx={{ borderRadius: 999, textTransform: "none" }}
                  disabled={saving}
                >
                  /home に戻る
                </Button>

                <Button
                  variant="contained"
                  sx={{
                    borderRadius: 999,
                    textTransform: "none",
                    fontWeight: 900,
                  }}
                  onClick={handleSaveAll}
                  disabled={saving}
                >
                  {saving ? "保存中…" : "保存する"}
                </Button>
              </Stack>
            </Stack>

            <Card
              sx={{
                borderRadius: 3,
                boxShadow: "0 12px 30px rgba(0,0,0,0.06)",
              }}
            >
              <CardContent>
                <Stack direction="row" spacing={1} sx={{ flexWrap: "wrap" }}>
                  <Chip size="small" label={`docId: ${ZUBORA_DOC_ID}`} />
                  <Chip
                    size="small"
                    label={`recipes: ${recipeList.length}件`}
                  />
                  <Chip size="small" label="保存先：weeklyDaySets" />
                </Stack>
              </CardContent>
            </Card>

            {loading && (
              <Typography variant="body2" color="text.secondary">
                読み込み中...
              </Typography>
            )}

            {errorMsg && <Alert severity="error">{errorMsg}</Alert>}
            {saveMsg && <Alert severity="success">{saveMsg}</Alert>}

            {/* Main */}
            <Card
              sx={{
                borderRadius: 3,
                boxShadow: "0 12px 30px rgba(0,0,0,0.06)",
              }}
            >
              <CardContent>
                <Typography variant="subtitle1" sx={{ fontWeight: 800, mb: 1 }}>
                  ズボラ用セット（テンプレ）
                </Typography>
                <Divider sx={{ mb: 2 }} />

                <Stack spacing={3}>
                  {MEALS.map((meal) => (
                    <Box key={meal.key}>
                      {/* 朝昼夜：削除ボタン */}
                      <Stack
                        direction={{ xs: "column", sm: "row" }}
                        justifyContent="space-between"
                        alignItems={{ xs: "flex-start", sm: "center" }}
                        spacing={1}
                        sx={{ mb: 1 }}
                      >
                        <Typography sx={{ fontWeight: 900 }}>
                          {meal.icon} {meal.label}
                        </Typography>

                        <Button
                          variant="outlined"
                          color="error"
                          sx={{
                            borderRadius: 999,
                            textTransform: "none",
                            whiteSpace: "nowrap",
                          }}
                          onClick={() => handleClearMeal(meal.key)}
                          disabled={saving}
                        >
                          {meal.label}を削除
                        </Button>
                      </Stack>

                      {/* 4枠 */}
                      <Box
                        sx={{
                          display: "grid",
                          gap: 2,
                          gridTemplateColumns: {
                            xs: "1fr",
                            sm: "repeat(2, minmax(0, 1fr))",
                            md: "repeat(4, minmax(0, 1fr))",
                          },
                        }}
                      >
                        {SLOTS.map((slot) => {
                          const recipeId =
                            tplDoc?.[meal.key]?.[slot.key] || null;
                          const name = recipeId
                            ? getRecipeName(recipeId)
                            : "未設定";
                          const img = recipeId ? getRecipeImg(recipeId) : "";

                          return (
                            <Card
                              key={`${meal.key}-${slot.key}`}
                              variant="outlined"
                              sx={{
                                width: "100%",
                                height: 260,
                                minWidth: 0,
                                display: "flex",
                                flexDirection: "column",
                                borderRadius: 2.5,
                                overflow: "hidden",
                                borderColor: "#eee0cc",
                                backgroundColor: "#fff",
                              }}
                            >
                              <Box sx={{ px: 1.25, pt: 1.25, pb: 0.75 }}>
                                <Typography
                                  variant="caption"
                                  color="text.secondary"
                                  sx={{ fontWeight: 800 }}
                                >
                                  {slot.label}
                                </Typography>
                              </Box>

                              <Box sx={{ px: 1.25 }}>
                                <Box
                                  sx={{
                                    width: "100%",
                                    height: 120,
                                    borderRadius: 2,
                                    overflow: "hidden",
                                    border: "1px solid #f0e6d6",
                                  }}
                                >
                                  <RecipeImage
                                    imageUrl={img}
                                    title={name}
                                    height={120}
                                  />
                                </Box>
                              </Box>

                              <Box
                                sx={{
                                  px: 1.25,
                                  pt: 1,
                                  pb: 1.25,
                                  display: "flex",
                                  flexDirection: "column",
                                  flexGrow: 1,
                                  minHeight: 0,
                                }}
                              >
                                <Typography
                                  variant="body2"
                                  sx={{
                                    fontWeight: 900,
                                    lineHeight: 1.3,
                                    display: "-webkit-box",
                                    WebkitLineClamp: 2,
                                    WebkitBoxOrient: "vertical",
                                    overflow: "hidden",
                                    minHeight: 36,
                                  }}
                                  title={name}
                                >
                                  {name}
                                </Typography>

                                <Button
                                  fullWidth
                                  variant="outlined"
                                  size="small"
                                  sx={{
                                    mt: "auto",
                                    borderRadius: 999,
                                    textTransform: "none",
                                  }}
                                  onClick={() => openPicker(meal.key, slot.key)}
                                  disabled={saving || recipeList.length === 0}
                                >
                                  このレシピを変更
                                </Button>
                              </Box>
                            </Card>
                          );
                        })}
                      </Box>
                    </Box>
                  ))}
                </Stack>

                <Divider sx={{ my: 3 }} />

                {/* memo */}
                <Box>
                  <Typography sx={{ fontWeight: 900, mb: 1 }}>メモ</Typography>
                  <TextField
                    multiline
                    minRows={3}
                    fullWidth
                    placeholder="例：ズボラ用はレンチン中心、汁物はインスタントOK など"
                    value={tplDoc.memo}
                    onChange={(e) =>
                      setTplDoc((prev) => ({ ...prev, memo: e.target.value }))
                    }
                    disabled={saving}
                  />
                  <Stack
                    direction="row"
                    justifyContent="flex-end"
                    sx={{ mt: 1 }}
                  >
                    <Button
                      variant="contained"
                      sx={{ borderRadius: 999, textTransform: "none" }}
                      onClick={handleSaveMemo}
                      disabled={saving}
                    >
                      メモを保存
                    </Button>
                  </Stack>
                </Box>
              </CardContent>
            </Card>
          </Stack>
        </Box>

        {/* Drawer */}
        <Drawer anchor="right" open={drawerOpen} onClose={closePicker}>
          <Box sx={{ width: { xs: 340, sm: 460 }, p: 2 }}>
            <Stack
              direction="row"
              justifyContent="space-between"
              alignItems="center"
              sx={{ mb: 1 }}
            >
              <Typography variant="h6" sx={{ fontWeight: 900 }}>
                {pickerTitle}
              </Typography>
              <Button
                size="small"
                onClick={closePicker}
                sx={{ textTransform: "none" }}
              >
                閉じる
              </Button>
            </Stack>

            <TextField
              fullWidth
              size="small"
              placeholder="レシピ名で検索"
              value={pickerSearch}
              onChange={(e) => setPickerSearch(e.target.value)}
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <SearchIcon fontSize="small" />
                  </InputAdornment>
                ),
              }}
              sx={{ mb: 1 }}
            />

            <FormControlLabel
              control={
                <Switch
                  checked={useCategoryFilter}
                  onChange={(e) => setUseCategoryFilter(e.target.checked)}
                />
              }
              label="カテゴリで絞り込む"
              sx={{ mb: 1 }}
            />

            <Stack
              direction="row"
              spacing={1}
              sx={{ mb: 1.5, flexWrap: "wrap" }}
            >
              <Chip size="small" label={`slot: ${picker.slot || "-"}`} />
              <Chip size="small" label={`${pickerFiltered.length} 件`} />
              {useCategoryFilter && picker.slot && (
                <Chip
                  size="small"
                  label="0件なら自動で全件表示"
                  variant="outlined"
                />
              )}
            </Stack>

            <List sx={{ p: 0 }}>
              {pickerFiltered.slice(0, 150).map((r) => (
                <ListItemButton
                  key={r.id}
                  onClick={() => handlePickRecipe(r.id)}
                  sx={{
                    borderRadius: 2,
                    mb: 1,
                    border: "1px solid #eee0cc",
                    backgroundColor: "#fff",
                    "&:hover": { backgroundColor: "#fff8e1" },
                  }}
                  disabled={saving}
                >
                  <ListItemText
                    primary={r.recipeName || "名称未設定"}
                    secondary={[
                      `category: ${r.category || "-"}`,
                      typeof r.cookingTime === "number"
                        ? `調理: ${r.cookingTime}分`
                        : null,
                      typeof r.calories === "number"
                        ? `${r.calories}kcal`
                        : null,
                    ]
                      .filter(Boolean)
                      .join(" / ")}
                  />
                </ListItemButton>
              ))}
            </List>

            {recipeList.length === 0 && (
              <Typography variant="body2" color="error" sx={{ mt: 1 }}>
                recipes が0件です。Firestoreの "recipes" を確認してね。
              </Typography>
            )}

            {pickerFiltered.length === 0 && recipeList.length > 0 && (
              <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
                絞り込み条件で0件です。「カテゴリで絞り込む」をOFFにするか、検索語を消してみてね。
              </Typography>
            )}
          </Box>
        </Drawer>
      </Box>
    </AppLayout>
  );
}
