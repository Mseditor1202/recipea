import {
  BottomNavigation as MuiBottomNavigation,
  BottomNavigationAction,
  Paper,
} from "@mui/material";
import HomeRoundedIcon from "@mui/icons-material/HomeRounded";
import CalendarMonthRoundedIcon from "@mui/icons-material/CalendarMonthRounded";
import RestaurantMenuRoundedIcon from "@mui/icons-material/RestaurantMenuRounded";
import MenuBookRoundedIcon from "@mui/icons-material/MenuBookRounded";
import SentimentSatisfiedAltRoundedIcon from "@mui/icons-material/SentimentSatisfiedAltRounded";
import { useRouter } from "next/router";

type BottomNavigationProps = {
  activeNav?: "home" | "meal" | "create" | "recipes" | "mypage";
};

export default function BottomNavigation({ activeNav }: BottomNavigationProps) {
  const router = useRouter();

  const handleChange = (_event: React.SyntheticEvent, value: string) => {
    switch (value) {
      case "home":
        router.push("/home");
        break;

      case "meal":
        router.push("/recipes/weekly");
        break;

      case "create":
        router.push("/recipes/createpost");
        break;

      case "recipes":
        router.push("/recipes");
        break;

      case "mypage":
        // マイページ実装後にルート変更
        break;
    }
  };

  return (
    <Paper
      elevation={4}
      sx={{
        position: "fixed",
        left: 0,
        right: 0,
        bottom: 0,
        zIndex: 1200,
      }}
    >
      <MuiBottomNavigation
        value={activeNav}
        onChange={handleChange}
        showLabels
        sx={{
          height: 72,
          bgcolor: "background.paper",
        }}
      >
        <BottomNavigationAction
          label="Home"
          value="home"
          icon={<HomeRoundedIcon />}
        />

        <BottomNavigationAction
          label="献立"
          value="meal"
          icon={<CalendarMonthRoundedIcon />}
        />

        <BottomNavigationAction
          label="つくる"
          value="create"
          icon={<RestaurantMenuRoundedIcon />}
        />

        <BottomNavigationAction
          label="レシピ"
          value="recipes"
          icon={<MenuBookRoundedIcon />}
        />

        <BottomNavigationAction
          label="マイページ"
          value="mypage"
          icon={<SentimentSatisfiedAltRoundedIcon />}
        />
      </MuiBottomNavigation>
    </Paper>
  );
}
