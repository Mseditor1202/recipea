import { Button, Stack, Typography } from "@mui/material";
import { useRouter } from "next/router";
import AppLayout from "@/components/layout/AppLayout";

export default function MyPage() {
  const router = useRouter();

  return (
    <AppLayout title="マイページ" activeNav="mypage">
      <Stack spacing={3} sx={{ px: 2, py: 3 }}>
        <Typography variant="body1">アカウント設定</Typography>

        <Button variant="outlined" onClick={() => router.push("/auth/logout")}>
          ログアウト
        </Button>
      </Stack>
    </AppLayout>
  );
}
