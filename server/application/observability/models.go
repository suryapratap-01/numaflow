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

import "time"

type TargetKind string

const (
	TargetKindPipelineVertex TargetKind = "PipelineVertex"
	TargetKindMonoVertex     TargetKind = "MonoVertex"
)

type HealthState string

const (
	HealthStateHealthy  HealthState = "healthy"
	HealthStateWarning  HealthState = "warning"
	HealthStateCritical HealthState = "critical"
	HealthStateInactive HealthState = "inactive"
	HealthStateUnknown  HealthState = "unknown"
)

type PodViewMode string

const (
	PodViewModeDisabled PodViewMode = "disabled"
	PodViewModeOptIn    PodViewMode = "optIn"
	PodViewModeDefault  PodViewMode = "default"
	PodViewModeRequired PodViewMode = "required"
)

type PodViewExperience string

const (
	PodViewExperienceClassic PodViewExperience = "classic"
	PodViewExperienceNext    PodViewExperience = "next"
)

type TargetRef struct {
	Kind      TargetKind
	Namespace string
	Pipeline  string
	Name      string
	UID       string
}

type Health struct {
	State   HealthState
	Reason  string
	Message string
}

type VertexSummary struct {
	Ref                TargetRef
	VertexType         string
	Phase              string
	DesiredPhase       string
	Health             Health
	Generation         int64
	ObservedGeneration int64
	CreatedAt          time.Time
	ObservedAt         time.Time
	LastScaledAt       *time.Time
	Capabilities       []string
	TruncatedFields    []string
}

type ReplicaStatus struct {
	Current      int64
	Desired      int64
	Ready        int64
	Updated      int64
	UpdatedReady int64
}

type Condition struct {
	Type               string
	Status             string
	Reason             string
	Message            string
	ObservedGeneration int64
	LastTransitionTime time.Time
}

type VertexStatus struct {
	Ref                TargetRef
	Phase              string
	DesiredPhase       string
	Reason             string
	Message            string
	Replicas           ReplicaStatus
	Conditions         []Condition
	Generation         int64
	ObservedGeneration int64
	ObservedAt         time.Time
	TruncatedFields    []string
}

type PodViewCapability struct {
	Mode                 PodViewMode
	Eligible             bool
	DefaultExperience    PodViewExperience
	AllowClassicFallback bool
}

type APILimits struct {
	DefaultPageSize     int
	MaximumPageSize     int
	MaximumLogLines     int
	MaximumMetricPoints int
}

type Capabilities struct {
	APIVersion string
	PodView    PodViewCapability
	Operations []string
	Limits     APILimits
}

type Result[T any] struct {
	Value           T
	ResourceVersion string
}
