import React, { useEffect, useState } from "react";
import { useRouter } from "next/router";
import {
  Avatar,
  Box,
  Button,
  Card,
  Skeleton,
  Stack,
  Typography,
} from "@mui/material";
import { collection, getDocs, query, where } from "firebase/firestore";

import AppLayout from "@/components/layout/AppLayout";
import { useAuth } from "@/hooks/useAuth";
import { db } from "@/lib/firebase";
import { listRecipes } from "@/features/recipes";
import { listZuboraSets } from "@/features/zuboraSets/repositories/zuboraSetRepository";

type UsageStats = {
  recipes: number;
  zuboraSets: number;
  mealTemplates: number;
};

const INITIAL_STATS: UsageStats = {
  recipes: 0,
  zuboraSets: 0,
  mealTemplates: 0,
};

export default function MyPage() {
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();

  const [stats, setStats] = useState<UsageStats>(INITIAL_STATS);
  const [statsLoading, setStatsLoading] = useState(true);
  const [statsError, setStatsError] = useState("");

  useEffect(() => {
    if (authLoading) return;

    if (!user) {
      setStatsLoading(false);
      return;
    }

    const fetchStats = async () => {
      try {
        setStatsLoading(true);
        setStatsError("");

        const [recipes, zuboraSets, dailySetsSnap] = await Promise.all([
          listRecipes(user.uid),
          listZuboraSets(user.uid),
          getDocs(
            query(collection(db, "dailySets"), where("userId", "==", user.uid)),
          ),
        ]);

        setStats({
          recipes: recipes.length,
          zuboraSets: zuboraSets.length,
          mealTemplates: dailySetsSnap.size,
        });
      } catch (error) {
        console.error("[MYPAGE] stats fetch failed:", error);
        setStatsError("利用状況の読み込みに失敗しました。");
      } finally {
        setStatsLoading(false);
      }
    };

    fetchStats();
  }, [user, authLoading]);

  const displayName = user?.displayName || "ゲストユーザー";
  const email = user?.email || "";
  const photoUrl = user?.photoURL || undefined;

  const usageItems = [
    {
      label: "登録レシピ",
      value: `${stats.recipes}件`,
      icon: "/icons/rakusuru/navigation/lg_nav_recipe.svg",
    },
    {
      label: "お気に入り",
      value: "準備中",
      icon: "/icons/rakusuru/action/lg_action_favorite.png",
    },
    {
      label: "ズボラセット",
      value: `${stats.zuboraSets}件`,
      icon: "/icons/rakusuru/feature/lg_zubora_set.png",
    },
    {
      label: "献立テンプレート",
      value: `${stats.mealTemplates}件`,
      icon: "/icons/rakusuru/feature/lg_life_template.png",
    },
  ];

  return (
    <AppLayout title="マイページ" activeNav="mypage">
      <Box
        sx={{
          width: "100%",
          maxWidth: 880,
          mx: "auto",
          px: { xs: 2, sm: 3 },
          py: { xs: 3, md: 4 },
        }}
      >
        {/* プロフィール */}
        <Card
          sx={{
            p: { xs: 2.5, sm: 3 },
            borderRadius: 4,
            border: "1px solid #F1E7D8",
            bgcolor: "#FFFFFF",
            boxShadow: "0 6px 20px rgba(86, 64, 38, 0.05)",
          }}
        >
          <Stack
            direction={{ xs: "column", sm: "row" }}
            alignItems={{ xs: "center", sm: "center" }}
            justifyContent="space-between"
            spacing={3}
          >
            <Stack
              direction={{ xs: "column", sm: "row" }}
              alignItems="center"
              spacing={2}
              sx={{
                minWidth: 0,
                textAlign: { xs: "center", sm: "left" },
              }}
            >
              <Avatar
                src={photoUrl}
                alt={displayName}
                sx={{
                  width: 80,
                  height: 80,
                  bgcolor: "#FFF3E0",
                  color: "#D98300",
                  fontSize: 30,
                  fontWeight: 700,
                  border: "2px solid #F3D6A3",
                }}
              >
                {displayName.slice(0, 1)}
              </Avatar>

              <Box sx={{ minWidth: 0 }}>
                <Typography
                  component="h1"
                  sx={{
                    fontSize: { xs: 22, sm: 24 },
                    fontWeight: 800,
                    color: "#333333",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                  }}
                >
                  {displayName}
                </Typography>

                {email && (
                  <Typography
                    sx={{
                      mt: 0.5,
                      fontSize: 13,
                      color: "#777777",
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                    }}
                  >
                    {email}
                  </Typography>
                )}
              </Box>
            </Stack>

            <Button
              type="button"
              variant="outlined"
              onClick={() => router.push("/mypage/profile")}
              sx={{
                minHeight: 42,
                px: 2.5,
                borderRadius: 999,
                borderColor: "#F2C98C",
                color: "#B86E00",
                fontWeight: 700,
                fontSize: 13,
                textTransform: "none",
                whiteSpace: "nowrap",
                "&:hover": {
                  borderColor: "#FFB830",
                  bgcolor: "#FFF8EC",
                },
              }}
            >
              プロフィールを編集
            </Button>
          </Stack>
        </Card>

        {/* 利用状況 */}
        <Box sx={{ mt: 4 }}>
          <Typography
            component="h2"
            sx={{
              mb: 2,
              fontSize: 18,
              fontWeight: 800,
              color: "#333333",
            }}
          >
            利用状況
          </Typography>

          {statsError && (
            <Typography
              sx={{
                mb: 2,
                fontSize: 13,
                color: "#D32F2F",
              }}
            >
              {statsError}
            </Typography>
          )}

          <Box
            sx={{
              display: "grid",
              gridTemplateColumns: {
                xs: "repeat(2, minmax(0, 1fr))",
                sm: "repeat(4, minmax(0, 1fr))",
              },
              gap: { xs: 1.5, sm: 2 },
            }}
          >
            {usageItems.map((item) => (
              <Card
                key={item.label}
                sx={{
                  p: { xs: 2, sm: 2.5 },
                  minHeight: 150,
                  borderRadius: 3,
                  border: "1px solid #F0E8DC",
                  bgcolor: "#FFFFFF",
                  boxShadow: "0 4px 12px rgba(0,0,0,0.04)",
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  justifyContent: "center",
                  textAlign: "center",
                }}
              >
                <Box
                  sx={{
                    width: 52,
                    height: 52,
                    borderRadius: "50%",
                    bgcolor: "#FFF8EC",
                    display: "grid",
                    placeItems: "center",
                  }}
                >
                  <Box
                    component="img"
                    src={item.icon}
                    alt=""
                    sx={{
                      width: 30,
                      height: 30,
                      objectFit: "contain",
                    }}
                  />
                </Box>

                <Typography
                  sx={{
                    mt: 1.5,
                    fontSize: 12,
                    fontWeight: 700,
                    color: "#777777",
                    lineHeight: 1.5,
                  }}
                >
                  {item.label}
                </Typography>

                {statsLoading && item.value !== "準備中" ? (
                  <Skeleton
                    width={48}
                    height={34}
                    sx={{
                      mt: 0.5,
                    }}
                  />
                ) : (
                  <Typography
                    sx={{
                      mt: 0.4,
                      fontSize: item.value === "準備中" ? 15 : 22,
                      fontWeight: 800,
                      color: item.value === "準備中" ? "#999999" : "#333333",
                    }}
                  >
                    {item.value}
                  </Typography>
                )}
              </Card>
            ))}
          </Box>

          <Typography
            sx={{
              mt: 1.5,
              fontSize: 11,
              color: "#999999",
              textAlign: "right",
            }}
          >
            ※ お気に入り機能はβ版公開後に追加予定です
          </Typography>
        </Box>

        {/* ログアウト */}
        <Box
          sx={{
            mt: 5,
            display: "flex",
            justifyContent: "center",
          }}
        >
          <Button
            type="button"
            variant="outlined"
            onClick={() => router.push("/auth/logout")}
            sx={{
              minWidth: { xs: "100%", sm: 260 },
              minHeight: 50,
              borderRadius: 3,
              borderColor: "#D9D9D9",
              color: "#666666",
              fontSize: 14,
              fontWeight: 700,
              textTransform: "none",
              "&:hover": {
                borderColor: "#BBBBBB",
                bgcolor: "#FAFAFA",
              },
            }}
          >
            ログアウト
          </Button>
        </Box>
      </Box>
    </AppLayout>
  );
}
