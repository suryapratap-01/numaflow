import { useContext, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { AppContext } from "../../App";
import { AppContextProps } from "../../types/declarations/app";
import { V2Client } from "./client";
import { v2QueryKeys } from "./queryKeys";
import { PodViewTarget } from "./types";

function useV2Client(): V2Client {
  const { host } = useContext<AppContextProps>(AppContext);
  return useMemo(() => new V2Client(host), [host]);
}

export function useCapabilities() {
  const client = useV2Client();
  return useQuery({
    queryKey: v2QueryKeys.capabilities,
    queryFn: ({ signal }) => client.getCapabilities(signal),
    staleTime: 60_000,
  });
}

export function useVertexSummary(target: PodViewTarget) {
  const client = useV2Client();
  return useQuery({
    queryKey: v2QueryKeys.summary(target),
    queryFn: ({ signal }) => client.getSummary(target, signal),
    refetchInterval: 15_000,
  });
}

export function useVertexStatus(target: PodViewTarget) {
  const client = useV2Client();
  return useQuery({
    queryKey: v2QueryKeys.status(target),
    queryFn: ({ signal }) => client.getStatus(target, signal),
    refetchInterval: 15_000,
  });
}
