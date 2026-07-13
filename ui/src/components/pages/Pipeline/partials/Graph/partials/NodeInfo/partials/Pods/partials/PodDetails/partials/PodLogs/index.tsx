// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-nocheck
import {
  ChangeEvent,
  useCallback,
  useContext,
  useEffect,
  useState,
} from "react";
import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import Select, { SelectChangeEvent } from "@mui/material/Select";
import MenuItem from "@mui/material/MenuItem";
import IconButton from "@mui/material/IconButton";
import ClearIcon from "@mui/icons-material/Clear";
import PauseIcon from "@mui/icons-material/Pause";
import PlayArrowIcon from "@mui/icons-material/PlayArrow";
import ArrowUpward from "@mui/icons-material/ArrowUpward";
import ArrowDownward from "@mui/icons-material/ArrowDownward";
import LightMode from "@mui/icons-material/LightMode";
import DarkMode from "@mui/icons-material/DarkMode";
import Download from "@mui/icons-material/Download";
import WrapTextIcon from "@mui/icons-material/WrapText";
import TerminalIcon from "@mui/icons-material/Terminal";
import { ClockIcon } from "@mui/x-date-pickers";
import Tooltip from "@mui/material/Tooltip";
import FormControlLabel from "@mui/material/FormControlLabel";
import Checkbox from "@mui/material/Checkbox";
import Highlighter from "react-highlight-words";
import "@stardazed/streams-polyfill";
import { getBaseHref } from "../../../../../../../../../../../../../utils";
import { PodLogsProps } from "../../../../../../../../../../../../../types/declarations/pods";
import { AppContextProps } from "../../../../../../../../../../../../../types/declarations/app";
import { AppContext } from "../../../../../../../../../../../../../App";

import "./style.css";

const MAX_LOGS = 1000;
const EMPTY_SEARCH_MSG = "No logs match";

type ColorMode = "dark" | "light";
type LogsOrder = "asc" | "desc";

const iconBtnSx = {
  width: "2.6rem",
  height: "2.6rem",
  borderRadius: "0.6rem",
  border: "1px solid #e2e8f0",
  background: "#fff",
  color: "#64748b",
  padding: 0,
  flexShrink: 0,
  "&:hover": {
    background: "#f8fafc",
    color: "#334155",
  },
};

const iconBtnOnSx = {
  ...iconBtnSx,
  borderColor: "#7dd3fc",
  background: "#f0f9ff",
  color: "#0284c7",
  "&:hover": {
    background: "#f0f9ff",
    color: "#0284c7",
  },
};

const searchClearSx = {
  position: "absolute" as const,
  right: "0.2rem",
  top: "50%",
  transform: "translateY(-50%)",
  color: "#94a3b8",
};

const checkboxLabelSx = {
  margin: 0,
  flexShrink: 0,
  whiteSpace: "nowrap" as const,
};

const levelSelectSx = {
  minWidth: "10rem",
  flexShrink: 0,
  height: "2.8rem",
  fontSize: "1.2rem",
  borderRadius: "0.6rem",
  "& .MuiOutlinedInput-notchedOutline": {
    borderColor: "#e2e8f0",
  },
};

const parsePodLogs = (
  value: string,
  enableTimestamp: boolean,
  levelFilter: string,
  type: string,
  isErrorMessage: boolean
): string[] => {
  const rawLogs = value.split("\n").filter((s) => s.trim().length);
  return rawLogs.map((raw: string) => {
    // 30 characters for RFC 3339 timestamp
    const timestamp =
      raw.length >= 31 && !isErrorMessage ? raw.substring(0, 30) : "";
    const logWithoutTimestamp =
      raw.length >= 31 && !isErrorMessage ? raw.substring(31) : raw;

    let msg = enableTimestamp ? `${timestamp} ` : "";

    if (type === "monoVertex") {
      if (
        levelFilter !== "all" &&
        !logWithoutTimestamp.includes(levelFilter.toUpperCase())
      )
        return "";

      return `${msg}${logWithoutTimestamp}`;
    } else {
      let obj;
      try {
        obj = JSON.parse(logWithoutTimestamp);
      } catch {
        obj = logWithoutTimestamp;
      }
      // println log, it is not an object
      if (obj === logWithoutTimestamp) {
        if (levelFilter !== "all" && !obj.toLowerCase().includes(levelFilter))
          return "";
      } else if (obj?.level) {
        // logger log
        msg += `${obj.level.toUpperCase()} `;
        if (levelFilter !== "all" && obj.level !== levelFilter) return "";
      }
      return `${msg}${logWithoutTimestamp}`;
    }
  });
};

