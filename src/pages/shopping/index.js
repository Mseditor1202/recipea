// pages/shopping/index.js
import React, {
  useEffect,
  useMemo,
  useState,
  useCallback,
  useRef,
} from "react";
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
  IconButton,
  Skeleton,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Alert,
  Tooltip,
  CircularProgress,
  Switch,
  FormControlLabel,
} from "@mui/material";

import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import ExpandLessIcon from "@mui/icons-material/ExpandLess";
import NotesIcon from "@mui/icons-material/Notes";
import InfoOutlinedIcon from "@mui/icons-material/InfoOutlined";
import DeleteOutlineIcon from "@mui/icons-material/DeleteOutline";
import DoneAllIcon from "@mui/icons-material/DoneAll";

import { auth } from "@/lib/firebase";
import {
  getShoppingItemsByUser,
  addShoppingItem,
  setShoppingItemSkip,
  setShoppingItemMemo,
  syncActiveItemsToFridge,
  generateShoppingDraftFromPlans,
  deleteShoppingItem,
  markAllPurchased,
  deleteAllShoppingItems,
  setShoppingItemPurchased,
  getShoppingNotesByUser,
  setShoppingNotesByUser,
} from "@/lib/shopping";

// ------- UI helpers -------
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

// 展開状態保持
const OPEN_KEY = "shoppingOpenMap:v2";
const loadOpenMap = () => {
  try {
    const raw = localStorage.getItem(OPEN_KEY);
    return raw ? JSON.parse(raw) || {} : {};
  } catch {
    return {};
  }
};
const saveOpenMap = (map) => {
  try {
    localStorage.setItem(OPEN_KEY, JSON.stringify(map || {}));
  } catch {}
};

// ✅ Draft からの「追加件数」受け取りキー（クエリを使わない）
const SHOPPING_ADDED_KEY = "shoppingAddedCount:v1";

