// components/recipes/RecipeImage.jsx
import React from "react";
import { Box } from "@mui/material";

const HEIGHTS = {
  thumb: 120, // 一覧の小
  card: 180, // 週間/日編集のカード
  hero: 300, // 詳細など大
};

export default function RecipeImage({
  imageUrl,
  title,
  variant = "card", // "thumb" | "card" | "hero"
  height, // 例外的に上書きしたい時だけ
  sx,
}) {
  const defaultImage = "/images/default-recipe.png";
  const src = imageUrl || defaultImage;

  const fixedHeight = height ?? HEIGHTS[variant] ?? 180;

  return (
    <Box
      sx={{
        width: "100%",
        height: fixedHeight,
        overflow: "hidden",
        backgroundColor: "#F9F4E8",
        ...sx,
      }}
    >
      <Box
        component="img"
        src={src}
        alt={title || "レシピ画像"}
        loading="lazy"
        sx={{
          width: "100%",
          height: "100%",
          display: "block",
          objectFit: "cover",
        }}
      />
    </Box>
  );
}