const appendParsedLogs = (
  prev: string[],
  value: string,
  enableTimestamp: boolean,
  levelFilter: string,
  type: string
): string[] => {
  let chunk = value;
  let isErrorMessage = false;
  try {
    const jsonResponse = JSON.parse(chunk);
    if (jsonResponse?.errMsg) {
      chunk = jsonResponse.errMsg;
      isErrorMessage = true;
    }
  } catch {
    // not a JSON error payload
  }
  const latestLogs = parsePodLogs(
    chunk,
    enableTimestamp,
    levelFilter,
    type,
    isErrorMessage
  )?.filter((line) => line !== "");
  let updated = [...prev, ...latestLogs];
  if (updated.length > MAX_LOGS) {
    updated = updated.slice(updated.length - MAX_LOGS);
  }
  return updated;
};

const isAbortError = (err: unknown) =>
  err instanceof DOMException
    ? err.name === "AbortError"
    : (err as { name?: string })?.name === "AbortError";

const splitLogLine = (
  line: string
): { ts: string; level: string; msg: string } => {
  let rest = line;
  let ts = "";
  const tsMatch = rest.match(/^(\d{4}-\d{2}-\d{2}T\S+)\s+(.*)$/);
  if (tsMatch) {
    ts = tsMatch[1];
    rest = tsMatch[2];
  }
  const levelMatch = rest.match(
    /^(INFO|ERROR|WARN|WARNING|DEBUG)\s+(.*)$/i
  );
  if (levelMatch) {
    let level = levelMatch[1].toUpperCase();
    if (level === "WARNING") level = "WARN";
    return { ts, level, msg: levelMatch[2] };
  }
  return { ts, level: "", msg: rest };
};

const levelClass = (level: string, dark: boolean) => {
  const l = level.toUpperCase();
  if (l === "ERROR") return dark ? "pod-log-level-error-dark" : "pod-log-level-error-light";
  if (l === "WARN") return dark ? "pod-log-level-warn-dark" : "pod-log-level-warn-light";
  if (l === "INFO") return dark ? "pod-log-level-info-dark" : "pod-log-level-info-light";
  if (l === "DEBUG") return "pod-log-level-debug";
  return "pod-log-level-debug";
};

