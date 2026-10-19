import { Box, Typography } from "@mui/material";
import BrandLogo from "@/components/common/BrandLogo";

type PageHeaderProps = {
  title: string;
};

export default function PageHeader({ title }: PageHeaderProps) {
  return (
    <Box
      component="header"
      sx={{
        px: 2,
        py: 1.5,
        bgcolor: "background.paper",
        borderBottom: "1px solid",
        borderColor: "rgba(51, 51, 51, 0.06)",
      }}
    >
      <BrandLogo />

      <Typography
        component="h1"
        sx={{
          position: "absolute",
          width: 1,
          height: 1,
          p: 0,
          m: -1,
          overflow: "hidden",
          clip: "rect(0, 0, 0, 0)",
          whiteSpace: "nowrap",
          border: 0,
        }}
      >
        {title}
      </Typography>
    </Box>
  );
}
