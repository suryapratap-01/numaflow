import { getBaseHref } from "../../utils";
import {
  Capabilities,
  PodViewTarget,
  Problem,
  VertexStatus,
  VertexSummary,
} from "./types";

export class V2APIError extends Error {
  readonly status: number;
  readonly problem?: Problem;

  constructor(status: number, message: string, problem?: Problem) {
    super(message);
    this.name = "V2APIError";
    this.status = status;
    this.problem = problem;
  }
}

export class V2Client {
  constructor(private readonly host = "") {}

  getCapabilities(signal?: AbortSignal): Promise<Capabilities> {
    return this.get("/capabilities", signal);
  }

  getSummary(
    target: PodViewTarget,
    signal?: AbortSignal
  ): Promise<VertexSummary> {
    return this.get(`${targetPath(target)}/summary`, signal);
  }

  getStatus(
    target: PodViewTarget,
    signal?: AbortSignal
  ): Promise<VertexStatus> {
    return this.get(`${targetPath(target)}/status`, signal);
  }

  private async get<T>(path: string, signal?: AbortSignal): Promise<T> {
    const response = await fetch(`${this.host}${getBaseHref()}/api/v2${path}`, {
      credentials: "same-origin",
      headers: { Accept: "application/json, application/problem+json" },
      signal,
    });
    if (response.ok) {
      return response.json() as Promise<T>;
    }

    let problem: Problem | undefined;
    try {
      problem = (await response.json()) as Problem;
    } catch {
      // The status-based fallback remains useful for proxies with non-JSON errors.
    }
    throw new V2APIError(
      response.status,
      problem?.detail || `API v2 request failed with status ${response.status}`,
      problem
    );
  }
}

export function targetPath(target: PodViewTarget): string {
  const namespace = encodeURIComponent(target.namespace);
  if (target.kind === "monoVertex") {
    return `/namespaces/${namespace}/mono-vertices/${encodeURIComponent(
      target.monoVertex
    )}`;
  }
  return `/namespaces/${namespace}/pipelines/${encodeURIComponent(
    target.pipeline
  )}/vertices/${encodeURIComponent(target.vertex)}`;
}
