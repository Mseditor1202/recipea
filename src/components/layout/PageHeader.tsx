import { Box, Typography } from "@mui/material";

type PageHeaderProps = {
  title: string;
};

export default function PageHeader({ title }: PageHeaderProps) {
  return (
    <Box
      component="header"
      sx={{
        px: 2,
        py: 2,
        bgcolor: "background.paper",
        borderBottom: "1px solid",
        borderColor: "rgba(51, 51, 51, 0.06)",
      }}
    >
      <Typography
        component="h1"
        sx={{
          fontSize: 18,
          fontWeight: 700,
          color: "text.primary",
        }}
      >
        {title}
      </Typography>
    </Box>
  );
}
