import { components } from "./generated";

export type Capabilities = components["schemas"]["Capabilities"];
export type VertexSummary = components["schemas"]["VertexSummary"];
export type VertexStatus = components["schemas"]["VertexStatus"];
export type Problem = components["schemas"]["Problem"];

export type PodViewTarget =
  | {
      kind: "pipelineVertex";
      namespace: string;
      pipeline: string;
      vertex: string;
    }
  | {
      kind: "monoVertex";
      namespace: string;
      monoVertex: string;
    };
