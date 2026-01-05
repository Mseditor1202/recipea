// pages/shopping/index.jsx
import { useEffect, useMemo, useState } from "react";
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
} from "@mui/material";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";

import { auth } from "@/lib/firebase";
import { getCategoryExpireRules } from "@/lib/fridge";
import {
  getShoppingItemsByUser,
  addShoppingItem,
  setShoppingItemSkip,
  syncActiveItemsToFridge,
  getUserPlan,
  generateShoppingDraftFromPlans,
} from "@/lib/shopping";

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

export default function ShoppingPage() {
  const router = useRouter();

  const [user, setUser] = useState(null);

  const [loading, setLoading] = useState(true);
  const [rulesLoading, setRulesLoading] = useState(true);

  const [items, setItems] = useState([]);
  const [rules, setRules] = useState([]);

  const [planInfo, setPlanInfo] = useState({ plan: "FREE", retentionDays: 7 });

  const [name, setName] = useState("");
  const [selectedCategoryId, setSelectedCategoryId] = useState("");
  const [customExpireDays, setCustomExpireDays] = useState("3");

  const [syncing, setSyncing] = useState(false);

  // generate draft dialog
  const [genOpen, setGenOpen] = useState(false);
  const [genDays, setGenDays] = useState(2);
  const [genBusy, setGenBusy] = useState(false);
  const [genError, setGenError] = useState("");

  useEffect(() => {
    const unsub = auth.onAuthStateChanged((u) => setUser(u));
    return () => unsub();
  }, []);

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

  const refresh = async () => {
    if (!user) return;
    setLoading(true);
    const p = await getUserPlan(user.uid);
    setPlanInfo(p);
    const list = await getShoppingItemsByUser(user.uid);
    setItems(list);
    setLoading(false);
  };

  useEffect(() => {
    if (!user) return;
    refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

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
        if (isWithinDays(it.syncedAt, planInfo.retentionDays)) history.push(it);
      } else {
        active.push(it);
      }
    }

    history.sort(
      (a, b) => (b.syncedAt?.getTime?.() || 0) - (a.syncedAt?.getTime?.() || 0)
    );

    return { activeItems: active, historyItems: history };
  }, [items, planInfo.retentionDays]);

  // ✅ 今回は買わない（skip）件数
  const skipCount = useMemo(() => {
    return activeItems.filter((x) => x.skip).length;
  }, [activeItems]);

  // ✅ 冷蔵庫に反映するのは「skip=false」のみ
  const pendingSyncItems = useMemo(() => {
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

  const toggleSkip = async (it) => {
    const next = !it.skip;
    // ローカル即反映
    setItems((prev) =>
      prev.map((x) =>
        x.id === it.id
          ? { ...x, skip: next, status: next ? "SKIP" : "TODO" }
          : x
      )
    );

    try {
      await setShoppingItemSkip(it.id, next);
    } catch (e) {
      console.error(e);
      // rollback
      setItems((prev) =>
        prev.map((x) =>
          x.id === it.id
            ? { ...x, skip: !next, status: !next ? "SKIP" : "TODO" }
            : x
        )
      );
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
        "献立から生成できませんでした。献立/レシピ/材料の設定を確認してね。"
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
            <Typography variant="body2" sx={{ opacity: 0.75, lineHeight: 1.6 }}>
              ✅「今回は買わない」にチェックしたものは{" "}
              <b>冷蔵庫に追加しません</b>。履歴は{" "}
              <b>{planInfo.plan === "PRO" ? "90日" : "7日"}</b> 表示（
              {planInfo.plan}）。
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
            <Stack direction="row" spacing={1}>
              <Chip size="small" label={`今回は買わない ✓ ${skipCount}`} />
              <Chip
                size="small"
                color="primary"
                label={`反映予定 ${pendingSyncItems.length}`}
              />
            </Stack>
          </Stack>

          {loading ? (
            <Stack spacing={1}>
              <Skeleton variant="rounded" height={52} />
              <Skeleton variant="rounded" height={52} />
              <Skeleton variant="rounded" height={52} />
            </Stack>
          ) : activeItems.length === 0 ? (
            <Typography variant="body2" sx={{ opacity: 0.75 }}>
              まだ何もありません。上のフォームから追加できます。
            </Typography>
          ) : (
            <List disablePadding>
              {activeItems.map((it) => {
                const secondary = it.categoryLabelSnapshot
                  ? it.categoryId === "custom"
                    ? `${it.categoryLabelSnapshot}（期限 ${
                        it.customExpireDays || 3
                      }日）`
                    : it.categoryLabelSnapshot
                  : "";

                return (
                  <ListItem
                    key={it.id}
                    disablePadding
                    sx={{
                      borderRadius: 2,
                      "&:hover": { bgcolor: "rgba(0,0,0,0.03)" },
                      opacity: it.skip ? 0.65 : 1,
                    }}
                  >
                    <ListItemButton
                      onClick={() => toggleSkip(it)}
                      sx={{ borderRadius: 2 }}
                    >
                      <ListItemIcon>
                        <Checkbox
                          edge="start"
                          checked={!!it.skip}
                          tabIndex={-1}
                        />
                      </ListItemIcon>

                      <ListItemText
                        primary={
                          <Typography
                            sx={{
                              fontWeight: 900,
                              textDecoration: it.skip ? "line-through" : "none",
                            }}
                          >
                            {it.name}
                          </Typography>
                        }
                        secondary={secondary}
                      />

                      {it.skip ? (
                        <Chip
                          size="small"
                          label="今回は買わない"
                          variant="outlined"
                        />
                      ) : (
                        <Chip size="small" label="反映対象" color="primary" />
                      )}
                    </ListItemButton>
                  </ListItem>
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
              {syncing
                ? "反映中..."
                : pendingSyncItems.length === 0
                ? "反映対象がありません"
                : `冷蔵庫に追加（${pendingSyncItems.length}件）`}
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
    </Box>
  );
}
