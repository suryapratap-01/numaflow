import React, { SyntheticEvent, useContext } from "react";
import Box from "@mui/material/Box";
import Tab from "@mui/material/Tab";
import Tabs from "@mui/material/Tabs";
import TerminalIcon from "@mui/icons-material/Terminal";
import BarChartIcon from "@mui/icons-material/BarChart";
import { Metrics } from "./partials/Metrics";
import { PodLogs } from "./partials/PodLogs";
import { PodDetailProps } from "../../../../../../../../../../../types/declarations/pods";
import { AppContextProps } from "../../../../../../../../../../../types/declarations/app";
import { AppContext } from "../../../../../../../../../../../App";
import {
  VertexDetailsContext,
  VertexDetailsContextProps,
} from "../../../../../../../../../../common/SlidingSidebar/partials/VertexDetails";

import "./style.css";

const LOGS_TAB_INDEX = 0;
const METRICS_TAB_INDEX = 1;

const tabSx = {
  fontSize: "1.3rem",
  fontStyle: "normal",
  fontWeight: 600,
  textTransform: "none" as const,
  minHeight: "3.6rem",
  padding: "0.8rem 1.2rem",
  color: "#94a3b8",
  "&.Mui-selected": {
    color: "#0284c7",
  },
};

const tabsSx = {
  minHeight: "3.6rem",
  "& .MuiTabs-indicator": {
    backgroundColor: "#0ea5e9",
    height: "2px",
  },
};

export function PodDetail({
  namespaceId,
  pipelineId,
  type,
  containerName,
  pod,
  vertexId,
}: PodDetailProps) {
  if (!pod) return null;

  const { disableMetricsCharts } = useContext<AppContextProps>(AppContext);

  const { podsViewTab, setPodsViewTab } =
    useContext<VertexDetailsContextProps>(VertexDetailsContext);
  const handleTabChange = (_: SyntheticEvent, newValue: number) => {
    setPodsViewTab(newValue);
  };

  return (
    <Box
      sx={{
        display: "flex",
        flexDirection: "column",
        width: "100%",
        height: "100%",
        minHeight: 0,
        overflow: "hidden",
      }}
    >
      <Box className="pod-detail-tabs-row">
        <Tabs
          value={podsViewTab}
          onChange={handleTabChange}
          aria-label="Pods Details Tabs"
          className="pod-detail-tabs"
          sx={tabsSx}
        >
          <Tab
            sx={tabSx}
            icon={<TerminalIcon sx={{ fontSize: "1.4rem" }} />}
            iconPosition="start"
            label="Logs"
            data-testid="logs-tab"
          />
          {!disableMetricsCharts && (
            <Tab
              sx={tabSx}
              icon={<BarChartIcon sx={{ fontSize: "1.4rem" }} />}
              iconPosition="start"
              label="Metrics"
              data-testid="metrics-tab"
            />
          )}
        </Tabs>
        {podsViewTab === LOGS_TAB_INDEX && (
          <span className="pod-detail-tabs-hint">
            Toolbar below filters this container&apos;s log stream
          </span>
        )}
      </Box>
      <div className="pod-detail-tab-panel" role="tabpanel">
        {podsViewTab === LOGS_TAB_INDEX && (
          <Box
            sx={{
              height: "100%",
              display: "flex",
              flexDirection: "column",
              minHeight: 0,
              overflow: "hidden",
              flex: 1,
            }}
          >
            <PodLogs
              key={`${pod.name}-${containerName}`}
              namespaceId={namespaceId}
              podName={pod.name}
              containerName={containerName}
              type={type}
            />
          </Box>
        )}
        {!disableMetricsCharts && podsViewTab === METRICS_TAB_INDEX && (
          <Box
            sx={{
              p: "1.2rem",
              height: "100%",
              overflow: "auto",
              backgroundColor: "#f7f8fa",
              flex: 1,
              minHeight: 0,
            }}
          >
            <Metrics
              namespaceId={namespaceId}
              pipelineId={pipelineId}
              type={type}
              vertexId={vertexId}
              pod={pod}
            />
          </Box>
        )}
      </div>
    </Box>
  );
}
