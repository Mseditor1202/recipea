import { CircularProgress, Stack, Typography } from "@mui/material";

type LoadingStateProps = {
  message?: string;
};

export default function LoadingState({
  message = "読み込み中です",
}: LoadingStateProps) {
  return (
    <Stack
      alignItems="center"
      justifyContent="center"
      spacing={2}
      sx={{ minHeight: "100dvh" }}
      role="status"
      aria-live="polite"
    >
      <CircularProgress aria-label="読み込み中" />

      <Typography variant="body2" color="text.secondary">
        {message}
      </Typography>
    </Stack>
  );
}
