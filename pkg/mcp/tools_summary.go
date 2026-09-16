/*
Copyright 2026 The Numaproj Authors.

Licensed under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License.
You may obtain a copy of the License at

    http://www.apache.org/licenses/LICENSE-2.0

Unless required by applicable law or agreed to in writing, software
distributed under the License is distributed on an "AS IS" BASIS,
WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
See the License for the specific language governing permissions and
limitations under the License.
*/

package mcpserver

import (
	"context"
	"encoding/json"
	"fmt"
	"strings"

	mcpsdk "github.com/mark3labs/mcp-go/mcp"

	apiv2 "github.com/numaproj/numaflow/pkg/apiclient/v2"
)

func vertexSummaryTool(api SummaryAPI) ToolDefinition {
	tool := mcpsdk.NewTool(
		"get_vertex_summary",
		mcpsdk.WithDescription("Get a compact controller-backed summary for one pipeline vertex or MonoVertex."),
		mcpsdk.WithReadOnlyHintAnnotation(true),
		mcpsdk.WithDestructiveHintAnnotation(false),
		mcpsdk.WithIdempotentHintAnnotation(true),
		mcpsdk.WithOpenWorldHintAnnotation(false),
		mcpsdk.WithString("namespace", mcpsdk.Required(), mcpsdk.Description("Kubernetes namespace containing the target")),
		mcpsdk.WithString("pipeline", mcpsdk.Description("Pipeline name; provide together with vertex")),
		mcpsdk.WithString("vertex", mcpsdk.Description("Vertex name; provide together with pipeline")),
		mcpsdk.WithString("monoVertex", mcpsdk.Description("MonoVertex name; mutually exclusive with pipeline and vertex")),
	)
	return ToolDefinition{Tool: tool, Handler: vertexSummaryHandler(api)}
}

func vertexSummaryHandler(api SummaryAPI) func(context.Context, mcpsdk.CallToolRequest) (*mcpsdk.CallToolResult, error) {
	return func(ctx context.Context, request mcpsdk.CallToolRequest) (*mcpsdk.CallToolResult, error) {
		namespace := strings.TrimSpace(request.GetString("namespace", ""))
		pipeline := strings.TrimSpace(request.GetString("pipeline", ""))
		vertex := strings.TrimSpace(request.GetString("vertex", ""))
		monoVertex := strings.TrimSpace(request.GetString("monoVertex", ""))
		if namespace == "" {
			return toolError("validation_failed", "namespace is required"), nil
		}
		pipelineTarget := pipeline != "" || vertex != ""
		monoVertexTarget := monoVertex != ""
		if pipelineTarget == monoVertexTarget {
			return toolError("validation_failed", "provide exactly one target: pipeline with vertex, or monoVertex"), nil
		}
		if pipelineTarget && (pipeline == "" || vertex == "") {
			return toolError("validation_failed", "pipeline and vertex must be provided together"), nil
		}

		if monoVertexTarget {
			response, err := api.GetMonoVertexSummaryWithResponse(ctx, namespace, monoVertex, nil)
			if err != nil {
				return toolError("api_unavailable", "failed to call Numaflow API v2"), nil
			}
			if response.JSON200 != nil {
				return mcpsdk.NewToolResultStructuredOnly(response.JSON200), nil
			}
			return apiToolError(response.StatusCode(), response.Body), nil
		}

		response, err := api.GetPipelineVertexSummaryWithResponse(ctx, namespace, pipeline, vertex, nil)
		if err != nil {
			return toolError("api_unavailable", "failed to call Numaflow API v2"), nil
		}
		if response.JSON200 != nil {
			return mcpsdk.NewToolResultStructuredOnly(response.JSON200), nil
		}
		return apiToolError(response.StatusCode(), response.Body), nil
	}
}

func apiToolError(status int, body []byte) *mcpsdk.CallToolResult {
	var problem apiv2.Problem
	if err := json.Unmarshal(body, &problem); err == nil && problem.Code != "" {
		return toolError(problem.Code, problem.Detail)
	}
	return toolError("api_request_failed", fmt.Sprintf("Numaflow API v2 returned status %d", status))
}

func toolError(code, message string) *mcpsdk.CallToolResult {
	result := mcpsdk.NewToolResultStructuredOnly(map[string]any{
		"code":    code,
		"message": message,
	})
	result.IsError = true
	return result
}
