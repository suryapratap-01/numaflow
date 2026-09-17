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

var phaseOneOperations = []string{
	"getPipelineVertexSummary",
	"getPipelineVertexStatus",
	"getMonoVertexSummary",
	"getMonoVertexStatus",
}

func (s *Service) GetCapabilities() Capabilities {
	podView := PodViewCapability{
		Mode:                 s.podViewMode,
		Eligible:             true,
		DefaultExperience:    PodViewExperienceClassic,
		AllowClassicFallback: true,
	}
	switch s.podViewMode {
	case PodViewModeDefault:
		podView.DefaultExperience = PodViewExperienceNext
	case PodViewModeRequired:
		podView.DefaultExperience = PodViewExperienceNext
		podView.AllowClassicFallback = false
	}

	return Capabilities{
		APIVersion: "v2",
		PodView:    podView,
		Operations: append([]string(nil), phaseOneOperations...),
		Limits: APILimits{
			DefaultPageSize:     50,
			MaximumPageSize:     200,
			MaximumLogLines:     1000,
			MaximumMetricPoints: 2000,
		},
	}
}
