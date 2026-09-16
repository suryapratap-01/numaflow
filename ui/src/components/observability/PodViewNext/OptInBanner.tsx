import React from "react";
import Alert from "@mui/material/Alert";
import Button from "@mui/material/Button";

export function OptInBanner({ onTryNext }: { onTryNext: () => void }) {
  return (
    <Alert
      severity="info"
      data-testid="pod-view-next-banner"
      action={
        <Button
          color="inherit"
          size="small"
          onClick={onTryNext}
          data-testid="try-pod-view-next"
        >
          Try new Pod View
        </Button>
      }
      sx={{ margin: "0 4.8rem 1.6rem 0", fontSize: "1.3rem" }}
    >
      A lighter, API v2-backed Pod View is available for preview.
    </Alert>
  );
}
