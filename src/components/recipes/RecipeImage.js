// components/recipes/RecipeImage.jsx
import React from "react";
import { Box } from "@mui/material";

export default function RecipeImage({ imageUrl, title, height = 180 }) {
  const defaultImage = "/images/default-recipe.png";
  const src = imageUrl || defaultImage;

  return (
    <Box
      sx={{
        width: "100%",
        height,
        overflow: "hidden",
        backgroundColor: "#F9F4E8",
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
