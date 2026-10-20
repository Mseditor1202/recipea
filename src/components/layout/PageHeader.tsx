import { Box, IconButton, Typography } from "@mui/material";
import BrandLogo from "@/components/common/BrandLogo";

type PageHeaderProps = {
  title: string;
  backHref?: string;
};

export default function PageHeader({ title, backHref }: PageHeaderProps) {
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

      <Box
        sx={{
          mt: 1.5,
          display: "grid",
          gridTemplateColumns: "40px 1fr 40px",
          alignItems: "center",
        }}
      >
        <IconButton
          onClick={() => {
            if (backHref) {
              window.location.href = backHref;
            } else {
              window.history.back();
            }
          }}
          sx={{
            width: 40,
            height: 40,
            color: "#333333",
          }}
        >
          ←
        </IconButton>

        <Typography
          component="h1"
          sx={{
            textAlign: "center",
            fontSize: 16,
            fontWeight: 700,
            color: "#333333",
          }}
        >
          {title}
        </Typography>

        <Box />
      </Box>
    </Box>
  );
}
