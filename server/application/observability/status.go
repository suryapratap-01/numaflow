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
	"fmt"

	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
)

func (s *Service) GetPipelineVertexStatus(ctx context.Context, namespace, pipeline, vertex string) (Result[VertexStatus], error) {
	resource, err := s.getPipelineVertex(ctx, namespace, pipeline, vertex)
	if err != nil {
		return Result[VertexStatus]{}, err
	}

	reason, reasonTruncated := truncateString(resource.Status.Reason, maximumReasonLength)
	message, messageTruncated := truncateString(resource.Status.Message, maximumMessageLength)
	conditions, conditionTruncations := normalizeConditions(resource.Status.Conditions)
	status := VertexStatus{
		Ref: TargetRef{
			Kind:      TargetKindPipelineVertex,
			Namespace: namespace,
			Pipeline:  pipeline,
			Name:      vertex,
			UID:       string(resource.UID),
		},
		Phase:        string(resource.Status.Phase),
		DesiredPhase: string(resource.Spec.Lifecycle.GetDesiredPhase()),
		Reason:       reason,
		Message:      message,
		Replicas: ReplicaStatus{
			Current:      int64(resource.Status.Replicas),
			Desired:      int64(resource.Status.DesiredReplicas),
			Ready:        int64(resource.Status.ReadyReplicas),
			Updated:      int64(resource.Status.UpdatedReplicas),
			UpdatedReady: int64(resource.Status.UpdatedReadyReplicas),
		},
		Conditions:         conditions,
		Generation:         resource.Generation,
		ObservedGeneration: resource.Status.ObservedGeneration,
		ObservedAt:         resourceObservedAt(resource.CreationTimestamp, resource.Status.Conditions, resource.Status.LastScaledAt),
		TruncatedFields:    statusTruncatedFields(reasonTruncated, messageTruncated, conditionTruncations),
	}
	return Result[VertexStatus]{Value: status, ResourceVersion: resource.ResourceVersion}, nil
}

func (s *Service) GetMonoVertexStatus(ctx context.Context, namespace, monoVertex string) (Result[VertexStatus], error) {
	resource, err := s.numaflowClient.MonoVertices(namespace).Get(ctx, monoVertex, metav1.GetOptions{})
	if err != nil {
		return Result[VertexStatus]{}, err
	}

	reason, reasonTruncated := truncateString(resource.Status.Reason, maximumReasonLength)
	message, messageTruncated := truncateString(resource.Status.Message, maximumMessageLength)
	conditions, conditionTruncations := normalizeConditions(resource.Status.Conditions)
	status := VertexStatus{
		Ref: TargetRef{
			Kind:      TargetKindMonoVertex,
			Namespace: namespace,
			Name:      monoVertex,
			UID:       string(resource.UID),
		},
		Phase:        string(resource.Status.Phase),
		DesiredPhase: string(resource.Spec.Lifecycle.GetDesiredPhase()),
		Reason:       reason,
		Message:      message,
		Replicas: ReplicaStatus{
			Current:      int64(resource.Status.Replicas),
			Desired:      int64(resource.Status.DesiredReplicas),
			Ready:        int64(resource.Status.ReadyReplicas),
			Updated:      int64(resource.Status.UpdatedReplicas),
			UpdatedReady: int64(resource.Status.UpdatedReadyReplicas),
		},
		Conditions:         conditions,
		Generation:         resource.Generation,
		ObservedGeneration: resource.Status.ObservedGeneration,
		ObservedAt:         resourceObservedAt(resource.CreationTimestamp, resource.Status.Conditions, resource.Status.LastUpdated, resource.Status.LastScaledAt),
		TruncatedFields:    statusTruncatedFields(reasonTruncated, messageTruncated, conditionTruncations),
	}
	return Result[VertexStatus]{Value: status, ResourceVersion: resource.ResourceVersion}, nil
}

func normalizeConditions(conditions []metav1.Condition) ([]Condition, []string) {
	result := make([]Condition, 0, len(conditions))
	truncatedFields := make([]string, 0)
	for index, condition := range conditions {
		reason, reasonTruncated := truncateString(condition.Reason, maximumReasonLength)
		message, messageTruncated := truncateString(condition.Message, maximumMessageLength)
		result = append(result, Condition{
			Type:               condition.Type,
			Status:             string(condition.Status),
			Reason:             reason,
			Message:            message,
			ObservedGeneration: condition.ObservedGeneration,
			LastTransitionTime: condition.LastTransitionTime.UTC(),
		})
		if reasonTruncated {
			truncatedFields = append(truncatedFields, fmt.Sprintf("conditions[%d].reason", index))
		}
		if messageTruncated {
			truncatedFields = append(truncatedFields, fmt.Sprintf("conditions[%d].message", index))
		}
	}
	return result, truncatedFields
}

func statusTruncatedFields(reasonTruncated, messageTruncated bool, conditionTruncations []string) []string {
	result := make([]string, 0, len(conditionTruncations)+2)
	if reasonTruncated {
		result = append(result, "reason")
	}
	if messageTruncated {
		result = append(result, "message")
	}
	return append(result, conditionTruncations...)
}
