import { useRequireAuth } from "@/hooks/useRequireAuth";
import { Box } from "@mui/material";
import type { ReactNode } from "react";
import PageHeader from "./PageHeader";
import BottomNavigation from "@/components/navigation/BottomNavigation";

type AppLayoutProps = {
  children: ReactNode;
  title: string;
  backHref?: string;
  activeNav?: "home" | "meal" | "create" | "recipes" | "mypage";
};

export default function AppLayout({
  children,
  title,
  backHref,
  activeNav,
}: AppLayoutProps) {
  const { loading } = useRequireAuth();
  if (loading) {
    return null;
  }
  return (
    <Box
      sx={{
        minHeight: "100vh",
        bgcolor: "background.default",
      }}
    >
      <PageHeader title={title} backHref={backHref} />

      <Box
        component="main"
        sx={{
          pb: 10,
        }}
      >
        {children}
      </Box>

      <BottomNavigation activeNav={activeNav} />
    </Box>
  );
}
