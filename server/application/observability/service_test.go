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
	"strings"
	"testing"
	"time"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	apierrors "k8s.io/apimachinery/pkg/api/errors"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/runtime"
	"k8s.io/apimachinery/pkg/types"
	k8stesting "k8s.io/client-go/testing"

	dfv1 "github.com/numaproj/numaflow/pkg/apis/numaflow/v1alpha1"
	fakeclientset "github.com/numaproj/numaflow/pkg/client/clientset/versioned/fake"
)

var observedAt = time.Date(2026, time.September, 16, 12, 0, 0, 0, time.UTC)

func TestPipelineVertexSummaryAndStatus(t *testing.T) {
	transition := metav1.NewTime(observedAt.Add(-time.Minute))
	vertex := &dfv1.Vertex{
		TypeMeta: metav1.TypeMeta{
			APIVersion: dfv1.SchemeGroupVersion.String(),
			Kind:       "Vertex",
		},
		ObjectMeta: metav1.ObjectMeta{
			Name:              "orders-map",
			Namespace:         "team-a",
			UID:               types.UID("vertex-uid"),
			ResourceVersion:   "17",
			Generation:        4,
			CreationTimestamp: metav1.NewTime(observedAt.Add(-time.Hour)),
		},
		Spec: dfv1.VertexSpec{
			AbstractVertex: dfv1.AbstractVertex{
				Name: "map",
				UDF:  &dfv1.UDF{},
			},
			PipelineName: "orders",
			Lifecycle: dfv1.VertexLifecycle{
				DesiredPhase: dfv1.VertexPhaseRunning,
			},
		},
		Status: dfv1.VertexStatus{
			Status: dfv1.Status{Conditions: []metav1.Condition{{
				Type:               string(dfv1.VertexConditionPodsHealthy),
				Status:             metav1.ConditionTrue,
				Reason:             "Ready",
				Message:            "All pods are ready",
				ObservedGeneration: 4,
				LastTransitionTime: transition,
			}}},
			Phase:                dfv1.VertexPhaseRunning,
			Replicas:             3,
			DesiredReplicas:      3,
			ReadyReplicas:        3,
			UpdatedReplicas:      3,
			UpdatedReadyReplicas: 3,
			ObservedGeneration:   4,
		},
	}
	service := newTestService(t, PodViewModeOptIn, vertex)

	summary, err := service.GetPipelineVertexSummary(context.Background(), "team-a", "orders", "map")
	require.NoError(t, err)
	assert.Equal(t, "17", summary.ResourceVersion)
	assert.Equal(t, TargetKindPipelineVertex, summary.Value.Ref.Kind)
	assert.Equal(t, "orders", summary.Value.Ref.Pipeline)
	assert.Equal(t, "map", summary.Value.Ref.Name)
	assert.Equal(t, string(dfv1.VertexTypeMapUDF), summary.Value.VertexType)
	assert.Equal(t, HealthStateHealthy, summary.Value.Health.State)
	assert.Equal(t, transition.Time, summary.Value.ObservedAt)

	status, err := service.GetPipelineVertexStatus(context.Background(), "team-a", "orders", "map")
	require.NoError(t, err)
	assert.Equal(t, int64(3), status.Value.Replicas.Ready)
	require.Len(t, status.Value.Conditions, 1)
	assert.Equal(t, "Ready", status.Value.Conditions[0].Reason)
	assert.Equal(t, transition.Time, status.Value.Conditions[0].LastTransitionTime)
}

func TestMonoVertexSummaryAndStatus(t *testing.T) {
	monoVertex := &dfv1.MonoVertex{
		TypeMeta: metav1.TypeMeta{
			APIVersion: dfv1.SchemeGroupVersion.String(),
			Kind:       "MonoVertex",
		},
		ObjectMeta: metav1.ObjectMeta{
			Name:              "orders",
			Namespace:         "team-a",
			UID:               types.UID("mono-vertex-uid"),
			ResourceVersion:   "23",
			Generation:        7,
			CreationTimestamp: metav1.NewTime(observedAt.Add(-2 * time.Hour)),
		},
		Spec: dfv1.MonoVertexSpec{
			Lifecycle: dfv1.MonoVertexLifecycle{DesiredPhase: dfv1.MonoVertexPhasePaused},
		},
		Status: dfv1.MonoVertexStatus{
			Phase:              dfv1.MonoVertexPhaseRunning,
			Replicas:           2,
			DesiredReplicas:    0,
			ReadyReplicas:      2,
			ObservedGeneration: 7,
		},
	}
	service := newTestService(t, PodViewModeDefault, monoVertex)

	summary, err := service.GetMonoVertexSummary(context.Background(), "team-a", "orders")
	require.NoError(t, err)
	assert.Equal(t, TargetKindMonoVertex, summary.Value.Ref.Kind)
	assert.Empty(t, summary.Value.Ref.Pipeline)
	assert.Equal(t, "MonoVertex", summary.Value.VertexType)
	assert.Equal(t, HealthStateInactive, summary.Value.Health.State)

	status, err := service.GetMonoVertexStatus(context.Background(), "team-a", "orders")
	require.NoError(t, err)
	assert.Equal(t, string(dfv1.MonoVertexPhasePaused), status.Value.DesiredPhase)
	assert.Equal(t, int64(2), status.Value.Replicas.Current)
}

