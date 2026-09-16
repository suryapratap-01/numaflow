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
	"fmt"
	"net/http"
	"strings"

	"github.com/gin-gonic/gin"
	apierrors "k8s.io/apimachinery/pkg/api/errors"
	"k8s.io/apimachinery/pkg/util/validation"

	"github.com/numaproj/numaflow/server/apis/v2/generated"
	"github.com/numaproj/numaflow/server/application/observability"
)

type ObservabilityService interface {
	GetCapabilities() observability.Capabilities
	GetPipelineVertexSummary(ctx context.Context, namespace, pipeline, vertex string) (observability.Result[observability.VertexSummary], error)
	GetPipelineVertexStatus(ctx context.Context, namespace, pipeline, vertex string) (observability.Result[observability.VertexStatus], error)
	GetMonoVertexSummary(ctx context.Context, namespace, monoVertex string) (observability.Result[observability.VertexSummary], error)
	GetMonoVertexStatus(ctx context.Context, namespace, monoVertex string) (observability.Result[observability.VertexStatus], error)
}

type Handler struct {
	service ObservabilityService
}

func NewHandler(service ObservabilityService) (*Handler, error) {
	if service == nil {
		return nil, fmt.Errorf("observability service is required")
	}
	return &Handler{service: service}, nil
}

var _ generated.ServerInterface = (*Handler)(nil)

func (h *Handler) GetCapabilities(c *gin.Context) {
	c.JSON(http.StatusOK, toCapabilities(h.service.GetCapabilities()))
}

func (h *Handler) GetPipelineVertexSummary(c *gin.Context, namespace generated.Namespace, pipeline generated.Pipeline, vertex generated.Vertex, params generated.GetPipelineVertexSummaryParams) {
	if !validateNames(c, nameField{"namespace", namespace}, nameField{"pipeline", pipeline}, nameField{"vertex", vertex}) {
		return
	}
	result, err := h.service.GetPipelineVertexSummary(c.Request.Context(), namespace, pipeline, vertex)
	if err != nil {
		writeServiceError(c, err, "pipeline vertex")
		return
	}
	writeVersioned(c, result.ResourceVersion, params.IfNoneMatch, toVertexSummary(result.Value))
}

func (h *Handler) GetPipelineVertexStatus(c *gin.Context, namespace generated.Namespace, pipeline generated.Pipeline, vertex generated.Vertex, params generated.GetPipelineVertexStatusParams) {
	if !validateNames(c, nameField{"namespace", namespace}, nameField{"pipeline", pipeline}, nameField{"vertex", vertex}) {
		return
	}
	result, err := h.service.GetPipelineVertexStatus(c.Request.Context(), namespace, pipeline, vertex)
	if err != nil {
		writeServiceError(c, err, "pipeline vertex")
		return
	}
	writeVersioned(c, result.ResourceVersion, params.IfNoneMatch, toVertexStatus(result.Value))
}

func (h *Handler) GetMonoVertexSummary(c *gin.Context, namespace generated.Namespace, monoVertex generated.MonoVertex, params generated.GetMonoVertexSummaryParams) {
	if !validateNames(c, nameField{"namespace", namespace}, nameField{"monoVertex", monoVertex}) {
		return
	}
	result, err := h.service.GetMonoVertexSummary(c.Request.Context(), namespace, monoVertex)
	if err != nil {
		writeServiceError(c, err, "MonoVertex")
		return
	}
	writeVersioned(c, result.ResourceVersion, params.IfNoneMatch, toVertexSummary(result.Value))
}

func (h *Handler) GetMonoVertexStatus(c *gin.Context, namespace generated.Namespace, monoVertex generated.MonoVertex, params generated.GetMonoVertexStatusParams) {
	if !validateNames(c, nameField{"namespace", namespace}, nameField{"monoVertex", monoVertex}) {
		return
	}
	result, err := h.service.GetMonoVertexStatus(c.Request.Context(), namespace, monoVertex)
	if err != nil {
		writeServiceError(c, err, "MonoVertex")
		return
	}
	writeVersioned(c, result.ResourceVersion, params.IfNoneMatch, toVertexStatus(result.Value))
}

type nameField struct {
	name  string
	value string
}

func validateNames(c *gin.Context, fields ...nameField) bool {
	violations := make([]generated.Violation, 0)
	for _, field := range fields {
		for _, message := range validation.IsDNS1123Subdomain(field.value) {
			violations = append(violations, generated.Violation{
				Field:   field.name,
				Reason:  "invalid_kubernetes_name",
				Message: message,
			})
		}
	}
	if len(violations) == 0 {
		return true
	}
	WriteProblem(c, http.StatusUnprocessableEntity, "validation_failed", "Request validation failed", "One or more target names are invalid", violations)
	return false
}

