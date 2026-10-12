import { useContext, useEffect, useMemo, useState } from "react";
import { AppContext } from "../../../../../../../App";
import { AppContextProps } from "../../../../../../../types/declarations/app";
import { getBaseHref } from "../../../../../../../utils";
import { useMetricsFetch } from "../../../../../../../utils/fetchWrappers/metricsFetch";
import {
  DataHealth,
  MONO_VERTEX,
  MonoVertexScaleStatus,
  SignalQueries,
  SignalQuery,
  SignalSeries,
  WatermarkEdge,
  seriesValues,
  signalQueries,
} from "./goldenSignalsModel";

export const HEALTH_REFRESH_MS = 60_000;
const WINDOW_MS = 30 * 60_000;

interface VertexHealthDataProps {
  namespaceId: string;
  pipelineId: string;
  vertexId: string;
  type: string;
}

export interface VertexHealthData {
  queries: SignalQueries;
  series: SignalSeries;
  health?: DataHealth;
  monoStatus?: MonoVertexScaleStatus;
  watermarkEdges?: WatermarkEdge[];
  metricsEnabled: boolean;
  now: number;
}

const NO_FILTERS = {};

/** useSeries returns `undefined` before the first response, `null` on a proxy error, else summed values. */
function useSeries(
  query: SignalQuery | undefined,
  range: { start: string; end: string },
  enabled: boolean
): number[] | null | undefined {
  const metricReq = useMemo(
    () =>
      query && enabled
        ? {
            metric_name: query.metric_name,
            pattern_name: query.pattern_name,
            dimension: query.dimension,
            quantile: query.quantile,
            duration: query.duration,
            start_time: range.start,
            end_time: range.end,
          }
        : undefined,
    [query, enabled, range]
  );
  const filters = query && enabled ? query.filters : NO_FILTERS;
  const { chartData, error } = useMetricsFetch({ metricReq, filters });
  const values = useMemo(
    () => (chartData === null ? undefined : seriesValues(chartData)),
    [chartData]
  );
  if (!metricReq) return undefined;
  return error ? null : values;
}

async function fetchData<T>(url: string, signal: AbortSignal): Promise<T | undefined> {
  const response = await fetch(url, { signal });
  if (!response.ok) return undefined;
  const body = await response.json();
  return body?.errMsg ? undefined : body?.data;
}

/** useVertexHealthData loads the strip's live inputs and refreshes them every minute. */
export function useVertexHealthData({
  namespaceId,
  pipelineId,
  vertexId,
  type,
}: VertexHealthDataProps): VertexHealthData {
  const { host, disableMetricsCharts } = useContext<AppContextProps>(AppContext);
  const metricsEnabled = !disableMetricsCharts;
  const isMono = type === MONO_VERTEX;
  const [now, setNow] = useState(() => Date.now());
  const [health, setHealth] = useState<DataHealth>();
  const [monoStatus, setMonoStatus] = useState<MonoVertexScaleStatus>();
  const [watermarkEdges, setWatermarkEdges] = useState<WatermarkEdge[]>();
  const [fetchedAt, setFetchedAt] = useState<number>();

  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), HEALTH_REFRESH_MS);
    return () => clearInterval(timer);
  }, []);

  const queries = useMemo(
    () => signalQueries({ namespaceId, pipelineId, vertexId, type }),
    [namespaceId, pipelineId, vertexId, type]
  );
  const range = useMemo(
    () => ({
      start: new Date(now - WINDOW_MS).toISOString(),
      end: new Date(now).toISOString(),
    }),
    [now]
  );

  const p99 = useSeries(queries.p99, range, metricsEnabled);
  const stageRead = useSeries(queries.stageRead, range, metricsEnabled);
  const stageTransformer = useSeries(queries.stageTransformer, range, metricsEnabled);
  const stageUdf = useSeries(queries.stageUdf, range, metricsEnabled);
  const stageSink = useSeries(queries.stageSink, range, metricsEnabled);
  const stageWrite = useSeries(queries.stageWrite, range, metricsEnabled);
  const stageAck = useSeries(queries.stageAck, range, metricsEnabled);
  const readRate = useSeries(queries.readRate, range, metricsEnabled);
  const outRate = useSeries(queries.outRate, range, metricsEnabled);
  const pending = useSeries(queries.pending, range, metricsEnabled);
  const drops = useSeries(queries.drops, range, metricsEnabled);
  const nacks = useSeries(queries.nacks, range, metricsEnabled);
  const fallback = useSeries(queries.fallback, range, metricsEnabled);
  const critical = useSeries(queries.critical, range, metricsEnabled);
  const series = useMemo<SignalSeries>(
    () => ({
      p99,
      stageRead,
      stageTransformer,
      stageUdf,
      stageSink,
      stageWrite,
      stageAck,
      readRate,
      outRate,
      pending,
      drops,
      nacks,
      fallback,
      critical,
    }),
    [
      p99,
      stageRead,
      stageTransformer,
      stageUdf,
      stageSink,
      stageWrite,
      stageAck,
      readRate,
      outRate,
      pending,
      drops,
      nacks,
      fallback,
      critical,
    ]
  );

  useEffect(() => {
    const controller = new AbortController();
    const base = `${host}${getBaseHref()}/api/v1/namespaces/${namespaceId}`;
    const load = async () => {
      const [healthData, vertexData, watermarks] = await Promise.allSettled([
        fetchData<DataHealth>(
          isMono ? `${base}/mono-vertices/${vertexId}/health` : `${base}/pipelines/${pipelineId}/health`,
          controller.signal
        ),
        isMono
          ? fetchData<any>(`${base}/mono-vertices/${vertexId}`, controller.signal)
          : Promise.resolve(undefined),
        isMono
          ? Promise.resolve(undefined)
          : fetchData<WatermarkEdge[]>(`${base}/pipelines/${pipelineId}/watermarks`, controller.signal),
      ]);
      if (controller.signal.aborted) return;
      setHealth(healthData.status === "fulfilled" ? healthData.value : undefined);
      setMonoStatus(
        vertexData.status === "fulfilled" ? vertexData.value?.monoVertex?.status : undefined
      );
      setWatermarkEdges(watermarks.status === "fulfilled" ? watermarks.value : undefined);
      setFetchedAt(Date.now());
    };
    void load();
    return () => controller.abort();
  }, [host, isMono, namespaceId, pipelineId, vertexId, now]);

  // Watermark lag must be measured against the response time, not the earlier refresh tick.
  return {
    queries,
    series,
    health,
    monoStatus,
    watermarkEdges,
    metricsEnabled,
    now: fetchedAt ?? now,
  };
}
