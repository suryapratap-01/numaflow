# Numaflow MCP Server

The Numaflow MCP (Model Context Protocol) server exposes **read-only** tools so MCP-compatible assistants and automation clients can inspect Pipelines, MonoVertices, pods, logs, metrics, watermarks, and runtime errors without scraping logs manually.

The server never creates, updates, deletes, or patches Kubernetes resources.

## Prerequisites

Before setting up MCP locally you need:

1. **Go 1.24+** — see [Development](development.md)
2. **kubectl** configured for a cluster that runs Numaflow
3. **Numaflow installed** on the cluster (controller + CRDs)
4. At least one **Pipeline** or **MonoVertex** to inspect (optional but useful for testing)

### Quick local cluster (kind)

```shell
kind create cluster --name numaflow-dev
kind export kubeconfig --name numaflow-dev

# Install Numaflow (from repo root)
make start
```

Verify the cluster is reachable:

```shell
kubectl get pods -A
kubectl get pipelines -A
kubectl get monovertices -A
```

## Build the MCP binary

From the repository root:

```shell
make build
# Binary: ./dist/numaflow

# Or build directly:
go build -o ./dist/numaflow ./cmd/main.go
```

Confirm the subcommand exists:

```shell
./dist/numaflow mcp-server --help
```

## Run locally (stdio)

The default mode uses **stdio** transport. Local MCP clients spawn the process and exchange MCP messages over stdin/stdout:

```shell
export KUBECONFIG=~/.kube/config
./dist/numaflow mcp-server --namespace default
```

### Flags

| Flag | Default | Description |
|------|---------|-------------|
| `--kubeconfig` | `$KUBECONFIG` or `~/.kube/config` | Path to kubeconfig |
| `-n`, `--namespace` | (empty) | Default namespace when a tool omits one. Empty = all namespaces for list ops |
| `--daemon-client-protocol` | `grpc` | Daemon transport: `grpc` or `http` |
| `--http` | false | Run as streamable-HTTP server (for in-cluster deployment) |
| `--port` | 8443 (8080 with `--insecure`) | HTTP listen port |
| `--insecure` | false | Disable TLS on HTTP server (dev only) |

Environment variable equivalents: `KUBECONFIG`, `NAMESPACE`, `NUMAFLOW_DAEMON_CLIENT_PROTOCOL`, `NUMAFLOW_MCP_HTTP`, `NUMAFLOW_MCP_INSECURE`.

## MCP client setup

Configure your MCP client to launch the Numaflow binary with the `mcp-server` subcommand. Most stdio MCP clients use a JSON configuration shaped like this:

```json
{
  "mcpServers": {
    "numaflow-mcp": {
      "command": "/absolute/path/to/dist/numaflow",
      "args": ["mcp-server", "--namespace", "default"],
      "env": {
        "KUBECONFIG": "/absolute/path/to/.kube/config"
      }
    }
  }
}
```

Replace paths with your actual binary and kubeconfig locations.

**Restart the MCP client after changes:** If you rebuild the binary or edit the MCP configuration, restart the MCP server/client session so it picks up the new build and settings.

### Tips for stdio clients

- Use an **absolute path** for `command` — relative paths can fail when the client starts the server from a different working directory.
- Set `--namespace` to the namespace you work in most often; you can still pass `namespace` per tool call.
- Leave `--namespace` empty if you want list tools to search all namespaces.

## How daemon connectivity works

Some tools (metrics, errors, watermarks, buffer info, pipeline status) call the **Pipeline/MonoVertex daemon** over gRPC.

| Where MCP runs | Behavior |
|----------------|----------|
| **Inside the cluster** (HTTP mode) | Connects directly to in-cluster DNS, e.g. `simple-pipeline-daemon-svc.default.svc:4327` |
| **Outside the cluster** (stdio + local kubeconfig) | Automatically opens a **Kubernetes port-forward** to the daemon pod and dials `127.0.0.1:<port>` |

If daemon tools fail with `name resolver error: produced zero addresses`, the MCP server is likely running an old binary without port-forward support, or MCP was not restarted after a rebuild.

## Available tools (20 read-only)

### CRD discovery

| Tool | Description |
|------|-------------|
| `list_pipelines` | List Pipelines with phase and vertex count |
| `get_pipeline` | Full Pipeline spec and status |
| `list_monovertices` | List MonoVertices with replica counts |
| `get_monovertex` | Full MonoVertex spec and status |
| `list_isbservices` | List InterStepBufferServices |

### Daemon-backed diagnostics

