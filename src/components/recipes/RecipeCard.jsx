// components/recipes/RecipeCard.jsx（作ってOK）
import React from "react";
import { Card, Box, Typography, Button } from "@mui/material";
import RecipeImage from "@/components/recipes/RecipeImage";

export default function RecipeCard({ imageUrl, title, onChange }) {
  return (
    <Card
      sx={{
        width: "100%", // ✅ 横幅をGridに完全一致させる
        borderRadius: 2.5,
        overflow: "hidden",
        boxSizing: "border-box",
      }}
    >
      <RecipeImage imageUrl={imageUrl} title={title} height={180} />

      <Box sx={{ p: 1.25 }}>
        <Typography
          variant="body2"
          sx={{
            fontWeight: 800,
            lineHeight: 1.4,
            display: "-webkit-box",
            WebkitLineClamp: 2,
            WebkitBoxOrient: "vertical",
            overflow: "hidden",
          }}
          title={title}
        >
          {title}
        </Typography>

        <Button
          fullWidth
          size="small"
          variant="outlined"
          sx={{
            mt: 1,
            borderRadius: 999,
            textTransform: "none",
          }}
          onClick={onChange}
        >
          このレシピを変更
        </Button>
      </Box>
    </Card>
  );
}
