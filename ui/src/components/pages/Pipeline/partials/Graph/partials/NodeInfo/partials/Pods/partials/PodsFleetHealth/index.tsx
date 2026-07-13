import {
  SyntheticEvent,
  useCallback,
  useMemo,
  useState,
} from "react";
import Box from "@mui/material/Box";
import Autocomplete from "@mui/material/Autocomplete";
import TextField from "@mui/material/TextField";
import Tooltip from "@mui/material/Tooltip";
import SearchIcon from "@mui/icons-material/Search";
import { getColorCode } from "../../../../../../../../../../../utils/gradients";
import { getPodContainerUsePercentages } from "../../../../../../../../../../../utils";
import {
  ContainerHealth,
  Pod,
  PodDetail,
  PodHealth,
  PodSeverity,
  PodsFleetHealthProps,
} from "../../../../../../../../../../../types/declarations/pods";

import "./style.css";

type PodFilter = "all" | "critical" | "warning" | "healthy";

const cpuColors = {
  infinite: [100, 100000],
  red: [76, 1000],
  orange: [51, 75],
  yellow: [31, 50],
  green: [0, 30],
};

const memColors = {
  infinite: [100, 100000],
  red: [86, 1000],
  orange: [71, 85],
  yellow: [51, 70],
  green: [0, 50],
};

const CHIP_COLORS: Record<
  PodSeverity,
  { bg: string; fg: string }
> = {
  critical: { bg: "#ef4444", fg: "#fff" },
  warning: { bg: "#f59e0b", fg: "#fff" },
  healthy: { bg: "#4ade80", fg: "#fff" },
  unknown: { bg: "#cbd5e1", fg: "#64748b" },
};

const isUnhealthyStatus = (status?: string) => {
  if (!status) return false;
  const s = status.toLowerCase();
  return (
    s.includes("crash") ||
    s.includes("error") ||
    s.includes("fail") ||
    s.includes("oom") ||
    s === "pending" ||
    s === "unknown"
  );
};

export const computePodSeverity = (
  maxCPUPerc: number,
  maxMemPerc: number,
  status?: string
): PodSeverity => {
  if (isUnhealthyStatus(status)) return "critical";
  if (maxCPUPerc < 0 && maxMemPerc < 0) return "unknown";

  const cpuCode = getColorCode(cpuColors, maxCPUPerc);
  const memCode = getColorCode(memColors, maxMemPerc);

  if (
    cpuCode === "red" ||
    cpuCode === "infinite" ||
    memCode === "red" ||
    memCode === "infinite"
  ) {
    return "critical";
  }
  if (
    cpuCode === "orange" ||
    cpuCode === "yellow" ||
    memCode === "orange" ||
    memCode === "yellow"
  ) {
    return "warning";
  }
  if (cpuCode === "grey" && memCode === "grey") return "unknown";
  return "healthy";
};

const buildPodsHealth = (
  pods: Pod[],
  podsDetailsMap: Map<string, PodDetail>
): PodHealth[] => {
  const podsHealth: PodHealth[] = [];
  pods?.forEach((pod) => {
    const details = podsDetailsMap?.get(pod.name);
    const podObj: PodHealth = {
      name: pod.name,
      pod,
      details: details || { name: pod.name, containerMap: new Map() },
      maxCPUPerc: -1,
      maxMemPerc: -1,
      container: [],
      severity: "unknown",
    };

    details?.containerMap?.forEach((_value, key) => {
      const resourceUsage = getPodContainerUsePercentages(pod, details, key);
      if (resourceUsage?.cpuPercent != null) {
        podObj.maxCPUPerc = Math.max(
          podObj.maxCPUPerc < 0 ? 0 : podObj.maxCPUPerc,
          resourceUsage.cpuPercent
        );
      }
      if (resourceUsage?.memoryPercent != null) {
        podObj.maxMemPerc = Math.max(
          podObj.maxMemPerc < 0 ? 0 : podObj.maxMemPerc,
          resourceUsage.memoryPercent
        );
      }
      podObj.container.push({
        name: key,
        cpu: details.containerMap?.get(key)?.cpu,
        mem: details.containerMap?.get(key)?.memory,
        ...resourceUsage,
      });
    });

    podsHealth.push(podObj);
  });
  return podsHealth;
};

