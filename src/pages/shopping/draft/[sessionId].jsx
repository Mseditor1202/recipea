// pages/shopping/draft/[sessionId].jsx
import { useEffect, useMemo, useState, useCallback } from "react";
import { useRouter } from "next/router";
import NextLink from "next/link";
import {
  Box,
  Typography,
  Stack,
  Card,
  CardContent,
  Button,
  Chip,
  Divider,
  List,
  ListItem,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  Checkbox,
  Collapse,
  IconButton,
  TextField,
  Skeleton,
  Alert,
  Snackbar,
  Tooltip,
  CircularProgress,
} from "@mui/material";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import ExpandLessIcon from "@mui/icons-material/ExpandLess";
import NotesIcon from "@mui/icons-material/Notes";
import InfoOutlinedIcon from "@mui/icons-material/InfoOutlined";

import { auth } from "@/lib/firebase";
import {
  getDraftSession,
  getDraftItems,
  setDraftItemSkip,
  setDraftItemMemo,
  applyDraftToShoppingItems,
} from "@/lib/shopping";

/** =========================
 * UI helpers
 ========================= */
const MEAL_LABEL = { breakfast: "朝", lunch: "昼", dinner: "夜" };
const SLOT_LABEL = { staple: "主食", main: "主菜", side: "副菜", soup: "汁物" };

const formatDateRange = (s) => {
  if (!s?.startDayKey || !s?.endDayKey) return "";
  return `${s.startDayKey} 〜 ${s.endDayKey}`;
};

