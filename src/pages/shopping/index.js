// pages/shopping/index.jsx
import { useEffect, useMemo, useState, useCallback } from "react";
import NextLink from "next/link";
import { useRouter } from "next/router";
import {
  Box,
  Typography,
  Stack,
  Card,
  CardContent,
  Button,
  TextField,
  Chip,
  Divider,
  List,
  ListItem,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  Checkbox,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  Skeleton,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  ToggleButtonGroup,
  ToggleButton,
  Alert,
  Snackbar,
  Tooltip,
  IconButton,
  Collapse,
  CircularProgress,
} from "@mui/material";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import ExpandLessIcon from "@mui/icons-material/ExpandLess";
import NotesIcon from "@mui/icons-material/Notes";
import InfoOutlinedIcon from "@mui/icons-material/InfoOutlined";

import { auth } from "@/lib/firebase";
import { getCategoryExpireRules, getFridgeLotsByUser } from "@/lib/fridge";
import {
  getShoppingItemsByUser,
  addShoppingItem,
  setShoppingItemSkip,
  setShoppingItemMemo,
  syncActiveItemsToFridge,
  getUserPlan,
  generateShoppingDraftFromPlans,
} from "@/lib/shopping";

/** =========================
 * helpers
 ========================= */

const isWithinDays = (date, days) => {
  if (!date) return false;
  const now = new Date();
  const diff = now.getTime() - new Date(date).getTime();
  return diff <= days * 24 * 60 * 60 * 1000;
};

