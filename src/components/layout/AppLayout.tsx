import { useRequireAuth } from "@/hooks/useRequireAuth";
import { Box } from "@mui/material";
import type { ReactNode } from "react";
import PageHeader from "./PageHeader";
import BottomNavigation from "@/components/navigation/BottomNavigation";

type AppLayoutProps = {
  children: ReactNode;
  title: string;
  backHref?: string;
  onBack?: () => void;
  activeNav?: "home" | "meal" | "create" | "recipes" | "mypage";
  showBottomNavigation?: boolean;
};

export default function AppLayout({
  children,
  title,
  backHref,
  onBack,
  activeNav,
  showBottomNavigation = true,
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
      <PageHeader title={title} backHref={backHref} onBack={onBack} />

      <Box
        component="main"
        sx={{
          pb: 10,
        }}
      >
        {children}
      </Box>

      {showBottomNavigation && <BottomNavigation activeNav={activeNav} />}
    </Box>
  );
}
