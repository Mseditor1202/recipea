// pages/recipes/weekly/index.jsx
import { useAuth } from "@/hooks/useAuth";
import ListSkeleton from "@/components/states/ListSkeleton";
import ErrorState from "@/components/states/ErrorState";
import AppLayout from "@/components/layout/AppLayout";
import React, { useEffect, useMemo, useState, useRef } from "react";
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
  MenuItem,
  FormControlLabel,
  Switch,
  IconButton,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Alert,
} from "@mui/material";
import SearchIcon from "@mui/icons-material/Search";
import { ArrowBack, ArrowForward, Add } from "@mui/icons-material";
import {
  doc,
  getDoc,
  getDocs,
  collection,
  setDoc,
  serverTimestamp,
  addDoc,
  query,
  where,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import RecipeImage from "@/components/recipes/RecipeImage";

/** 曜日キーを取得する */
function getTodayDayKey() {
  const today = new Date();
  const day = today.getDay(); // 0(日)〜6(土)
  const map = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"];
  return map[day];
}

/** 週間ページの最大表示（2ヶ月 ≒ 8週） */
const MAX_WEEKS = 8;

const DAY_META = [
  { key: "sun", label: "日" },
  { key: "mon", label: "月" },
  { key: "tue", label: "火" },
  { key: "wed", label: "水" },
  { key: "thu", label: "木" },
  { key: "fri", label: "金" },
  { key: "sat", label: "土" },
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

/** ✅ dailySets の4枠フィールド揺れ吸収（dailySets → weeklyDaySets比較用） */
function readDailySetSlot(ds, slotKey) {
  if (!ds) return null;
  if (slotKey === "staple") return ds.staple ?? null;
  if (slotKey === "main") return ds.mainDish ?? ds.main ?? null;
  if (slotKey === "side") return ds.sideDish ?? ds.side ?? null;
  if (slotKey === "soup") return ds.soup ?? null;
  return null;
}

function getSundayKeyFromDateKey(dateKey) {
  const d = new Date(`${dateKey}T00:00:00+09:00`);

  // getDay(): 日=0, 月=1 ... 土=6
  d.setDate(d.getDate() - d.getDay());

  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");

  return `${y}-${m}-${dd}`;
}

/** ✅ 追加：YYYY-MM-DD から mon..sun を返す */
function getDayKeyLabelFromDateKey(dateKey) {
  const d = new Date(`${dateKey}T00:00:00+09:00`);
  const day = d.getDay(); // 0..6
  const map = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"];
  return map[day];
}

export default function WeeklyPage() {
  const { user } = useAuth();
  const router = useRouter();
  const { dayKey: queryDayKey } = router.query;

  const [mounted, setMounted] = useState(false);
  const [baseSunday, setBaseSunday] = useState(null);

  useEffect(() => {
    setMounted(true);

    const today = new Date();

    // 今週の日曜日
    today.setDate(today.getDate() - today.getDay());
    today.setHours(0, 0, 0, 0);

    setBaseSunday(today);
  }, []);

  // 週移動
  const [weekOffset, setWeekOffset] = useState(0);
  // その週の中で「表示する1日」
  const [selectedDayKey, setSelectedDayKey] = useState(getTodayDayKey());

  const weekKey = useMemo(() => {
    if (!baseSunday) return null;
    return getWeekKeyFromOffset(baseSunday, weekOffset);
  }, [baseSunday, weekOffset]);

  const dateKey = useMemo(() => {
    if (!weekKey) return null;
    return getDayKeyFromWeekAndDay(weekKey, selectedDayKey);
  }, [weekKey, selectedDayKey]);

  /** ✅ クエリ dayKey に連動して週・曜日を合わせる（1回だけ） */
  const appliedQueryRef = useRef(false);
  useEffect(() => {
    if (!router.isReady) return;
    if (!baseSunday) return;
    if (appliedQueryRef.current) return;

    if (!queryDayKey || typeof queryDayKey !== "string") return;
    if (!/^\d{4}-\d{2}-\d{2}$/.test(queryDayKey)) return;

    const sundayKey = getSundayKeyFromDateKey(queryDayKey);

    const base = new Date(baseSunday);
    const target = new Date(`${sundayKey}T00:00:00+09:00`);
    const diffMs = target.getTime() - base.getTime();
    const diffWeeks = Math.round(diffMs / (1000 * 60 * 60 * 24 * 7));

    const nextOffset = Math.min(MAX_WEEKS - 1, Math.max(0, diffWeeks));

    setWeekOffset(nextOffset);
    setSelectedDayKey(getDayKeyLabelFromDateKey(queryDayKey));

    appliedQueryRef.current = true;
  }, [router.isReady, baseSunday, queryDayKey]);

  // 状態
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [saving, setSaving] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  const [saveMsg, setSaveMsg] = useState("");

  const [dayDoc, setDayDoc] = useState(ensureDayDoc(null));
  const [weekDocs, setWeekDocs] = useState({});
  const [weekLoading, setWeekLoading] = useState(true);
  const [weekLoadError, setWeekLoadError] = useState(false);

  // recipes
  const [recipeList, setRecipeList] = useState([]);
  const [recipeMap, setRecipeMap] = useState({});

  // templates: dailySets
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

  // ✅ 新テンプレ作成Dialog
  const [createTplOpen, setCreateTplOpen] = useState(false);
  const [createTplMealKey, setCreateTplMealKey] = useState(null); // breakfast/lunch/dinner
  const [createTplName, setCreateTplName] = useState("");
  const [createTplError, setCreateTplError] = useState("");

  // 初回：recipes + dailySets
  useEffect(() => {
    if (!user) return;

    const fetchCommon = async () => {
      try {
        const rSnap = await getDocs(
          query(collection(db, "recipes"), where("userId", "==", user.uid)),
        );

        const list = rSnap.docs.map((d) => ({ id: d.id, ...d.data() }));
        const map = {};
        list.forEach((r) => (map[r.id] = r));
        setRecipeList(list);
        setRecipeMap(map);

        const dsSnap = await getDocs(
          query(collection(db, "dailySets"), where("userId", "==", user.uid)),
        );

        const ds = dsSnap.docs.map((d) => ({ id: d.id, ...d.data() }));
        setDailySets(ds);
      } catch (e) {
        console.error(e);
      }
    };

    fetchCommon();
  }, [user]);

  // dateKeyごとに weeklyDaySets を読み込み
  useEffect(() => {
    if (!dateKey || !user) return;

    const run = async () => {
      setLoading(true);
      setLoadError(false);
      setSaveMsg("");

      try {
        const ref = doc(db, "weeklyDaySets", `${user.uid}_${dateKey}`);
        const snap = await getDoc(ref);

        if (snap.exists()) {
          setDayDoc(ensureDayDoc(snap.data()));
        } else {
          setDayDoc(ensureDayDoc(null));
        }
      } catch (e) {
        console.error(e);
        setLoadError(true);
      } finally {
        setLoading(false);
      }
    };

    run();
  }, [dateKey, user]);
  useEffect(() => {
    if (!weekKey || !user) return;

    const fetchWeek = async () => {
      setWeekLoading(true);
      setWeekLoadError(false);

      try {
        const dateKeys = DAY_META.map((day) =>
          getDayKeyFromWeekAndDay(weekKey, day.key),
        );

        const snapshots = await Promise.all(
          dateKeys.map((dk) =>
            getDoc(doc(db, "weeklyDaySets", `${user.uid}_${dk}`)),
          ),
        );

        const next = {};

        dateKeys.forEach((dk, index) => {
          const snapshot = snapshots[index];

          next[dk] = snapshot.exists()
            ? ensureDayDoc(snapshot.data())
            : ensureDayDoc(null);
        });

        setWeekDocs(next);
      } catch (error) {
        console.error("[WEEKLY] fetch week failed:", error);
        setWeekLoadError(true);
      } finally {
        setWeekLoading(false);
      }
    };

    fetchWeek();
  }, [weekKey, user]);

  // 表示用
  const getRecipeName = (id) => recipeMap?.[id]?.recipeName || "未設定";
  const getRecipeImg = (id) => recipeMap?.[id]?.imageUrl || "";

  const getMealPreview = (mealData) => {
    if (!mealData) {
      return {
        recipeIds: [],
        imageUrl: "",
        title: "",
      };
    }

    const recipeIds = SLOTS.map((slot) => mealData?.[slot.key]).filter(Boolean);

    const recipes = recipeIds.map((id) => recipeMap[id]).filter(Boolean);

    return {
      recipeIds,
      imageUrl: recipes[0]?.imageUrl || "",
      title: recipes
        .map((recipe) => recipe.recipeName)
        .filter(Boolean)
        .join("・"),
    };
  };

  // Drawer
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
    if (q)
      list = list.filter((r) => (r.recipeName || "").toLowerCase().includes(q));

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
    if (!user || !picker?.dateKey || !picker?.meal || !picker?.slot) return;

    setErrorMsg("");
    setSaveMsg("");

    try {
      setSaving(true);

      // 即反映
      setDayDoc((prev) => ({
        ...prev,
        [picker.meal]: { ...prev[picker.meal], [picker.slot]: recipeId },
      }));

      // Firestore に保存
      await setDoc(
        doc(db, "weeklyDaySets", `${user.uid}_${picker.dateKey}`),
        {
          userId: user.uid,
          [picker.meal]: {
            [picker.slot]: recipeId,
          },
          updatedAt: serverTimestamp(),
        },
        { merge: true },
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
    if (!user || !dateKey) return;

    setErrorMsg("");
    setSaveMsg("");

    try {
      setSaving(true);

      await setDoc(
        doc(db, "weeklyDaySets", `${user.uid}_${dateKey}`),
        {
          userId: user.uid,
          memo: dayDoc.memo || "",
          updatedAt: serverTimestamp(),
        },
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

  // テンプレ適用
  const handleApplyDailySetTemplate = async (mealKey, dailySetId) => {
    if (!user || !dateKey) return;

    setErrorMsg("");
    setSaveMsg("");

    // テンプレ解除
    if (!dailySetId) {
      setDayDoc((prev) => ({
        ...prev,
        templateIds: { ...prev.templateIds, [mealKey]: "" },
      }));

      try {
        setSaving(true);

        await setDoc(
          doc(db, "weeklyDaySets", `${user.uid}_${dateKey}`),
          {
            userId: user.uid,
            templateIds: { [mealKey]: "" },
            updatedAt: serverTimestamp(),
          },
          { merge: true },
        );

        setSaveMsg("テンプレを解除しました。");
      } catch (e) {
        console.error(e);
        setErrorMsg("テンプレ解除に失敗しました。");
      } finally {
        setSaving(false);
      }

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

    setDayDoc((prev) => ({
      ...prev,
      [mealKey]: nextMeal,
      templateIds: {
        ...prev.templateIds,
        [mealKey]: dailySetId,
      },
    }));

    try {
      setSaving(true);

      await setDoc(
        doc(db, "weeklyDaySets", `${user.uid}_${dateKey}`),
        {
          userId: user.uid,
          [mealKey]: nextMeal,
          templateIds: { [mealKey]: dailySetId },
          updatedAt: serverTimestamp(),
        },
        { merge: true },
      );

      setSaveMsg("献立レシピセット（テンプレ）を適用しました。");
    } catch (e) {
      console.error(e);
      setErrorMsg("テンプレ適用に失敗しました。");
    } finally {
      setSaving(false);
    }
  };

  // 朝/昼/夜 を個別に削除
  const handleClearMeal = async (mealKey) => {
    if (!user || !dateKey) return;

    setErrorMsg("");
    setSaveMsg("");

    const cleared = emptyMeal();

    // 画面に即反映
    setDayDoc((prev) => ({
      ...prev,
      [mealKey]: cleared,
      templateIds: {
        ...prev.templateIds,
        [mealKey]: "",
      },
    }));

    try {
      setSaving(true);

      await setDoc(
        doc(db, "weeklyDaySets", `${user.uid}_${dateKey}`),
        {
          userId: user.uid,
          [mealKey]: cleared,
          templateIds: { [mealKey]: "" },
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

  // ✅ 「テンプレから一部変更されたか？」を meal単位で判定
  const isMealDirtyFromTemplate = (mealKey) => {
    const tplId = dayDoc?.templateIds?.[mealKey];
    if (!tplId) return false; // テンプレ未使用なら出さない
    const ds = dailySets.find((x) => x.id === tplId);
    if (!ds) return false;

    const meal = dayDoc?.[mealKey] || emptyMeal();
    const a = (v) => v ?? null;

    const sameStaple = a(meal.staple) === a(readDailySetSlot(ds, "staple"));
    const sameMain = a(meal.main) === a(readDailySetSlot(ds, "main"));
    const sameSide = a(meal.side) === a(readDailySetSlot(ds, "side"));
    const sameSoup = a(meal.soup) === a(readDailySetSlot(ds, "soup"));

    return !(sameStaple && sameMain && sameSide && sameSoup);
  };

  // ✅ 新テンプレ作成（ダイアログ起動）
  const openCreateTemplateDialog = (mealKey) => {
    const mealLabel = MEALS.find((m) => m.key === mealKey)?.label || mealKey;
    setCreateTplMealKey(mealKey);
    setCreateTplName(`${dateKey} ${mealLabel} テンプレ`);
    setCreateTplError("");
    setCreateTplOpen(true);
  };

  const closeCreateTemplateDialog = () => {
    setCreateTplOpen(false);
    setCreateTplMealKey(null);
    setCreateTplName("");
    setCreateTplError("");
  };

  const handleCreateTemplate = async () => {
    if (!user || !dateKey || !createTplMealKey) return;

    const name = (createTplName || "").trim();

    if (!name) {
      setCreateTplError("テンプレ名を入力してね。");
      return;
    }

    const meal = dayDoc?.[createTplMealKey] || emptyMeal();

    // dailySets に保存するデータ
    const payload = {
      userId: user.uid,
      name,
      memo: "",
      staple: meal.staple ?? null,
      mainDish: meal.main ?? null,
      sideDish: meal.side ?? null,
      soup: meal.soup ?? null,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    };

    setErrorMsg("");
    setSaveMsg("");

    try {
      setSaving(true);

      // 1) dailySets に追加
      const ref = await addDoc(collection(db, "dailySets"), payload);
      const newId = ref.id;

      // 2) ローカル反映
      setDailySets((prev) => [{ id: newId, ...payload }, ...prev]);

      // 3) weeklyDaySets の templateIds を差し替え
      setDayDoc((prev) => ({
        ...prev,
        templateIds: {
          ...prev.templateIds,
          [createTplMealKey]: newId,
        },
      }));

      await setDoc(
        doc(db, "weeklyDaySets", `${user.uid}_${dateKey}`),
        {
          userId: user.uid,
          templateIds: {
            [createTplMealKey]: newId,
          },
          updatedAt: serverTimestamp(),
        },
        { merge: true },
      );

      setSaveMsg("新しい献立テンプレを登録しました。");
      closeCreateTemplateDialog();
    } catch (e) {
      console.error(e);
      setErrorMsg("テンプレ登録に失敗しました。");
    } finally {
      setSaving(false);
    }
  };

  // 週移動
  const handlePrevWeek = () => setWeekOffset((p) => Math.max(0, p - 1));
  const handleNextWeek = () =>
    setWeekOffset((p) => Math.min(MAX_WEEKS - 1, p + 1));

  // hydration対策
  if (!mounted || !baseSunday || !weekKey || !dateKey) {
    return (
      <Box sx={{ p: 4 }}>
        <Typography>読み込み中...</Typography>
      </Box>
    );
  }

  return (
    <AppLayout title="献立" activeNav="meal">
      <Box sx={{ bgcolor: "#faf7f0", minHeight: "100vh", py: 4 }}>
        <Box sx={{ maxWidth: 1200, mx: "auto", px: { xs: 1.5, sm: 2, md: 3 } }}>
          <Stack spacing={2.5}>
            {/* Header */}
            <Stack
              direction="row"
              justifyContent="space-between"
              alignItems="center"
            >
              <Box>
                <Typography variant="h5" sx={{ fontWeight: 800 }}>
                  週間レシピ登録
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
                  <Chip
                    size="small"
                    label={`recipes: ${recipeList.length}件`}
                  />
                  <Chip
                    size="small"
                    label={`dailySets: ${dailySets.length}件`}
                  />
                  {queryDayKey && (
                    <Chip
                      size="small"
                      color="primary"
                      label={`fromHome: ${queryDayKey}`}
                    />
                  )}
                </Stack>
              </CardContent>
            </Card>

            {loading ? (
              <ListSkeleton count={3} />
            ) : loadError ? (
              <ErrorState
                title="献立を読み込めませんでした"
                description="通信状況を確認して、もう一度お試しください。"
                onRetry={() => {
                  setLoading(true);
                  setLoadError(false);

                  getDoc(doc(db, "weeklyDaySets", `${user.uid}_${dateKey}`))
                    .then((snap) => {
                      if (snap.exists()) {
                        setDayDoc(ensureDayDoc(snap.data()));
                      } else {
                        setDayDoc(ensureDayDoc(null));
                      }
                    })
                    .catch((e) => {
                      console.error(e);
                      setLoadError(true);
                    })
                    .finally(() => {
                      setLoading(false);
                    });
                }}
              />
            ) : null}

            {errorMsg && <Alert severity="error">{errorMsg}</Alert>}
            {saveMsg && <Alert severity="success">{saveMsg}</Alert>}

            {weekLoading ? (
              <ListSkeleton count={3} />
            ) : weekLoadError ? (
              <ErrorState
                title="週間献立を読み込めませんでした"
                description="通信状態を確認して、もう一度お試しください。"
                onRetry={() => router.reload()}
              />
            ) : (
              <Card
                sx={{
                  borderRadius: 3,
                  border: "1px solid #F1E5D5",
                  boxShadow: "0 8px 24px rgba(80, 60, 30, 0.06)",
                  overflow: "hidden",
                }}
              >
                <CardContent sx={{ p: 0 }}>
                  <Box sx={{ overflowX: "auto" }}>
                    <Box
                      sx={{
                        minWidth: 900,
                        display: "grid",
                        gridTemplateColumns:
                          "90px repeat(7, minmax(110px, 1fr))",
                      }}
                    >
                      {/* 左上 */}
                      <Box
                        sx={{
                          borderRight: "1px solid #F1E5D5",
                          borderBottom: "1px solid #F1E5D5",
                          bgcolor: "#FFFDFA",
                        }}
                      />

                      {/* 曜日 */}
                      {DAY_META.map((day) => {
                        const dk = getDayKeyFromWeekAndDay(weekKey, day.key);

                        return (
                          <Box
                            key={day.key}
                            sx={{
                              py: 1.5,
                              textAlign: "center",
                              borderRight: "1px solid #F1E5D5",
                              borderBottom: "1px solid #F1E5D5",
                              bgcolor: "#FFFDFA",
                            }}
                          >
                            <Typography
                              sx={{
                                fontSize: 13,
                                fontWeight: 800,
                                color:
                                  day.key === "sun"
                                    ? "#D65A4A"
                                    : day.key === "sat"
                                      ? "#4277B8"
                                      : "#333333",
                              }}
                            >
                              {dk.slice(8)}
                            </Typography>

                            <Typography
                              sx={{
                                fontSize: 12,
                                color:
                                  day.key === "sun"
                                    ? "#D65A4A"
                                    : day.key === "sat"
                                      ? "#4277B8"
                                      : "#777777",
                              }}
                            >
                              {day.label}
                            </Typography>
                          </Box>
                        );
                      })}

                      {/* 朝・昼・夕 */}
                      {MEALS.map((meal) => (
                        <React.Fragment key={meal.key}>
                          <Box
                            sx={{
                              minHeight: 120,
                              display: "flex",
                              alignItems: "center",
                              justifyContent: "center",
                              borderRight: "1px solid #F1E5D5",
                              borderBottom: "1px solid #F1E5D5",
                              bgcolor: "#FFF9EF",
                            }}
                          >
                            <Typography
                              sx={{
                                fontWeight: 800,
                                fontSize: 13,
                              }}
                            >
                              {meal.label}
                            </Typography>
                          </Box>

                          {DAY_META.map((day) => {
                            const dk = getDayKeyFromWeekAndDay(
                              weekKey,
                              day.key,
                            );
                            const dayData = weekDocs[dk];
                            const preview = getMealPreview(dayData?.[meal.key]);
                            const hasMeal = preview.recipeIds.length > 0;

                            return (
                              <Box
                                key={`${dk}-${meal.key}`}
                                sx={{
                                  minHeight: 120,
                                  p: 1,
                                  borderRight: "1px solid #F1E5D5",
                                  borderBottom: "1px solid #F1E5D5",
                                  bgcolor: "#FFFFFF",
                                }}
                              >
                                <Button
                                  fullWidth
                                  onClick={() =>
                                    router.push(`/recipes/weekly/day/${dk}`)
                                  }
                                  sx={{
                                    height: "100%",
                                    minHeight: 100,
                                    p: 0.75,
                                    borderRadius: 2,
                                    display: "flex",
                                    flexDirection: "column",
                                    gap: 0.5,
                                    color: "#333333",
                                    textTransform: "none",
                                    "&:hover": {
                                      bgcolor: "#FFF8EC",
                                    },
                                  }}
                                >
                                  {hasMeal ? (
                                    <>
                                      {preview.imageUrl && (
                                        <Box
                                          component="img"
                                          src={preview.imageUrl}
                                          alt={preview.title}
                                          sx={{
                                            width: 56,
                                            height: 56,
                                            borderRadius: 2,
                                            objectFit: "cover",
                                          }}
                                        />
                                      )}

                                      <Typography
                                        sx={{
                                          width: "100%",
                                          fontSize: 11,
                                          lineHeight: 1.4,
                                          fontWeight: 700,
                                          overflow: "hidden",
                                          display: "-webkit-box",
                                          WebkitBoxOrient: "vertical",
                                          WebkitLineClamp: 2,
                                        }}
                                      >
                                        {preview.title}
                                      </Typography>
                                    </>
                                  ) : (
                                    <Typography
                                      sx={{
                                        fontSize: 24,
                                        lineHeight: 1,
                                        fontWeight: 400,
                                        color: "#4B8B4B",
                                      }}
                                    >
                                      ＋
                                    </Typography>
                                  )}
                                </Button>
                              </Box>
                            );
                          })}
                        </React.Fragment>
                      ))}
                    </Box>
                  </Box>

                  <Box
                    sx={{
                      p: 2.5,
                      textAlign: "center",
                      bgcolor: "#FFFDFA",
                    }}
                  >
                    <Button
                      variant="contained"
                      onClick={() =>
                        router.push(`/recipes/weekly/zubora?weekKey=${weekKey}`)
                      }
                      sx={{
                        minWidth: 240,
                        py: 1.2,
                        borderRadius: 2,
                        bgcolor: "#2F7D32",
                        fontWeight: 800,
                        boxShadow: "none",
                        textTransform: "none",
                        "&:hover": {
                          bgcolor: "#286C2B",
                          boxShadow: "none",
                        },
                      }}
                    >
                      おまかせで決める
                    </Button>

                    <Typography
                      sx={{
                        mt: 1,
                        fontSize: 12,
                        color: "#888888",
                      }}
                    >
                      または、＋から1日ずつ追加できます
                    </Typography>
                  </Box>
                </CardContent>
              </Card>
            )}
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

        {/* ✅ 新テンプレ作成Dialog */}
        <Dialog
          open={createTplOpen}
          onClose={closeCreateTemplateDialog}
          fullWidth
          maxWidth="sm"
        >
          <DialogTitle sx={{ fontWeight: 900 }}>
            新しい献立テンプレを登録
          </DialogTitle>
          <DialogContent>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 1.5 }}>
              いま編集している内容（主食/主菜/副菜/汁物）で dailySets
              に新規保存します。
            </Typography>

            {createTplError && (
              <Alert severity="error" sx={{ mb: 1.5 }}>
                {createTplError}
              </Alert>
            )}

            <TextField
              label="テンプレ名"
              fullWidth
              value={createTplName}
              onChange={(e) => setCreateTplName(e.target.value)}
              autoFocus
            />
          </DialogContent>
          <DialogActions>
            <Button
              onClick={closeCreateTemplateDialog}
              sx={{ textTransform: "none" }}
            >
              キャンセル
            </Button>
            <Button
              onClick={handleCreateTemplate}
              variant="contained"
              sx={{ borderRadius: 999, textTransform: "none" }}
              disabled={saving}
            >
              登録する
            </Button>
          </DialogActions>
        </Dialog>
      </Box>
    </AppLayout>
  );
}
