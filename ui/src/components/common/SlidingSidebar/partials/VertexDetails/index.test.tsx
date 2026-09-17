import React from "react";
import {
  render,
  screen,
  waitFor,
  fireEvent,
  act,
} from "@testing-library/react";
import { VertexDetails } from "./index";
import { BrowserRouter, MemoryRouter, useLocation } from "react-router-dom";
import { AppContext } from "../../../../../App";
import { PodViewV2QueryProvider } from "../../../../../api/v2/PodViewV2QueryProvider";
import { PodViewExperienceProvider } from "../../../../../contexts/PodViewExperienceContext";
import { PodViewBetaToggle } from "../../../PodViewBetaToggle";

import "@testing-library/jest-dom";

const mockBuffersComponent = jest.fn();
const mockMetricsComponent = jest.fn();

jest.mock("./partials/VertexUpdate", () => {
  const originalModule = jest.requireActual("./partials/VertexUpdate");
  // Mock any module exports here
  return {
    __esModule: true,
    ...originalModule,
    // Named export mocks
    VertexUpdate: ({ setModalOnClose }) => (
      <div>
        Mocked vertexupdate
        <button
          data-testid="set-update-modal-open"
          onClick={() => setModalOnClose({})}
        />
      </div>
    ),
  };
});
jest.mock("./partials/ProcessingRates", () => {
  const originalModule = jest.requireActual("./partials/ProcessingRates");
  // Mock any module exports here
  return {
    __esModule: true,
    ...originalModule,
    // Named export mocks
    ProcessingRates: () => <div>Mocked processingrates</div>,
  };
});
jest.mock("../K8sEvents", () => {
  const originalModule = jest.requireActual("../K8sEvents");
  // Mock any module exports here
  return {
    __esModule: true,
    ...originalModule,
    // Named export mocks
    K8sEvents: () => <div>Mocked k8sevents</div>,
  };
});
jest.mock("./partials/Buffers", () => {
  const originalModule = jest.requireActual("./partials/Buffers");
  // Mock any module exports here
  return {
    __esModule: true,
    ...originalModule,
    // Named export mocks
    Buffers: (props) => {
      mockBuffersComponent(props);
      return <div>Mocked buffers</div>;
    },
  };
});
jest.mock(
  "../../../../pages/Pipeline/partials/Graph/partials/NodeInfo/partials/Pods",
  () => {
    const originalModule = jest.requireActual(
      "../../../../pages/Pipeline/partials/Graph/partials/NodeInfo/partials/Pods"
    );
    // Mock any module exports here
    return {
      __esModule: true,
      ...originalModule,
      // Named export mocks
      Pods: () => <div>Mocked pods</div>,
    };
  }
);
jest.mock(
  "../../../../pages/Pipeline/partials/Graph/partials/NodeInfo/partials/Pods/partials/PodDetails/partials/Metrics",
  () => {
    const ReactModule = jest.requireActual("react");
    return {
      Metrics: (props) => {
        const { VertexDetailsContext } = jest.requireActual("./index");
        const context = ReactModule.useContext(VertexDetailsContext);
        mockMetricsComponent(props, context);
        return (
          <div>
            <div>Mocked metrics</div>
            <div data-testid="metrics-pod">
              {props.pod?.name || props.podName || "vertex-wide"}
            </div>
            <div data-testid="metrics-expanded">
              {context.expanded.has("test-panel").toString()}
            </div>
            <button
              data-testid="redirect-to-metrics"
              onClick={() =>
                context.openMetrics({
                  panelId: "test-panel",
                  pod: { name: "test-pod" },
                })
              }
            />
          </div>
        );
      },
    };
  }
);

const SearchProbe = () => {
  const location = useLocation();
  return <div data-testid="location-search">{location.search}</div>;
};

const TestProviders = ({ children }: { children: React.ReactNode }) => (
  <BrowserRouter>
    <PodViewExperienceProvider>
      <PodViewV2QueryProvider>{children}</PodViewV2QueryProvider>
    </PodViewExperienceProvider>
  </BrowserRouter>
);