func writeServiceError(c *gin.Context, err error, targetType string) {
	if apierrors.IsNotFound(err) {
		WriteProblem(c, http.StatusNotFound, "target_not_found", "Target not found", fmt.Sprintf("The requested %s does not exist", targetType), nil)
		return
	}
	WriteProblem(c, http.StatusInternalServerError, "target_read_failed", "Target read failed", fmt.Sprintf("Failed to read the requested %s", targetType), nil)
}

func writeVersioned[T any](c *gin.Context, resourceVersion string, ifNoneMatch *string, value T) {
	etag := fmt.Sprintf("%q", resourceVersion)
	c.Header("ETag", etag)
	c.Header("Cache-Control", "private, no-cache")
	if ifNoneMatch != nil && strings.TrimSpace(*ifNoneMatch) == etag {
		c.Status(http.StatusNotModified)
		return
	}
	c.JSON(http.StatusOK, value)
}

func toCapabilities(value observability.Capabilities) generated.Capabilities {
	return generated.Capabilities{
		ApiVersion: value.APIVersion,
		PodView: generated.PodViewCapability{
			Mode:                 generated.PodViewMode(value.PodView.Mode),
			Eligible:             value.PodView.Eligible,
			DefaultExperience:    generated.PodViewExperience(value.PodView.DefaultExperience),
			AllowClassicFallback: value.PodView.AllowClassicFallback,
		},
		Operations: value.Operations,
		Limits: generated.ApiLimits{
			DefaultPageSize:     value.Limits.DefaultPageSize,
			MaximumPageSize:     value.Limits.MaximumPageSize,
			MaximumLogLines:     value.Limits.MaximumLogLines,
			MaximumMetricPoints: value.Limits.MaximumMetricPoints,
		},
	}
}

func toVertexSummary(value observability.VertexSummary) generated.VertexSummary {
	return generated.VertexSummary{
		Ref:                toTargetRef(value.Ref),
		VertexType:         generated.VertexType(value.VertexType),
		Phase:              value.Phase,
		DesiredPhase:       value.DesiredPhase,
		Health:             toHealth(value.Health),
		Generation:         value.Generation,
		ObservedGeneration: value.ObservedGeneration,
		CreatedAt:          value.CreatedAt,
		ObservedAt:         value.ObservedAt,
		LastScaledAt:       value.LastScaledAt,
		Capabilities:       value.Capabilities,
		TruncatedFields:    optionalStrings(value.TruncatedFields),
	}
}

func toVertexStatus(value observability.VertexStatus) generated.VertexStatus {
	conditions := make([]generated.Condition, 0, len(value.Conditions))
	for _, condition := range value.Conditions {
		conditions = append(conditions, generated.Condition{
			Type:               condition.Type,
			Status:             generated.ConditionStatus(condition.Status),
			Reason:             condition.Reason,
			Message:            optionalString(condition.Message),
			ObservedGeneration: condition.ObservedGeneration,
			LastTransitionTime: condition.LastTransitionTime,
		})
	}
	return generated.VertexStatus{
		Ref:          toTargetRef(value.Ref),
		Phase:        value.Phase,
		DesiredPhase: value.DesiredPhase,
		Reason:       optionalString(value.Reason),
		Message:      optionalString(value.Message),
		Replicas: generated.ReplicaStatus{
			Current:      value.Replicas.Current,
			Desired:      value.Replicas.Desired,
			Ready:        value.Replicas.Ready,
			Updated:      value.Replicas.Updated,
			UpdatedReady: value.Replicas.UpdatedReady,
		},
		Conditions:         conditions,
		Generation:         value.Generation,
		ObservedGeneration: value.ObservedGeneration,
		ObservedAt:         value.ObservedAt,
		TruncatedFields:    optionalStrings(value.TruncatedFields),
	}
}

func toTargetRef(value observability.TargetRef) generated.TargetRef {
	return generated.TargetRef{
		Kind:      generated.TargetKind(value.Kind),
		Namespace: value.Namespace,
		Pipeline:  optionalString(value.Pipeline),
		Name:      value.Name,
		Uid:       value.UID,
	}
}

func toHealth(value observability.Health) generated.Health {
	return generated.Health{
		State:   generated.HealthState(value.State),
		Reason:  optionalString(value.Reason),
		Message: optionalString(value.Message),
	}
}

func optionalString(value string) *string {
	if value == "" {
		return nil
	}
	return &value
}

func optionalStrings(value []string) *[]string {
	if len(value) == 0 {
		return nil
	}
	return &value
}
