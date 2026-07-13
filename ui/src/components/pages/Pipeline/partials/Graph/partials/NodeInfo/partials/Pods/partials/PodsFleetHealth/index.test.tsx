import { PodsFleetHealth } from "./index";
import { fireEvent, render, screen } from "@testing-library/react";
import {
  Pod,
  PodContainerSpec,
  PodDetail,
} from "../../../../../../../../../../../types/declarations/pods";

import "@testing-library/jest-dom";

const podContainerSpec: PodContainerSpec = {
  name: "numa",
  cpuParsed: 10,
  memoryParsed: 20,
};
const containerSpecMap = new Map<string, PodContainerSpec>([
  ["numa", podContainerSpec],
  ["udf", podContainerSpec],
]);

const pod = {
  name: "simple-pipeline-infer-0-xah5w",
  containers: ["numa", "udf"],
  containerSpecMap: containerSpecMap,
};
const podDetail = {
  name: "simple-pipeline-infer-0-xah5w",
  containerMap: new Map<string, PodContainerSpec>([
    ["numa", { name: "numa", cpu: "5m", cpuParsed: 5, memory: "10Mi", memoryParsed: 10 }],
  ]),
};

const pods: Pod[] = [pod];

const podDetailMap = new Map<string, PodDetail>([
  ["simple-pipeline-infer-0-xah5w", podDetail],
]);

const onPodSelect = jest.fn();

describe("PodsFleetHealth", () => {
  it("loads chip grid and selects a pod", async () => {
    render(
      <PodsFleetHealth
        pods={pods}
        selectedPod={pod}
        podsDetailsMap={podDetailMap}
        onPodSelect={onPodSelect}
        podStatusByName={new Map([["simple-pipeline-infer-0-xah5w", "Running"]])}
      />
    );
    expect(screen.getByText(/Fleet Health/i)).toBeVisible();
    expect(
      screen.getByTestId("pod-chip_simple-pipeline-infer-0-xah5w")
    ).toBeVisible();
    expect(screen.getByTestId("pods-filter-all")).toBeVisible();
    fireEvent.click(
      screen.getByTestId("pod-chip_simple-pipeline-infer-0-xah5w")
    );
    expect(onPodSelect).toHaveBeenCalledWith(pod);
  });
});