const ChipTooltip = ({ podHealth }: { podHealth: PodHealth }) => (
  <div>
    <div>
      <span className="pod-chip-tooltip-span">
        <b> Pod: </b>
        {podHealth.name}
      </span>
    </div>
    <table className="pod-chip-tooltip-table">
      <thead>
        <tr>
          <th className="pod-chip-tooltip-th">Container</th>
          <th className="pod-chip-tooltip-th">CPU</th>
          <th className="pod-chip-tooltip-th">MEM</th>
        </tr>
      </thead>
      <tbody>
        {podHealth.container
          ?.filter((c: ContainerHealth) => c?.name !== "monitor")
          .map((container: ContainerHealth) => (
            <tr key={container.name}>
              <td className="pod-chip-tooltip-td">{container.name}</td>
              <td className="pod-chip-tooltip-td">
                {container.cpuPercent != null
                  ? `${container.cpuPercent.toFixed(2)}%`
                  : "—"}
              </td>
              <td className="pod-chip-tooltip-td">
                {container.memoryPercent != null
                  ? `${container.memoryPercent.toFixed(2)}%`
                  : "—"}
              </td>
            </tr>
          ))}
      </tbody>
    </table>
  </div>
);

export function PodsFleetHealth({
  pods,
  podsDetailsMap,
  selectedPod,
  onPodSelect,
  podStatusByName,
}: PodsFleetHealthProps) {
  const [podFilter, setPodFilter] = useState<PodFilter>("all");

  const podsHealth = useMemo(() => {
    const health = buildPodsHealth(pods, podsDetailsMap);
    return health.map((h) => ({
      ...h,
      severity: computePodSeverity(
        h.maxCPUPerc,
        h.maxMemPerc,
        podStatusByName?.get(h.name)
      ),
    }));
  }, [pods, podsDetailsMap, podStatusByName]);

  const counts = useMemo(
    () => ({
      all: podsHealth.length,
      critical: podsHealth.filter((p) => p.severity === "critical").length,
      warning: podsHealth.filter((p) => p.severity === "warning").length,
      healthy: podsHealth.filter((p) => p.severity === "healthy").length,
    }),
    [podsHealth]
  );

  const filtered = useMemo(() => {
    if (podFilter === "all") return podsHealth;
    return podsHealth.filter((p) => p.severity === podFilter);
  }, [podsHealth, podFilter]);

  const handleSearchChange = useCallback(
    (_event: SyntheticEvent, newValue: string | null) => {
      if (newValue && pods) {
        const found = pods.find((pod) => pod.name === newValue);
        if (found) onPodSelect(found);
      }
    },
    [pods, onPodSelect]
  );

  const filterPills: { id: PodFilter; label: string; dot?: string }[] = [
    { id: "all", label: `All ${counts.all}` },
    { id: "critical", label: `Critical ${counts.critical}`, dot: "#ef4444" },
    { id: "warning", label: `Warning ${counts.warning}`, dot: "#f59e0b" },
    { id: "healthy", label: `Healthy ${counts.healthy}`, dot: "#4ade80" },
  ];

  const selectedStatus = selectedPod
    ? podStatusByName?.get(selectedPod.name)
    : undefined;
  const selectedHealthy =
    selectedStatus && !isUnhealthyStatus(selectedStatus);

  return (
    <Box
      className="pods-fleet-health"
      data-testid="pods-searchablePodsHeatMap"
    >
      <Box className="pods-fleet-header">
        <Box className="pods-fleet-filters">
          <span className="pods-fleet-title">
            Fleet Health · {pods?.length ?? 0} Pods
          </span>
          {filterPills.map((pill) => (
            <button
              key={pill.id}
              type="button"
              data-testid={`pods-filter-${pill.id}`}
              className={`pods-fleet-pill${
                podFilter === pill.id ? " pods-fleet-pill-active" : ""
              }`}
              onClick={() => setPodFilter(pill.id)}
            >
              {pill.dot && (
                <span
                  className="pods-fleet-pill-dot"
                  style={{ backgroundColor: pill.dot }}
                />
              )}
              {pill.label}
            </button>
          ))}
        </Box>
        <Box data-testid="searchable-pods" className="pods-fleet-search">
          {pods && selectedPod && (
            <Autocomplete
              options={pods.map((pod) => pod.name)}
              getOptionLabel={(option: string) => option}
              disablePortal
              disableClearable
              id="pod-select"
              ListboxProps={{ sx: { fontSize: "1.4rem" } }}
              sx={{
                width: "100%",
                minWidth: 220,
                "& .MuiOutlinedInput-root": {
                  borderRadius: "0.8rem",
                  height: "3.6rem",
                  fontSize: "1.2rem",
                  backgroundColor: "#fff",
                },
              }}
              autoHighlight
              onChange={handleSearchChange}
              value={selectedPod?.name}
              renderInput={(params) => (
                <TextField
                  {...params}
                  variant="outlined"
                  placeholder="Search pods..."
                  InputProps={{
                    ...params.InputProps,
                    startAdornment: (
                      <>
                        <SearchIcon
                          sx={{
                            fontSize: "1.6rem",
                            color: "#94a3b8",
                            ml: 0.5,
                            mr: 0.5,
                          }}
                        />
                        {params.InputProps.startAdornment}
                      </>
                    ),
                  }}
                  inputProps={{
                    ...params.inputProps,
                    autoComplete: "new-password",
                    style: { fontSize: "1.2rem" },
                  }}
                />
              )}
            />
          )}
        </Box>
      </Box>

      <Box className="pods-chip-grid" data-testid="pods-chip-grid">
        {filtered.map((podHealth, idx) => {
          const active = selectedPod?.name === podHealth.name;
          const colors = CHIP_COLORS[podHealth.severity];
          const displayIdx = pods.findIndex((p) => p.name === podHealth.name);
          const labelIdx = displayIdx >= 0 ? displayIdx : idx;
          return (
            <Tooltip
              key={podHealth.name}
              title={<ChipTooltip podHealth={podHealth} />}
              arrow
              placement="top"
              componentsProps={{
                tooltip: {
                  sx: {
                    bgcolor: "#0f172a",
                    fontSize: "1.1rem",
                    maxWidth: 360,
                    p: 1.5,
                  },
                },
              }}
            >
              <button
                type="button"
                data-testid={`pod-chip_${podHealth.name}`}
                className={`pod-chip${active ? " pod-chip-active" : ""}`}
                style={{
                  backgroundColor: colors.bg,
                  color: colors.fg,
                }}
                onClick={() => onPodSelect(podHealth.pod)}
                title={`${podHealth.name}`}
              >
                <span className="pod-chip-label">{labelIdx}</span>
                {(podHealth.maxCPUPerc >= 76 ||
                  podHealth.maxMemPerc >= 86 ||
                  isUnhealthyStatus(podStatusByName?.get(podHealth.name))) && (
                  <span className="pod-chip-restart-dot" />
                )}
              </button>
            </Tooltip>
          );
        })}
      </Box>

      {selectedPod && (
        <Box className="pods-fleet-selected" data-testid="pods-fleet-selected">
          <span className="pods-fleet-selected-label">Selected:</span>
          <span className="pods-fleet-selected-name">{selectedPod.name}</span>
          <span
            className={`pods-fleet-selected-status${
              selectedHealthy
                ? " pods-fleet-selected-status-ok"
                : " pods-fleet-selected-status-bad"
            }`}
          >
            <span
              className={`pods-fleet-status-dot${
                selectedHealthy
                  ? " pods-fleet-status-dot-ok"
                  : " pods-fleet-status-dot-bad"
              }`}
            />
            {selectedStatus || "Running"}
          </span>
        </Box>
      )}
    </Box>
  );
}
