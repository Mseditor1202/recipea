import React, { useMemo } from "react";
import { Box, Typography, Tabs, Tab, IconButton } from "@mui/material";
import ArrowBackIosNewIcon from "@mui/icons-material/ArrowBackIosNew";
import ArrowForwardIosIcon from "@mui/icons-material/ArrowForwardIos";

/**
 * 指定年月の「その月に属する週の月曜日」を計算
 * - 返すのは最大 5 週分
 * - 週の開始は月曜日
 * - Firestore weeklySets の docId として使える "YYYY-MM-DD" を作る
 */
function getWeeksOfMonth(year, month) {
  // month: 0-11
  const result = [];

  // その月の1日
  const first = new Date(year, month, 1);
  const last = new Date(year, month + 1, 0); // 月末

  // その月の最初の月曜日を探す
  const firstDay = first.getDay(); // 0(日)〜6(土)
  const diff = (firstDay + 6) % 7; // 月曜スタートにするための差
  const firstMonday = new Date(first);
  firstMonday.setDate(first.getDate() - diff);

  // 月の間にかかる月曜を最大5つぐらい出す
  for (let i = 0; i < 6; i++) {
    const d = new Date(firstMonday);
    d.setDate(firstMonday.getDate() + i * 7);

    // その週が「表示中の月」に一部でもかかっているなら OK とする
    if (d > last && d.getMonth() !== month) break;

    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    const dd = String(d.getDate()).padStart(2, "0");
    const weekKey = `${y}-${m}-${dd}`;

    result.push({
      index: i,
      label: `${i + 1}週`,
      weekKey,
      date: d,
    });
  }

  return result;
}

/**
 * 週間タブナビ
 * props:
 * - year: number（表示中の年）
 * - month: number（0-11, 表示中の月）
 * - selectedWeekKey: string | null ("YYYY-MM-DD")
 * - onChangeWeek: (weekKey: string) => void
 * - onChangeMonth: (newYear: number, newMonth: number) => void
 */
export default function WeeklyTabsBar({
  year,
  month,
  selectedWeekKey,
  onChangeWeek,
  onChangeMonth,
}) {
  const weeks = useMemo(() => getWeeksOfMonth(year, month), [year, month]);

  const handlePrevMonth = () => {
    const d = new Date(year, month - 1, 1);
    onChangeMonth(d.getFullYear(), d.getMonth());
  };

  const handleNextMonth = () => {
    const d = new Date(year, month + 1, 1);
    onChangeMonth(d.getFullYear(), d.getMonth());
  };

  // 現在選択中のタブ index を計算
  const currentIndex = useMemo(() => {
    const idx = weeks.findIndex((w) => w.weekKey === selectedWeekKey);
    return idx === -1 ? 0 : idx;
  }, [weeks, selectedWeekKey]);

  const handleChangeTab = (_e, newIndex) => {
    const w = weeks[newIndex];
    if (w) {
      onChangeWeek(w.weekKey);
    }
  };

  const displayMonthLabel = `${year}年${month + 1}月`;

  // 左の「＜ 11月」表示用（前月の名前）
  const prevMonthLabel = (() => {
    const d = new Date(year, month - 1, 1);
    return `${d.getMonth() + 1}月`;
  })();

  return (
    <Box
      sx={{
        mb: 2,
        borderBottom: "1px solid #eee0cc",
        pb: 1,
      }}
    >
      {/* 上段：月切り替え + 現在年月 */}
      <Box
        sx={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          mb: 1,
        }}
      >
        {/* 左：前月へ（丸いピル型ボタン風） */}
        <Box
          sx={{
            display: "inline-flex",
            alignItems: "center",
            borderRadius: 999,
            border: "1px solid #d0d0d0",
            px: 1.5,
            py: 0.5,
          }}
        >
          <IconButton size="small" onClick={handlePrevMonth} sx={{ mr: 0.5 }}>
            <ArrowBackIosNewIcon fontSize="inherit" />
          </IconButton>
          <Typography
            variant="body2"
            sx={{ fontWeight: 500, minWidth: 40, textAlign: "center" }}
          >
            {prevMonthLabel}
          </Typography>
        </Box>

        {/* 右：現在表示中の年月 */}
        <Typography
          variant="subtitle1"
          sx={{ fontWeight: 700, letterSpacing: "0.03em" }}
        >
          {displayMonthLabel}
        </Typography>
      </Box>

      {/* 下段：1週〜5週タブ */}
      <Tabs
        value={currentIndex}
        onChange={handleChangeTab}
        variant="scrollable"
        scrollButtons="auto"
        sx={{
          minHeight: 32,
          "& .MuiTab-root": {
            minHeight: 32,
            minWidth: 0,
            px: 1.5,
            fontSize: 13,
            textTransform: "none",
          },
          "& .MuiTab-root.Mui-selected": {
            color: "#0b7d3b",
            fontWeight: 600,
          },
          "& .MuiTabs-indicator": {
            backgroundColor: "#0b7d3b",
            height: 2,
            borderRadius: 999,
          },
        }}
      >
        {weeks.map((w) => (
          <Tab key={w.weekKey} label={w.label} />
        ))}
      </Tabs>
    </Box>
  );
}
