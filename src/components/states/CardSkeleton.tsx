import { Card, CardContent, Skeleton, Stack } from "@mui/material";

export default function CardSkeleton() {
  return (
    <Card role="status" aria-busy="true" aria-label="カードを読み込み中">
      <Skeleton variant="rectangular" height={160} animation="wave" />

      <CardContent>
        <Stack spacing={1.5}>
          <Skeleton variant="text" width="70%" />
          <Skeleton variant="text" width="100%" />
          <Skeleton variant="text" width="85%" />
        </Stack>
      </CardContent>
    </Card>
  );
}
