import React, { useCallback, useState } from "react";
import Box from "@mui/material/Box";
import Chip from "@mui/material/Chip";
import IconButton from "@mui/material/IconButton";
import Popover from "@mui/material/Popover";
import ToggleButton from "@mui/material/ToggleButton";
import ToggleButtonGroup from "@mui/material/ToggleButtonGroup";
import Typography from "@mui/material/Typography";
import InfoOutlinedIcon from "@mui/icons-material/InfoOutlined";
import { useCapabilities } from "../../../api/v2/hooks";
import { usePodViewExperience } from "../../../contexts/PodViewExperienceContext";

export function PodViewBetaToggle() {
  const { experience, setExperience } = usePodViewExperience();
  const capabilities = useCapabilities();
  const [infoAnchor, setInfoAnchor] = useState<HTMLElement | null>(null);
  const classicAvailable =
    capabilities.data?.podView.allowClassicFallback !== false;
  const selectedExperience = classicAvailable ? experience : "next";

  const handleChange = useCallback(
    (
      _: React.MouseEvent<HTMLElement>,
      nextExperience: "classic" | "next" | null
    ) => {
      if (nextExperience) {
        setExperience(nextExperience);
      }
    },
    [setExperience]
  );

  return (
    <Box sx={{ alignItems: "center", display: "flex", ml: 2, mr: 1 }}>
      <ToggleButtonGroup
        aria-label="Pod View experience"
        exclusive
        onChange={handleChange}
        size="small"
        sx={{
          bgcolor: "rgba(255, 255, 255, 0.16)",
          border: "1px solid rgba(255, 255, 255, 0.36)",
          borderRadius: "20px",
          overflow: "hidden",
          "& .MuiToggleButtonGroup-grouped": {
            border: 0,
            borderRadius: "18px !important",
            color: "#fff",
            fontSize: "0.875rem",
            fontWeight: 600,
            minHeight: 38,
            px: 1.75,
            textTransform: "none",
          },
          "& .MuiToggleButton-root.Mui-selected": {
            bgcolor: "#fff",
            color: "primary.main",
            "&:hover": { bgcolor: "#f5f5f5" },
          },
        }}
        value={selectedExperience}
      >
        <ToggleButton
          data-testid="pod-view-experience-classic"
          disabled={!classicAvailable}
          value="classic"
        >
          Classic
        </ToggleButton>
        <ToggleButton data-testid="pod-view-experience-next" value="next">
          New Pod View
          <Chip
            label="Beta"
            size="small"
            sx={{
              bgcolor:
                selectedExperience === "next"
                  ? "primary.main"
                  : "rgba(255, 255, 255, 0.22)",
              color: "#fff",
              fontSize: "0.65rem",
              fontWeight: 700,
              height: 20,
              ml: 0.75,
            }}
          />
        </ToggleButton>
      </ToggleButtonGroup>
      <IconButton
        aria-label="About the new Pod View"
        color="inherit"
        onClick={(event) => setInfoAnchor(event.currentTarget)}
        size="small"
        sx={{ ml: 0.5 }}
      >
        <InfoOutlinedIcon fontSize="small" />
      </IconButton>
      <Popover
        anchorEl={infoAnchor}
        anchorOrigin={{ horizontal: "right", vertical: "bottom" }}
        onClose={() => setInfoAnchor(null)}
        open={Boolean(infoAnchor)}
        transformOrigin={{ horizontal: "right", vertical: "top" }}
      >
        <Box sx={{ maxWidth: 300, p: 2 }}>
          <Typography fontWeight={700} variant="subtitle2">
            New Pod View (beta)
          </Typography>
          <Typography sx={{ mt: 0.5 }} variant="body2">
            A lighter, API v2-backed view of your vertex pods and status.
          </Typography>
          <Typography sx={{ mt: 1 }} variant="body2">
            Your preference is saved in this browser. Switch back to Classic
            anytime.
          </Typography>
        </Box>
      </Popover>
    </Box>
  );
}