| Tool | Description |
|------|-------------|
| `get_pipeline_status` | Pipeline health from daemon |
| `get_pipeline_watermarks` | Per-edge watermarks |
| `list_buffers` | Buffer list for a pipeline |
| `get_buffer_info` | Single buffer details |
| `get_vertex_metrics` | Throughput and pending counts per vertex |
| `get_vertex_errors` | Structured runtime errors per vertex |
| `get_monovertex_status` | MonoVertex health from daemon |
| `get_monovertex_metrics` | MonoVertex throughput and pending |
| `get_monovertex_errors` | MonoVertex runtime errors |

### Kubernetes-backed

| Tool | Description |
|------|-------------|
| `list_namespaces` | Namespaces with Numaflow resources |
| `get_cluster_summary` | Cluster-wide summary |
| `list_pods` | Pods for a pipeline vertex or MonoVertex |
| `get_pod_info` | Pod status, containers, restarts, resources |
| `tail_pod_logs` | Last N lines of pod logs |
| `list_namespace_events` | Recent namespace events |

## Example assistant prompts

Once MCP is connected, you can ask your assistant things like:

- *"List pipelines in the default namespace"*
- *"Get metrics for all vertices in simple-pipeline"*
- *"Show pod info and logs for map-mono-vertex in numaflow-demo"*
- *"Are there any errors on the cat vertex of simple-pipeline?"*
- *"Compare map-mono-vertex and minimal-mono-vertex metrics"*

## HTTP mode (in-cluster)

For running MCP inside Kubernetes (not typical for local dev):

```shell
./dist/numaflow mcp-server --http --port 8443 --namespace numaflow-system
```

Use `--insecure` only on trusted networks. TLS cert/key can be supplied with `--tls-cert` and `--tls-key`; otherwise a self-signed cert is generated.

For a local HTTP smoke test, initialize a streamable-HTTP MCP session before calling tools:

```shell
./dist/numaflow mcp-server --http --insecure --port 8080 --namespace default &
MCP_PID=$!
TMP_HEADERS=$(mktemp)

curl -sS -N -D "$TMP_HEADERS" \
  -H 'Content-Type: application/json' \
  -H 'Accept: application/json, text/event-stream' \
  -d '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2024-11-05","capabilities":{},"clientInfo":{"name":"curl-smoke-test","version":"0.1.0"}}}' \
  http://127.0.0.1:8080/mcp

SESSION_ID=$(awk 'tolower($1)=="mcp-session-id:" {print $2}' "$TMP_HEADERS" | tr -d '\r')

curl -sS -N \
  -H 'Content-Type: application/json' \
  -H 'Accept: application/json, text/event-stream' \
  -H "Mcp-Session-Id: $SESSION_ID" \
  -d '{"jsonrpc":"2.0","method":"notifications/initialized"}' \
  http://127.0.0.1:8080/mcp

curl -sS -N \
  -H 'Content-Type: application/json' \
  -H 'Accept: application/json, text/event-stream' \
  -H "Mcp-Session-Id: $SESSION_ID" \
  -d '{"jsonrpc":"2.0","id":2,"method":"tools/list"}' \
  http://127.0.0.1:8080/mcp | jq '.result.tools[].name'

kill "$MCP_PID"
```

## Troubleshooting

| Symptom | Likely cause | Fix |
|---------|--------------|-----|
| `failed to get kubernetes rest config` | Bad or missing kubeconfig | Set `KUBECONFIG` or `--kubeconfig` |
| `pipelines.numaflow.io "X" not found` | Wrong name/namespace | Use `list_pipelines` to find exact names |
| `name resolver error: produced zero addresses` | Old MCP binary or no restart | Rebuild, restart MCP server |
| `Invalid session ID` in HTTP mode | Tool request sent before MCP session initialization | Send `initialize`, capture `Mcp-Session-Id`, then include it on subsequent requests |
| `GetVertexMetrics failed` / daemon errors | Daemon pod not running | `kubectl get pods -l app.kubernetes.io/component=daemon` |
| Empty metrics-server fields in pod info | metrics-server not installed | Install metrics-server (see [Development](development.md)) |
| MCP tools not visible in client | Config not loaded | Check the MCP client configuration and restart the MCP session |

### Manual daemon check (optional)

Port-forward a pipeline daemon and verify gRPC works:

```shell
# Find daemon pod
kubectl get pods -n default -l numaflow.numaproj.io/pipeline-name=simple-pipeline

# Port-forward (replace pod name)
kubectl port-forward -n default pod/simple-pipeline-daemon-xxxxx 4327:4327
```

## Development & tests

```shell
# Unit tests
go test ./pkg/mcp/...

# Integration test (requires live cluster + kubeconfig)
go test -tags=integration ./pkg/mcp/ -run TestDaemonConnectorPortForward -v
```

Implementation lives under `pkg/mcp/`. The out-of-cluster port-forward logic is in `pkg/mcp/daemon_connect.go`.
