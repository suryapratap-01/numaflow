import React from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react";
import { BrowserRouter } from "react-router-dom";
import { AppContext } from "../../../App";
import { PodViewNext } from ".";

const summary = {
  ref: {
    kind: "PipelineVertex",
    namespace: "team-a",
    pipeline: "orders",
    name: "map",
    uid: "uid",
  },
  vertexType: "MapUDF",
  phase: "Running",
  desiredPhase: "Running",
  health: { state: "healthy" },
  generation: 2,
  observedGeneration: 2,
  createdAt: "2026-09-16T10:00:00Z",
  observedAt: "2026-09-16T11:00:00Z",
  capabilities: ["summary", "status"],
};

const status = {
  ref: summary.ref,
  phase: "Running",
  desiredPhase: "Running",
  replicas: {
    current: 2,
    desired: 2,
    ready: 2,
    updated: 2,
    updatedReady: 2,
  },
  conditions: [],
  generation: 2,
  observedGeneration: 2,
  observedAt: "2026-09-16T11:00:00Z",
};

describe("PodViewNext", () => {
  beforeEach(() => {
    fetchMock.resetMocks();
    fetchMock.mockResponse((request) => {
      if (request.url.includes("/summary")) {
        return Promise.resolve(JSON.stringify(summary));
      }
      if (request.url.includes("/status")) {
        return Promise.resolve(JSON.stringify(status));
      }
      return Promise.resolve({ status: 404, body: "{}" });
    });
  });

  it("loads summary and status exclusively from API v2", async () => {
    renderNext();

    expect(await screen.findByText("Vertex: map")).toBeVisible();
    expect(await screen.findByText("2 / 2")).toBeVisible();
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2));
    for (const [request] of fetchMock.mock.calls) {
      expect(String(request)).toContain("/api/v2/");
      expect(String(request)).not.toContain("/api/v1/");
    }
  });

  it("keeps status errors local to the status card", async () => {
    fetchMock.mockResponse((request) =>
      request.url.includes("/summary")
        ? Promise.resolve(JSON.stringify(summary))
        : Promise.resolve({
            status: 503,
            body: JSON.stringify({
              type: "/api/v2/problems/unavailable",
              title: "Unavailable",
              status: 503,
              code: "unavailable",
              detail: "status unavailable",
              instance: request.url,
            }),
          })
    );
    renderNext();

    expect(await screen.findByText("Vertex: map")).toBeVisible();
    expect(
      await screen.findByText(
        "Status is temporarily unavailable. The summary remains usable."
      )
    ).toBeVisible();
  });
});

function renderNext() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <BrowserRouter>
      <AppContext.Provider value={{ host: "" } as any}>
        <QueryClientProvider client={client}>
          <PodViewNext
            target={{
              kind: "pipelineVertex",
              namespace: "team-a",
              pipeline: "orders",
              vertex: "map",
            }}
          />
        </QueryClientProvider>
      </AppContext.Provider>
    </BrowserRouter>
  );
}
