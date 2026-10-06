import { Button, Stack, Typography } from "@mui/material";
import Image from "next/image";

type ErrorStateProps = {
  title: string;
  description?: string;
  onRetry?: () => void;
  onBack?: () => void;
  retryLabel?: string;
  backLabel?: string;
};

export default function ErrorState({
  title,
  description,
  onRetry,
  onBack,
  retryLabel = "もう一度試す",
  backLabel = "前の画面へ戻る",
}: ErrorStateProps) {
  return (
    <Stack
      alignItems="center"
      spacing={2}
      sx={{ py: 4, textAlign: "center" }}
      role="alert"
    >
      <Image
        src="/images/states/error-mascot.png"
        alt=""
        width={160}
        height={160}
      />

      <Typography variant="h2">{title}</Typography>

      {description && (
        <Typography variant="body2" color="text.secondary">
          {description}
        </Typography>
      )}

      {onRetry && (
        <Button variant="contained" onClick={onRetry}>
          {retryLabel}
        </Button>
      )}

      {onBack && (
        <Button variant="text" onClick={onBack}>
          {backLabel}
        </Button>
      )}
    </Stack>
  );
}
