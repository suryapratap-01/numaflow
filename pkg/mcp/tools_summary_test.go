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
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	mcpsdk "github.com/mark3labs/mcp-go/mcp"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	apiv2 "github.com/numaproj/numaflow/pkg/apiclient/v2"
)

func TestVertexSummaryToolDefinition(t *testing.T) {
	definitions := ToolDefinitions(&fakeSummaryAPI{})
	require.Len(t, definitions, 1)
	tool := definitions[0].Tool
	assert.Equal(t, "get_vertex_summary", tool.Name)
	require.NotNil(t, tool.Annotations.ReadOnlyHint)
	require.NotNil(t, tool.Annotations.DestructiveHint)
	require.NotNil(t, tool.Annotations.IdempotentHint)
	require.NotNil(t, tool.Annotations.OpenWorldHint)
	assert.True(t, *tool.Annotations.ReadOnlyHint)
	assert.False(t, *tool.Annotations.DestructiveHint)
	assert.True(t, *tool.Annotations.IdempotentHint)
	assert.False(t, *tool.Annotations.OpenWorldHint)
}

func TestVertexSummaryHandler(t *testing.T) {
	api := &fakeSummaryAPI{summary: testSummary()}
	handler := ToolDefinitions(api)[0].Handler
	request := mcpsdk.CallToolRequest{Params: mcpsdk.CallToolParams{
		Name: "get_vertex_summary",
		Arguments: map[string]any{
			"namespace": "team-a",
			"pipeline":  "orders",
			"vertex":    "map",
		},
	}}

	result, err := handler(context.Background(), request)
	require.NoError(t, err)
	require.False(t, result.IsError)
	assert.Equal(t, "map", api.pipelineVertex)
	data, ok := result.StructuredContent.(*apiv2.VertexSummary)
	require.True(t, ok)
	assert.Equal(t, "map", data.Ref.Name)
}

func TestVertexSummaryHandlerSupportsMonoVertex(t *testing.T) {
	api := &fakeSummaryAPI{summary: testSummary()}
	handler := ToolDefinitions(api)[0].Handler
	result, err := handler(context.Background(), mcpsdk.CallToolRequest{Params: mcpsdk.CallToolParams{
		Arguments: map[string]any{
			"namespace":  "team-a",
			"monoVertex": "orders",
		},
	}})

	require.NoError(t, err)
	assert.False(t, result.IsError)
	assert.Equal(t, "orders", api.monoVertex)
}

func TestVertexSummaryHandlerValidatesTargetUnion(t *testing.T) {
	handler := ToolDefinitions(&fakeSummaryAPI{})[0].Handler
	tests := []map[string]any{
		{},
		{"namespace": "team-a"},
		{"namespace": "team-a", "pipeline": "orders"},
		{"namespace": "team-a", "pipeline": "orders", "vertex": "map", "monoVertex": "mono"},
	}
	for _, arguments := range tests {
		result, err := handler(context.Background(), mcpsdk.CallToolRequest{Params: mcpsdk.CallToolParams{
			Name:      "get_vertex_summary",
			Arguments: arguments,
		}})
		require.NoError(t, err)
		assert.True(t, result.IsError)
	}
}

func TestVertexSummaryHandlerPreservesAPIProblem(t *testing.T) {
	problem := apiv2.Problem{
		Type:     "/api/v2/problems/authorization_denied",
		Title:    "Forbidden",
		Status:   http.StatusForbidden,
		Code:     "authorization_denied",
		Detail:   "access denied",
		Instance: "/api/v2/test",
	}
	body, err := json.Marshal(problem)
	require.NoError(t, err)
	api := &fakeSummaryAPI{pipelineResponse: &apiv2.GetPipelineVertexSummaryResponse{
		Body:         body,
		HTTPResponse: &http.Response{StatusCode: http.StatusForbidden},
	}}
	handler := ToolDefinitions(api)[0].Handler
	result, err := handler(context.Background(), mcpsdk.CallToolRequest{Params: mcpsdk.CallToolParams{
		Arguments: map[string]any{"namespace": "team-a", "pipeline": "orders", "vertex": "map"},
	}})
	require.NoError(t, err)
	assert.True(t, result.IsError)
	assert.Equal(t, map[string]any{"code": "authorization_denied", "message": "access denied"}, result.StructuredContent)
}

func TestAPIClientCallsV2WithBearerToken(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(writer http.ResponseWriter, request *http.Request) {
		assert.Equal(t, "/base/api/v2/namespaces/team-a/pipelines/orders/vertices/map/summary", request.URL.Path)
		assert.Equal(t, "Bearer secret-token", request.Header.Get("Authorization"))
		writer.Header().Set("Content-Type", "application/json")
		require.NoError(t, json.NewEncoder(writer).Encode(testSummary()))
	}))
	defer server.Close()

	api, err := NewAPIClient(server.URL, "/base/", "secret-token", server.Client())
	require.NoError(t, err)
	response, err := api.GetPipelineVertexSummaryWithResponse(context.Background(), "team-a", "orders", "map", nil)
	require.NoError(t, err)
	require.NotNil(t, response.JSON200)
	assert.Equal(t, "map", response.JSON200.Ref.Name)
}

type fakeSummaryAPI struct {
	summary          *apiv2.VertexSummary
	pipelineResponse *apiv2.GetPipelineVertexSummaryResponse
	pipelineVertex   string
	monoVertex       string
}

func (f *fakeSummaryAPI) GetPipelineVertexSummaryWithResponse(_ context.Context, _ apiv2.Namespace, _ apiv2.Pipeline, vertex apiv2.Vertex, _ *apiv2.GetPipelineVertexSummaryParams, _ ...apiv2.RequestEditorFn) (*apiv2.GetPipelineVertexSummaryResponse, error) {
	f.pipelineVertex = vertex
	if f.pipelineResponse != nil {
		return f.pipelineResponse, nil
	}
	return &apiv2.GetPipelineVertexSummaryResponse{
		HTTPResponse: &http.Response{StatusCode: http.StatusOK},
		JSON200:      f.summary,
	}, nil
}

func (f *fakeSummaryAPI) GetMonoVertexSummaryWithResponse(_ context.Context, _ apiv2.Namespace, monoVertex apiv2.MonoVertex, _ *apiv2.GetMonoVertexSummaryParams, _ ...apiv2.RequestEditorFn) (*apiv2.GetMonoVertexSummaryResponse, error) {
	f.monoVertex = monoVertex
	return &apiv2.GetMonoVertexSummaryResponse{
		HTTPResponse: &http.Response{StatusCode: http.StatusOK},
		JSON200:      f.summary,
	}, nil
}

func testSummary() *apiv2.VertexSummary {
	return &apiv2.VertexSummary{
		Ref: apiv2.TargetRef{
			Kind:      apiv2.TargetKindPipelineVertex,
			Namespace: "team-a",
			Name:      "map",
			Uid:       "uid",
		},
		VertexType:         apiv2.VertexTypeMapUDF,
		Phase:              "Running",
		DesiredPhase:       "Running",
		Health:             apiv2.Health{State: apiv2.HealthStateHealthy},
		Generation:         1,
		ObservedGeneration: 1,
		CreatedAt:          time.Date(2026, time.September, 16, 10, 0, 0, 0, time.UTC),
		ObservedAt:         time.Date(2026, time.September, 16, 11, 0, 0, 0, time.UTC),
		Capabilities:       []string{"summary", "status"},
	}
}
