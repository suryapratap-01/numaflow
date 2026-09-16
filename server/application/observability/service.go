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

	apierrors "k8s.io/apimachinery/pkg/api/errors"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"

	dfv1 "github.com/numaproj/numaflow/pkg/apis/numaflow/v1alpha1"
	dfv1clients "github.com/numaproj/numaflow/pkg/client/clientset/versioned/typed/numaflow/v1alpha1"
)

type Service struct {
	numaflowClient dfv1clients.NumaflowV1alpha1Interface
	podViewMode    PodViewMode
}

func NewService(numaflowClient dfv1clients.NumaflowV1alpha1Interface, podViewMode PodViewMode) (*Service, error) {
	if numaflowClient == nil {
		return nil, fmt.Errorf("numaflow client is required")
	}
	if podViewMode == "" {
		podViewMode = PodViewModeDisabled
	}
	if !podViewMode.Valid() {
		return nil, fmt.Errorf("unsupported Pod View v2 mode %q", podViewMode)
	}
	return &Service{
		numaflowClient: numaflowClient,
		podViewMode:    podViewMode,
	}, nil
}

func (m PodViewMode) Valid() bool {
	switch m {
	case PodViewModeDisabled, PodViewModeOptIn, PodViewModeDefault, PodViewModeRequired:
		return true
	default:
		return false
	}
}

func (s *Service) getPipelineVertex(ctx context.Context, namespace, pipeline, vertex string) (*dfv1.Vertex, error) {
	resource, err := s.numaflowClient.Vertices(namespace).Get(ctx, fmt.Sprintf("%s-%s", pipeline, vertex), metav1.GetOptions{})
	if err != nil {
		return nil, err
	}
	if resource.Spec.PipelineName != pipeline || resource.Spec.Name != vertex {
		return nil, apierrors.NewNotFound(dfv1.Resource("vertices"), fmt.Sprintf("%s-%s", pipeline, vertex))
	}
	return resource, nil
}