const formatDateJP = (date) => {
  if (!date) return "";
  const d = date instanceof Date ? date : new Date(date);
  return d.toLocaleDateString("ja-JP", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
};

const MEAL_LABEL = { breakfast: "朝", lunch: "昼", dinner: "夜" };
const SLOT_LABEL = { staple: "主食", main: "主菜", side: "副菜", soup: "汁物" };

const sourceLine = (src) => {
  const day = src?.dayKey ? src.dayKey.slice(5).replace("-", "/") : "";
  const meal = MEAL_LABEL[src?.mealKey] || "";
  const slot = SLOT_LABEL[src?.slotKey] || "";
  const recipe = src?.recipeName || "（不明）";
  const raw = src?.rawText || "";
  return `${day} ${meal}${slot}｜${recipe}${raw ? `：${raw}` : ""}`;
};

// fridgeLots を name完全一致で簡易判定（思想どおり：管理対象じゃない）
function buildFridgeNameIndex(fridgeLots) {
  const map = new Map();
  const rank = { NONE: 0, FEW: 1, HAVE: 2 };

  for (const lot of fridgeLots || []) {
    const name = String(lot.foodNameSnapshot || "").trim();
    if (!name) continue;

    const key = name.toLowerCase();
    const state = lot.state || "HAVE";
    const prev = map.get(key);
    if (!prev) map.set(key, state);
    else if ((rank[state] ?? 2) > (rank[prev] ?? 2)) map.set(key, state);
  }
  return map;
}

function getFridgeStateForName(index, name) {
  if (!name) return "UNKNOWN";
  return index.get(String(name).trim().toLowerCase()) || "UNKNOWN";
}

const fridgeBadge = (state) => {
  switch (state) {
    case "HAVE":
      return { label: "在庫: ある", color: "success", variant: "filled" };
    case "FEW":
      return { label: "在庫: すこし", color: "warning", variant: "filled" };
    case "NONE":
      return { label: "在庫: なし", color: "error", variant: "filled" };
    default:
      return { label: "在庫: 不明", color: "default", variant: "outlined" };
  }
};

// 1件ずつ展開状態保持（上限なし）
const OPEN_KEY = (userId) => `shoppingOpenMap:${userId}`;
function loadOpenMap(userId) {
  if (!userId) return {};
  try {
    const raw = localStorage.getItem(OPEN_KEY(userId));
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}
function saveOpenMap(userId, openMap) {
  if (!userId) return;
  try {
    localStorage.setItem(OPEN_KEY(userId), JSON.stringify(openMap || {}));
  } catch {
    // ignore
  }
}

/** =========================
 * Page
 ========================= */
export default function ShoppingPage() {
  const router = useRouter();
  const [user, setUser] = useState(null);

  const [loading, setLoading] = useState(true);
  const [rulesLoading, setRulesLoading] = useState(true);

  const [items, setItems] = useState([]);
  const [rules, setRules] = useState([]);

  // plan
  const [planInfo, setPlanInfo] = useState({ plan: "FREE", retentionDays: 7 });

  // add form
  const [name, setName] = useState("");
  const [selectedCategoryId, setSelectedCategoryId] = useState("");
  const [customExpireDays, setCustomExpireDays] = useState("3");

  // syncing
  const [syncing, setSyncing] = useState(false);

  // generate draft dialog
  const [genOpen, setGenOpen] = useState(false);
  const [genDays, setGenDays] = useState(2);
  const [genBusy, setGenBusy] = useState(false);
  const [genError, setGenError] = useState("");

  // in-page errors
  const [error, setError] = useState("");

  // 展開状態
  const [openMap, setOpenMap] = useState({});

  // memo local draft
  const [memoDraft, setMemoDraft] = useState({}); // { [itemId]: string }
  const [memoSaving, setMemoSaving] = useState({}); // { [itemId]: bool }
  const [skipSaving, setSkipSaving] = useState({}); // { [itemId]: bool }

  // toast
  const [toast, setToast] = useState({ open: false, msg: "", sev: "success" });
  const showToast = useCallback((msg, sev = "success") => {
    setToast({ open: true, msg, sev });
  }, []);

  // auth
  useEffect(() => {
    const unsub = auth.onAuthStateChanged((u) => setUser(u));
    return () => unsub();
  }, []);

  // load rules once logged in
  useEffect(() => {
    if (!user) return;
    (async () => {
      setRulesLoading(true);
      const r = await getCategoryExpireRules();
      setRules(r);
      if (!selectedCategoryId && r.length > 0) setSelectedCategoryId(r[0].id);
      setRulesLoading(false);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  // refresh
  const refresh = useCallback(async () => {
    if (!user) return;

    setLoading(true);
    setError("");

    try {
      // plan + shopping items
      const p = await getUserPlan(user.uid);
      setPlanInfo(p);

      const list = await getShoppingItemsByUser(user.uid);

      // fridge state (A案：都度取得して簡易判定)
      const fridgeLots = await getFridgeLotsByUser(user.uid);
      const index = buildFridgeNameIndex(fridgeLots);

      const decorated = list.map((it) => ({
        ...it,
        fridgeState: getFridgeStateForName(index, it.name),
      }));

      setItems(decorated);

      // openMap restore
      setOpenMap(loadOpenMap(user.uid));

      // memoDraft init
      const md = {};
      decorated.forEach((it) => {
        md[it.id] = it.memo || "";
      });
      setMemoDraft(md);
    } catch (e) {
      console.error(e);
      setError("買い物リストを読み込めませんでした。");
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    if (!user) return;
    refresh();
  }, [user, refresh]);

  // openMap persist
  useEffect(() => {
    if (!user) return;
    saveOpenMap(user.uid, openMap);
  }, [openMap, user]);

  const selectedRule = rules.find((r) => r.id === selectedCategoryId);
  const isCustomSelected = selectedCategoryId === "custom";
  const customDaysValid =
    !isCustomSelected ||
    (Number(customExpireDays) > 0 && Number.isFinite(Number(customExpireDays)));

  // split
  const { activeItems, historyItems } = useMemo(() => {
    const active = [];
    const history = [];

    for (const it of items) {
      if (it.status === "SYNCED") {
        // 履歴は保持期間内だけ表示（FREE=7 / PRO=90）
        if (isWithinDays(it.syncedAt, planInfo.retentionDays)) history.push(it);
      } else {
        active.push(it);
      }
    }

    // history: syncedAt 新しい順
    history.sort(
      (a, b) => (b.syncedAt?.getTime?.() || 0) - (a.syncedAt?.getTime?.() || 0)
    );

    return { activeItems: active, historyItems: history };
  }, [items, planInfo.retentionDays]);

  const counts = useMemo(() => {
    const total = activeItems.length;
    const skipped = activeItems.filter((x) => x.skip).length;
    const buy = total - skipped;

    const have = activeItems.filter((x) => x.fridgeState === "HAVE").length;
    const few = activeItems.filter((x) => x.fridgeState === "FEW").length;
    const none = activeItems.filter((x) => x.fridgeState === "NONE").length;
    const unk = activeItems.filter((x) => x.fridgeState === "UNKNOWN").length;

    return { total, skipped, buy, have, few, none, unk };
  }, [activeItems]);

  const pendingSyncItems = useMemo(() => {
    // 冷蔵庫に反映するのは「skip=false」かつ未反映のみ
    return activeItems.filter((x) => !x.skip && !x.syncedToFridge);
  }, [activeItems]);

  const addItem = async () => {
    if (!user) return;
    const n = (name || "").trim();
    if (!n) return;
    if (!selectedRule) return;
    if (!customDaysValid) return;

    await addShoppingItem({
      userId: user.uid,
      name: n,
      categoryId: selectedRule.id,
      categoryLabelSnapshot: selectedRule.label,
      customExpireDays:
        selectedRule.id === "custom" ? Number(customExpireDays || 3) : null,
    });

    setName("");
    await refresh();
  };

  const toggleOpen = (itemId) => {
    setOpenMap((prev) => ({ ...(prev || {}), [itemId]: !prev?.[itemId] }));
  };

  const toggleSkip = async (it) => {
    const next = !it.skip;

    // optimistic
    setItems((prev) =>
      prev.map((x) => (x.id === it.id ? { ...x, skip: next } : x))
    );
    setSkipSaving((p) => ({ ...p, [it.id]: true }));

    try {
      await setShoppingItemSkip(it.id, next);
    } catch (e) {
      console.error(e);
      // rollback
      setItems((prev) =>
        prev.map((x) => (x.id === it.id ? { ...x, skip: !next } : x))
      );
      showToast("更新に失敗しました", "error");
    } finally {
      setSkipSaving((p) => ({ ...p, [it.id]: false }));
    }
  };

  const onChangeMemo = (itemId, v) => {
    setMemoDraft((prev) => ({ ...prev, [itemId]: v }));
  };

  const saveMemo = async (it) => {
    const v = memoDraft[it.id] ?? "";

    setMemoSaving((p) => ({ ...p, [it.id]: true }));
    try {
      await setShoppingItemMemo(it.id, v);

      // items側も更新して整合
      setItems((prev) =>
        prev.map((x) => (x.id === it.id ? { ...x, memo: v } : x))
      );

      showToast("メモを保存しました", "success");
    } catch (e) {
      console.error(e);
      showToast("メモの保存に失敗しました", "error");
    } finally {
      setMemoSaving((p) => ({ ...p, [it.id]: false }));
    }
  };

  const syncToFridge = async () => {
    if (!user) return;
    if (pendingSyncItems.length === 0) return;
    setSyncing(true);

    try {
      await syncActiveItemsToFridge({
        userId: user.uid,
        items: pendingSyncItems,
      });
      await refresh();
    } finally {
      setSyncing(false);
    }
  };

  const onGenerateDraft = async () => {
    if (!user) return;
    setGenBusy(true);
    setGenError("");
    try {
      const { sessionId } = await generateShoppingDraftFromPlans({
        userId: user.uid,
        rangeDays: genDays,
      });
      setGenOpen(false);
      router.push(`/shopping/draft/${sessionId}`);
    } catch (e) {
      console.error(e);
      setGenError(
        "献立から生成できませんでした。献立/レシピ/材料の設定を確認してください。"
      );
    } finally {
      setGenBusy(false);
    }
  };

  const pageWrapSx = { maxWidth: 980, mx: "auto", px: 2, pt: 2, pb: 6 };

  if (!user) {
    return (
      <Box sx={{ p: 3 }}>
        <Typography variant="h6" fontWeight={900}>
          ログインしてください
        </Typography>
        <Typography variant="body2" sx={{ mt: 1, opacity: 0.75 }}>
          買い物リストはユーザーごとに保存されます。
        </Typography>
      </Box>
    );
  }

  return (
    <Box sx={pageWrapSx}>
      {/* header */}
      <Stack spacing={0.8} sx={{ mb: 2 }}>
        <Stack
          direction={{ xs: "column", sm: "row" }}
          spacing={1}
          justifyContent="space-between"
          alignItems={{ xs: "flex-start", sm: "center" }}
        >
          <Box>
            <Typography variant="h5" fontWeight={950}>
              買い物リスト
            </Typography>
            <Typography variant="body2" sx={{ opacity: 0.75, lineHeight: 1.7 }}>
              ✅「今回は買わない」をONにしたものは <b>冷蔵庫に追加しません</b>。
              展開すると「何の献立で使うか」「数量（rawText）」とメモが見れます。
            </Typography>
          </Box>

          <Stack direction="row" spacing={1}>
            <Button
              variant="contained"
              onClick={() => setGenOpen(true)}
              sx={{
                borderRadius: 999,
                fontWeight: 950,
                px: 2.4,
                py: 1.1,
                textTransform: "none",
              }}
            >
              献立から生成
            </Button>
            <Button
              component={NextLink}
              href="/recipes/weekly"
              variant="outlined"
              sx={{
                borderRadius: 999,
                fontWeight: 950,
                px: 2.2,
                py: 1.1,
                textTransform: "none",
              }}
            >
              献立を確認
            </Button>
          </Stack>
        </Stack>

        <Stack direction="row" flexWrap="wrap" gap={1}>
          <Chip
            label={`買う ${counts.buy}件`}
            color="primary"
            sx={{ fontWeight: 900 }}
          />
          <Chip
            label={`今回は買わない ${counts.skipped}件`}
            variant="outlined"
            sx={{ fontWeight: 900 }}
          />
          <Tooltip title="在庫ステータス（完全一致の簡易判定）">
            <Chip
              icon={<InfoOutlinedIcon />}
              label={`在庫: ある${counts.have} / すこし${counts.few} / なし${counts.none} / 不明${counts.unk}`}
              variant="outlined"
              sx={{ fontWeight: 900 }}
            />
          </Tooltip>
          <Chip
            label={`履歴表示: ${planInfo.plan === "PRO" ? "90日" : "7日"}（${
              planInfo.plan
            }）`}
            variant="outlined"
            sx={{ fontWeight: 900 }}
          />
        </Stack>
      </Stack>

      {/* error */}
      {error && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {error}
        </Alert>
      )}

      {/* add card */}
      <Card sx={{ borderRadius: 3, mb: 2 }}>
        <CardContent>
          <Typography fontWeight={950} sx={{ mb: 1 }}>
            手動で追加
          </Typography>

          <Stack spacing={1.5}>
            <TextField
              fullWidth
              label="買うもの（自由入力）"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />

            <Box>
              <Typography variant="subtitle2" sx={{ mb: 1, fontWeight: 900 }}>
                カテゴリ（冷蔵庫期限テンプレ）
              </Typography>

              {rulesLoading ? (
                <Stack direction="row" spacing={1}>
                  <Skeleton variant="rounded" width={120} height={32} />
                  <Skeleton variant="rounded" width={120} height={32} />
                  <Skeleton variant="rounded" width={120} height={32} />
                </Stack>
              ) : (
                <Stack direction="row" flexWrap="wrap" gap={1}>
                  {rules.map((r) => {
                    const selected = r.id === selectedCategoryId;
                    const label =
                      r.id === "custom"
                        ? r.label
                        : `${r.label}（${r.defaultExpireDays}日）`;

                    return (
                      <Chip
                        key={r.id}
                        label={label}
                        clickable
                        color={selected ? "primary" : "default"}
                        variant={selected ? "filled" : "outlined"}
                        onClick={() => setSelectedCategoryId(r.id)}
                        sx={{ fontWeight: 900 }}
                      />
                    );
                  })}
                </Stack>
              )}

              {isCustomSelected && (
                <Box sx={{ mt: 1.5 }}>
                  <Divider sx={{ mb: 1.5 }} />
                  <TextField
                    fullWidth
                    type="number"
                    label="期限（残り日数）"
                    value={customExpireDays}
                    onChange={(e) => setCustomExpireDays(e.target.value)}
                    inputProps={{ min: 1, step: 1 }}
                    error={!customDaysValid}
                    helperText={
                      !customDaysValid
                        ? "1以上の数字を入れてね"
                        : "例：3（冷蔵庫に追加した日から3日後が期限）"
                    }
                  />
                </Box>
              )}
            </Box>

            <Box sx={{ display: "flex", justifyContent: "flex-end" }}>
              <Button
                variant="contained"
                onClick={addItem}
                disabled={!name.trim() || !selectedRule || !customDaysValid}
                sx={{ borderRadius: 999, fontWeight: 900, px: 3, py: 1.1 }}
              >
                ＋ 追加
              </Button>
            </Box>
          </Stack>
        </CardContent>
      </Card>

      {/* main list */}
      <Card sx={{ borderRadius: 3 }}>
        <CardContent>
          <Stack
            direction="row"
            alignItems="center"
            justifyContent="space-between"
            sx={{ mb: 1 }}
          >
            <Typography fontWeight={950}>買うもの</Typography>
            <Chip
              size="small"
              color="primary"
              label={`冷蔵庫に反映予定 ${pendingSyncItems.length}`}
            />
          </Stack>

          {loading ? (
            <Stack spacing={1}>
              <Skeleton variant="rounded" height={72} />
              <Skeleton variant="rounded" height={72} />
              <Skeleton variant="rounded" height={72} />
            </Stack>
          ) : activeItems.length === 0 ? (
            <Typography variant="body2" sx={{ opacity: 0.75 }}>
              まだ何もありません。上のフォームから追加できます。
            </Typography>
          ) : (
            <List disablePadding>
              {activeItems.map((it) => {
                const isOpen = !!openMap[it.id];
                const badge = fridgeBadge(it.fridgeState);
                const memoValue = memoDraft[it.id] ?? "";
                const memoChanged = (it.memo || "") !== memoValue;
                const memoBusy = !!memoSaving[it.id];
                const skipBusy = !!skipSaving[it.id];

                const secondary = it.categoryLabelSnapshot
                  ? it.categoryId === "custom"
                    ? `${it.categoryLabelSnapshot}（期限 ${
                        it.customExpireDays || 3
                      }日）`
                    : it.categoryLabelSnapshot
                  : "";

                return (
                  <Box key={it.id}>
                    <ListItem
                      disablePadding
                      sx={{
                        borderRadius: 2,
                        mb: 0.6,
                        bgcolor: it.skip ? "rgba(0,0,0,0.02)" : "transparent",
                        "&:hover": { bgcolor: "rgba(0,0,0,0.03)" },
                      }}
                    >
                      <ListItemButton
                        sx={{
                          borderRadius: 2,
                          alignItems: "flex-start",
                          py: 1.2,
                        }}
                        onClick={() => toggleOpen(it.id)}
                      >
                        <ListItemIcon sx={{ minWidth: 44, mt: 0.2 }}>
                          <Tooltip title="今回は買わない（冷蔵庫にも反映しない）">
                            <span>
                              <Checkbox
                                edge="start"
                                checked={!!it.skip}
                                disabled={skipBusy}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  if (!skipBusy) toggleSkip(it);
                                }}
                              />
                            </span>
                          </Tooltip>
                        </ListItemIcon>

                        <ListItemText
                          primary={
                            <Stack
                              direction="row"
                              alignItems="center"
                              spacing={1}
                              flexWrap="wrap"
                              sx={{ pr: 1 }}
                            >
                              <Typography
                                sx={{
                                  fontWeight: 950,
                                  textDecoration: it.skip
                                    ? "line-through"
                                    : "none",
                                }}
                              >
                                {it.name}
                              </Typography>

                              <Chip
                                size="small"
                                label={badge.label}
                                color={badge.color}
                                variant={badge.variant}
                                sx={{ fontWeight: 900 }}
                              />

                              {it.skip ? (
                                <Chip
                                  size="small"
                                  label="今回は買わない"
                                  variant="outlined"
                                  sx={{ fontWeight: 900 }}
                                />
                              ) : (
                                <Chip
                                  size="small"
                                  label="買う"
                                  color="primary"
                                  sx={{ fontWeight: 900 }}
                                />
                              )}

                              {skipBusy && (
                                <Chip
                                  size="small"
                                  label="更新中..."
                                  variant="outlined"
                                />
                              )}
                            </Stack>
                          }
                          secondary={
                            <Stack spacing={0.3} sx={{ mt: 0.4 }}>
                              <Typography
                                variant="body2"
                                sx={{ opacity: 0.75 }}
                              >
                                {secondary || "カテゴリ未設定"}
                              </Typography>
                              <Typography
                                variant="body2"
                                sx={{ opacity: 0.75 }}
                              >
                                {it.sources?.length
                                  ? `由来: ${it.sources.length}件`
                                  : "由来: なし"}
                              </Typography>
                            </Stack>
                          }
                        />

                        <IconButton
                          onClick={(e) => {
                            e.stopPropagation();
                            toggleOpen(it.id);
                          }}
                          sx={{ mt: 0.2 }}
                        >
                          {isOpen ? <ExpandLessIcon /> : <ExpandMoreIcon />}
                        </IconButton>
                      </ListItemButton>
                    </ListItem>

                    {/* expanded */}
                    <Collapse in={isOpen} timeout="auto" unmountOnExit={false}>
                      <Box
                        sx={{
                          px: 2,
                          pb: 1.6,
                          pt: 0.4,
                          mb: 1.1,
                          borderRadius: 2,
                          bgcolor: "rgba(0,0,0,0.02)",
                          border: "1px solid rgba(0,0,0,0.06)",
                        }}
                      >
                        {/* sources */}
                        <Stack spacing={0.8} sx={{ mb: 1.4 }}>
                          <Stack
                            direction="row"
                            spacing={0.8}
                            alignItems="center"
                          >
                            <InfoOutlinedIcon fontSize="small" />
                            <Typography fontWeight={950}>
                              使う予定の献立（由来）
                            </Typography>
                            <Chip
                              size="small"
                              label={`${it.sources?.length || 0}件`}
                              variant="outlined"
                            />
                          </Stack>

                          {it.sources?.length ? (
                            <Box
                              sx={{
                                borderRadius: 2,
                                bgcolor: "#fff",
                                border: "1px solid rgba(0,0,0,0.06)",
                                p: 1.2,
                              }}
                            >
                              <Stack spacing={0.6}>
                                {it.sources.map((s, idx) => (
                                  <Typography
                                    key={`${it.id}-src-${idx}`}
                                    variant="body2"
                                    sx={{ opacity: 0.85, lineHeight: 1.6 }}
                                  >
                                    ・{sourceLine(s)}
                                  </Typography>
                                ))}
                              </Stack>
                            </Box>
                          ) : (
                            <Typography variant="body2" sx={{ opacity: 0.75 }}>
                              由来情報がありません（手動追加 or
                              材料テキストのみの可能性）
                            </Typography>
                          )}
                        </Stack>

                        {/* memo */}
                        <Stack spacing={0.8} sx={{ mb: 0.6 }}>
                          <Stack
                            direction="row"
                            spacing={0.8}
                            alignItems="center"
                          >
                            <NotesIcon fontSize="small" />
                            <Typography fontWeight={950}>メモ</Typography>
                            {memoChanged && (
                              <Chip
                                size="small"
                                label="未保存"
                                color="warning"
                              />
                            )}
                          </Stack>

                          <TextField
                            fullWidth
                            multiline
                            minRows={2}
                            placeholder="例：特売で買う / なくてもOK / 代替：冷凍でも可"
                            value={memoValue}
                            onChange={(e) =>
                              onChangeMemo(it.id, e.target.value)
                            }
                            sx={{ bgcolor: "#fff", borderRadius: 2 }}
                          />

                          <Stack
                            direction="row"
                            spacing={1}
                            justifyContent="flex-end"
                          >
                            <Button
                              onClick={() => saveMemo(it)}
                              disabled={!memoChanged || memoBusy}
                              variant="contained"
                              sx={{
                                borderRadius: 999,
                                fontWeight: 950,
                                textTransform: "none",
                                px: 2.6,
                              }}
                            >
                              {memoBusy ? "保存中..." : "メモ保存"}
                            </Button>
                          </Stack>
                        </Stack>

                        <Typography variant="caption" sx={{ opacity: 0.7 }}>
                          ※
                          在庫ステータスは「完全一致の簡易判定」です（揺れは後回しでOK）。
                        </Typography>
                      </Box>
                    </Collapse>
                  </Box>
                );
              })}
            </List>
          )}

          <Box sx={{ display: "flex", justifyContent: "center", mt: 2 }}>
            <Button
              variant="contained"
              onClick={syncToFridge}
              disabled={pendingSyncItems.length === 0 || syncing}
              sx={{
                borderRadius: 999,
                fontWeight: 950,
                px: 3.5,
                py: 1.2,
                minWidth: 260,
                boxShadow: 3,
                textTransform: "none",
              }}
            >
              {syncing ? (
                <Stack direction="row" spacing={1} alignItems="center">
                  <CircularProgress size={18} />
                  <span>反映中...</span>
                </Stack>
              ) : pendingSyncItems.length === 0 ? (
                "反映対象がありません"
              ) : (
                `冷蔵庫に追加（${pendingSyncItems.length}件）`
              )}
            </Button>
          </Box>
        </CardContent>
      </Card>

      {/* history */}
      <Box sx={{ mt: 2 }}>
        <Accordion disableGutters sx={{ borderRadius: 3, overflow: "hidden" }}>
          <AccordionSummary expandIcon={<ExpandMoreIcon />}>
            <Stack direction="row" spacing={1} alignItems="center">
              <Typography fontWeight={950}>
                履歴（{planInfo.retentionDays}日以内）
              </Typography>
              <Chip size="small" label={`${historyItems.length}件`} />
            </Stack>
          </AccordionSummary>

          <AccordionDetails>
            {historyItems.length === 0 ? (
              <Typography variant="body2" sx={{ opacity: 0.75 }}>
                まだ履歴がありません。
              </Typography>
            ) : (
              <List disablePadding>
                {historyItems.map((it) => (
                  <ListItem
                    key={it.id}
                    sx={{
                      borderRadius: 2,
                      mb: 0.5,
                      bgcolor: "rgba(0,0,0,0.02)",
                    }}
                  >
                    <ListItemIcon>
                      <Checkbox checked disabled />
                    </ListItemIcon>
                    <ListItemText
                      primary={
                        <Typography sx={{ fontWeight: 900 }}>
                          {it.name}
                        </Typography>
                      }
                      secondary={`冷蔵庫に追加：${formatDateJP(
                        it.syncedAt
                      )} / ${it.categoryLabelSnapshot || ""}`}
                    />
                    <Chip size="small" label="追加済み" />
                  </ListItem>
                ))}
              </List>
            )}
          </AccordionDetails>
        </Accordion>
      </Box>

      {/* Generate Draft Dialog */}
      <Dialog
        open={genOpen}
        onClose={() => (!genBusy ? setGenOpen(false) : null)}
        fullWidth
        maxWidth="sm"
      >
        <DialogTitle sx={{ fontWeight: 950 }}>
          献立から買い物リストを生成
        </DialogTitle>
        <DialogContent>
          <Stack spacing={1.5} sx={{ mt: 1 }}>
            <Typography variant="body2" sx={{ opacity: 0.8, lineHeight: 1.7 }}>
              明日から <b>{genDays}日分</b>{" "}
              の献立から材料を集めてドラフトを作ります。
              在庫が「ある（HAVE）」のものは初期で「今回は買わない」になります。
            </Typography>

            <Box>
              <Typography fontWeight={900} sx={{ mb: 1 }}>
                対象期間
              </Typography>
              <ToggleButtonGroup
                exclusive
                value={genDays}
                onChange={(_, v) => v && setGenDays(v)}
              >
                <ToggleButton value={2} sx={{ fontWeight: 950 }}>
                  2日
                </ToggleButton>
                <ToggleButton value={3} sx={{ fontWeight: 950 }}>
                  3日
                </ToggleButton>
              </ToggleButtonGroup>
            </Box>

            {genError && <Alert severity="error">{genError}</Alert>}
          </Stack>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button
            onClick={() => setGenOpen(false)}
            disabled={genBusy}
            sx={{ fontWeight: 900 }}
          >
            キャンセル
          </Button>
          <Button
            onClick={onGenerateDraft}
            variant="contained"
            disabled={genBusy}
            sx={{
              borderRadius: 999,
              fontWeight: 950,
              px: 3,
              textTransform: "none",
            }}
          >
            {genBusy ? "生成中..." : "ドラフトを作る"}
          </Button>
        </DialogActions>
      </Dialog>

      <Snackbar
        open={toast.open}
        autoHideDuration={2500}
        onClose={() => setToast((p) => ({ ...p, open: false }))}
        anchorOrigin={{ vertical: "bottom", horizontal: "center" }}
      >
        <Alert
          onClose={() => setToast((p) => ({ ...p, open: false }))}
          severity={toast.sev}
          sx={{ width: "100%", fontWeight: 900 }}
        >
          {toast.msg}
        </Alert>
      </Snackbar>
    </Box>
  );
}
