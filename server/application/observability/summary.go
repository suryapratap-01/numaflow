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

package observability

import (
	"context"
	"time"

	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"

	dfv1 "github.com/numaproj/numaflow/pkg/apis/numaflow/v1alpha1"
)

func (s *Service) GetPipelineVertexSummary(ctx context.Context, namespace, pipeline, vertex string) (Result[VertexSummary], error) {
	resource, err := s.getPipelineVertex(ctx, namespace, pipeline, vertex)
	if err != nil {
		return Result[VertexSummary]{}, err
	}

	lastScaledAt := optionalTime(resource.Status.LastScaledAt)
	health, truncatedFields := normalizeHealth(string(resource.Status.Phase), string(resource.Spec.Lifecycle.GetDesiredPhase()), resource.Status.IsHealthy(), resource.Status.Reason, resource.Status.Message)
	summary := VertexSummary{
		Ref: TargetRef{
			Kind:      TargetKindPipelineVertex,
			Namespace: namespace,
			Pipeline:  pipeline,
			Name:      vertex,
			UID:       string(resource.UID),
		},
		VertexType:         string(resource.GetVertexType()),
		Phase:              string(resource.Status.Phase),
		DesiredPhase:       string(resource.Spec.Lifecycle.GetDesiredPhase()),
		Health:             health,
		Generation:         resource.Generation,
		ObservedGeneration: resource.Status.ObservedGeneration,
		CreatedAt:          resource.CreationTimestamp.Time,
		ObservedAt:         resourceObservedAt(resource.CreationTimestamp, resource.Status.Conditions, resource.Status.LastScaledAt),
		LastScaledAt:       lastScaledAt,
		Capabilities:       []string{"summary", "status"},
		TruncatedFields:    truncatedFields,
	}
	return Result[VertexSummary]{Value: summary, ResourceVersion: resource.ResourceVersion}, nil
}

func (s *Service) GetMonoVertexSummary(ctx context.Context, namespace, monoVertex string) (Result[VertexSummary], error) {
	resource, err := s.numaflowClient.MonoVertices(namespace).Get(ctx, monoVertex, metav1.GetOptions{})
	if err != nil {
		return Result[VertexSummary]{}, err
	}

	lastScaledAt := optionalTime(resource.Status.LastScaledAt)
	health, truncatedFields := normalizeHealth(string(resource.Status.Phase), string(resource.Spec.Lifecycle.GetDesiredPhase()), resource.Status.IsHealthy(), resource.Status.Reason, resource.Status.Message)
	summary := VertexSummary{
		Ref: TargetRef{
			Kind:      TargetKindMonoVertex,
			Namespace: namespace,
			Name:      monoVertex,
			UID:       string(resource.UID),
		},
		VertexType:         "MonoVertex",
		Phase:              string(resource.Status.Phase),
		DesiredPhase:       string(resource.Spec.Lifecycle.GetDesiredPhase()),
		Health:             health,
		Generation:         resource.Generation,
		ObservedGeneration: resource.Status.ObservedGeneration,
		CreatedAt:          resource.CreationTimestamp.Time,
		ObservedAt:         resourceObservedAt(resource.CreationTimestamp, resource.Status.Conditions, resource.Status.LastUpdated, resource.Status.LastScaledAt),
		LastScaledAt:       lastScaledAt,
		Capabilities:       []string{"summary", "status"},
		TruncatedFields:    truncatedFields,
	}
	return Result[VertexSummary]{Value: summary, ResourceVersion: resource.ResourceVersion}, nil
}

func normalizeHealth(phase, desiredPhase string, healthy bool, reason, message string) (Health, []string) {
	state := HealthStateUnknown
	switch {
	case phase == string(dfv1.VertexPhaseFailed) || phase == string(dfv1.MonoVertexPhaseFailed):
		state = HealthStateCritical
	case phase == string(dfv1.VertexPhasePaused) ||
		phase == string(dfv1.MonoVertexPhasePaused) ||
		desiredPhase == string(dfv1.VertexPhasePaused) ||
		desiredPhase == string(dfv1.MonoVertexPhasePaused) ||
		phase == "Pausing" ||
		phase == "Deleting":
		state = HealthStateInactive
	case phase == string(dfv1.VertexPhaseRunning) || phase == string(dfv1.MonoVertexPhaseRunning):
		if healthy {
			state = HealthStateHealthy
		} else {
			state = HealthStateWarning
		}
	}
	reason, reasonTruncated := truncateString(reason, maximumReasonLength)
	message, messageTruncated := truncateString(message, maximumMessageLength)
	truncatedFields := make([]string, 0, 2)
	if reasonTruncated {
		truncatedFields = append(truncatedFields, "health.reason")
	}
	if messageTruncated {
		truncatedFields = append(truncatedFields, "health.message")
	}
	return Health{State: state, Reason: reason, Message: message}, truncatedFields
}

func optionalTime(value metav1.Time) *time.Time {
	if value.IsZero() {
		return nil
	}
	t := value.UTC()
	return &t
}

func resourceObservedAt(createdAt metav1.Time, conditions []metav1.Condition, timestamps ...metav1.Time) time.Time {
	observedAt := createdAt.Time
	for _, timestamp := range timestamps {
		if timestamp.After(observedAt) {
			observedAt = timestamp.Time
		}
	}
	for _, condition := range conditions {
		if condition.LastTransitionTime.After(observedAt) {
			observedAt = condition.LastTransitionTime.Time
		}
	}
	return observedAt.UTC()
}

const (
	maximumReasonLength  = 256
	maximumMessageLength = 1024
)

func truncateString(value string, maximumLength int) (string, bool) {
	runes := []rune(value)
	if len(runes) <= maximumLength {
		return value, false
	}
	return string(runes[:maximumLength]), true
}
