// components/recipes/RecipeCard.jsx
import React from "react";
import { Card, Box, Typography, Button } from "@mui/material";
import RecipeImage from "@/components/recipes/RecipeImage";

export default function RecipeCard({
  imageUrl,
  title,
  onChange,
  actionLabel = "このレシピを変更",
  disabled = false,
  imageVariant = "card", // thumb/card/hero
}) {
  return (
    <Card
      variant="outlined"
      sx={{
        width: "100%",
        minWidth: 0,
        display: "flex",
        flexDirection: "column",
        borderRadius: 2.5,
        overflow: "hidden",
        boxSizing: "border-box",
        borderColor: "#eee0cc",
        background: "#fff",
      }}
    >
      <RecipeImage
        imageUrl={imageUrl}
        title={title}
        variant={imageVariant}
        sx={{
          borderBottom: "1px solid #f0e6d6",
        }}
      />

      <Box sx={{ p: 1.25, display: "flex", flexDirection: "column", gap: 1 }}>
        <Typography
          variant="body2"
          sx={{
            fontWeight: 900,
            lineHeight: 1.4,
            display: "-webkit-box",
            WebkitLineClamp: 2,
            WebkitBoxOrient: "vertical",
            overflow: "hidden",
            minHeight: 40, // ✅ 2行ぶん確保してカード高さが揃う
          }}
          title={title}
        >
          {title}
        </Typography>

        {onChange && (
          <Button
            fullWidth
            size="small"
            variant="outlined"
            disabled={disabled}
            sx={{
              borderRadius: 999,
              textTransform: "none",
            }}
            onClick={onChange}
          >
            {actionLabel}
          </Button>
        )}
      </Box>
    </Card>
  );
}
