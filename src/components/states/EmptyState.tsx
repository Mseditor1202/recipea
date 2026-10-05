import { Button, Stack, Typography } from "@mui/material";
import Image from "next/image";

type EmptyStateProps = {
  imageSrc: string;
  imageAlt: string;
  title: string;
  description?: string;
  primaryLabel: string;
  onPrimaryClick: () => void;
  secondaryLabel?: string;
  onSecondaryClick?: () => void;
};

export default function EmptyState({
  imageSrc,
  imageAlt,
  title,
  description,
  primaryLabel,
  onPrimaryClick,
  secondaryLabel,
  onSecondaryClick,
}: EmptyStateProps) {
  return (
    <Stack alignItems="center" spacing={2} sx={{ py: 4, textAlign: "center" }}>
      <Image src={imageSrc} alt={imageAlt} width={160} height={160} />

      <Typography variant="h2">{title}</Typography>

      {description && (
        <Typography variant="body2" color="text.secondary">
          {description}
        </Typography>
      )}

      <Button variant="contained" onClick={onPrimaryClick}>
        {primaryLabel}
      </Button>

      {secondaryLabel && onSecondaryClick && (
        <Button variant="text" onClick={onSecondaryClick}>
          {secondaryLabel}
        </Button>
      )}
    </Stack>
  );
}
