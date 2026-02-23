// src/features/recipes/components/RecipeCard.tsx
import React from "react";
import {
  Card,
  CardContent,
  CardActions,
  Typography,
  Chip,
  Button,
  Stack,
  Box,
  TextField,
} from "@mui/material";
import { Save as SaveIcon } from "@mui/icons-material";
import RecipeImage from "@/components/recipes/RecipeImage";
import type { Recipe } from "../types";

type Props = {
  recipe: Recipe;
  canEdit: boolean;
  selectMode: boolean;
  canSelect: boolean;
  selectSaving: boolean;
  draft: string;
  dirty: boolean;
  saving: boolean;

  onDetail: () => void;
  onEdit: () => void;
  onSelect: () => void;
  onMemoChange: (v: string) => void;
  onSaveMemo: () => void;
};

export default function RecipeCard({
  recipe,
  canEdit,
  selectMode,
  canSelect,
  selectSaving,
  draft,
  dirty,
  saving,
  onDetail,
  onEdit,
  onSelect,
  onMemoChange,
  onSaveMemo,
}: Props) {
  return (
    <Card sx={{ height: "100%", display: "flex", flexDirection: "column" }}>
      <RecipeImage
        imageUrl={recipe.imageUrl}
        title={recipe.title}
        height={180}
      />

      <CardContent sx={{ flexGrow: 1 }}>
        <Typography fontWeight={900}>{recipe.title}</Typography>

        <Stack direction="row" spacing={0.5} mt={1} flexWrap="wrap">
          {(recipe.tags ?? []).map((t) => (
            <Chip key={t} size="small" label={`#${t}`} />
          ))}
        </Stack>
      </CardContent>

      <CardActions sx={{ px: 2, pb: 2, gap: 1, flexWrap: "wrap" }}>
        {selectMode ? (
          <>
            <Button fullWidth variant="outlined" onClick={onDetail}>
              詳細確認
            </Button>

            <Button
              fullWidth
              variant="contained"
              disabled={!canSelect || selectSaving}
              onClick={onSelect}
            >
              {selectSaving ? "セット中…" : "このレシピをセットする"}
            </Button>
          </>
        ) : (
          <>
            <Button fullWidth variant="outlined" onClick={onDetail}>
              詳細
            </Button>

            {canEdit && (
              <Button fullWidth variant="contained" onClick={onEdit}>
                編集
              </Button>
            )}
          </>
        )}
      </CardActions>

      {!selectMode && (
        <Box sx={{ px: 2, pb: 2, pt: 1.25 }}>
          <Stack
            direction="row"
            alignItems="center"
            justifyContent="space-between"
          >
            <Typography variant="caption">メモ</Typography>

            <Button
              size="small"
              variant={dirty ? "contained" : "outlined"}
              startIcon={<SaveIcon />}
              disabled={!canEdit || !dirty || saving}
              onClick={onSaveMemo}
            >
              {saving ? "保存中…" : "保存"}
            </Button>
          </Stack>

          <TextField
            value={draft}
            onChange={(e) => onMemoChange(e.target.value)}
            size="small"
            fullWidth
            multiline
          />
        </Box>
      )}
    </Card>
  );
}