func TestCapabilities(t *testing.T) {
	tests := []struct {
		mode            PodViewMode
		eligible        bool
		defaultView     PodViewExperience
		classicFallback bool
	}{
		{PodViewModeDisabled, false, PodViewExperienceClassic, true},
		{PodViewModeOptIn, true, PodViewExperienceClassic, true},
		{PodViewModeDefault, true, PodViewExperienceNext, true},
		{PodViewModeRequired, true, PodViewExperienceNext, false},
	}
	for _, test := range tests {
		t.Run(string(test.mode), func(t *testing.T) {
			service := newTestService(t, test.mode)
			capabilities := service.GetCapabilities()
			assert.Equal(t, test.eligible, capabilities.PodView.Eligible)
			assert.Equal(t, test.defaultView, capabilities.PodView.DefaultExperience)
			assert.Equal(t, test.classicFallback, capabilities.PodView.AllowClassicFallback)
			assert.Len(t, capabilities.Operations, 4)
		})
	}
}

func TestNewServiceRejectsInvalidInput(t *testing.T) {
	_, err := NewService(nil, PodViewModeDisabled)
	require.Error(t, err)

	client := fakeclientset.NewSimpleClientset().NumaflowV1alpha1()
	_, err = NewService(client, PodViewMode("invalid"))
	require.Error(t, err)
}

func TestPipelineVertexRejectsAmbiguousResourceName(t *testing.T) {
	vertex := &dfv1.Vertex{
		ObjectMeta: metav1.ObjectMeta{
			Name:      "a-b-c",
			Namespace: "team-a",
		},
		Spec: dfv1.VertexSpec{
			PipelineName: "a-b",
			AbstractVertex: dfv1.AbstractVertex{
				Name: "c",
				UDF:  &dfv1.UDF{},
			},
		},
	}
	service := newTestService(t, PodViewModeOptIn, vertex)

	_, err := service.GetPipelineVertexSummary(context.Background(), "team-a", "a", "b-c")
	require.Error(t, err)
	assert.True(t, apierrors.IsNotFound(err))
}

func TestSummaryAndStatusBoundProviderMessages(t *testing.T) {
	vertex := &dfv1.Vertex{
		ObjectMeta: metav1.ObjectMeta{
			Name:      "orders-map",
			Namespace: "team-a",
		},
		Spec: dfv1.VertexSpec{
			PipelineName: "orders",
			AbstractVertex: dfv1.AbstractVertex{
				Name: "map",
				UDF:  &dfv1.UDF{},
			},
		},
		Status: dfv1.VertexStatus{
			Phase:   dfv1.VertexPhaseFailed,
			Reason:  strings.Repeat("r", maximumReasonLength+10),
			Message: strings.Repeat("m", maximumMessageLength+10),
			Status: dfv1.Status{Conditions: []metav1.Condition{{
				Type:               "Ready",
				Status:             metav1.ConditionFalse,
				Reason:             strings.Repeat("c", maximumReasonLength+10),
				Message:            strings.Repeat("d", maximumMessageLength+10),
				LastTransitionTime: metav1.NewTime(observedAt),
			}}},
		},
	}
	service := newTestService(t, PodViewModeOptIn, vertex)

	summary, err := service.GetPipelineVertexSummary(context.Background(), "team-a", "orders", "map")
	require.NoError(t, err)
	assert.Len(t, []rune(summary.Value.Health.Message), maximumMessageLength)
	assert.ElementsMatch(t, []string{"health.reason", "health.message"}, summary.Value.TruncatedFields)

	status, err := service.GetPipelineVertexStatus(context.Background(), "team-a", "orders", "map")
	require.NoError(t, err)
	assert.Len(t, []rune(status.Value.Message), maximumMessageLength)
	assert.ElementsMatch(t, []string{"reason", "message", "conditions[0].reason", "conditions[0].message"}, status.Value.TruncatedFields)
}

func newTestService(t *testing.T, mode PodViewMode, objects ...runtime.Object) *Service {
	t.Helper()
	clientset := fakeclientset.NewSimpleClientset()
	clientset.PrependReactor("get", "*", func(action k8stesting.Action) (bool, runtime.Object, error) {
		getAction, ok := action.(k8stesting.GetAction)
		if !ok {
			return false, nil, nil
		}
		for _, object := range objects {
			switch resource := object.(type) {
			case *dfv1.Vertex:
				if action.GetResource().Resource == "vertices" &&
					action.GetNamespace() == resource.Namespace &&
					getAction.GetName() == resource.Name {
					return true, resource.DeepCopy(), nil
				}
			case *dfv1.MonoVertex:
				if action.GetResource().Resource == "monovertices" &&
					action.GetNamespace() == resource.Namespace &&
					getAction.GetName() == resource.Name {
					return true, resource.DeepCopy(), nil
				}
			}
		}
		return false, nil, nil
	})
	service, err := NewService(clientset.NumaflowV1alpha1(), mode)
	require.NoError(t, err)
	return service
}
