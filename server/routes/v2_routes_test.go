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

package routes

import (
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/numaproj/numaflow/server/authz"
)

func TestV2AuthRouteMapComesFromOpenAPI(t *testing.T) {
	routeMap, err := V2AuthRouteMap("/numaflow/")
	require.NoError(t, err)
	require.Len(t, routeMap, 5)

	capabilities := routeMap["GET:/numaflow/api/v2/capabilities"]
	require.NotNil(t, capabilities)
	assert.False(t, capabilities.RequiresAuthZ)

	pipelineSummary := routeMap["GET:/numaflow/api/v2/namespaces/:namespace/pipelines/:pipeline/vertices/:vertex/summary"]
	require.NotNil(t, pipelineSummary)
	assert.True(t, pipelineSummary.RequiresAuthZ)
	assert.Equal(t, authz.ObjectPipeline, pipelineSummary.Object)

	monoVertexStatus := routeMap["GET:/numaflow/api/v2/namespaces/:namespace/mono-vertices/:monoVertex/status"]
	require.NotNil(t, monoVertexStatus)
	assert.True(t, monoVertexStatus.RequiresAuthZ)
	assert.Equal(t, authz.ObjectMonoVertex, monoVertexStatus.Object)
}