export default function ShoppingPage() {
  const router = useRouter();

  const [user, setUser] = useState(null);

  const [loading, setLoading] = useState(true);
  const [items, setItems] = useState([]);

  const [name, setName] = useState("");

  const [notes, setNotes] = useState("");
  const [notesBusy, setNotesBusy] = useState(false);

  const [openMap, setOpenMap] = useState({});
  const toggleOpen = (id) =>
    setOpenMap((p) => ({ ...(p || {}), [id]: !p?.[id] }));

  const [memoDraft, setMemoDraft] = useState({});
  const [memoSaving, setMemoSaving] = useState({});
  const [skipSaving, setSkipSaving] = useState({});
  const [purchasedSaving, setPurchasedSaving] = useState({});
  const [deleteBusy, setDeleteBusy] = useState({});

  const [syncing, setSyncing] = useState(false);

  const [genOpen, setGenOpen] = useState(false);
  const [genDays, setGenDays] = useState(2);
  const [genBusy, setGenBusy] = useState(false);
  const [genError, setGenError] = useState("");

  const [bulkBusy, setBulkBusy] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);

  // ✅ UIフリーズ（Tooltip/展開抑制）
  const [uiFreezing, setUiFreezing] = useState(false);

  // ✅ 自前Toast（Portal/Transitionなし）
  const [toast, setToast] = useState({ open: false, msg: "", sev: "success" });
  const toastTimerRef = useRef(null);
  const showToast = useCallback((msg, sev = "success") => {
    setToast({ open: true, msg, sev });
    if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    toastTimerRef.current = setTimeout(() => {
      setToast((p) => ({ ...p, open: false }));
    }, 2500);
  }, []);
  useEffect(() => {
    return () => {
      if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    };
  }, []);

  // auth
  useEffect(() => {
    const unsub = auth.onAuthStateChanged((u) => setUser(u));
    return () => unsub();
  }, []);

  // restore open map
  useEffect(() => {
    setOpenMap(loadOpenMap());
  }, []);
  useEffect(() => {
    saveOpenMap(openMap);
  }, [openMap]);

  // ✅ Draft確定後トースト：sessionStorage から読む
  useEffect(() => {
    try {
      const v = sessionStorage.getItem(SHOPPING_ADDED_KEY);
      if (!v) return;
      sessionStorage.removeItem(SHOPPING_ADDED_KEY);
      const n = Number(v || 0);
      if (n > 0) showToast(`買い物リストに追加しました（${n}件）`, "success");
    } catch {}
  }, [showToast]);

  const refresh = useCallback(async () => {
    if (!user) return;
    setLoading(true);

    try {
      const list = await getShoppingItemsByUser(user.uid);
      setItems(list);

      const md = {};
      list.forEach((it) => (md[it.id] = it.memo || ""));
      setMemoDraft(md);
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    if (!user) return;
    refresh();
  }, [user, refresh]);

  // notes load
  useEffect(() => {
    if (!user) return;
    (async () => {
      try {
        const v = await getShoppingNotesByUser(user.uid);
        setNotes(v);
      } catch (e) {
        console.error(e);
      }
    })();
  }, [user]);

  // notes autosave
  useEffect(() => {
    if (!user) return;

    const t = setTimeout(async () => {
      try {
        setNotesBusy(true);
        await setShoppingNotesByUser(user.uid, notes);
      } catch (e) {
        console.error(e);
      } finally {
        setNotesBusy(false);
      }
    }, 600);

    return () => clearTimeout(t);
  }, [notes, user]);

  const activeItems = useMemo(
    () => items.filter((x) => x.status !== "SYNCED"),
    [items]
  );

  const skipCount = useMemo(
    () => activeItems.filter((x) => x.skip).length,
    [activeItems]
  );
  const boughtCount = useMemo(
    () => activeItems.filter((x) => x.purchased).length,
    [activeItems]
  );
  const unboughtCount = useMemo(
    () => activeItems.filter((x) => !x.skip && !x.purchased).length,
    [activeItems]
  );

  const pendingSyncItems = useMemo(
    () => activeItems.filter((x) => !x.skip && !x.syncedToFridge),
    [activeItems]
  );

  const safeTooltipProps = {
    PopperProps: { disablePortal: true },
    disableHoverListener: uiFreezing,
    disableFocusListener: uiFreezing,
    disableTouchListener: uiFreezing,
  };

  const addItem = async () => {
    if (!user) return;
    const n = (name || "").trim();
    if (!n) return;

    try {
      await addShoppingItem({
        userId: user.uid,
        name: n,
        categoryId: "custom",
        categoryLabelSnapshot: "カスタム",
        customExpireDays: 3,
        memo: "",
        sources: [],
      });

      setName("");
      await refresh();
      showToast("追加しました");
    } catch (e) {
      console.error(e);
      showToast("追加に失敗しました", "error");
    }
  };

  const toggleSkip = async (it) => {
    const next = !it.skip;

    setItems((prev) =>
      prev.map((x) =>
        x.id === it.id
          ? { ...x, skip: next, purchased: next ? false : x.purchased }
          : x
      )
    );
    setSkipSaving((p) => ({ ...p, [it.id]: true }));

    try {
      await setShoppingItemSkip(it.id, next);
      if (next && it.purchased) {
        await setShoppingItemPurchased(it.id, false);
      }
    } catch (e) {
      console.error(e);
      setItems((prev) =>
        prev.map((x) => (x.id === it.id ? { ...x, skip: !next } : x))
      );
      showToast("更新に失敗しました", "error");
    } finally {
      setSkipSaving((p) => ({ ...p, [it.id]: false }));
    }
  };

  const togglePurchased = async (it) => {
    if (it.skip) return;
    const next = !it.purchased;

    setItems((prev) =>
      prev.map((x) => (x.id === it.id ? { ...x, purchased: next } : x))
    );
    setPurchasedSaving((p) => ({ ...p, [it.id]: true }));

    try {
      await setShoppingItemPurchased(it.id, next);
    } catch (e) {
      console.error(e);
      setItems((prev) =>
        prev.map((x) => (x.id === it.id ? { ...x, purchased: !next } : x))
      );
      showToast("更新に失敗しました", "error");
    } finally {
      setPurchasedSaving((p) => ({ ...p, [it.id]: false }));
    }
  };

  const onChangeMemo = (itemId, v) =>
    setMemoDraft((p) => ({ ...p, [itemId]: v }));

  const saveMemo = async (it) => {
    const v = memoDraft[it.id] ?? "";
    setMemoSaving((p) => ({ ...p, [it.id]: true }));
    try {
      await setShoppingItemMemo(it.id, v);
      setItems((prev) =>
        prev.map((x) => (x.id === it.id ? { ...x, memo: v } : x))
      );
      showToast("メモを保存しました");
    } catch (e) {
      console.error(e);
      showToast("メモ保存に失敗しました", "error");
    } finally {
      setMemoSaving((p) => ({ ...p, [it.id]: false }));
    }
  };

  const onDeleteOne = async (it) => {
    if (!it?.id) return;
    setDeleteBusy((p) => ({ ...p, [it.id]: true }));

    setItems((prev) => prev.filter((x) => x.id !== it.id));

    try {
      await deleteShoppingItem(it.id);
      showToast("削除しました");
    } catch (e) {
      console.error(e);
      showToast("削除に失敗しました", "error");
      await refresh();
    } finally {
      setDeleteBusy((p) => ({ ...p, [it.id]: false }));
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
      showToast("冷蔵庫に追加しました");
    } catch (e) {
      console.error(e);
      showToast("冷蔵庫反映に失敗しました", "error");
    } finally {
      setSyncing(false);
    }
  };

  const onGenerateDraft = async () => {
    if (!user) return;
    if (genBusy) return;

    setGenBusy(true);
    setGenError("");

    try {
      const { sessionId } = await generateShoppingDraftFromPlans({
        userId: user.uid,
        rangeDays: genDays,
      });

      // ✅ 遷移前にUIを畳む（routeChangeStartでやらない）
      setGenOpen(false);
      setConfirmOpen(false);
      setToast((p) => ({ ...p, open: false }));
      setUiFreezing(true);
      setOpenMap({});

      await new Promise((r) => requestAnimationFrame(r));
      router.push(`/shopping/draft/${sessionId}`);
    } catch (e) {
      console.error(e);
      setGenError(
        "献立から生成できませんでした。献立/レシピ/材料の設定を確認してね。"
      );
      setUiFreezing(false);
    } finally {
      setGenBusy(false);
    }
  };

  const onMarkAllPurchased = async () => {
    if (!user) return;
    if (unboughtCount === 0) return;

    setBulkBusy(true);
    try {
      await markAllPurchased({ userId: user.uid });
      await refresh();
      showToast("買うものを一括で「買った」にしました", "success");
    } catch (e) {
      console.error(e);
      showToast("一括更新に失敗しました", "error");
    } finally {
      setBulkBusy(false);
    }
  };

  const onDeleteAll = async () => {
    if (!user) return;
    setBulkBusy(true);
    try {
      await deleteAllShoppingItems({ userId: user.uid });
      setConfirmOpen(false);
      await refresh();
      showToast("買い物リストを全件削除しました", "success");
    } catch (e) {
      console.error(e);
      showToast("削除に失敗しました", "error");
    } finally {
      setBulkBusy(false);
    }
  };

  const pageWrapSx = { maxWidth: 980, mx: "auto", px: 2, pt: 2, pb: 6 };

  if (!user) {
    return (
      <Box sx={{ p: 3 }}>
        <Typography variant="h6" fontWeight={900}>
          ログインしてください
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
            <Typography variant="body2" sx={{ opacity: 0.75, lineHeight: 1.6 }}>
              「買わない」は<b>冷蔵庫に追加しません</b>
              。個別削除（ゴミ箱）もできます。
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
      </Stack>

      {/* 生成ダイアログ（Transitionなし） */}
      <Dialog
        open={genOpen}
        onClose={() => (!genBusy ? setGenOpen(false) : null)}
        maxWidth="xs"
        fullWidth
        transitionDuration={0}
      >
        <DialogTitle sx={{ fontWeight: 950 }}>献立から生成</DialogTitle>
        <DialogContent>
          <Typography variant="body2" sx={{ opacity: 0.8, mb: 1 }}>
            明日から何日分の献立を対象にする？
          </Typography>

          <Stack direction="row" spacing={1}>
            <Button
              variant={genDays === 2 ? "contained" : "outlined"}
              onClick={() => setGenDays(2)}
              sx={{ borderRadius: 999, fontWeight: 900, textTransform: "none" }}
            >
              2日分
            </Button>
            <Button
              variant={genDays === 3 ? "contained" : "outlined"}
              onClick={() => setGenDays(3)}
              sx={{ borderRadius: 999, fontWeight: 900, textTransform: "none" }}
            >
              3日分
            </Button>
          </Stack>

          {genError ? (
            <Alert severity="error" sx={{ mt: 1.5 }}>
              {genError}
            </Alert>
          ) : null}
        </DialogContent>
        <DialogActions>
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
            sx={{ fontWeight: 950 }}
          >
            {genBusy ? "生成中..." : "生成する"}
          </Button>
        </DialogActions>
      </Dialog>

      {/* list */}
      <Card sx={{ borderRadius: 3, mb: 2 }}>
        <CardContent>
          <Stack
            direction={{ xs: "column", sm: "row" }}
            alignItems={{ xs: "flex-start", sm: "center" }}
            justifyContent="space-between"
            sx={{ mb: 1 }}
            spacing={1}
          >
            <Stack direction="row" alignItems="center" spacing={1}>
              <Typography fontWeight={950}>買うもの</Typography>
              <Chip size="small" label={`買わない ${skipCount}`} />
              <Chip size="small" label={`買った ${boughtCount}`} />
              <Chip
                size="small"
                color="primary"
                label={`未購入 ${unboughtCount}`}
              />
            </Stack>

            <Stack direction="row" spacing={1} justifyContent="flex-end">
              <Button
                variant="contained"
                startIcon={<DoneAllIcon />}
                onClick={onMarkAllPurchased}
                disabled={bulkBusy || unboughtCount === 0}
                sx={{
                  borderRadius: 999,
                  fontWeight: 950,
                  textTransform: "none",
                }}
              >
                {bulkBusy ? "更新中..." : "一括買った"}
              </Button>

              <Button
                variant="outlined"
                color="error"
                startIcon={<DeleteOutlineIcon />}
                onClick={() => setConfirmOpen(true)}
                disabled={bulkBusy || activeItems.length === 0}
                sx={{
                  borderRadius: 999,
                  fontWeight: 950,
                  textTransform: "none",
                }}
              >
                リストを削除
              </Button>
            </Stack>
          </Stack>

          <Divider sx={{ mb: 1 }} />

          {loading ? (
            <Stack spacing={1}>
              <Skeleton variant="rounded" height={52} />
              <Skeleton variant="rounded" height={52} />
              <Skeleton variant="rounded" height={52} />
            </Stack>
          ) : activeItems.length === 0 ? (
            <Typography variant="body2" sx={{ opacity: 0.75 }}>
              まだ何もありません。下の「手動で追加」から追加できます。
            </Typography>
          ) : (
            <List disablePadding>
              {activeItems.map((it) => {
                const isOpen = !!openMap[it.id];
                const memoValue = memoDraft[it.id] ?? "";
                const memoChanged = (it.memo || "") !== memoValue;
                const memoBusy = !!memoSaving[it.id];
                const skipBusy = !!skipSaving[it.id];
                const purchasedBusy = !!purchasedSaving[it.id];
                const delBusy = !!deleteBusy[it.id];

                return (
                  <Box key={it.id}>
                    <ListItem disablePadding sx={{ borderRadius: 2, mb: 0.6 }}>
                      <ListItemButton
                        sx={{
                          borderRadius: 2,
                          alignItems: "flex-start",
                          py: 1.1,
                        }}
                        onClick={() => !uiFreezing && toggleOpen(it.id)}
                        disabled={uiFreezing}
                      >
                        <ListItemIcon sx={{ minWidth: 44, mt: 0.2 }}>
                          <Tooltip
                            title={
                              it.skip
                                ? "買わないON中は買った操作できません"
                                : "買った"
                            }
                            {...safeTooltipProps}
                          >
                            <span>
                              <Checkbox
                                edge="start"
                                checked={!!it.purchased}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  if (!purchasedBusy && !uiFreezing)
                                    togglePurchased(it);
                                }}
                                disabled={
                                  it.skip || purchasedBusy || uiFreezing
                                }
                              />
                            </span>
                          </Tooltip>
                        </ListItemIcon>

                        <ListItemText
                          primary={
                            <Stack
                              direction="row"
                              spacing={1}
                              alignItems="center"
                              flexWrap="wrap"
                            >
                              <Typography
                                sx={{
                                  fontWeight: 950,
                                  textDecoration:
                                    it.skip || it.purchased
                                      ? "line-through"
                                      : "none",
                                  opacity: it.skip ? 0.7 : 1,
                                }}
                              >
                                {it.name}
                              </Typography>

                              {it.skip ? (
                                <Chip
                                  size="small"
                                  label="買わない"
                                  variant="outlined"
                                />
                              ) : it.purchased ? (
                                <Chip
                                  size="small"
                                  label="買った"
                                  color="success"
                                />
                              ) : (
                                <Chip
                                  size="small"
                                  label="買う"
                                  color="primary"
                                />
                              )}

                              {(skipBusy || purchasedBusy) && (
                                <Chip
                                  size="small"
                                  label="更新中..."
                                  variant="outlined"
                                />
                              )}
                            </Stack>
                          }
                          secondary={
                            <Typography
                              variant="body2"
                              sx={{ opacity: 0.75, mt: 0.3 }}
                            >
                              {it.sources?.length
                                ? `由来 ${it.sources.length}件`
                                : ""}
                            </Typography>
                          }
                        />

                        <Tooltip
                          title="買わない（冷蔵庫に追加しない）"
                          {...safeTooltipProps}
                        >
                          <span>
                            <FormControlLabel
                              onClick={(e) => e.stopPropagation()}
                              sx={{ mr: 0.5, mt: 0.1 }}
                              control={
                                <Switch
                                  checked={!!it.skip}
                                  onChange={() => {
                                    if (!skipBusy && !uiFreezing)
                                      toggleSkip(it);
                                  }}
                                  disabled={skipBusy || uiFreezing}
                                />
                              }
                              label={
                                <Typography
                                  variant="caption"
                                  sx={{ fontWeight: 900 }}
                                >
                                  買わない
                                </Typography>
                              }
                              labelPlacement="start"
                            />
                          </span>
                        </Tooltip>

                        <Tooltip title="削除" {...safeTooltipProps}>
                          <span>
                            <IconButton
                              onClick={(e) => {
                                e.stopPropagation();
                                if (!uiFreezing) onDeleteOne(it);
                              }}
                              disabled={delBusy || uiFreezing}
                            >
                              <DeleteOutlineIcon />
                            </IconButton>
                          </span>
                        </Tooltip>

                        <IconButton
                          onClick={(e) => {
                            e.stopPropagation();
                            if (!uiFreezing) toggleOpen(it.id);
                          }}
                          sx={{ mt: 0.1 }}
                          disabled={uiFreezing}
                        >
                          {isOpen ? <ExpandLessIcon /> : <ExpandMoreIcon />}
                        </IconButton>
                      </ListItemButton>
                    </ListItem>

                    {/* ✅ Collapse廃止：条件描画 */}
                    {!uiFreezing && isOpen && (
                      <Box
                        sx={{
                          px: 2,
                          pb: 1.5,
                          pt: 0.6,
                          mb: 1.0,
                          borderRadius: 2,
                          bgcolor: "rgba(0,0,0,0.02)",
                          border: "1px solid rgba(0,0,0,0.06)",
                        }}
                      >
                        <Stack spacing={0.8} sx={{ mb: 1.2 }}>
                          <Stack
                            direction="row"
                            spacing={0.8}
                            alignItems="center"
                          >
                            <InfoOutlinedIcon fontSize="small" />
                            <Typography fontWeight={950}>
                              由来（数量テキスト）
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
                              由来情報がありません（手動追加など）
                            </Typography>
                          )}
                        </Stack>

                        <Stack spacing={0.8}>
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
                            placeholder="例：特売で買う / 代替OK / なくてもOK"
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
                      </Box>
                    )}
                  </Box>
                );
              })}
            </List>
          )}

          {/* 冷蔵庫に追加 */}
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

      {/* 手動で追加 */}
      <Card sx={{ borderRadius: 3, mb: 2 }}>
        <CardContent>
          <Typography fontWeight={950} sx={{ mb: 1 }}>
            手動で追加
          </Typography>

          <Stack direction={{ xs: "column", sm: "row" }} spacing={1}>
            <TextField
              fullWidth
              label="買うもの（例：牛乳 / 洗剤 / ねぎ）"
              value={name}
              onChange={(e) => setName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") addItem();
              }}
            />
            <Button
              variant="contained"
              onClick={addItem}
              disabled={!name.trim()}
              sx={{
                borderRadius: 999,
                fontWeight: 900,
                px: 3,
                py: 1.1,
                textTransform: "none",
                whiteSpace: "nowrap",
              }}
            >
              ＋ 追加
            </Button>
          </Stack>

          <Typography
            variant="caption"
            sx={{ opacity: 0.7, display: "block", mt: 1 }}
          >
            ※手動追加は「カスタム・期限3日」で登録します（シンプル優先）
          </Typography>
        </CardContent>
      </Card>

      {/* 日用品・調味料メモ */}
      <Card sx={{ borderRadius: 3 }}>
        <CardContent>
          <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 1 }}>
            <NotesIcon fontSize="small" />
            <Typography fontWeight={950}>日用品・調味料メモ</Typography>
            <Chip
              size="small"
              label="端末をまたいで共有OK"
              variant="outlined"
            />
            {notesBusy ? (
              <Chip size="small" label="保存中..." variant="outlined" />
            ) : null}
          </Stack>

          <TextField
            fullWidth
            multiline
            minRows={4}
            placeholder={"例：\n・洗剤\n・ラップ\n・醤油\n・ごま油"}
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            sx={{ bgcolor: "#fff", borderRadius: 2 }}
          />

          <Typography
            variant="caption"
            sx={{ opacity: 0.7, display: "block", mt: 1 }}
          >
            ※このメモは Firestore（users/{`{userId}`}
            .shoppingNote）に保存されます。
          </Typography>
        </CardContent>
      </Card>

      {/* 全件削除 confirm */}
      <Dialog
        open={confirmOpen}
        onClose={() => (!bulkBusy ? setConfirmOpen(false) : null)}
        maxWidth="xs"
        fullWidth
        transitionDuration={0}
      >
        <DialogTitle sx={{ fontWeight: 950 }}>
          買い物リストを全件削除しますか？
        </DialogTitle>
        <DialogContent>
          <Typography variant="body2" sx={{ opacity: 0.8, lineHeight: 1.7 }}>
            この操作は取り消せません。
            <br />
            「確定後の買い物リスト（shoppingItems）」を全て削除します。
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button
            onClick={() => setConfirmOpen(false)}
            disabled={bulkBusy}
            sx={{ fontWeight: 900 }}
          >
            キャンセル
          </Button>
          <Button
            color="error"
            variant="contained"
            onClick={onDeleteAll}
            disabled={bulkBusy}
            sx={{ fontWeight: 950 }}
          >
            {bulkBusy ? "削除中..." : "全件削除"}
          </Button>
        </DialogActions>
      </Dialog>

      {/* ✅ 自前Toast */}
      {toast.open && (
        <Box
          sx={{
            position: "fixed",
            left: "50%",
            bottom: 24,
            transform: "translateX(-50%)",
            width: "calc(100% - 32px)",
            maxWidth: 520,
            zIndex: 1400,
          }}
        >
          <Alert
            severity={toast.sev}
            onClose={() => setToast((p) => ({ ...p, open: false }))}
            sx={{ fontWeight: 900, boxShadow: 6, borderRadius: 2 }}
          >
            {toast.msg}
          </Alert>
        </Box>
      )}
    </Box>
  );
}
