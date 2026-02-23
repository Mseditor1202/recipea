// src/pages/recipes/index.tsx
import React, { useCallback, useEffect, useMemo, useState } from "react";
import type { SyntheticEvent } from "react";
import { useRouter } from "next/router";

import { setDoc, serverTimestamp, doc, updateDoc } from "firebase/firestore";
import { db, auth } from "@/lib/firebase";
import { updateRecipeMemo } from "@/features/recipes/repositories/recipeRepo";
import { listRecipes } from "@/features/recipes";
import { onAuthStateChanged } from "firebase/auth";
import type { Recipe } from "@/features/recipes/types";
import RecipeCard from "@/features/recipes/components/RecipeCard";

import {
  Box,
  Typography,
  Button,
  Chip,
  TextField,
  Stack,
  Divider,
  Snackbar,
  Alert,
} from "@mui/material";
import Grid from "@mui/material/Grid";

import type { AlertColor } from "@mui/material/Alert";
import type { SnackbarCloseReason } from "@mui/material/Snackbar";

/* ===============================
   型
================================ */

type ToastState = {
  open: boolean;
  severity: AlertColor;
  message: string;
};

/* ===============================
   正規化
================================ */
const normalize = (v?: string | null) => (v ?? "").toLowerCase();

/* ===============================
   バリデーション & 表示用
================================ */
const isValidDateKey = (v?: string | null) =>
  /^\d{4}-\d{2}-\d{2}$/.test(v ?? "");

type WeeklyMeal = "breakfast" | "lunch" | "dinner";
type WeeklySlot = "staple" | "main" | "side" | "soup";
type DailySlot = "staple" | "mainDish" | "sideDish" | "soup";

const isWeeklyMeal = (v: string): v is WeeklyMeal =>
  (["breakfast", "lunch", "dinner"] as const).includes(v as WeeklyMeal);

const isWeeklySlot = (v: string): v is WeeklySlot =>
  (["staple", "main", "side", "soup"] as const).includes(v as WeeklySlot);

const isDailySlot = (v: string): v is DailySlot =>
  (["staple", "mainDish", "sideDish", "soup"] as const).includes(
    v as DailySlot,
  );