describe("VertexDetails", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("SOURCE vertex", async () => {
    render(
      <VertexDetails
        namespaceId="test-namespace"
        pipelineId="test-pipeline"
        vertexId="test-vertex"
        vertexSpecs={{}}
        vertexMetrics={{}}
        buffers={[]}
        type="source"
        setModalOnClose={jest.fn()}
        refresh={jest.fn()}
      />,
      { wrapper: TestProviders }
    );

    await waitFor(() => {
      expect(screen.getByText("Input Vertex")).toBeInTheDocument();
      expect(screen.getByText("Mocked pods")).toBeInTheDocument();
    });
  });

  it("REDUCE vertex", async () => {
    render(
      <VertexDetails
        namespaceId="test-namespace"
        pipelineId="test-pipeline"
        vertexId="test-vertex"
        vertexSpecs={{ udf: { groupBy: {} } }}
        vertexMetrics={{}}
        buffers={[]}
        type="udf"
        setModalOnClose={jest.fn()}
        refresh={jest.fn()}
      />,
      { wrapper: TestProviders }
    );

    await waitFor(() => {
      expect(screen.getByText("Processor Vertex")).toBeInTheDocument();
      expect(screen.getByText("Mocked pods")).toBeInTheDocument();
    });
  });

  it("MAP vertex", async () => {
    render(
      <VertexDetails
        namespaceId="test-namespace"
        pipelineId="test-pipeline"
        vertexId="test-vertex"
        vertexSpecs={{}}
        vertexMetrics={{}}
        buffers={[]}
        type="udf"
        setModalOnClose={jest.fn()}
        refresh={jest.fn()}
      />,
      { wrapper: TestProviders }
    );

    await waitFor(() => {
      expect(screen.getByText("Processor Vertex")).toBeInTheDocument();
      expect(screen.getByText("Mocked pods")).toBeInTheDocument();
    });
  });

  it("SINK vertex", async () => {
    render(
      <VertexDetails
        namespaceId="test-namespace"
        pipelineId="test-pipeline"
        vertexId="test-vertex"
        vertexSpecs={{}}
        vertexMetrics={{}}
        buffers={[]}
        type="sink"
        setModalOnClose={jest.fn()}
        refresh={jest.fn()}
      />,
      { wrapper: TestProviders }
    );

    await waitFor(() => {
      expect(screen.getByText("Sink Vertex")).toBeInTheDocument();
      expect(screen.getByText("Mocked pods")).toBeInTheDocument();
    });
  });

  it("renders Metrics immediately after Pods View", async () => {
    render(
      <AppContext.Provider
        value={{ addError: jest.fn(), disableMetricsCharts: false } as any}
      >
        <BrowserRouter>
          <PodViewExperienceProvider>
            <PodViewV2QueryProvider>
              <VertexDetails
                namespaceId="test-namespace"
                pipelineId="test-pipeline"
                vertexId="test-vertex"
                vertexSpecs={{}}
                vertexMetrics={{}}
                buffers={[]}
                type="sink"
                setModalOnClose={jest.fn()}
                refresh={jest.fn()}
              />
            </PodViewV2QueryProvider>
          </PodViewExperienceProvider>
        </BrowserRouter>
      </AppContext.Provider>
    );

    const tabs = screen.getAllByRole("tab");
    expect(tabs.slice(0, 3).map((tab) => tab.textContent)).toEqual([
      "Pods View",
      "Metrics",
      "Spec",
    ]);

    fireEvent.click(screen.getByTestId("metrics-tab"));
    await waitFor(() => {
      expect(screen.getByText("Mocked metrics")).toBeInTheDocument();
    });
  });

  it("preserves redirected pod context and expansion state", async () => {
    render(
      <AppContext.Provider
        value={{ addError: jest.fn(), disableMetricsCharts: false } as any}
      >
        <BrowserRouter>
          <PodViewExperienceProvider>
            <PodViewV2QueryProvider>
              <VertexDetails
                namespaceId="test-namespace"
                pipelineId="test-pipeline"
                vertexId="test-vertex"
                vertexSpecs={{}}
                vertexMetrics={{}}
                buffers={[]}
                type="sink"
                setModalOnClose={jest.fn()}
                refresh={jest.fn()}
              />
            </PodViewV2QueryProvider>
          </PodViewExperienceProvider>
        </BrowserRouter>
      </AppContext.Provider>
    );

    fireEvent.click(screen.getByTestId("metrics-tab"));
    expect(await screen.findByTestId("metrics-pod")).toHaveTextContent(
      "vertex-wide"
    );

    fireEvent.click(screen.getByTestId("redirect-to-metrics"));
    await waitFor(() => {
      expect(screen.getByTestId("metrics-pod")).toHaveTextContent("test-pod");
      expect(screen.getByTestId("metrics-expanded")).toHaveTextContent("true");
    });

    fireEvent.click(screen.getByTestId("pods-tab"));
    fireEvent.click(screen.getByTestId("metrics-tab"));
    await waitFor(() => {
      expect(screen.getByTestId("metrics-pod")).toHaveTextContent("test-pod");
      expect(screen.getByTestId("metrics-expanded")).toHaveTextContent("true");
    });
  });

  it("returns to Pods View when metrics become disabled", async () => {
    const Harness = () => {
      const [disableMetricsCharts, setDisableMetricsCharts] =
        React.useState(false);
      return (
        <AppContext.Provider
          value={{ addError: jest.fn(), disableMetricsCharts } as any}
        >
          <button
            data-testid="disable-metrics"
            onClick={() => setDisableMetricsCharts(true)}
          />
          <BrowserRouter>
            <PodViewExperienceProvider>
              <PodViewV2QueryProvider>
                <VertexDetails
                  namespaceId="test-namespace"
                  pipelineId="test-pipeline"
                  vertexId="test-vertex"
                  vertexSpecs={{}}
                  vertexMetrics={{}}
                  buffers={[]}
                  type="sink"
                  setModalOnClose={jest.fn()}
                  refresh={jest.fn()}
                />
              </PodViewV2QueryProvider>
            </PodViewExperienceProvider>
          </BrowserRouter>
        </AppContext.Provider>
      );
    };

    render(<Harness />);
    fireEvent.click(screen.getByTestId("metrics-tab"));
    expect(await screen.findByText("Mocked metrics")).toBeInTheDocument();

    fireEvent.click(screen.getByTestId("disable-metrics"));
    await waitFor(() => {
      expect(screen.queryByTestId("metrics-tab")).not.toBeInTheDocument();
      expect(screen.getByText("Mocked pods")).toBeInTheDocument();
    });
  });

  it("Click through tabs", async () => {
    render(
      <VertexDetails
        namespaceId="test-namespace"
        pipelineId="test-pipeline"
        vertexId="test-vertex"
        vertexSpecs={{}}
        vertexMetrics={{}}
        buffers={[]}
        type="sink"
        setModalOnClose={jest.fn()}
        refresh={jest.fn()}
      />,
      { wrapper: TestProviders }
    );
    await waitFor(() => {
      expect(screen.getByText("Sink Vertex")).toBeInTheDocument();
      expect(screen.getByText("Mocked pods")).toBeInTheDocument();
    });
    act(() => {
      const tab = screen.getByTestId("spec-tab");
      fireEvent.click(tab);
    });
    await waitFor(() => {
      expect(screen.getByText("Mocked vertexupdate")).toBeInTheDocument();
    });
    act(() => {
      const tab = screen.getByTestId("pr-tab");
      fireEvent.click(tab);
    });
    await waitFor(() => {
      expect(screen.getByText("Mocked processingrates")).toBeInTheDocument();
    });
    act(() => {
      const tab = screen.getByTestId("events-tab");
      fireEvent.click(tab);
    });
    await waitFor(() => {
      expect(screen.getByText("Mocked k8sevents")).toBeInTheDocument();
    });
    act(() => {
      const tab = screen.getByTestId("buffers-tab");
      fireEvent.click(tab);
    });
    await waitFor(() => {
      expect(screen.getByText("Mocked buffers")).toBeInTheDocument();
      expect(screen.queryByTestId("isb-tab")).not.toBeInTheDocument();
    });
  });

  it("renders source ISB details under Buffers when buffer rows are absent", async () => {
    render(
      <VertexDetails
        namespaceId="test-namespace"
        pipelineId="test-pipeline"
        vertexId="test-vertex"
        vertexSpecs={{}}
        vertexMetrics={{}}
        buffers={null}
        type="source"
        setModalOnClose={jest.fn()}
        refresh={jest.fn()}
      />,
      { wrapper: TestProviders }
    );

    await waitFor(() => {
      expect(screen.getByText("Input Vertex")).toBeInTheDocument();
      expect(screen.getByTestId("buffers-tab")).toBeInTheDocument();
      expect(screen.queryByTestId("isb-tab")).not.toBeInTheDocument();
    });

    act(() => {
      const tab = screen.getByTestId("buffers-tab");
      fireEvent.click(tab);
    });

    await waitFor(() => {
      expect(screen.getByText("Mocked buffers")).toBeInTheDocument();
      expect(mockBuffersComponent).toHaveBeenCalledWith(
        expect.objectContaining({
          buffers: [],
          namespaceId: "test-namespace",
          pipelineId: "test-pipeline",
          vertexId: "test-vertex",
          type: "source",
        })
      );
    });
  });

  it("Update modal opens", async () => {
    render(
      <VertexDetails
        namespaceId="test-namespace"
        pipelineId="test-pipeline"
        vertexId="test-vertex"
        vertexSpecs={{}}
        vertexMetrics={{}}
        buffers={[]}
        type="sink"
        setModalOnClose={jest.fn()}
        refresh={jest.fn()}
      />,
      { wrapper: TestProviders }
    );
    await waitFor(() => {
      expect(screen.getByText("Sink Vertex")).toBeInTheDocument();
      expect(screen.getByText("Mocked pods")).toBeInTheDocument();
    });
    // go to spec tab
    act(() => {
      const tab = screen.getByTestId("spec-tab");
      fireEvent.click(tab);
    });
    await waitFor(() => {
      expect(screen.getByText("Mocked vertexupdate")).toBeInTheDocument();
    });
    // set update modal open on navigate away
    act(() => {
      const btn = screen.getByTestId("set-update-modal-open");
      fireEvent.click(btn);
    });
    await waitFor(() => {
      expect(screen.getByText("Mocked vertexupdate")).toBeInTheDocument();
    });
    // change tab
    act(() => {
      const tab = screen.getByTestId("pr-tab");
      fireEvent.click(tab);
    });
    // Check modal opened
    await waitFor(() => {
      expect(screen.getByTestId("close-modal-cancel")).toBeInTheDocument();
    });
    // Click cancel
    act(() => {
      const btn = screen.getByTestId("close-modal-cancel");
      fireEvent.click(btn);
    });
    // change tab
    act(() => {
      const tab = screen.getByTestId("pr-tab");
      fireEvent.click(tab);
    });
    // Check modal opened
    await waitFor(() => {
      expect(screen.getByTestId("close-modal-cancel")).toBeInTheDocument();
    });
    // Click confirm
    act(() => {
      const btn = screen.getByTestId("close-modal-confirm");
      fireEvent.click(btn);
    });
    // Check tab changed to intended tab
    await waitFor(() => {
      expect(screen.getByText("Mocked processingrates")).toBeInTheDocument();
    });
  });

  it("writes the confirmed tab to the URL after leaving a dirty Spec", async () => {
    render(
      <AppContext.Provider
        value={{ addError: jest.fn(), disableMetricsCharts: false } as any}
      >
        <MemoryRouter
          initialEntries={["/?vertex=test-vertex&vertexTab=spec&specLine=12"]}
        >
          <SearchProbe />
          <PodViewExperienceProvider>
            <PodViewV2QueryProvider>
              <PodViewBetaToggle />
              <VertexDetails
                namespaceId="test-namespace"
                pipelineId="test-pipeline"
                vertexId="test-vertex"
                vertexSpecs={{}}
                vertexMetrics={{}}
                buffers={[]}
                type="sink"
                setModalOnClose={jest.fn()}
                refresh={jest.fn()}
              />
            </PodViewV2QueryProvider>
          </PodViewExperienceProvider>
        </MemoryRouter>
      </AppContext.Provider>
    );

    await waitFor(() => {
      expect(screen.getByText("Mocked vertexupdate")).toBeInTheDocument();
    });
    fireEvent.click(screen.getByTestId("set-update-modal-open"));
    fireEvent.click(screen.getByTestId("pr-tab"));
    fireEvent.click(await screen.findByTestId("close-modal-confirm"));

    await waitFor(() => {
      expect(screen.getByText("Mocked processingrates")).toBeInTheDocument();
      expect(screen.getByTestId("location-search")).toHaveTextContent(
        "vertexTab=processingRates"
      );
      expect(screen.getByTestId("location-search")).not.toHaveTextContent(
        "specLine"
      );
    });
  });

  it("restores a deep-linked metrics tab and pod name", async () => {
    render(
      <AppContext.Provider
        value={{ addError: jest.fn(), disableMetricsCharts: false } as any}
      >
        <MemoryRouter
          initialEntries={[
            "/?vertex=test-vertex&vertexTab=metrics&pod=shared-pod",
          ]}
        >
          <PodViewExperienceProvider>
            <PodViewV2QueryProvider>
              <VertexDetails
                namespaceId="test-namespace"
                pipelineId="test-pipeline"
                vertexId="test-vertex"
                vertexSpecs={{}}
                vertexMetrics={{}}
                buffers={[]}
                type="sink"
                setModalOnClose={jest.fn()}
                refresh={jest.fn()}
              />
            </PodViewV2QueryProvider>
          </PodViewExperienceProvider>
        </MemoryRouter>
      </AppContext.Provider>
    );

    await waitFor(() => {
      expect(screen.getByText("Mocked metrics")).toBeInTheDocument();
      expect(screen.getByTestId("metrics-pod")).toHaveTextContent("shared-pod");
    });
  });

  it("falls back from an unavailable buffers tab and rewrites the URL", async () => {
    render(
      <AppContext.Provider
        value={{ addError: jest.fn(), disableMetricsCharts: false } as any}
      >
        <MemoryRouter
          initialEntries={["/?vertex=test-vertex&vertexTab=buffers"]}
        >
          <SearchProbe />
          <PodViewExperienceProvider>
            <PodViewV2QueryProvider>
              <PodViewBetaToggle />
              <VertexDetails
                namespaceId="test-namespace"
                pipelineId="test-pipeline"
                vertexId="test-vertex"
                vertexSpecs={{}}
                vertexMetrics={{}}
                buffers={null}
                type="sink"
                setModalOnClose={jest.fn()}
                refresh={jest.fn()}
              />
            </PodViewV2QueryProvider>
          </PodViewExperienceProvider>
        </MemoryRouter>
      </AppContext.Provider>
    );

    await waitFor(() => {
      expect(screen.getByText("Mocked pods")).toBeInTheDocument();
      expect(screen.queryByTestId("buffers-tab")).not.toBeInTheDocument();
      expect(screen.getByTestId("location-search")).toHaveTextContent(
        "vertexTab=pods"
      );
    });
  });

  it("keeps the copy action in the header exclusion zone", async () => {
    render(
      <VertexDetails
        namespaceId="test-namespace"
        pipelineId="test-pipeline"
        vertexId="test-vertex"
        vertexSpecs={{}}
        vertexMetrics={{}}
        buffers={[]}
        type="sink"
        setModalOnClose={jest.fn()}
        refresh={jest.fn()}
      />,
      { wrapper: TestProviders }
    );

    const header = document.querySelector(".vertex-details-header");
    const actions = document.querySelector(".vertex-details-header-actions");
    expect(header).toBeInTheDocument();
    expect(actions).toBeInTheDocument();
    expect(actions).toContainElement(screen.getByTestId("copy-view-link"));
    expect(screen.getByTestId("copy-view-link")).toHaveTextContent("Copy View");
  });

  it("hides the header copy action on Metrics and restores it on another tab", async () => {
    render(
      <AppContext.Provider
        value={{ addError: jest.fn(), disableMetricsCharts: false } as any}
      >
        <BrowserRouter>
          <PodViewExperienceProvider>
            <PodViewV2QueryProvider>
              <VertexDetails
                namespaceId="test-namespace"
                pipelineId="test-pipeline"
                vertexId="test-vertex"
                vertexSpecs={{}}
                vertexMetrics={{}}
                buffers={[]}
                type="sink"
                setModalOnClose={jest.fn()}
                refresh={jest.fn()}
              />
            </PodViewV2QueryProvider>
          </PodViewExperienceProvider>
        </BrowserRouter>
      </AppContext.Provider>
    );

    expect(screen.getByTestId("copy-view-link")).toBeInTheDocument();
    fireEvent.click(screen.getByTestId("metrics-tab"));
    await waitFor(() => {
      expect(screen.getByText("Mocked metrics")).toBeInTheDocument();
      expect(screen.queryByTestId("copy-view-link")).not.toBeInTheDocument();
    });
    fireEvent.click(screen.getByTestId("spec-tab"));
    await waitFor(() => {
      expect(screen.getByTestId("copy-view-link")).toBeInTheDocument();
    });
  });

  it("switches to the v2-only shell and preserves deep-link state when returning to classic", async () => {
    localStorage.setItem("numaflow.podView.experience", "next");
    fetchMock.mockResponse((request) => {
      if (request.url.endsWith("/api/v2/capabilities")) {
        return Promise.resolve(
          JSON.stringify({
            apiVersion: "v2",
            podView: {
              mode: "optIn",
              eligible: true,
              defaultExperience: "classic",
              allowClassicFallback: true,
            },
            operations: [],
            limits: {
              defaultPageSize: 50,
              maximumPageSize: 200,
              maximumLogLines: 1000,
              maximumMetricPoints: 2000,
            },
          })
        );
      }
      if (request.url.endsWith("/summary")) {
        return Promise.resolve(
          JSON.stringify({
            ref: {
              kind: "PipelineVertex",
              namespace: "test-namespace",
              pipeline: "test-pipeline",
              name: "test-vertex",
              uid: "uid",
            },
            vertexType: "Sink",
            phase: "Running",
            desiredPhase: "Running",
            health: { state: "healthy" },
            generation: 1,
            observedGeneration: 1,
            createdAt: "2026-09-16T10:00:00Z",
            observedAt: "2026-09-16T11:00:00Z",
            capabilities: ["summary", "status"],
          })
        );
      }
      if (request.url.endsWith("/status")) {
        return Promise.resolve(
          JSON.stringify({
            ref: {
              kind: "PipelineVertex",
              namespace: "test-namespace",
              pipeline: "test-pipeline",
              name: "test-vertex",
              uid: "uid",
            },
            phase: "Running",
            desiredPhase: "Running",
            replicas: {
              current: 1,
              desired: 1,
              ready: 1,
              updated: 1,
              updatedReady: 1,
            },
            conditions: [],
            generation: 1,
            observedGeneration: 1,
            observedAt: "2026-09-16T11:00:00Z",
          })
        );
      }
      return Promise.resolve({ status: 404, body: "{}" });
    });

    render(
      <AppContext.Provider
        value={
          { host: "", addError: jest.fn(), disableMetricsCharts: false } as any
        }
      >
        <MemoryRouter
          initialEntries={[
            "/?namespace=test-namespace&pipeline=test-pipeline&vertex=test-vertex&podView=next&pod=test-pod&container=udsink",
          ]}
        >
          <SearchProbe />
          <PodViewExperienceProvider>
            <PodViewV2QueryProvider>
              <PodViewBetaToggle />
              <VertexDetails
                namespaceId="test-namespace"
                pipelineId="test-pipeline"
                vertexId="test-vertex"
                vertexSpecs={{}}
                vertexMetrics={{}}
                buffers={[]}
                type="sink"
                setModalOnClose={jest.fn()}
                refresh={jest.fn()}
              />
            </PodViewV2QueryProvider>
          </PodViewExperienceProvider>
        </MemoryRouter>
      </AppContext.Provider>
    );

    expect(await screen.findByTestId("pod-view-next")).toBeInTheDocument();
    expect(screen.queryByText("Mocked pods")).not.toBeInTheDocument();
    expect(
      fetchMock.mock.calls.every(([request]) =>
        String(request).includes("/api/v2/")
      )
    ).toBe(true);

    fireEvent.click(screen.getByTestId("pod-view-experience-classic"));
    expect(await screen.findByText("Mocked pods")).toBeInTheDocument();
    expect(screen.getByTestId("location-search")).toHaveTextContent(
      "podView=classic"
    );
    expect(screen.getByTestId("location-search")).toHaveTextContent(
      "pod=test-pod"
    );
    expect(screen.getByTestId("location-search")).toHaveTextContent(
      "container=udsink"
    );
    localStorage.removeItem("numaflow.podView.experience");
    fetchMock.resetMocks();
  });
});
