import React, { useContext } from "react";
import Box from "@mui/material/Box";
import { MetricsModalWrapper } from "../../../../../../../../../../../../common/MetricsModalWrapper";
import {
  ago,
  getPodContainerUsePercentages,
} from "../../../../../../../../../../../../../utils";
import { PodInfoProps } from "../../../../../../../../../../../../../types/declarations/pods";
import {
  CONTAINER_CPU_UTILIZATION,
  CONTAINER_MEMORY_UTILIZATION,
} from "../Metrics/utils/constants";
import { AppContextProps } from "../../../../../../../../../../../../../types/declarations/app";
import { AppContext } from "../../../../../../../../../../../../../App";

import "./style.css";

const parseCpuMillicores = (raw?: string): number | null => {
  if (!raw || raw === "?") return null;
  if (raw.endsWith("n")) return parseFloat(raw) / 1e6;
  if (raw.endsWith("m")) return parseFloat(raw);
  const n = parseFloat(raw);
  return Number.isFinite(n) ? n * 1000 : null;
};

const parseMemMi = (raw?: string): number | null => {
  if (!raw || raw === "?") return null;
  if (raw.endsWith("Ki")) return parseFloat(raw) / 1024;
  if (raw.endsWith("Mi")) return parseFloat(raw);
  if (raw.endsWith("Gi")) return parseFloat(raw) * 1024;
  const n = parseFloat(raw);
  return Number.isFinite(n) ? n : null;
};

