// pages/recipes/weekly/index.jsx
import React, { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/router";
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
  Grid,
  MenuItem,
  FormControlLabel,
  Switch,
  IconButton,
} from "@mui/material";
import SearchIcon from "@mui/icons-material/Search";
import { ArrowBack, ArrowForward } from "@mui/icons-material";
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
import RecipeCard from "@/components/recipes/RecipeCard";

/** 週間ページの最大表示（2ヶ月 ≒ 8週） */
const MAX_WEEKS = 8;

const DAY_META = [
  { key: "mon", label: "月" },
  { key: "tue", label: "火" },
  { key: "wed", label: "水" },
  { key: "thu", label: "木" },
  { key: "fri", label: "金" },
  { key: "sat", label: "土" },
  { key: "sun", label: "日" },
];

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

function ensureDayDoc(data) {
  return {
    breakfast: data?.breakfast
      ? { ...emptyMeal(), ...data.breakfast }
      : emptyMeal(),
    lunch: data?.lunch ? { ...emptyMeal(), ...data.lunch } : emptyMeal(),
    dinner: data?.dinner ? { ...emptyMeal(), ...data.dinner } : emptyMeal(),
    memo: data?.memo || "",
    templateIds: {
      breakfast: data?.templateIds?.breakfast || "",
      lunch: data?.templateIds?.lunch || "",
      dinner: data?.templateIds?.dinner || "",
    },
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

/** weekKey（月曜 YYYY-MM-DD）をoffsetから作る */
function getWeekKeyFromOffset(baseMonday, weekOffset) {
  const base = new Date(baseMonday);
  base.setDate(base.getDate() + weekOffset * 7);
  const y = base.getFullYear();
  const m = String(base.getMonth() + 1).padStart(2, "0");
  const d = String(base.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

/** "YYYY-MM-DD" → Date（JST） */
function weekKeyToDate(weekKey) {
  return new Date(`${weekKey}T00:00:00+09:00`);
}

/** 表示用：YYYY/MM/DD〜MM/DD */
function formatWeekRangeLabel(weekKey) {
  const start = weekKeyToDate(weekKey);
  const end = new Date(start);
  end.setDate(end.getDate() + 6);

  const sM = String(start.getMonth() + 1).padStart(2, "0");
  const sD = String(start.getDate()).padStart(2, "0");
  const eM = String(end.getMonth() + 1).padStart(2, "0");
  const eD = String(end.getDate()).padStart(2, "0");

  return `${start.getFullYear()}/${sM}/${sD}〜${eM}/${eD}`;
}

/** weekKey（月曜）+ dayKey(mon..sun) → その日の YYYY-MM-DD */
function getDayKeyFromWeekAndDay(weekKey, dayKey) {
  const monday = weekKeyToDate(weekKey);
  const idx = DAY_META.findIndex((d) => d.key === dayKey);
  const d = new Date(monday);
  d.setDate(monday.getDate() + Math.max(0, idx));

  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${dd}`;
}

/** ✅ dailySets の4枠フィールド揺れ吸収 */
function readDailySetSlot(ds, slotKey) {
  // slotKey: staple/main/side/soup（weeklyDaySets側）
  if (!ds) return null;

  if (slotKey === "staple") return ds.staple ?? null;

  if (slotKey === "main") {
    return ds.mainDish ?? ds.main ?? null;
  }

  if (slotKey === "side") {
    return ds.sideDish ?? ds.side ?? null;
  }

  if (slotKey === "soup") return ds.soup ?? null;

  return null;
}

export default function WeeklyPage() {
  const router = useRouter();

  // ✅ hydration対策：mounted後に baseMonday を確定
  const [mounted, setMounted] = useState(false);
  const [baseMonday, setBaseMonday] = useState(null);

  useEffect(() => {
    setMounted(true);

    const today = new Date();
    const day = today.getDay(); // 0(日)〜6(土)
    const diff = (day + 6) % 7; // 月曜:0
    today.setDate(today.getDate() - diff);
    today.setHours(0, 0, 0, 0);

    setBaseMonday(today);
  }, []);

  // 週移動
  const [weekOffset, setWeekOffset] = useState(0);
  // その週の中で「表示する1日」（見た目は1日だけ）
  const [selectedDayKey, setSelectedDayKey] = useState("mon");

  const weekKey = useMemo(() => {
    if (!baseMonday) return null;
    return getWeekKeyFromOffset(baseMonday, weekOffset);
  }, [baseMonday, weekOffset]);

  const dateKey = useMemo(() => {
    if (!weekKey) return null;
    return getDayKeyFromWeekAndDay(weekKey, selectedDayKey);
  }, [weekKey, selectedDayKey]);

  // 状態
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  const [saveMsg, setSaveMsg] = useState("");

  const [dayDoc, setDayDoc] = useState(ensureDayDoc(null));

  // recipes
  const [recipeList, setRecipeList] = useState([]);
  const [recipeMap, setRecipeMap] = useState({});

  // ✅ templates: dailySets（ここが本命）
  const [dailySets, setDailySets] = useState([]);

  // Drawer
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [picker, setPicker] = useState({
    dateKey: null,
    meal: null,
    slot: null,
  });
  const [pickerSearch, setPickerSearch] = useState("");
  const [useCategoryFilter, setUseCategoryFilter] = useState(true);

  // 初回：recipes + dailySets を取得
  useEffect(() => {
    const fetchCommon = async () => {
      try {
        // recipes
        const rSnap = await getDocs(collection(db, "recipes"));
        const list = rSnap.docs.map((d) => ({ id: d.id, ...d.data() }));
        const map = {};
        list.forEach((r) => (map[r.id] = r));
        setRecipeList(list);
        setRecipeMap(map);

        // ✅ dailySets（テンプレ）
        const dsSnap = await getDocs(collection(db, "dailySets"));
        const ds = dsSnap.docs.map((d) => ({ id: d.id, ...d.data() }));
        setDailySets(ds);
      } catch (e) {
        console.error(e);
        // ここは画面自体は出せるので致命扱いにはしない
      }
    };
    fetchCommon();
  }, []);

  // 日付(dateKey)が変わるたびに weeklyDaySets を読み込み
  useEffect(() => {
    if (!dateKey) return;

    const run = async () => {
      setLoading(true);
      setErrorMsg("");
      setSaveMsg("");

      try {
        const ref = doc(db, "weeklyDaySets", String(dateKey));
        const snap = await getDoc(ref);
        if (snap.exists()) {
          setDayDoc(ensureDayDoc(snap.data()));
        } else {
          setDayDoc(ensureDayDoc(null));
        }
      } catch (e) {
        console.error(e);
        setErrorMsg("読み込みに失敗しました。");
      } finally {
        setLoading(false);
      }
    };

    run();
  }, [dateKey]);

  // 表示用
  const getRecipeName = (id) => recipeMap?.[id]?.recipeName || "未設定";
  const getRecipeImg = (id) => recipeMap?.[id]?.imageUrl || "";

  // Drawer open
  const openPicker = (meal, slot) => {
    setPicker({ dateKey: String(dateKey), meal, slot });
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

  // レシピ選択 → weeklyDaySets に保存
  const handlePickRecipe = async (recipeId) => {
    if (!picker?.dateKey || !picker?.meal || !picker?.slot) return;

    setErrorMsg("");
    setSaveMsg("");

    try {
      setSaving(true);

      // 即反映
      setDayDoc((prev) => ({
        ...prev,
        [picker.meal]: { ...prev[picker.meal], [picker.slot]: recipeId },
      }));

      await setDoc(
        doc(db, "weeklyDaySets", picker.dateKey),
        {
          [picker.meal]: { [picker.slot]: recipeId },
          updatedAt: serverTimestamp(),
        },
        { merge: true }
      );

      setSaveMsg("レシピをセットしました。");
      closePicker();
    } catch (e) {
      console.error(e);
      setErrorMsg("レシピのセットに失敗しました。");
    } finally {
      setSaving(false);
    }
  };

  // メモ保存
  const handleSaveMemo = async () => {
    if (!dateKey) return;

    setErrorMsg("");
    setSaveMsg("");

    try {
      setSaving(true);
      await setDoc(
        doc(db, "weeklyDaySets", String(dateKey)),
        { memo: dayDoc.memo || "", updatedAt: serverTimestamp() },
        { merge: true }
      );
      setSaveMsg("メモを保存しました。");
    } catch (e) {
      console.error(e);
      setErrorMsg("メモ保存に失敗しました。");
    } finally {
      setSaving(false);
    }
  };

  /**
   * ✅ テンプレ（dailySets）適用
   * dailySets: staple/mainDish/sideDish/soup を
   * weeklyDaySets: staple/main/side/soup に変換して、朝昼夜それぞれへ一括反映
   */
  const handleApplyDailySetTemplate = async (mealKey, dailySetId) => {
    setErrorMsg("");
    setSaveMsg("");

    // 解除
    if (!dailySetId) {
      setDayDoc((prev) => ({
        ...prev,
        templateIds: { ...prev.templateIds, [mealKey]: "" },
      }));

      await setDoc(
        doc(db, "weeklyDaySets", String(dateKey)),
        {
          templateIds: { [mealKey]: "" },
          updatedAt: serverTimestamp(),
        },
        { merge: true }
      );

      setSaveMsg("テンプレを解除しました。");
      return;
    }

    const ds = dailySets.find((x) => x.id === dailySetId);
    if (!ds) {
      setErrorMsg("テンプレが見つかりませんでした。");
      return;
    }

    const nextMeal = {
      staple: readDailySetSlot(ds, "staple"),
      main: readDailySetSlot(ds, "main"),
      side: readDailySetSlot(ds, "side"),
      soup: readDailySetSlot(ds, "soup"),
    };

    // 即反映
    setDayDoc((prev) => ({
      ...prev,
      [mealKey]: nextMeal,
      templateIds: { ...prev.templateIds, [mealKey]: dailySetId },
    }));

    try {
      setSaving(true);
      await setDoc(
        doc(db, "weeklyDaySets", String(dateKey)),
        {
          [mealKey]: nextMeal,
          templateIds: { [mealKey]: dailySetId },
          updatedAt: serverTimestamp(),
        },
        { merge: true }
      );
      setSaveMsg("献立レシピセット（テンプレ）を適用しました。");
    } catch (e) {
      console.error(e);
      setErrorMsg("テンプレ適用に失敗しました。");
    } finally {
      setSaving(false);
    }
  };

  // 週移動
  const handlePrevWeek = () => setWeekOffset((p) => Math.max(0, p - 1));
  const handleNextWeek = () =>
    setWeekOffset((p) => Math.min(MAX_WEEKS - 1, p + 1));

  // hydration対策：SSR時は固定表示
  if (!mounted || !baseMonday || !weekKey || !dateKey) {
    return (
      <Box sx={{ p: 4 }}>
        <Typography>読み込み中...</Typography>
      </Box>
    );
  }

  return (
    <Box sx={{ bgcolor: "#faf7f0", minHeight: "100vh", py: 4 }}>
      <Box sx={{ mx: "auto", px: { xs: 1.5, sm: 2, md: 3 } }}>
        <Stack spacing={2.5}>
          {/* Header */}
          <Stack
            direction="row"
            justifyContent="space-between"
            alignItems="center"
          >
            <Box>
              <Typography variant="h5" sx={{ fontWeight: 800 }}>
                週間の献立（1日だけ表示）
              </Typography>
              <Typography variant="body2" color="text.secondary">
                週を選んで、曜日タブで1日を切替。編集はDrawerで完結します。
              </Typography>
            </Box>

            <Button
              variant="outlined"
              sx={{ borderRadius: 999, textTransform: "none" }}
              onClick={() => router.push("/recipes")}
            >
              レシピ一覧へ
            </Button>
          </Stack>

          {/* 週ナビ */}
          <Card
            sx={{
              borderRadius: 3,
              boxShadow: "0 12px 30px rgba(0,0,0,0.06)",
            }}
          >
            <CardContent>
              <Stack
                direction="row"
                alignItems="center"
                justifyContent="space-between"
              >
                <Stack direction="row" alignItems="center" spacing={1}>
                  <IconButton
                    size="small"
                    onClick={handlePrevWeek}
                    disabled={weekOffset === 0}
                  >
                    <ArrowBack />
                  </IconButton>
                  <Typography sx={{ fontWeight: 900 }}>
                    {formatWeekRangeLabel(weekKey)}
                  </Typography>
                  <IconButton
                    size="small"
                    onClick={handleNextWeek}
                    disabled={weekOffset === MAX_WEEKS - 1}
                  >
                    <ArrowForward />
                  </IconButton>
                </Stack>

                <Chip size="small" label={`weekKey: ${weekKey}`} />
              </Stack>

              {/* 曜日タブ */}
              <Stack
                direction="row"
                spacing={1}
                sx={{ mt: 2, flexWrap: "wrap" }}
              >
                {DAY_META.map((d) => {
                  const active = d.key === selectedDayKey;
                  const dk = getDayKeyFromWeekAndDay(weekKey, d.key);
                  return (
                    <Button
                      key={d.key}
                      variant={active ? "contained" : "outlined"}
                      size="small"
                      sx={{ borderRadius: 999, textTransform: "none" }}
                      onClick={() => setSelectedDayKey(d.key)}
                    >
                      {d.label} ({dk.slice(5)})
                    </Button>
                  );
                })}
              </Stack>

              <Stack
                direction="row"
                spacing={1}
                sx={{ mt: 2, flexWrap: "wrap" }}
              >
                <Chip size="small" label={`表示中: ${dateKey}`} />
                <Chip size="small" label={`recipes: ${recipeList.length}件`} />
                <Chip size="small" label={`dailySets: ${dailySets.length}件`} />
              </Stack>
            </CardContent>
          </Card>

          {loading && (
            <Typography variant="body2" color="text.secondary">
              読み込み中...
            </Typography>
          )}
          {errorMsg && (
            <Typography variant="body2" color="error">
              {errorMsg}
            </Typography>
          )}
          {saveMsg && (
            <Typography variant="body2" color="success.main">
              {saveMsg}
            </Typography>
          )}

          {/* 1day card */}
          <Card
            sx={{
              borderRadius: 3,
              boxShadow: "0 12px 30px rgba(0,0,0,0.06)",
            }}
          >
            <CardContent>
              <Typography variant="subtitle1" sx={{ fontWeight: 800, mb: 1 }}>
                献立（{dateKey}）
              </Typography>
              <Divider sx={{ mb: 2 }} />

              <Stack spacing={3}>
                {MEALS.map((meal) => (
                  <Box key={meal.key}>
                    {/* ✅ 朝昼夜：テンプレDropdown（dailySets） */}
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

                      <TextField
                        select
                        size="small"
                        label="献立テンプレ（献立レシピセット）"
                        value={dayDoc?.templateIds?.[meal.key] ?? ""}
                        onChange={(e) =>
                          handleApplyDailySetTemplate(meal.key, e.target.value)
                        }
                        sx={{ width: { xs: "100%", sm: 360 } }}
                        disabled={saving || dailySets.length === 0}
                      >
                        <MenuItem value="">
                          <em>テンプレ未使用</em>
                        </MenuItem>
                        {dailySets.map((t) => (
                          <MenuItem key={t.id} value={t.id}>
                            {t.name || "名前なしセット"}
                          </MenuItem>
                        ))}
                      </TextField>
                    </Stack>

                    {/* slots */}
                    <Grid container spacing={2}>
                      {SLOTS.map((slot) => {
                        const recipeId = dayDoc?.[meal.key]?.[slot.key] || null;
                        const name = recipeId
                          ? getRecipeName(recipeId)
                          : "未設定";
                        const img = recipeId ? getRecipeImg(recipeId) : "";

                        return (
                          <Grid
                            item
                            xs={12}
                            sm={6}
                            md={3}
                            key={`${meal.key}-${slot.key}`}
                            sx={{ display: "flex" }}
                          >
                            <Card
                              variant="outlined"
                              sx={{
                                width: "100%",
                                minWidth: 0,
                                display: "flex",
                                flexDirection: "column",
                                borderRadius: 2.5,
                                overflow: "hidden",
                                height: "100%",
                                borderColor: "#eee0cc",
                                background: "#fff",
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

                              {/* ✅ アイキャッチ：横幅いっぱい + 大きめ */}
                              <Box sx={{ px: 1.25, pb: 1.25 }}>
                                <Box
                                  sx={{
                                    width: "100%",
                                    borderRadius: 2,
                                    overflow: "hidden",
                                    border: "1px solid #f0e6d6",
                                  }}
                                >
                                  <RecipeImage
                                    imageUrl={img}
                                    title={name}
                                    height={170}
                                  />
                                </Box>

                                <Typography
                                  variant="body2"
                                  sx={{
                                    mt: 1,
                                    fontWeight: 900,
                                    display: "-webkit-box",
                                    WebkitLineClamp: 2,
                                    WebkitBoxOrient: "vertical",
                                    overflow: "hidden",
                                    minHeight: 40,
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
                                    mt: 1,
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
                          </Grid>
                        );
                      })}
                    </Grid>
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
                  placeholder="例：買い物メモ、作り置きの段取り、家族の要望 など"
                  value={dayDoc.memo}
                  onChange={(e) =>
                    setDayDoc((prev) => ({ ...prev, memo: e.target.value }))
                  }
                />
                <Stack direction="row" justifyContent="flex-end" sx={{ mt: 1 }}>
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

          <Stack direction="row" spacing={1} sx={{ flexWrap: "wrap" }}>
            <Chip size="small" label="テンプレ：dailySets" />
            <Chip size="small" label="保存先：weeklyDaySets" />
            <Chip size="small" label="Drawerで編集" />
          </Stack>
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

          <Typography variant="body2" color="text.secondary" sx={{ mb: 1.5 }}>
            {picker?.dateKey || ""}
          </Typography>

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

          <Stack direction="row" spacing={1} sx={{ mb: 1.5, flexWrap: "wrap" }}>
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
              >
                <ListItemText
                  primary={r.recipeName || "名称未設定"}
                  secondary={[
                    `category: ${r.category || "-"}`,
                    typeof r.cookingTime === "number"
                      ? `調理: ${r.cookingTime}分`
                      : null,
                    typeof r.calories === "number" ? `${r.calories}kcal` : null,
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
  );
}
