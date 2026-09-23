import {
  BottomNavigation as MuiBottomNavigation,
  BottomNavigationAction,
  Box,
  Paper,
} from "@mui/material";
import { useRouter } from "next/router";

type BottomNavigationProps = {
  activeNav?: "home" | "meal" | "create" | "recipes" | "mypage";
};

function NavIcon({ src, alt }: { src: string; alt: string }) {
  return (
    <Box
      component="img"
      src={src}
      alt={alt}
      sx={{
        width: 28,
        height: 28,
        objectFit: "contain",
      }}
    />
  );
}

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
          icon={
            <NavIcon
              src="/icons/rakusuru/navigation/lg_nav_home.svg"
              alt="Home"
            />
          }
        />

        <BottomNavigationAction
          label="献立"
          value="meal"
          icon={
            <NavIcon
              src="/icons/rakusuru/navigation/lg_nav_mealplan.svg"
              alt="献立"
            />
          }
        />

        <BottomNavigationAction
          label="つくる"
          value="create"
          icon={
            <NavIcon
              src="/icons/rakusuru/navigation/lg_nav_create.svg"
              alt="つくる"
            />
          }
        />

        <BottomNavigationAction
          label="レシピ"
          value="recipes"
          icon={
            <NavIcon
              src="/icons/rakusuru/navigation/lg_nav_recipe.svg"
              alt="レシピ"
            />
          }
        />

        <BottomNavigationAction
          label="マイページ"
          value="mypage"
          icon={
            <NavIcon
              src="/icons/rakusuru/navigation/lg_nav_mypage.svg"
              alt="マイページ"
            />
          }
        />
      </MuiBottomNavigation>
    </Paper>
  );
}
