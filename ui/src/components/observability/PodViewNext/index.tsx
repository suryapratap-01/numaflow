import React, { useMemo } from "react";
import Alert from "@mui/material/Alert";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Chip from "@mui/material/Chip";
import CircularProgress from "@mui/material/CircularProgress";
import Skeleton from "@mui/material/Skeleton";
import Tab from "@mui/material/Tab";
import Tabs from "@mui/material/Tabs";
import Typography from "@mui/material/Typography";
import { CopyViewLinkButton } from "../../common/CopyViewLinkButton";
import { useVertexStatus, useVertexSummary } from "../../../api/v2/hooks";
import { PodViewTarget } from "../../../api/v2/types";

import "./style.css";

export interface PodViewNextProps {
  target: PodViewTarget;
}

const futureTabs = [
  "Metrics",
  "Spec",
  "Processing Rates",
  "K8s Events",
  "Errors",
];

export function PodViewNext({ target }: PodViewNextProps) {
  const summary = useVertexSummary(target);
  const status = useVertexStatus(target);
  const title = summary.data
    ? `${summary.data.vertexType === "MonoVertex" ? "MonoVertex" : "Vertex"}: ${
        summary.data.ref.name
      }`
    : "Vertex";
  const statusRows = useMemo(
    () =>
      status.data
        ? [
            ["Current phase", status.data.phase || "Unknown"],
            ["Desired phase", status.data.desiredPhase || "Unknown"],
            [
              "Ready replicas",
              `${status.data.replicas.ready} / ${status.data.replicas.desired}`,
            ],
            ["Generation", String(status.data.observedGeneration)],
          ]
        : [],
    [status.data]
  );

  return (
    <Box className="pod-view-next" data-testid="pod-view-next">
      <Box className="pod-view-next-header">
        <Box className="pod-view-next-heading">
          {summary.isLoading ? (
            <Skeleton width={280} height={40} />
          ) : (
            <>
              <Typography component="h2" className="pod-view-next-title">
                {title}
              </Typography>
              {summary.data && (
                <Chip
                  size="small"
                  label={summary.data.phase || "Unknown"}
                  className={`pod-view-next-phase pod-view-next-phase--${summary.data.health.state}`}
                />
              )}
            </>
          )}
          {summary.data && (
            <Typography className="pod-view-next-subtitle">
              Controller status observed{" "}
              {new Date(summary.data.observedAt).toLocaleString()}
            </Typography>
          )}
        </Box>
        <Box className="pod-view-next-actions">
          <CopyViewLinkButton iconOnly />
        </Box>
      </Box>

      {summary.isError && (
        <Alert
          severity="error"
          action={
            <Button
              color="inherit"
              size="small"
              onClick={() => summary.refetch()}
            >
              Retry
            </Button>
          }
        >
          Unable to load the vertex summary.
        </Alert>
      )}

      <Tabs value={0} className="pod-view-next-tabs" aria-label="Pod View tabs">
        <Tab label="Pods View" />
        {futureTabs.map((tab) => (
          <Tab key={tab} label={tab} disabled />
        ))}
      </Tabs>

      <Box className="pod-view-next-content">
        <Box className="pod-view-next-placeholder">
          <Typography className="pod-view-next-eyebrow">
            Vertex health
          </Typography>
          <Typography className="pod-view-next-placeholder-title">
            Golden signals arrive in Phase 2
          </Typography>
          <Typography className="pod-view-next-placeholder-copy">
            This Phase 1 shell intentionally loads only API v2 summary and
            controller status.
          </Typography>
        </Box>

        <Box
          className="pod-view-next-status"
          data-testid="pod-view-next-status"
        >
          <Box className="pod-view-next-status-heading">
            <Typography component="h3">Controller status</Typography>
            {status.isFetching && <CircularProgress size={16} />}
          </Box>
          {status.isLoading ? (
            <>
              <Skeleton height={42} />
              <Skeleton height={42} />
              <Skeleton height={42} />
            </>
          ) : status.isError ? (
            <Alert
              severity="warning"
              action={
                <Button
                  color="inherit"
                  size="small"
                  onClick={() => status.refetch()}
                >
                  Retry
                </Button>
              }
            >
              Status is temporarily unavailable. The summary remains usable.
            </Alert>
          ) : (
            <Box component="dl" className="pod-view-next-status-list">
              {statusRows.map(([label, value]) => (
                <Box key={label} className="pod-view-next-status-row">
                  <Typography component="dt">{label}</Typography>
                  <Typography component="dd">{value}</Typography>
                </Box>
              ))}
            </Box>
          )}
        </Box>

        <Box className="pod-view-next-placeholder pod-view-next-placeholder--fleet">
          <Typography className="pod-view-next-eyebrow">
            Fleet health
          </Typography>
          <Typography className="pod-view-next-placeholder-title">
            Pod inventory is not loaded in Phase 1
          </Typography>
        </Box>
      </Box>
    </Box>
  );
}
