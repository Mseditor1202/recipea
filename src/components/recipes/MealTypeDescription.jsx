import React from "react";
import { Box, Typography } from "@mui/material";

const MealTypeDescription = () => {
  return (
    <Box sx={{ mb: 3 }}>
      <Typography
        variant="body2"
        sx={{
          whiteSpace: "pre-line",
          lineHeight: 1.6,
          bgcolor: "grey.100",
          p: 2,
          borderRadius: 2,
        }}
      >
        {`🍚 主食（しゅしょく）
ご飯・パン・麺など、エネルギー源になる料理。

🍖 主菜（しゅさい）
肉・魚・卵・大豆など、たんぱく質が中心のメイン料理。

🥗 副菜（ふくさい）
野菜・きのこ・海藻など、栄養バランスを整えるサブ料理。`}
      </Typography>
    </Box>
  );
};

export default MealTypeDescription;
