import { Skeleton, Stack } from "@mui/material";

type ListSkeletonProps = {
  count?: number;
};

export default function ListSkeleton({ count = 3 }: ListSkeletonProps) {
  return (
    <Stack
      spacing={2}
      role="status"
      aria-label="一覧を読み込み中"
      aria-busy="true"
    >
      {Array.from({ length: count }).map((_, index) => (
        <Skeleton key={index} variant="rounded" height={72} animation="wave" />
      ))}
    </Stack>
  );
}
