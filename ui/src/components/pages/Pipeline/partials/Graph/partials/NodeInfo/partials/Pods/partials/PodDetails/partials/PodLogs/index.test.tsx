import React from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { act } from "react-test-renderer";
import { TextEncoder, TextDecoder } from "util";
import { PodLogs } from "./index";

Object.assign(global, { TextDecoder, TextEncoder });

const openStreamResponse = () => ({
  body: new ReadableStream({
    start() {
      // leave open to simulate follow=true
    },
  }),
  ok: true,
});

const closedLogResponse = (chunks: string[]) => ({
  body: new ReadableStream({
    start(controller) {
      chunks.forEach((chunk) => controller.enqueue(Buffer.from(chunk)));
      controller.close();
    },
  }),
  ok: true,
});

describe("PodLogs", () => {
  let originFetch: any;
  beforeEach(() => {
    originFetch = (global as any).fetch;
  });
  afterEach(() => {
    (global as any).fetch = originFetch;
  });

  it("Load PodLogs screen", async () => {
    const mRes = closedLogResponse([
      `{"level":"info","ts":"2023-09-04T11:50:19.712416709Z","logger":"numaflow.Source-processor","caller":"publish/publisher.go:180","msg":"Skip publishing the new watermark because it's older than the current watermark","pipeline":"simple-pipeline","vertex":"in","entityID":"simple-pipeline-in-0","otStore":"default-simple-pipeline-in-cat_OT","hbStore":"default-simple-pipeline-in-cat_PROCESSORS","toVertexPartitionIdx":0,"entity":"simple-pipeline-in-0","head":1693828217394,"new":-1}`,
      `{"level":"error","ts":"2023-09-04T11:50:19.712416709Z","logger":"numaflow.Source-processor","caller":"publish/publisher.go:180","msg":"Skip publishing the new watermark because it's older than the current watermark","pipeline":"simple-pipeline","vertex":"in","entityID":"simple-pipeline-in-0","otStore":"default-simple-pipeline-in-cat_OT","hbStore":"default-simple-pipeline-in-cat_PROCESSORS","toVertexPartitionIdx":0,"entity":"simple-pipeline-in-0","head":1693828217394,"new":-1}`,
      `{"level":"warn","ts":"2023-09-04T11:50:19.712416709Z","logger":"numaflow.Source-processor","caller":"publish/publisher.go:180","msg":"Skip publishing the new watermark because it's older than the current watermark","pipeline":"simple-pipeline","vertex":"in","entityID":"simple-pipeline-in-0","otStore":"default-simple-pipeline-in-cat_OT","hbStore":"default-simple-pipeline-in-cat_PROCESSORS","toVertexPartitionIdx":0,"entity":"simple-pipeline-in-0","head":1693828217394,"new":-1}`,
      `{"level":"debug","ts":"2023-09-04T11:50:19.712416709Z","logger":"numaflow.Source-processor","caller":"publish/publisher.go:180","msg":"Skip publishing the new watermark because it's older than the current watermark","pipeline":"simple-pipeline","vertex":"in","entityID":"simple-pipeline-in-0","otStore":"default-simple-pipeline-in-cat_OT","hbStore":"default-simple-pipeline-in-cat_PROCESSORS","toVertexPartitionIdx":0,"entity":"simple-pipeline-in-0","head":1693828217394,"new":-1}`,
    ]);
    const mockedFetch = jest.fn().mockResolvedValue(mRes as any);
    (global as any).fetch = mockedFetch;
    await act(async () => {
      render(
        <PodLogs
          namespaceId={"numaflow-system"}
          containerName={"numa"}
          podName={"simple-pipeline-infer-0-xah5w"}
        />
      );
    });

    expect(mockedFetch).toBeCalledTimes(1);
    expect(screen.getByText("Container Logs")).toBeVisible();

    const searchInput = screen.getByTestId("pod-logs-search-input");
    //search for logs
    fireEvent.change(searchInput, { target: { value: "load" } });
    //search for logs not present
    fireEvent.change(searchInput, { target: { value: "xyz" } });
    expect(screen.getByText("No logs match")).toBeVisible();
    //negate logs search
    fireEvent.click(screen.getByTestId("negate-search"));
    //clear search
    expect(screen.getByTestId("clear-button")).toBeVisible();
    fireEvent.click(screen.getByTestId("clear-button"));
    //pause logs
    expect(screen.getByTestId("pause-button")).toBeVisible();
    act(() => {
      fireEvent.click(screen.getByTestId("pause-button"));
      //play logs
      fireEvent.click(screen.getByTestId("pause-button"));
    });
    //toggle theme
    expect(screen.getByTestId("color-mode-button")).toBeVisible();
    fireEvent.click(screen.getByTestId("color-mode-button"));
    //toggle logs order
    expect(screen.getByTestId("order-button")).toBeVisible();
    fireEvent.click(screen.getByTestId("order-button"));
  });

  it("Trigger PodLogs parsing error", async () => {
    const mRes = closedLogResponse(["something"]);
    const mockedFetch = jest.fn().mockResolvedValueOnce(mRes as any);
    (global as any).fetch = mockedFetch;
    await act(async () => {
      render(
        <PodLogs
          namespaceId={"numaflow-system"}
          containerName={"numa"}
          podName={"simple-pipeline-infer-0-xah5w"}
        />
      );
    });

    expect(mockedFetch).toBeCalledTimes(1);
  });

  it("aborts the previous stream when switching pods", async () => {
    const signals: AbortSignal[] = [];
    const mockedFetch = jest.fn().mockImplementation((_url, init) => {
      signals.push(init.signal);
      return Promise.resolve(openStreamResponse());
    });
    (global as any).fetch = mockedFetch;

    let rerender: (ui: React.ReactElement) => void;
    await act(async () => {
      const result = render(
        <PodLogs
          namespaceId={"numaflow-system"}
          containerName={"numa"}
          podName={"pod-a"}
        />
      );
      rerender = result.rerender;
    });

    expect(mockedFetch).toHaveBeenCalledTimes(1);
    expect(signals[0].aborted).toBe(false);

    await act(async () => {
      rerender(
        <PodLogs
          namespaceId={"numaflow-system"}
          containerName={"numa"}
          podName={"pod-b"}
        />
      );
    });

    await waitFor(() => {
      expect(mockedFetch).toHaveBeenCalledTimes(2);
    });
    expect(signals[0].aborted).toBe(true);
    expect(signals[1].aborted).toBe(false);
    expect(String(mockedFetch.mock.calls[1][0])).toContain("/pods/pod-b/logs");
  });

  it("aborts the stream on unmount", async () => {
    const signals: AbortSignal[] = [];
    const mockedFetch = jest.fn().mockImplementation((_url, init) => {
      signals.push(init.signal);
      return Promise.resolve(openStreamResponse());
    });
    (global as any).fetch = mockedFetch;

    let unmount: () => void;
    await act(async () => {
      const result = render(
        <PodLogs
          namespaceId={"numaflow-system"}
          containerName={"numa"}
          podName={"pod-a"}
        />
      );
      unmount = result.unmount;
    });

    expect(mockedFetch).toHaveBeenCalledTimes(1);
    expect(signals[0].aborted).toBe(false);

    await act(async () => {
      unmount();
    });

    expect(signals[0].aborted).toBe(true);
  });
});
