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

package v2

import (
	"context"
	"encoding/json"
	"errors"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	apierrors "k8s.io/apimachinery/pkg/api/errors"
	"k8s.io/apimachinery/pkg/runtime/schema"

	"github.com/numaproj/numaflow/server/apis/v2/generated"
	"github.com/numaproj/numaflow/server/application/observability"
)

func TestGetPipelineVertexSummaryAndETag(t *testing.T) {
	service := &fakeObservabilityService{
		summary: observability.Result[observability.VertexSummary]{
			ResourceVersion: "17",
			Value: observability.VertexSummary{
				Ref: observability.TargetRef{
					Kind:      observability.TargetKindPipelineVertex,
					Namespace: "team-a",
					Pipeline:  "orders",
					Name:      "map",
					UID:       "vertex-uid",
				},
				VertexType:         "MapUDF",
				Phase:              "Running",
				DesiredPhase:       "Running",
				Health:             observability.Health{State: observability.HealthStateHealthy},
				Generation:         4,
				ObservedGeneration: 4,
				CreatedAt:          time.Date(2026, time.September, 16, 10, 0, 0, 0, time.UTC),
				ObservedAt:         time.Date(2026, time.September, 16, 11, 0, 0, 0, time.UTC),
				Capabilities:       []string{"summary", "status"},
			},
		},
	}
	router := testRouter(t, service)

	recorder := httptest.NewRecorder()
	request := httptest.NewRequest(http.MethodGet, "/namespaces/team-a/pipelines/orders/vertices/map/summary", nil)
	router.ServeHTTP(recorder, request)

	require.Equal(t, http.StatusOK, recorder.Code)
	assert.Equal(t, `"17"`, recorder.Header().Get("ETag"))
	assert.Less(t, recorder.Body.Len(), 2048)
	assert.NotContains(t, recorder.Body.String(), `"data"`)
	var response generated.VertexSummary
	require.NoError(t, json.Unmarshal(recorder.Body.Bytes(), &response))
	assert.Equal(t, "map", response.Ref.Name)
	assert.Equal(t, generated.VertexTypeMapUDF, response.VertexType)

	recorder = httptest.NewRecorder()
	request = httptest.NewRequest(http.MethodGet, "/namespaces/team-a/pipelines/orders/vertices/map/summary", nil)
	request.Header.Set("If-None-Match", `"17"`)
	router.ServeHTTP(recorder, request)
	assert.Equal(t, http.StatusNotModified, recorder.Code)
	assert.Empty(t, recorder.Body.String())
}

func TestGetMonoVertexStatus(t *testing.T) {
	service := &fakeObservabilityService{
		status: observability.Result[observability.VertexStatus]{
			ResourceVersion: "9",
			Value: observability.VertexStatus{
				Ref:          observability.TargetRef{Kind: observability.TargetKindMonoVertex, Namespace: "team-a", Name: "orders", UID: "uid"},
				Phase:        "Running",
				DesiredPhase: "Running",
				Replicas:     observability.ReplicaStatus{Current: 2, Desired: 2, Ready: 2, Updated: 2, UpdatedReady: 2},
				Conditions: []observability.Condition{{
					Type:               "PodsHealthy",
					Status:             "True",
					Reason:             "Ready",
					ObservedGeneration: 2,
					LastTransitionTime: time.Date(2026, time.September, 16, 10, 0, 0, 0, time.UTC),
				}},
				Generation:         2,
				ObservedGeneration: 2,
				ObservedAt:         time.Date(2026, time.September, 16, 11, 0, 0, 0, time.UTC),
			},
		},
	}
	router := testRouter(t, service)
	recorder := httptest.NewRecorder()
	request := httptest.NewRequest(http.MethodGet, "/namespaces/team-a/mono-vertices/orders/status", nil)
	router.ServeHTTP(recorder, request)

	require.Equal(t, http.StatusOK, recorder.Code)
	var response generated.VertexStatus
	require.NoError(t, json.Unmarshal(recorder.Body.Bytes(), &response))
	assert.Equal(t, int64(2), response.Replicas.Ready)
	require.Len(t, response.Conditions, 1)
	assert.Equal(t, "PodsHealthy", response.Conditions[0].Type)
}