export function ContainerInfo({
  namespaceId,
  pipelineId,
  vertexId,
  type,
  pod,
  podDetails,
  containerName,
  containerInfo,
  podSpecificInfo,
  onViewMetrics,
}: PodInfoProps) {
  const { disableMetricsCharts } = useContext<AppContextProps>(AppContext);

  const resourceUsage = getPodContainerUsePercentages(
    pod,
    podDetails,
    containerName
  );

  // CPU
  let usedCPU: string | undefined =
    podDetails?.containerMap instanceof Map
      ? podDetails?.containerMap?.get(containerName)?.cpu
      : undefined;
  let specCPU: string | undefined =
    pod?.containerSpecMap instanceof Map
      ? pod?.containerSpecMap?.get(containerName)?.cpu
      : undefined;
  if (!usedCPU) {
    usedCPU = "?";
  } else if (usedCPU.endsWith("n")) {
    usedCPU = `${(parseFloat(usedCPU) / 1e6).toFixed(2)}m`;
  }
  if (!specCPU) {
    specCPU = "?";
  }
  let cpuPercent = "unavailable";
  if (resourceUsage?.cpuPercent) {
    cpuPercent = `${resourceUsage.cpuPercent?.toFixed(2)}%`;
  }
  // Memory
  let usedMem: string | undefined =
    podDetails?.containerMap instanceof Map
      ? podDetails?.containerMap?.get(containerName)?.memory
      : undefined;
  let specMem: string | undefined =
    pod?.containerSpecMap instanceof Map
      ? pod?.containerSpecMap?.get(containerName)?.memory
      : undefined;
  if (!usedMem) {
    usedMem = "?";
  } else if (usedMem.endsWith("Ki")) {
    usedMem = `${(parseFloat(usedMem) / 1024).toFixed(2)}Mi`;
  }
  if (!specMem) {
    specMem = "?";
  }
  let memPercent = "unavailable";
  if (resourceUsage?.memoryPercent) {
    memPercent = `${resourceUsage.memoryPercent.toFixed(2)}%`;
  }

  const status = podSpecificInfo?.status || containerInfo?.state || "Unknown";
  const isBad =
    status.toLowerCase().includes("crash") ||
    status.toLowerCase().includes("error") ||
    status.toLowerCase().includes("fail") ||
    status.toLowerCase().includes("oom");

  const usedCpuN = parseCpuMillicores(usedCPU);
  const specCpuN = parseCpuMillicores(specCPU);
  const usedMemN = parseMemMi(usedMem);
  const specMemN = parseMemMi(specMem);
  const cpuBarPct =
    resourceUsage?.cpuPercent != null
      ? Math.min(100, resourceUsage.cpuPercent)
      : usedCpuN != null && specCpuN
      ? Math.min(100, (usedCpuN / specCpuN) * 100)
      : 0;
  const memBarPct =
    resourceUsage?.memoryPercent != null
      ? Math.min(100, resourceUsage.memoryPercent)
      : usedMemN != null && specMemN
      ? Math.min(100, (usedMemN / specMemN) * 100)
      : 0;

  const hasTermination =
    containerInfo?.lastTerminationReason ||
    containerInfo?.lastTerminationMessage ||
    (containerInfo?.lastTerminationExitCode !== null &&
      containerInfo?.lastTerminationExitCode !== undefined);

  const overviewRows: { label: string; value: React.ReactNode; warn?: boolean }[] =
    [
      { label: "Container", value: containerName || "—" },
      {
        label: "Waiting Reason",
        value: containerInfo?.waitingReason || status,
        warn: Boolean(containerInfo?.waitingReason) || isBad,
      },
      {
        label: "Exit Code",
        value:
          containerInfo?.lastTerminationExitCode != null
            ? String(containerInfo.lastTerminationExitCode)
            : "—",
        warn: containerInfo?.lastTerminationExitCode != null,
      },
      {
        label: "Restarts",
        value: String(
          containerInfo?.restartCount ?? podSpecificInfo?.restartCount ?? "—"
        ),
        warn: (containerInfo?.restartCount ?? 0) > 0,
      },
      {
        label: "Last Started",
        value: containerInfo?.lastStartedAt
          ? `${ago(new Date(containerInfo.lastStartedAt), 2)} ago`
          : "N/A",
      },
    ];

  return (
    <Box data-testid="containerInfo" className="pod-overview-root">
      <section className="pod-overview-card">
        <Box className="pod-overview-section-hdr">
          <Box className="pod-overview-section-label">
            <span className="pod-overview-section-dot" />
            Container Info
          </Box>
          <span
            className={`pod-overview-status-badge${
              isBad
                ? " pod-overview-status-badge-bad"
                : " pod-overview-status-badge-ok"
            }`}
          >
            {status}
          </span>
        </Box>
        <p className="pod-overview-pod-name">{pod?.name}</p>
        <dl className="pod-overview-dl">
          {overviewRows.map((row) => (
            <div key={row.label} className="pod-overview-row">
              <dt>{row.label}</dt>
              <dd className={row.warn ? "pod-overview-warn" : undefined}>
                {row.value}
              </dd>
            </div>
          ))}

          <div className="pod-overview-resource">
            <div className="pod-overview-row">
              <dt>CPU</dt>
              <dd>
                <MetricsModalWrapper
                  disableMetricsCharts={disableMetricsCharts}
                  namespaceId={namespaceId}
                  pipelineId={pipelineId}
                  vertexId={vertexId}
                  type={type}
                  metricDisplayName={CONTAINER_CPU_UTILIZATION}
                  value={`${usedCPU} / ${specCPU}`}
                  pod={pod}
                />
              </dd>
            </div>
            <div className="pod-overview-bar-track">
              <div
                className="pod-overview-bar-fill pod-overview-bar-cpu"
                style={{ width: `${cpuBarPct}%` }}
              />
            </div>
            <div className="pod-overview-resource-meta">{cpuPercent}</div>
          </div>

          <div className="pod-overview-resource">
            <div className="pod-overview-row">
              <dt>Memory</dt>
              <dd>
                <MetricsModalWrapper
                  disableMetricsCharts={disableMetricsCharts}
                  namespaceId={namespaceId}
                  pipelineId={pipelineId}
                  vertexId={vertexId}
                  type={type}
                  metricDisplayName={CONTAINER_MEMORY_UTILIZATION}
                  value={`${usedMem} / ${specMem}`}
                  pod={pod}
                />
              </dd>
            </div>
            <div className="pod-overview-bar-track">
              <div
                className={`pod-overview-bar-fill${
                  memBarPct > 85
                    ? " pod-overview-bar-mem-hot"
                    : " pod-overview-bar-mem"
                }`}
                style={{ width: `${memBarPct}%` }}
              />
            </div>
            <div className="pod-overview-resource-meta">{memPercent}</div>
          </div>
        </dl>
      </section>

      {hasTermination && (
        <section className="pod-overview-card pod-overview-card-term">
          <Box className="pod-overview-section-hdr">
            <Box className="pod-overview-section-label">
              <span className="pod-overview-section-dot" />
              Last Termination
            </Box>
          </Box>
          {containerInfo?.lastTerminationReason && (
            <p className="pod-overview-term-reason">
              {containerInfo.lastTerminationReason}
            </p>
          )}
          {containerInfo?.lastTerminationMessage && (
            <p className="pod-overview-term-msg">
              {containerInfo.lastTerminationMessage}
            </p>
          )}
          {containerInfo?.waitingMessage && (
            <p className="pod-overview-term-msg">
              {containerInfo.waitingMessage}
            </p>
          )}
        </section>
      )}

      <section className="pod-overview-card">
        <Box className="pod-overview-section-hdr">
          <Box className="pod-overview-section-label">
            <span className="pod-overview-section-dot" />
            Quick Metrics
          </Box>
          {onViewMetrics && (
            <button
              type="button"
              className="pod-overview-view-all"
              onClick={onViewMetrics}
              data-testid="pod-overview-view-all"
            >
              View all
            </button>
          )}
        </Box>
        <div className="pod-overview-quick">
          {podSpecificInfo?.totalCPU && (
            <div className="pod-overview-quick-row">
              <span>Pod CPU</span>
              <span className="pod-overview-quick-val">
                {podSpecificInfo.totalCPU}
              </span>
            </div>
          )}
          {podSpecificInfo?.totalMemory && (
            <div className="pod-overview-quick-row">
              <span>Pod Memory</span>
              <span className="pod-overview-quick-val">
                {podSpecificInfo.totalMemory}
              </span>
            </div>
          )}
          {podSpecificInfo?.reason && (
            <div className="pod-overview-quick-row">
              <span>Reason</span>
              <span className="pod-overview-quick-val">
                {podSpecificInfo.reason}
              </span>
            </div>
          )}
          {podSpecificInfo?.message && (
            <div className="pod-overview-quick-row">
              <span>Message</span>
              <span className="pod-overview-quick-val">
                {podSpecificInfo.message}
              </span>
            </div>
          )}
          {!podSpecificInfo?.totalCPU &&
            !podSpecificInfo?.totalMemory &&
            !podSpecificInfo?.reason &&
            !podSpecificInfo?.message && (
              <div className="pod-overview-quick-empty">
                Open Metrics for charts and filters
              </div>
            )}
        </div>
      </section>
    </Box>
  );
}