// 在庫ステータスの強さ（テキスト+色）
const fridgeBadge = (state) => {
  // HAVE | FEW | NONE | UNKNOWN
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

// sources の表示順：日付→朝昼夜/枠→レシピ→材料テキスト
const sourceLine = (src) => {
  const day = src?.dayKey ? src.dayKey.slice(5).replace("-", "/") : "";
  const meal = MEAL_LABEL[src?.mealKey] || "";
  const slot = SLOT_LABEL[src?.slotKey] || "";
  const recipe = src?.recipeName || "（不明）";
  const raw = src?.rawText || "";
  return `${day} ${meal}${slot}｜${recipe}${raw ? `：${raw}` : ""}`;
};

// 1件ずつ展開状態を localStorage に保持（上限なし）
const OPEN_KEY = (sessionId) => `shoppingDraftOpenMap:${sessionId}`;

function loadOpenMap(sessionId) {
  if (!sessionId) return {};
  try {
    const raw = localStorage.getItem(OPEN_KEY(sessionId));
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

function saveOpenMap(sessionId, openMap) {
  if (!sessionId) return;
  try {
    localStorage.setItem(OPEN_KEY(sessionId), JSON.stringify(openMap || {}));
  } catch {
    // ignore
  }
}

export default function ShoppingDraftPage() {
  const router = useRouter();
  const { sessionId } = router.query;

  const [user, setUser] = useState(null);

  const [loading, setLoading] = useState(true);
  const [session, setSession] = useState(null);
  const [items, setItems] = useState([]);

  const [error, setError] = useState("");

  // 展開状態（id: true/false）
  const [openMap, setOpenMap] = useState({});

  // memo: 入力中のローカル値
  const [memoDraft, setMemoDraft] = useState({}); // { [itemId]: string }
  const [memoSaving, setMemoSaving] = useState({}); // { [itemId]: bool }

  // skip更新中
  const [skipSaving, setSkipSaving] = useState({}); // { [itemId]: bool }

  // apply
  const [applying, setApplying] = useState(false);

  // toast
  const [toast, setToast] = useState({ open: false, msg: "", sev: "success" });
  const showToast = useCallback((msg, sev = "success") => {
    setToast({ open: true, msg, sev });
  }, []);

  useEffect(() => {
    const unsub = auth.onAuthStateChanged((u) => setUser(u));
    return () => unsub();
  }, []);

  const refresh = useCallback(async () => {
    if (!user || !sessionId) return;
    setLoading(true);
    setError("");

    try {
      const sid = String(sessionId);

      const s = await getDraftSession(sid);
      if (!s) {
        setSession(null);
        setItems([]);
        setError("ドラフトが見つかりませんでした。");
        return;
      }
      if (s.userId !== user.uid) {
        setSession(null);
        setItems([]);
        setError("権限がありません。");
        return;
      }

      const list = await getDraftItems(sid);
      setSession(s);
      setItems(list);

      // openMap: localStorage から復元
      const restored = loadOpenMap(sid);
      setOpenMap(restored);

      // memoDraft 初期化
      const md = {};
      list.forEach((it) => {
        md[it.id] = it.memo || "";
      });
      setMemoDraft(md);
    } catch (e) {
      console.error(e);
      setError("ドラフトを読み込めませんでした。");
    } finally {
      setLoading(false);
    }
  }, [user, sessionId]);

  useEffect(() => {
    if (!user || !sessionId) return;
    refresh();
  }, [user, sessionId, refresh]);

  // openMap を保存
  useEffect(() => {
    if (!sessionId) return;
    saveOpenMap(String(sessionId), openMap);
  }, [openMap, sessionId]);

  const counts = useMemo(() => {
    const total = items.length;
    const skipped = items.filter((x) => x.skip).length;
    const buy = total - skipped;

    const have = items.filter((x) => x.fridgeState === "HAVE").length;
    const few = items.filter((x) => x.fridgeState === "FEW").length;
    const none = items.filter((x) => x.fridgeState === "NONE").length;
    const unk = items.filter((x) => x.fridgeState === "UNKNOWN").length;

    return { total, skipped, buy, have, few, none, unk };
  }, [items]);

  const toggleOpen = (itemId) => {
    setOpenMap((prev) => {
      const next = { ...(prev || {}) };
      next[itemId] = !next[itemId];
      return next;
    });
  };

  const toggleSkip = async (it) => {
    if (!sessionId) return;
    const sid = String(sessionId);
    const next = !it.skip;

    // optimistic
    setItems((prev) =>
      prev.map((x) => (x.id === it.id ? { ...x, skip: next } : x))
    );
    setSkipSaving((p) => ({ ...p, [it.id]: true }));

    try {
      await setDraftItemSkip(sid, it.id, next);
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
    if (!sessionId) return;
    const sid = String(sessionId);
    const v = memoDraft[it.id] ?? "";

    setMemoSaving((p) => ({ ...p, [it.id]: true }));
    try {
      await setDraftItemMemo(sid, it.id, v);

      // items側も更新して「保存済み」に揃える
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

  const applyDraft = async () => {
    if (!user || !sessionId) return;
    setApplying(true);
    try {
      const res = await applyDraftToShoppingItems({
        userId: user.uid,
        sessionId: String(sessionId),
      });
      showToast(`買い物リストに追加しました（${res.created}件）`, "success");
      router.push("/shopping");
    } catch (e) {
      console.error(e);
      showToast("確定に失敗しました", "error");
    } finally {
      setApplying(false);
    }
  };

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
    <Box sx={{ maxWidth: 980, mx: "auto", px: 2, pt: 2, pb: 6 }}>
      {/* header */}
      <Stack spacing={1.2} sx={{ mb: 2 }}>
        <Stack
          direction={{ xs: "column", sm: "row" }}
          justifyContent="space-between"
          alignItems={{ xs: "flex-start", sm: "center" }}
          spacing={1}
        >
          <Box>
            <Typography variant="h5" fontWeight={950}>
              買い物リスト（ドラフト）
            </Typography>
            <Typography variant="body2" sx={{ opacity: 0.75, lineHeight: 1.7 }}>
              献立から生成した候補です。<b>「今回は買わない」</b>をONにすると
              確定時に買い物リストへ追加されません。
            </Typography>
          </Box>

          <Stack direction="row" spacing={1}>
            <Button
              component={NextLink}
              href="/shopping"
              variant="outlined"
              sx={{ borderRadius: 999, fontWeight: 900, textTransform: "none" }}
            >
              戻る
            </Button>
            <Button
              onClick={applyDraft}
              variant="contained"
              disabled={loading || applying || counts.buy === 0 || !session}
              sx={{
                borderRadius: 999,
                fontWeight: 950,
                px: 2.6,
                textTransform: "none",
                boxShadow: 3,
              }}
            >
              {applying ? (
                <Stack direction="row" spacing={1} alignItems="center">
                  <CircularProgress size={18} />
                  <span>確定中...</span>
                </Stack>
              ) : counts.buy === 0 ? (
                "追加するものがありません"
              ) : (
                `買い物リストに追加（${counts.buy}件）`
              )}
            </Button>
          </Stack>
        </Stack>

        {!!session && (
          <Stack direction="row" flexWrap="wrap" gap={1}>
            <Chip
              label={`対象: 明日から${session.rangeDays}日分`}
              sx={{ fontWeight: 900 }}
            />
            <Chip
              label={formatDateRange(session)}
              variant="outlined"
              sx={{ fontWeight: 900 }}
            />
            <Chip
              label={`全${counts.total}件`}
              color="primary"
              sx={{ fontWeight: 900 }}
            />
            <Chip
              label={`買う ${counts.buy}件`}
              color="success"
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
          </Stack>
        )}
      </Stack>

      {loading ? (
        <Stack spacing={1}>
          <Skeleton variant="rounded" height={76} />
          <Skeleton variant="rounded" height={76} />
          <Skeleton variant="rounded" height={76} />
          <Skeleton variant="rounded" height={76} />
        </Stack>
      ) : error ? (
        <Alert severity="error">{error}</Alert>
      ) : !session ? (
        <Alert severity="warning">ドラフトが見つかりませんでした。</Alert>
      ) : (
        <Card sx={{ borderRadius: 3, overflow: "hidden" }}>
          <CardContent>
            <Stack
              direction="row"
              alignItems="center"
              justifyContent="space-between"
              sx={{ mb: 1 }}
            >
              <Typography fontWeight={950}>候補一覧</Typography>
              <Typography variant="body2" sx={{ opacity: 0.7 }}>
                展開状態は保持されます（上限なし）
              </Typography>
            </Stack>

            <Divider sx={{ mb: 1 }} />

            {items.length === 0 ? (
              <Typography variant="body2" sx={{ opacity: 0.75 }}>
                生成できる材料がありませんでした。レシピの材料設定を確認してね。
              </Typography>
            ) : (
              // ✅ removeChild対策：List/Item/Buttonをdivに統一
              <List component="div" disablePadding>
                {items.map((it) => {
                  const isOpen = !!openMap[it.id];
                  const badge = fridgeBadge(it.fridgeState);
                  const memoValue = memoDraft[it.id] ?? "";
                  const memoChanged = (it.memo || "") !== memoValue;
                  const memoBusy = !!memoSaving[it.id];
                  const skipBusy = !!skipSaving[it.id];

                  return (
                    <Box key={it.id} component="div">
                      <ListItem
                        component="div"
                        disablePadding
                        sx={{
                          borderRadius: 2,
                          mb: 0.6,
                          bgcolor: it.skip ? "rgba(0,0,0,0.02)" : "transparent",
                        }}
                      >
                        <ListItemButton
                          component="div"
                          sx={{
                            borderRadius: 2,
                            alignItems: "flex-start",
                            py: 1.2,
                          }}
                          onClick={() => toggleOpen(it.id)}
                        >
                          <ListItemIcon sx={{ minWidth: 44, mt: 0.2 }}>
                            <Tooltip title="今回は買わない（確定時に追加しない）">
                              <span>
                                <Checkbox
                                  edge="start"
                                  checked={!!it.skip}
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    if (!skipBusy) toggleSkip(it);
                                  }}
                                  disabled={skipBusy}
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
                              <Typography
                                variant="body2"
                                sx={{ opacity: 0.75, mt: 0.4 }}
                              >
                                {it.sources?.length
                                  ? `由来: ${it.sources.length}件`
                                  : "由来: なし"}
                              </Typography>
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

                      <Collapse
                        in={isOpen}
                        timeout="auto"
                        unmountOnExit={false}
                      >
                        <Box
                          component="div"
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
                                component="div"
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
                              <Typography
                                variant="body2"
                                sx={{ opacity: 0.75 }}
                              >
                                由来情報がありません（材料テキストだけで生成された可能性）
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
                            ※「在庫:
                            ある」は初期で「今回は買わない」になっています。必要ならチェックを外してね。
                          </Typography>
                        </Box>
                      </Collapse>
                    </Box>
                  );
                })}
              </List>
            )}

            <Divider sx={{ mt: 1.5, mb: 1.5 }} />

            <Box sx={{ display: "flex", justifyContent: "center" }}>
              <Button
                onClick={applyDraft}
                variant="contained"
                disabled={applying || counts.buy === 0}
                sx={{
                  borderRadius: 999,
                  fontWeight: 950,
                  px: 4,
                  py: 1.2,
                  minWidth: 320,
                  textTransform: "none",
                  boxShadow: 3,
                }}
              >
                {applying
                  ? "確定中..."
                  : `買い物リストに追加（${counts.buy}件）`}
              </Button>
            </Box>
          </CardContent>
        </Card>
      )}

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
