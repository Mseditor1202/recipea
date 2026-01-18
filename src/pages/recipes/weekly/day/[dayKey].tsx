// pages/recipes/weekly/day/[dayKey].jsx
import React, {
  DO_NOT_USE_OR_YOU_WILL_BE_FIRED_CALLBACK_REF_RETURN_VALUES,
  useEffect,
  useMemo,
  useState,
} from "react";
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
} from "@mui/material";
import SearchIcon from "@mui/icons-material/Search";
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

function ensureDayDoc(data: unknown) {
  const d = (data ?? {}) as any;

  return {
    breakfast: d?.breakfast ? { ...emptyMeal(), ...d.breakfast } : emptyMeal(),
    lunch: d?.lunch ? { ...emptyMeal(), ...d.lunch } : emptyMeal(),
    dinner: d?.dinner ? { ...emptyMeal(), ...d.dinner } : emptyMeal(),
    memo: d?.memo || "",
    templateIds: {
      breakfast: d?.templateIds?.breakfast || "",
      lunch: d?.templateIds?.lunch || "",
      dinner: d?.templateIds?.dinner || "",
    },
  };
}

function normalizeCategory(cat: unknown) {
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

type SlotKey = "staple" | "main" | "side" | "soup";

function readDailySetSlot(ds: unknown, slotKey: SlotKey): string | null {
  const d = (ds ?? {}) as any;

  if (slotKey === "staple") return d.staple ?? null;
  if (slotKey === "main") return d.mainDish ?? d.main ?? null;
  if (slotKey === "side") return d.sideDish ?? d.side ?? null;
  if (slotKey === "soup") return d.soup ?? null;
  return null;
}

type MealKey = "breakfast" | "lunch" | "dinner";

type PickerState = {
  dayKey: string;
  meal: MealKey;
  slot: SlotKey;
} | null;

export default function WeeklyDayEditPage() {
  const router = useRouter();
  const { dayKey } = router.query; // YYYY-MM-DD

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  const [saveMsg, setSaveMsg] = useState("");

  const [dayDoc, setDayDoc] = useState(ensureDayDoc(null));

  // recipes
  type Recipe = {
    id: string;
    recipeName?: string;
    imageUrl?: string;
    category?: string | null;
    cookingTime?: number | null;
    calories?: number | null;
  };

  const [recipeList, setRecipeList] = useState<Recipe[]>([]);
  const [recipeMap, setRecipeMap] = useState<Record<string, Recipe>>({});

  // dailySets templates
  type DailySet = { id: string; name?: string | null };
  const [dailySets, setDailySets] = useState<DailySet[]>([]);

  // Drawer
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [picker, setPicker] = useState<PickerState>(null);
  const [pickerSearch, setPickerSearch] = useState("");
  const [useCategoryFilter, setUseCategoryFilter] = useState(true);

  // common fetch
  useEffect(() => {
    const fetchCommon = async () => {
      try {
        const rSnap = await getDocs(collection(db, "recipes"));

        const list = rSnap.docs.map((d) => {
          const data = d.data() as any;
          return { id: d.id, ...data };
        });

        const map: Record<string, any> = {};
        list.forEach((r) => {
          map[r.id] = r;
        });
        setRecipeList(list);
        setRecipeMap(map);

        const dsSnap = await getDocs(collection(db, "dailySets"));

        const ds = dsSnap.docs.map((d) => {
          const data = d.data() as any;
          return { id: d.id, ...data };
        });

        setDailySets(ds);
      } catch (e) {
        console.error(e);
      }
    };
    fetchCommon();
  }, []);

  // load weeklyDaySets doc
  useEffect(() => {
    if (!router.isReady || !dayKey) return;

    const run = async () => {
      setLoading(true);
      setErrorMsg("");
      setSaveMsg("");

      try {
        const ref = doc(db, "weeklyDaySets", String(dayKey));
        const snap = await getDoc(ref);
        if (snap.exists()) setDayDoc(ensureDayDoc(snap.data()));
        else setDayDoc(ensureDayDoc(null));
      } catch (e) {
        console.error(e);
        setErrorMsg("読み込みに失敗しました。");
      } finally {
        setLoading(false);
      }
    };

    run();
  }, [router.isReady, dayKey]);

  const getRecipeName = (id?: string | null): string =>
    (id ? recipeMap[id]?.recipeName : undefined) || "未設定";
  const getRecipeImg = (id?: string | null): string =>
    (id ? recipeMap[id]?.imageUrl : undefined) || "";

  const openPicker = (meal: MealKey, slot: SlotKey) => {
    setPicker({ dayKey: String(dayKey), meal, slot });
    setPickerSearch("");
    setUseCategoryFilter(true);
    setDrawerOpen(true);
  };

  const closePicker = () => setDrawerOpen(false);

  const pickerTitle = useMemo(() => {
    if (!picker || !picker.meal || !picker.slot) return "レシピを選択";
    const m = MEALS.find((x) => x.key === picker.meal)?.label || "";
    const s = SLOTS.find((x) => x.key === picker.slot)?.label || "";
    return `${m} / ${s} を変更`;
  }, [picker]);

  const pickerFiltered = useMemo(() => {
    let list = recipeList;

    const q = (pickerSearch || "").trim().toLowerCase();
    if (q)
      list = list.filter((r) => (r.recipeName || "").toLowerCase().includes(q));

    if (useCategoryFilter && picker?.slot) {
      const slot = picker.slot;

      const byCat = list.filter((r) => {
        const cat = normalizeCategory(r.category);
        return !r.category || cat === slot;
      });

      if (byCat.length === 0) return list;
      return byCat;
    }

    return list;
  }, [recipeList, pickerSearch, picker, useCategoryFilter]);

  const handlePickRecipe = async (recipeId: string) => {
    if (!picker?.dayKey || !picker?.meal || !picker?.slot) return;

    setErrorMsg("");
    setSaveMsg("");

    try {
      setSaving(true);

      setDayDoc((prev) => ({
        ...prev,
        [picker.meal]: { ...prev[picker.meal], [picker.slot]: recipeId },
      }));

      await setDoc(
        doc(db, "weeklyDaySets", picker.dayKey),
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

  const handleSaveMemo = async () => {
    if (!dayKey) return;

    setErrorMsg("");
    setSaveMsg("");

    try {
      setSaving(true);
      await setDoc(
        doc(db, "weeklyDaySets", String(dayKey)),
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

  const handleApplyDailySetTemplate = async (
    mealKey: MealKey,
    dailySetId: string
  ) => {
    setErrorMsg("");
    setSaveMsg("");

    if (!dayKey) return;

    if (!dailySetId) {
      setDayDoc((prev) => ({
        ...prev,
        templateIds: { ...prev.templateIds, [mealKey]: "" },
      }));

      await setDoc(
        doc(db, "weeklyDaySets", String(dayKey)),
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

    setDayDoc((prev) => ({
      ...prev,
      [mealKey]: nextMeal,
      templateIds: { ...prev.templateIds, [mealKey]: dailySetId },
    }));

    try {
      setSaving(true);
      await setDoc(
        doc(db, "weeklyDaySets", String(dayKey)),
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

  if (!router.isReady) {
    return (
      <Box sx={{ p: 4 }}>
        <Typography>読み込み中...</Typography>
      </Box>
    );
  }

  return (
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
              <Typography variant="h5" sx={{ fontWeight: 900 }}>
                週間の献立（日別編集）
              </Typography>
              <Typography variant="body2" color="text.secondary">
                対象日：{String(dayKey || "")}
              </Typography>
            </Box>

            <Stack direction="row" spacing={1}>
              <Button
                variant="outlined"
                sx={{ borderRadius: 999, textTransform: "none" }}
                onClick={() => router.push("/recipes/weekly")}
              >
                週間へ
              </Button>
              <Button
                variant="outlined"
                sx={{ borderRadius: 999, textTransform: "none" }}
                onClick={() => router.push("/recipes")}
              >
                レシピ一覧へ
              </Button>
            </Stack>
          </Stack>

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

          {/* Main card */}
          <Card
            sx={{ borderRadius: 3, boxShadow: "0 12px 30px rgba(0,0,0,0.06)" }}
          >
            <CardContent>
              <Typography variant="subtitle1" sx={{ fontWeight: 800, mb: 1 }}>
                献立（{String(dayKey || "")}）
              </Typography>
              <Divider sx={{ mb: 2 }} />

              <Stack spacing={3}>
                {MEALS.map((meal) => (
                  <Box key={meal.key}>
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
                        value={dayDoc.templateIds?.[meal.key as MealKey] ?? ""}
                        onChange={(e) =>
                          handleApplyDailySetTemplate(
                            meal.key as MealKey,
                            String(e.target.value)
                          )
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

                    {/* ✅ 4列固定に近い見せ方：lg以上で4列、mdで2列、smで2列、xsで1列 */}
                    <Grid container spacing={2}>
                      {SLOTS.map((slot) => {
                        const mealKey = meal.key as MealKey;
                        const slotKey = slot.key as SlotKey;
                        const recipeId = dayDoc?.[mealKey]?.[slotKey] || null;
                        const name = recipeId
                          ? getRecipeName(recipeId)
                          : "未設定";
                        const img = recipeId ? getRecipeImg(recipeId) : "";

                        return (
                          <Grid
                            key={`${meal.key}-${slot.key}`}
                            size={{ xs: 12, sm: 6, md: 6, lg: 3 }}
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
                                    sx={{}}
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
                                  onClick={() =>
                                    openPicker(
                                      meal.key as MealKey,
                                      slot.key as SlotKey
                                    )
                                  }
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
            {picker?.dayKey || ""}
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
            <Chip size="small" label={`slot: ${picker?.slot || "-"}`} />
            <Chip size="small" label={`${pickerFiltered.length} 件`} />
            {useCategoryFilter && picker && (
              <Chip
                size="small"
                label="0件なら自動で全件表示"
                variant="outlined"
              />
            )}
          </Stack>

          <List sx={{ p: 0 }}>
            {pickerFiltered.slice(0, 150).map((r) => {
              const secondaryText = [
                `category: ${r.category || "-"}`,
                typeof r.cookingTime === "number"
                  ? `調理: ${r.cookingTime}分`
                  : null,
                typeof r.calories === "number" ? `${r.calories}kcal` : null,
              ]
                .filter((v): v is string => typeof v === "string")
                .join(" / ");

              return (
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
                    secondary={secondaryText}
                  />
                </ListItemButton>
              );
            })}
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