/* ===============================
   ページ本体
================================ */
export default function RecipesPage() {
  const router = useRouter();
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (user) => {
      setCurrentUserId(user?.uid ?? null);
    });
    return () => unsub();
  }, []);

  /* ===============================
      選択モード判定
  ============================== */
  const mode = typeof router.query?.mode === "string" ? router.query.mode : "";

  // weeklyDay 用
  const dayKey =
    typeof router.query?.dayKey === "string" ? router.query.dayKey : "";
  const meal = typeof router.query?.meal === "string" ? router.query.meal : "";

  // dailySet 用
  const dailySetId =
    typeof router.query?.dailySetId === "string" ? router.query.dailySetId : "";

  // 共通
  const slot = typeof router.query?.slot === "string" ? router.query.slot : "";
  const from = typeof router.query?.from === "string" ? router.query.from : "";

  const selectModeWeeklyDay = mode === "weeklyDay";
  const selectModeDailySet = mode === "dailySet";
  const selectMode = selectModeWeeklyDay || selectModeDailySet;

  const canSelectWeeklyDay =
    selectModeWeeklyDay &&
    isValidDateKey(dayKey) &&
    isWeeklyMeal(meal) &&
    isWeeklySlot(slot);

  const canSelectDailySet =
    selectModeDailySet && !!dailySetId && isDailySlot(slot);

  const canSelect = canSelectWeeklyDay || canSelectDailySet;

  // 表示用チップ文言
  const selectLabel = useMemo(() => {
    if (!selectMode) return "";
    if (selectModeWeeklyDay) {
      return canSelectWeeklyDay
        ? `選択モード：${dayKey} / ${meal} / ${slot}`
        : "選択モード（weeklyDay：パラメータ不足）";
    }
    if (selectModeDailySet) {
      return canSelectDailySet
        ? `選択モード：dailySet / ${dailySetId} / ${slot}`
        : "選択モード（dailySet：パラメータ不足）";
    }
    return "選択モード";
  }, [
    selectMode,
    selectModeWeeklyDay,
    selectModeDailySet,
    canSelectWeeklyDay,
    canSelectDailySet,
    dayKey,
    meal,
    slot,
    dailySetId,
  ]);

  /* ===============================
     state
  ============================== */
  const [recipes, setRecipes] = useState<Recipe[]>([]);
  const [loading, setLoading] = useState(true);

  const [searchText, setSearchText] = useState("");
  const [activeTags, setActiveTags] = useState<string[]>([]);

  //  memo編集用（dailysetと同じ思想）
  const [memoDrafts, setMemoDrafts] = useState<Record<string, string>>({});
  const [savingById, setSavingById] = useState<Record<string, boolean>>({});
  const [selectSaving, setSelectSaving] = useState(false);

  //  Snackbar（Toast）
  const [toast, setToast] = useState<ToastState>({
    open: false,
    severity: "success",
    message: "",
  });

  const openToast = useCallback((severity: AlertColor, message: string) => {
    setToast({ open: true, severity, message });
  }, []);

  const closeToast = useCallback(
    (_event?: SyntheticEvent | Event, reason?: SnackbarCloseReason) => {
      if (reason === "clickaway") return;
      setToast((prev) => ({ ...prev, open: false }));
    },
    [],
  );

  /* ===============================
     取得
  ============================== */
  useEffect(() => {
    // ログイン確定前は何もしない
    if (currentUserId === null) return;

    const run = async () => {
      try {
        const list = await listRecipes();
        console.log("currentUserId", currentUserId);
        console.log("list[0]", list[0]);
        setRecipes(list);

        // memoDrafts 初期化
        setMemoDrafts((prev) => {
          const next = { ...prev };
          list.forEach((r) => {
            if (next[r.id] === undefined) next[r.id] = r.memo ?? "";
          });
          return next;
        });
      } catch (e) {
        console.error(e);
        openToast("error", "レシピ一覧の取得に失敗しました");
      } finally {
        setLoading(false);
      }
    };
    run();
  }, [currentUserId, openToast]);

  /* ===============================
     全タグ一覧
  ============================== */
  const allTags = useMemo(() => {
    const set = new Set<string>();
    recipes.forEach((r) => {
      if (Array.isArray(r.tags)) {
        r.tags.forEach((t) => set.add(t));
      }
    });
    return [...set];
  }, [recipes]);

  /* ===============================
     フィルタ
  ============================== */
  const filtered = useMemo(() => {
    let list = recipes;

    const q = normalize(searchText);

    if (q) {
      list = list.filter((r) => {
        const nameHit = normalize(r.title).includes(q);
        const tagHit =
          Array.isArray(r.tags) && r.tags.some((t) => normalize(t).includes(q));
        return nameHit || tagHit;
      });
    }

    if (activeTags.length > 0) {
      list = list.filter(
        (r) =>
          Array.isArray(r.tags) &&
          activeTags.every((t) => (r.tags ?? []).includes(t)),
      );
    }

    return list;
  }, [recipes, searchText, activeTags]);

  /* ===============================
     タグ操作
  ============================== */
  const toggleTag = useCallback((tag: string) => {
    setActiveTags((prev) =>
      prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag],
    );
  }, []);

  /* ===============================
     memo 編集
  ============================== */
  const handleMemoChange = useCallback((recipeId: string, value: string) => {
    setMemoDrafts((prev) => ({ ...prev, [recipeId]: value }));
  }, []);

  const isDirty = useCallback(
    (recipeDoc: Recipe) => {
      const original = recipeDoc.memo ?? "";
      const draft = memoDrafts[recipeDoc.id] ?? original;
      return draft !== original;
    },
    [memoDrafts],
  );

  const handleSaveMemo = useCallback(
    async (recipeDoc: Recipe) => {
      const recipeId = recipeDoc.id;
      const original = recipeDoc.memo ?? "";
      const draft = memoDrafts[recipeId] ?? original;

      if (draft === original) return;

      setSavingById((prev) => ({ ...prev, [recipeId]: true }));

      try {
        await updateRecipeMemo(recipeId, draft);

        setRecipes((prev) =>
          prev.map((r) => (r.id === recipeId ? { ...r, memo: draft } : r)),
        );
        openToast("success", "保存しました");
      } catch (e) {
        console.error(e);
        openToast(
          "error",
          "保存に失敗しました。通信状況を確認して再度お試しください。",
        );
      } finally {
        setSavingById((prev) => ({ ...prev, [recipeId]: false }));
      }
    },
    [memoDrafts, openToast],
  );

  /* ===============================
      選択モード：戻る
  ============================== */
  const handleBackFromSelectMode = useCallback(() => {
    if (from === "dailyset") {
      router.push("/recipes/dailyset");
      return;
    }
    if (from === "home") {
      router.push("/home");
      return;
    }
    router.back();
  }, [from, router]);

  /* ===============================
      選択モード：セット
  ============================== */
  const handleSelectRecipe = useCallback(
    async (recipeId: string) => {
      if (!canSelect) {
        openToast(
          "error",
          "セット先情報が不足しています。元の画面から入り直してください。",
        );
        return;
      }

      setSelectSaving(true);

      try {
        //  weeklyDaySets にセット
        if (canSelectWeeklyDay) {
          await setDoc(
            doc(db, "weeklyDaySets", dayKey),
            {
              // meal/slot はURL由来なので型は string のまま扱う（実体は上でバリデーション済み）
              [meal]: { [slot]: recipeId },
              updatedAt: serverTimestamp(),
            },
            { merge: true },
          );
        }

        //  dailySets にセット
        if (canSelectDailySet) {
          await updateDoc(doc(db, "dailySets", dailySetId), {
            [slot]: recipeId,
            updatedAt: serverTimestamp(),
          });
        }

        openToast("success", "セットしました");

        //  戻り先制御
        if (from === "home") {
          router.push("/home");
          return;
        }
        if (from === "dailyset") {
          router.push("/recipes/dailyset");
          return;
        }

        router.back();
      } catch (e) {
        console.error(e);
        openToast(
          "error",
          "セットに失敗しました。通信状況を確認して再度お試しください。",
        );
      } finally {
        setSelectSaving(false);
      }
    },
    [
      canSelect,
      canSelectWeeklyDay,
      canSelectDailySet,
      dayKey,
      meal,
      slot,
      dailySetId,
      from,
      router,
      openToast,
    ],
  );

  /* ===============================
     画面
  ============================== */
  return (
    <Box sx={{ maxWidth: 1200, mx: "auto", mt: 4, px: 2 }}>
      <Stack spacing={1} sx={{ mb: 2 }}>
        <Stack
          direction="row"
          alignItems="center"
          justifyContent="space-between"
        >
          <Typography variant="h5" fontWeight={900}>
            レシピ一覧
          </Typography>

          {/*  ここがポイント：選択モードでも「戻る」を出す */}
          {selectMode ? (
            <Stack direction="row" spacing={1} alignItems="center">
              <Chip
                color={canSelect ? "primary" : "default"}
                label={selectLabel}
                sx={{ fontWeight: 900 }}
              />
              <Button
                variant="outlined"
                sx={{
                  borderRadius: 999,
                  textTransform: "none",
                  fontWeight: 900,
                }}
                onClick={handleBackFromSelectMode}
              >
                戻る
              </Button>
            </Stack>
          ) : (
            <Button
              variant="outlined"
              sx={{
                borderRadius: 999,
                textTransform: "none",
                fontWeight: 900,
              }}
              onClick={() => router.push("/home")}
            >
              ホームに戻る
            </Button>
          )}
        </Stack>

        {selectMode && (
          <Typography variant="body2" color="text.secondary">
            「このレシピをセットする」で、元の画面の対象枠に反映されます。
          </Typography>
        )}
      </Stack>

      {/* 🔍 検索 */}
      <TextField
        fullWidth
        label="レシピ名 or タグで検索"
        value={searchText}
        onChange={(e) => setSearchText(e.target.value)}
        sx={{ mb: 2 }}
      />

      {/* 🏷 タグ一覧 */}
      <Stack direction="row" spacing={1} flexWrap="wrap" mb={2}>
        {allTags.map((tag) => {
          const active = activeTags.includes(tag);
          return (
            <Chip
              key={tag}
              label={`#${tag}`}
              clickable
              onClick={() => toggleTag(tag)}
              color={active ? "primary" : "default"}
              variant={active ? "filled" : "outlined"}
              sx={{ fontWeight: active ? 700 : 400, cursor: "pointer" }}
            />
          );
        })}
      </Stack>

      {activeTags.length > 0 && (
        <Stack direction="row" spacing={1} mb={2}>
          <Typography variant="body2">選択中：</Typography>
          {activeTags.map((t) => (
            <Chip
              key={t}
              label={`#${t}`}
              color="primary"
              onDelete={() => toggleTag(t)}
            />
          ))}
        </Stack>
      )}

      <Divider sx={{ mb: 3 }} />

      {/* 一覧 */}
      <Grid container spacing={3}>
        {filtered.map((recipe) => {
          const ownerId = recipe.userId;
          if (recipe.id === filtered[0]?.id) {
            console.log("debug recipe", { ownerId, currentUserId, recipe });
          }
          const canEdit = !!ownerId && ownerId === currentUserId;

          const dirty = isDirty(recipe);
          const draft = memoDrafts[recipe.id] ?? recipe.memo ?? "";

          return (
            <Grid size={{ xs: 12, sm: 6, md: 4 }} key={recipe.id}>
              <RecipeCard
                recipe={recipe}
                canEdit={canEdit}
                selectMode={selectMode}
                canSelect={canSelect}
                selectSaving={selectSaving}
                draft={draft}
                dirty={dirty}
                saving={savingById[recipe.id] ?? false}
                onDetail={() => {
                  if (selectMode) {
                    const back = router.asPath;
                    router.push(
                      `/recipes/${recipe.id}?back=${encodeURIComponent(back)}`,
                    );
                    return;
                  }
                  router.push(`/recipes/${recipe.id}`);
                }}
                onEdit={() => router.push(`/recipes/edit/${recipe.id}`)}
                onSelect={() => handleSelectRecipe(recipe.id)}
                onMemoChange={(v) => handleMemoChange(recipe.id, v)}
                onSaveMemo={() => handleSaveMemo(recipe)}
              />
            </Grid>
          );
        })}
      </Grid>

      {!loading && filtered.length === 0 && (
        <Typography color="text.secondary" mt={3}>
          該当するレシピがありません
        </Typography>
      )}

      {/*  Snackbar Toast */}
      <Snackbar
        open={toast.open}
        autoHideDuration={2500}
        onClose={closeToast}
        anchorOrigin={{ vertical: "bottom", horizontal: "right" }}
      >
        <Alert
          onClose={closeToast}
          severity={toast.severity}
          variant="filled"
          sx={{ borderRadius: 2 }}
        >
          {toast.message}
        </Alert>
      </Snackbar>
    </Box>
  );
}