export function PodLogs({
  namespaceId,
  podName,
  containerName,
  type,
}: PodLogsProps) {
  const [logs, setLogs] = useState<string[]>([]);
  const [previousLogs, setPreviousLogs] = useState<string[]>([]);
  const [filteredLogs, setFilteredLogs] = useState<string[]>([]);
  const [search, setSearch] = useState<string>("");
  const [negateSearch, setNegateSearch] = useState<boolean>(false);
  const [wrapLines, setWrapLines] = useState<boolean>(true);
  const [paused, setPaused] = useState<boolean>(false);
  const [colorMode, setColorMode] = useState<ColorMode>("dark");
  const [logsOrder, setLogsOrder] = useState<LogsOrder>("desc");
  const [enableTimestamp, setEnableTimestamp] = useState<boolean>(true);
  const [levelFilter, setLevelFilter] = useState<string>("all");
  const [showPreviousLogs, setShowPreviousLogs] = useState(false);
  const { host } = useContext<AppContextProps>(AppContext);

  const shortPodName = podName?.split("-").slice(-3).join("-") || podName;
  const isDark = colorMode === "dark";

  useEffect(() => {
    // reset logs in memory on any log source change
    setLogs([]);
    setPreviousLogs([]);
    // and start logs again if paused
    setPaused(false);
  }, [namespaceId, podName, containerName]);

  useEffect(() => {
    if (paused || !namespaceId || !podName || !containerName) {
      return;
    }

    const abortController = new AbortController();
    let streamReader: ReadableStreamDefaultReader<string> | undefined;
    let cancelled = false;

    setLogs(["Loading logs..."]);

    const url = `${host}${getBaseHref()}/api/v1/namespaces/${namespaceId}/pods/${podName}/logs?container=${containerName}&follow=true&tailLines=${MAX_LOGS}`;

    (async () => {
      try {
        const response = await fetch(url, { signal: abortController.signal });
        if (!response?.body || cancelled) {
          return;
        }
        streamReader = response.body
          .pipeThrough(new TextDecoderStream())
          .getReader();
        while (!cancelled) {
          const { done, value } = await streamReader.read();
          if (done || cancelled) {
            break;
          }
          if (value) {
            setLogs((prev) =>
              appendParsedLogs(
                prev,
                value,
                enableTimestamp,
                levelFilter,
                type
              )
            );
          }
        }
      } catch (err) {
        if (!isAbortError(err)) {
          console.error(err);
        }
      }
    })();

    return () => {
      cancelled = true;
      abortController.abort();
      streamReader?.cancel().catch(() => undefined);
    };
  }, [
    namespaceId,
    podName,
    containerName,
    paused,
    host,
    enableTimestamp,
    levelFilter,
    type,
  ]);

  useEffect(() => {
    if (!showPreviousLogs) {
      setPreviousLogs([]);
      return;
    }
    if (!namespaceId || !podName || !containerName) {
      return;
    }

    const abortController = new AbortController();
    let streamReader: ReadableStreamDefaultReader<string> | undefined;
    let cancelled = false;

    setPreviousLogs([]);

    const url = `${host}${getBaseHref()}/api/v1/namespaces/${namespaceId}/pods/${podName}/logs?container=${containerName}&follow=false&tailLines=${MAX_LOGS}&previous=true`;

    (async () => {
      try {
        const response = await fetch(url, { signal: abortController.signal });
        if (!response?.body || cancelled) {
          return;
        }
        streamReader = response.body
          .pipeThrough(new TextDecoderStream())
          .getReader();
        while (!cancelled) {
          const { done, value } = await streamReader.read();
          if (done || cancelled) {
            break;
          }
          if (value) {
            setPreviousLogs((prev) =>
              appendParsedLogs(
                prev,
                value,
                enableTimestamp,
                levelFilter,
                type
              )
            );
          }
        }
      } catch (err) {
        if (!isAbortError(err)) {
          console.error(err);
        }
      }
    })();

    return () => {
      cancelled = true;
      abortController.abort();
      streamReader?.cancel().catch(() => undefined);
    };
  }, [
    showPreviousLogs,
    namespaceId,
    podName,
    containerName,
    host,
    enableTimestamp,
    levelFilter,
    type,
  ]);

  useEffect(() => {
    if (!search) {
      if (showPreviousLogs) {
        setFilteredLogs(previousLogs);
      } else {
        setFilteredLogs(logs);
      }
      return;
    }
    const searchLowerCase = search.toLowerCase();
    const filtered = (showPreviousLogs ? previousLogs : logs)?.filter((log) =>
      negateSearch
        ? !log.toLowerCase().includes(searchLowerCase)
        : log.toLowerCase().includes(searchLowerCase)
    );

    if (!filtered.length) {
      filtered.push(EMPTY_SEARCH_MSG);
    }
    setFilteredLogs(filtered);
  }, [showPreviousLogs, previousLogs, logs, search, negateSearch]);

  const handleSearchChange = useCallback(
    (event: ChangeEvent<HTMLInputElement>) => {
      setSearch(event.target.value);
    },
    []
  );

  const handleSearchClear = useCallback(() => {
    setSearch("");
  }, []);

  const handleNegateSearchChange = useCallback(
    (event: ChangeEvent<HTMLInputElement>) => {
      setNegateSearch(event.target.checked);
    },
    []
  );

  const handleWrapLines = useCallback(() => {
    setWrapLines((prev) => !prev);
  }, []);

  const handlePause = useCallback(() => {
    setPaused((prev) => !prev);
  }, []);

  const handleColorMode = useCallback(() => {
    setColorMode(colorMode === "light" ? "dark" : "light");
  }, [colorMode]);

  const handleOrder = useCallback(() => {
    setLogsOrder(logsOrder === "asc" ? "desc" : "asc");
  }, [logsOrder]);

  const handleLogsDownload = useCallback(() => {
    const blob = new Blob([logs.join("\n")], {
      type: "text/plain;charset=utf-8",
    });

    const url = URL.createObjectURL(blob);

    const a = document.createElement("a");
    a.href = url;
    a.download = `${podName}-${containerName}-logs.txt`;

    document.body.appendChild(a);

    a.click();

    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }, [logs, podName, containerName]);

  const handleTimestamps = useCallback(() => {
    setEnableTimestamp((prev) => !prev);
  }, []);

  const handleLevelChange = useCallback((e: SelectChangeEvent) => {
    setLevelFilter(e.target.value);
  }, []);

  const displayLogs =
    logsOrder === "asc" ? filteredLogs : filteredLogs.slice().reverse();
  const isEmptySearch =
    filteredLogs.length === 1 && filteredLogs[0] === EMPTY_SEARCH_MSG;

  const renderLogLine = (l: string, idx: number) => {
    if (l === EMPTY_SEARCH_MSG) return null;
    const { ts, level, msg } = splitLogLine(l);
    return (
      <div
        key={`${idx}-${podName}-logs`}
        className={`pod-log-row${isDark ? " pod-log-row-dark" : " pod-log-row-light"}`}
      >
        {enableTimestamp && ts && (
          <span className={`pod-log-ts${isDark ? " pod-log-ts-dark" : " pod-log-ts-light"}`}>
            {ts}
          </span>
        )}
        {level && (
          <span className={`pod-log-level ${levelClass(level, isDark)}`}>
            {level}
          </span>
        )}
        <span
          className={`pod-log-msg${isDark ? " pod-log-msg-dark" : " pod-log-msg-light"}${
            wrapLines ? " pod-log-msg-wrap" : " pod-log-msg-nowrap"
          }`}
        >
          <Highlighter
            searchWords={[search]}
            autoEscape={true}
            textToHighlight={msg || l}
            highlightClassName="pod-log-highlight"
          />
        </span>
      </div>
    );
  };

  return (
    <Box className="pod-logs-root">
      <Box className="PodLogs-toolbar">
        <Box className="pod-logs-toolbar-title-row">
          <span className="pod-logs-title">Container Logs</span>
          <span className="pod-logs-badge">
            {shortPodName}/{containerName}
          </span>
        </Box>
        <Box className="pod-logs-toolbar-controls">
          <Box className="pod-logs-search-wrap">
            <input
              className="pod-logs-search-input"
              type="text"
              placeholder="Search logs"
              value={search}
              onChange={handleSearchChange}
              data-testid="pod-logs-search-input"
            />
            {search && (
              <IconButton
                data-testid="clear-button"
                onClick={handleSearchClear}
                size="small"
                sx={searchClearSx}
              >
                <ClearIcon sx={{ fontSize: "1.4rem" }} />
              </IconButton>
            )}
          </Box>
          <FormControlLabel
            className="pod-logs-negate"
            sx={checkboxLabelSx}
            control={
              <Checkbox
                data-testid="negate-search"
                checked={negateSearch}
                onChange={handleNegateSearchChange}
                sx={{ "& .MuiSvgIcon-root": { fontSize: 18 }, p: 0.5 }}
              />
            }
            label={
              <Typography sx={{ fontSize: "1.2rem", color: "#475569" }}>
                Negate search
              </Typography>
            }
          />
          <span className="pod-logs-divider" />
          <Tooltip title={wrapLines ? "Unwrap Lines" : "Wrap Lines"} arrow>
            <IconButton
              data-testid="wrap-lines-button"
              onClick={handleWrapLines}
              sx={wrapLines ? iconBtnOnSx : iconBtnSx}
            >
              <WrapTextIcon sx={{ fontSize: "1.4rem" }} />
            </IconButton>
          </Tooltip>
          <Tooltip title={paused ? "Resume stream" : "Pause stream"} arrow>
            <IconButton
              data-testid="pause-button"
              onClick={handlePause}
              sx={paused ? iconBtnOnSx : iconBtnSx}
            >
              {paused ? (
                <PlayArrowIcon sx={{ fontSize: "1.4rem" }} />
              ) : (
                <PauseIcon sx={{ fontSize: "1.4rem" }} />
              )}
            </IconButton>
          </Tooltip>
          <Tooltip
            title={isDark ? "Light mode" : "Dark mode"}
            arrow
          >
            <IconButton
              data-testid="color-mode-button"
              onClick={handleColorMode}
              sx={isDark ? iconBtnOnSx : iconBtnSx}
            >
              {isDark ? (
                <LightMode sx={{ fontSize: "1.4rem" }} />
              ) : (
                <DarkMode sx={{ fontSize: "1.4rem" }} />
              )}
            </IconButton>
          </Tooltip>
          <Tooltip
            title={logsOrder === "asc" ? "Descending order" : "Ascending order"}
            arrow
          >
            <IconButton
              data-testid="order-button"
              onClick={handleOrder}
              sx={iconBtnSx}
            >
              {logsOrder === "asc" ? (
                <ArrowDownward sx={{ fontSize: "1.4rem" }} />
              ) : (
                <ArrowUpward sx={{ fontSize: "1.4rem" }} />
              )}
            </IconButton>
          </Tooltip>
          <Tooltip title="Download logs" arrow>
            <IconButton
              data-testid="download-logs-button"
              onClick={handleLogsDownload}
              sx={iconBtnSx}
            >
              <Download sx={{ fontSize: "1.4rem" }} />
            </IconButton>
          </Tooltip>
          <Tooltip
            title={enableTimestamp ? "Hide timestamps" : "Show timestamps"}
            arrow
          >
            <IconButton
              data-testid="toggle-timestamps-button"
              onClick={handleTimestamps}
              disabled={paused}
              sx={enableTimestamp ? iconBtnOnSx : iconBtnSx}
            >
              <ClockIcon sx={{ fontSize: "1.4rem" }} />
            </IconButton>
          </Tooltip>
          <Select
            labelId="level-filter"
            id="level-filter"
            value={levelFilter}
            onChange={handleLevelChange}
            className="pod-logs-level-select"
            sx={levelSelectSx}
            disabled={paused}
            size="small"
          >
            <MenuItem sx={{ fontSize: "1.2rem" }} value={"all"}>
              All levels
            </MenuItem>
            <MenuItem sx={{ fontSize: "1.2rem" }} value={"info"}>
              Info
            </MenuItem>
            <MenuItem sx={{ fontSize: "1.2rem" }} value={"error"}>
              Error
            </MenuItem>
            <MenuItem sx={{ fontSize: "1.2rem" }} value={"warn"}>
              Warn
            </MenuItem>
            <MenuItem sx={{ fontSize: "1.2rem" }} value={"debug"}>
              Debug
            </MenuItem>
          </Select>
          <FormControlLabel
            className="pod-logs-terminated"
            sx={{ ...checkboxLabelSx, ml: "auto" }}
            control={
              <Checkbox
                data-testid="previous-logs"
                checked={showPreviousLogs}
                onChange={(event: ChangeEvent<HTMLInputElement>) =>
                  setShowPreviousLogs(event.target.checked)
                }
                sx={{ "& .MuiSvgIcon-root": { fontSize: 18 }, p: 0.5 }}
              />
            }
            label={
              <Typography sx={{ fontSize: "1.2rem", color: "#475569" }}>
                Show terminated
              </Typography>
            }
          />
        </Box>
      </Box>

      <Box
        className={`pod-logs-terminal${isDark ? " pod-logs-terminal-dark" : " pod-logs-terminal-light"}`}
        data-testid="pod-logs-terminal"
      >
        {isEmptySearch ? (
          <Box className="pod-logs-empty">
            <TerminalIcon sx={{ fontSize: "1.8rem", color: "#64748b", mb: 1 }} />
            <p className="pod-logs-empty-text">{EMPTY_SEARCH_MSG}</p>
          </Box>
        ) : (
          <Box className="pod-logs-lines">
            {displayLogs.map((l, idx) => renderLogLine(l, idx))}
            <Box
              className={`pod-logs-footer${
                isDark ? " pod-logs-footer-dark" : " pod-logs-footer-light"
              }`}
            >
              {paused ? (
                <>
                  <PauseIcon sx={{ fontSize: "1.1rem", color: "#64748b" }} />
                  <span>Stream paused</span>
                </>
              ) : (
                <>
                  <span className="pod-logs-stream-dot" />
                  <span>Streaming from {containerName}…</span>
                </>
              )}
            </Box>
          </Box>
        )}
      </Box>
    </Box>
  );
}
