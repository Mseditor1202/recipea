import { useEffect, useMemo, useState } from "react";
import {
  Box,
  Typography,
  Stack,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  Chip,
  Button,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  Divider,
  Card,
  CardContent,
  Skeleton,
  Switch,
  Radio,
} from "@mui/material";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";

import { auth } from "@/lib/firebase";
import {
  getAppConfigs,
  getFridgeLotsByUser,
  getCategoryExpireRules,
  addFridgeLot,
  updateFridgeLotState,
  markLotAsSeen,
  calcRemainDays,
  getExpireLevel,
  deleteFridgeLot,
  updateFridgeLotMemo, // ★ 追加
} from "@/lib/fridge";

const STATE_LABEL = { NONE: "なし", LITTLE: "すこしだけ", HAVE: "ある" };

const levelToChipColor = (level) => {
  if (level === "DANGER") return "error";
  if (level === "WARN") return "warning";
  if (level === "CAUTION") return "info";
  return "default";
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

function StockControls({ state, onChange, onRequestDelete }) {
  const isNone = state === "NONE";
  const switchChecked = state === "HAVE";

  const handleToggleSwitch = () => {
    if (isNone) {
      onChange("HAVE");
      return;
    }
    onChange(switchChecked ? "LITTLE" : "HAVE");
  };

  return (
    <Stack direction="row" alignItems="center" spacing={1}>
      {/* Switch: ある / すこしだけ */}
      <Stack
        direction="row"
        alignItems="center"
        spacing={1}
        sx={{
          px: 1,
          py: 0.25,
          border: "1px solid",
          borderColor: "divider",
          borderRadius: 999,
          opacity: isNone ? 0.5 : 1,
          userSelect: "none",
        }}
      >
        <Typography
          variant="caption"
          sx={{ fontWeight: 900, letterSpacing: 0.2 }}
        >
          {STATE_LABEL.LITTLE}
        </Typography>
        <Switch
          checked={switchChecked && !isNone}
          onChange={handleToggleSwitch}
          size="small"
        />
        <Typography
          variant="caption"
          sx={{ fontWeight: 900, letterSpacing: 0.2 }}
        >
          {STATE_LABEL.HAVE}
        </Typography>
      </Stack>

      {/* Radio: なし（削除） */}
      <Stack
        direction="row"
        alignItems="center"
        sx={{
          px: 1,
          py: 0.25,
          border: "1px solid",
          borderColor: "divider",
          borderRadius: 999,
          cursor: "pointer",
          userSelect: "none",
        }}
        onClick={() => onRequestDelete?.()}
        role="button"
        aria-label="在庫なし（削除）"
      >
        <Radio checked={false} size="small" />
        <Typography
          variant="caption"
          sx={{ fontWeight: 900, letterSpacing: 0.2 }}
        >
          {STATE_LABEL.NONE}
        </Typography>
      </Stack>
    </Stack>
  );
}

export default function FridgePage() {
  const [user, setUser] = useState(null);

  const [configs, setConfigs] = useState(null);
  const [lots, setLots] = useState([]);
  const [loading, setLoading] = useState(true);

  // add dialog
  const [openAdd, setOpenAdd] = useState(false);
  const [foodName, setFoodName] = useState("");
  const [rules, setRules] = useState([]);
  const [selectedCategoryId, setSelectedCategoryId] = useState("");
  const [rulesLoading, setRulesLoading] = useState(false);
  const [customExpireDays, setCustomExpireDays] = useState("3");

  // delete dialog
  const [openDelete, setOpenDelete] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState(null);

  // ★ memo dialog
  const [openMemo, setOpenMemo] = useState(false);
  const [memoTarget, setMemoTarget] = useState(null); // lot
  const [memoText, setMemoText] = useState("");
  const [memoSaving, setMemoSaving] = useState(false);

  useEffect(() => {
    const unsub = auth.onAuthStateChanged((u) => setUser(u));
    return () => unsub();
  }, []);

  useEffect(() => {
    if (!user) return;
    (async () => {
      setLoading(true);
      const c = await getAppConfigs();
      setConfigs(c);

      const l = await getFridgeLotsByUser(user.uid);
      setLots(l);
      setLoading(false);
    })();
  }, [user]);

  const refreshLots = async () => {
    if (!user) return;
    const l = await getFridgeLotsByUser(user.uid);
    setLots(l);
  };

  const grouped = useMemo(() => {
    const map = new Map();
    for (const lot of lots) {
      const key = lot.foodNameSnapshot || "未分類";
      if (!map.has(key)) map.set(key, []);
      map.get(key).push(lot);
    }

    const arr = Array.from(map.entries()).map(([name, items]) => {
      items.sort((a, b) => new Date(a.expireAt) - new Date(b.expireAt));
      return { name, items };
    });

    arr.sort((a, b) => {
      const aMin = a.items[0]
        ? new Date(a.items[0].expireAt).getTime()
        : Infinity;
      const bMin = b.items[0]
        ? new Date(b.items[0].expireAt).getTime()
        : Infinity;
      return aMin - bMin;
    });

    return arr;
  }, [lots]);

  // openAdd => load rules
  useEffect(() => {
    if (!openAdd) return;
    (async () => {
      setRulesLoading(true);
      const r = await getCategoryExpireRules();
      setRules(r);
      if (!selectedCategoryId && r.length > 0) setSelectedCategoryId(r[0].id);
      setRulesLoading(false);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [openAdd]);

  const onSeenNew = async (lot) => {
    if (!lot.isNew) return;
    await markLotAsSeen(lot.id);
    setLots((prev) =>
      prev.map((x) => (x.id === lot.id ? { ...x, isNew: false } : x))
    );
  };

  const onChangeState = async (lot, nextState) => {
    await updateFridgeLotState(lot.id, nextState);
    setLots((prev) =>
      prev.map((x) => (x.id === lot.id ? { ...x, state: nextState } : x))
    );
  };

  const requestDelete = (lot) => {
    setDeleteTarget(lot);
    setOpenDelete(true);
  };

  const confirmDelete = async () => {
    if (!deleteTarget) return;
    await deleteFridgeLot(deleteTarget.id);
    setLots((prev) => prev.filter((x) => x.id !== deleteTarget.id));
    setOpenDelete(false);
    setDeleteTarget(null);
  };

  const cancelDelete = () => {
    setOpenDelete(false);
    setDeleteTarget(null);
  };

  // ★ memo open/close/save
  const openMemoEditor = (lot) => {
    setMemoTarget(lot);
    setMemoText(lot?.memo || "");
    setOpenMemo(true);
  };

  const closeMemoEditor = () => {
    setOpenMemo(false);
    setMemoTarget(null);
    setMemoText("");
    setMemoSaving(false);
  };

  const saveMemo = async () => {
    if (!memoTarget) return;
    setMemoSaving(true);
    const next = String(memoText || "").trim();

    await updateFridgeLotMemo(memoTarget.id, next);

    // UI即反映
    setLots((prev) =>
      prev.map((x) => (x.id === memoTarget.id ? { ...x, memo: next } : x))
    );

    setMemoSaving(false);
    closeMemoEditor();
  };

  const selectedRule = rules.find((r) => r.id === selectedCategoryId);
  const isCustomSelected = selectedCategoryId === "custom";

  const onAdd = async () => {
    if (!user) return;
    const name = (foodName || "").trim();
    if (!name) return;

    if (isCustomSelected) {
      const days = Number(customExpireDays);
      if (!Number.isFinite(days) || days <= 0) return;
    }

    await addFridgeLot({
      userId: user.uid,
      foodName: name,
      categoryId: selectedCategoryId,
      state: "HAVE",
      customExpireDays: isCustomSelected ? Number(customExpireDays) : undefined,
    });

    setOpenAdd(false);
    setFoodName("");
    await refreshLots();
  };

  const addButtonSx = {
    borderRadius: 999,
    minWidth: 260,
    maxWidth: 360,
    px: 4,
    py: 1.2,
    fontWeight: 900,
    textTransform: "none",
    fontSize: 15,
    boxShadow: 3,
  };

  if (!user) {
    return (
      <Box sx={{ p: 3 }}>
        <Typography variant="h6" fontWeight={900}>
          ログインしてください
        </Typography>
        <Typography variant="body2" sx={{ mt: 1, opacity: 0.75 }}>
          冷蔵庫在庫はユーザーごとに保存されます。
        </Typography>
      </Box>
    );
  }

  const customDaysValid = (() => {
    if (!isCustomSelected) return true;
    const days = Number(customExpireDays);
    return Number.isFinite(days) && days > 0;
  })();

  return (
    <Box sx={{ maxWidth: 980, mx: "auto", px: 2, pt: 2, pb: 6 }}>
      <Stack spacing={0.6} sx={{ mb: 2 }}>
        <Typography variant="h5" fontWeight={950}>
          冷蔵庫
        </Typography>
        <Typography variant="body2" sx={{ opacity: 0.75, lineHeight: 1.6 }}>
          {configs?.coldStorageDisclaimer ||
            "※ 冷蔵保存期限は USDA / FDA の食品安全ガイドラインを基に設計しています（卵は日本の食品衛生基準も考慮）。冷蔵庫は 4℃ 前後での保存を前提としています。"}
        </Typography>
      </Stack>

      {loading ? (
        <Stack spacing={1.2}>
          <Skeleton variant="rounded" height={78} />
          <Skeleton variant="rounded" height={78} />
          <Skeleton variant="rounded" height={78} />
        </Stack>
      ) : grouped.length === 0 ? (
        <Card sx={{ borderRadius: 3 }}>
          <CardContent>
            <Typography fontWeight={900}>まだ食材がありません</Typography>
            <Typography variant="body2" sx={{ opacity: 0.75, mt: 0.5 }}>
              下の「＋ 食材を追加」からすぐ追加できます。
            </Typography>

            <Box sx={{ display: "flex", justifyContent: "center", mt: 3 }}>
              <Button
                onClick={() => setOpenAdd(true)}
                variant="contained"
                sx={addButtonSx}
              >
                ＋ 食材を追加
              </Button>
            </Box>
          </CardContent>
        </Card>
      ) : (
        <Box>
          <Stack spacing={1.2}>
            {grouped.map((g) => (
              <Accordion
                key={g.name}
                disableGutters
                sx={{ borderRadius: 3, overflow: "hidden" }}
              >
                <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                  <Stack
                    direction="row"
                    alignItems="center"
                    spacing={1}
                    sx={{ width: "100%" }}
                  >
                    <Typography fontWeight={950}>{g.name}</Typography>
                    <Chip size="small" label={`${g.items.length}件`} />
                  </Stack>
                </AccordionSummary>

                <AccordionDetails>
                  <Stack spacing={1}>
                    {g.items.map((lot) => {
                      const remain = calcRemainDays(lot.expireAt);
                      const level = getExpireLevel(remain);
                      const basisLabel =
                        lot.expireSource === "USER" ? "ユーザー" : "カテゴリ";
                      const boughtAtText = formatDateJP(lot.boughtAt);
                      const hasMemo = !!(lot.memo || "").trim();

                      return (
                        <Card
                          key={lot.id}
                          variant="outlined"
                          sx={{
                            borderRadius: 3,
                            transition: "transform 120ms ease",
                            "&:hover": { transform: "translateY(-1px)" },
                          }}
                          onMouseEnter={() => onSeenNew(lot)}
                        >
                          <CardContent sx={{ py: 1.5 }}>
                            <Stack spacing={1}>
                              <Stack
                                direction="row"
                                alignItems="center"
                                justifyContent="space-between"
                                spacing={1}
                              >
                                <Stack spacing={0.7}>
                                  <Stack
                                    direction="row"
                                    spacing={1}
                                    alignItems="center"
                                    flexWrap="wrap"
                                  >
                                    {lot.isNew && (
                                      <Chip
                                        size="small"
                                        label="NEW"
                                        color="primary"
                                      />
                                    )}
                                    <Chip
                                      size="small"
                                      label={`${basisLabel}：残り${remain}日`}
                                      color={levelToChipColor(level)}
                                    />
                                    {!!lot.categoryLabelSnapshot && (
                                      <Chip
                                        size="small"
                                        variant="outlined"
                                        label={lot.categoryLabelSnapshot}
                                      />
                                    )}
                                  </Stack>

                                  <Typography
                                    variant="caption"
                                    sx={{ opacity: 0.7 }}
                                  >
                                    追加日：{boughtAtText}
                                  </Typography>
                                </Stack>

                                <Stack
                                  direction="row"
                                  alignItems="center"
                                  spacing={1}
                                >
                                  <Button
                                    size="small"
                                    variant={hasMemo ? "contained" : "outlined"}
                                    onClick={() => openMemoEditor(lot)}
                                    sx={{
                                      borderRadius: 999,
                                      fontWeight: 900,
                                      textTransform: "none",
                                      minWidth: 88,
                                    }}
                                  >
                                    メモ
                                  </Button>

                                  <StockControls
                                    state={lot.state}
                                    onChange={(ns) => onChangeState(lot, ns)}
                                    onRequestDelete={() => requestDelete(lot)}
                                  />
                                </Stack>
                              </Stack>

                              {/* メモ表示（ある時だけ） */}
                              {hasMemo && (
                                <Box
                                  sx={{
                                    px: 1.25,
                                    py: 1,
                                    borderRadius: 2,
                                    bgcolor: "rgba(0,0,0,0.03)",
                                  }}
                                >
                                  <Typography
                                    variant="body2"
                                    sx={{ whiteSpace: "pre-wrap" }}
                                  >
                                    📝 {lot.memo}
                                  </Typography>
                                </Box>
                              )}
                            </Stack>
                          </CardContent>
                        </Card>
                      );
                    })}
                  </Stack>
                </AccordionDetails>
              </Accordion>
            ))}
          </Stack>

          <Box sx={{ display: "flex", justifyContent: "center", mt: 3, mb: 2 }}>
            <Button
              onClick={() => setOpenAdd(true)}
              variant="contained"
              sx={addButtonSx}
            >
              ＋ 食材を追加
            </Button>
          </Box>
        </Box>
      )}

      {/* add dialog */}
      <Dialog
        open={openAdd}
        onClose={() => setOpenAdd(false)}
        fullWidth
        maxWidth="sm"
      >
        <DialogTitle sx={{ fontWeight: 950 }}>食材を追加</DialogTitle>
        <DialogContent>
          <TextField
            fullWidth
            label="食材名（自由入力）"
            value={foodName}
            onChange={(e) => setFoodName(e.target.value)}
            sx={{ mt: 1 }}
          />

          <Typography
            variant="subtitle2"
            sx={{ mt: 2, mb: 1, fontWeight: 900 }}
          >
            カテゴリ（期限テンプレ）
          </Typography>

          {rulesLoading ? (
            <Typography sx={{ py: 2 }}>読み込み中...</Typography>
          ) : (
            <Stack direction="row" flexWrap="wrap" gap={1}>
              {rules.map((r) => {
                const selected = r.id === selectedCategoryId;
                const label =
                  r.id === "custom"
                    ? `${r.label}`
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
            <Box sx={{ mt: 2 }}>
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
                    : "例：3（3日後が期限になります）"
                }
              />
            </Box>
          )}

          {!!selectedRule && (
            <Box sx={{ mt: 2 }}>
              {!isCustomSelected && <Divider sx={{ mb: 1.5 }} />}
              <Typography variant="body2" sx={{ opacity: 0.8 }}>
                選択中：<b>{selectedRule.label}</b>
                {!isCustomSelected && (
                  <>
                    {" "}
                    / 目安：<b>{selectedRule.defaultExpireDays}日</b>
                  </>
                )}
              </Typography>
              <Typography variant="caption" sx={{ opacity: 0.7 }}>
                ※ 冷蔵 4℃ 前後での保存を前提にした目安です
              </Typography>
            </Box>
          )}
        </DialogContent>

        <DialogActions>
          <Button onClick={() => setOpenAdd(false)} sx={{ borderRadius: 999 }}>
            閉じる
          </Button>
          <Button
            onClick={onAdd}
            variant="contained"
            sx={{ borderRadius: 999, fontWeight: 900 }}
            disabled={
              !foodName.trim() || !selectedCategoryId || !customDaysValid
            }
          >
            追加する
          </Button>
        </DialogActions>
      </Dialog>

      {/* memo dialog */}
      <Dialog open={openMemo} onClose={closeMemoEditor} fullWidth maxWidth="sm">
        <DialogTitle sx={{ fontWeight: 950 }}>
          メモ
          <Typography variant="body2" sx={{ mt: 0.5, opacity: 0.75 }}>
            {memoTarget?.foodNameSnapshot || ""}
          </Typography>
        </DialogTitle>
        <DialogContent>
          <TextField
            fullWidth
            label="メモ（自由）"
            value={memoText}
            onChange={(e) => setMemoText(e.target.value)}
            multiline
            minRows={3}
            placeholder="例）開封済み／明日使う／半分残ってる／子ども用 など"
            sx={{ mt: 1 }}
          />
          <Typography
            variant="caption"
            sx={{ display: "block", mt: 1, opacity: 0.7 }}
          >
            ※ メモの削除は内容を空欄にして保存してください
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={closeMemoEditor} sx={{ borderRadius: 999 }}>
            閉じる
          </Button>
          <Button
            onClick={saveMemo}
            variant="contained"
            disabled={memoSaving}
            sx={{ borderRadius: 999, fontWeight: 900 }}
          >
            {memoSaving ? "保存中..." : "保存"}
          </Button>
        </DialogActions>
      </Dialog>

      {/* delete confirm dialog */}
      <Dialog open={openDelete} onClose={cancelDelete} fullWidth maxWidth="xs">
        <DialogTitle sx={{ fontWeight: 950 }}>本当に消しますか？</DialogTitle>
        <DialogContent>
          <Typography sx={{ mt: 0.5 }}>
            {deleteTarget?.foodNameSnapshot || "この食材"}{" "}
            をリストから削除します。
          </Typography>
          <Typography variant="body2" sx={{ mt: 1, opacity: 0.75 }}>
            ※ 削除すると元に戻せません（同じ食材は再追加できます）
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={cancelDelete} sx={{ borderRadius: 999 }}>
            いいえ
          </Button>
          <Button
            onClick={confirmDelete}
            variant="contained"
            sx={{ borderRadius: 999, fontWeight: 900 }}
          >
            はい
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
