// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-nocheck
import {
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import Box from "@mui/material/Box";
import Paper from "@mui/material/Paper";
import CircularProgress from "@mui/material/CircularProgress";
import { Containers } from "./partials/Containers";
import { PodDetail } from "./partials/PodDetails";
import { PodsFleetHealth } from "./partials/PodsFleetHealth";
import { ContainerInfo } from "./partials/PodDetails/partials/ContainerInfo";
import { usePodsViewFetch } from "../../../../../../../../../utils/fetcherHooks/podsViewFetch";
import { notifyError } from "../../../../../../../../../utils/error";
import { AppContext, AppContextProps } from "../../../../../../../../../App";
import { getBaseHref } from "../../../../../../../../../utils";
import {
  ContainerInfoProps,
  Pod,
  PodSpecificInfoProps,
  PodsProps,
} from "../../../../../../../../../types/declarations/pods";
import {
  VertexDetailsContext,
  VertexDetailsContextProps,
} from "../../../../../../../../common/SlidingSidebar/partials/VertexDetails";

import "./style.css";

const METRICS_TAB_INDEX = 1;

export function Pods(props: PodsProps) {
  const { host } = useContext<AppContextProps>(AppContext);
  const { setPodsViewTab } =
    useContext<VertexDetailsContextProps>(VertexDetailsContext);
  const { namespaceId, pipelineId, vertexId, type } = props;

  if (!namespaceId || !pipelineId || !vertexId) {
    return (
      <Box data-testid={"pods-error-missing"} sx={{ mx: 2, my: 2 }}>
        {`Missing namespace, pipeline or vertex information`}
      </Box>
    );
  }

  const [selectedPod, setSelectedPod] = useState<Pod | undefined>(undefined);
  const [selectedContainer, setSelectedContainer] = useState<
    string | undefined
  >(undefined);

  const { pods, podsDetails, podsErr, podsDetailsErr, loading } =
    usePodsViewFetch(
      namespaceId,
      pipelineId,
      vertexId,
      selectedPod,
      type,
      setSelectedPod,
      setSelectedContainer
    );

  const [containerInfo, setContainerInfo] = useState<
    ContainerInfoProps | undefined
  >(undefined);
  const [podSpecificInfo, setPodSpecificInfo] = useState<
    PodSpecificInfoProps | undefined
  >(undefined);
  const [requestKey, setRequestKey] = useState(`${Date.now()}`);
  const [podsInfoList, setPodsInfoList] = useState<any[] | undefined>(
    undefined
  );

  const getContainerInfo = useCallback((podsData, podName, containerName) => {
    const selectedPod = podsData?.find((pod) => pod?.name === podName);
    if (selectedPod) {
      return selectedPod?.containerDetailsMap[containerName];
    } else {
      return null;
    }
  }, []);

  const getPodSpecificInfo = useCallback((podsData, podName) => {
    const podSpecificInfo: PodSpecificInfoProps = {};
    const selectedPod = podsData?.find((pod) => pod?.name === podName);
    if (selectedPod) {
      podSpecificInfo.name = selectedPod?.name;
      podSpecificInfo.reason = selectedPod?.reason;
      podSpecificInfo.status = selectedPod?.status;
      podSpecificInfo.message = selectedPod?.message;
      podSpecificInfo.totalCPU = selectedPod?.totalCPU;
      podSpecificInfo.totalMemory = selectedPod?.totalMemory;
      let restartCount = 0;
      for (const container in selectedPod?.containerDetailsMap) {
        restartCount +=
          selectedPod?.containerDetailsMap?.[container].restartCount;
      }
      podSpecificInfo.restartCount = restartCount;
    }
    return podSpecificInfo;
  }, []);

  useEffect(() => {
    const fetchPodInfo = async () => {
      try {
        const response = await fetch(
          `${host}${getBaseHref()}/api/v1/namespaces/${namespaceId}${
            type === "monoVertex"
              ? `/mono-vertices`
              : `/pipelines/${pipelineId}/vertices`
          }/${vertexId}/pods-info?refreshKey=${requestKey}`
        );
        if (!response.ok) {
          throw new Error("Failed to fetch pod details");
        }
        const data = await response.json();
        setPodsInfoList(data?.data);
        const containerInfo = getContainerInfo(
          data?.data,
          selectedPod?.name,
          selectedContainer
        );
        const podSpecificInfo = getPodSpecificInfo(
          data?.data,
          selectedPod?.name
        );
        setContainerInfo(containerInfo);
        setPodSpecificInfo(podSpecificInfo);
      } catch (error) {
        setContainerInfo({ error: "Failed to fetch pod details" });
      }
    };
    fetchPodInfo();
  }, [
    namespaceId,
    host,
    getBaseHref,
    type,
    pipelineId,
    vertexId,
    getContainerInfo,
    getPodSpecificInfo,
    requestKey,
    selectedPod,
    selectedContainer,
    setPodSpecificInfo,
    setContainerInfo,
  ]);

  useEffect(() => {
    // Refresh pod details every 30 sec
    const interval = setInterval(() => {
      setRequestKey(`${Date.now()}`);
    }, 30000);
    return () => {
      clearInterval(interval);
    };
  }, []);

  // This useEffect notifies about the errors while querying for the pods of the vertex
  useEffect(() => {
    if (podsErr) notifyError(podsErr);
  }, [podsErr]);

  // This useEffect notifies about the errors while querying for the pods details of the vertex
  useEffect(() => {
    if (podsDetailsErr) notifyError(podsDetailsErr);
  }, [podsDetailsErr]);

  const handlePodSelect = useCallback((pod: Pod) => {
    setSelectedPod(pod);
    setSelectedContainer(pod?.containers?.[0]);
  }, []);

  const handleContainerClick = useCallback((containerName: string) => {
    setSelectedContainer(containerName);
  }, []);

  const handleViewMetrics = useCallback(() => {
    setPodsViewTab(METRICS_TAB_INDEX);
  }, [setPodsViewTab]);

  const podStatusByName = useMemo(() => {
    const map = new Map<string, string>();
    podsInfoList?.forEach((p) => {
      if (p?.name) map.set(p.name, p.status || "");
    });
    if (podSpecificInfo?.name && podSpecificInfo?.status) {
      map.set(podSpecificInfo.name, podSpecificInfo.status);
    }
    return map;
  }, [podsInfoList, podSpecificInfo]);

  const selectedPodDetails = useMemo(
    () => podsDetails?.get(selectedPod?.name),
    [podsDetails, selectedPod]
  );

  if (loading) {
    return (
      <Box data-testid={"pods-loading"} sx={{ my: 2 }}>
        Loading pods view...
        <CircularProgress size={16} sx={{ mx: 2 }} />
      </Box>
    );
  }

  if (podsErr) {
    return (
      <Box
        data-testid={"pods-error"}
        sx={{ mx: 2, my: 2 }}
      >{`Failed to get pods details`}</Box>
    );
  }

  if (!pods?.length) {
    return (
      <Box
        data-testid={"pods-empty"}
        sx={{ mx: 2, my: 2 }}
      >{`No pods found for this vertex`}</Box>
    );
  }

  return (
    <Paper
      square
      elevation={0}
      className="pods-view-root"
      sx={{
        flex: 1,
        minHeight: 0,
        display: "flex",
        flexDirection: "column",
        backgroundColor: "#f3f4f6",
      }}
    >
      <Box className="pods-view-scroll">
        <PodsFleetHealth
          pods={pods}
          podsDetailsMap={podsDetails}
          selectedPod={selectedPod}
          onPodSelect={handlePodSelect}
          podStatusByName={podStatusByName}
        />

        {!selectedPod ? (
          <Box className="pods-view-empty" data-testid="pods-select-empty">
            <Box className="pods-view-empty-icon">◇</Box>
            <Box className="pods-view-empty-title">Select a pod</Box>
            <Box className="pods-view-empty-sub">
              Click a chip above to inspect logs and metrics
            </Box>
          </Box>
        ) : (
          <Box className="pods-view-body">
            <Box className="pods-view-main">
              <Box className="pods-view-main-card">
                <Box
                  className="pods-view-container-bar"
                  data-testid="pods-containers"
                >
                  <span className="pods-view-container-label">Container</span>
                  <Containers
                    pod={selectedPod}
                    containerName={selectedContainer}
                    handleContainerClick={handleContainerClick}
                  />
                </Box>
                <Box
                  data-testid="pods-poddetails"
                  className="pods-view-details"
                >
                  <PodDetail
                    namespaceId={namespaceId}
                    pipelineId={pipelineId}
                    type={type}
                    containerName={selectedContainer}
                    pod={selectedPod}
                    vertexId={vertexId}
                  />
                </Box>
              </Box>
            </Box>

            <Box className="pods-view-sidebar">
              <ContainerInfo
                namespaceId={namespaceId}
                pipelineId={pipelineId}
                vertexId={vertexId}
                type={type}
                pod={selectedPod}
                podDetails={selectedPodDetails}
                containerName={selectedContainer}
                containerInfo={containerInfo}
                podSpecificInfo={podSpecificInfo}
                onViewMetrics={handleViewMetrics}
              />
            </Box>
          </Box>
        )}
      </Box>
    </Paper>
  );
}
