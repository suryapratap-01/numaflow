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
	"fmt"
	"net/http"
	"strings"

	apiv2 "github.com/numaproj/numaflow/pkg/apiclient/v2"
)

type SummaryAPI interface {
	GetPipelineVertexSummaryWithResponse(ctx context.Context, namespace apiv2.Namespace, pipeline apiv2.Pipeline, vertex apiv2.Vertex, params *apiv2.GetPipelineVertexSummaryParams, reqEditors ...apiv2.RequestEditorFn) (*apiv2.GetPipelineVertexSummaryResponse, error)
	GetMonoVertexSummaryWithResponse(ctx context.Context, namespace apiv2.Namespace, monoVertex apiv2.MonoVertex, params *apiv2.GetMonoVertexSummaryParams, reqEditors ...apiv2.RequestEditorFn) (*apiv2.GetMonoVertexSummaryResponse, error)
}

func NewAPIClient(serverURL, baseHref, token string, httpClient *http.Client) (SummaryAPI, error) {
	if strings.TrimSpace(serverURL) == "" {
		return nil, fmt.Errorf("numaflow API server URL is required")
	}
	apiURL := strings.TrimRight(serverURL, "/")
	if trimmedBase := strings.Trim(baseHref, "/"); trimmedBase != "" {
		apiURL += "/" + trimmedBase
	}
	apiURL += "/api/v2"

	options := make([]apiv2.ClientOption, 0, 2)
	if httpClient != nil {
		options = append(options, apiv2.WithHTTPClient(httpClient))
	}
	if token = strings.TrimSpace(token); token != "" {
		options = append(options, apiv2.WithRequestEditorFn(func(_ context.Context, request *http.Request) error {
			request.Header.Set("Authorization", "Bearer "+token)
			return nil
		}))
	}
	return apiv2.NewClientWithResponses(apiURL, options...)
}
