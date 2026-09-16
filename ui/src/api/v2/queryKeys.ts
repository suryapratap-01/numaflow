import { PodViewTarget } from "./types";

const targetKey = (target: PodViewTarget) =>
  target.kind === "monoVertex"
    ? [target.kind, target.namespace, target.monoVertex]
    : [target.kind, target.namespace, target.pipeline, target.vertex];

export const v2QueryKeys = {
  capabilities: ["v2", "capabilities"] as const,
  summary: (target: PodViewTarget) =>
    ["v2", "summary", ...targetKey(target)] as const,
  status: (target: PodViewTarget) =>
    ["v2", "status", ...targetKey(target)] as const,
};