func TestHandlerProblems(t *testing.T) {
	tests := []struct {
		name        string
		path        string
		serviceErr  error
		status      int
		problemCode string
	}{
		{
			name:        "invalid Kubernetes name",
			path:        "/namespaces/TEAM_A/pipelines/orders/vertices/map/summary",
			status:      http.StatusUnprocessableEntity,
			problemCode: "validation_failed",
		},
		{
			name:        "not found",
			path:        "/namespaces/team-a/pipelines/orders/vertices/map/summary",
			serviceErr:  apierrors.NewNotFound(schema.GroupResource{Group: "numaflow.numaproj.io", Resource: "vertices"}, "orders-map"),
			status:      http.StatusNotFound,
			problemCode: "target_not_found",
		},
		{
			name:        "provider failure",
			path:        "/namespaces/team-a/pipelines/orders/vertices/map/summary",
			serviceErr:  errors.New("provider unavailable"),
			status:      http.StatusInternalServerError,
			problemCode: "target_read_failed",
		},
	}
	for _, test := range tests {
		t.Run(test.name, func(t *testing.T) {
			router := testRouter(t, &fakeObservabilityService{err: test.serviceErr})
			recorder := httptest.NewRecorder()
			router.ServeHTTP(recorder, httptest.NewRequest(http.MethodGet, test.path, nil))

			assert.Equal(t, test.status, recorder.Code)
			assert.Equal(t, "application/problem+json", recorder.Header().Get("Content-Type"))
			var problem generated.Problem
			require.NoError(t, json.Unmarshal(recorder.Body.Bytes(), &problem))
			assert.Equal(t, test.problemCode, problem.Code)
			assert.NotContains(t, problem.Detail, "provider unavailable")
		})
	}
}

func TestGetCapabilities(t *testing.T) {
	service := &fakeObservabilityService{capabilities: observability.Capabilities{
		APIVersion: "v2",
		PodView: observability.PodViewCapability{
			Mode:                 observability.PodViewModeOptIn,
			Eligible:             true,
			DefaultExperience:    observability.PodViewExperienceClassic,
			AllowClassicFallback: true,
		},
		Operations: []string{"getPipelineVertexSummary"},
		Limits:     observability.APILimits{DefaultPageSize: 50, MaximumPageSize: 200, MaximumLogLines: 1000, MaximumMetricPoints: 2000},
	}}
	router := testRouter(t, service)
	recorder := httptest.NewRecorder()
	router.ServeHTTP(recorder, httptest.NewRequest(http.MethodGet, "/capabilities", nil))

	require.Equal(t, http.StatusOK, recorder.Code)
	var response generated.Capabilities
	require.NoError(t, json.Unmarshal(recorder.Body.Bytes(), &response))
	assert.True(t, response.PodView.Eligible)
	assert.Equal(t, generated.OptIn, response.PodView.Mode)
}

func testRouter(t *testing.T, service ObservabilityService) *gin.Engine {
	t.Helper()
	gin.SetMode(gin.TestMode)
	handler, err := NewHandler(service)
	require.NoError(t, err)
	router := gin.New()
	generated.RegisterHandlersWithOptions(router, handler, generated.GinServerOptions{
		ErrorHandler: func(c *gin.Context, err error, _ int) {
			WriteProblem(c, http.StatusUnprocessableEntity, "validation_failed", "Request validation failed", err.Error(), nil)
		},
	})
	return router
}

type fakeObservabilityService struct {
	capabilities observability.Capabilities
	summary      observability.Result[observability.VertexSummary]
	status       observability.Result[observability.VertexStatus]
	err          error
}

func (f *fakeObservabilityService) GetCapabilities() observability.Capabilities {
	return f.capabilities
}

func (f *fakeObservabilityService) GetPipelineVertexSummary(context.Context, string, string, string) (observability.Result[observability.VertexSummary], error) {
	return f.summary, f.err
}

func (f *fakeObservabilityService) GetPipelineVertexStatus(context.Context, string, string, string) (observability.Result[observability.VertexStatus], error) {
	return f.status, f.err
}

func (f *fakeObservabilityService) GetMonoVertexSummary(context.Context, string, string) (observability.Result[observability.VertexSummary], error) {
	return f.summary, f.err
}

func (f *fakeObservabilityService) GetMonoVertexStatus(context.Context, string, string) (observability.Result[observability.VertexStatus], error) {
	return f.status, f.err
}
